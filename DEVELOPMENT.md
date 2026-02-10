# Hermes Development Guide

## Project Structure

```
hermes/
├── src/
│   ├── index.ts              # CLI entry point & command registration
│   ├── commands/             # Command implementations
│   │   ├── plan.ts           # hermes plan "<intent>"
│   │   ├── start.ts          # hermes start "<task>"
│   │   ├── wip.ts            # hermes wip [--message]
│   │   ├── sync.ts           # hermes sync [--from]
│   │   ├── conflict.ts       # hermes conflict explain/apply
│   │   └── worktree.ts       # hermes worktree new "<task>"
│   └── lib/                  # Shared utilities
│       ├── copilot.ts        # GitHub Copilot CLI integration
│       ├── git.ts            # Git command utilities & repo state
│       └── display.ts        # Terminal output formatting
├── dist/                     # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── README.md
├── INTEGRATION.md            # Copilot integration details
└── DEVELOPMENT.md            # This file
```

## Prerequisites

- **Node.js** >= 18.0.0
- **Bun** (package manager & build tool)
- **Git** (obviously!)
- **GitHub Copilot CLI** (for AI features)

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Install Copilot CLI

```bash
# Download from GitHub
# https://github.com/github/copilot-cli

# Authenticate
copilot login
```

### 3. Development Mode

```bash
# Run directly without building
bun run dev --help
bun run dev plan "test intent"
```

### 4. Build for Production

```bash
bun run build
```

This creates `dist/index.js` - a single bundled file.

## Development Workflow

### Adding a New Command

1. **Create command file**: `src/commands/mycommand.ts`

```typescript
import { Command } from 'commander';
import { getCopilotGitPlan } from '../lib/copilot.js';
import { getRepoState, executeGitCommand } from '../lib/git.js';
import { displaySuccess, displayStep } from '../lib/display.js';

export function myCommandCommand(program: Command) {
  program
    .command('mycommand')
    .description('What this command does')
    .argument('<arg>', 'Argument description')
    .option('--flag', 'Optional flag')
    .action(async (arg: string, options: { flag?: boolean }) => {
      try {
        console.log('🚀 Starting my command...\n');

        // Get repo state
        const repoState = await getRepoState();

        // Get AI plan
        const planResponse = await getCopilotGitPlan(
          repoState,
          `User wants to: ${arg}`
        );

        const plan = JSON.parse(planResponse);

        // Display & execute
        if (plan.explanation) {
          console.log(`💭 ${plan.explanation}\n`);
        }

        if (plan.commands) {
          for (const command of plan.commands) {
            const cmdString = typeof command === 'string' ? command : String(command);
            displayStep(cmdString);
            await executeGitCommand(cmdString);
          }
          displaySuccess('Done!');
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
```

2. **Register in `src/index.ts`**:

```typescript
import { myCommandCommand } from './commands/mycommand.js';

// ...

myCommandCommand(program);
```

3. **Test**:

```bash
bun run dev mycommand "test"
```

### Working with Git State

The `getRepoState()` function returns:

```typescript
interface RepoState {
  currentBranch: string;
  isClean: boolean;
  hasUncommittedChanges: boolean;
  hasUntrackedFiles: boolean;
  isInRebase: boolean;
  isInMerge: boolean;
  isInCherryPick: boolean;
  remoteTracking?: string;
  ahead: number;
  behind: number;
}
```

Use this to make safe decisions:

```typescript
const repoState = await getRepoState();

if (repoState.isInMerge) {
  console.log('⚠️  Cannot proceed: merge in progress');
  return;
}

if (!repoState.isClean) {
  console.log('💡 Working directory has changes');
}
```

### Using Copilot CLI

**Text Analysis** (for `plan`, `conflict explain`):
```typescript
const analysis = await analyzeCopilotGitState(repoState, intent);
console.log(analysis); // Formatted text response
```

**Structured Plan** (for `start`, `sync`, `wip`):
```typescript
const planResponse = await getCopilotGitPlan(repoState, intent);
const plan = JSON.parse(planResponse);

// plan.explanation - Why this approach
// plan.commands[] - Git commands to run
// plan.risks[] - Potential issues
// plan.safetyNotes[] - Safety considerations
```

