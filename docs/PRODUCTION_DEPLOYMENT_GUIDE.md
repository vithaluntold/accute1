# Production Deployment Guide - Environment Configuration

## Critical Issue: LLM Configuration Errors in Production

### Problem Summary
The application works perfectly in **development** but throws **LLM Configuration errors in production** deployments. This happens because Replit handles environment variables differently between development and production environments.

---

## Root Cause

According to Replit documentation:

> **Secrets configured in the local workspace are NOT automatically transferred to production deployments.**

This means:
- ✅ **Development**: Secrets set in the Replit Secrets sidebar work perfectly
- ❌ **Production**: Those same secrets are NOT available in published deployments

Your AI agents (Luca, Cadence, Echo, etc.) rely on LLM provider credentials stored as secrets, which is why they fail in production.

---

## Solution: Configure Production Environment Variables

### Step 1: Identify Required Secrets

Accute requires these environment variables for AI agents to function:

#### **OpenAI Provider** (Optional)
```
OPENAI_API_KEY=sk-...
```

#### **Azure OpenAI Provider** (Default for most agents)
```
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

#### **Anthropic Claude Provider** (Optional)
```
ANTHROPIC_API_KEY=sk-ant-...
```

#### **Other Services**
```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

### Step 2: Configure Production Secrets in Replit

When you **publish/deploy** your Replit application, you need to configure environment variables specifically for the production environment:

#### Option A: Through Replit Deployments UI

1. **Open your Replit project**
2. Click on the **"Deployments"** tab (rocket icon in left sidebar)
3. Find your published deployment
4. Click **"Configure"** or **"Settings"**
5. Look for **"Environment Variables"** or **"Secrets"** section
6. Add each required secret:
   - Name: `AZURE_OPENAI_API_KEY`
   - Value: `your-actual-api-key-here`
7. Repeat for all required secrets
8. **Save** and **redeploy**

#### Option B: Through Replit CLI (if available)

```bash
# Set production environment variables
replit deploy set-secret AZURE_OPENAI_API_KEY your-api-key-here
replit deploy set-secret AZURE_OPENAI_ENDPOINT https://your-resource.openai.azure.com
```

### Step 3: Verify Environment Variable Detection

The application uses the `REPLIT_DEPLOYMENT` environment variable to detect production mode:

```typescript
// This is automatically set by Replit
// REPLIT_DEPLOYMENT=1 in production
// REPLIT_DEPLOYMENT=undefined in development
```

You can verify secrets are loaded by checking production logs:
```
✅ LLM Configuration Service initialized
```

If you see errors like:
```
❌ No LLM configurations found
❌ Azure OpenAI credentials missing
```

Then your production secrets are NOT configured correctly.

---

## Testing Production Deployment

### 1. Check Logs for LLM Initialization
After deploying with environment variables:

```
🚀 Starting server in production mode...
✅ LLM Configuration Service initialized
🤖 Initializing AI Agent Foundry...
✅ Agent Foundry initialized successfully
```

### 2. Test AI Agent Access
1. Log in to your **production deployment URL**
2. Navigate to any AI agent (Luca, Cadence, Echo, etc.)
3. Try sending a message
4. If configured correctly:
   - ✅ Agent responds with AI-generated content
   - ✅ No "LLM configuration error" messages

### 3. Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "No LLM configurations found" | Azure/OpenAI secrets not set in production | Add AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT to production environment |
| "LLM provider credentials missing" | API key format incorrect or invalid | Verify API key is correct and has proper permissions |
| "Rate limit exceeded" | Too many API calls | Check your Azure/OpenAI usage quota |
| "Invalid endpoint" | Wrong Azure endpoint URL | Verify endpoint matches your Azure resource |

---

## Environment-Specific Configuration

### Development Environment

**Where secrets are stored**: Replit Workspace Secrets sidebar

**Access method**:
```typescript
const apiKey = process.env.AZURE_OPENAI_API_KEY;
```

**Detection**:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Running in development');
}
```

### Production Environment

**Where secrets are stored**: Deployment-specific environment variables

**Access method**: Same as development
```typescript
const apiKey = process.env.AZURE_OPENAI_API_KEY;
```

**Detection**:
```typescript
if (process.env.REPLIT_DEPLOYMENT === '1') {
  console.log('Running in production deployment');
}
```

---

## Best Practices

### 1. Use Environment-Specific Defaults

```typescript
// Server configuration
const port = process.env.PORT || 5000;
const host = process.env.REPLIT_DEPLOYMENT === '1' 
  ? '0.0.0.0'  // Production
  : '127.0.0.1'; // Development
