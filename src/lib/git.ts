import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RepoState {
  currentBranch: string;
  isClean: boolean;
  hasUncommittedChanges: boolean;
  hasUntrackedFiles: boolean;
  isInRebase: boolean;
  isInMerge: boolean;
  isInCherryPick: boolean;
  remoteTracking?: string;
  ahead: number;
  behind: number;
}

/**
 * Get the current state of the Git repository
 */
export async function getRepoState(): Promise<RepoState> {
  try {
    const [
      currentBranch,
      status,
      tracking,
      rebaseStatus,
      mergeStatus,
      cherryPickStatus,
    ] = await Promise.all([
      execAsync('git rev-parse --abbrev-ref HEAD').then((r) => r.stdout.trim()),
      execAsync('git status --porcelain').then((r) => r.stdout.trim()),
      execAsync('git rev-parse --abbrev-ref @{upstream}')
        .then((r) => r.stdout.trim())
        .catch(() => null),
      execAsync('git rev-parse --git-dir')
        .then((r) => execAsync(`test -d ${r.stdout.trim()}/rebase-merge`))
        .then(() => true)
        .catch(() => false),
      execAsync('git rev-parse --git-dir')
        .then((r) => execAsync(`test -f ${r.stdout.trim()}/MERGE_HEAD`))
        .then(() => true)
        .catch(() => false),
      execAsync('git rev-parse --git-dir')
        .then((r) => execAsync(`test -f ${r.stdout.trim()}/CHERRY_PICK_HEAD`))
        .then(() => true)
        .catch(() => false),
    ]);

    const statusLines = status.split('\n').filter((line) => line);
    const hasUncommittedChanges = statusLines.some(
      (line) => line.startsWith(' M') || line.startsWith('M ')
    );
    const hasUntrackedFiles = statusLines.some((line) => line.startsWith('??'));

    let ahead = 0;
    let behind = 0;

    if (tracking) {
      const aheadBehind = await execAsync(
        `git rev-list --left-right --count ${tracking}...HEAD`
      )
        .then((r) => r.stdout.trim().split('\t'))
        .catch(() => ['0', '0']);

      behind = parseInt(aheadBehind[0], 10);
      ahead = parseInt(aheadBehind[1], 10);
    }

    return {
      currentBranch,
      isClean: statusLines.length === 0,
      hasUncommittedChanges,
      hasUntrackedFiles,
      isInRebase: rebaseStatus,
      isInMerge: mergeStatus,
      isInCherryPick: cherryPickStatus,
      remoteTracking: tracking || undefined,
      ahead,
      behind,
    };
  } catch (error) {
    throw new Error('Not a Git repository or Git is not installed');
  }
}

/**
 * Execute a Git command
 */
export async function executeGitCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command);
    return stdout || stderr;
  } catch (error: any) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

/**
 * Get list of conflicted files
 */
export async function getConflictedFiles(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('git diff --name-only --diff-filter=U');
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line);
  } catch {
    return [];
  }
}
