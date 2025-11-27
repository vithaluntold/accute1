// Accute Chrome Extension - Background Service Worker

// Configuration constants
const DEFAULT_API_URL = 'https://app.accute.ai'; // Production HTTPS default
const DEV_API_URL = 'http://localhost:5000'; // Dev only
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Accute extension installed');
    
    // Set default settings - HTTPS production URL
    chrome.storage.sync.set({
      apiUrl: DEFAULT_API_URL,
      autoAttachUrl: true,
      keyboardShortcuts: true
    });
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Accute Extension Installed',
      message: 'Click the extension icon to login and start adding tasks.'
    });
  }
});

// Token validation helper - checks if token is valid and not expired
async function isTokenValid() {
  const { authToken, authTokenExpiry } = await chrome.storage.local.get(['authToken', 'authTokenExpiry']);
  
  if (!authToken) return false;
  
  // Check expiration
  if (authTokenExpiry && Date.now() > authTokenExpiry) {
    // Token expired, clear it
    await chrome.storage.local.remove(['authToken', 'authTokenExpiry', 'authTokenTimestamp', 'user']);
    return false;
  }
  
  return true;
}

// Get valid auth token or null if expired
async function getValidAuthToken() {
  if (!await isTokenValid()) {
    // Broadcast expiry event to UI
    await broadcastAuthExpiry();
    return null;
  }
  const { authToken } = await chrome.storage.local.get('authToken');
  return authToken;
}

// Broadcast auth expiry to all extension UIs
async function broadcastAuthExpiry() {
  // Set badge to indicate logged out state
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  
  // Broadcast expiry event to popup/content scripts
  try {
    await chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' });
  } catch (e) {
    // Ignore errors if no listeners (popup not open)
  }
  
  // Disable context menu items
  try {
    chrome.contextMenus.update('accute-quick-add', { enabled: false });
    chrome.contextMenus.update('accute-capture', { enabled: false });
  } catch (e) {
    // Context menus may not exist yet
  }
}

// Restore auth state after successful login - clear expiry indicators
async function restoreAuthState() {
  // Clear badge
  chrome.action.setBadgeText({ text: '' });
  
  // Re-enable context menu items
  try {
    chrome.contextMenus.update('accute-quick-add', { enabled: true });
    chrome.contextMenus.update('accute-capture', { enabled: true });
  } catch (e) {
    // Context menus may not exist yet
  }
}

// Validate API URL is secure (HTTPS required except localhost)
function isSecureApiUrl(url) {
  try {
    const parsed = new URL(url);
    // Allow HTTP only for localhost/127.0.0.1
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
    // Require HTTPS for all other hosts
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-task') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      chrome.action.openPopup();
      return;
    }
    
    // Skip restricted URLs where content scripts can't run
    const restrictedPatterns = [
      /^chrome:\/\//,
      /^chrome-extension:\/\//,
      /^edge:\/\//,
      /^about:/,
      /^file:\/\//,
      /\.pdf$/i
    ];
    
    const isRestricted = restrictedPatterns.some(pattern => pattern.test(tab.url));
    
    if (isRestricted) {
      // Can't inject on restricted pages, open popup instead
      chrome.action.openPopup();
      return;
    }
    
    try {
      // Try to send message to existing content script
      await chrome.tabs.sendMessage(tab.id, { 
        type: 'SHOW_QUICK_ADD',
        pageInfo: { title: tab.title, url: tab.url }
      });
    } catch (error) {
      // Content script not loaded, inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content-script.js']
        });
        
        // Wait for script to initialize, then send message
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { 
              type: 'SHOW_QUICK_ADD',
              pageInfo: { title: tab.title, url: tab.url }
            });
          } catch (e) {
            chrome.action.openPopup();
          }
        }, 100);
      } catch (injectError) {
        // Injection failed, fall back to popup
        chrome.action.openPopup();
      }
    }
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_AUTH_STATUS':
      handleAuthStatus(sendResponse);
      return true; // Keep channel open for async response
      
    case 'CREATE_TASK':
      handleCreateTask(message.data, sendResponse);
      return true;
      
    case 'CAPTURE_PAGE':
      handleCapturePage(sender.tab, sendResponse);
      return true;
      
    case 'START_TIMER':
      handleStartTimer(message.data, sendResponse);
      return true;
  }
});

// Auth status check with expiry validation
async function handleAuthStatus(sendResponse) {
  try {
    const isValid = await isTokenValid();
    if (!isValid) {
      sendResponse({ authenticated: false });
      return;
    }
    
    const { user } = await chrome.storage.local.get('user');
    sendResponse({ 
      authenticated: true, 
      user 
    });
  } catch (error) {
    sendResponse({ authenticated: false, error: error.message });
  }
}

