<div align="center">

# Hermes 🪽

**Intent-driven Git, guided by AI**

[![npm version](https://img.shields.io/npm/v/hermes-git.svg)](https://www.npmjs.com/package/hermes-git)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

*Turn natural language intent into safe, explainable Git operations*

[Installation](#installation) • [Quick Start](#quick-start) • [Commands](#commands) • [Configuration](#configuration)

</div>

---

## What it does

Hermes is a CLI that translates what you want to do in Git into the correct, safe sequence of commands — and explains every step.

```bash
hermes start "add oauth login"
# → Picks the right base branch
# → Creates feature/add-oauth-login
# → Switches and sets upstream

hermes sync
# → Evaluates rebase vs merge based on your branch state
# → Explains the tradeoff before doing anything

hermes conflict explain
# → Reads the conflict markers
# → Explains what each side was trying to do
# → Suggests a resolution strategy

hermes wip
# → Decides commit vs stash based on your repo state
# → Saves your work safely
```

No magic. Every command shows exactly what git operations it runs.

Run `hermes` with no arguments to see the full command reference and available workflows.

---

## Installation

```bash
npm install -g hermes-git
```

**Requires:** Node.js 18+, Git

### Set up your AI provider

Hermes works with Anthropic, OpenAI, or Google Gemini — bring your own API key.

```bash
hermes config setup
```

This walks you through selecting a provider and saving your key to `~/.config/hermes/config.json` (chmod 600).

Or set it manually:

```bash
# Anthropic (Claude)
hermes config set provider anthropic
hermes config set anthropic-key sk-ant-...

# OpenAI (GPT-4o)
hermes config set provider openai
hermes config set openai-key sk-...

# Google Gemini
hermes config set provider gemini
hermes config set gemini-key AIza...
```

Verify:

```bash
hermes config list
```

---

## Quick Start

```bash
# 1. Install and configure
npm install -g hermes-git
hermes config setup

# 2. Initialize your project (optional — enables team config sharing)
cd your-project
hermes init

# 3. Start working
hermes start "user authentication"
```

---

## Commands

### `hermes update`

Update hermes to the latest version.

```bash
hermes update           # check and install if a newer version exists
hermes update --check   # check only, don't install
```

Auto-detects your package manager (npm, bun, or pnpm).

---

### `hermes config`

Manage API keys and provider settings.

```bash
hermes config setup              # interactive wizard
hermes config list               # show current config (keys masked, sources shown)
hermes config set provider openai
hermes config set openai-key sk-...
hermes config get provider
hermes config unset gemini-key
```

Config is stored in `~/.config/hermes/config.json`. You can also use environment variables or a `.env` file — see [Configuration](#configuration).

---

### `hermes guard`

Scan staged files for secrets and sensitive content before committing.

```bash
hermes guard
```

Scans every staged file for:

- **Sensitive filenames** — `.env`, `id_rsa`, `*.pem`, `credentials.json`, `google-services.json`, etc.
- **API keys** — Anthropic, OpenAI, Google, AWS, GitHub, Stripe, SendGrid, Twilio
- **Private key headers** — `-----BEGIN PRIVATE KEY-----` and variants
- **Database URLs** with embedded credentials — `postgres://user:pass@host`
- **Hardcoded passwords/tokens** — common assignment patterns

Findings are categorised as `BLOCKED` (definite secret) or `WARN` (suspicious). The AI explains each finding and what to do about it, then you choose: abort, unstage the flagged files, or proceed anyway.

```
  BLOCKED  src/config.ts
           ● Anthropic API key  line 12
             apiKey: "sk-a...****",
             Rotate at: https://console.anthropic.com/settings/keys

  What this means:
  This key gives anyone with repo access full billing access to your
  Anthropic account. Rotate it immediately and load it from an
  environment variable instead.

  ? Blocked secrets found. What do you want to do?
  ❯ Abort — I will fix these before committing
    Unstage the flagged files and continue
    Proceed anyway (I know what I'm doing)
```

**Install as a git pre-commit hook** so it runs automatically on every commit:

```bash
hermes guard install-hook    # installs to .git/hooks/pre-commit
hermes guard uninstall-hook  # removes it
```

In hook mode the scan is non-interactive: prints findings to stderr and exits 1 on any blocker.

---

### `hermes plan "<intent>"`

Analyze repo state and propose a safe Git plan. **Makes no changes.**

```bash
hermes plan "bring main into my branch without losing my work"
hermes plan "clean up before submitting a PR"
```

---

### `hermes start "<task>"`

Start a new piece of work safely.

```bash
hermes start "payment refactor"
# → Picks correct base branch
# → Creates and switches to feature/payment-refactor
```

---

### `hermes sync [--from <branch>]`

Bring your branch up to date.

```bash
hermes sync
hermes sync --from develop
```

Evaluates whether rebase or merge is safer given your branch state and explains before executing.

---

### `hermes wip [-m "<message>"]`

Save work in progress.

```bash
hermes wip
hermes wip -m "checkpoint before sync"
```

Decides commit vs stash based on what's safest in your current state.

---

### `hermes conflict explain`

Understand why a conflict exists.

```bash
hermes conflict explain
```

For each conflicted file: what each side was doing, why they conflict, and how to approach resolution.

---

### `hermes conflict apply`

Resolve conflicts file by file with AI assistance.

```bash
hermes conflict apply
```

For each file: shows a proposed resolution, lets you accept, edit manually, or skip. Never auto-commits.

---

### `hermes workflow <name>`

One-command workflows for common patterns. Available workflows are shown when you run `hermes` with no arguments.

```bash
hermes workflow pr-ready      # fetch → rebase → push --force-with-lease
hermes workflow daily-sync    # fetch all → show status → suggest next action
hermes workflow quick-commit  # generate commit message from staged diff
hermes workflow list          # show all workflows including project-specific
```

Define project-specific workflows in `.hermes/config.json` and they appear automatically in the help output.

---

### `hermes worktree new "<task>"`

Create a Git worktree safely.

```bash
hermes worktree new "fix memory leak"
# → Creates branch, worktree at ../repo-fix-memory-leak
```

---

### `hermes init [--quick]`

Initialize project-level config (`.hermes/config.json`). Commit this to share branch patterns and workflows with your team.

```bash
hermes init         # interactive
hermes init --quick # use defaults
```

---

### `hermes stats [-d <days>]`

Show command usage and success rate.

```bash
hermes stats
hermes stats -d 7
hermes stats --all-time
```

---

## Configuration

Hermes resolves config in this priority order:

| Source | Example |
|--------|---------|
| Environment variable | `export ANTHROPIC_API_KEY=sk-ant-...` |
| `.env` file in current dir | `ANTHROPIC_API_KEY=sk-ant-...` |
| `~/.config/hermes/config.json` | set via `hermes config set` |

Environment variables always win — useful for CI and Docker environments where you don't want a config file.

**Supported env vars:**

| Variable | Description |
|----------|-------------|
| `HERMES_PROVIDER` | Pin provider: `anthropic`, `openai`, or `gemini` |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Google Gemini API key |

If `HERMES_PROVIDER` is not set, Hermes auto-detects by using whichever key it finds first (Anthropic → OpenAI → Gemini).

**Supported providers and models:**

| Provider | Model | Get a key |
|----------|-------|-----------|
| Anthropic | claude-sonnet-4-6 | [console.anthropic.com](https://console.anthropic.com/) |
| OpenAI | gpt-4o | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Google | gemini-2.5-flash | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |

---

## How it works

1. **Reads your repo state** — branch, commits, dirty files, conflicts, remote tracking
2. **Sends context + intent to an AI** — using your configured provider
3. **Validates the response** — all returned commands must start with `git`; destructive flags are blocked
4. **Executes with display** — shows every command before running it
5. **You stay in control** — interactive prompts for anything irreversible

---

## Philosophy

**Never hide Git.** Every command Hermes runs is shown. You can drop to raw Git at any point.

**Never surprise.** Risky operations include an explanation before execution.

**Bring your own AI.** No proprietary backend. Works with any provider you already pay for.

---

## Troubleshooting

**No AI provider configured**

```bash
hermes config setup
```

**Wrong provider being used**

```bash
hermes config set provider anthropic
hermes config list   # check sources — env vars override saved config
```

**Key set but not working**

```bash
hermes config list   # shows value and where it came from (env / .env / config)
```

**Update to latest**

```bash
hermes update
```

---

## Contributing

```bash
git clone https://github.com/simandebvu/hermes-cli.git
cd hermes-cli
bun install
bun run dev --help
bun run build
bun run typecheck
```

Issues and PRs welcome at [github.com/simandebvu/hermes-cli](https://github.com/simandebvu/hermes-cli).

---

## Why "Hermes"?

In Greek mythology, Hermes guides travelers and carries messages between worlds. Branches are worlds. Merges are crossings. Hermes makes sure you get there safely.

---

## License

[MIT](LICENSE)

---

<div align="center">

**Built with [Commander.js](https://github.com/tj/commander.js), [Chalk](https://github.com/chalk/chalk), [Inquirer](https://github.com/SBoudrias/Inquirer.js)**

[Report a bug](https://github.com/simandebvu/hermes-cli/issues) • [Request a feature](https://github.com/simandebvu/hermes-cli/issues)

</div>
