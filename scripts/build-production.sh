#!/bin/bash

# Production Build Script for Accute
# Builds client, server, and agent backends for deployment

set -e  # Exit on error

echo "🚀 Starting production build..."
echo ""

# Step 1 & 2: Build client and server (existing npm build script)
echo "📦 Building client and server..."
vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "✅ Client and server build complete"
echo ""

# Step 3: Build agent backends
echo "🤖 Building agent backends..."
node build-agents.mjs
echo "✅ Agent backends build complete"
echo ""

echo "🎉 Production build complete!"
echo ""
echo "Output structure:"
echo "  - dist/index.js (server)"
echo "  - dist/public/ (client)"
echo "  - dist/agents/*/backend/index.js (agent backends)"
echo ""
echo "To start production server: npm start"