// Create task via API with security validation
async function handleCreateTask(taskData, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    
    // Validate API URL is secure
    if (!isSecureApiUrl(settings.apiUrl)) {
      sendResponse({ success: false, error: 'Insecure API URL - HTTPS required' });
      return;
    }
    
    // Get and validate auth token
    const authToken = await getValidAuthToken();
    if (!authToken) {
      sendResponse({ success: false, error: 'Session expired - please login again' });
      return;
    }
    
    const response = await fetch(`${settings.apiUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        ...taskData,
        source: 'chrome_extension'
      })
    });
    
    if (response.ok) {
      const task = await response.json();
      sendResponse({ success: true, task });
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon48.png',
        title: 'Task Created',
        message: `"${taskData.title}" has been added to Accute`
      });
    } else {
      const error = await response.json();
      sendResponse({ success: false, error: error.message });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Capture page screenshot with security validation
async function handleCapturePage(tab, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    
    // Validate API URL is secure
    if (!isSecureApiUrl(settings.apiUrl)) {
      sendResponse({ success: false, error: 'Insecure API URL - HTTPS required' });
      return;
    }
    
    // Get and validate auth token
    const authToken = await getValidAuthToken();
    if (!authToken) {
      sendResponse({ success: false, error: 'Session expired - please login again' });
      return;
    }
    
    // Capture visible tab
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    
    // Convert data URL to blob
    const response = await fetch(screenshot);
    const blob = await response.blob();
    
    // Create form data
    const formData = new FormData();
    formData.append('file', blob, `capture-${Date.now()}.png`);
    formData.append('source_url', tab.url);
    formData.append('source_title', tab.title);
    formData.append('type', 'page_capture');
    
    // Upload to Accute
    const uploadResponse = await fetch(`${settings.apiUrl}/api/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });
    
    if (uploadResponse.ok) {
      const document = await uploadResponse.json();
      sendResponse({ success: true, document });
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon48.png',
        title: 'Page Captured',
        message: `Screenshot saved to Accute documents`
      });
    } else {
      sendResponse({ success: false, error: 'Upload failed' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Start time tracking with security validation
async function handleStartTimer(data, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    
    // Validate API URL is secure
    if (!isSecureApiUrl(settings.apiUrl)) {
      sendResponse({ success: false, error: 'Insecure API URL - HTTPS required' });
      return;
    }
    
    // Get and validate auth token
    const authToken = await getValidAuthToken();
    if (!authToken) {
      sendResponse({ success: false, error: 'Session expired - please login again' });
      return;
    }
    
    const response = await fetch(`${settings.apiUrl}/api/time-tracking/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const entry = await response.json();
      sendResponse({ success: true, entry });
      
      // Update badge to show timer running
      chrome.action.setBadgeText({ text: '⏱' });
      chrome.action.setBadgeBackgroundColor({ color: '#e5a660' });
    } else {
      sendResponse({ success: false, error: 'Failed to start timer' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle auth callback from login page with security validation
chrome.webNavigation.onCompleted.addListener(async (details) => {
  try {
    const url = new URL(details.url);
    
    // Check if this is an auth callback
    if (!url.searchParams.has('extension_auth')) return;
    
    // Get stored settings and auth state for validation
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    const { authState } = await chrome.storage.local.get('authState');
    
    // Security: Validate callback origin matches configured API domain
    const configuredUrl = new URL(settings.apiUrl);
    if (url.host !== configuredUrl.host && url.host !== 'localhost') {
      console.error('Auth callback from untrusted origin:', url.host);
      return;
    }
    
    // Security: Validate state parameter (CSRF protection)
    const returnedState = url.searchParams.get('state');
    if (!authState || returnedState !== authState) {
      console.error('Auth callback state mismatch - potential CSRF attack');
      await chrome.storage.local.remove('authState');
      return;
    }
    
    const token = url.searchParams.get('token');
    const userJson = url.searchParams.get('user');
    
    if (token && userJson) {
      const user = JSON.parse(decodeURIComponent(userJson));
      
      // Store with timestamp for expiration (24 hour default)
      await chrome.storage.local.set({ 
        authToken: token, 
        authTokenTimestamp: Date.now(),
        authTokenExpiry: Date.now() + (24 * 60 * 60 * 1000),
        user 
      });
      
      // Clear the auth state
      await chrome.storage.local.remove('authState');
      
      // Restore auth state - clear expiry indicators
      await restoreAuthState();
      
      // Notify popup
      chrome.runtime.sendMessage({ 
        type: 'AUTH_SUCCESS', 
        token, 
        user 
      }).catch(() => {
        // Popup might be closed, that's ok
      });
      
      // Close the auth tab
      chrome.tabs.remove(details.tabId);
    }
  } catch (error) {
    console.error('Auth callback error:', error);
    await chrome.storage.local.remove('authState');
  }
}, { url: [{ urlMatches: '.*extension_auth.*' }] });

// Context menu for right-click quick add
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'accute-quick-add',
    title: 'Add to Accute Tasks',
    contexts: ['page', 'selection', 'link']
  });
  
  chrome.contextMenus.create({
    id: 'accute-capture',
    title: 'Capture Page for Accute',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'accute-quick-add':
      // Get selected text or page title
      const title = info.selectionText || tab.title;
      const url = info.linkUrl || tab.url;
      
      // Send to content script to show quick add overlay
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_QUICK_ADD',
          pageInfo: { title, url },
          prefill: { title: info.selectionText || '' }
        });
      } catch (error) {
        chrome.action.openPopup();
      }
      break;
      
    case 'accute-capture':
      handleCapturePage(tab, () => {});
      break;
  }
});

console.log('Accute extension service worker initialized');
