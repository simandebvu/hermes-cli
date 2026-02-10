# Changelog

All notable changes to Hermes will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-10

### Added - Efficiency Features 🚀

#### Project Context (`hermes init`)
- **Context-aware configuration** for project-specific workflows
- Interactive setup wizard for team patterns
- Branch naming conventions (feature/bugfix/hotfix patterns)
- Protected branches configuration
- Learning mode toggle
- Auto-backup preferences
- Shareable `.hermes/config.json` for team consistency

#### Statistics Dashboard (`hermes stats`)
- **Time-saved tracking** - quantify your efficiency gains
- Command usage analytics
- Success rate monitoring
- Top commands breakdown
- Productivity streak tracking
- Weekly/monthly projections
- Estimated efficiency improvement percentage

#### Workflow Shortcuts (`hermes workflow`)
- **`pr-ready`** - One command to sync, rebase, and push for PR
- **`daily-sync`** - Morning routine: fetch, show status, suggest actions
- **`quick-commit`** - Fast staging and committing with AI message generation
- **`list`** - Show all available workflow shortcuts
- Custom workflow support via config

#### Developer Experience
- **Config-aware branch naming** - automatic pattern enforcement
- **Learning mode** - optional explanations with every command
- **Stats tracking** - every command is measured and tracked
- **Estimated time savings** - see your productivity gains
- **Team standardization** - share config across projects

### Enhanced
- `hermes start` now uses project config for branch naming
- All commands now track execution stats
- Better error messages with context
- Improved TypeScript types throughout

### Documentation
- Added `PRODUCT_VISION.md` - strategic roadmap
- Added `CHANGELOG.md` - version history
- Updated README with new features
- Enhanced INTEGRATION.md with latest patterns

### Developer
- New `src/lib/config.ts` - configuration management
- New `src/lib/stats.ts` - analytics tracking
- Better code organization and reusability

---

## [0.1.0] - 2026-02-10

### Added - Initial Release 🎉

#### Core Commands
- **`hermes plan`** - Analyze repo state and propose safe Git plans
- **`hermes start`** - Start new work with smart branch creation
- **`hermes wip`** - Save work-in-progress safely (commit vs stash)
- **`hermes sync`** - Sync branch safely (rebase vs merge decision)
- **`hermes conflict explain`** - AI-powered conflict analysis
- **`hermes conflict apply`** - Guided conflict resolution
- **`hermes worktree new`** - Safe worktree management

#### Integration
- **GitHub Copilot CLI integration** - uses Claude Sonnet 4.5 by default
- Non-interactive mode for automation
- Silent mode for clean output
- Automatic markdown code block parsing

#### Safety Features
- Preview commands before execution
- Read-only analysis commands
- Explainable AI suggestions
- No hidden operations
- User always has final say

#### Documentation
- Professional README with examples
- Integration guide (INTEGRATION.md)
- Development guide (DEVELOPMENT.md)
- Security policy (SECURITY.md)
- MIT License

#### Infrastructure
- TypeScript codebase
- Bun build system
- Commander.js CLI framework
- Chalk for beautiful terminal output
- Inquirer for interactive prompts

### Technical
- Comprehensive repo state detection
- Git command execution wrapper
- Display utilities for consistent output
- Error handling throughout
- 7 core commands fully functional

---

## [Unreleased]

See [PRODUCT_VISION.md](PRODUCT_VISION.md) for planned features.

### Planned for 0.3.0
- `hermes undo` - Revert last operation
- Auto-backup system before risky operations
- Ticket system integration (Linear, Jira)
- Enhanced analytics with charts

### Future
- IDE extensions (VSCode, JetBrains)
- Team collaboration features
- CI/CD integration
- Remote sync server
- Plugin system

---

## Links
- [Product Vision](PRODUCT_VISION.md)
- [Contributing](DEVELOPMENT.md)
- [Security](SECURITY.md)
