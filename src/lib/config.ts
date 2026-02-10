import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface HermesConfig {
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

/**
 * Load Hermes configuration from .hermes/config.json
 */
export async function loadConfig(): Promise<HermesConfig | null> {
  const configPath = '.hermes/config.json';

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Could not load .hermes/config.json');
    return null;
  }
}

/**
 * Check if Hermes is initialized in current directory
 */
export function isInitialized(): boolean {
  return existsSync('.hermes/config.json');
}

/**
 * Generate branch name from pattern
 */
export function generateBranchName(
  pattern: string,
  description: string,
  ticket?: string
): string {
  let branchName = pattern;

  // Replace placeholders
  branchName = branchName.replace('{description}', slugify(description));
  branchName = branchName.replace('{ticket}', ticket || '');

  // Clean up
  branchName = branchName.replace(/\/{2,}/g, '/'); // Remove double slashes
  branchName = branchName.replace(/\/$/, ''); // Remove trailing slash

  return branchName;
}

/**
 * Convert text to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if branch is protected
 */
export function isProtectedBranch(
  branch: string,
  config: HermesConfig | null
): boolean {
  if (!config) {
    // Default protected branches if no config
    return ['main', 'master', 'production', 'staging'].includes(branch);
  }

  return config.project.protectedBranches.includes(branch);
}

/**
 * Get default config values
 */
export function getDefaultConfig(): Partial<HermesConfig> {
  return {
    version: '0.1.0',
    project: {
      name: path.basename(process.cwd()),
      mainBranch: 'main',
      protectedBranches: ['main', 'master', 'production', 'staging'],
    },
    branches: {
      featurePattern: 'feature/{description}',
      bugfixPattern: 'bugfix/{description}',
      hotfixPattern: 'hotfix/{description}',
    },
    preferences: {
      autoBackup: true,
      learningMode: false,
      defaultEditor: process.env.EDITOR || 'vim',
    },
  };
}
