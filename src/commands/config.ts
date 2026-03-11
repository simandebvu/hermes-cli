import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getResolvedEnv,
  loadGlobalConfig,
  saveGlobalConfig,
  setGlobalConfigKey,
  maskKey,
  formatSource,
  GLOBAL_CONFIG_PATH,
  type Provider,
  type GlobalConfig,
} from '../lib/env.js';

const VALID_PROVIDERS: Provider[] = ['anthropic', 'openai', 'gemini'];

const KEY_ALIASES: Record<string, keyof GlobalConfig> = {
  'provider':      'provider',
  'anthropic-key': 'anthropicApiKey',
  'openai-key':    'openaiApiKey',
  'gemini-key':    'geminiApiKey',
};

const KEY_DESCRIPTIONS: Record<keyof GlobalConfig, string> = {
  provider:       'Default AI provider (anthropic | openai | gemini)',
  anthropicApiKey: 'Anthropic API key',
  openaiApiKey:   'OpenAI API key',
  geminiApiKey:   'Gemini API key',
};

export function configCommand(program: Command) {
  const config = program
    .command('config')
    .description('Manage Hermes configuration and API keys');

  // hermes config list
  config
    .command('list')
    .description('Show current configuration and where each value comes from')
    .action(async () => {
      const env = await getResolvedEnv();

      console.log(chalk.bold('\n  Hermes Configuration\n'));
      console.log(chalk.dim(`  Config file: ${GLOBAL_CONFIG_PATH}\n`));

      const rows: [string, string, string][] = [
        [
          'Provider',
          env.provider ? chalk.cyan(env.provider) : chalk.dim('auto-detect'),
          formatSource(env.sources.provider),
        ],
        [
          'Anthropic key',
          env.anthropicApiKey ? chalk.green(maskKey(env.anthropicApiKey)) : chalk.dim('—'),
          formatSource(env.sources.anthropicApiKey),
        ],
        [
          'OpenAI key',
          env.openaiApiKey ? chalk.green(maskKey(env.openaiApiKey)) : chalk.dim('—'),
          formatSource(env.sources.openaiApiKey),
        ],
        [
          'Gemini key',
          env.geminiApiKey ? chalk.green(maskKey(env.geminiApiKey)) : chalk.dim('—'),
          formatSource(env.sources.geminiApiKey),
        ],
      ];

      const labelWidth = Math.max(...rows.map(([l]) => l.length)) + 2;
      for (const [label, value, source] of rows) {
        console.log(`  ${chalk.bold(label.padEnd(labelWidth))}${value}  ${source}`);
      }

      console.log();
      console.log(chalk.dim('  Sources: ') +
        chalk.cyan('env') + chalk.dim(' = environment variable  ') +
        chalk.blue('.env') + chalk.dim(' = .env file  ') +
        chalk.green('config') + chalk.dim(' = ~/.config/hermes/config.json'));
      console.log();
    });

  // hermes config get <key>
  config
    .command('get <key>')
    .description('Get a config value')
    .action(async (rawKey: string) => {
      const field = KEY_ALIASES[rawKey];
      if (!field) {
        console.error(chalk.red(`Unknown key: ${rawKey}`));
        printValidKeys();
        process.exit(1);
      }

      const globalConfig = await loadGlobalConfig();
      const value = globalConfig[field];

      if (!value) {
        console.log(chalk.dim('not set'));
      } else {
        const isKey = field !== 'provider';
        console.log(isKey ? maskKey(value as string) : value);
      }
    });

  // hermes config set <key> <value>
  config
    .command('set <key> <value>')
    .description('Set a config value (persisted to ~/.config/hermes/config.json)')
    .action(async (rawKey: string, value: string) => {
      const field = KEY_ALIASES[rawKey];
      if (!field) {
        console.error(chalk.red(`Unknown key: ${rawKey}`));
        printValidKeys();
        process.exit(1);
      }

      if (field === 'provider' && !VALID_PROVIDERS.includes(value as Provider)) {
        console.error(chalk.red(`Invalid provider: ${value}`));
        console.error(chalk.dim(`Valid options: ${VALID_PROVIDERS.join(', ')}`));
        process.exit(1);
      }

      await setGlobalConfigKey(field, value);

      const isKey = field !== 'provider';
      const display = isKey ? maskKey(value) : value;
      console.log(`${chalk.green('✓')} ${KEY_DESCRIPTIONS[field]} set to ${chalk.cyan(display)}`);
      console.log(chalk.dim(`  Saved to ${GLOBAL_CONFIG_PATH}`));
    });

  // hermes config unset <key>
  config
    .command('unset <key>')
    .description('Remove a config value')
    .action(async (rawKey: string) => {
      const field = KEY_ALIASES[rawKey];
      if (!field) {
        console.error(chalk.red(`Unknown key: ${rawKey}`));
        printValidKeys();
        process.exit(1);
      }

      const globalConfig = await loadGlobalConfig();
      delete globalConfig[field];
      await saveGlobalConfig(globalConfig);

      console.log(`${chalk.green('✓')} ${KEY_DESCRIPTIONS[field]} removed`);
    });

  // hermes config setup  — interactive wizard
  config
    .command('setup')
    .description('Interactive setup wizard for API keys and provider')
    .action(async () => {
      console.log(chalk.bold('\n  Hermes Setup\n'));
      console.log('  Configure your AI provider. Values are saved to');
      console.log(chalk.dim(`  ${GLOBAL_CONFIG_PATH}\n`));

      const globalConfig = await loadGlobalConfig();

      const { provider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Which AI provider do you want to use?',
          choices: [
            { name: 'Anthropic (Claude)', value: 'anthropic' },
            { name: 'OpenAI (GPT-4o)', value: 'openai' },
            { name: 'Google (Gemini)', value: 'gemini' },
            { name: 'Auto-detect (use whichever key is available)', value: '' },
          ],
          default: globalConfig.provider || '',
        },
      ]);

      if (provider) {
        globalConfig.provider = provider as Provider;
      } else {
        delete globalConfig.provider;
      }

      // Prompt for keys based on selection, or all if auto-detect
      const askProviders = provider ? [provider] : VALID_PROVIDERS;

      const keyPrompts: Record<Provider, { field: keyof GlobalConfig; envVar: string; hint: string }> = {
        anthropic: { field: 'anthropicApiKey', envVar: 'ANTHROPIC_API_KEY', hint: 'sk-ant-...' },
        openai:    { field: 'openaiApiKey',    envVar: 'OPENAI_API_KEY',    hint: 'sk-...'     },
        gemini:    { field: 'geminiApiKey',    envVar: 'GEMINI_API_KEY',    hint: 'AIza...'    },
      };

      for (const p of askProviders as Provider[]) {
        const { field, envVar, hint } = keyPrompts[p];
        const existing = globalConfig[field] as string | undefined;
        const fromEnv = process.env[envVar];

        if (fromEnv) {
          console.log(chalk.dim(`  ${envVar} already set in environment, skipping.`));
          continue;
        }

        const { key } = await inquirer.prompt([
          {
            type: 'password',
            name: 'key',
            message: `${p.charAt(0).toUpperCase() + p.slice(1)} API key (${hint}):`,
            default: existing ? '(keep existing)' : '',
            mask: '*',
          },
        ]);

        if (key && key !== '(keep existing)') {
          (globalConfig as any)[field] = key;
        }
      }

      await saveGlobalConfig(globalConfig);

      console.log(`\n${chalk.green('✓')} Configuration saved to ${chalk.dim(GLOBAL_CONFIG_PATH)}`);
      console.log(chalk.dim('  File permissions set to 600 (owner read/write only)\n'));
      console.log(`  Run ${chalk.cyan('hermes config list')} to verify your setup.`);
      console.log();
    });

  // Default: show list when no subcommand given
  config.action(async () => {
    config.help();
  });
}

function printValidKeys(): void {
  console.log(chalk.dim('\nValid keys:'));
  for (const [alias, field] of Object.entries(KEY_ALIASES)) {
    console.log(chalk.dim(`  ${alias.padEnd(16)} ${KEY_DESCRIPTIONS[field]}`));
  }
}
