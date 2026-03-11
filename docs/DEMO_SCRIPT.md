# Hermes Demo Video Script

**Duration:** ~3-4 minutes
**Target Audience:** Developers who use Git daily
**Goal:** Show how Hermes makes Git safer, faster, and more intuitive

---

## Pre-Demo Setup Checklist

- [ ] Clean terminal with good contrast
- [ ] Font size 16-18pt for readability
- [ ] Terminal recording tool (asciinema, Warp, or screen recorder)
- [ ] Demo repository prepared (see DEMO_SETUP.md)
- [ ] Hermes installed and working (`hermes --version`)
- [ ] GitHub Copilot CLI authenticated
- [ ] Practice run completed

---

## Video Structure

### Scene 1: The Problem (0:00 - 0:30)

**Visual:** Terminal with failed Git commands, merge conflicts

**Narration:**
> "Git is powerful, but unforgiving. Even experienced developers regularly rebase the wrong branch, panic during merge conflicts, or forget what state their repository is in."

**Screen:**
```bash
# Show typical Git confusion
git status
# (show confusing output with detached HEAD or mid-rebase)

git log --oneline --graph
# (show complex branch history)
```

**Transition:** "What if Git could just... understand what you want to do?"

---

### Scene 2: Introducing Hermes (0:30 - 0:50)

**Visual:** Clean terminal, Hermes logo/banner

**Narration:**
> "Meet Hermes - your AI-powered guide for safe, explainable Git operations. Turn natural language into Git commands you can trust."

**Screen:**
```bash
hermes --help

# Show clean, organized command list
```

**Key Callout:** "Powered by GitHub Copilot CLI"

---

### Scene 3: Quick Setup (0:50 - 1:10)

**Visual:** Initialize a project

**Narration:**
> "Getting started takes 10 seconds."

**Screen:**
```bash
# Navigate to a project
cd my-awesome-project

# Initialize Hermes
hermes init --quick

# Output shows:
# ✓ Project context saved
# ✓ Branch patterns configured
# ✓ Ready to use!
```

**Key Point:** "Configuration is shareable - commit `.hermes/config.json` for your whole team."

---

### Scene 4: Feature #1 - Safe Branch Creation (1:10 - 1:40)

**Visual:** Creating a new feature branch

**Narration:**
> "No more remembering branch naming conventions or which branch to start from."

**Screen:**
```bash
# The old way
git checkout main
git pull
git checkout -b feature/user-authentication-refactor

# The Hermes way
hermes start "user authentication refactor"

# Output:
# 🔍 Analyzing repository...
# ✓ Base branch: main (up to date)
# ✓ Created: feature/user-authentication-refactor
# ✓ Switched to new branch
# ⏱️  Time saved: ~45 seconds
```

**Key Point:** "Hermes follows your team's conventions automatically."

---

### Scene 5: Feature #2 - Intelligent Sync (1:40 - 2:20)

**Visual:** Syncing a feature branch with main

**Narration:**
> "Bringing your branch up to date shouldn't require a PhD in Git."

**Screen:**
```bash
# Make some commits
git add .
git commit -m "Add login endpoint"

# Meanwhile, main has moved ahead
# (show this with git log)

# The Hermes way
hermes sync

# Output:
# 🔍 Analyzing repository state...
#
# 📋 Recommended Strategy: REBASE
#
# Why rebase?
# • Your branch is local-only (no remote tracking)
# • Working directory is clean
# • Linear history is preferred
#
# ✓ Fetched latest changes
# ✓ Rebased onto origin/main
# ✓ Your branch is now up to date
```

**Key Point:** "Hermes explains *why* it chooses rebase vs merge."

---

### Scene 6: Feature #3 - Conflict Resolution (2:20 - 2:50)

**Visual:** Handling merge conflicts

**Narration:**
> "Merge conflicts are inevitable. Understanding them doesn't have to be."

**Screen:**
```bash
# Create a conflict scenario
hermes sync
# (conflict occurs)

# Explain what happened
hermes conflict explain

# Output:
# ⚔️  Conflicts detected in 2 files:
#   • src/auth/login.ts
#   • src/auth/types.ts
#
# 🔍 Analysis:
# main refactored authentication to use async/await,
# while your branch updated error handling with try-catch.
#
# Both changes are valid. Suggested resolution:
# 1. Keep async/await structure from main
# 2. Integrate your error handling improvements
#
# Run `hermes conflict apply` for guided resolution

# Apply fixes
hermes conflict apply

# Shows interactive prompts for each file
```

**Key Point:** "AI explains both sides - make informed decisions."

---

### Scene 7: Feature #4 - Analytics & Efficiency (2:50 - 3:20)

**Visual:** Show productivity stats

**Narration:**
> "Hermes tracks exactly how much time you save."

**Screen:**
```bash
hermes stats

# Output:
# ╔══════════════════════════════════════════════════════╗
# ║  Hermes Efficiency Report - Last 30 Days           ║
# ╚══════════════════════════════════════════════════════╝
#
# ⏱️  Time Saved:        12.4 hours
# 🚀  Commands Run:      847 → 123 (85% reduction)
# 📈  Efficiency Gain:   +34% compared to raw Git
# 🔥  Streak:            14 days
#
# 📊 Most Used Commands:
#   1. hermes start      (47 times)
#   2. hermes sync       (31 times)
#   3. hermes wip        (28 times)
```

