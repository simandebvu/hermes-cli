import { Command } from 'commander';
import { getRepoState } from '../lib/git.js';
import { displaySuccess } from '../lib/display.js';
import inquirer from 'inquirer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface HermesConfig {
  version: string;
  project: {
    name: string;
    mainBranch: string;
    developBranch?: string;
    protectedBranches: string[];
  };
  branches: {
    featurePattern: string;
    bugfixPattern: string;
    hotfixPattern: string;
  };
  workflows: {
    [key: string]: string[];
  };
  integrations: {
    tickets?: 'linear' | 'jira' | 'github' | 'gitlab' | 'none';
    ci?: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'none';
  };
  preferences: {
    autoBackup: boolean;
    learningMode: boolean;
    defaultEditor: string;
  };
}

export function initCommand(program: Command) {
  program
    .command('init')
    .description('Initialize Hermes configuration for this repository')
    .option('--quick', 'Skip interactive prompts, use defaults')
    .action(async (options: { quick?: boolean }) => {
      try {
        console.log('🪽 Initializing Hermes for this repository...\n');

        // Check if already initialized
        if (existsSync('.hermes/config.json')) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'Hermes is already initialized. Overwrite configuration?',
              default: false,
            },
          ]);

          if (!overwrite) {
            console.log('Cancelled.');
            return;
          }
        }

        const repoState = await getRepoState();

        let config: HermesConfig;

        if (options.quick) {
          // Quick mode with sensible defaults
          config = createDefaultConfig(repoState.currentBranch);
        } else {
          // Interactive configuration
          config = await interactiveConfig(repoState);
        }

        // Create .hermes directory and save config
        await mkdir('.hermes', { recursive: true });
        await writeFile(
          '.hermes/config.json',
          JSON.stringify(config, null, 2)
        );

        // Create .hermes/backups directory
        await mkdir('.hermes/backups', { recursive: true });

        // Create .gitignore entry for backups
        await appendToGitignore('.hermes/backups/\n.hermes/stats.json\n');

        displaySuccess('Hermes initialized successfully!');
        console.log('\n📄 Configuration saved to .hermes/config.json');
        console.log('💡 Tip: Commit .hermes/config.json to share with your team\n');

        // Show what's enabled
        console.log('✨ Features enabled:');
        if (config.preferences.autoBackup) {
          console.log('  • Auto-backup before risky operations');
        }
        if (config.preferences.learningMode) {
          console.log('  • Learning mode (explanations with commands)');
        }
        if (config.integrations.tickets && config.integrations.tickets !== 'none') {
          console.log(`  • ${config.integrations.tickets} integration`);
        }
        console.log();
        console.log('🚀 Try: hermes start "your first feature"');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createDefaultConfig(currentBranch: string): HermesConfig {
  return {
    version: '0.1.0',
    project: {
      name: path.basename(process.cwd()),
      mainBranch: currentBranch === 'master' ? 'master' : 'main',
      protectedBranches: ['main', 'master', 'production', 'staging'],
    },
    branches: {
      featurePattern: 'feature/{description}',
      bugfixPattern: 'bugfix/{description}',
      hotfixPattern: 'hotfix/{description}',
    },
    workflows: {
      'feature': ['start', 'sync', 'test', 'pr'],
      'hotfix': ['start', 'sync', 'test', 'fast-track'],
    },
    integrations: {
      tickets: 'none',
      ci: 'none',
    },
    preferences: {
      autoBackup: true,
      learningMode: false,
      defaultEditor: process.env.EDITOR || 'vim',
    },
  };
}

async function interactiveConfig(repoState: any): Promise<HermesConfig> {
  console.log('📝 Let\'s set up Hermes for your project.\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: path.basename(process.cwd()),
    },
    {
      type: 'input',
      name: 'mainBranch',
      message: 'Main branch name:',
      default: repoState.currentBranch === 'master' ? 'master' : 'main',
    },
    {
      type: 'input',
      name: 'developBranch',
      message: 'Development branch (optional):',
      default: '',
    },
    {
      type: 'input',
      name: 'featurePattern',
      message: 'Feature branch pattern:',
      default: 'feature/{description}',
    },
    {
      type: 'list',
      name: 'tickets',
      message: 'Issue tracking system:',
      choices: [
        { name: 'None', value: 'none' },
        { name: 'Linear', value: 'linear' },
        { name: 'Jira', value: 'jira' },
        { name: 'GitHub Issues', value: 'github' },
        { name: 'GitLab Issues', value: 'gitlab' },
      ],
    },
    {
      type: 'confirm',
      name: 'autoBackup',
      message: 'Enable auto-backup before risky operations?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'learningMode',
      message: 'Enable learning mode (show explanations)?',
      default: false,
    },
  ]);

  return {
    version: '0.1.0',
    project: {
      name: answers.projectName,
      mainBranch: answers.mainBranch,
      developBranch: answers.developBranch || undefined,
      protectedBranches: [
        answers.mainBranch,
        answers.developBranch,
        'production',
        'staging',
      ].filter(Boolean),
    },
    branches: {
      featurePattern: answers.featurePattern,
      bugfixPattern: answers.featurePattern.replace('feature', 'bugfix'),
      hotfixPattern: answers.featurePattern.replace('feature', 'hotfix'),
    },
    workflows: {
      'feature': ['start', 'sync', 'test', 'pr'],
      'hotfix': ['start', 'sync', 'test', 'fast-track'],
    },
    integrations: {
      tickets: answers.tickets,
      ci: 'none',
    },
    preferences: {
      autoBackup: answers.autoBackup,
      learningMode: answers.learningMode,
      defaultEditor: process.env.EDITOR || 'vim',
    },
  };
}

async function appendToGitignore(content: string): Promise<void> {
  try {
    const { appendFile } = await import('fs/promises');
    const gitignorePath = '.gitignore';

    if (existsSync(gitignorePath)) {
      const { readFile } = await import('fs/promises');
      const existing = await readFile(gitignorePath, 'utf-8');
      if (!existing.includes('.hermes/backups')) {
        await appendFile(gitignorePath, '\n# Hermes\n' + content);
      }
    } else {
      await writeFile(gitignorePath, '# Hermes\n' + content);
    }
  } catch {
    // Ignore gitignore errors
  }
}
