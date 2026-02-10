import { Command } from 'commander';
import { getCopilotGitPlan } from '../lib/copilot.js';
import { getRepoState, executeGitCommand } from '../lib/git.js';
import { displaySuccess, displayStep } from '../lib/display.js';

export function wipCommand(program: Command) {
  program
    .command('wip')
    .description('Save work safely when things get messy')
    .option('-m, --message <message>', 'Custom WIP message')
    .action(async (options: { message?: string }) => {
      try {
        console.log('💾 Saving work in progress...\n');

        const repoState = await getRepoState();

        const messageNote = options.message ? ` with message: "${options.message}"` : '';

        // Get Git plan from Copilot
        const planResponse = await getCopilotGitPlan(
          repoState,
          `Save work in progress${messageNote}. Decide whether to commit or stash. Return JSON with: approach, commands[], explanation.`
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

        if (plan.explanation) {
          console.log(`💭 ${plan.explanation}\n`);
        }

        // Execute commands
        if (plan.commands && Array.isArray(plan.commands)) {
          for (const command of plan.commands) {
            // Ensure command is a string
            const cmdString = typeof command === 'string' ? command : String(command);
            displayStep(cmdString);
            await executeGitCommand(cmdString);
          }

          const approach = plan.approach || 'selected method';
          displaySuccess(`Work saved using ${approach}`);
        } else {
          console.log('⚠️  No commands to execute.');
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