**Key Point:** "Real metrics, real productivity gains."

---

### Scene 8: Feature #5 - Workflow Shortcuts (3:20 - 3:45)

**Visual:** One-command workflows

**Narration:**
> "Common Git patterns, compressed into single commands."

**Screen:**
```bash
# Morning routine
hermes workflow daily-sync
# → Fetches all, shows status, suggests next actions

# Ready for PR
hermes workflow pr-ready
# → Syncs, rebases, pushes with --force-with-lease

# List all shortcuts
hermes workflow list

# Output shows custom team workflows
```

**Key Point:** "Turn 10+ commands into 1."

---

### Scene 9: The Philosophy (3:45 - 4:00)

**Visual:** Side-by-side comparison or text overlay

**Narration:**
> "Hermes never hides Git. Every action is explained before execution. Safety first, always."

**Screen:**
```text
3 Core Principles:
✓ Never Hide Git
✓ Never Surprise the User
✓ Never Trade Safety for Speed
```

---

### Scene 10: Call to Action (4:00 - 4:15)

**Visual:** Installation command, GitHub repo

**Narration:**
> "Ready to make Git safer and faster? Install Hermes in 10 seconds."

**Screen:**
```bash
npm install -g hermes-git

# Or with bun
bun install -g hermes-git

hermes init
hermes --help
```

**Text Overlay:**
```
github.com/simandebvu/hermes-cli
MIT License | Free to use
Requires: GitHub Copilot subscription
```

---

## Filming Tips

### Terminal Setup
- **Color scheme:** Use high contrast (Dracula, Solarized Dark, or Nord)
- **Font:** Use a monospace font (JetBrains Mono, Fira Code)
- **Size:** 16-18pt minimum for video
- **Width:** 100-120 columns max (keep it readable)
- **Clear scrollback** before each scene

### Pacing
- **Pause 2-3 seconds** after each command output
- **Highlight key information** with arrows or circles in post-production
- **Slow down typing** slightly for readability (or type ahead and cut)
- **Add captions** for key terms (rebase, merge, conflict resolution)

### Voice Over
- **Tone:** Confident but friendly
- **Pace:** Medium - not too fast
- **Emphasis:** Highlight "safety", "explainable", "time saved"
- **Energy:** Start high, sustain throughout

### Editing
- **Cut dead time** between commands
- **Zoom in** on important output sections
- **Add text overlays** for key benefits
- **Background music:** Low, subtle (optional)
- **Transitions:** Quick cuts, no fancy effects

---

## B-Roll Ideas (Optional)

If you want to add visual variety:
- Developer struggling with Git GUI
- Terminal output scrolling by too fast
- Split screen: Raw Git vs Hermes
- Graph visualization of Git history
- Time lapse of fixing merge conflicts

---

## Post-Production Checklist

- [ ] Add intro title card (0:00-0:03)
- [ ] Add captions for key terms
- [ ] Highlight important terminal output
- [ ] Add background music (low volume)
- [ ] Include GitHub repo link in description
- [ ] Add chapters/timestamps
- [ ] Export in 1080p or 4K
- [ ] Test audio levels
- [ ] Add end card with links

---

## YouTube Description Template

```
Hermes: Intent-driven Git, guided by AI

Turn natural language into safe, explainable Git operations. Stop memorizing commands and start focusing on code.

🔗 Links:
• GitHub: https://github.com/simandebvu/hermes-cli
• Docs: https://github.com/simandebvu/hermes-cli/tree/main/docs
• Install: npm install -g hermes-git

⏱️ Timestamps:
0:00 - The Problem
0:30 - Introducing Hermes
0:50 - Quick Setup
1:10 - Safe Branch Creation
1:40 - Intelligent Sync
2:20 - Conflict Resolution
2:50 - Analytics & Efficiency
3:20 - Workflow Shortcuts
3:45 - Philosophy
4:00 - Get Started

✨ Features:
• Natural language Git operations
• AI-powered conflict resolution
• Real-time efficiency tracking
• Workflow automation
• Team-shareable configuration
• Safe, explainable actions

🛠️ Requirements:
• Node.js 18+
• Git
• GitHub Copilot subscription

#git #cli #ai #developer #productivity #github #copilot

Made with 🪽 by developers, for developers
```

---

## Alternative: Shorter 60-Second Version

If you need a quick teaser:

**0:00-0:10:** Problem (Git is confusing)
**0:10-0:20:** Solution (Hermes intro + install)
**0:20-0:35:** Quick demo (1 feature - branch creation)
**0:35-0:45:** Key benefit (time saved stats)
**0:45-0:60:** CTA (install command + repo link)

---

## Notes

- **Authenticity matters:** Show real workflows, not contrived examples
- **Focus on pain points:** Developers understand Git struggles
- **Keep it practical:** Every feature should solve a real problem
- **Safety messaging:** Emphasize "explainable" and "safe" throughout
- **Make it relatable:** Use common scenarios (merge conflicts, syncing branches)

---

Good luck with your demo! 🎬
