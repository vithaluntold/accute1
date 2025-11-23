# ⚠️ CRITICAL: ENCRYPTION_KEY Stability

## The Problem

LLM API keys (OpenAI, Azure, Anthropic) are stored **encrypted** in the database using `ENCRYPTION_KEY`. If you change or regenerate `ENCRYPTION_KEY` between deployments, **all stored credentials become permanently unreadable**.

### What Happens When ENCRYPTION_KEY Changes:

```
Before: ENCRYPTION_KEY="abc123" → Encrypted API key stored in DB
After:  ENCRYPTION_KEY="xyz789" → Cannot decrypt API key
Result: ❌ "I apologize, but I encountered an error processing your request. 
           Please check your LLM configuration and try again."
```

## The Solution

### ✅ DO THIS: Set Once, Never Change

**On First Deployment:**
```bash
# Generate the key ONCE
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Example output: j8hK3mP9qW2xL5nR7tY4vC6bN8mK0pL9qW2xL5nR7t=

# Add to Render environment variables
ENCRYPTION_KEY="j8hK3mP9qW2xL5nR7tY4vC6bN8mK0pL9qW2xL5nR7t="
```

**On Every Subsequent Deployment:**
- ✅ Keep the SAME `ENCRYPTION_KEY` value
- ✅ Never regenerate or change it
- ✅ Store backup in secure password manager

### ❌ NEVER DO THIS:

```bash
# ❌ DON'T regenerate the key on redeployment
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# This creates a NEW key, making old data unreadable

# ❌ DON'T change the key manually
ENCRYPTION_KEY="some-new-value"  # All existing credentials lost!

# ❌ DON'T remove and re-add the variable
# Render might not preserve the old value
```

## How LLM Configs Work

### Initial Setup (Automatic)

When you deploy with environment variables set:

```bash
# Render Environment Variables
OPENAI_API_KEY="sk-proj-..."
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o"
ANTHROPIC_API_KEY="sk-ant-..."
ENCRYPTION_KEY="j8hK3mP9qW2xL5nR7tY4vC6bN8mK0pL9qW2xL5nR7t="
```

The system automatically:
1. Creates organization on first login
2. Detects available LLM providers from env vars
3. Encrypts API keys using `ENCRYPTION_KEY`
4. Stores encrypted keys in `llm_configurations` table
5. Sets as default for organization

**Priority order:** OpenAI > Anthropic > Azure (requires all 3 vars)

### On Subsequent Deployments

LLM configurations **persist in database** - users don't need to reconfigure unless:
- ❌ ENCRYPTION_KEY changed (breaks all configs)
- ✅ API key expired (user updates in Settings)
- ✅ Switching providers (user adds new config in Settings)

## Recovery from Broken Encryption

If you accidentally changed `ENCRYPTION_KEY`:

### Option 1: Restore Original Key (Recommended)
```bash
# Find the original key (check backup, password manager, or old deployment logs)
ENCRYPTION_KEY="original-key-here"  # Restore in Render

# Redeploy - existing configs will work again
```

### Option 2: Recreate Configurations
```bash
# If original key is lost, users must reconfigure LLMs:
1. Go to Settings > LLM Configuration
2. Delete broken configurations
3. Add new configuration with fresh API key
4. Set as default
```

### Option 3: Database Migration (For Admins)
```bash
# Decrypt with old key, re-encrypt with new key
tsx server/migrate-encryption-key.ts --old-key="abc123" --new-key="xyz789"
```

## Best Practices

### 1. Secure Key Storage
```bash
# Store ENCRYPTION_KEY in:
✅ Password manager (1Password, Bitwarden, LastPass)
✅ Secure notes with backup
✅ Team vault for shared access
❌ Never in code or public repos
```

### 2. Deployment Checklist
Before deploying to Render:
- [ ] Verify `ENCRYPTION_KEY` is set in environment
- [ ] Confirm it matches existing deployments
- [ ] Check LLM provider keys are current
- [ ] Test encryption service health: `/api/diagnostics`

### 3. Multiple Environments
```bash
# Use DIFFERENT encryption keys per environment
Development:  ENCRYPTION_KEY="dev-key-xyz123..."
Staging:      ENCRYPTION_KEY="staging-key-abc456..."
Production:   ENCRYPTION_KEY="prod-key-def789..."

# But keep SAME key within each environment across deployments
```

### 4. Key Rotation (Advanced)
If you MUST rotate the encryption key:

```bash
# 1. Export all encrypted data with old key
tsx server/export-encrypted-data.ts --key="old-key"

# 2. Update ENCRYPTION_KEY in environment
ENCRYPTION_KEY="new-key"

# 3. Re-import and re-encrypt data
tsx server/import-encrypted-data.ts --key="new-key"
```

## Symptoms of Broken Encryption

### In UI:
- AI agents show error: "Please check your LLM configuration"
- Settings > LLM Configuration shows configs but they don't work
- Chat with any agent fails immediately

### In Logs:
```
❌ Failed to decrypt LLM configuration
Error: Invalid initialization vector
```

### In Database:
```sql
-- Configs exist but are unreadable
SELECT id, name, provider, is_active 
FROM llm_configurations 
WHERE organization_id = 'your-org-id';

-- api_key_encrypted exists but decrypt() fails
```

## Testing Encryption

### Health Check Endpoint
```bash
curl https://your-app.onrender.com/api/diagnostics

# Look for:
{
  "encryption": {
    "status": "healthy",
    "canEncrypt": true,
    "canDecrypt": true
  }
}
```

### Test Encryption Service
```bash
# SSH into Render instance or run locally
tsx server/test-encryption.ts

# Should show:
✅ Encryption key valid
✅ Can encrypt data
✅ Can decrypt data
✅ Round-trip successful
```

## Related Files

- `server/encryption-service.ts` - Encryption implementation (AES-256-GCM)
- `server/organization-onboarding-service.ts` - Auto-creates LLM configs
- `server/llm-config-service.ts` - Manages config fetching/caching
- `shared/schema.ts` - `llm_configurations` table schema

## Support

If users report "LLM configuration error" after deployment:
1. Check `ENCRYPTION_KEY` hasn't changed in Render environment
2. Verify encryption service health: `/api/diagnostics`
3. Test specific config: `curl /api/llm-configurations/:id`
4. Check application logs for decryption errors

**Remember:** ENCRYPTION_KEY stability is CRITICAL for production systems.
