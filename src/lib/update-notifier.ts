import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

const PACKAGE_NAME = 'hermes-git';
const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_DIR = path.join(homedir(), '.hermes', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'update-check.json');

interface UpdateCache {
  lastChecked: number;
  latestVersion?: string;
  minimumVersion?: string;
}

// ─── npm registry ─────────────────────────────────────────────────────────────

async function fetchDistTags(): Promise<{ latest?: string; minimum?: string }> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/-/package/${PACKAGE_NAME}/dist-tags`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return {};
    return (await res.json()) as any;
  } catch {
    return {};
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────

async function readCache(): Promise<UpdateCache | null> {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    return JSON.parse(await readFile(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}
}

// ─── Version comparison ───────────────────────────────────────────────────────

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Blocking check: if current version is below the published `minimum` dist-tag,
 * print an error and exit. Called before commands run.
 */
export async function enforceMinimumVersion(currentVersion: string): Promise<void> {
  try {
    const cache = await readCache();
    const now = Date.now();
    const stale = !cache || (now - cache.lastChecked) > CHECK_INTERVAL;

    let minimumVersion = cache?.minimumVersion ?? null;
    let latestVersion = cache?.latestVersion ?? null;

    if (stale) {
      const tags = await fetchDistTags();
      latestVersion = tags.latest ?? latestVersion;
      minimumVersion = tags.minimum ?? null;
      await writeCache({ lastChecked: now, latestVersion: latestVersion ?? undefined, minimumVersion: minimumVersion ?? undefined });
    }

    if (minimumVersion && compareVersions(currentVersion, minimumVersion) < 0) {
      console.error('');
      console.error(chalk.red.bold('  ✖ This version of hermes is no longer supported.'));
      console.error('');
      console.error(`  You have ${chalk.dim(currentVersion)}, minimum required is ${chalk.red.bold(minimumVersion)}.`);
      console.error('');
      console.error('  Update now:');
      console.error(`    ${chalk.cyan('npm install -g hermes-git@latest')}`);
      console.error(`    ${chalk.dim('or:  hermes update')}`);
      console.error('');
      process.exit(1);
    }
  } catch {
    // Network failure — never block the user
  }
}

/**
 * Non-blocking: show an update-available banner after a command completes.
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const cache = await readCache();
    const now = Date.now();
    const stale = !cache || (now - cache.lastChecked) > CHECK_INTERVAL;

    let latestVersion = cache?.latestVersion ?? null;

    if (stale) {
      const tags = await fetchDistTags();
      latestVersion = tags.latest ?? null;
      await writeCache({
        lastChecked: now,
        latestVersion: latestVersion ?? undefined,
        minimumVersion: cache?.minimumVersion,
      });
    }

    if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
      const gap = ' '.repeat(Math.max(0, 17 - currentVersion.length - latestVersion.length));
      console.log(chalk.yellow('\n┌──────────────────────────────────────────────────────┐'));
      console.log(chalk.yellow('│') + `  ${chalk.bold('Update available!')} ${chalk.dim(currentVersion)} → ${chalk.green.bold(latestVersion)}${gap}` + chalk.yellow('│'));
      console.log(chalk.yellow('│') + `  Run: ${chalk.cyan('hermes update')}` + ' '.repeat(36) + chalk.yellow('│'));
      console.log(chalk.yellow('└──────────────────────────────────────────────────────┘\n'));
    }
  } catch {
    // Silently fail
  }
}
