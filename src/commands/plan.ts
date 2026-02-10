import { Command } from 'commander';
import { analyzeCopilotGitState } from '../lib/copilot.js';
import { getRepoState } from '../lib/git.js';
import { displayPlan } from '../lib/display.js';

export function planCommand(program: Command) {
  program
    .command('plan')
    .description('Analyze the current repository state and propose a safe Git plan')
    .argument('<intent>', 'What you want to achieve')
    .action(async (intent: string) => {
      try {
        console.log('🔍 Analyzing repository state...\n');

        // Get current repo state
        const repoState = await getRepoState();

        // Get AI analysis from Copilot CLI
        const analysis = await analyzeCopilotGitState(repoState, intent);

        // Display the plan
        displayPlan(analysis, repoState);

        console.log('\n💡 No changes have been made. Review the plan above.');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
