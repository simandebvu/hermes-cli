import { Command } from 'commander';
import { getStatsSummary, formatDuration } from '../lib/stats.js';
import chalk from 'chalk';

export function statsCommand(program: Command) {
  program
    .command('stats')
    .description('Show your Hermes efficiency statistics')
    .option('-d, --days <number>', 'Show stats for last N days', '30')
    .option('--all-time', 'Show all-time statistics')
    .action(async (options: { days?: string; allTime?: boolean }) => {
      try {
        const days = options.allTime ? 9999 : parseInt(options.days || '30', 10);

        console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════╗'));
        console.log(chalk.bold.cyan(`║  Hermes Efficiency Report - Last ${days} Days${' '.repeat(Math.max(0, 13 - days.toString().length))}║`));
        console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════╝\n'));

        const summary = await getStatsSummary(days);

        // Time saved
        const timeSavedHours = summary.timeSavedSeconds / 3600;
        const allTimeHours = summary.allTimeTimeSavedSeconds / 3600;

        console.log(chalk.bold('⏱️  Time Saved'));
        console.log(`   ${chalk.green(formatDuration(summary.timeSavedSeconds))} (${timeSavedHours.toFixed(1)} hours)`);
        if (!options.allTime) {
          console.log(chalk.dim(`   All-time: ${formatDuration(summary.allTimeTimeSavedSeconds)} (${allTimeHours.toFixed(1)} hours)`));
        }
        console.log();

        // Commands
        const reduction = summary.gitCommandsRun > 0
          ? Math.round((1 - summary.totalCommands / summary.gitCommandsRun) * 100)
          : 0;

        console.log(chalk.bold('🚀  Commands'));
        console.log(`   Hermes: ${chalk.cyan(summary.totalCommands)} commands`);
        console.log(`   Git equivalents: ${chalk.dim(summary.gitCommandsRun)} commands`);
        if (reduction > 0) {
          console.log(`   ${chalk.green(`${reduction}% reduction`)}`);
        }
        console.log();

        // Success rate
        const successPercent = Math.round(summary.successRate * 100);
        const successColor = successPercent >= 95 ? chalk.green : successPercent >= 80 ? chalk.yellow : chalk.red;

        console.log(chalk.bold('🎯  Success Rate'));
        console.log(`   ${successColor(`${successPercent}%`)} of commands completed successfully`);
        console.log();

        // Top commands
        if (summary.topCommands.length > 0) {
          console.log(chalk.bold('📊  Most Used Commands'));
          summary.topCommands.forEach(({ command, count }, index) => {
            const bar = '█'.repeat(Math.ceil((count / summary.topCommands[0].count) * 20));
            console.log(`   ${index + 1}. ${chalk.cyan(command.padEnd(12))} ${chalk.dim(bar)} ${count}x`);
          });
          console.log();
        }

        // Productivity metrics
        console.log(chalk.bold('📈  Productivity'));
        console.log(`   Active days: ${chalk.cyan(summary.daysActive)}`);
        console.log(`   Avg commands/day: ${chalk.cyan(summary.commandsPerDay.toFixed(1))}`);
        console.log();

        // Efficiency comparison
        if (timeSavedHours > 0) {
          const weeklySavings = (timeSavedHours / days) * 7;
          const monthlySavings = (timeSavedHours / days) * 30;

          console.log(chalk.bold('💡  Efficiency Insights'));
          console.log(`   Weekly time saved: ${chalk.green(`~${weeklySavings.toFixed(1)}h`)}`);
          console.log(`   Monthly time saved: ${chalk.green(`~${monthlySavings.toFixed(1)}h`)}`);

          const efficiency = Math.min(50, Math.round((timeSavedHours / (days / 30)) * 10));
          console.log(`   Efficiency gain: ${chalk.green(`+${efficiency}%`)} compared to raw Git`);
          console.log();
        }

        // Streak
        if (summary.daysActive >= 7) {
          console.log(chalk.bold('🏆  Productivity Streak'));
          console.log(`   ${chalk.yellow(`${summary.daysActive} days`)} using Hermes`);
          console.log();
        }

        // Tips
        console.log(chalk.dim('💭  Tip: Use `hermes init` to customize workflows and save even more time'));
        console.log();
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