```

### 2. Fail Gracefully with Clear Error Messages

```typescript
if (!process.env.AZURE_OPENAI_API_KEY) {
  console.error('❌ AZURE_OPENAI_API_KEY not configured');
  console.error('ℹ️  Add this secret in Deployments → Environment Variables');
  throw new Error('LLM configuration missing');
}
```

### 3. Validate Secrets on Startup

The application automatically validates LLM configurations during initialization:

```typescript
// server/llm-config-service.ts
async initialize() {
  const configs = await this.loadConfigurations();
  if (configs.length === 0) {
    console.warn('⚠️ No LLM configurations found');
    console.warn('ℹ️  AI agents will not function until LLM provider is configured');
  } else {
    console.log(`✅ Loaded ${configs.length} LLM configuration(s)`);
  }
}
```

### 4. Document Required Secrets

Keep a checklist of required environment variables:

```markdown
## Required Production Secrets

- [ ] AZURE_OPENAI_API_KEY
- [ ] AZURE_OPENAI_ENDPOINT
- [ ] RAZORPAY_KEY_ID (for payments)
- [ ] RAZORPAY_KEY_SECRET (for payments)
- [ ] GMAIL_CLIENT_ID (for email integration)
- [ ] GMAIL_CLIENT_SECRET (for email integration)
```

---

## Troubleshooting

### Issue: "Works locally but fails in production"

**Symptoms**:
- ✅ Development: AI agents respond normally
- ❌ Production: "LLM configuration error" or empty responses

**Solution**:
1. Check production deployment logs
2. Verify environment variables are set in Deployments settings
3. Ensure API keys are valid and have proper quota
4. Redeploy after adding secrets

### Issue: "Invalid API credentials"

**Symptoms**:
- Error: "Authentication failed"
- Error: "Invalid API key"

**Solution**:
1. Verify API key format (Azure keys start with alphanumeric characters)
2. Check that endpoint URL matches your Azure resource
3. Ensure API key has not expired
4. Test API key using curl:

```bash
curl https://your-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Issue: "Rate limit exceeded"

**Symptoms**:
- Error: "Rate limit reached"
- Error: "Quota exceeded"

**Solution**:
1. Check your Azure OpenAI quota in Azure Portal
2. Upgrade your Azure pricing tier if needed
3. Implement rate limiting in application (already configured)
4. Use multiple API keys for load balancing

---

## Security Best Practices

### 1. Never Commit Secrets to Git

❌ **NEVER DO THIS**:
```typescript
const API_KEY = "sk-1234567890..."; // Hard-coded secret!
```

✅ **ALWAYS DO THIS**:
```typescript
const API_KEY = process.env.AZURE_OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error('API key not configured');
}
```

### 2. Use AES-256-GCM Encryption for Database Storage

Accute already implements encryption for LLM credentials:

```typescript
// server/crypto-utils.ts
export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  // ... encryption logic
}
```

### 3. Rotate Secrets Regularly

- Change API keys every 90 days
- Use separate keys for dev/staging/production
- Revoke compromised keys immediately

### 4. Limit Secret Access

- Only administrators should access production secrets
- Use RBAC (Role-Based Access Control) for team members
- Audit secret access logs

---

## Quick Reference

| Environment | Secret Location | How to Add | Auto-Transfer to Production? |
|-------------|----------------|------------|------------------------------|
| **Development** | Replit Secrets sidebar | Click "Secrets" → Add key/value | ❌ No |
| **Production** | Deployment settings | Deployments → Configure → Environment Variables | N/A |

### Commands

```bash
# Check if running in production
echo $REPLIT_DEPLOYMENT

# View current environment (development only)
env | grep AZURE

# Test API connectivity
curl -X POST https://your-endpoint.openai.azure.com/openai/deployments/gpt-4/chat/completions \
  -H "api-key: $AZURE_OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

---

## Support Resources

### Official Documentation
- [Replit Deployments Documentation](https://docs.replit.com/hosting/deployments/about-deployments)
- [Azure OpenAI Service Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### Contact Support
- **Replit Support**: https://replit.com/support
- **Azure Support**: https://azure.microsoft.com/support

---

## Summary Checklist

Before deploying to production:

- [ ] All required secrets identified
- [ ] Secrets added to Deployment environment variables
- [ ] API keys tested and validated
- [ ] Production deployment redeployed with new secrets
- [ ] AI agents tested in production environment
- [ ] Error logs checked for LLM configuration issues
- [ ] Rate limits and quotas verified
- [ ] Security best practices followed
- [ ] Documentation updated with deployment notes

---

**Last Updated**: January 7, 2025  
**Status**: Production-Ready  
**Tested**: ✅ Development | ⏳ Awaiting Production Secret Configuration
