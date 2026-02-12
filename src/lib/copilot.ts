import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface CopilotOptions {
  model?: 'claude-sonnet-4.5' | 'claude-opus-4.6' | 'gpt-5' | 'gpt-5.2';
  allowAllTools?: boolean;
  silent?: boolean;
}

/**
 * Get a suggestion from GitHub Copilot CLI
 *
 * Uses the new standalone Copilot CLI (not gh copilot extension)
 * with non-interactive mode for programmatic access
 */
export async function getCopilotSuggestion(
  prompt: string,
  options: CopilotOptions = {}
): Promise<string> {
  try {
    // Check if Copilot CLI is available
    await checkCopilotCLI();

    const {
      model = 'claude-sonnet-4.5',
      allowAllTools = true,
      silent = true,
    } = options;

    // Build command arguments
    const args = [
      '-p', `"${prompt.replace(/"/g, '\\"')}"`,
      '--model', model,
    ];

    // Add permission flags for automation
    if (allowAllTools) {
      args.push('--allow-all-tools');
    }

    // Silent mode outputs only the response (no stats/banner)
    if (silent) {
      args.push('-s');
    }

    // Execute Copilot CLI in non-interactive mode
    const command = `copilot ${args.join(' ')}`;

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      timeout: 120000, // 2 minute timeout
    });

    if (stderr && !stdout) {
      throw new Error(`Copilot CLI error: ${stderr}`);
    }

    return stdout.trim();
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.message.includes('not found')) {
      throw new CopilotNotInstalledError();
    }

    // Check for authentication errors
    const errorMessage = (error.message || '').toLowerCase();
    const stderr = (error.stderr || '').toLowerCase();
    const combinedError = errorMessage + ' ' + stderr;

    if (
      combinedError.includes('no authentication information') ||
      combinedError.includes('authentication required') ||
      combinedError.includes('not authenticated') ||
      combinedError.includes('copilot_github_token') ||
      combinedError.includes('gh_token') ||
      combinedError.includes('github_token')
    ) {
      throw new CopilotNotAuthenticatedError(error.message);
    }

    // Check for subscription errors
    if (
      combinedError.includes('subscription') ||
      combinedError.includes('not authorized') ||
      combinedError.includes('access denied')
    ) {
      throw new Error(
        chalk.red('❌ GitHub Copilot subscription required\n\n') +
        chalk.white('Hermes requires an active GitHub Copilot subscription.\n') +
        chalk.gray('Subscribe at: https://github.com/features/copilot/plans\n\n') +
        chalk.dim('Original error: ' + error.message)
      );
    }

    // Generic error with better formatting
    throw new Error(
      chalk.red('❌ Copilot CLI error\n\n') +
      chalk.white(error.message) +
      '\n\n' +
      chalk.dim('If this persists, try running: copilot --version')
    );
  }
}

/**
 * Check if GitHub Copilot CLI is installed and authenticated
 */
async function checkCopilotCLI(): Promise<void> {
  // Check for deprecated gh copilot extension
  await checkForDeprecatedGhCopilot();

  // Check if copilot CLI is installed
  try {
    const { stdout } = await execAsync('copilot --version', { timeout: 5000 });

    if (!stdout.includes('GitHub Copilot CLI')) {
      throw new Error('Invalid Copilot CLI installation');
    }
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.message.includes('not found')) {
      throw new CopilotNotInstalledError();
    }
    throw error;
  }

  // Note: We check authentication when actually calling copilot, not here
  // This allows for better error messages with context about gh CLI status
}

/**
 * Check for deprecated gh copilot extension and warn user
 */
async function checkForDeprecatedGhCopilot(): Promise<void> {
  try {
    const { stdout } = await execAsync('gh copilot --version', { timeout: 5000 });

    if (stdout) {
      // User has the old gh copilot extension installed
      console.warn(chalk.yellow('\n⚠️  Warning: You have the deprecated "gh copilot" extension installed.'));
      console.warn(chalk.yellow('   The GitHub Copilot extension was deprecated on October 25, 2025.'));
      console.warn(chalk.yellow('   Hermes requires the new standalone "copilot" CLI.\n'));
    }
  } catch {
    // gh copilot not found, which is fine
  }
}

/**
 * Custom error for Copilot CLI not installed
 */
class CopilotNotInstalledError extends Error {
  constructor() {
    const message = [
      '',
      chalk.red('❌ GitHub Copilot CLI is not installed'),
      '',
      chalk.bold('Hermes requires the standalone Copilot CLI (not the deprecated gh copilot extension).'),
      '',
      chalk.cyan('📦 Installation Options:'),
      '',
      chalk.white('  npm:       ') + chalk.gray('npm install -g @github/copilot'),
      chalk.white('  Homebrew:  ') + chalk.gray('brew install github/gh/copilot-cli'),
      chalk.white('  Manual:    ') + chalk.gray('https://github.com/github/copilot-cli/releases'),
      '',
      chalk.cyan('🔐 After installation, authenticate with:'),
      '',
      chalk.white('  copilot') + chalk.gray(' (then run /login command)'),
      '',
      chalk.dim('📚 Learn more: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli'),
      '',
    ].join('\n');

    super(message);
    this.name = 'CopilotNotInstalledError';
  }
}

