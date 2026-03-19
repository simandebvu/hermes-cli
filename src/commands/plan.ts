import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeGitState, getActiveProvider, getAllAvailableProviders } from '../lib/ai.js';
import { getRepoState } from '../lib/git.js';
import { displayPlan } from '../lib/display.js';
import { runCouncilSession } from '../lib/council.js';

export function planCommand(program: Command) {
  program
    .command('plan')
    .description('Analyze the current repository state and propose a safe Git plan')
    .argument('<intent>', 'What you want to achieve')
    .option('--council', 'Force council mode (all available providers)')
    .option('--no-council', 'Skip council mode, use single provider only')
    .action(async (intent: string, options: { council?: boolean }) => {
      try {
        const repoState = await getRepoState();
        const providers = await getAllAvailableProviders();

        // Decide whether to use council
        const useCouncil = options.council === true
          ? true
          : options.council === false
            ? false
            : providers.length >= 2; // auto: council when 2+ available

        if (useCouncil && providers.length >= 2) {
          const providerList = providers.map(p => chalk.dim(`[${p.name}]`)).join(' ');
          console.log(`\n  ${providerList}\n`);

          const prompt = buildPlanPrompt(intent, repoState);
          const result = await runCouncilSession(prompt, { label: intent });

          if (result) {
            displayPlan(result, repoState);
            console.log(chalk.dim('\n  No changes made. Review the plan above.\n'));
          } else {
            console.log(chalk.dim('\n  Exited without selecting a plan.\n'));
          }
        } else {
          // Single provider fallback
          const { name, model } = await getActiveProvider();
          console.log(`\n  Analyzing...  ${chalk.dim(`[${name} / ${model}]`)}\n`);

          const analysis = await analyzeGitState(repoState, intent);
          displayPlan(analysis, repoState);
          console.log(chalk.dim('\n  No changes made. Review the plan above.\n'));

          if (providers.length >= 2) {
            console.log(chalk.dim('  Tip: run with --council to get perspectives from all providers.\n'));
          }
        }
      } catch (error) {
        console.error(chalk.red('\n  ✖ ' + (error instanceof Error ? error.message : error)));
        process.exit(1);
      }
    });
}

function buildPlanPrompt(intent: string, repoState: any): string {
  return `You are a Git expert. A developer wants to: "${intent}"

Current repository state:
- Branch: ${repoState.currentBranch}
- Clean: ${repoState.isClean}
- Uncommitted changes: ${repoState.hasUncommittedChanges}
- Untracked files: ${repoState.hasUntrackedFiles}
- Ahead: ${repoState.ahead} commits, Behind: ${repoState.behind} commits
- In rebase: ${repoState.isInRebase}, In merge: ${repoState.isInMerge}
- Remote tracking: ${repoState.remoteTracking ?? 'none'}

Provide a clear, safe Git plan with:
1. Recommended approach and reasoning
2. Step-by-step git commands (must start with "git ")
3. Any risks or things to watch out for

Be specific and concise.`;
}
