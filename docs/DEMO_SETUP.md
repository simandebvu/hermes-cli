# Demo Environment Setup Guide

This guide helps you prepare a clean, reproducible demo environment for recording Hermes videos.

---

## Quick Setup (5 minutes)

```bash
# 1. Create demo workspace
mkdir -p ~/hermes-demo
cd ~/hermes-demo

# 2. Run the setup script
bash setup-demo-repo.sh
```

---

## Manual Setup (Detailed)

### 1. Create Demo Repository

```bash
# Create a new project
mkdir my-awesome-app
cd my-awesome-app
git init
git branch -M main

# Add initial files
cat > README.md << 'EOF'
# My Awesome App

A demo application for Hermes showcase.
EOF

cat > package.json << 'EOF'
{
  "name": "my-awesome-app",
  "version": "1.0.0",
  "description": "Demo app"
}
EOF

mkdir -p src/auth
cat > src/auth/login.ts << 'EOF'
export function login(username: string, password: string) {
  // Basic login implementation
  if (!username || !password) {
    throw new Error('Username and password required');
  }

  return {
    success: true,
    token: 'demo-token'
  };
}
EOF

# Initial commit
git add .
git commit -m "Initial commit: project setup"
```

### 2. Create Realistic Commit History

```bash
# Add more features to main
cat > src/auth/types.ts << 'EOF'
export interface User {
  id: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
}
EOF

git add src/auth/types.ts
git commit -m "Add authentication types"

# Add a config file
cat > src/config.ts << 'EOF'
export const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};
EOF

git add src/config.ts
git commit -m "Add configuration module"

# Create a few more commits
echo "# Development Guide" >> DEVELOPMENT.md
git add DEVELOPMENT.md
git commit -m "Add development documentation"

# Tag current state
git tag v1.0.0
```

### 3. Set Up Remote (Optional but Recommended)

```bash
# If you want to show remote sync features:

# Create a bare repository to simulate remote
cd ~/hermes-demo
git init --bare remote-repo.git

# Add as remote to demo repo
cd my-awesome-app
git remote add origin ~/hermes-demo/remote-repo.git
git push -u origin main

# Or use GitHub
# gh repo create my-awesome-app-demo --public
# git remote add origin https://github.com/YOUR_USERNAME/my-awesome-app-demo.git
# git push -u origin main
```

### 4. Create Scenarios for Demo

#### Scenario A: Feature Branch Workflow

```bash
# This will be used in "Scene 4: Safe Branch Creation"
# Keep main clean for demo - we'll create feature branches during recording
```

#### Scenario B: Sync with Diverged History

```bash
# Make changes on main (to simulate upstream changes)
git checkout main

cat >> README.md << 'EOF'

## Features

- User authentication
- Secure session management
EOF

git add README.md
git commit -m "Update README with features"

# Now when we create a feature branch from earlier commit,
# we can show sync functionality
```

#### Scenario C: Merge Conflict Setup

```bash
# Create a branch that will conflict
git checkout -b feature/conflict-demo main~1

# Modify login.ts differently than main
cat > src/auth/login.ts << 'EOF'
export function login(username: string, password: string) {
  // Updated login with better error handling
  try {
    if (!username || !password) {
      throw new Error('Credentials required');
    }

    // Simulate authentication
    return {
      success: true,
      token: generateToken(username)
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

function generateToken(user: string): string {
  return `token-${user}-${Date.now()}`;
}
EOF

git add src/auth/login.ts
git commit -m "Improve login error handling"

# Go back to main and make conflicting changes
git checkout main

cat > src/auth/login.ts << 'EOF'
export async function login(username: string, password: string) {
  // Refactored to async/await
  if (!username || !password) {
    throw new Error('Username and password required');
  }

  const response = await authenticateUser(username, password);

  return {
    success: true,
    token: response.token
  };
}

async function authenticateUser(user: string, pass: string) {
  // Simulate async authentication
  return { token: `async-token-${Date.now()}` };
}
EOF

git add src/auth/login.ts
git commit -m "Convert login to async/await"

# Now feature/conflict-demo will conflict when synced with main
```

### 5. Initialize Hermes

