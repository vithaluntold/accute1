# Production Build Guide for Accute

## Overview

Accute requires a **three-step build process** for production deployment:

1. **Client build** (Vite) → `dist/public/`
2. **Server build** (esbuild) → `dist/index.js`
3. **Agent backends build** (esbuild) → `dist/agents/*/backend/index.js`

## Why Agent Backends Need Separate Building

### The Problem
- **Development**: `tsx` transpiles TypeScript on-the-fly, so agents at `agents/*/backend/index.ts` load directly
- **Production**: `node dist/index.js` can only import JavaScript files, but agent backends are TypeScript

### The Solution
All agent backends must be transpiled to `dist/agents/*/backend/index.js` before deployment.

## Quick Start

### Option 1: Using the Build Script (Recommended)

```bash
# Run the comprehensive build script
./scripts/build-production.sh
```

This script:
1. Builds the Vite frontend → `dist/public/`
2. Bundles the Express server → `dist/index.js`
3. Transpiles all agent backends → `dist/agents/*/backend/index.js`

### Option 2: Manual Build Steps

```bash
# 1. Build client
npm run build:client  # or: vite build

# 2. Build server
npm run build:server  # or: esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# 3. Build agent backends
node build-agents.mjs
```

## Production Deployment Checklist

- [ ] Run production build: `./scripts/build-production.sh`
- [ ] Verify `dist/agents/` directory exists with all agent backends
- [ ] Set `ENCRYPTION_KEY` environment variable in production
- [ ] Set `NODE_ENV=production`
- [ ] Start server: `npm start`
- [ ] Test AI agents load correctly

## Build Output Structure

```
dist/
├── index.js                    # Bundled server
├── index.js.map               # Source map
├── public/                    # Vite-built frontend
│   ├── index.html
│   ├── assets/
│   └── ...
└── agents/                    # Transpiled agent backends
    ├── cadence/
    │   └── backend/
    │       ├── index.js
    │       └── index.js.map
    ├── echo/
    │   └── backend/
    │       ├── index.js
    │       └── index.js.map
    ├── forma/
    ├── luca/
    ├── omnispectra/
    ├── parity/
    ├── radar/
    ├── relay/
    └── scribe/
```

## How It Works

### Agent Import Logic

The system uses different import paths based on environment:

```typescript
// server/agent-import-helper.ts
export async function importAgentBackend(agentName: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Load compiled JS from dist/agents/<name>/backend/index.js
    modulePath = path.join(process.cwd(), 'dist', 'agents', agentName, 'backend', 'index.js');
  } else {
    // Load TS files from agents/<name>/backend/index.ts
    modulePath = path.join(process.cwd(), 'agents', agentName, 'backend', 'index.ts');
  }
  
  return await import(pathToFileURL(modulePath).href);
}
```

### Build Agent Backends Script

The `build-agents.mjs` script:
- Discovers all agent directories (excluding templates starting with `_`)
- Transpiles each `agents/<name>/backend/index.ts` using esbuild
- Outputs to `dist/agents/<name>/backend/index.js`
- Marks all `node_modules` as external (not bundled)
- Generates source maps for debugging

## Troubleshooting

### Error: "Cannot find module '/dist/agents/luca/backend/index'"

**Cause**: Agent backends weren't built for production.

**Fix**:
```bash
# Make sure you run the full build
./scripts/build-production.sh

# OR manually build agents
node build-agents.mjs
```

### Error: "Agent <name> backend must export a registerRoutes function"

**Cause**: Agent's `index.ts` doesn't re-export `registerRoutes` from `handler.ts`.

**Fix**: Add this to the end of `agents/<name>/backend/index.ts`:
```typescript
export { registerRoutes } from './handler';
```

### Build fails with "Could not resolve"

**Cause**: Agent directory missing `backend/index.ts` file.

**Fix**: Only real agent directories should exist in `agents/`. Template directories should start with `_` (e.g., `_templates/`).

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build for production
        run: ./scripts/build-production.sh
      
      - name: Deploy
        run: |
          # Your deployment commands here
          # The dist/ directory is ready to deploy
```

### Replit Deployments

When deploying via Replit:

1. Replit will automatically run `npm run build` (defined in package.json)
2. You need to ensure this calls our comprehensive build:
   - Option A: Modify replit.nix to run `./scripts/build-production.sh`
   - Option B: Ask user to manually run build script before deploying

## Performance Notes

- **Build time**: ~10-15 seconds for all agents
- **Agent size**: ~5-10KB per agent (transpiled, not bundled)
- **Source maps**: Included for production debugging

## Related Documentation

- [ENCRYPTION_KEY_CRITICAL.md](./ENCRYPTION_KEY_CRITICAL.md) - Critical environment variable setup
- [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) - Full deployment guide
