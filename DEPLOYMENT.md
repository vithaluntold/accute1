# Accute Deployment Guide

This guide covers pushing to GitHub and deploying to Railway.

## Prerequisites

- GitHub account
- Railway account (https://railway.app)
- Git installed locally (if deploying from local machine)

---

## Part 1: Push to GitHub

### Option A: From Replit (Recommended)

1. **Connect to GitHub from Replit:**
   - Click the **Git** icon in the left sidebar (branch icon)
   - Click **"Connect to GitHub"**
   - Authorize Replit to access your GitHub account
   - Create a new repository or select existing one
   - Click **"Push"** to push all code

### Option B: From Local Machine

1. **Clone or download the project:**
   ```bash
   # If you have the code locally, navigate to the project folder
   cd your-project-folder
   ```

2. **Initialize Git (if not already done):**
   ```bash
   git init
   ```

3. **Add your GitHub repository as remote:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   ```

4. **Add all files and commit:**
   ```bash
   git add .
   git commit -m "Initial commit - Accute Platform"
   ```

5. **Push to GitHub:**
   ```bash
   git branch -M main
   git push -u origin main
   ```

---

## Part 2: Deploy to Railway

### Step 1: Create Railway Project

1. Go to [Railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account if not already connected
5. Select the repository you just pushed

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a PostgreSQL database
4. Click on the PostgreSQL service to see connection details

### Step 3: Configure Environment Variables

In your Railway project, click on your **web service** (not the database), then go to **"Variables"** tab.

Add these **required** environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Auto-linked from PostgreSQL | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | Production mode | `production` |
| `ENCRYPTION_KEY` | 32-byte base64 key for data encryption | Generate with: `openssl rand -base64 32` |
| `JWT_SECRET` | Secret for JWT tokens | Generate with: `openssl rand -base64 32` |
| `SESSION_SECRET` | Session encryption | Generate with: `openssl rand -base64 32` |

Add these **optional** environment variables (based on features you use):

| Variable | Service | Required For |
|----------|---------|--------------|
| `RAZORPAY_KEY_ID` | Razorpay | Indian payments |
| `RAZORPAY_KEY_SECRET` | Razorpay | Indian payments |
| `STRIPE_SECRET_KEY` | Stripe | International payments |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe | Stripe frontend |
| `TWILIO_ACCOUNT_SID` | Twilio | SMS notifications |
| `TWILIO_AUTH_TOKEN` | Twilio | SMS notifications |
| `TWILIO_PHONE_NUMBER` | Twilio | SMS notifications |
| `RESEND_API_KEY` | Resend | Email sending |
| `MAILGUN_API_KEY` | Mailgun | Email sending |
| `MAILGUN_DOMAIN` | Mailgun | Email sending |
| `GMAIL_CLIENT_ID` | Google | Gmail integration |
| `GMAIL_CLIENT_SECRET` | Google | Gmail integration |
| `OPENAI_API_KEY` | OpenAI | AI features |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI | AI features |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | AI features |
| `ANTHROPIC_API_KEY` | Anthropic | Claude AI |

### Step 4: Link Database URL

1. Click on your web service
2. Go to **"Variables"**
3. Click **"+ New Variable"**
4. Add: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - This links to your Railway PostgreSQL automatically

### Step 5: Configure Build Settings

Railway should auto-detect settings from `railway.json`, but verify:

1. Click on your web service
2. Go to **"Settings"**
3. Verify:
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`

### Step 6: Deploy

1. Railway auto-deploys on push to GitHub
2. Watch the **"Deployments"** tab for build progress
3. Once deployed, click **"Generate Domain"** to get your URL

### Step 7: Initialize Database

After first deployment, run database migrations:

1. In Railway, go to your web service
2. Click **"Settings"** → **"Deploy"**
3. Add a one-time deploy command or use Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run database push
railway run npm run db:push
```

Or add this to your build command temporarily:
```
npm ci && npm run build && npm run db:push
```

---

## Troubleshooting

### Build Fails
- Check that `NODE_ENV=production` is set
- Ensure all required environment variables are configured
- Check build logs for specific errors

### Database Connection Error
- Verify `DATABASE_URL` is correctly linked to PostgreSQL
- Check PostgreSQL service is running in Railway

### Health Check Fails
- The app needs ~30-60 seconds to initialize
- Check `/api/health` endpoint returns `{"status":"ok"}`
- Increase health check timeout if needed

### Missing Features
- Ensure all required API keys are set for specific features
- Check server logs for initialization errors

---

## Security Notes

1. **Never commit secrets to GitHub** - Use Railway environment variables
2. **Generate strong keys:**
   ```bash
   # Generate ENCRYPTION_KEY
   openssl rand -base64 32
   
   # Generate JWT_SECRET
   openssl rand -base64 32
   
   # Generate SESSION_SECRET
   openssl rand -base64 32
   ```
3. **Keep ENCRYPTION_KEY stable** - Changing it will break encrypted data
4. **Use Railway's secret references** for database URL

---

## Post-Deployment Checklist

- [ ] App loads at Railway URL
- [ ] Health check passes (`/api/health`)
- [ ] Can create account / login
- [ ] Database operations work
- [ ] AI features work (if API keys configured)
- [ ] Email features work (if configured)
- [ ] Payment features work (if configured)

---

## Custom Domain (Optional)

1. In Railway, go to your web service
2. Click **"Settings"** → **"Domains"**
3. Add your custom domain
4. Update DNS records as instructed by Railway
