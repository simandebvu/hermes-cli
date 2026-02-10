import { Command } from 'commander';
import { executeGitCommand, getRepoState } from '../lib/git.js';
import { loadConfig } from '../lib/config.js';
import { displaySuccess, displayStep } from '../lib/display.js';

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
    .description('Quick commit all changes with AI-generated message')
    .action(async () => {
      try {
        console.log('⚡ Quick commit...\n');

        const repoState = await getRepoState();

        if (repoState.isClean) {
          console.log('✅ Nothing to commit');
          return;
        }

        // Stage all changes
        displayStep('git add -A');
        await executeGitCommand('git add -A');

        // Get diff for commit message
        const diff = await executeGitCommand('git diff --cached --stat');

        console.log('\n📝 Staged changes:');
        console.log(diff);

        // TODO: Use Copilot to generate commit message from diff
        console.log('\n💡 Tip: Use `git commit` with a descriptive message');
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
