import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitHubIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
}

/**
 * Returns open GitHub issues assigned to the current user via the gh CLI.
 * Returns null if gh is not installed or the repo has no GitHub remote.
 */
export async function getAssignedIssues(): Promise<GitHubIssue[] | null> {
  // Check gh is available
  try {
    await execAsync('gh --version');
  } catch {
    return null; // gh not installed
  }

  try {
    const { stdout } = await execAsync(
      'gh issue list --assignee @me --state open --limit 20 --json number,title,url,labels'
    );
    const raw = JSON.parse(stdout) as Array<{
      number: number;
      title: string;
      url: string;
      labels: Array<{ name: string }>;
    }>;
    return raw.map(i => ({
      number: i.number,
      title: i.title,
      url: i.url,
      labels: i.labels.map(l => l.name),
    }));
  } catch {
    return null; // not a GitHub repo or not authenticated
  }
}
