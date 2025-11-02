# Accute Mobile App

React Native mobile application for Accute - AI-Powered Accounting Platform

## Features

- **Authentication**: Secure login with JWT token storage using Expo SecureStore
- **Dashboard**: Overview of active workflows, tasks, and team statistics
- **Tasks**: View and manage assigned tasks with status and priority
- **Teams**: Browse teams and view team members
- **Manager Dashboard**: Dedicated dashboard for managers to oversee reportee tasks
- **Settings**: Profile management and app preferences

## Tech Stack

- **Framework**: React Native with Expo (SDK 54)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Query v5 for server state
- **Authentication**: JWT with Expo SecureStore
- **HTTP Client**: Axios
- **UI**: React Native components with custom styling

## Prerequisites

- Node.js 20.x
- npm or yarn
- Expo Go app (for testing on physical devices)
- iOS Simulator (Mac only) or Android Emulator

## Getting Started

1. **Install dependencies**:
   ```bash
   cd mobile
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your API URL:
   ```
   EXPO_PUBLIC_API_URL=http://your-backend-url:5000
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Run on a platform**:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## Project Structure

```
mobile/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   ├── (manager)/         # Manager-specific screens
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Splash/redirect screen
├── services/              # API and auth services
├── contexts/              # React contexts (Auth)
├── components/            # Reusable components
├── types/                 # TypeScript type definitions
└── assets/                # Images, fonts, etc.
```

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS (Mac only)
- `npm run web` - Run in web browser

## Environment Variables

- `EXPO_PUBLIC_API_URL` - Backend API URL (required)

## Authentication

The app uses JWT tokens stored securely using Expo SecureStore. Tokens are automatically included in API requests via the ApiClient service.

## API Integration

All API calls go through the centralized `apiClient` in `services/api.ts`, which handles:
- JWT token management
- Request/response interceptors
- Error handling
- Automatic token refresh

## Building for Production

### iOS

```bash
npx eas build --platform ios
```

### Android

```bash
npx eas build --platform android
```

## License

Proprietary - Accute Platform
