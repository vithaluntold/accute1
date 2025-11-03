# Building Accute Mobile Apps

## Prerequisites

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure Project**
   ```bash
   cd mobile
   eas build:configure
   ```

## Building Android APK

```bash
# Build APK for Android
eas build --platform android --profile production

# Or for preview/testing
eas build --platform android --profile preview
```

**Download Location:** After build completes, download the APK from the Expo dashboard or URL provided.

**Deploy to App:** Place the APK file in `/public/downloads/accute-mobile.apk`

## Building iOS IPA

```bash
# Build IPA for iOS (requires Apple Developer account)
eas build --platform ios --profile production
```

**Requirements:**
- Apple Developer account ($99/year)
- iOS Distribution Certificate
- Provisioning Profile

**Download Location:** After build completes, download the IPA from the Expo dashboard.

**Deploy to App:** Place the IPA file in `/public/downloads/accute-mobile.ipa`

## Build Both Platforms

```bash
eas build --platform all --profile production
```

## Automated Builds

Add these to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Build Android
  run: |
    npm install -g eas-cli
    eas build --platform android --profile production --non-interactive
```

## Post-Build Deployment

1. Download built files from Expo dashboard
2. Copy to `/public/downloads/`:
   - `accute-mobile.apk` (Android)
   - `accute-mobile.ipa` (iOS)
3. Files will be automatically served at:
   - `https://your-domain.com/downloads/accute-mobile.apk`
   - `https://your-domain.com/downloads/accute-mobile.ipa`

## Version Management

Update version in `app.config.ts`:

```typescript
version: '1.0.1', // Increment for each release
```

## Testing Builds

**Android:**
- Enable "Install from Unknown Sources" on device
- Download APK directly to phone
- Install and test

**iOS:**
- Use TestFlight for distribution
- Or use EAS internal distribution with registered devices

## Build Status

Check build status: `eas build:list`

## Support

- Expo Documentation: https://docs.expo.dev/build/introduction/
- EAS Build: https://docs.expo.dev/build/setup/