```bash
# Go back to main for clean demo start
git checkout main

# Initialize Hermes with demo config
hermes init --quick

# Or do interactive setup:
hermes init
# Project name: My Awesome App
# Main branch: main
# Feature pattern: feature/{description}
# Enable auto-backup: yes
```

---

## Recording Checklist

### Terminal Setup

```bash
# Set PS1 to clean prompt
export PS1="$ "

# Or use a custom prompt
export PS1="\[\e[36m\]\w\[\e[0m\] $ "

# Clear terminal
clear

# Set terminal size (consistent for recording)
printf '\e[8;30;120t'

# Optional: Use 'asciinema' for terminal recording
asciinema rec hermes-demo.cast
```

### Font & Colors

- **Terminal:** iTerm2, Warp, or Hyper
- **Color Scheme:** Dracula, One Dark, or Nord
- **Font:** JetBrains Mono, Fira Code, or SF Mono
- **Font Size:** 16-18pt
- **Line Height:** 1.2-1.3

### Test Run

```bash
# Test each command before recording
hermes --version
hermes --help
hermes init --quick
hermes start "test feature"
hermes stats
hermes workflow list

# Make sure everything works
git status
git log --oneline
```

---

## Recording Script

### Scene-by-Scene Setup

#### Before Scene 4 (Safe Branch Creation)
```bash
git checkout main
git pull  # if using remote
clear
```

#### Before Scene 5 (Intelligent Sync)
```bash
# Make sure main has moved ahead
git checkout main
echo "\n## Updates" >> README.md
git add README.md
git commit -m "Update README"

# Create feature branch from earlier point
git checkout -b feature/demo main~2
echo "// Feature work" >> src/auth/login.ts
git add src/auth/login.ts
git commit -m "Work on feature"

clear
```

#### Before Scene 6 (Conflict Resolution)
```bash
git checkout feature/conflict-demo
clear
```

#### Before Scene 7 (Analytics)
```bash
# Generate some usage data (run commands)
hermes start "feature-1"
hermes start "feature-2"
hermes wip -m "checkpoint"
# etc.

git checkout main
clear
```

---

## Helper Script: Reset Demo State

Save this as `reset-demo.sh`:

```bash
#!/bin/bash

# Reset demo repository to clean state

cd ~/hermes-demo/my-awesome-app

# Remove all feature branches
git branch | grep -v "main" | xargs git branch -D 2>/dev/null

# Reset to main
git checkout main

# Clean working directory
git reset --hard HEAD
git clean -fd

# Clear Hermes stats (optional)
rm -rf .hermes/analytics.json

# Clear terminal
clear

echo "✓ Demo environment reset"
echo "✓ On branch: $(git branch --show-current)"
echo "✓ Working directory clean"
echo ""
echo "Ready to record!"
```

Make it executable:
```bash
chmod +x reset-demo.sh
```

---

## Quick Commands Reference (for demo)

Keep this handy while recording:

```bash
# Setup
cd ~/hermes-demo/my-awesome-app
git checkout main
clear

# Scene 4: Start feature
hermes start "user authentication refactor"

# Scene 5: Sync
hermes sync

# Scene 6: Conflicts
hermes conflict explain
hermes conflict apply

# Scene 7: Stats
hermes stats

# Scene 8: Workflows
hermes workflow daily-sync
hermes workflow pr-ready
hermes workflow list

# Reset between takes
./reset-demo.sh
```

---

## Troubleshooting

### Terminal recording looks blurry
- Increase font size to 18pt
- Use retina display
- Record at 1080p or higher

### Commands are too fast
- Add `sleep 2` between commands
- Type commands manually (slower)
- Use asciinema with playback speed control

### Hermes not responding
- Check `copilot --version`
- Run `copilot login` if needed
- Verify internet connection

### Git state is messy
- Run `./reset-demo.sh`
- Start from clean main branch
- Clear working directory

---

## Post-Recording

### Export asciinema to video
```bash
# Using agg (asciinema gif generator)
agg hermes-demo.cast hermes-demo.gif

# Or convert to mp4 using docker
docker run --rm -v $PWD:/data asciinema/asciicast2gif \
  -S 2 hermes-demo.cast hermes-demo.gif
```

### Clean up
```bash
# Remove demo workspace (optional)
rm -rf ~/hermes-demo

# Or keep for future recordings
```

---

Good luck with your recording! 🎥
