import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFile, readFile, chmod, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scanStagedFiles, getStagedFiles, type ScanResult, type FileFindings } from '../lib/secrets.js';
import { getAISuggestion } from '../lib/ai.js';

const execAsync = promisify(exec);

export function guardCommand(program: Command) {
  const guard = program
    .command('guard')
    .description('Scan staged files for secrets and sensitive content before committing');

  // ── hermes guard (default: scan) ──────────────────────────────────────────
  guard
    .option('--hook', 'Run in non-interactive hook mode (exit 1 on blockers)')
    .action(async (options: { hook?: boolean }) => {
      await runScan(options.hook ?? false);
    });

  // ── hermes guard install-hook ─────────────────────────────────────────────
  guard
    .command('install-hook')
    .description('Install hermes guard as a git pre-commit hook')
    .action(async () => {
      try {
        const gitDir = await execAsync('git rev-parse --git-dir')
          .then((r) => r.stdout.trim())
          .catch(() => null);

        if (!gitDir) {
          console.error(chalk.red('❌ Not a git repository'));
          process.exit(1);
        }

        const hooksDir = `${gitDir}/hooks`;
        await mkdir(hooksDir, { recursive: true });

        const hookPath = `${hooksDir}/pre-commit`;
        const hookScript = [
          '#!/bin/sh',
          '# Installed by hermes guard install-hook',
          'hermes guard --hook',
        ].join('\n') + '\n';

        if (existsSync(hookPath)) {
          const existing = await readFile(hookPath, 'utf-8');
          if (existing.includes('hermes guard')) {
            console.log(chalk.dim('Hook already installed.'));
            return;
          }
          // Append to existing hook rather than overwrite
          await writeFile(hookPath, existing.trimEnd() + '\n\n' + hookScript.split('\n').slice(1).join('\n'));
        } else {
          await writeFile(hookPath, hookScript);
        }

        await chmod(hookPath, 0o755);
        console.log(`${chalk.green('✓')} Pre-commit hook installed at ${chalk.dim(hookPath)}`);
        console.log(chalk.dim('  hermes guard will run automatically before every commit.'));
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // ── hermes guard uninstall-hook ───────────────────────────────────────────
  guard
    .command('uninstall-hook')
    .description('Remove hermes guard from the git pre-commit hook')
    .action(async () => {
      try {
        const gitDir = await execAsync('git rev-parse --git-dir')
          .then((r) => r.stdout.trim())
          .catch(() => null);

        if (!gitDir) {
          console.error(chalk.red('❌ Not a git repository'));
          process.exit(1);
        }

        const hookPath = `${gitDir}/hooks/pre-commit`;

        if (!existsSync(hookPath)) {
          console.log(chalk.dim('No pre-commit hook found.'));
          return;
        }

        const content = await readFile(hookPath, 'utf-8');
        if (!content.includes('hermes guard')) {
          console.log(chalk.dim('hermes guard is not in the pre-commit hook.'));
          return;
        }

        const cleaned = content
          .split('\n')
          .filter((line) => !line.includes('hermes guard') && line !== '# Installed by hermes guard install-hook')
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim() + '\n';

        if (cleaned === '#!/bin/sh\n') {
          // Nothing left — remove the file
          const { unlink } = await import('fs/promises');
          await unlink(hookPath);
          console.log(`${chalk.green('✓')} Pre-commit hook removed.`);
        } else {
          await writeFile(hookPath, cleaned);
          console.log(`${chalk.green('✓')} hermes guard removed from pre-commit hook.`);
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

// ─── Core scan logic ──────────────────────────────────────────────────────────

async function runScan(hookMode: boolean): Promise<void> {
  try {
    const staged = await getStagedFiles();

    if (staged.length === 0) {
      if (!hookMode) console.log(chalk.dim('No staged files to scan.'));
      return;
    }

    if (!hookMode) {
      console.log(chalk.bold(`\n  Scanning ${staged.length} staged file${staged.length === 1 ? '' : 's'}...\n`));
    }

    const result = await scanStagedFiles();
    const hasBlockers = result.blocked.length > 0;
    const hasWarnings = result.warned.length > 0;

    if (!hasBlockers && !hasWarnings) {
      if (!hookMode) {
        console.log(chalk.green('  ✓ All clear') + chalk.dim(` — ${staged.length} file${staged.length === 1 ? '' : 's'} scanned, nothing suspicious found.\n`));
      }
      return;
    }

    // ── Display findings ────────────────────────────────────────────────────

    if (!hookMode) {
      printReport(result);
    } else {
      // In hook mode, print a compact summary to stderr
      if (hasBlockers) {
        process.stderr.write(chalk.red(`\n  hermes guard: ${result.blocked.length} blocked file${result.blocked.length === 1 ? '' : 's'} with secrets detected.\n`));
        for (const f of result.blocked) {
          process.stderr.write(chalk.dim(`    ${f.file}: ${f.findings.map((x) => x.description).join(', ')}\n`));
        }
        process.stderr.write(chalk.dim('\n  Run `hermes guard` for details and remediation advice.\n\n'));
      }
    }

    // ── AI explanation (interactive mode only) ──────────────────────────────

    if (!hookMode && (hasBlockers || hasWarnings)) {
      await printAIExplanation(result);

      // ── Decision ──────────────────────────────────────────────────────────

      if (hasBlockers) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: chalk.red('Blocked secrets found. What do you want to do?'),
            choices: [
              { name: 'Abort — I will fix these before committing', value: 'abort' },
              { name: 'Unstage the flagged files and continue', value: 'unstage' },
              { name: 'Proceed anyway (I know what I\'m doing)', value: 'proceed' },
            ],
            default: 'abort',
          },
        ]);

        if (action === 'abort') {
          console.log(chalk.dim('\n  Commit aborted. Fix the issues above, then try again.\n'));
          process.exit(1);
        }

        if (action === 'unstage') {
          for (const f of result.blocked) {
            await execAsync(`git restore --staged "${f.file}"`);
            console.log(chalk.dim(`  Unstaged: ${f.file}`));
          }
          console.log(chalk.yellow('\n  Flagged files have been unstaged. Commit the rest? (run git commit again)'));
          process.exit(0);
        }

        // proceed — fall through
        console.log(chalk.dim('\n  Proceeding. Be careful.\n'));
      } else if (hasWarnings) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: chalk.yellow('Warnings found. Proceed with commit?'),
            default: true,
          },
        ]);

        if (!proceed) {
          console.log(chalk.dim('\n  Commit aborted.\n'));
          process.exit(1);
        }
      }
    }

    // Hook mode: exit 1 on blockers
    if (hookMode && hasBlockers) {
      process.exit(1);
    }
  } catch (error) {
    // Don't block commits due to scanner errors
    if (!hookMode) {
      console.error(chalk.dim('  guard scan failed:'), error instanceof Error ? error.message : error);
    }
    process.exit(0);
  }
}

