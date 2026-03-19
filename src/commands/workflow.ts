import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import { executeGitCommand, getRepoState } from '../lib/git.js';
import { loadConfig, isProtectedBranch } from '../lib/config.js';
import { displaySuccess, displayStep } from '../lib/display.js';
import { getAISuggestion } from '../lib/ai.js';
import {
  readPlan, writePlan, todayKey, lastWorkdayKey,
  getCommitsSince, detectBlockers, suggestTodayPlan,
} from '../lib/standup.js';
import { getClaudeCodeTodos } from '../lib/integrations/claude-code.js';
import { getAssignedIssues } from '../lib/integrations/github.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

const execAsync = promisify(exec);

export function workflowCommand(program: Command) {
  const workflow = program
    .command('workflow')
    .description('Run predefined workflow shortcuts');

  // ── pr-ready ────────────────────────────────────────────────────────────────

  workflow
    .command('pr-ready')
    .description('Prepare branch for pull request (fetch, rebase, push)')
    .action(async () => {
      try {
        const config = await loadConfig();
        const mainBranch = config?.project?.mainBranch ?? 'main';
        const repoState = await getRepoState();

        // Guard: don't run on the main branch itself
        if (isProtectedBranch(repoState.currentBranch, config)) {
          console.error(
            chalk.red(`  ✖ You're on ${chalk.bold(repoState.currentBranch)}.`) +
            chalk.dim(' Switch to a feature branch first.')
          );
          process.exit(1);
        }

        console.log(
          `\n  Preparing ${chalk.cyan(repoState.currentBranch)} for PR against ` +
          `${chalk.dim(mainBranch)}...\n`
        );

        // Guard: stash uncommitted changes
        let stashed = false;
        if (!repoState.isClean) {
          console.log(chalk.yellow('  ⚠  Uncommitted changes detected.'));
          const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: 'Stash changes, rebase, then restore them', value: 'stash' },
              { name: 'Abort', value: 'abort' },
            ],
          }]);

          if (action === 'abort') {
            console.log('  Aborted.');
            return;
          }

          displayStep('git stash push -m "hermes pr-ready auto-stash"');
          await executeGitCommand('git stash push -m "hermes pr-ready auto-stash"');
          stashed = true;
          console.log();
        }

        const steps = [
          { cmd: 'git fetch origin', desc: 'Fetching latest changes' },
          { cmd: `git rebase origin/${mainBranch}`, desc: `Rebasing on ${mainBranch}` },
          { cmd: 'git push --force-with-lease', desc: 'Pushing changes safely' },
        ];

        for (const { cmd, desc } of steps) {
          console.log(`  ${desc}...`);
          displayStep(cmd);
          await executeGitCommand(cmd);
        }

        if (stashed) {
          console.log('\n  Restoring stashed changes...');
          displayStep('git stash pop');
          await executeGitCommand('git stash pop');
        }

        displaySuccess('Branch ready for PR!');
        console.log(chalk.dim('\n  Next: gh pr create  or open your hosting UI'));
        console.log();
      } catch (error) {
        console.error(chalk.red('\n  ✖ ' + (error instanceof Error ? error.message : error)));
        process.exit(1);
      }
    });

  // ── daily-sync ──────────────────────────────────────────────────────────────

  workflow
    .command('daily-sync')
    .description('Daily standup: what you did, what\'s next, and any blockers')
    .action(async () => {
      try {
        console.log('\n  ' + chalk.bold('Daily sync') + chalk.dim(' — gathering data...\n'));

        // 1. Fetch remote
        displayStep('git fetch --all --prune');
        await executeGitCommand('git fetch --all --prune').catch(() => { /* offline — continue */ });

        // 2. Gather everything in parallel
        const todayDate = todayKey();
        const yesterdayDate = lastWorkdayKey();

        const [repoState, stashList, mergedBranches, yesterdayCommits, todayCommits, yesterdayPlan] =
          await Promise.all([
            getRepoState(),
            execAsync('git stash list')
              .then(r => r.stdout.trim().split('\n').filter(Boolean))
              .catch(() => [] as string[]),
            execAsync('git branch --merged HEAD')
              .then(r =>
                r.stdout.trim().split('\n')
                  .map(b => b.trim().replace(/^\* /, ''))
                  .filter(b => b && !['main', 'master', 'staging', 'production', 'develop'].includes(b))
              )
              .catch(() => [] as string[]),
            getCommitsSince(yesterdayDate),
            getCommitsSince(todayDate),
            readPlan(yesterdayDate),
          ]);

        const blockers = await detectBlockers(repoState);

        // 3. Prompt for today's plan if not set
        let todayPlan = await readPlan(todayDate);
        if (!todayPlan) {
          console.log(chalk.yellow(`  No plan set for today (${todayDate}).\n`));

          // Probe integrations in parallel (non-blocking — failures become null)
          const [claudeTodos, githubIssues] = await Promise.all([
            getClaudeCodeTodos().catch(() => []),
            getAssignedIssues().catch(() => null),
          ]);

          const choices: Array<{ name: string; value: string }> = [
            { name: 'Type it myself', value: 'manual' },
            { name: 'Let AI suggest based on my repo', value: 'ai' },
          ];

          if (claudeTodos.length > 0) {
            choices.push({
              name: `Import from Claude Code  ${chalk.dim(`(${claudeTodos.length} pending task${claudeTodos.length !== 1 ? 's' : ''})`)}`,
              value: 'claude',
            });
          }
          if (githubIssues !== null) {
            choices.push({
              name: `Import from GitHub issues  ${chalk.dim(`(${githubIssues.length} open)`)}`,
              value: 'github',
            });
          }
          choices.push({ name: 'Skip for now', value: 'skip' });

          const { planMode } = await inquirer.prompt([{
            type: 'list',
            name: 'planMode',
            message: "What are you focusing on today?",
            choices,
          }]);

          todayPlan = await resolvePlan(planMode, {
            repoState, yesterdayPlan, yesterdayCommits, todayCommits, blockers,
            claudeTodos, githubIssues: githubIssues ?? [],
          });

          if (todayPlan) {
            await writePlan(todayDate, todayPlan);
          }
          console.log();
        }

        // 4. Build AI standup prompt
        const yesterdaySection = yesterdayCommits.length > 0
          ? yesterdayCommits.map(c => `- ${c.subject}`).join('\n')
          : '(no commits found)';

        const todayCommitsSection = todayCommits.length > 0
          ? todayCommits.map(c => `- ${c.subject}`).join('\n')
          : '(no commits yet today)';

        const blockersSection = blockers.length > 0
          ? blockers.map(b => `- [${b.severity}] ${b.message}`).join('\n')
          : '(none)';

        const prompt = `You are a developer writing a daily standup update for their team.

Use the data below to write a clear, concise standup. Write it in first person.
Keep each section to 1-3 sentences. Be specific — mention actual work items from the commit subjects.
If there are no commits, infer from the plan what was likely being worked on.

---
YESTERDAY'S INTENDED PLAN:
${yesterdayPlan ?? '(not recorded)'}

COMMITS FROM YESTERDAY / LAST WORKDAY:
${yesterdaySection}

COMMITS FROM TODAY SO FAR:
${todayCommitsSection}

TODAY'S PLAN:
${todayPlan}

BLOCKERS / REPO STATE:
${blockersSection}

CURRENT BRANCH: ${repoState.currentBranch}
---

Format your response as exactly three labelled sections:

Yesterday: <what was accomplished>
Today: <what will be worked on>
Blockers: <blockers or "None">

No bullet points, no markdown, no extra commentary.`;

        console.log('  Generating standup...\n');
        const standup = await getAISuggestion(prompt);

        // 5. Display standup
        const divider = chalk.dim('  ' + '─'.repeat(52));
        console.log(divider);
        standup.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx > 0 && colonIdx < 15) {
            const label = trimmed.slice(0, colonIdx);
            const body = trimmed.slice(colonIdx + 1).trim();
            console.log(`  ${chalk.bold.cyan(label + ':')} ${body}`);
          } else {
            console.log('  ' + trimmed);
          }
        });
        console.log(divider);

        // 6. Repo state summary (brief)
        const notes: string[] = [];
        if (repoState.behind > 0)
          notes.push(chalk.yellow(`${repoState.behind} commits behind`) + chalk.dim(' — hermes sync'));
        if (repoState.ahead > 0)
          notes.push(chalk.cyan(`${repoState.ahead} commits ahead`) + chalk.dim(' — git push'));
        if (!repoState.isClean)
          notes.push(chalk.yellow('uncommitted changes'));
        if (mergedBranches.length > 0)
          notes.push(chalk.dim(`${mergedBranches.length} merged branch${mergedBranches.length !== 1 ? 'es' : ''} to clean up — hermes workflow cleanup`));
        if (stashList.length > 0)
          notes.push(chalk.dim(`${stashList.length} stash${stashList.length !== 1 ? 'es' : ''} saved`));

        if (notes.length > 0) {
          console.log(`\n  ${chalk.bold('Repo notes')}`);
          notes.forEach(n => console.log(`  • ${n}`));
        }

        console.log();
      } catch (error) {
        console.error(chalk.red('\n  ✖ ' + (error instanceof Error ? error.message : error)));
        process.exit(1);
      }
    });

  // ── quick-commit ─────────────────────────────────────────────────────────────

  workflow
    .command('quick-commit')
    .description('Stage changed files and commit with an AI-generated message')
    .option('-a, --all', 'Stage all changes (default: only already-staged files)')
    .option('-p, --push', 'Push after committing')
    .action(async (options: { all?: boolean; push?: boolean }) => {
      try {
        console.log('\n  Quick commit...\n');

        const repoState = await getRepoState();

        if (repoState.isClean) {
          console.log('  ' + chalk.green('✓') + ' Nothing to commit');
          return;
        }

        if (options.all) {
          displayStep('git add -A');
          await executeGitCommand('git add -A');
        }

        const diff = await executeGitCommand('git diff --cached --stat');
        const diffFull = await executeGitCommand('git diff --cached');

        if (!diff.trim()) {
          console.log('  ' + chalk.yellow('⚠') + '  No staged changes. Use --all to stage everything, or stage files first.');
          return;
        }

        console.log('  Staged changes:');
        diff.trim().split('\n').forEach(l => console.log('  ' + chalk.dim(l)));

        console.log('\n  Generating commit message...');

        const message = await getAISuggestion(`Generate a concise git commit message for these changes.

Rules:
- Use conventional commits format: type(scope): description
- First line max 72 characters
- type is one of: feat, fix, refactor, docs, test, chore, style, perf
- Be specific about what changed, not how
- Return ONLY the commit message, no explanation, no quotes, no backticks

Diff:
${diffFull.slice(0, 8000)}`);

        console.log(`\n  Proposed: ${chalk.cyan(message)}\n`);

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'Commit with this message?',
          choices: [
            { name: 'Yes, commit', value: 'commit' },
            { name: 'Edit message', value: 'edit' },
            { name: 'Cancel', value: 'cancel' },
          ],
        }]);

        if (action === 'cancel') {
          console.log('  Cancelled. Changes remain staged.');
          return;
        }

        let finalMessage = message;

        if (action === 'edit') {
          const { edited } = await inquirer.prompt([{
            type: 'input',
            name: 'edited',
            message: 'Commit message:',
            default: message,
          }]);
          finalMessage = edited;
        }

        displayStep(`git commit -m "${finalMessage}"`);
        await executeGitCommand(`git commit -m ${JSON.stringify(finalMessage)}`);
        displaySuccess('Committed!');

        if (options.push) {
          console.log();
          const freshState = await getRepoState();
          const pushCmd = freshState.remoteTracking
            ? 'git push'
            : `git push -u origin ${freshState.currentBranch}`;
          displayStep(pushCmd);
          await executeGitCommand(pushCmd);
          displaySuccess('Pushed!');
        }

        console.log();
      } catch (error) {
        console.error(chalk.red('\n  ✖ ' + (error instanceof Error ? error.message : error)));
        process.exit(1);
      }
    });

  // ── cleanup ──────────────────────────────────────────────────────────────────

  workflow
    .command('cleanup')
    .description('Delete branches that have already been merged')
    .option('--remote', 'Also delete the corresponding remote tracking branches')
    .action(async (options: { remote?: boolean }) => {
      try {
        const config = await loadConfig();
        const mainBranch = config?.project?.mainBranch ?? 'main';
        const protected_ = config?.project?.protectedBranches ?? ['main', 'master', 'staging', 'production'];

        console.log('\n  Scanning for merged branches...\n');

        displayStep(`git fetch origin --prune`);
        await executeGitCommand('git fetch origin --prune').catch(() => { /* offline — continue with local info */ });

        const { stdout: branchOutput } = await execAsync(`git branch --merged ${mainBranch}`);
        const repoState = await getRepoState();

        const merged = branchOutput
          .split('\n')
          .map(b => b.trim().replace(/^\* /, ''))
          .filter(b => b && !protected_.includes(b) && b !== repoState.currentBranch);

        if (merged.length === 0) {
          console.log('  ' + chalk.green('✓') + ' No merged branches to clean up.');
          console.log();
          return;
        }

        console.log(`  Found ${chalk.yellow(merged.length)} merged branch${merged.length !== 1 ? 'es' : ''}:\n`);
        merged.forEach(b => console.log(`  ${chalk.dim('•')} ${b}`));
        console.log();

        const { selected } = await inquirer.prompt([{
          type: 'checkbox',
          name: 'selected',
          message: 'Select branches to delete:',
          choices: merged.map(b => ({ name: b, value: b, checked: true })),
        }]);

        if (selected.length === 0) {
          console.log('  Nothing selected. Exiting.');
          return;
        }

        for (const branch of selected) {
          displayStep(`git branch -d ${branch}`);
          await executeGitCommand(`git branch -d ${branch}`);

          if (options.remote) {
            try {
              displayStep(`git push origin --delete ${branch}`);
              await executeGitCommand(`git push origin --delete ${branch}`);
            } catch {
              console.log(chalk.dim(`  (remote branch ${branch} not found — skipping)`));
            }
          }
        }

        displaySuccess(`Deleted ${selected.length} branch${selected.length !== 1 ? 'es' : ''}!`);
        console.log();
      } catch (error) {
        console.error(chalk.red('\n  ✖ ' + (error instanceof Error ? error.message : error)));
        process.exit(1);
      }
    });

  // ── list ────────────────────────────────────────────────────────────────────

  workflow
    .command('list')
    .description('List available workflow shortcuts')
    .action(async () => {
      const config = await loadConfig();

      console.log('\n  ' + chalk.bold('Built-in workflows') + '\n');
      console.log(`  ${chalk.cyan('pr-ready')}      Rebase on main and push — safe PR prep with stash guard`);
      console.log(`  ${chalk.cyan('daily-sync')}    Fetch, show status, surface what to act on`);
      console.log(`  ${chalk.cyan('quick-commit')}  AI commit message; add ${chalk.dim('--push')} to commit + push`);
      console.log(`  ${chalk.cyan('cleanup')}       Delete merged branches; add ${chalk.dim('--remote')} to also clean remote`);

      if (config?.workflows && Object.keys(config.workflows).length > 0) {
        console.log('\n  ' + chalk.bold('Project workflows') + chalk.dim(' (.hermes/config.json)') + '\n');
        for (const [name, steps] of Object.entries(config.workflows)) {
          console.log(`  ${chalk.cyan(name.padEnd(14))} ${chalk.dim(steps.join(' → '))}`);
        }
      } else {
        console.log('\n  ' + chalk.dim('No project workflows defined. Run hermes init to set them up.'));
      }

      console.log();
    });
}

