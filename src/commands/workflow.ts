import { Command } from 'commander';
import { executeGitCommand, getRepoState } from '../lib/git.js';
import { loadConfig } from '../lib/config.js';
import { displaySuccess, displayStep } from '../lib/display.js';
import { getAISuggestion } from '../lib/ai.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export function workflowCommand(program: Command) {
  const workflow = program
    .command('workflow')
    .description('Run predefined workflow shortcuts');

  workflow
    .command('pr-ready')
    .description('Prepare branch for pull request')
    .action(async () => {
      try {
        console.log('📦 Preparing branch for PR...\n');

        const steps = [
          { cmd: 'git fetch origin', desc: 'Fetching latest changes' },
          { cmd: 'git rebase origin/main', desc: 'Rebasing on main' },
          { cmd: 'git push --force-with-lease', desc: 'Pushing changes safely' },
        ];

        for (const { cmd, desc } of steps) {
          console.log(`\n${desc}...`);
          displayStep(cmd);
          await executeGitCommand(cmd);
        }

        displaySuccess('Branch ready for PR!');
        console.log('\n💡 Next: Create PR with `gh pr create` or use your Git hosting UI');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  workflow
    .command('daily-sync')
    .description('Daily workflow: fetch, show status, suggest actions')
    .action(async () => {
      try {
        console.log('🌅 Running daily sync...\n');

        displayStep('git fetch --all --prune');
        await executeGitCommand('git fetch --all --prune');

        const repoState = await getRepoState();

        console.log('\n📊 Status:');
        console.log(`  Current branch: ${repoState.currentBranch}`);
        console.log(`  Status: ${repoState.isClean ? '✅ Clean' : '⚠️  Uncommitted changes'}`);

        if (repoState.behind > 0) {
          console.log(`  Behind main: ${repoState.behind} commits`);
          console.log('\n💡 Suggestion: Run `hermes sync` to catch up');
        } else {
          console.log('  ✅ Up to date with remote');
        }

        displaySuccess('Daily sync complete!');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  workflow
    .command('quick-commit')
    .description('Stage changed files and commit with an AI-generated message')
    .option('-a, --all', 'Stage all changes (default: only already-staged files)')
    .action(async (options: { all?: boolean }) => {
      try {
        console.log('⚡ Quick commit...\n');

        const repoState = await getRepoState();

        if (repoState.isClean) {
          console.log('✅ Nothing to commit');
          return;
        }

        if (options.all) {
          displayStep('git add -A');
          await executeGitCommand('git add -A');
        }

        const diff = await executeGitCommand('git diff --cached --stat');
        const diffFull = await executeGitCommand('git diff --cached');

        if (!diff.trim()) {
          console.log('⚠️  No staged changes. Use --all to stage everything, or `git add` specific files first.');
          return;
        }

        console.log('\n📝 Staged changes:');
        console.log(diff);

        console.log('\n🤖 Generating commit message...');

        const message = await getAISuggestion(`Generate a concise git commit message for these changes.

Rules:
- Use conventional commits format: type(scope): description
- First line max 72 characters
- type is one of: feat, fix, refactor, docs, test, chore, style, perf
- Be specific about what changed, not how
- Return ONLY the commit message, no explanation, no quotes, no backticks

Diff:
${diffFull.slice(0, 8000)}`);

        console.log(`\n💬 Proposed message:\n   ${chalk.cyan(message)}\n`);

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Commit with this message?',
            choices: [
              { name: 'Yes, commit', value: 'commit' },
              { name: 'Edit message', value: 'edit' },
              { name: 'Cancel', value: 'cancel' },
            ],
          },
        ]);

        if (action === 'cancel') {
          console.log('Cancelled. Changes remain staged.');
          return;
        }

        let finalMessage = message;

        if (action === 'edit') {
          const { edited } = await inquirer.prompt([
            {
              type: 'input',
              name: 'edited',
              message: 'Commit message:',
              default: message,
            },
          ]);
          finalMessage = edited;
        }

        displayStep(`git commit -m "${finalMessage}"`);
        await executeGitCommand(`git commit -m ${JSON.stringify(finalMessage)}`);
        displaySuccess('Committed!');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  workflow
    .command('list')
    .description('List available workflow shortcuts')
    .action(async () => {
      const config = await loadConfig();

      console.log('🔄 Available Workflows:\n');

      console.log('Built-in:');
      console.log('  • pr-ready      - Sync, rebase, and push for PR');
      console.log('  • daily-sync    - Fetch updates and show status');
      console.log('  • quick-commit  - Stage and commit all changes');

      if (config?.workflows) {
        console.log('\nProject-specific:');
        Object.keys(config.workflows).forEach((name) => {
          const steps = config.workflows[name];
          console.log(`  • ${name.padEnd(15)} - ${steps.join(' → ')}`);
        });
      } else {
        console.log('\n💡 Run `hermes init` to define custom workflows');
      }
    });
}
