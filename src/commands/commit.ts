import { Command } from 'commander';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { getActiveProvider, getAISuggestion } from '../lib/ai.js';
import { getRepoState } from '../lib/git.js';
import { displayStep, displaySuccess } from '../lib/display.js';
import { recordCommand } from '../lib/stats.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface CommitAnalysis {
  summary: string;
  concerns: string[];
  message: string;
  body: string;
  alternatives: string[];
}

async function getStagedFiles(): Promise<{ path: string; status: string }[]> {
  try {
    const { stdout } = await execAsync('git diff --cached --name-status');
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.split('\t');
        return { status: status.trim(), path: rest.join('\t').trim() };
      });
  } catch {
    return [];
  }
}

async function getUnstagedFiles(): Promise<{ path: string; status: string }[]> {
  try {
    const { stdout } = await execAsync('git status --porcelain');
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2).trim();
        const path = line.slice(3).trim();
        // Only unstaged: index is clean (' M', '??', etc.)
        return { status, path };
      })
      .filter(({ status }) => status === '??' || status[0] === ' ' || status.length === 1);
  } catch {
    return [];
  }
}

async function getRecentBranchCommits(n = 5): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `git log --oneline -${n} --no-merges 2>/dev/null`
    );
    return stdout.trim();
  } catch {
    return '';
  }
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    M: chalk.yellow('modified '),
    A: chalk.green('new file '),
    D: chalk.red('deleted  '),
    R: chalk.blue('renamed  '),
    C: chalk.blue('copied   '),
    '??': chalk.dim('untracked'),
    ' M': chalk.yellow('modified '),
    ' D': chalk.red('deleted  '),
  };
  return map[s] ?? chalk.dim(s.padEnd(9));
}

function divider(): void {
  console.log(chalk.dim('  ' + '─'.repeat(54)));
}

async function analyzeChanges(
  branch: string,
  stagedDiff: string,
  stagedStat: string,
  recentCommits: string
): Promise<CommitAnalysis> {
  const prompt = `You are an expert Git historian. Analyze these staged changes and produce a structured commit analysis.

Branch: ${branch}
Recent commits on this branch:
${recentCommits || '(none — first commit)'}

Staged diff summary:
${stagedStat}

Full staged diff (truncated to 12000 chars):
${stagedDiff.slice(0, 12000)}

Return RAW JSON ONLY — no markdown, no code fences, just the JSON object:
{
  "summary": "2-3 sentences: what was changed and the likely intent behind it",
  "concerns": ["array of concerns — mixed unrelated changes, debug/temp code, large binary, TODO left in, test missing, etc. Empty array if none."],
  "message": "conventional commit: type(scope): subject (max 72 chars). Be specific.",
  "body": "optional multi-line body explaining WHY (not WHAT). Empty string if the subject is self-explanatory.",
  "alternatives": ["two alternative commit messages if the intent is ambiguous"]
}

Rules for message:
- type: feat | fix | refactor | docs | test | chore | style | perf | build | ci
- scope: the primary module/component affected (omit if changes are cross-cutting)
- subject: imperative mood, no period, lowercase after colon
- be specific — "add OAuth login" not "add feature"`;

  const raw = await getAISuggestion(prompt);

  // Strip markdown code fences if AI added them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned) as CommitAnalysis;
  } catch {
    // Fallback: extract what we can
    return {
      summary: 'Could not parse analysis.',
      concerns: [],
      message: cleaned.split('\n')[0].slice(0, 72),
      body: '',
      alternatives: [],
    };
  }
}

