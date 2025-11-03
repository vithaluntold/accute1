# Accute Mobile App Deployment Guide

## 🎯 Overview

This guide explains how to build, sign, and deploy the Accute native mobile apps (Android APK & iOS IPA) for download from your web application.

## 📋 Prerequisites

### Required Accounts
- **Expo Account** (free): https://expo.dev/signup
- **Apple Developer Account** (iOS only, $99/year): https://developer.apple.com
- **Google Play Console** (Android only, $25 one-time): https://play.google.com/console

### Required Tools
```bash
# Install Node.js 20+ and npm
node --version  # Should be 20.x or higher

# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login
```

## 🔧 Initial Setup

### 1. Configure EAS Build

```bash
cd mobile
eas build:configure
```

This creates `eas.json` (already included in the project).

### 2. Update App Configuration

Edit `mobile/app.config.ts` to update:
- `version`: Current app version (e.g., "1.0.1")
- `ios.bundleIdentifier`: Your iOS bundle ID
- `android.package`: Your Android package name

## 🤖 Building Android APK

### Option A: Using EAS Build (Recommended)

```bash
cd mobile

# Production build
eas build --platform android --profile production

# Or preview build for testing
eas build --platform android --profile preview
```

**Build Time:** ~10-20 minutes

**Output:** APK file downloadable from Expo dashboard

### Option B: Local Build

```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

### 3. Deploy APK

```bash
# Download the APK from Expo dashboard, then:
cp ~/Downloads/accute-mobile-*.apk public/downloads/accute-mobile.apk
```

The APK is now available at: `https://your-domain.com/downloads/accute-mobile.apk`

## 🍎 Building iOS IPA

### Prerequisites for iOS

1. **Apple Developer Account** ($99/year)
2. **iOS Distribution Certificate**
3. **Provisioning Profile**

### 1. Create App Store Connect Record

1. Go to https://appstoreconnect.apple.com
2. Create new app with your bundle identifier
3. Fill in required metadata

### 2. Build IPA

```bash
cd mobile

# Production build (requires certificates)
eas build --platform ios --profile production

# Development build (for registered devices)
eas build --platform ios --profile development
```

**Build Time:** ~15-30 minutes

**Output:** IPA file downloadable from Expo dashboard

### 3. Deploy IPA

```bash
# Download the IPA from Expo dashboard, then:
cp ~/Downloads/accute-mobile-*.ipa public/downloads/accute-mobile.ipa
```

The IPA is now available at: `https://your-domain.com/downloads/accute-mobile.ipa`

## 📱 Distribution Methods

### Android Distribution

**Option 1: Direct APK Download** ✅ (Implemented)
- Users download APK from web app
- Must enable "Install from Unknown Sources"
- Best for beta testing and internal distribution

**Option 2: Google Play Store**
```bash
eas build --platform android --profile production
eas submit --platform android
```

### iOS Distribution

**Option 1: TestFlight** (Recommended)
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

**Option 2: Enterprise Distribution**
- Requires Apple Enterprise Developer account ($299/year)
- For internal company distribution only

**Option 3: Ad Hoc Distribution** ✅ (Implemented)
- Register device UDIDs in Apple Developer portal
- Build with development profile
- Users can install IPA directly

## 🔒 Code Signing

### Android Signing

```bash
# Generate keystore
keytool -genkey -v -keystore accute-release.keystore \
  -alias accute-key -keyalg RSA -keysize 2048 -validity 10000

# Store in Expo secrets
eas secret:create --scope project --name ANDROID_KEYSTORE_BASE64 \
  --value $(base64 -i accute-release.keystore)
```

### iOS Signing

EAS Build handles iOS signing automatically via Apple Developer portal.

## 🚀 Automated Deployment

### GitHub Actions Example

