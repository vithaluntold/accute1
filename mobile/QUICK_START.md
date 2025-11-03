# 🚀 Quick Start: Build Your Mobile Apps

## Prerequisites (One-Time Setup)

### 1. Create Expo Account (FREE)
👉 **Sign up:** https://expo.dev/signup

No credit card required!

### 2. For iOS Builds (Optional)
- Apple Developer Account: https://developer.apple.com
- Cost: $99/year
- **Skip this if building Android only**

---

## Option A: Automatic Build (Recommended)

### Using the Build Script

```bash
# From project root:
cd mobile
./build-apps.sh
```

The script will:
1. ✅ Install EAS CLI if needed
2. ✅ Prompt you to login to Expo
3. ✅ Ask which platform(s) to build
4. ✅ Submit the build
5. ✅ Give you download instructions

**Build time:**
- Android: ~15 minutes
- iOS: ~20-30 minutes

---

## Option B: Manual Build

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

Enter your Expo credentials.

### Step 3: Build Android APK

```bash
cd mobile
eas build --platform android --profile production
```

**Or build iOS IPA:**

```bash
eas build --platform ios --profile production
```

**Or build both:**

```bash
eas build --platform all --profile production
```

### Step 4: Monitor Build

```bash
# Check build status
eas build:list

# Or visit the dashboard
# https://expo.dev
```

### Step 5: Download & Deploy

Once build completes:

```bash
# Download from Expo dashboard, then:

# For Android:
cp ~/Downloads/accute-mobile-*.apk ../public/downloads/accute-mobile.apk

# For iOS:
cp ~/Downloads/accute-mobile-*.ipa ../public/downloads/accute-mobile.ipa
```

---

## Verify It Worked

1. **Visit your app:** `https://your-domain.com/mobile-apps`

2. **You should see:**
   - Purple "Native App Downloads" card
   - Download buttons for APK/IPA
   - File sizes displayed

3. **Test download:**
   - Click "Download APK" or "Download IPA"
   - File should download with correct filename

---

## First Time Building?

### Start with Android (No Apple account needed)

```bash
cd mobile
./build-apps.sh
# Choose option 1 (Android only)
```

**Why Android first?**
- ✅ Free (no developer account needed)
- ✅ Faster build (~15 min)
- ✅ Easier to test (install APK directly)
- ✅ Works on any Android device

---

## Troubleshooting

### "eas: command not found"

```bash
npm install -g eas-cli
```

### "Not logged in"

```bash
eas login
```

### "Build failed"

```bash
# Check logs
eas build:list
# Click on the failed build for details
```

### "iOS build requires Apple Developer account"

You have two options:
1. Build Android only (free)
2. Sign up for Apple Developer Program ($99/year)

---

## Build Status Commands

```bash
# List all builds
eas build:list

# Check specific build
eas build:view [build-id]

# Cancel a build
eas build:cancel

# View build logs
eas build:view [build-id] --logs
```

---

## What Happens During Build?

1. **Upload:** Your code is uploaded to Expo servers
2. **Install:** Dependencies are installed
3. **Compile:** Native code is compiled
4. **Sign:** App is signed (Android auto-signs)
5. **Package:** APK/IPA file is created
6. **Ready:** Download link is provided

---

## Next Steps After Building

### For Android:
1. Download APK
2. Transfer to Android device
3. Enable "Install from Unknown Sources"
4. Install and test

### For iOS:
1. Download IPA
2. Options:
   - Upload to TestFlight
   - Install via Xcode (for registered devices)
   - Use enterprise distribution

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Expo Account | **FREE** ✅ |
| EAS Build | **FREE** ✅ |
| Android Development | **FREE** ✅ |
| iOS Development | $99/year (Apple) |
| Google Play Publishing | $25 one-time (optional) |
| App Store Publishing | Included in Apple Dev |

**You can build and test apps for FREE** (Android only)!

---

## Support

- **EAS Build Docs:** https://docs.expo.dev/build/introduction/
- **Expo Discord:** https://chat.expo.dev/
- **Build Status:** https://expo.dev

---

## Quick Reference

```bash
# Install
npm install -g eas-cli

# Login  
eas login

# Build Android
eas build -p android

# Build iOS
eas build -p ios

# Build both
eas build -p all

# Check status
eas build:list

# Download and deploy
cp ~/Downloads/build-*.apk ../public/downloads/accute-mobile.apk
cp ~/Downloads/build-*.ipa ../public/downloads/accute-mobile.ipa
```

---

**Ready?** Run `./build-apps.sh` and follow the prompts! 🚀
