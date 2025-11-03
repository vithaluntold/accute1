# 🎯 Quick Demo: Test Your Download System Now

Since EAS CLI doesn't work in Replit's Shell, let's create demo files to test your download system immediately!

## What Are Demo Files?

Demo APK/IPA files that:
- ✅ Show your download system works perfectly
- ✅ Let you test the UI and download flow
- ✅ Can be replaced with real builds later

## How to Create Demo Files

### Option 1: Using Placeholder Files

```bash
# In Replit Shell:
mkdir -p public/downloads

# Create demo APK (50 KB placeholder)
dd if=/dev/zero of=public/downloads/accute-mobile.apk bs=1024 count=50

# Create demo IPA (50 KB placeholder)
dd if=/dev/zero of=public/downloads/accute-mobile.ipa bs=1024 count=50

echo "Demo files created!"
```

### Option 2: Download Sample Files

Download pre-built demo apps from:
- https://github.com/expo/expo/releases

Then upload to `public/downloads/`

## Test Your Download System

1. Visit: `https://your-app.replit.app/mobile-apps`
2. Click **Download APK** or **Download IPA**
3. Files should download!

## Replace with Real Apps

Once you build real apps (locally or via GitHub Actions):

```bash
# Upload to Replit
cp ~/Downloads/your-real-app.apk public/downloads/accute-mobile.apk
cp ~/Downloads/your-real-app.ipa public/downloads/accute-mobile.ipa
```

## 🎯 Quick Command

Run this in Replit Shell to create demo files NOW:

```bash
mkdir -p public/downloads && \
dd if=/dev/zero of=public/downloads/accute-mobile.apk bs=1024 count=50 && \
dd if=/dev/zero of=public/downloads/accute-mobile.ipa bs=1024 count=50 && \
ls -lh public/downloads/
```

This creates 50 KB placeholder files so you can test the download UI immediately! 🚀
