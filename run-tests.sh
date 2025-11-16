#!/bin/bash
set -e

echo "🧪 Running Accute Test Suite"
echo "=============================="
echo ""

cd /home/runner/workspace

echo "📋 Test Configuration:"
echo "   Environment: test"
echo "   Test Runner: Vitest"
echo "   Database: Development (with cleanup)"
echo ""

# Run foundation tests
echo "🔧 Running Foundation Tests (85 tests)..."
NODE_ENV=test npx vitest run server/__tests__/foundation --reporter=verbose

echo ""
echo "✅ Foundation Tests Complete!"