**Custom Prompt**:
```typescript
const response = await getCopilotSuggestion(
  'Your custom prompt here',
  {
    model: 'claude-opus-4.6', // More capable but slower
    silent: true,
    allowAllTools: true,
  }
);
```

### Display Utilities

```typescript
import {
  displayStep,      // Show command being executed
  displaySuccess,   // Show success message
  displayWarning,   // Show warning
  displayPlan,      // Show full plan with repo state
  displayConflictExplanation, // Show conflict analysis
} from '../lib/display.js';

displayStep('git checkout -b feature/new');
displaySuccess('Branch created!');
displayWarning('This operation is risky');
```

## Testing

### Manual Testing

Create a test repository:

```bash
cd /tmp
mkdir test-hermes && cd test-hermes
git init
echo "# Test" > README.md
git add . && git commit -m "Initial commit"
git branch -M main
```

Test commands:

```bash
cd /tmp/test-hermes

# Test plan
bun run /path/to/hermes/src/index.ts plan "create a feature branch"

# Test start
bun run /path/to/hermes/src/index.ts start "user authentication"

# Test wip
echo "changes" >> file.txt
bun run /path/to/hermes/src/index.ts wip -m "checkpoint"
```

### Edge Cases to Test

1. **Mid-rebase state**:
   ```bash
   git rebase main
   # Create conflict, then test hermes commands
   ```

2. **Untracked files**:
   ```bash
   echo "new" > untracked.txt
   hermes wip
   ```

3. **Diverged branches**:
   ```bash
   git commit --allow-empty -m "commit 1"
   git reset --hard HEAD~1
   git checkout -b other
   git commit --allow-empty -m "commit 2"
   hermes sync
   ```

4. **No remote tracking**:
   ```bash
   git checkout -b no-upstream
   hermes sync  # Should warn
   ```

## Type Checking

```bash
bun run typecheck
```

Runs TypeScript compiler in check mode (no output).

## Build System

Hermes uses Bun's bundler:

```bash
bun build src/index.ts \
  --outdir dist \
  --target node \
  --format esm
```

This creates a single bundle with all dependencies included.

## Publishing

### 1. Update Version

Edit `package.json`:
```json
{
  "version": "0.2.0"
}
```

### 2. Build

```bash
bun run build
```

### 3. Test Installation

```bash
npm link
hermes --version
```

### 4. Publish to npm

```bash
npm publish
```

Users can then:
```bash
npm install -g hermes-git
hermes plan "create feature"
```

## Common Issues

### Bun Not in PATH

After installing Bun, you need to reload your shell:

```bash
exec $SHELL
# or
export PATH="$HOME/.bun/bin:$PATH"
```

### Copilot CLI Returns Markdown

If Copilot wraps JSON in code blocks:

````markdown
```json
{ "commands": [...] }
```
````

The `stripMarkdownCodeBlock()` function handles this automatically.

### TypeScript Import Errors

Ensure all imports use `.js` extension:

```typescript
// ✅ Correct
import { foo } from './lib/foo.js';

// ❌ Wrong
import { foo } from './lib/foo';
```

This is required for ESM modules.

### Git Command Failures

Always use `executeGitCommand()` wrapper:

```typescript
// ✅ Correct
await executeGitCommand('git checkout main');

// ❌ Wrong
exec('git checkout main'); // No error handling
```

## Code Style

- **Async/Await**: Always use async/await, not callbacks
- **Error Handling**: Try/catch blocks in all command actions
- **Type Safety**: Use TypeScript interfaces, avoid `any`
- **User Output**: Use `console.log()`, not `console.info()`
- **Colors**: Use chalk via display utilities
- **Git Commands**: Always explain WHY before executing

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes
4. Test thoroughly
5. Submit PR with clear description

## Resources

- **Commander.js**: https://github.com/tj/commander.js
- **Chalk**: https://github.com/chalk/chalk
- **Inquirer**: https://github.com/SBoudrias/Inquirer.js
- **Bun**: https://bun.sh/docs
- **Copilot CLI**: See INTEGRATION.md