```yaml
name: Build Mobile Apps

on:
  push:
    tags:
      - 'mobile-v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - name: Install dependencies
        run: |
          cd mobile
          npm install
      
      - name: Build Android
        run: |
          npm install -g eas-cli
          cd mobile
          eas build --platform android --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
      
      - name: Download and Deploy APK
        run: |
          # Download from Expo (requires Expo API token)
          cp build-output.apk public/downloads/accute-mobile.apk
```

## 📊 Version Management

### Updating Version

1. Edit `mobile/app.config.ts`:
```typescript
version: '1.0.1', // Increment version
```

2. Rebuild apps:
```bash
eas build --platform all --profile production
```

3. Deploy new files to `public/downloads/`

### Version History

Keep track in `CHANGELOG.md`:
```markdown
## v1.0.1 (2025-01-15)
- Fixed login bug
- Improved dashboard performance
```

## 🔐 Security & CSP Compliance

### CSP Headers (Already Implemented)

The backend serves APK/IPA files with proper Content Security Policy headers:

```javascript
// APK Download
Content-Type: application/vnd.android.package-archive
Content-Disposition: attachment; filename=accute-mobile.apk
Content-Security-Policy: default-src 'none'; object-src 'none';
X-Content-Type-Options: nosniff
Cache-Control: public, max-age=86400

// IPA Download
Content-Type: application/octet-stream
Content-Disposition: attachment; filename=accute-mobile.ipa
Content-Security-Policy: default-src 'none'; object-src 'none';
X-Content-Type-Options: nosniff
Cache-Control: public, max-age=86400
```

### Security Best Practices

1. **Never commit signing keys** to git
2. **Use EAS Secrets** for sensitive data
3. **Enable two-factor auth** on Apple/Google accounts
4. **Rotate certificates** before expiration
5. **Sign all releases** with production certificates

## 📱 Testing Downloads

### Android Testing

1. Navigate to `/mobile-apps` in your web app
2. Click "Download APK" button
3. On Android device:
   - Enable Settings → Security → Unknown Sources
   - Download and install APK
   - Open app and verify functionality

### iOS Testing

1. Register device UDID in Apple Developer portal
2. Build with development profile including device
3. Download IPA from web app
4. Install via:
   - Xcode (Connect device, drag IPA to Devices window)
   - Apple Configurator 2
   - TestFlight (for production builds)

## 🆘 Troubleshooting

### "APK not available" Error

**Solution:** Build and deploy the APK first
```bash
cd mobile
eas build --platform android --profile production
# Then copy to public/downloads/
```

### iOS Build Fails

**Common Issues:**
- Missing Apple Developer account
- Incorrect bundle identifier
- Expired certificates

**Solution:**
```bash
eas credentials  # Manage credentials
eas build --platform ios --clear-cache  # Clear build cache
```

### Download Button Not Showing

**Check:**
1. Files exist in `public/downloads/`
2. API endpoint `/api/mobile-apps/info` returns data
3. Browser console for errors

## 📞 Support Resources

- **Expo Documentation**: https://docs.expo.dev
- **EAS Build Guide**: https://docs.expo.dev/build/introduction/
- **Apple Developer**: https://developer.apple.com/support/
- **Google Play Console**: https://support.google.com/googleplay/android-developer

## ✅ Checklist

### Before First Build
- [ ] Expo account created and logged in
- [ ] Apple Developer account (iOS only)
- [ ] Updated app.config.ts with correct identifiers
- [ ] Generated signing keys (Android)
- [ ] Configured bundle identifiers (iOS)

### For Each Release
- [ ] Increment version in app.config.ts
- [ ] Test app on physical devices
- [ ] Build APK/IPA with EAS
- [ ] Download builds from Expo
- [ ] Copy to public/downloads/
- [ ] Test download links
- [ ] Update CHANGELOG.md
- [ ] Tag release in git

### Post-Deployment
- [ ] Verify APK installs on Android
- [ ] Verify IPA installs on iOS (if applicable)
- [ ] Check analytics for download stats
- [ ] Monitor crash reports
- [ ] Respond to user feedback

---

**Last Updated:** 2025-11-03  
**Maintained By:** Accute Development Team
