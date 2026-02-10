import { exec } from 'child_process';
import { promisify } from 'util';

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
      throw new Error(
        'GitHub Copilot CLI not found. Install it from: https://github.com/github/copilot-cli\n' +
        'Then authenticate with: copilot login'
      );
    }
    throw new Error(`Copilot CLI error: ${error.message}`);
  }
}

/**
 * Check if GitHub Copilot CLI is installed and authenticated
 */
async function checkCopilotCLI(): Promise<void> {
  try {
    const { stdout } = await execAsync('copilot --version');

    // Version check passed, now verify authentication
    // The CLI will prompt for login if not authenticated
    if (!stdout.includes('GitHub Copilot CLI')) {
      throw new Error('Invalid Copilot CLI installation');
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'GitHub Copilot CLI is not installed.\n' +
        'Install from: https://github.com/github/copilot-cli\n' +
        'Or with npm: npm install -g @githubnext/github-copilot-cli'
      );
    }
    throw error;
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
