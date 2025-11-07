# 🔴 CRITICAL: ENCRYPTION_KEY Configuration

## The Problem

**Issue:** LLM credentials break after every deployment, forcing clients to reconfigure AI services.

**Root Cause:** The `ENCRYPTION_KEY` environment variable is either:
1. Not set in production
2. Different between development and production  
3. Changing with each deployment

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  LLM Credential Storage Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Organization admin configures LLM credentials in UI      │
│     ↓                                                        │
│  2. API key encrypted with AES-256-GCM                       │
│     using ENCRYPTION_KEY environment variable                │
│     ↓                                                        │
│  3. Encrypted credential stored in database                  │
│     (llm_configurations table)                               │
│     ↓                                                        │
│  4. When AI agent runs, system:                              │
│     - Fetches encrypted credential from database             │
│     - Decrypts using ENCRYPTION_KEY                          │
│     - Uses decrypted API key to call LLM provider            │
│                                                              │
│  ⚠️  If ENCRYPTION_KEY changes → Decryption fails            │
│     → Credentials unreadable → AI agents broken              │
└─────────────────────────────────────────────────────────────┘
```

## Why Database + Encryption?

**Why not just environment variables?**
- Each organization has their own LLM provider and credentials
- One deployment serves multiple organizations
- Organizations configure credentials through the UI (not deployment config)
- Credentials must persist in database per organization

**Why encryption?**
- API keys are sensitive secrets
- Database encryption protects against data breaches
- AES-256-GCM is industry-standard encryption

**Why same ENCRYPTION_KEY required?**
- Credentials encrypted with Key A cannot be decrypted with Key B
- Changing the key makes all existing credentials unreadable
- It's like changing a safe's combination - you can't open it anymore!

## The Fix

### 1. Generate ENCRYPTION_KEY (Once Only!)

```bash
# Run this command ONCE to generate a secure key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Example output:
8xKj2Lm9Pq3Rt4Uv5Wx6Yz7Ab8Cd9Ef0Gh1Ij2Kl3M=
```

### 2. Set in Replit Secrets (Development)

1. Click **Tools** → **Secrets** in left sidebar
2. Add secret:
   - Key: `ENCRYPTION_KEY`
   - Value: `8xKj2Lm9Pq3Rt4Uv5Wx6Yz7Ab8Cd9Ef0Gh1Ij2Kl3M=`
3. Click **Add secret**

### 3. Set in Production Deployment

**For Replit Deployments:**
1. Go to **Deployments** tab
2. Click on your deployment
3. Click **Settings** or **Configure**
4. Find **Environment Variables** section
5. Add the SAME value:
   - Name: `ENCRYPTION_KEY`
   - Value: `8xKj2Lm9Pq3Rt4Uv5Wx6Yz7Ab8Cd9Ef0Gh1Ij2Kl3M=` (must match development!)
6. Save and redeploy

### 4. Verify It's Working

After deployment, check server logs for:

```
✅ Server listening on 0.0.0.0:5000
```

If you see this error:
```
❌ CRITICAL: Missing required environment variables:
   - ENCRYPTION_KEY (required)
```

The key is not set in production - go back to step 3.

## Requirements

- **Length:** Minimum 32 characters
- **Stability:** MUST be the same across all environments (dev, staging, production)
- **Security:** Never commit to Git, only store in secrets manager
- **Uniqueness:** Generate a new random key for each project

## What If I Lose the Key?

If `ENCRYPTION_KEY` is lost or changed:

1. **All existing LLM credentials become unreadable** (cannot be decrypted)
2. **Organizations must reconfigure** all their LLM providers through the UI
3. **No data is lost** - the encrypted values are still in database, just unusable

**Recovery steps:**
1. Set a new `ENCRYPTION_KEY` (generate fresh one)
2. Notify all organization admins to:
   - Go to Settings → LLM Configuration
   - Delete old configurations
   - Add new credentials
3. Test AI agents to confirm they work

## Production Checklist

Before deploying to production:

- [ ] `ENCRYPTION_KEY` is set in development secrets
- [ ] `ENCRYPTION_KEY` is set in production environment variables
- [ ] Both values are EXACTLY the same
- [ ] Key is at least 32 characters long
- [ ] Key is securely stored and backed up
- [ ] Server starts without errors
- [ ] AI agents can execute successfully

## Technical Details

**File:** `server/llm-service.ts`

```typescript
// Encryption
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY!.slice(0, 32)),
    iv
  );
  // ... encryption logic
}

// Decryption
export function decrypt(encryptedData: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY!.slice(0, 32)),
    iv
  );
  // ... decryption logic
}
```

**Startup Validation:** `server/index.ts`

```typescript
// Server now validates ENCRYPTION_KEY at startup
const requiredVars = [
  { name: 'ENCRYPTION_KEY', critical: true, minLength: 32 },
  // ...
];

// If missing or too short, server exits with error
```

## Common Errors

### Error: "No default LLM configuration found"
**Cause:** Organization hasn't configured LLM credentials  
**Fix:** Admin should go to Settings → LLM Configuration and add credentials

### Error: "ENCRYPTION_KEY not configured"
**Cause:** Environment variable not set  
**Fix:** Add ENCRYPTION_KEY to production secrets (see steps above)

### Error: Decryption fails (no explicit error, agents just don't work)
**Cause:** ENCRYPTION_KEY changed between when credentials were saved and now  
**Fix:** Use the original ENCRYPTION_KEY, or reconfigure all LLM credentials

## Summary

**Golden Rule:** Generate `ENCRYPTION_KEY` once, use it everywhere, never change it.

This is like your database password - it must be:
- Secret (not in code)
- Stable (same everywhere)
- Secure (strong random value)
- Safe (backed up somewhere secure)
