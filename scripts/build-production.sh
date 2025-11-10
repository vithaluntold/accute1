#!/bin/bash

# Production Build Script for Accute
# Builds client, server, and agent backends for deployment

set -e  # Exit on error

echo "🚀 Starting production build..."
echo ""

# Set production environment
export NODE_ENV=production

# Step 1: Build client with Vite
echo "📦 Building client (Vite)..."
vite build
echo "✅ Client build complete"
echo ""

# Step 2: Build server with esbuild
echo "📦 Building server (esbuild)..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "✅ Server build complete"
echo ""

# Verify dist/index.js was created
if [ ! -f "dist/index.js" ]; then
  echo "❌ ERROR: dist/index.js not found after build!"
  exit 1
fi
echo "✅ Verified dist/index.js exists"
echo ""

# Step 3: Build agent backends
echo "🤖 Building agent backends..."
if [ -f "build-agents.mjs" ]; then
  node build-agents.mjs
  echo "✅ Agent backends build complete"
else
  echo "⚠️  Warning: build-agents.mjs not found, skipping agent build"
fi
echo ""

echo "🎉 Production build complete!"
echo ""
echo "Output structure:"
echo "  - dist/index.js (server) ✓"
echo "  - dist/public/ (client)"
if [ -f "build-agents.mjs" ]; then
  echo "  - dist/agents/*/backend/index.js (agent backends)"
fi
echo ""
echo "To start production server: npm start"
