# Accute Chrome Extension

Quick task creation and AI-powered workflow automation for accounting professionals.

## Features

- **Quick Add Task**: Add tasks from any webpage with Ctrl+Shift+T (or Cmd+Shift+T on Mac)
- **Right-Click Context Menu**: Add selected text or page as a task
- **Page Capture**: Screenshot any page and save to Accute documents
- **Time Tracking**: Start a timer directly from the extension
- **AI Access**: Quick link to Accute AI agents

## Installation

### Development Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. The Accute icon should appear in your Chrome toolbar

### Creating Icons

Before loading the extension, you need to create icon files:

1. Copy your Accute logo to `chrome-extension/icons/`
2. Create 3 sizes: `icon16.png`, `icon48.png`, `icon128.png`
3. Or use the placeholder generator script (see below)

### Placeholder Icons (Development Only)

Create simple colored squares as placeholder icons:

```bash
# Using ImageMagick
convert -size 16x16 xc:#e5a660 icons/icon16.png
convert -size 48x48 xc:#e5a660 icons/icon48.png
convert -size 128x128 xc:#e5a660 icons/icon128.png
```

Or manually create PNG files with an "A" on a gradient background.

## Configuration

1. Click the Accute extension icon
2. Click the gear icon to open Settings
3. Set your Accute server URL (default: https://app.accute.ai)

**Security Note:** HTTPS is required for all non-localhost URLs. The extension will reject HTTP endpoints for remote servers.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+A` | Open extension popup |
| `Ctrl+Shift+T` | Quick add task overlay |

To customize shortcuts:
1. Go to `chrome://extensions/shortcuts`
2. Find "Accute - AI Practice Management"
3. Set your preferred shortcuts

## API Integration

The extension connects to your Accute server's API:

### Required Endpoints

```
POST /api/tasks              - Create task
GET  /api/clients            - List clients
POST /api/documents/upload   - Upload page captures
POST /api/time-tracking/start - Start time tracking
```

### Authentication

The extension stores auth tokens in Chrome's local storage after login.
To add extension auth support to your server, handle the `extension_auth` 
query parameter on successful login.

## Development

### File Structure

```
chrome-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── background/
│   └── service-worker.js   # Background service worker
├── content/
│   └── content-script.js   # Content script for page integration
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Building for Production

1. Update version in `manifest.json`
2. Create production icons (proper Accute branding)
3. Remove development server URLs
4. Zip the `chrome-extension` folder
5. Upload to Chrome Web Store

## Troubleshooting

### Extension Not Working

1. Check the console for errors (right-click icon → "Inspect popup")
2. Verify your Accute server is running
3. Check that you're logged in
4. Ensure the server URL is correct in settings

### Authentication Issues

1. Clear extension storage: Settings → Logout
2. Re-login to Accute
3. Check server logs for auth errors

### Content Script Issues

1. Refresh the page
2. Check that the site allows extensions (some block them)
3. Verify permissions in manifest.json

## Security Notes

- Auth tokens are stored in Chrome's local storage (encrypted by Chrome)
- The extension only communicates with your configured Accute server
- Page captures are sent directly to your server, not stored locally
- All API requests use HTTPS (when deployed)

## License

Copyright © 2025 Accute (FinACEverse). All rights reserved.
