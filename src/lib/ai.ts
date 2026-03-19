import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { getResolvedEnv, type Provider } from './env.js';

const execAsync = promisify(exec);

// ─── Provider interface ────────────────────────────────────────────────────

interface AIProvider {
  complete(prompt: string): Promise<string>;
  name: string;
  model: string;
}

// ─── Anthropic ─────────────────────────────────────────────────────────────

async function makeAnthropicProvider(apiKey: string): Promise<AIProvider> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  return {
    name: 'Anthropic',
    model: 'claude-sonnet-4-6',
    async complete(prompt: string): Promise<string> {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type from Anthropic');
      return content.text.trim();
    },
  };
}

// ─── OpenAI ────────────────────────────────────────────────────────────────

async function makeOpenAIProvider(apiKey: string): Promise<AIProvider> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  return {
    name: 'OpenAI',
    model: 'gpt-4o',
    async complete(prompt: string): Promise<string> {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error('Empty response from OpenAI');
      return text.trim();
    },
  };
}

// ─── Gemini ────────────────────────────────────────────────────────────────

async function makeGeminiProvider(apiKey: string): Promise<AIProvider> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  return {
    name: 'Gemini',
    model: 'gemini-2.5-flash',
    async complete(prompt: string): Promise<string> {
      try {
        const result = await genModel.generateContent(prompt);
        const text = result.response.text();
        if (!text) throw new Error('Empty response from Gemini');
        return text.trim();
      } catch (err: any) {
        const msg: string = err?.message ?? '';
        if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
          const retryMatch = msg.match(/retry in ([\d.]+)s/i);
          const retryIn = retryMatch ? `${Math.ceil(parseFloat(retryMatch[1]))}s` : null;
          throw new GeminiQuotaError(retryIn);
        }
        throw err;
      }
    },
  };
}

// ─── Claude Code CLI ──────────────────────────────────────────────────────