export function commitCommand(program: Command) {
  program
    .command('commit')
    .description('Analyze staged changes with AI and craft a commit message')
    .option('-a, --all', 'Stage all tracked changes before analysis')
    .option('--no-body', 'Omit the commit body even if one is suggested')
    .action(async (options: { all?: boolean; body?: boolean }) => {
      const start = Date.now();
      try {
        const repoState = await getRepoState();

        // Stage all if requested
        if (options.all) {
          displayStep('git add -u');
          await execAsync('git add -u');
        }

        const staged = await getStagedFiles();

        if (staged.length === 0) {
          console.log(chalk.yellow('\n  Nothing staged to commit.'));
          console.log(chalk.dim('  Use `git add <file>` or run `hermes commit --all` to stage tracked changes.\n'));
          process.exit(0);
        }

        const unstaged = await getUnstagedFiles();
        const recentCommits = await getRecentBranchCommits(5);

        // ── Display what's staged ──────────────────────────────────────────
        console.log();
        console.log(chalk.bold(`  Staged (${staged.length} file${staged.length === 1 ? '' : 's'}):`));
        for (const f of staged) {
          console.log(`    ${statusLabel(f.status)} ${chalk.white(f.path)}`);
        }

        const relevantUnstaged = unstaged.filter(
          (u) => !staged.some((s) => s.path === u.path)
        );
        if (relevantUnstaged.length > 0) {
          console.log();
          console.log(chalk.dim(`  Not staged (${relevantUnstaged.length}):`));
          for (const f of relevantUnstaged.slice(0, 8)) {
            console.log(`    ${statusLabel(f.status)} ${chalk.dim(f.path)}`);
          }
          if (relevantUnstaged.length > 8) {
            console.log(chalk.dim(`    ...and ${relevantUnstaged.length - 8} more`));
          }
        }

        // ── Fetch diffs ────────────────────────────────────────────────────
        const { name, model } = await getActiveProvider();
        console.log();
        console.log(`  Analyzing... ${chalk.dim(`[${name} / ${model}]`)}`);

        const [stagedDiff, stagedStat] = await Promise.all([
          execAsync('git diff --cached').then((r) => r.stdout),
          execAsync('git diff --cached --stat').then((r) => r.stdout),
        ]);

        const analysis = await analyzeChanges(
          repoState.currentBranch,
          stagedDiff,
          stagedStat,
          recentCommits
        );

        // ── Display analysis ───────────────────────────────────────────────
        console.log();
        divider();
        console.log();
        console.log('  ' + chalk.bold('Understanding'));
        console.log();
        // Word-wrap the summary at ~60 chars
        const words = analysis.summary.split(' ');
        let line = '  ';
        for (const w of words) {
          if (line.length + w.length > 62) {
            console.log(chalk.white(line));
            line = '  ' + w + ' ';
          } else {
            line += w + ' ';
          }
        }
        if (line.trim()) console.log(chalk.white(line));

        if (analysis.concerns.length > 0) {
          console.log();
          for (const c of analysis.concerns) {
            console.log(`  ${chalk.yellow('⚠')}  ${chalk.yellow(c)}`);
          }
        }

        console.log();
        divider();
        console.log();

        // ── Show proposed message ──────────────────────────────────────────
        const hasBody = options.body !== false && analysis.body.trim().length > 0;

        console.log('  ' + chalk.bold('Proposed commit'));
        console.log();
        console.log('  ' + chalk.cyan.bold(analysis.message));
        if (hasBody) {
          console.log();
          analysis.body.split('\n').forEach((l) => {
            console.log('  ' + chalk.dim(l));
          });
        }
        console.log();

        // ── Action menu ────────────────────────────────────────────────────
        let finalMessage = analysis.message;
        let finalBody = hasBody ? analysis.body : '';
        let committed = false;

        while (!committed) {
          const choices: { name: string; value: string }[] = [
            { name: 'Commit', value: 'commit' },
            { name: 'Edit message', value: 'edit' },
          ];

          if (analysis.alternatives?.length > 0) {
            choices.push({ name: 'See alternative messages', value: 'alts' });
          }

          if (relevantUnstaged.length > 0) {
            choices.push({ name: 'Stage more files first', value: 'stage' });
          }

          choices.push({ name: 'Cancel', value: 'cancel' });

          const { action } = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: 'What would you like to do?',
              choices,
            },
          ]);

          if (action === 'cancel') {
            console.log(chalk.dim('\n  Cancelled. Changes remain staged.\n'));
            await recordCommand('commit', [], Date.now() - start, false);
            return;
          }

          if (action === 'alts') {
            console.log();
            analysis.alternatives.forEach((alt, i) => {
              console.log(`  ${chalk.dim(`${i + 1}.`)} ${chalk.cyan(alt)}`);
            });
            console.log();

            const { pick } = await inquirer.prompt([
              {
                type: 'list',
                name: 'pick',
                message: 'Use an alternative?',
                choices: [
                  ...analysis.alternatives.map((a, i) => ({ name: a, value: `${i}` })),
                  { name: 'Keep original', value: 'keep' },
                ],
              },
            ]);

            if (pick !== 'keep') {
              finalMessage = analysis.alternatives[parseInt(pick, 10)];
              finalBody = '';
              console.log();
              console.log('  ' + chalk.cyan.bold(finalMessage));
              console.log();
            }
            continue;
          }

          if (action === 'edit') {
            const { edited } = await inquirer.prompt([
              {
                type: 'input',
                name: 'edited',
                message: 'Commit message:',
                default: finalMessage,
              },
            ]);
            finalMessage = edited.trim();
            finalBody = '';
            console.log();
            continue;
          }

          if (action === 'stage') {
            const { files } = await inquirer.prompt([
              {
                type: 'checkbox',
                name: 'files',
                message: 'Select files to stage:',
                choices: relevantUnstaged.map((f) => ({
                  name: `${statusLabel(f.status)} ${f.path}`,
                  value: f.path,
                })),
              },
            ]);

            if (files.length > 0) {
              for (const f of files) {
                const cmd = `git add ${JSON.stringify(f)}`;
                displayStep(cmd);
                await execAsync(cmd);
              }
              console.log(chalk.dim(`\n  Staged ${files.length} file(s). Re-running analysis...\n`));

              // Re-fetch diffs and re-analyse after staging more
              const [newDiff, newStat] = await Promise.all([
                execAsync('git diff --cached').then((r) => r.stdout),
                execAsync('git diff --cached --stat').then((r) => r.stdout),
              ]);

              const newAnalysis = await analyzeChanges(
                repoState.currentBranch,
                newDiff,
                newStat,
                recentCommits
              );

              analysis.summary = newAnalysis.summary;
              analysis.concerns = newAnalysis.concerns;
              analysis.message = newAnalysis.message;
              analysis.body = newAnalysis.body;
              analysis.alternatives = newAnalysis.alternatives;
              finalMessage = newAnalysis.message;
              finalBody = options.body !== false && newAnalysis.body.trim().length > 0
                ? newAnalysis.body
                : '';

              console.log('  ' + chalk.bold('Updated proposal'));
              console.log();
              console.log('  ' + chalk.cyan.bold(finalMessage));
              if (finalBody) {
                console.log();
                finalBody.split('\n').forEach((l) => console.log('  ' + chalk.dim(l)));
              }
              if (newAnalysis.concerns.length > 0) {
                console.log();
                newAnalysis.concerns.forEach((c) => {
                  console.log(`  ${chalk.yellow('⚠')}  ${chalk.yellow(c)}`);
                });
              }
              console.log();
            }
            continue;
          }

          // ── Do the commit ────────────────────────────────────────────────
          if (action === 'commit') {
            const fullMessage = finalBody
              ? `${finalMessage}\n\n${finalBody}`
              : finalMessage;

            displayStep(`git commit -m "${finalMessage}"${finalBody ? ' (with body)' : ''}`);
            await execFileAsync('git', ['commit', '-m', fullMessage]);
            displaySuccess('Committed!');

            // Show the new commit hash
            const { stdout: hash } = await execAsync('git rev-parse --short HEAD');
            console.log(chalk.dim(`  ${hash.trim()} ${finalMessage}\n`));

            await recordCommand('commit', [], Date.now() - start, true);
            committed = true;
          }
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        await recordCommand('commit', [], Date.now() - start, false);
        process.exit(1);
      }
    });
}
