# Render Deployment Guide

## Prerequisites

1. **GitHub Repository**: Code must be pushed to GitHub
2. **Render Account**: Sign up at https://render.com
3. **Database**: Set up PostgreSQL (Supabase or Neon recommended)

## Required Environment Variables

⚠️ **CRITICAL**: `ENCRYPTION_KEY` must NEVER change after first deployment. See [ENCRYPTION_KEY_WARNING.md](./ENCRYPTION_KEY_WARNING.md) for details.

Add these in Render Dashboard → Environment:

### Critical (Required)
```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname"
JWT_SECRET="generate-with-openssl-rand-base64-32"
SESSION_SECRET="generate-with-openssl-rand-base64-32"
ENCRYPTION_KEY="generate-ONCE-and-NEVER-change"  # ⚠️ CRITICAL: Store backup!
NODE_ENV="production"
PORT="10000"
```

### LLM Providers (Auto-Config)

The system will **automatically create LLM configurations** for any provider with environment variables set:

```bash
# Option 1: OpenAI (Recommended - simplest setup)
OPENAI_API_KEY="sk-proj-..."

# Option 2: Anthropic
ANTHROPIC_API_KEY="sk-ant-..."

# Option 3: Azure OpenAI (requires ALL 3 variables)
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o"
```

**Priority**: OpenAI > Anthropic > Azure

**Note**: Users can add additional providers via Settings UI after deployment.

## Generate Secrets

⚠️ **IMPORTANT**: Run these commands ONCE and save the output. Never regenerate ENCRYPTION_KEY.

```bash
# JWT_SECRET (can be regenerated if needed - logs out users)
openssl rand -base64 32

# SESSION_SECRET (can be regenerated if needed - logs out users)  
openssl rand -base64 32

# ENCRYPTION_KEY (⚠️ GENERATE ONCE, NEVER CHANGE - breaks LLM configs if changed!)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Example output: j8hK3mP9qW2xL5nR7tY4vC6bN8mK0pL9qW2xL5nR7t=
# ⚠️ SAVE THIS IN PASSWORD MANAGER - YOU'LL NEED IT FOREVER
```

**Why ENCRYPTION_KEY is Critical:**
- Encrypts all LLM API keys in database
- If changed, existing LLM configs become permanently unreadable
- Users would need to reconfigure all AI agents
- See [ENCRYPTION_KEY_WARNING.md](./ENCRYPTION_KEY_WARNING.md) for full details

## Deployment Steps

### 1. Connect Repository
- Go to Render Dashboard
- Click "New +" → "Web Service"
- Connect your GitHub account
- Select `AgentFlow` repository

### 2. Configure Service
- **Name**: `agentflow` (or your choice)
- **Runtime**: `Node`
- **Branch**: `main`
- **Build Command**: (auto-detected from render.yaml)
- **Start Command**: (auto-detected from render.yaml)

### 3. Add Environment Variables
- Go to "Environment" tab
- Add all variables listed above
- Click "Save Changes"

### 4. Deploy
- Click "Manual Deploy" → "Deploy latest commit"
- Monitor logs for any errors

## Troubleshooting

### SIGTERM Error
**Symptom**: Server starts but receives SIGTERM signal
**Causes**:
1. Missing environment variables (DATABASE_URL, ENCRYPTION_KEY, etc.)
2. Database connection timeout
3. Build command failing

**Solution**:
- Verify all environment variables are set
- Check database is accessible from Render
- Review deployment logs for specific errors

### Health Check Failing
**Symptom**: "Service unhealthy" errors
**Solution**:
- Health check endpoint: `/api/health`
- Should respond within 10 minutes of startup
- Check if initialization is hanging (database issues)

### Memory Issues
**Symptom**: Out of memory errors
**Solution**:
- Upgrade to Starter plan (4GB RAM)
- Current plan in render.yaml: `starter`

### Build Failing
**Symptom**: Build command exits with error
**Common causes**:
1. TypeScript compilation errors
2. Missing dependencies
3. Agent build script failing

**Debug**:
```bash
# Test locally
npm install
npm run build
node build-agents.mjs
```

## Database Setup

### Using Supabase
1. Create project at https://supabase.com
2. Get connection string from Settings → Database
3. Add to Render as `DATABASE_URL`

### Using Neon
1. Create project at https://neon.tech
2. Get connection string from dashboard
3. Add to Render as `DATABASE_URL`

## Post-Deployment

### Initialize Database
1. Database schema is pushed on first startup
2. Default accounts created automatically:
   - Super Admin: `superadmin@accute.com` / `SuperAdmin123!`
   - Admin: `admin@sterling.com` / `Admin123!`
   - Employee: `employee@sterling.com` / `Employee123!`

### Verify Deployment
```bash
# Health check
curl https://your-app.onrender.com/api/health

# Should return:
{
  "status": "ok",
  "timestamp": "2025-11-21T...",
  "initialized": true,
  "initError": null
}
```

### Access Application
- URL: `https://your-app-name.onrender.com`
- Login with default accounts
- Change passwords immediately

## Performance Optimization

### Free Tier Limitations
- Spins down after 15 minutes of inactivity
- Cold start takes 30-60 seconds
- 512MB RAM (upgrade recommended)

### Starter Tier Benefits (Recommended)
- 4GB RAM
- Always running
- Faster response times
- Better for production use

## Monitoring

### Logs
- View in Render Dashboard → Logs tab
- Shows startup, initialization, and request logs

### Metrics
- Response times
- Memory usage
- Error rates

### Alerts
- Set up in Render Dashboard
- Email notifications for failures

## Security Checklist

- ✅ All secrets in environment variables (not in code)
- ✅ HTTPS enabled (automatic on Render)
- ✅ ENCRYPTION_KEY is stable (don't regenerate)
- ✅ JWT_SECRET and SESSION_SECRET are strong
- ✅ Default passwords changed after first login
- ✅ Database uses SSL connection
- ✅ CORS configured for your domain

## Updating Deployment

### Automatic (Recommended)
- Push to `main` branch
- Render auto-deploys via `autoDeploy: true`

### Manual
- Render Dashboard → Manual Deploy
- Select commit to deploy

## Rollback

If deployment fails:
1. Go to Render Dashboard → Events
2. Find last successful deployment
3. Click "Rollback to this deploy"

## Support

- **Documentation**: https://render.com/docs
- **Status**: https://status.render.com
- **Community**: https://community.render.com
