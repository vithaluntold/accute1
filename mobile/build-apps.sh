#!/bin/bash
#
# Accute Mobile Apps Build Script
# This script builds both Android APK and iOS IPA using EAS Build
#

set -e

echo "🚀 Accute Mobile Apps Builder"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI not found${NC}"
    echo ""
    echo -e "${YELLOW}Installing EAS CLI...${NC}"
    npm install -g eas-cli
    echo -e "${GREEN}✅ EAS CLI installed${NC}"
fi

# Check EAS version
EAS_VERSION=$(eas --version)
echo -e "${BLUE}📦 EAS CLI version: ${EAS_VERSION}${NC}"
echo ""

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 Not logged in to Expo${NC}"
    echo ""
    echo "Please login to your Expo account:"
    echo "If you don't have an account, sign up at: https://expo.dev/signup"
    echo ""
    eas login
    echo ""
fi

EXPO_USER=$(eas whoami 2>/dev/null || echo "Not logged in")
echo -e "${GREEN}✅ Logged in as: ${EXPO_USER}${NC}"
echo ""

# Ask user what to build
echo "What would you like to build?"
echo ""
echo "1) Android APK only (recommended for first build)"
echo "2) iOS IPA only (requires Apple Developer account)"
echo "3) Both Android and iOS"
echo ""
read -p "Enter your choice (1-3): " CHOICE

case $CHOICE in
    1)
        PLATFORM="android"
        echo -e "${BLUE}📱 Building Android APK...${NC}"
        ;;
    2)
        PLATFORM="ios"
        echo -e "${BLUE}🍎 Building iOS IPA...${NC}"
        echo -e "${YELLOW}⚠️  Note: iOS builds require an Apple Developer account ($99/year)${NC}"
        ;;
    3)
        PLATFORM="all"
        echo -e "${BLUE}📱🍎 Building both Android and iOS...${NC}"
        echo -e "${YELLOW}⚠️  Note: iOS builds require an Apple Developer account ($99/year)${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}⏳ This will take 15-30 minutes per platform...${NC}"
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")"

# Build
if [ "$PLATFORM" = "all" ]; then
    eas build --platform all --profile production
else
    eas build --platform "$PLATFORM" --profile production
fi

echo ""
echo -e "${GREEN}✅ Build submitted successfully!${NC}"
echo ""
echo "📊 Check build status:"
echo "   eas build:list"
echo ""
echo "Or visit: https://expo.dev/accounts/$(eas whoami)/projects/accute-mobile/builds"
echo ""
echo -e "${BLUE}⏬ After the build completes:${NC}"
echo "1. Download the APK/IPA from the Expo dashboard"
echo "2. Copy to ../public/downloads/"
echo "   cp ~/Downloads/accute-mobile-*.apk ../public/downloads/accute-mobile.apk"
echo "   cp ~/Downloads/accute-mobile-*.ipa ../public/downloads/accute-mobile.ipa"
echo "3. The downloads will automatically appear on your /mobile-apps page!"
echo ""