/**
 * Custom error for Copilot CLI authentication issues
 */
class CopilotNotAuthenticatedError extends Error {
  constructor(originalError?: string) {
    // Check if gh CLI is authenticated
    const ghAuthStatus = checkGhAuthenticationSync();

    const message = [
      '',
      chalk.red('❌ GitHub Copilot CLI is not authenticated'),
      '',
      ghAuthStatus.isAuthenticated
        ? chalk.yellow('⚠️  Note: You have gh CLI authenticated, but Copilot CLI needs separate authentication.')
        : chalk.bold('Hermes needs access to GitHub Copilot to provide AI-powered Git guidance.'),
      '',
      chalk.cyan('🔐 Quick Fix:'),
      '',
      chalk.white('  Run: ') + chalk.bold.green('copilot'),
      chalk.gray('  Then type: ') + chalk.bold('/login'),
      chalk.gray('  Follow the OAuth flow in your browser'),
      '',
      chalk.cyan('🔐 Alternative - Personal Access Token:'),
      '',
      chalk.gray('  1. Create token: https://github.com/settings/tokens/new'),
      chalk.gray('  2. Enable "Copilot Requests" permission'),
      chalk.gray('  3. Run: ') + chalk.white('export GH_TOKEN="your_token_here"'),
      chalk.gray('  4. Add to ~/.bashrc or ~/.zshrc to persist'),
      '',
      chalk.cyan('📋 Requirements:'),
      chalk.gray('  • Active GitHub Copilot subscription'),
      chalk.gray('  • If using organization Copilot, "Copilot CLI" must be enabled in org settings'),
      '',
      chalk.dim('📚 Learn more: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli'),
      '',
    ].join('\n');

    super(message);
    this.name = 'CopilotNotAuthenticatedError';
  }
}

/**
 * Synchronously check if gh CLI is authenticated
 */
function checkGhAuthenticationSync(): { isAuthenticated: boolean; username?: string } {
  try {
    const { execSync } = require('child_process');
    const result = execSync('gh auth status 2>&1', {
      encoding: 'utf-8',
      timeout: 2000,
    });

    const isAuthenticated = result.includes('Logged in to github.com');
    const usernameMatch = result.match(/Logged in to github\.com as (\S+)/);

    return {
      isAuthenticated,
      username: usernameMatch?.[1],
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Ask Copilot to analyze Git repository state and suggest actions
 */
export async function analyzeCopilotGitState(
  repoState: any,
  intent: string
): Promise<string> {
  const prompt = `
You are a Git safety expert. Analyze this repository state and provide guidance.

Repository State:
${JSON.stringify(repoState, null, 2)}

User Intent: "${intent}"

Provide a clear, actionable analysis including:
1. Current state summary (clean/dirty, branch position, conflicts, etc.)
2. Recommended approach with reasoning
3. Potential risks and safety considerations
4. Step-by-step Git commands (if applicable)

Be specific about WHY each step is safe and necessary.
Format your response in clear sections.
`;

  return getCopilotSuggestion(prompt);
}

/**
 * Ask Copilot to generate a Git command plan
 */
export async function getCopilotGitPlan(
  repoState: any,
  intent: string,
  outputFormat: 'json' | 'text' = 'json'
): Promise<string> {
  const formatInstruction = outputFormat === 'json'
    ? 'Return your response as RAW JSON ONLY (no markdown code blocks, no backticks, just pure JSON) with fields: explanation, commands[], risks[], safetyNotes[]'
    : 'Return your response as formatted text with clear sections';

  const prompt = `
You are a Git automation expert. Create a safe execution plan.

Repository State:
${JSON.stringify(repoState, null, 2)}

User wants to: "${intent}"

${formatInstruction}

Ensure all Git commands are:
- Safe (non-destructive when possible)
- Ordered correctly
- Include necessary error handling
- Explain the purpose of each command
`;

  const response = await getCopilotSuggestion(prompt);

  // Strip markdown code blocks if present
  if (outputFormat === 'json') {
    return stripMarkdownCodeBlock(response);
  }

  return response;
}

/**
 * Strip markdown code blocks from response
 * Handles: ```json ... ```, ```... ```, or raw JSON
 */
function stripMarkdownCodeBlock(text: string): string {
  // Remove ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Return as-is if no code block found
  return text.trim();
}
