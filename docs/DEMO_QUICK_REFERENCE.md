# Demo Quick Reference Card

**Keep this open while recording - copy/paste commands quickly!**

---

## Pre-Flight Check ✓

```bash
# Terminal setup
export PS1="$ "
clear
cd ~/hermes-demo/my-awesome-app
git checkout main
git status
```

---

## Scene 1: The Problem (0:00-0:30)

```bash
git status
git log --oneline --graph --all -n 10
git branch -a
```

**Narration:** "Git is powerful but unforgiving..."

---

## Scene 2: Intro (0:30-0:50)

```bash
clear
hermes --help
```

**Narration:** "Meet Hermes - your AI-powered Git guide..."

---

## Scene 3: Setup (0:50-1:10)

```bash
clear
cd ~/hermes-demo/my-awesome-app
hermes init --quick
```

**Narration:** "Getting started takes 10 seconds..."

---

## Scene 4: Safe Branch Creation (1:10-1:40)

```bash
clear
# Show the old way (DON'T RUN, just show as text)
# git checkout main
# git pull
# git checkout -b feature/user-authentication-refactor

# Now the Hermes way
hermes start "user authentication refactor"

# Verify
git branch
```

**Narration:** "No more remembering branch conventions..."

---

## Scene 5: Intelligent Sync (1:40-2:20)

```bash
# Setup (do this before recording this scene)
git checkout -b feature/sync-demo main~2
echo "// New feature code" >> src/auth/login.ts
git add .
git commit -m "Add feature code"

# Record from here
clear
git log --oneline main..HEAD
git log --oneline HEAD..main

hermes sync

# Show result
git log --oneline --graph -n 5
```

**Narration:** "Syncing shouldn't require a PhD in Git..."

---

## Scene 6: Conflict Resolution (2:20-2:50)

```bash
# Setup
git checkout feature/conflict-demo
clear

# Try to sync (will create conflict)
hermes sync

# Explain the conflict
hermes conflict explain

# Apply resolution
hermes conflict apply

# Follow interactive prompts
```

**Narration:** "Conflicts are inevitable. Understanding them isn't..."

---

## Scene 7: Analytics (2:50-3:20)

```bash
clear
hermes stats

# If stats are empty, generate some:
# hermes start "test-1"
# hermes start "test-2"
# hermes wip -m "test"
# Then run stats again
```

**Narration:** "Hermes tracks exactly how much time you save..."

---

## Scene 8: Workflows (3:20-3:45)

```bash
clear

# Show workflows
hermes workflow list

# Run a workflow
hermes workflow daily-sync

# Another workflow
hermes workflow pr-ready
```

**Narration:** "Common patterns, compressed into single commands..."

---

## Scene 9: Philosophy (3:45-4:00)

```bash
clear
# Just text overlay - no commands needed
```

**Text on screen:**
```
3 Core Principles:
✓ Never Hide Git
✓ Never Surprise the User
✓ Never Trade Safety for Speed
```

**Narration:** "Hermes never hides Git. Every action is explained..."

---

## Scene 10: Call to Action (4:00-4:15)

```bash
clear

# Show installation
echo "npm install -g hermes-git"
echo ""
echo "# Or with bun"
echo "bun install -g hermes-git"
echo ""
hermes --version
```

**Narration:** "Ready to make Git safer? Install in 10 seconds..."

---

## Reset Between Takes

```bash
cd ~/hermes-demo/my-awesome-app
./reset-demo.sh
```

---

## Emergency Commands

```bash
# Clean everything
git reset --hard HEAD
git clean -fd

# Go back to main
git checkout main

# Clear terminal
clear

# Check Hermes
hermes --version
copilot --version

# Check Git status
git status
git log --oneline -n 5
git branch
```

---

## Terminal Settings Checklist

- [ ] Font: 16-18pt
- [ ] Prompt: `export PS1="$ "`
- [ ] Size: 100-120 columns, 30 rows
- [ ] Colors: High contrast theme
- [ ] Clear scrollback before each scene
- [ ] Test recording visibility

---

## Recording Tips

- **Pause 2 seconds** after each output
- **Clear terminal** between scenes (`clear`)
- **Check git status** before commands
- **Slow down** - viewers need time to read
- **Speak clearly** - emphasize key words
- **Test audio** before long takes

---

## Common Issues

**Command not found:**
```bash
which hermes
npm list -g hermes-git
```

**Git state is wrong:**
```bash
./reset-demo.sh
```

**Hermes not responding:**
```bash
copilot --version
copilot login
```

**Output too long:**
```bash
# Use head/tail to limit
git log --oneline -n 5
```

---

## Post-Scene Cleanup

```bash
# After each scene
git status  # Verify state
clear       # Clear for next scene
```

---

## Time Codes (4 minute version)

- 0:00 - Problem intro
- 0:30 - Hermes intro
- 0:50 - Quick setup
- 1:10 - Feature #1 (branches)
- 1:40 - Feature #2 (sync)
- 2:20 - Feature #3 (conflicts)
- 2:50 - Feature #4 (analytics)
- 3:20 - Feature #5 (workflows)
- 3:45 - Philosophy
- 4:00 - CTA / Install

---

## Copy-Paste Commands (All Scenes)

Scene 4:
```
hermes start "user authentication refactor"
```

Scene 5:
```
hermes sync
```

Scene 6:
```
hermes conflict explain
hermes conflict apply
```

Scene 7:
```
hermes stats
```

Scene 8:
```
hermes workflow list
hermes workflow daily-sync
hermes workflow pr-ready
```

Scene 10:
```
npm install -g hermes-git
hermes init
```

---

Good luck! 🎬🪽
