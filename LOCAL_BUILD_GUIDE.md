# 🏠 Build Accute Mobile Apps on Your Local Computer

## Prerequisites

- Node.js 18+ installed
- Git installed
- Your Expo account credentials (vithalv)

---

## Step-by-Step Instructions

### 1. Get Your Replit Project URL

In Replit, click the **Version Control** tab to get your Git URL, or use:

```bash
git clone https://github.com/yourusername/your-repo.git
```

Or download the project as a ZIP and extract it.

---

### 2. Open Terminal on Your Computer

**Mac/Linux:** Open Terminal  
**Windows:** Open Command Prompt or PowerShell

---

### 3. Navigate to the Project

```bash
cd path/to/your-project/mobile
```

---

### 4. Install Dependencies

```bash
npm install
```

---

### 5. Install EAS CLI Globally

```bash
npm install -g eas-cli
```

---

### 6. Login to Expo

```bash
eas login
```

**Enter your credentials:**
- Username: `vithalv`
- Password: [your Expo password]

---

### 7. Build Android APK

```bash
eas build --platform android --profile production
```

**You'll be asked:**

1. **"Existing EAS project found. Configure this project?"**  
   Type: `y` and press Enter

2. **"Generate a new Android Keystore?"**  
   Type: `y` and press Enter

3. **Build starts!** (~15 minutes)

---

### 8. Monitor the Build

The terminal will show a URL like:
```
Build details: https://expo.dev/accounts/vithalv/projects/accute-mobile/builds/...
```

Open that URL in your browser to watch the progress.

---

### 9. Download the APK

Once the build completes:

1. The terminal will show a download link
2. **OR** visit: https://expo.dev/accounts/vithalv/projects/accute-mobile/builds
3. Click **Download** next to your build
4. Save as `accute-mobile.apk`

---

### 10. Upload to Replit

**Option A: Upload via Replit UI**
1. Go to your Replit project
2. Navigate to `public/downloads/` folder
3. Click **Upload** 
4. Upload the `accute-mobile.apk` file

**Option B: Use Git**
```bash
# In your local project root
cp mobile-build/accute-mobile.apk public/downloads/
git add public/downloads/accute-mobile.apk
git commit -m "Add Android APK"
git push
```

---

### 11. Test It!

Visit your Replit app:
```
https://your-app.replit.app/mobile-apps
```

Click **Download APK** - it should download your real app! 🎉

---

## Build iOS (Optional)

**Requirements:**
- Apple Developer Account ($99/year)
- Must be enrolled at: https://developer.apple.com

**Build command:**
```bash
eas build --platform ios --profile production
```

Then upload the IPA to `public/downloads/accute-mobile.ipa`

---

## Troubleshooting

### "eas: command not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas whoami
eas login
```

### Build fails
Check the build logs at:
```
https://expo.dev/accounts/vithalv/projects/accute-mobile/builds
```

---

## Commands Reference

```bash
# Check login status
eas whoami

# View all builds
eas build:list

# View specific build
eas build:view [build-id]

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Build both
eas build --platform all --profile production
```

---

## Next Steps

1. **Test the APK** on an Android device
2. **Build iOS** (if you have Apple Developer account)
3. **Update app version** in `mobile/app.json` for future releases

---

## Automation (Optional)

Once the first build works, you can automate future builds using:
- GitHub Actions
- Local scripts
- CI/CD pipelines

The first build **must** be interactive to set up credentials!

---

**Estimated Time:** 20 minutes (5 min setup + 15 min build)

Good luck! 🚀
