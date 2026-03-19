import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getAISuggestion } from './ai.js';

const execAsync = promisify(exec);

const PLANS_DIR = '.hermes/plans';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function today(): string {
  return toDateString(new Date());
}

/** Returns the most recent workday before today (Mon → Fri, otherwise yesterday). */
function lastWorkday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun 1=Mon … 6=Sat
  const daysBack = day === 1 ? 3 : day === 0 ? 2 : 1;
  d.setDate(d.getDate() - daysBack);
  return toDateString(d);
}

// ─── Plan file I/O ────────────────────────────────────────────────────────────

function planPath(date: string): string {
  return path.join(PLANS_DIR, `${date}.md`);
}

export async function readPlan(date: string): Promise<string | null> {
  const file = planPath(date);
  if (!existsSync(file)) return null;
  try {
    const text = (await readFile(file, 'utf-8')).trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function writePlan(date: string, content: string): Promise<void> {
  await mkdir(PLANS_DIR, { recursive: true });
  await writeFile(planPath(date), content.trim() + '\n');
}

export function todayKey(): string {
  return today();
}

export function lastWorkdayKey(): string {
  return lastWorkday();
}

// ─── Git commit history ───────────────────────────────────────────────────────

export interface CommitSummary {
  hash: string;
  subject: string;
  date: string;
}

/** Commits made by the configured git user since the start of `since` date. */
export async function getCommitsSince(sinceDate: string): Promise<CommitSummary[]> {
  try {
    const authorEmail = await execAsync('git config user.email')
      .then(r => r.stdout.trim())
      .catch(() => '');

    const format = '%H\x1f%s\x1f%as'; // hash, subject, author-date (YYYY-MM-DD)
    const authorFlag = authorEmail ? `--author=${JSON.stringify(authorEmail)}` : '';
    const { stdout } = await execAsync(
      `git log --since="${sinceDate} 00:00" --format="${format}" ${authorFlag} --no-merges`
    );

    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, subject, date] = line.split('\x1f');
        return { hash: hash.slice(0, 7), subject, date };
      });
  } catch {
    return [];
  }
}

// ─── Blockers ─────────────────────────────────────────────────────────────────

export interface Blocker {
  severity: 'warn' | 'block';
  message: string;
}

export async function detectBlockers(repoState: {
  isClean: boolean;
  hasUncommittedChanges: boolean;
  isInRebase: boolean;
  isInMerge: boolean;
  isInCherryPick: boolean;
  behind: number;
  currentBranch: string;
}): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  if (repoState.isInRebase) {
    blockers.push({ severity: 'block', message: 'Rebase in progress — resolve before continuing' });
  }
  if (repoState.isInMerge) {
    blockers.push({ severity: 'block', message: 'Merge in progress — resolve conflicts' });
  }
  if (repoState.isInCherryPick) {
    blockers.push({ severity: 'block', message: 'Cherry-pick in progress' });
  }
  if (repoState.behind > 0) {
    blockers.push({
      severity: 'warn',
      message: `Branch is ${repoState.behind} commit${repoState.behind !== 1 ? 's' : ''} behind remote — run hermes sync`,
    });
  }
  if (repoState.hasUncommittedChanges) {
    blockers.push({ severity: 'warn', message: 'Uncommitted changes in working tree' });
  }

  // Long-running branch warning (branch older than 5 days with no merge)
  try {
    const { stdout } = await execAsync(
      `git log --format="%as" ${repoState.currentBranch} --not --remotes=origin/main --not --remotes=origin/master -- 2>/dev/null | tail -1`
    );
    const oldest = stdout.trim();
    if (oldest) {
      const daysOld = Math.floor((Date.now() - new Date(oldest).getTime()) / 86_400_000);
      if (daysOld >= 5) {
        blockers.push({
          severity: 'warn',
          message: `Branch has unmerged work going back ${daysOld} days — consider opening a PR`,
        });
      }
    }
  } catch { /* non-critical */ }

  return blockers;
}

// ─── AI plan suggestion ───────────────────────────────────────────────────────

export interface PlanContext {
  currentBranch: string;
  yesterdayPlan: string | null;
  yesterdayCommits: CommitSummary[];
  todayCommits: CommitSummary[];
  hasUncommittedChanges: boolean;
  blockers: Blocker[];
}

export async function suggestTodayPlan(ctx: PlanContext): Promise<string> {
  const prompt = `You are helping a developer plan their day based on their git activity.

Suggest a concise, practical focus for today in 1-2 sentences.
Be specific — reference the actual work in progress from the branch name and commits.
Do NOT use bullet points or markdown. Return plain text only.

Context:
- Current branch: ${ctx.currentBranch}
- Yesterday's plan: ${ctx.yesterdayPlan ?? '(not recorded)'}
- Yesterday's commits: ${ctx.yesterdayCommits.length > 0 ? ctx.yesterdayCommits.map(c => c.subject).join(', ') : 'none'}
- Today's commits so far: ${ctx.todayCommits.length > 0 ? ctx.todayCommits.map(c => c.subject).join(', ') : 'none'}
- Uncommitted work in progress: ${ctx.hasUncommittedChanges ? 'yes' : 'no'}
- Blockers: ${ctx.blockers.length > 0 ? ctx.blockers.map(b => b.message).join('; ') : 'none'}

Suggest what to focus on today:`;

  return getAISuggestion(prompt);
}
