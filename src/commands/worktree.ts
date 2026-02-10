import { Command } from 'commander';
import { getCopilotGitPlan } from '../lib/copilot.js';
import { getRepoState, executeGitCommand } from '../lib/git.js';
import { displaySuccess, displayStep } from '../lib/display.js';

export function worktreeCommand(program: Command) {
  const worktree = program
    .command('worktree')
    .description('Manage Git worktrees safely');

  worktree
    .command('new')
    .description('Create a new worktree for a task')
    .argument('<task>', 'Description of the task')
    .action(async (task: string) => {
      try {
        console.log('🌳 Creating worktree...\n');

        const repoState = await getRepoState();

        // Get Git plan from Copilot
        const planResponse = await getCopilotGitPlan(
          repoState,
          `Create a worktree for: ${task}. Provide safe branch name, worktree path (e.g., ../repo-branchname), and git worktree commands. Return JSON with: branchName, worktreePath, commands[], explanation.`
        );

        let plan;
        try {
          plan = JSON.parse(planResponse);
        } catch {
          console.log('💭 Copilot suggests:\n');
          console.log(planResponse);
          console.log('\n⚠️  Could not auto-execute. Please review the plan above.');
          return;
        }

        if (plan.branchName && plan.worktreePath) {
          console.log(`🌿 Branch: ${plan.branchName}`);
          console.log(`📁 Path: ${plan.worktreePath}\n`);
        }

        if (plan.explanation) {
          console.log(`💭 ${plan.explanation}\n`);
        }

        // Execute commands
        if (plan.commands && Array.isArray(plan.commands)) {
          for (const command of plan.commands) {
            const cmdString = typeof command === 'string' ? command : String(command);
            displayStep(cmdString);
            await executeGitCommand(cmdString);
          }

          const path = plan.worktreePath || 'new worktree';
          displaySuccess(`Worktree created at ${path}`);
        } else {
          console.log('⚠️  No commands to execute.');
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
