import { Command } from 'commander';
import { analyzeGitState, getActiveProvider } from '../lib/ai.js';
import { getRepoState } from '../lib/git.js';
import { displayPlan } from '../lib/display.js';
import chalk from 'chalk';

export function planCommand(program: Command) {
  program
    .command('plan')
    .description('Analyze the current repository state and propose a safe Git plan')
    .argument('<intent>', 'What you want to achieve')
    .action(async (intent: string) => {
      try {
        const { name, model } = await getActiveProvider();
        console.log(`🔍 Analyzing repository state... ${chalk.dim(`[${name} / ${model}]`)}\n`);

        const repoState = await getRepoState();
        const analysis = await analyzeGitState(repoState, intent);

        // Display the plan
        displayPlan(analysis, repoState);

        console.log(chalk.dim('\n💡 No changes have been made. Review the plan above.'));
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