// ─── Display ──────────────────────────────────────────────────────────────────

function printReport(result: ScanResult): void {
  const totalFiles = result.blocked.length + result.warned.length + result.clean.length + result.skipped.length;

  // Header
  if (result.blocked.length > 0) {
    console.log(chalk.red.bold('  ✖ Secrets detected') + chalk.dim(` — review before committing\n`));
  } else {
    console.log(chalk.yellow.bold('  ⚠ Warnings') + chalk.dim(` — review before committing\n`));
  }

  // Blocked files
  for (const ff of result.blocked) {
    console.log(chalk.red(`  BLOCKED  `) + chalk.bold(ff.file));
    for (const f of ff.findings) {
      const lineRef = f.line > 0 ? chalk.dim(` line ${f.line}`) : '';
      console.log(chalk.dim('           ') + chalk.red('●') + ' ' + f.description + lineRef);
      if (f.preview && f.line > 0) {
        console.log(chalk.dim('             ' + f.preview.trim()));
      }
      if (f.rotation) {
        console.log(chalk.dim(`             Rotate at: ${f.rotation}`));
      }
    }
    console.log();
  }

  // Warned files
  for (const ff of result.warned) {
    console.log(chalk.yellow(`  WARN     `) + chalk.bold(ff.file));
    for (const f of ff.findings) {
      const lineRef = f.line > 0 ? chalk.dim(` line ${f.line}`) : '';
      console.log(chalk.dim('           ') + chalk.yellow('●') + ' ' + f.description + lineRef);
      if (f.preview && f.line > 0) {
        console.log(chalk.dim('             ' + f.preview.trim()));
      }
    }
    console.log();
  }

  // Clean summary
  if (result.clean.length > 0) {
    console.log(chalk.dim(`  ✓ ${result.clean.length} file${result.clean.length === 1 ? '' : 's'} clean`));
  }
  if (result.skipped.length > 0) {
    console.log(chalk.dim(`  − ${result.skipped.length} binary/unreadable file${result.skipped.length === 1 ? '' : 's'} skipped`));
  }
  console.log();
}

async function printAIExplanation(result: ScanResult): Promise<void> {
  const allFindings = [...result.blocked, ...result.warned];
  if (allFindings.length === 0) return;

  // Build a compact summary to send to the AI
  const findingSummary = allFindings.map((ff) => {
    const items = ff.findings.map((f) => `  - ${f.description}${f.line > 0 ? ` (line ${f.line})` : ''}`).join('\n');
    return `File: ${ff.file}\nSeverity: ${ff.maxSeverity}\n${items}`;
  }).join('\n\n');

  process.stdout.write(chalk.dim('  Asking AI for context...\r'));

  try {
    const explanation = await getAISuggestion(`A developer is about to commit these files that were flagged by a secret scanner:

${findingSummary}

For each finding, briefly explain:
1. The specific risk if this gets committed (e.g., "Anyone with repo access can use this key to...")
2. One concrete remediation step (e.g., "Add .env to .gitignore and use process.env instead")

Be direct and specific. 3-4 sentences per finding max. No preamble.`);

    // Clear the "Asking AI..." line
    process.stdout.write('                                    \r');
    console.log(chalk.bold('  What this means:\n'));
    const indented = explanation.split('\n').map((l) => '  ' + l).join('\n');
    console.log(indented);
    console.log();
  } catch {
    // AI unavailable — static scan findings are still shown, don't block
    process.stdout.write('                                    \r');
  }
}
