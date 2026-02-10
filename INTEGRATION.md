# Hermes + GitHub Copilot CLI Integration

## Overview

Hermes uses the **new standalone GitHub Copilot CLI** (not the deprecated `gh copilot` extension) to provide AI-powered Git guidance.

## How It Works

### Architecture

```
┌─────────────────┐
│  Hermes CLI     │
│  (TypeScript)   │
└────────┬────────┘
         │
         │ Calls copilot with -p flag
         │
         ▼
┌─────────────────┐
│ Copilot CLI     │
│ (Non-interactive)│
└────────┬────────┘
         │
         │ Uses Claude Sonnet 4.5 by default
         │
         ▼
┌─────────────────┐
│ AI Analysis     │
│ & Suggestions   │
└─────────────────┘
```

### Integration Points

**File**: `src/lib/copilot.ts`

Key functions:
- `getCopilotSuggestion(prompt, options)` - Main integration point
- `analyzeCopilotGitState(repoState, intent)` - Git-specific analysis
- `getCopilotGitPlan(repoState, intent)` - Generate executable plans

### Command Flags Used

```bash
copilot -p "<prompt>" \
  --model claude-sonnet-4.5 \
  --allow-all-tools \
  --silent
```

- `-p` - Non-interactive prompt mode (exits after completion)
- `--allow-all-tools` - Auto-approve tool usage (required for automation)
- `--silent` - Output only response, no stats/banner (clean for scripting)
- `--model` - Specify AI model (default: Claude Sonnet 4.5)

## What Changed from Old API

### ❌ Old (Deprecated)
```bash
# The gh copilot extension - deprecated Oct 2025
gh copilot suggest "command"
gh copilot explain "command"
```

### ✅ New (Current)
```bash
# Standalone Copilot CLI
copilot -p "prompt" --allow-all-tools --silent
```

### Key Differences

| Feature | Old `gh copilot` | New `copilot` CLI |
|---------|------------------|-------------------|
| **Installation** | `gh extension install github/gh-copilot` | Standalone binary from github.com/github/copilot-cli |
| **Commands** | `suggest`, `explain` subcommands | `-p` flag for prompts |
| **Modes** | Command-focused | Agentic (interactive, plan, autopilot) |
| **Models** | Limited | Claude 4.5/4.6, GPT-5, Gemini, etc. |
| **Automation** | Limited | Full non-interactive support with `-p` |
| **Tool Use** | N/A | Built-in tool execution with permissions |

## Setup Requirements

### 1. Install Copilot CLI

```bash
# Download from GitHub releases
# https://github.com/github/copilot-cli

# Or via npm (if available)
npm install -g @githubnext/github-copilot-cli
```

### 2. Authenticate

```bash
copilot login
```

This opens OAuth flow in your browser.

### 3. Verify Installation

```bash
copilot --version
# Should output: GitHub Copilot CLI X.X.XXX
```

## Usage in Hermes Commands

### Example: `hermes plan`

```typescript
// src/commands/plan.ts
const analysis = await analyzeCopilotGitState(repoState, intent);
```

This calls:
```bash
copilot -p "Analyze this repo state and provide guidance..." \
  --model claude-sonnet-4.5 \
  --allow-all-tools \
  --silent
```

### Example: `hermes start`

```typescript
// src/commands/start.ts
const planResponse = await getCopilotGitPlan(repoState, intent);
const plan = JSON.parse(stripMarkdownCodeBlock(planResponse));
```

Copilot returns JSON (sometimes wrapped in markdown):
```json
{
  "baseBranch": "main",
  "branchName": "feature/task-name",
  "commands": ["git checkout main", "git pull", ...],
  "explanation": "Why this is safe..."
}
```

## Error Handling

### Common Issues

**1. Copilot CLI Not Found**
```
Error: GitHub Copilot CLI not found
```

**Solution**: Install from https://github.com/github/copilot-cli

**2. Not Authenticated**
```
Error: authentication required
```

**Solution**: Run `copilot login`

**3. JSON Parsing Failures**

Sometimes Copilot returns JSON wrapped in markdown:
````markdown
```json
{ "commands": [...] }
```
````

**Solution**: Use `stripMarkdownCodeBlock()` helper (already implemented)

**4. Timeout Issues**

Long prompts may timeout (default 2 minutes).

**Solution**: Increase timeout in `execAsync`:
```typescript
const { stdout } = await execAsync(command, {
  timeout: 120000, // 2 minutes
});
```

## Customization

### Change AI Model

Edit `src/lib/copilot.ts`:
```typescript
export interface CopilotOptions {
  model?: 'claude-sonnet-4.5' | 'claude-opus-4.6' | 'gpt-5' | 'gpt-5.2';
  // ...
}
```

Available models:
- `claude-sonnet-4.5` (default, fast)
- `claude-opus-4.6` (most capable)
- `gpt-5`, `gpt-5.2` (OpenAI)
- `gemini-3-pro-preview` (Google)

### Adjust Permissions

For stricter control:
```typescript
const response = await getCopilotSuggestion(prompt, {
  allowAllTools: false, // Requires manual approval
});
```

### Silent vs Verbose

```typescript
const response = await getCopilotSuggestion(prompt, {
  silent: false, // Shows stats and banner
});
```

## Testing

### Manual Test

```bash
# In a git repository
bun run dev plan "create a feature branch"
bun run dev wip -m "checkpoint"
bun run dev start "user authentication"
```

### Verify Copilot Integration

```bash
# Direct Copilot test
copilot -p "Analyze this Git repository state" \
  --allow-all-tools \
  --silent
```

## Performance

- **Average Response Time**: 2-5 seconds
- **Model**: Claude Sonnet 4.5 (fastest, most cost-effective)
- **Token Usage**: ~500-2000 tokens per request
- **Rate Limits**: GitHub Copilot subscription limits apply

## Security

### Permissions

Hermes uses `--allow-all-tools` for automation. This means:
- ✅ Copilot can read files in the repo
- ✅ Copilot can execute git commands (through Hermes)
- ❌ Copilot does NOT have write access (Hermes controls execution)

### Data Sent to Copilot

- Git repository state (branch, status, tracking)
- User intent (as typed in command)
- File lists (for conflicts)

**NOT sent**:
- File contents (unless explicitly requested)
- Credentials
- Secrets in .env files

## Debugging

Enable verbose logging:

```bash
# Set log level
export COPILOT_LOG_LEVEL=debug

# Run Hermes
bun run dev plan "test"
```

View Copilot logs:
```bash
tail -f ~/.copilot/logs/copilot.log
```

## Resources

- **GitHub Copilot CLI**: https://github.com/github/copilot-cli
- **Documentation**: https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli
- **Agent Client Protocol (ACP)**: https://docs.github.com/en/copilot/reference/acp-server

## Sources

- [GitHub Copilot CLI Repository](https://github.com/github/copilot-cli)
- [GitHub Copilot CLI Docs](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)
- [Using GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- [Copilot CLI ACP Server](https://docs.github.com/en/copilot/reference/acp-server)
