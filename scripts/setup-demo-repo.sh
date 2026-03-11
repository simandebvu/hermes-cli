#!/bin/bash

# Hermes Demo Repository Setup Script
# Creates a realistic demo environment for video recording

set -e

DEMO_DIR="$HOME/hermes-demo"
REPO_NAME="my-awesome-app"
REPO_PATH="$DEMO_DIR/$REPO_NAME"

echo "🪽 Setting up Hermes demo environment..."
echo ""

# Create demo directory
mkdir -p "$DEMO_DIR"
cd "$DEMO_DIR"

# Check if demo repo already exists
if [ -d "$REPO_PATH" ]; then
  echo "⚠️  Demo repository already exists at $REPO_PATH"
  read -p "Delete and recreate? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$REPO_PATH"
  else
    echo "Aborted."
    exit 1
  fi
fi

# Create repository
echo "📁 Creating repository: $REPO_NAME"
mkdir -p "$REPO_PATH"
cd "$REPO_PATH"
git init
git branch -M main

# Create initial files
echo "📝 Adding initial files..."

cat > README.md << 'EOF'
# My Awesome App

A demo application for Hermes showcase.

## Getting Started

This is a sample project to demonstrate Git workflows.
EOF

cat > package.json << 'EOF'
{
  "name": "my-awesome-app",
  "version": "1.0.0",
  "description": "Demo app for Hermes",
  "main": "index.js",
  "scripts": {
    "start": "node src/index.js"
  }
}
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
EOF

# Create source files
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

cat > src/config.ts << 'EOF'
export const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
EOF

cat > src/index.ts << 'EOF'
import { login } from './auth/login';
import { config } from './config';

console.log('App started');
console.log('Config:', config);
EOF

# Initial commit
git add .
git commit -m "Initial commit: project setup"

# Add more commits for realistic history
echo "🔨 Building commit history..."

echo -e "\n## Features\n\n- User authentication" >> README.md
git add README.md
git commit -m "docs: add features section"

echo "# Development Guide" > DEVELOPMENT.md
echo "## Setup" >> DEVELOPMENT.md
git add DEVELOPMENT.md
git commit -m "docs: add development guide"

cat >> src/config.ts << 'EOF'

export const isDevelopment = process.env.NODE_ENV === 'development';
EOF
git add src/config.ts
git commit -m "feat: add development mode flag"

# Create scenario for conflict demo
echo "⚔️  Setting up conflict scenario..."

# Create feature branch that will conflict
git checkout -b feature/conflict-demo HEAD~1

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
  return \`token-\${user}-\${Date.now()}\`;
}
EOF

git add src/auth/login.ts
git commit -m "feat: improve login error handling"

# Back to main, make conflicting changes
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
    token: response.token,
    user: response.user
  };
}

async function authenticateUser(user: string, pass: string) {
  // Simulate async authentication
  return {
    token: \`async-token-\${Date.now()}\`,
    user: { id: '1', username: user, email: \`\${user}@example.com\` }
  };
}
EOF

git add src/auth/login.ts
git commit -m "refactor: convert login to async/await"

# Create a few more branches for demo
echo "🌿 Creating feature branches..."

git checkout -b feature/add-logout main
cat > src/auth/logout.ts << 'EOF'
export function logout() {
  // Clear session
  return { success: true };
}
EOF
git add src/auth/logout.ts
git commit -m "feat: add logout function"

git checkout main

# Set up remote (optional)
if command -v gh &> /dev/null; then
  echo ""
  read -p "📡 Create GitHub remote? (requires gh CLI) (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh repo create "$REPO_NAME-demo" --public --source=. --remote=origin --push || echo "⚠️  GitHub repo creation failed (might already exist)"
  fi
else
  echo "💡 Tip: Install 'gh' CLI to create GitHub remotes automatically"
fi

# Initialize Hermes
echo ""
echo "🪽 Initializing Hermes..."

if command -v hermes &> /dev/null; then
  # Check if hermes init supports --quick flag
  hermes init --quick 2>/dev/null || {
    echo "Run 'hermes init' manually after setup"
  }
else
  echo "⚠️  Hermes not found. Install with: npm install -g hermes-git"
  echo "Then run: hermes init"
fi

# Create reset script
echo "🔄 Creating reset script..."

cat > "$REPO_PATH/reset-demo.sh" << 'RESET_SCRIPT'
#!/bin/bash

# Reset demo to clean state for recording

echo "🔄 Resetting demo environment..."

# Remove all feature branches except preset ones
git branch | grep -v -E "main|feature/conflict-demo|feature/add-logout" | xargs git branch -D 2>/dev/null

# Go back to main
git checkout main 2>/dev/null || git checkout -b main

# Clean working directory
git reset --hard HEAD
git clean -fd

# Clear Hermes analytics (optional)
# rm -rf .hermes/analytics.json

clear

echo "✅ Demo reset complete!"
echo ""
echo "📊 Repository status:"
git log --oneline --graph --all --decorate -n 5
echo ""
echo "🌿 Available branches:"
git branch
echo ""
echo "🎬 Ready to record!"
RESET_SCRIPT

chmod +x "$REPO_PATH/reset-demo.sh"

# Print summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Demo environment ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Location: $REPO_PATH"
echo ""
echo "🌿 Branches created:"
echo "   • main (clean history)"
echo "   • feature/conflict-demo (will conflict with main)"
echo "   • feature/add-logout (clean feature branch)"
echo ""
echo "📝 Next steps:"
echo "   1. cd $REPO_PATH"
echo "   2. Review docs/DEMO_SCRIPT.md for recording guide"
echo "   3. Run ./reset-demo.sh between takes"
echo ""
echo "🎬 Happy recording!"
echo ""
