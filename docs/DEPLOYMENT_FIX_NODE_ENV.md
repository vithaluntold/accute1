# 🚨 CRITICAL FIX: Set NODE_ENV for Deployment

## The Root Cause

Your agents are failing in production because **NODE_ENV is not set to "production"** in the Replit deployment environment.

When NODE_ENV isn't set correctly, the agent loader tries to load `.ts` files instead of compiled `.js` files, causing "Cannot find module" errors.

## The Solution: Add NODE_ENV to .replit

You need to add `NODE_ENV="production"` to your deployment environment.

### Step 1: Edit .replit File

Open `.replit` and find the `[env]` section (around line 78-79).

**Currently it looks like:**
```toml
[env]
PORT = "5000"
```

**Change it to:**
```toml
[env]
PORT = "5000"
NODE_ENV = "production"
```

### Step 2: Verify

After editing, your complete deployment section should look like:

```toml
[deployment]
deploymentTarget = "autoscale"
build = ["sh", "-c", "./scripts/build-production.sh"]
run = ["npm", "run", "start"]

# ... ports configuration ...

[env]
PORT = "5000"
NODE_ENV = "production"
```

## Alternative: Use Deployment Secrets

If the above doesn't work, you can also set NODE_ENV as a deployment secret:

1. Go to your Replit workspace
2. Click on "Secrets" in the left sidebar
3. Click on "Deployment" tab
4. Add a new secret:
   - Key: `NODE_ENV`
   - Value: `production`

## How the Fix Works

The improved agent loader now has **multiple fallback checks**:

1. ✅ Checks `NODE_ENV === 'production'`
2. ✅ Checks if running from `dist/` directory
3. ✅ Logs which mode it's using for debugging

**In development:**
```
[AGENT LOADER] Development mode - Loading luca from: /agents/luca/backend/index.ts
```

**In production (after fix):**
```
[AGENT LOADER] Production mode - Loading luca from: /dist/agents/luca/backend/index.js
```

## Testing After Fix

1. **Make the change to .replit**
2. **Redeploy your app**
3. **Check deployment logs** - you should see `[AGENT LOADER] Production mode`
4. **Test an agent** - Luca should respond normally
5. **If it still fails** - check the deployment logs for the NODE_ENV value

## Debugging

If agents still fail after setting NODE_ENV, check the deployment logs for these messages:

```
Failed to import agent luca: ...
Attempted path: /home/runner/workspace/dist/agents/luca/backend/index.js
NODE_ENV: production
Process argv[1]: /home/runner/workspace/dist/index.js
```

This will tell us exactly what's happening.

## Summary

**The Problem**: NODE_ENV not set → agent loader uses development paths → files don't exist

**The Fix**: Add `NODE_ENV = "production"` to `[env]` section in `.replit`

**The Result**: Agent loader uses production paths → loads compiled files → agents work!
