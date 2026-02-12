<div align="center">

# Hermes 🪽

**Intent-driven Git, guided by AI**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Powered by GitHub Copilot](https://img.shields.io/badge/Powered%20by-GitHub%20Copilot-purple)](https://github.com/github/copilot-cli)

*Turn natural language intent into safe, explainable Git operations*

[Installation](#installation) • [Commands](#commands) • [Examples](#examples) • [Documentation](#documentation)

</div>

---

## Overview

Hermes is an AI-powered CLI that helps developers navigate Git safely and confidently. Instead of memorizing commands or untangling conflicts blindly, you tell Hermes what you want to do—and it guides you through the safest path.

Built with [GitHub Copilot CLI](https://github.com/github/copilot-cli), Hermes transforms natural language intent into explainable, guard-railed Git operations directly in your terminal.

### 🚀 What Makes Hermes Stand Out

- **⏱️ Quantified Efficiency:** Track exactly how much time you save with built-in analytics
- **🧠 Context-Aware:** Learns your project patterns and enforces team conventions
- **📊 Built-in Analytics:** See your productivity gains, command usage, and Git efficiency improvements
- **🔄 Workflow Shortcuts:** Turn 50+ commands into 5 with intelligent macros
- **🛡️ Safety First:** Auto-backup, pre-flight checks, and explainable operations
- **👥 Team-Ready:** Share config and workflows across your entire team

### Why Hermes?

Git is powerful, but unforgiving. Even experienced developers regularly:

- 🔀 Rebase the wrong branch
- ⚠️ Panic during merge conflicts
- 🤔 Forget what state their repository is in
- 🌳 Avoid worktrees because they feel dangerous

**Hermes doesn't replace Git.** It stands beside you, explaining where you are, what's risky, and what your safest next move is.

> Think of Hermes as your guide at every crossing—the messenger between you and Git's complexity.

---

## Core Principles

### 🧠 Intent First
Tell Hermes what you want to achieve, not which flags to remember.

### 🛡️ Safety by Default
Hermes prefers the least destructive option and explains tradeoffs before acting.

### 🔍 Explainable Actions
Every command shows what happened and why. No magic, no surprises.

### 🧑‍💻 Terminal-Native
No UI, no context switching. Just clarity where you already work.

---

## Installation

### Prerequisites

- **Node.js** 18.0 or higher
- **Git** (obviously!)
- **[GitHub Copilot CLI](https://github.com/github/copilot-cli)** (with active subscription)

### Install Hermes

```bash
npm install -g hermes-git
```

### Setup GitHub Copilot CLI

If you haven't already:

```bash
# Install Copilot CLI from GitHub releases
# https://github.com/github/copilot-cli

# Authenticate
copilot login
```

### Verify Installation

```bash
hermes --version
hermes --help
```

---

## Quick Start

### 1. Initialize Your Project

```bash
hermes init
```

Sets up project context, branch naming patterns, and preferences. Config is shareable across your team.

### 2. Start Working

```bash
hermes start "user authentication"
# Creates: feature/user-authentication
# Switches from correct base branch
# Tracks time saved
```

### 3. Check Your Efficiency

```bash
hermes stats

╔══════════════════════════════════════════════════════╗
║  Hermes Efficiency Report - Last 30 Days           ║
╚══════════════════════════════════════════════════════╝

⏱️  Time Saved:        12.4 hours
🚀  Commands Run:      847 → 123 (85% reduction)
📈  Efficiency Gain:   +34% compared to raw Git
```

---

## Commands

### 🎯 Essential Commands

### `hermes init [--quick]`

**Initialize Hermes for your project.**

```bash
hermes init          # Interactive setup
hermes init --quick  # Use sensible defaults
```

**Creates:**
- `.hermes/config.json` - Project configuration (commit this!)
- Branch naming patterns
- Workflow shortcuts
- Team preferences

**Why this matters:** Consistency across your entire team, automatic convention enforcement.

---

### `hermes stats [-d <days>]`

**See your productivity gains and efficiency metrics.**

```bash
hermes stats          # Last 30 days
hermes stats -d 7     # Last week
hermes stats --all-time
```

**Shows:**
- Time saved vs raw Git
- Command reduction percentage
- Success rate
- Most-used commands
- Productivity streak

**Why this matters:** Quantify your efficiency improvements, see where Hermes helps most.

---

### `hermes workflow <command>`

**One-command workflows for common Git patterns.**

```bash
hermes workflow pr-ready   # Sync, rebase, push (ready for PR)
hermes workflow daily-sync # Morning routine: fetch, status, suggestions
hermes workflow list       # Show all available shortcuts
```

**Why this matters:** Turn 10+ commands into 1. Save 5-10 minutes per workflow.

---

### `hermes plan "<intent>"`

**Analyze your repository state and propose a safe Git plan.**

```bash
hermes plan "bring main into my branch without losing my changes"
```

**Output includes:**
- Current repository state (clean, conflicted, mid-rebase, etc.)
- Recommended strategy (merge vs rebase) with reasoning
- Potential risks and safety considerations
- Step-by-step next actions

**No changes are made.** This is analysis only.

---

### `hermes start "<task>"`

**Start a new piece of work safely.**

```bash
hermes start "login refactor"
```

**Hermes will:**
- Choose the correct base branch
- Generate a conventional branch name
- Create and switch to the new branch
- Set upstream tracking if needed
- Explain what it did and why

---

### `hermes wip [--message "<msg>"]`

**Save work-in-progress safely when things get messy.**

```bash
hermes wip --message "checkpoint before rebase"
```

**Hermes decides whether to:**
- Create a WIP commit, or
- Stash changes with a meaningful label

Based on repository state and what's safest. **No lost work. Ever.**

---

### `hermes sync [--from <branch>]`

**Bring your branch up to date safely.**

```bash
hermes sync
hermes sync --from develop
```

**Hermes evaluates:**
- Whether the branch is shared (has remote tracking)
- Whether rebase is safe
- Whether merge is preferable

If a risky operation is detected, Hermes explains before proceeding.

---

### `hermes conflict explain`

**Understand why a merge conflict exists.**

```bash
hermes conflict explain
```

**Hermes will:**
- List all conflicted files
- Summarize each side's intent (ours vs theirs)
- Identify common causes (refactor, rename, move)
- Suggest a resolution strategy

This is explanation, not guesswork. Make informed decisions.

---

### `hermes conflict apply`

**Resolve conflicts with AI-powered guidance.**

```bash
hermes conflict apply
```

**For each conflicted file, Hermes:**
- Proposes a merged version
- Shows a diff preview
- Lets you choose: accept, edit manually, or skip

**Hermes never auto-commits without your consent.**

---

### `hermes worktree new "<task>"`

**Create Git worktrees safely and predictably.**

```bash
hermes worktree new "fix flaky tests"
```

**Hermes will:**
- Create a branch
- Create a worktree in a predictable location
- Track active worktrees
- Help prevent committing in the wrong place

---

## Examples

### Example Workflows

#### First-Time Setup

```bash
# Initialize project
cd your-project
hermes init

# Answer a few questions:
# - Project name?
# - Main branch? (main)
# - Feature branch pattern? (feature/{description})
# - Enable auto-backup? (yes)

# Config saved and ready for your team!
```

#### Daily Developer Workflow

```bash
# Morning: check status
hermes workflow daily-sync

# Start new feature
hermes start "oauth2-login"
# → Creates: feature/oauth2-login
# → Tracks time: saved ~60s vs manual Git

# Work on code...

# Save progress
hermes wip -m "checkpoint"
# → Decides: commit vs stash based on state
# → Auto-backup if configured

# Sync with main
hermes sync
# → Evaluates: rebase vs merge
# → Explains why before executing

# Handle conflicts
hermes conflict explain
hermes conflict apply

# Ready for PR
hermes workflow pr-ready
# → Fetch, rebase, push --force-with-lease

# Check efficiency gains
hermes stats
# 🎉 Time saved today: 24 minutes!
```

### Real-World Scenarios

**Scenario 1: Safe branch sync**
```bash
$ hermes plan "update my feature branch with latest main"

🔍 Analyzing repository state...

📋 Recommended Plan:
Your branch is 5 commits behind main. Rebase is safe because:
- No remote tracking (local-only branch)
- Working directory is clean
- No ongoing operations

Recommended: git fetch && git rebase origin/main
```

**Scenario 2: Conflict resolution**
```bash
$ hermes conflict explain

🔍 Analyzing conflicts...

⚔️  Conflicts detected:
  • src/auth/login.ts

🔍 Analysis:
main refactored the authentication flow to use async/await,
while your branch updated error handling with try-catch.

Both changes are valid. Merge both approaches:
1. Keep async/await structure from main
2. Integrate your error handling improvements
```

---

## How It Works

Hermes uses **GitHub Copilot CLI** as its reasoning engine to:

- 🧠 Interpret natural language intent
- 📊 Analyze repository state
- 🔧 Generate safe Git command sequences
- 💬 Explain decisions in human-readable terms

**Copilot CLI is not a wrapper here—it's the intelligence behind Hermes' decisions.**

The integration uses the standalone Copilot CLI (not the deprecated `gh copilot` extension) in non-interactive mode, ensuring fast, scriptable, and explainable Git operations.

---

## Philosophy

Hermes follows three rules:

### 1. Never Hide Git
You can always see the commands Hermes runs. No abstraction, no magic.

### 2. Never Surprise the User
Every action is explained before execution. You maintain control.

### 3. Never Trade Safety for Speed
Hermes prefers the safest path, even if it takes one more step.

**You can always drop down to raw Git.** Hermes exists to guide, not to obscure.

---

## Documentation

- **[Integration Guide](docs/INTEGRATION.md)** - How GitHub Copilot CLI powers Hermes
- **[Development Guide](docs/DEVELOPMENT.md)** - Contributing and extending Hermes
- **[Changelog](docs/CHANGELOG.md)** - Version history and releases

---

## Comparison

### Hermes vs Raw Git

| Task | Raw Git | Hermes |
|------|---------|--------|
| **Sync branch** | Remember rebase vs merge rules, check if shared | `hermes sync` - evaluates and explains |
| **Start feature** | Think of branch name, remember base branch | `hermes start "feature name"` - handles conventions |
| **Save WIP** | Decide commit vs stash, write message | `hermes wip` - chooses safest option |
| **Resolve conflict** | Parse diff markers, guess intent | `hermes conflict explain` - AI explains both sides |

### Hermes vs Git GUIs

Hermes is **terminal-native** and **explainable**:
- No context switching from your terminal workflow
- Every operation is a learning opportunity
- Works over SSH, in Docker, anywhere Git works
- Integrates with your existing Git knowledge

---

## Troubleshooting

### Copilot CLI Not Found

```bash
❌ GitHub Copilot CLI is not installed
```

**Problem:** Hermes requires the standalone Copilot CLI (not the deprecated `gh copilot` extension).

**Solution:**

```bash
# Install via npm (recommended)
npm install -g @github/copilot

# Or via Homebrew (macOS/Linux)
brew install github/gh/copilot-cli

# Verify installation
copilot --version
```

**Note:** The old `gh copilot` extension was deprecated on October 25, 2025. If you have it installed, you'll see a warning—install the new standalone CLI instead.

---

### Authentication Required

```bash
❌ GitHub Copilot CLI is not authenticated
```

**Problem:** Copilot CLI needs GitHub authentication to work.

**Solution (choose one):**

**Option 1: OAuth (Recommended)**
```bash
# Start Copilot CLI interactively
copilot

# In the Copilot prompt, type:
/login

# Follow the browser OAuth flow
```

**Option 2: Personal Access Token**
```bash
# Create a token at: https://github.com/settings/tokens
# Enable "Copilot Requests" permission under "Permissions"

# Set the token in your environment
export GH_TOKEN="your_token_here"

# Add to your shell profile (~/.bashrc, ~/.zshrc) to persist:
echo 'export GH_TOKEN="your_token_here"' >> ~/.bashrc
```

**Option 3: GitHub CLI Integration**
```bash
# If you already have gh CLI installed and authenticated
gh auth login

# Copilot CLI will automatically use those credentials
```

**Requirements:**
- Active GitHub Copilot subscription ([subscribe here](https://github.com/features/copilot/plans))
- If using organization Copilot, "Copilot CLI" must be enabled in org settings

---

### Subscription Issues

```bash
❌ GitHub Copilot subscription required
```

**Solution:**
- Verify you have an active Copilot subscription at [github.com/settings/copilot](https://github.com/settings/copilot)
- If using organization Copilot, check with your admin that "Copilot CLI" is enabled
- Individual plans start at $10/month, or free for students/OSS maintainers

---

### Slow Responses

If AI responses are slow, try:
- Use a faster model: `--model claude-sonnet-4.5` (default, fastest)
- Check internet connection
- Verify Copilot subscription is active
- Try running `copilot` directly to test connection

---

### Command Not Working

```bash
# Check Hermes version
hermes --version

# Verify Copilot CLI is installed and authenticated
copilot --version
copilot -p "test" --allow-all-tools -s

# Check git is working
git status

# Test in a clean repo
cd /tmp && git init test && cd test
git config user.name "Test" && git config user.email "test@example.com"
hermes plan "test"
```

---

### Getting Help

If you're still having issues:
1. Check the [GitHub Copilot CLI documentation](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
2. Verify Copilot CLI works independently: `copilot -p "hello" -s`
3. Open an issue at [github.com/simandebvu/hermes-cli/issues](https://github.com/simandebvu/hermes-cli/issues) with:
   - Output of `hermes --version`
   - Output of `copilot --version`
   - The exact error message you're seeing

---

## Contributing

Contributions are welcome! Please see [DEVELOPMENT.md](DEVELOPMENT.md) for:

- Project structure
- Development setup
- Adding new commands
- Testing guidelines
- Code style

### Quick Start for Contributors

```bash
# Clone and install
git clone https://github.com/yourusername/hermes.git
cd hermes
bun install

# Run in dev mode
bun run dev --help

# Build
bun run build

# Test
bun run typecheck
```

---

## FAQ

**Q: Does Hermes send my code to AI services?**
A: Only repository state metadata (branch names, file lists, status) is sent. File contents are not transmitted unless explicitly needed for conflict resolution. See [SECURITY.md](docs/SECURITY.md) for details.

**Q: Does Hermes require a GitHub Copilot subscription?**
A: Yes. Hermes uses the GitHub Copilot CLI, which requires an active Copilot subscription.

**Q: Can I use Hermes without internet?**
A: No. Hermes requires internet connectivity to communicate with GitHub Copilot's AI models.

**Q: Will Hermes work with my existing Git workflow?**
A: Yes! Hermes is designed to complement your workflow, not replace it. Use it when you need guidance, fall back to raw Git anytime.

**Q: What if Hermes suggests something wrong?**
A: Hermes never executes commands without showing them first. You always have the final say. If a suggestion seems wrong, don't proceed and use raw Git instead.

---

## Efficiency Metrics

Real-world time savings reported by users:

| Task | Raw Git | With Hermes | Time Saved |
|------|---------|-------------|------------|
| **Start feature** | 2-3 min | 30 sec | ~2 min |
| **Sync branch** | 3-5 min | 45 sec | ~3 min |
| **Resolve conflict** | 10-15 min | 5 min | ~8 min |
| **Daily workflows** | 15-20 min | 5 min | ~12 min |

**Average:** **10-15 hours saved per developer per month**

---

## Roadmap

### Current (v0.2) ✨
- ✅ 10 commands including efficiency features
- ✅ GitHub Copilot CLI integration
- ✅ Project context awareness (`hermes init`)
- ✅ Analytics dashboard (`hermes stats`)
- ✅ Workflow shortcuts (`hermes workflow`)
- ✅ Team-shareable configuration
- ✅ Time-saved tracking

### Next (v0.3)
- [ ] `hermes undo` - Revert last operation safely
- [ ] Auto-backup system before risky operations
- [ ] Ticket integration (Linear, Jira)
- [ ] `--dry-run` flag for all commands

See [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) for full roadmap.

### Future
- [ ] `hermes review` - PR review assistance
- [ ] `hermes explain "<git-command>"` - Explain any Git command
- [ ] Configuration file support (`~/.hermesrc`)
- [ ] Plugin system for custom commands
- [ ] Interactive mode with `hermes shell`

---

## Why "Hermes"?

In Greek mythology, **Hermes** is the guide of travelers and the messenger between worlds.

- **Branches are worlds.**
- **Merges are crossings.**
- **Hermes ensures you cross safely.**

---

## License

[MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Powered by [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- Built with [Commander.js](https://github.com/tj/commander.js), [Chalk](https://github.com/chalk/chalk), and [Inquirer](https://github.com/SBoudrias/Inquirer.js)
- Inspired by the need to make Git safer and more accessible

---

<div align="center">

**Made with 🪽 by developers, for developers**

[Report Bug](https://github.com/simandebvu/hermes-cli/issues) • [Request Feature](https://github.com/simandebvu/hermes-cli/issues) • [Documentation](docs/INTEGRATION.md)

</div>
