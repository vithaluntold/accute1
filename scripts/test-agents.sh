#!/bin/bash
# Wrapper script to test all AI agents

set -e

echo "🚀 Starting AI Agent Tests..."
echo ""

# Check if server is running
if ! curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "❌ Error: Server is not running on http://localhost:5000"
    echo "   Please start the server first with: npm run dev"
    exit 1
fi

echo "✓ Server is running"
echo ""

# Run the test script
node scripts/test-all-agents.mjs

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All tests passed successfully!"
else
    echo ""
    echo "❌ Some tests failed. Please review the output above."
fi

exit $EXIT_CODE
