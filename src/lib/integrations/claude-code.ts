import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import path from 'path';

const execAsync = promisify(exec);

interface ClaudeCodeTodo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Converts an absolute path to the Claude Code project directory name.
 * e.g. /home/user/Code/hermes → -home-user-Code-hermes
 */
function pathToProjectKey(absPath: string): string {
  return absPath.replace(/\//g, '-');
}

/**
 * Returns session IDs (subdirectory names, not .jsonl files) for the current project.
 */
async function getProjectSessionIds(): Promise<string[]> {
  const projectKey = pathToProjectKey(process.cwd());
  const projectDir = path.join(homedir(), '.claude', 'projects', projectKey);

  if (!existsSync(projectDir)) return [];

  try {
    const { stdout } = await execAsync(`ls -1 "${projectDir}"`);
    return stdout
      .trim()
      .split('\n')
      .filter(name => name && !name.endsWith('.jsonl')); // only dirs, not session logs
  } catch {
    return [];
  }
}

/**
 * Reads all pending/in-progress Claude Code todos for the current project.
 */
export async function getClaudeCodeTodos(): Promise<ClaudeCodeTodo[]> {
  const sessionIds = await getProjectSessionIds();
  if (sessionIds.length === 0) return [];

  const todosDir = path.join(homedir(), '.claude', 'todos');
  if (!existsSync(todosDir)) return [];

  const todos: ClaudeCodeTodo[] = [];

  for (const sessionId of sessionIds) {
    // Todo files are named <sessionId>-agent-<agentId>.json
    try {
      const { stdout: files } = await execAsync(`ls -1 "${todosDir}" | grep "^${sessionId}"`);
      for (const file of files.trim().split('\n').filter(Boolean)) {
        try {
          const raw = await readFile(path.join(todosDir, file), 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const todo of parsed as ClaudeCodeTodo[]) {
              if (todo.status === 'pending' || todo.status === 'in_progress') {
                todos.push(todo);
              }
            }
          }
        } catch { /* malformed file — skip */ }
      }
    } catch { /* no matching files — skip */ }
  }

  // Deduplicate by content (same task may appear in multiple agent files)
  const seen = new Set<string>();
  return todos.filter(t => {
    if (seen.has(t.content)) return false;
    seen.add(t.content);
    return true;
  });
}
