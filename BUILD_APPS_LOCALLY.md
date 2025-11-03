# 🏠 Build Accute Mobile Apps Locally (Recommended)

## The Problem with Replit Shell

EAS CLI requires interactive terminal prompts, which don't work properly in Replit's Shell environment. This is a known limitation.

## ✅ Solution: Build on Your Local Machine

Building locally takes **5 minutes** to set up and works perfectly!

---

## Option 1: Build on Your Computer (Recommended)

### Step 1: Clone Your Replit Project

```bash
# On your local computer:
git clone https://your-replit-project-url.git
cd your-project/mobile
```

### Step 2: Install Dependencies

```bash
npm install
npm install -g eas-cli
```

### Step 3: Login to Expo

```bash
eas login
```

Use your existing Expo account (vithalv).

### Step 4: Build Android APK

```bash
eas build --platform android --profile production
```

**Answer the prompts:**
- Configure project? → **Yes**
- Generate keystore? → **Yes**

**Wait 15 minutes** for the build to complete.

### Step 5: Download & Upload to Replit

Once the build finishes:

1. **Download** the APK from the Expo dashboard
2. **Upload to Replit:**
   - Go to your Replit project
   - Upload the APK to `public/downloads/accute-mobile.apk`

### Step 6: Test It!

Visit `https://your-app.replit.app/mobile-apps` and click **Download APK**!

---

## Option 2: Use GitHub Actions (Automated)

### Step 1: Create `.github/workflows/build-mobile.yml`

```yaml
name: Build Mobile Apps

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: |
          cd mobile
          npm install

      - name: Build Android
        run: |
          cd mobile
          eas build --platform android --profile production --non-interactive

      - name: Build iOS
        run: |
          cd mobile
          eas build --platform ios --profile production --non-interactive
```

### Step 2: Add Expo Token Secret

1. Generate token: `eas whoami` → Get token from https://expo.dev/settings/access-tokens
2. Add to GitHub: Settings → Secrets → New secret: `EXPO_TOKEN`

### Step 3: Trigger Build

Push to GitHub or manually trigger the workflow!

---

## Option 3: Quick Demo (For Testing)

I can create placeholder APK/IPA files that demonstrate the download system works. You can replace them with real builds later.

---

## 🎯 Recommended Approach

**For Production:** Use Option 1 (build locally) or Option 2 (GitHub Actions)

**For Testing:** Use Option 3 (placeholders)

---

## Why This Approach?

✅ **Works immediately** - No fighting with Replit's Shell  
✅ **Full control** - See exactly what's happening  
✅ **Faster** - No debugging EAS in Replit  
✅ **Professional** - This is how real apps are built  

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Building locally | **FREE** ✅ |
| GitHub Actions (2,000 min/month) | **FREE** ✅ |
| Android builds | **FREE** ✅ |
| iOS builds | **FREE** ✅ (with Apple Dev account) |

---

## Need Help?

**Option A:** I can create demo files now for testing  
**Option B:** Follow the local build guide above  
**Option C:** Set up GitHub Actions automation  

Which would you prefer? 🚀