// ─── Plan resolution helper ───────────────────────────────────────────────────

interface ResolvePlanCtx {
  repoState: Awaited<ReturnType<typeof getRepoState>>;
  yesterdayPlan: string | null;
  yesterdayCommits: Awaited<ReturnType<typeof getCommitsSince>>;
  todayCommits: Awaited<ReturnType<typeof getCommitsSince>>;
  blockers: Awaited<ReturnType<typeof detectBlockers>>;
  claudeTodos: Array<{ id: string; content: string; status: string; priority: string }>;
  githubIssues: Array<{ number: number; title: string; url: string; labels: string[] }>;
}

async function resolvePlan(mode: string, ctx: ResolvePlanCtx): Promise<string | null> {
  if (mode === 'skip') return null;

  if (mode === 'manual') {
    const { typed } = await inquirer.prompt([{
      type: 'input',
      name: 'typed',
      message: "Today's plan:",
      validate: (v: string) => v.trim().length > 0 || 'Please enter something',
    }]);
    return typed.trim();
  }

  if (mode === 'ai') {
    process.stdout.write(chalk.dim('\n  Thinking...\r'));
    const suggested = await suggestTodayPlan({
      currentBranch: ctx.repoState.currentBranch,
      yesterdayPlan: ctx.yesterdayPlan,
      yesterdayCommits: ctx.yesterdayCommits,
      todayCommits: ctx.todayCommits,
      hasUncommittedChanges: ctx.repoState.hasUncommittedChanges,
      blockers: ctx.blockers,
    });
    process.stdout.write(' '.repeat(30) + '\r');
    return confirmOrEdit(suggested);
  }

  if (mode === 'claude') {
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: 'Select tasks to include in today\'s plan:',
      choices: ctx.claudeTodos.map(t => ({
        name: `${t.status === 'in_progress' ? chalk.yellow('(in progress) ') : ''}${t.content}` +
              chalk.dim(` [${t.priority}]`),
        value: t.content,
        checked: t.status === 'in_progress',
      })),
    }]);
    if (selected.length === 0) return null;
    const plan = selected.join('; ');
    return confirmOrEdit(plan);
  }

  if (mode === 'github') {
    if (ctx.githubIssues.length === 0) {
      console.log(chalk.dim('  No open issues assigned to you.'));
      return null;
    }
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: 'Select issues to include in today\'s plan:',
      choices: ctx.githubIssues.map(i => ({
        name: `#${i.number} ${i.title}` +
              (i.labels.length > 0 ? chalk.dim(` [${i.labels.join(', ')}]`) : ''),
        value: `#${i.number} ${i.title}`,
        checked: true,
      })),
    }]);
    if (selected.length === 0) return null;
    const plan = selected.join('; ');
    return confirmOrEdit(plan);
  }

  return null;
}

async function confirmOrEdit(suggestion: string): Promise<string | null> {
  console.log(`\n  ${chalk.bold('Plan:')} ${chalk.cyan(suggestion)}\n`);

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Use this?',
    choices: [
      { name: 'Yes', value: 'accept' },
      { name: 'Edit', value: 'edit' },
      { name: 'Skip', value: 'skip' },
    ],
  }]);

  if (action === 'accept') return suggestion;
  if (action === 'skip') return null;

  const { edited } = await inquirer.prompt([{
    type: 'input',
    name: 'edited',
    message: "Today's plan:",
    default: suggestion,
  }]);
  return edited.trim() || null;
}
