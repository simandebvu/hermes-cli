import { Command } from 'commander';
import { getGitPlan, validateGitCommand } from '../lib/ai.js';
import { getRepoState, executeGitCommand } from '../lib/git.js';
import { displaySuccess, displayStep, displayWarning } from '../lib/display.js';

export function syncCommand(program: Command) {
  program
    .command('sync')
    .description('Bring your branch up to date safely')
    .option('--from <branch>', 'Source branch to sync from (default: main)')
    .action(async (options: { from?: string }) => {
      try {
        console.log('🔄 Syncing branch...\n');

        const repoState = await getRepoState();

        const fromNote = options.from ? ` from ${options.from}` : ' from main';

        const planResponse = await getGitPlan(
          repoState,
          `Sync branch${fromNote}. Evaluate if rebase or merge is safer. Check if branch is shared. Return JSON with: approach, isRisky, riskExplanation, commands[], explanation.`
        );

        let plan;
        try {
          plan = JSON.parse(planResponse);
        } catch {
          console.log('💭 Hermes suggests:\n');
          console.log(planResponse);
          console.log('\n⚠️  Could not auto-execute. Please review the plan above.');
          return;
        }

        if (plan.isRisky && plan.riskExplanation) {
          displayWarning(plan.riskExplanation);
          console.log();
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

            validateGitCommand(cmdString);
            displayStep(cmdString);
            await executeGitCommand(cmdString);
          }

          const approach = plan.approach || 'selected method';
          displaySuccess(`Branch synced using ${approach}`);
        } else {
          console.log('⚠️  No commands to execute.');
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
