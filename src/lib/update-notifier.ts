import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

const PACKAGE_NAME = 'hermes-git';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CACHE_DIR = path.join(homedir(), '.hermes', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'update-check.json');

interface UpdateCache {
  lastChecked: number;
  latestVersion?: string;
}

/**
 * Get the latest version from npm registry
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.version || null;
  } catch {
    return null;
  }
}

/**
 * Read update cache
 */
async function readCache(): Promise<UpdateCache | null> {
  try {
    if (!existsSync(CACHE_FILE)) return null;

    const content = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write update cache
 */
async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Compare versions (simple semver comparison)
 */
function isNewerVersion(current: string, latest: string): boolean {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }

  return false;
}

/**
 * Check for updates and display notification if available
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    // Read cache
    const cache = await readCache();
    const now = Date.now();

    // Check if we should check for updates
    const shouldCheck = !cache || (now - cache.lastChecked) > CHECK_INTERVAL;

    let latestVersion: string | null = cache?.latestVersion || null;

    if (shouldCheck) {
      // Fetch latest version in the background (non-blocking)
      latestVersion = await getLatestVersion();

      // Update cache
      await writeCache({
        lastChecked: now,
        latestVersion: latestVersion || undefined,
      });
    }

    // Display notification if update available
    if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
      console.log(chalk.yellow('\n┌─────────────────────────────────────────────────────┐'));
      console.log(chalk.yellow('│') + '  ' + chalk.bold('Update available!') + ' ' + chalk.dim(currentVersion) + ' → ' + chalk.green.bold(latestVersion) + '       ' + chalk.yellow('│'));
      console.log(chalk.yellow('│') + '  Run: ' + chalk.cyan('npm install -g hermes-git@latest') + '  ' + chalk.yellow('│'));
      console.log(chalk.yellow('└─────────────────────────────────────────────────────┘\n'));
    }
  } catch {
    // Silently fail - don't block the CLI if update check fails
  }
}
