import chalk from 'chalk';

/**
 * Display a plan from the AI
 */
export function displayPlan(suggestion: string, repoState: any): void {
  console.log(chalk.bold.cyan('📋 Recommended Plan:\n'));
  console.log(suggestion);
  console.log();

  // Display repo state summary
  console.log(chalk.bold('📊 Current State:'));
  console.log(`  Branch: ${chalk.green(repoState.currentBranch)}`);
  console.log(`  Status: ${repoState.isClean ? chalk.green('Clean') : chalk.yellow('Uncommitted changes')}`);

  if (repoState.remoteTracking) {
    console.log(`  Remote: ${chalk.blue(repoState.remoteTracking)}`);
    if (repoState.ahead > 0) {
      console.log(`  ${chalk.green(`↑ ${repoState.ahead} ahead`)}`);
    }
    if (repoState.behind > 0) {
      console.log(`  ${chalk.yellow(`↓ ${repoState.behind} behind`)}`);
    }
  }

  if (repoState.isInRebase) {
    console.log(chalk.red('  ⚠️  In rebase'));
  }
  if (repoState.isInMerge) {
    console.log(chalk.red('  ⚠️  In merge'));
  }
}

/**
 * Display a Git command being executed
 */
export function displayStep(command: string): void {
  console.log(chalk.dim('  $ ') + chalk.gray(command));
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
  console.log();
  console.log(chalk.green('✅ ' + message));
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
  console.log(chalk.yellow('⚠️  ' + message));
}

/**
 * Display conflict explanation
 */
export function displayConflictExplanation(explanation: string, files: string[]): void {
  console.log(chalk.bold.red('⚔️  Conflicts detected:\n'));

  files.forEach((file) => {
    console.log(chalk.yellow(`  • ${file}`));
  });

  console.log();
  console.log(chalk.bold('🔍 Analysis:\n'));
  console.log(explanation);
}
