import { readFile, writeFile, mkdir, chmod } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'claude-code' | 'codex';

export interface ResolvedEnv {
  provider: Provider | null;
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
  geminiApiKey: string | null;
}

export interface GlobalConfig {
  provider?: Provider;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
}

// Source tells callers where each value came from (for display)
export type EnvSource = 'env' | 'dotenv' | 'global-config' | null;

export interface ResolvedEnvWithSources extends ResolvedEnv {
  sources: {
    provider: EnvSource;
    anthropicApiKey: EnvSource;
    openaiApiKey: EnvSource;
    geminiApiKey: EnvSource;
  };
}

// ─── Paths ─────────────────────────────────────────────────────────────────

export const GLOBAL_CONFIG_DIR = path.join(homedir(), '.config', 'hermes');
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'config.json');

// ─── Global config I/O ─────────────────────────────────────────────────────

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  if (!existsSync(GLOBAL_CONFIG_PATH)) return {};
  try {
    const content = await readFile(GLOBAL_CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await mkdir(GLOBAL_CONFIG_DIR, { recursive: true });
  await writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', {
    mode: 0o600,
  });
  // Ensure permissions are correct even if file already existed
  await chmod(GLOBAL_CONFIG_PATH, 0o600);
}

export async function setGlobalConfigKey(key: keyof GlobalConfig, value: string): Promise<void> {
  const config = await loadGlobalConfig();
  (config as any)[key] = value;
  await saveGlobalConfig(config);
}

// ─── .env file loading ─────────────────────────────────────────────────────

function loadDotenv(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  try {
    const { config } = require('dotenv');
    // populate = false: don't override actual env vars
    const result = config({ path: envPath, override: false });
    return result.parsed || {};
  } catch {
    return {};
  }
}

// ─── Resolution ────────────────────────────────────────────────────────────

let _resolved: ResolvedEnvWithSources | null = null;

export async function getResolvedEnv(): Promise<ResolvedEnvWithSources> {
  if (_resolved) return _resolved;

  // Load .env file values (do not override process.env)
  const dotenvVars = loadDotenv();

  // Load global config
  const global = await loadGlobalConfig();

  function resolve(
    envKey: string,
    globalField: keyof GlobalConfig
  ): { value: string | null; source: EnvSource } {
    if (process.env[envKey]) return { value: process.env[envKey]!, source: 'env' };
    if (dotenvVars[envKey]) return { value: dotenvVars[envKey], source: 'dotenv' };
    const g = global[globalField];
    if (g) return { value: g as string, source: 'global-config' };
    return { value: null, source: null };
  }

  // Resolve provider
  const rawProvider = (() => {
    if (process.env.HERMES_PROVIDER) return { value: process.env.HERMES_PROVIDER, source: 'env' as EnvSource };
    if (dotenvVars.HERMES_PROVIDER) return { value: dotenvVars.HERMES_PROVIDER, source: 'dotenv' as EnvSource };
    if (global.provider) return { value: global.provider, source: 'global-config' as EnvSource };
    return { value: null, source: null as EnvSource };
  })();

  const anthropic = resolve('ANTHROPIC_API_KEY', 'anthropicApiKey');
  const openai = resolve('OPENAI_API_KEY', 'openaiApiKey');
  const gemini = (() => {
    if (process.env.GEMINI_API_KEY) return { value: process.env.GEMINI_API_KEY, source: 'env' as EnvSource };
    if (process.env.GOOGLE_API_KEY) return { value: process.env.GOOGLE_API_KEY, source: 'env' as EnvSource };
    if (dotenvVars.GEMINI_API_KEY) return { value: dotenvVars.GEMINI_API_KEY, source: 'dotenv' as EnvSource };
    if (dotenvVars.GOOGLE_API_KEY) return { value: dotenvVars.GOOGLE_API_KEY, source: 'dotenv' as EnvSource };
    if (global.geminiApiKey) return { value: global.geminiApiKey, source: 'global-config' as EnvSource };
    return { value: null, source: null as EnvSource };
  })();

  const validProviders: Provider[] = ['anthropic', 'openai', 'gemini', 'claude-code', 'codex'];
  const provider = validProviders.includes(rawProvider.value as Provider)
    ? (rawProvider.value as Provider)
    : null;

  _resolved = {
    provider,
    anthropicApiKey: anthropic.value,
    openaiApiKey: openai.value,
    geminiApiKey: gemini.value,
    sources: {
      provider: rawProvider.source,
      anthropicApiKey: anthropic.source,
      openaiApiKey: openai.source,
      geminiApiKey: gemini.source,
    },
  };

  return _resolved;
}

// ─── Display helpers ────────────────────────────────────────────────────────

export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 6) + '...' + key.slice(-4);
}

const sourceLabel: Record<Exclude<EnvSource, null>, string> = {
  env: chalk.cyan('env'),
  dotenv: chalk.blue('.env'),
  'global-config': chalk.green('config'),
};

export function formatSource(source: EnvSource): string {
  if (!source) return chalk.dim('not set');
  return chalk.dim(`(${sourceLabel[source]})`);
}
