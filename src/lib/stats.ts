import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export interface StatsEntry {
  timestamp: number;
  command: string;
  args: string[];
  duration: number;
  success: boolean;
  gitCommandsRun: number;
  timeSaved?: number; // estimated time saved vs raw git
}

export interface Stats {
  totalCommands: number;
  totalGitCommands: number;
  totalTimeSaved: number; // in seconds
  commandHistory: StatsEntry[];
  startDate: number;
  lastUsed: number;
}

const STATS_FILE = '.hermes/stats.json';
const MAX_HISTORY = 1000;

/**
 * Load statistics
 */
export async function loadStats(): Promise<Stats> {
  if (!existsSync(STATS_FILE)) {
    return createEmptyStats();
  }

  try {
    const content = await readFile(STATS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return createEmptyStats();
  }
}

/**
 * Save statistics
 */
export async function saveStats(stats: Stats): Promise<void> {
  try {
    await mkdir('.hermes', { recursive: true });

    // Trim history if too long
    if (stats.commandHistory.length > MAX_HISTORY) {
      stats.commandHistory = stats.commandHistory.slice(-MAX_HISTORY);
    }

    await writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    // Silently fail - stats are not critical
  }
}

/**
 * Record a command execution
 */
export async function recordCommand(
  command: string,
  args: string[],
  duration: number,
  success: boolean,
  gitCommandsRun: number = 0
): Promise<void> {
  const stats = await loadStats();

  // Estimate time saved (conservative)
  const timeSaved = estimateTimeSaved(command, gitCommandsRun);

  const entry: StatsEntry = {
    timestamp: Date.now(),
    command,
    args,
    duration,
    success,
    gitCommandsRun,
    timeSaved,
  };

  stats.totalCommands++;
  stats.totalGitCommands += gitCommandsRun;
  stats.totalTimeSaved += timeSaved;
  stats.lastUsed = Date.now();
  stats.commandHistory.push(entry);

  await saveStats(stats);
}

/**
 * Get statistics summary
 */
export async function getStatsSummary(days: number = 30): Promise<StatsSummary> {
  const stats = await loadStats();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const recentEntries = stats.commandHistory.filter(
    (e) => e.timestamp >= cutoff
  );

  const commandCounts: { [key: string]: number } = {};
  let successCount = 0;

  recentEntries.forEach((entry) => {
    commandCounts[entry.command] = (commandCounts[entry.command] || 0) + 1;
    if (entry.success) successCount++;
  });

  const topCommands = Object.entries(commandCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cmd, count]) => ({ command: cmd, count }));

  const timeSavedRecent = recentEntries.reduce(
    (sum, e) => sum + (e.timeSaved || 0),
    0
  );

  const totalDays = Math.max(
    1,
    Math.ceil((Date.now() - stats.startDate) / (24 * 60 * 60 * 1000))
  );

  return {
    totalCommands: recentEntries.length,
    allTimeCommands: stats.totalCommands,
    gitCommandsRun: recentEntries.reduce((sum, e) => sum + e.gitCommandsRun, 0),
    allTimeGitCommands: stats.totalGitCommands,
    timeSavedSeconds: timeSavedRecent,
    allTimeTimeSavedSeconds: stats.totalTimeSaved,
    successRate: recentEntries.length
      ? successCount / recentEntries.length
      : 0,
    topCommands,
    daysActive: totalDays,
    commandsPerDay: stats.totalCommands / totalDays,
  };
}

export interface StatsSummary {
  totalCommands: number;
  allTimeCommands: number;
  gitCommandsRun: number;
  allTimeGitCommands: number;
  timeSavedSeconds: number;
  allTimeTimeSavedSeconds: number;
  successRate: number;
  topCommands: Array<{ command: string; count: number }>;
  daysActive: number;
  commandsPerDay: number;
}

/**
 * Estimate time saved by using Hermes vs raw Git
 */
function estimateTimeSaved(command: string, gitCommandsRun: number): number {
  // Conservative estimates in seconds
  const estimates: { [key: string]: number } = {
    plan: 120, // 2 min thinking time saved
    start: 60, // 1 min for branch naming, base selection
    sync: 90, // 1.5 min for rebase/merge decision
    wip: 30, // 30s for commit vs stash decision
    conflict: 180, // 3 min per conflict explanation
    worktree: 90, // 1.5 min for worktree setup
  };

  const baseSaving = estimates[command] || 0;

  // Additional savings: each git command prevented saves ~15s
  // (looking up syntax, thinking, potential mistakes)
  const commandSaving = Math.max(0, gitCommandsRun - 1) * 15;

  return baseSaving + commandSaving;
}

function createEmptyStats(): Stats {
  return {
    totalCommands: 0,
    totalGitCommands: 0,
    totalTimeSaved: 0,
    commandHistory: [],
    startDate: Date.now(),
    lastUsed: Date.now(),
  };
}

/**
 * Format seconds to human readable time
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? `${days}d ${remainingHours}h`
    : `${days}d`;
}
