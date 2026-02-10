import { Command } from 'commander';
import { getCopilotGitPlan } from '../lib/copilot.js';
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

        // Get Git plan from Copilot
        const planResponse = await getCopilotGitPlan(
          repoState,
          `Sync branch${fromNote}. Evaluate if rebase or merge is safer. Check if branch is shared. Return JSON with: approach, isRisky, riskExplanation, commands[], explanation.`
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
            const cmdString = typeof command === 'string' ? command : String(command);
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
