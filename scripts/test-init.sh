#!/bin/bash

# Test script for hermes init in different scenarios
set -e

HERMES_BIN="$(pwd)/dist/index.js"
TEST_DIR="/tmp/hermes-test-$$"

echo "🧪 Testing hermes init in different scenarios..."
echo "Hermes binary: $HERMES_BIN"
echo ""

# Test 1: Non-git directory
echo "📋 Test 1: Non-git directory (should offer to init git)"
mkdir -p "$TEST_DIR/test1"
cd "$TEST_DIR/test1"
echo "Running: hermes init --quick"
node "$HERMES_BIN" init --quick || true
echo ""

# Test 2: Git repo with no commits
echo "📋 Test 2: Git repo with no commits"
mkdir -p "$TEST_DIR/test2"
cd "$TEST_DIR/test2"
git init
echo "Running: hermes init --quick"
node "$HERMES_BIN" init --quick || true
echo ""

# Test 3: Git repo with commits
echo "📋 Test 3: Git repo with commits"
mkdir -p "$TEST_DIR/test3"
cd "$TEST_DIR/test3"
git init
git config user.email "test@example.com"
git config user.name "Test User"
echo "test" > README.md
git add README.md
git commit -m "Initial commit"
echo "Running: hermes init --quick"
node "$HERMES_BIN" init --quick || true
echo ""

echo "✅ All tests completed!"
echo "Test artifacts in: $TEST_DIR"
echo "To clean up: rm -rf $TEST_DIR"
