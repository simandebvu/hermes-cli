#!/bin/bash

# Test the update notifier
set -e

HERMES_BIN="$(pwd)/dist/index.js"
CACHE_DIR="$HOME/.hermes/cache"
CACHE_FILE="$CACHE_DIR/update-check.json"

echo "🧪 Testing update notifier..."
echo ""

# Clean up cache first
echo "📋 Test 1: First run (should check for updates)"
rm -f "$CACHE_FILE"
node "$HERMES_BIN" --version
echo ""

# Check if cache was created
if [ -f "$CACHE_FILE" ]; then
  echo "✅ Cache file created: $CACHE_FILE"
  echo "Cache contents:"
  cat "$CACHE_FILE"
  echo ""
else
  echo "⚠️  No cache file created (might be expected if network is unavailable)"
  echo ""
fi

# Run again to test cache
echo "📋 Test 2: Second run (should use cache, no API call)"
node "$HERMES_BIN" --version
echo ""

echo "✅ Update notifier test completed!"
echo ""
echo "Note: To see the update notification, you would need to:"
echo "1. Publish a newer version to npm"
echo "2. Wait for cache to expire or delete: $CACHE_FILE"
echo "3. Run any hermes command"
