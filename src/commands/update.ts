import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PACKAGE_NAME = 'hermes-git';

export function updateCommand(program: Command, currentVersion: string) {
  program
    .command('update')
    .description('Update hermes to the latest version')
    .option('--check', 'Check for updates without installing')
    .option('--bun', 'Use bun instead of npm to install')
    .action(async (options: { check?: boolean; bun?: boolean }) => {
      try {
        process.stdout.write(chalk.dim('  Checking npm for latest version...'));

        const latest = await fetchLatestVersion();

        // Clear the "checking" line
        process.stdout.write('\r' + ' '.repeat(50) + '\r');

        if (!latest) {
          console.error(chalk.red('  ✖ Could not reach npm registry. Check your connection.'));
          process.exit(1);
        }

        const isNewer = compareVersions(latest, currentVersion) > 0;
        const isAhead = compareVersions(currentVersion, latest) > 0;

        if (!isNewer) {
          if (isAhead) {
            console.log(
              chalk.green('  ✓ ') +
              `You're running ${chalk.cyan(`v${currentVersion}`)} ` +
              chalk.dim(`(latest on npm is ${latest})`)
            );
          } else {
            console.log(
              chalk.green(`  ✓ Already on the latest version`) +
              chalk.dim(` (v${currentVersion})`)
            );
          }
          return;
        }

        // Update available
        console.log(
          `  Update available  ${chalk.dim(currentVersion)} ${chalk.dim('→')} ${chalk.green.bold(latest)}\n`
        );

        if (options.check) return;

        // Detect package manager
        const pm = options.bun ? 'bun' : await detectPackageManager();
        const installCmd = buildInstallCommand(pm);

        console.log(`  Running: ${chalk.cyan(installCmd)}\n`);

        const { stdout, stderr } = await execAsync(installCmd, { timeout: 120_000 });

        const output = (stdout + stderr).trim();
        if (output) {
          output.split('\n').forEach((line) => {
            console.log(chalk.dim('  ' + line));
          });
          console.log();
        }

        console.log(
          chalk.green('  ✓ Updated to ') + chalk.bold(`v${latest}`) +
          chalk.dim('  Restart your terminal if the version does not change.')
        );
      } catch (error: any) {
        console.error(chalk.red('\n  ✖ Update failed'));
        console.error(chalk.dim('  ' + (error.message || error)));
        console.log(chalk.dim(`\n  Try manually: npm install -g ${PACKAGE_NAME}@latest`));
        process.exit(1);
      }
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.version ?? null;
  } catch {
    return null;
  }
}

/** Returns positive if a > b, negative if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function detectPackageManager(): Promise<'npm' | 'bun' | 'pnpm'> {
  // Check if hermes was installed by bun (bun global bin is in ~/.bun/bin)
  if (process.execPath?.includes('bun') || process.argv[0]?.includes('bun')) {
    return 'bun';
  }

  // Check if bun is available globally
  try {
    const { stdout } = await execAsync('bun --version', { timeout: 3000 });
    if (stdout.trim()) {
      // Check if this package is managed by bun
      try {
        const { stdout: list } = await execAsync('bun pm ls -g 2>/dev/null', { timeout: 3000 });
        if (list.includes(PACKAGE_NAME)) return 'bun';
      } catch { /* not bun */ }
    }
  } catch { /* bun not found */ }

  // Check pnpm
  try {
    const { stdout } = await execAsync('pnpm --version', { timeout: 3000 });
    if (stdout.trim()) {
      try {
        const { stdout: list } = await execAsync('pnpm list -g --depth=0 2>/dev/null', { timeout: 3000 });
        if (list.includes(PACKAGE_NAME)) return 'pnpm';
      } catch { /* not pnpm */ }
    }
  } catch { /* pnpm not found */ }

  return 'npm';
}

function buildInstallCommand(pm: 'npm' | 'bun' | 'pnpm'): string {
  switch (pm) {
    case 'bun':  return `bun add -g ${PACKAGE_NAME}@latest`;
    case 'pnpm': return `pnpm add -g ${PACKAGE_NAME}@latest`;
    default:     return `npm install -g ${PACKAGE_NAME}@latest`;
  }
}
