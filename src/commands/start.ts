import { Command } from 'commander';
import { getCopilotGitPlan } from '../lib/copilot.js';
import { getRepoState, executeGitCommand } from '../lib/git.js';
import { displaySuccess, displayStep } from '../lib/display.js';
import { loadConfig, generateBranchName } from '../lib/config.js';
import { recordCommand } from '../lib/stats.js';

export function startCommand(program: Command) {
  program
    .command('start')
    .description('Start a new piece of work safely')
    .argument('<task>', 'Description of the task')
    .action(async (task: string) => {
      const startTime = Date.now();
      let gitCommandsRun = 0;

      try {
        console.log('🚀 Starting new task...\n');

        const config = await loadConfig();
        const repoState = await getRepoState();

        // Use config-based branch naming if available
        let suggestedBranchName: string | undefined;
        if (config) {
          suggestedBranchName = generateBranchName(
            config.branches.featurePattern,
            task
          );
          console.log(`💡 Suggested branch: ${suggestedBranchName}\n`);
        }

        // Get Git plan from Copilot
        const planResponse = await getCopilotGitPlan(
          repoState,
          `Start working on: ${task}. ${
            suggestedBranchName
              ? `Suggested branch name: ${suggestedBranchName}.`
              : ''
          } Provide base branch, conventional branch name, and Git commands to create and switch to the branch.`
        );

        let plan;
        try {
          plan = JSON.parse(planResponse);
        } catch {
          // If JSON parsing fails, extract info from text response
          console.log('💭 Copilot suggests:\n');
          console.log(planResponse);
          console.log('\n⚠️  Could not auto-execute. Please review the plan above.');
          return;
        }

        // Display the plan
        if (plan.baseBranch && plan.branchName) {
          console.log(`📍 Base branch: ${plan.baseBranch}`);
          console.log(`🌿 New branch: ${plan.branchName}\n`);
        }

        if (plan.explanation) {
          console.log(`💭 ${plan.explanation}\n`);
        }

        // Execute commands
        if (plan.commands && Array.isArray(plan.commands)) {
          for (const command of plan.commands) {
            // Handle both string commands and object commands
            let cmdString: string;
            if (typeof command === 'string') {
              cmdString = command;
            } else if (typeof command === 'object' && command.command) {
              cmdString = command.command;
            } else if (typeof command === 'object' && command.cmd) {
              cmdString = command.cmd;
            } else {
              console.warn('⚠️  Skipping invalid command:', command);
              continue;
            }

            displayStep(cmdString);
            await executeGitCommand(cmdString);
            gitCommandsRun++;
          }

          const branchName = plan.branchName || 'new branch';
          displaySuccess(`Successfully created and switched to ${branchName}`);

          // Show learning mode tip
          if (config?.preferences.learningMode) {
            console.log('\n💡 Learning tip: Branch created from clean state ensures no unexpected commits');
          }
        } else {
          console.log('⚠️  No commands to execute. See analysis above.');
        }

        // Record stats
        const duration = (Date.now() - startTime) / 1000;
        await recordCommand('start', [task], duration, true, gitCommandsRun);
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        await recordCommand('start', [task], duration, false, gitCommandsRun);

        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
