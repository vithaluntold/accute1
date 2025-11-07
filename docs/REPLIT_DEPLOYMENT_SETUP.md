# 🚨 CRITICAL: Replit Deployment Setup for AI Agents

## The Problem

When deploying to Replit production, the default `npm run build` command does NOT include agent backends, causing all AI agents to fail with "Cannot find module" errors.

## The Solution

You **MUST** modify your deployment configuration to run the comprehensive build script.

### Option 1: Modify .replit File (Recommended)

Update your `.replit` file to use the comprehensive build script:

```toml
[deployment]
build = ["sh", "-c", "./scripts/build-production.sh"]
run = ["sh", "-c", "npm start"]
```

If `.replit` doesn't exist, create it with:

```toml
run = "npm run dev"
hidden = [".config", "package-lock.json"]

[nix]
channel = "stable-23_11"

[deployment]
build = ["sh", "-c", "./scripts/build-production.sh"]
run = ["sh", "-c", "npm start"]

[env]
PATH = "/home/runner/$REPL_SLUG/.config/npm/node_global/bin:/home/runner/$REPL_SLUG/node_modules/.bin"
npm_config_prefix = "/home/runner/$REPL_SLUG/.config/npm/node_global"
```

### Option 2: Pre-Deploy Build Hook

Before deploying:

1. **Run the build script locally**:
   ```bash
   ./scripts/build-production.sh
   ```

2. **Commit the dist/agents directory**:
   ```bash
   git add dist/agents/
   git commit -m "Add compiled agent backends for production"
   ```

3. **Deploy to Replit**

⚠️ **Warning**: This approach requires committing build artifacts, which is not ideal but works if you can't modify deployment config.

### Option 3: Manual Build Before Each Deploy

If you can't modify `.replit`:

1. Open Replit Shell
2. Run: `./scripts/build-production.sh`
3. Click Deploy button immediately after build completes

## Verification

After deployment, verify agents are working:

1. Open your production URL
2. Navigate to any AI agent (Luca, Cadence, Scribe, etc.)
3. Try sending a message
4. ✅ Agent should respond normally
5. ❌ If you see "Cannot find module" error, the build didn't run correctly

## Troubleshooting

### Error: "Cannot find module '/home/runner/workspace/dist/agents/luca/backend/index'"

**Cause**: Agent backends weren't built during deployment.

**Fix**:
```bash
# In Replit Shell:
./scripts/build-production.sh

# Then redeploy
```

### Error: "Permission denied: ./scripts/build-production.sh"

**Cause**: Build script isn't executable.

**Fix**:
```bash
chmod +x scripts/build-production.sh
git add scripts/build-production.sh
git commit -m "Make build script executable"
```

### Deployment keeps failing

**Debug steps**:
1. Check Replit deployment logs for build errors
2. Run `./scripts/build-production.sh` manually in Shell
3. Verify `dist/agents/` directory exists after build
4. Check that all 10 agents are in `dist/agents/`

## What Gets Built

The comprehensive build creates:

```
dist/
├── index.js                    # Express server (bundled)
├── public/                    # React frontend (Vite build)
│   ├── index.html
│   ├── assets/
│   └── ...
└── agents/                    # AI agent backends (transpiled)
    ├── cadence/backend/index.js
    ├── echo/backend/index.js
    ├── forma/backend/index.js
    ├── kanban/backend/index.js
    ├── luca/backend/index.js
    ├── omnispectra/backend/index.js
    ├── parity/backend/index.js
    ├── radar/backend/index.js
    ├── relay/backend/index.js
    └── scribe/backend/index.js
```

## Important Notes

- **Build time**: ~60-90 seconds total
- **Required**: All three build steps must complete
- **One-time setup**: Once `.replit` is configured, builds are automatic
- **Testing**: Always test AI agents after deployment

## Still Having Issues?

1. Check [PRODUCTION_BUILD.md](./PRODUCTION_BUILD.md) for detailed build process
2. Verify [ENCRYPTION_KEY_CRITICAL.md](./ENCRYPTION_KEY_CRITICAL.md) for environment variables
3. Check Replit deployment logs for specific error messages
