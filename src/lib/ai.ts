import chalk from 'chalk';
import { getResolvedEnv, type Provider } from './env.js';

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

// ─── Provider selection ────────────────────────────────────────────────────

let _provider: AIProvider | null = null;

async function getProvider(): Promise<AIProvider> {
  if (_provider) return _provider;

  const env = await getResolvedEnv();

  // If a provider is explicitly chosen, require its key
  if (env.provider) {
    const factories: Record<Provider, () => Promise<AIProvider>> = {
      anthropic: () => {
        if (!env.anthropicApiKey) throw new MissingKeyError('anthropic');
        return makeAnthropicProvider(env.anthropicApiKey!);
      },
      openai: () => {
        if (!env.openaiApiKey) throw new MissingKeyError('openai');
        return makeOpenAIProvider(env.openaiApiKey!);
      },
      gemini: () => {
        if (!env.geminiApiKey) throw new MissingKeyError('gemini');
        return makeGeminiProvider(env.geminiApiKey!);
      },
    };
    _provider = await factories[env.provider]();
    return _provider;
  }

  // Auto-detect: first key found wins (anthropic > openai > gemini)
  if (env.anthropicApiKey) {
    _provider = await makeAnthropicProvider(env.anthropicApiKey);
    return _provider;
  }
  if (env.openaiApiKey) {
    _provider = await makeOpenAIProvider(env.openaiApiKey);
    return _provider;
  }
  if (env.geminiApiKey) {
    _provider = await makeGeminiProvider(env.geminiApiKey);
    return _provider;
  }

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
        chalk.red('❌ No AI provider configured'),
        '',
        chalk.bold('Set one of these environment variables:'),
        '',
        chalk.white('  Anthropic  ') + chalk.dim('export ANTHROPIC_API_KEY="sk-ant-..."') + chalk.dim('  → console.anthropic.com'),
        chalk.white('  OpenAI     ') + chalk.dim('export OPENAI_API_KEY="sk-..."      ') + chalk.dim('  → platform.openai.com/api-keys'),
        chalk.white('  Gemini     ') + chalk.dim('export GEMINI_API_KEY="AIza..."     ') + chalk.dim('  → aistudio.google.com/app/apikey'),
        '',
        chalk.dim('Or pin a provider: export HERMES_PROVIDER=anthropic|openai|gemini'),
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