async function makeClaudeCodeProvider(): Promise<AIProvider> {
  // Verify the CLI is available
  try {
    await execAsync('claude --version', { timeout: 5000 });
  } catch {
    throw new Error('claude CLI not found — install Claude Code first');
  }

  return {
    name: 'Claude Code',
    model: 'claude (via CLI)',
    async complete(prompt: string): Promise<string> {
      // Unset CLAUDECODE so the subprocess isn't blocked by the nested-session guard
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const escaped = prompt.replace(/'/g, `'"'"'`);
      const { stdout, stderr } = await execAsync(
        `claude -p '${escaped}' --no-session-persistence --tools ""`,
        { env, timeout: 60_000 }
      );

      const text = (stdout || stderr).trim();
      if (!text) throw new Error('Empty response from Claude Code CLI');

      // Strip any ANSI escape codes
      return text.replace(/\x1b\[[0-9;]*m/g, '');
    },
  };
}

// ─── OpenAI Codex CLI ─────────────────────────────────────────────────────

async function makeCodexProvider(): Promise<AIProvider> {
  try {
    await execAsync('codex --version', { timeout: 5000 });
  } catch {
    throw new Error('codex CLI not found — install OpenAI Codex first');
  }

  return {
    name: 'Codex',
    model: 'codex (via CLI)',
    async complete(prompt: string): Promise<string> {
      // Write prompt to a temp file to avoid shell-escaping issues with long prompts
      const tmpDir = await mkdtemp(path.join(tmpdir(), 'hermes-'));
      const promptFile = path.join(tmpDir, 'prompt.txt');
      const outputFile = path.join(tmpDir, 'output.txt');

      try {
        const { writeFile } = await import('fs/promises');
        await writeFile(promptFile, prompt, 'utf-8');

        await execAsync(
          `codex exec --color never -o "${outputFile}" - < "${promptFile}"`,
          { timeout: 60_000 }
        );

        const text = (await readFile(outputFile, 'utf-8')).trim();
        if (!text) throw new Error('Empty response from Codex CLI');
        return text;
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    },
  };
}

export async function isCodexAvailable(): Promise<boolean> {
  try {
    await execAsync('codex --version', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function isClaudeCodeAvailable(): Promise<boolean> {
  try {
    await execAsync('claude --version', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Provider selection ────────────────────────────────────────────────────

let _provider: AIProvider | null = null;

async function getProvider(): Promise<AIProvider> {
  if (_provider) return _provider;

  const env = await getResolvedEnv();

  // If a provider is explicitly chosen, require its key (or CLI for claude-code)
  if (env.provider) {
    const factories: Record<Provider, () => Promise<AIProvider>> = {
      anthropic:    () => { if (!env.anthropicApiKey) throw new MissingKeyError('anthropic'); return makeAnthropicProvider(env.anthropicApiKey!); },
      openai:       () => { if (!env.openaiApiKey)    throw new MissingKeyError('openai');    return makeOpenAIProvider(env.openaiApiKey!); },
      gemini:       () => { if (!env.geminiApiKey)    throw new MissingKeyError('gemini');    return makeGeminiProvider(env.geminiApiKey!); },
      'claude-code': () => makeClaudeCodeProvider(),
      'codex':       () => makeCodexProvider(),
    };
    _provider = await factories[env.provider]();
    return _provider;
  }

  // Auto-detect: API keys first, then claude CLI as a no-key fallback
  if (env.anthropicApiKey) { _provider = await makeAnthropicProvider(env.anthropicApiKey); return _provider; }
  if (env.openaiApiKey)    { _provider = await makeOpenAIProvider(env.openaiApiKey);        return _provider; }
  if (env.geminiApiKey)    { _provider = await makeGeminiProvider(env.geminiApiKey);        return _provider; }

  // Last resort: local AI CLIs (no API key required) — claude-code before codex
  if (await isClaudeCodeAvailable()) { _provider = await makeClaudeCodeProvider(); return _provider; }
  if (await isCodexAvailable())      { _provider = await makeCodexProvider();      return _provider; }

  throw new NoProviderError();
}

class GeminiQuotaError extends Error {
  constructor(retryIn: string | null) {
    const lines = [
      '',
      chalk.red('❌ Gemini quota exceeded'),
      '',
      retryIn
        ? chalk.white(`  Per-minute limit hit. You could retry in ${chalk.bold(retryIn)}.`)
        : chalk.white('  Your free-tier daily quota is exhausted.'),
      '',
      chalk.bold('  Options:'),
      `  ${chalk.cyan('1.')} Enable billing at ${chalk.dim('https://aistudio.google.com/app/billing')}`,
      `  ${chalk.cyan('2.')} Switch provider:  ${chalk.dim('hermes config set provider anthropic')}`,
      `  ${chalk.cyan('3.')} Switch provider:  ${chalk.dim('hermes config set provider openai')}`,
      '',
    ];
    super(lines.join('\n'));
  }
}

class MissingKeyError extends Error {
  constructor(provider: 'anthropic' | 'openai' | 'gemini') {
    const configs: Record<string, { envVar: string; keyHint: string; url: string }> = {
      anthropic: {
        envVar: 'ANTHROPIC_API_KEY',
        keyHint: 'sk-ant-...',
        url: 'https://console.anthropic.com/',
      },
      openai: {
        envVar: 'OPENAI_API_KEY',
        keyHint: 'sk-...',
        url: 'https://platform.openai.com/api-keys',
      },
      gemini: {
        envVar: 'GEMINI_API_KEY',
        keyHint: 'AIza...',
        url: 'https://aistudio.google.com/app/apikey',
      },
    };
    const c = configs[provider];
    super(
      [
        '',
        chalk.red(`❌ ${c.envVar} is not set`),
        '',
        chalk.white('  export ') + chalk.bold.green(`${c.envVar}="${c.keyHint}"`),
        chalk.dim(`  Get a key: ${c.url}`),
        '',
      ].join('\n')
    );
  }
}

class NoProviderError extends Error {
  constructor() {
    super(
      [
        '',
        chalk.red('  ✖ No AI provider configured'),
        '',
        chalk.bold('  Option 1 — use a local AI CLI (no API key needed):'),
        chalk.dim('    Claude Code: ') + chalk.cyan('hermes config set provider claude-code'),
        chalk.dim('    Codex CLI:   ') + chalk.cyan('hermes config set provider codex'),
        '',
        chalk.bold('  Option 2 — set an API key:'),
        chalk.white('    Anthropic  ') + chalk.dim('export ANTHROPIC_API_KEY="sk-ant-..."  → console.anthropic.com'),
        chalk.white('    OpenAI     ') + chalk.dim('export OPENAI_API_KEY="sk-..."         → platform.openai.com/api-keys'),
        chalk.white('    Gemini     ') + chalk.dim('export GEMINI_API_KEY="AIza..."        → aistudio.google.com/app/apikey'),
        '',
        chalk.dim('  Or run: hermes config setup'),
        '',
      ].join('\n')
    );
  }
}

// ─── Public API (unchanged for callers) ───────────────────────────────────

export async function getAISuggestion(prompt: string): Promise<string> {
  const provider = await getProvider();
  return provider.complete(prompt);
}

export async function analyzeGitState(repoState: any, intent: string): Promise<string> {
  const prompt = `You are a Git safety expert. Analyze this repository state and provide guidance.

Repository State:
${JSON.stringify(repoState, null, 2)}

User Intent: "${intent}"

Provide a clear, actionable analysis including:
1. Current state summary (clean/dirty, branch position, conflicts, etc.)
2. Recommended approach with reasoning
3. Potential risks and safety considerations
4. Step-by-step Git commands (if applicable)

Be specific about WHY each step is safe and necessary.
Format your response in clear sections.`;

  return getAISuggestion(prompt);
}

export async function getGitPlan(
  repoState: any,
  intent: string,
  outputFormat: 'json' | 'text' = 'json'
): Promise<string> {
  const formatInstruction =
    outputFormat === 'json'
      ? 'Return your response as RAW JSON ONLY (no markdown code blocks, no backticks, just pure JSON) with fields: explanation, commands[], risks[], safetyNotes[]'
      : 'Return your response as formatted text with clear sections';

  const prompt = `You are a Git automation expert. Create a safe execution plan.

Repository State:
${JSON.stringify(repoState, null, 2)}

User wants to: "${intent}"

${formatInstruction}

Ensure all Git commands are:
- Safe (non-destructive when possible)
- Ordered correctly
- Prefixed with "git " (no shell commands, no aliases)
- Explain the purpose of each command`;

  const response = await getAISuggestion(prompt);

  if (outputFormat === 'json') {
    return stripMarkdownCodeBlock(response);
  }

  return response;
}

/**
 * Returns all available providers, one per model family (Claude / OpenAI / Google).
 * Prefers API keys over CLI where both exist for the same family.
 */
export async function getAllAvailableProviders(): Promise<AIProvider[]> {
  const env = await getResolvedEnv();
  const providers: AIProvider[] = [];

  // Claude family: API key beats CLI
  if (env.anthropicApiKey) {
    providers.push(await makeAnthropicProvider(env.anthropicApiKey));
  } else if (await isClaudeCodeAvailable()) {
    providers.push(await makeClaudeCodeProvider());
  }

  // OpenAI family: API key beats CLI
  if (env.openaiApiKey) {
    providers.push(await makeOpenAIProvider(env.openaiApiKey));
  } else if (await isCodexAvailable()) {
    providers.push(await makeCodexProvider());
  }

  // Google family
  if (env.geminiApiKey) {
    providers.push(await makeGeminiProvider(env.geminiApiKey));
  }

  return providers;
}

/**
 * Returns which provider is active, for display purposes.
 */
export async function getActiveProvider(): Promise<{ name: string; model: string }> {
  const provider = await getProvider();
  return { name: provider.name, model: provider.model };
}

/**
 * Validate that a command is a safe git command before executing.
 * Throws if the command looks unsafe.
 */
export function validateGitCommand(cmd: string): void {
  const trimmed = cmd.trim();
  if (!trimmed.startsWith('git ')) {
    throw new Error(`Refusing to execute non-git command: ${trimmed}`);
  }

  const dangerous = ['--force', '-f ', ' -f\t', 'git push -f'];
  for (const flag of dangerous) {
    if (trimmed.includes(flag) && !trimmed.includes('--force-with-lease')) {
      throw new Error(
        `Command contains a potentially destructive flag. Review and run manually:\n  ${trimmed}`
      );
    }
  }
}

function stripMarkdownCodeBlock(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}
