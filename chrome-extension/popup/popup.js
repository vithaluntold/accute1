// Accute Chrome Extension - Popup Script

// Configuration
const DEFAULT_API_URL = 'https://app.accute.ai'; // Production HTTPS default

// State
let currentUser = null;
let clients = [];
let pageInfo = null;

// Listen for auth expiry broadcasts from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AUTH_EXPIRED') {
    currentUser = null;
    clients = [];
    // Clear form state
    document.getElementById('task-title').value = '';
    document.getElementById('task-notes').value = '';
    showView('auth');
    showStatus('Session expired - please login again', 'error');
  }
});

// Helper to validate API URL security before fetch
function isSecureApiUrl(url) {
  try {
    const parsed = new URL(url);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return isLocalhost || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// DOM Elements
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const taskForm = document.getElementById('task-form');
const statusMessage = document.getElementById('status-message');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkAuthStatus();
  await getCurrentPageInfo();
  setupEventListeners();
});

// Settings Management
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    apiUrl: DEFAULT_API_URL,
    autoAttachUrl: true,
    keyboardShortcuts: true
  });
  
  document.getElementById('api-url').value = settings.apiUrl;
  document.getElementById('auto-attach-url').checked = settings.autoAttachUrl;
  document.getElementById('keyboard-shortcuts').checked = settings.keyboardShortcuts;
  document.getElementById('attach-url').checked = settings.autoAttachUrl;
}

async function saveSettings() {
  const apiUrl = document.getElementById('api-url').value.trim() || DEFAULT_API_URL;
  
  // Validate HTTPS requirement (except localhost)
  try {
    const url = new URL(apiUrl);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLocalhost && url.protocol !== 'https:') {
      showStatus('HTTPS required for non-localhost URLs', 'error');
      return;
    }
  } catch (e) {
    showStatus('Invalid URL format', 'error');
    return;
  }
  
  const settings = {
    apiUrl,
    autoAttachUrl: document.getElementById('auto-attach-url').checked,
    keyboardShortcuts: document.getElementById('keyboard-shortcuts').checked
  };
  
  await chrome.storage.sync.set(settings);
  showStatus('Settings saved', 'success');
  showView('main');
}

// Auth
async function checkAuthStatus() {
  const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
  
  if (authToken && user) {
    currentUser = user;
    document.getElementById('user-email').textContent = user.email;
    showView('main');
    await loadClients();
  } else {
    showView('auth');
  }
}

async function login() {
  const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
  
  // Validate URL security before initiating login
  if (!isSecureApiUrl(settings.apiUrl)) {
    showStatus('Insecure API URL - update settings to use HTTPS', 'error');
    return;
  }
  
  // Generate a unique state for CSRF protection
  const state = crypto.randomUUID();
  await chrome.storage.local.set({ authState: state });
  
  const loginUrl = `${settings.apiUrl}/login?redirect=extension&state=${state}`;
  
  // Open login page in new tab
  chrome.tabs.create({ url: loginUrl });
  
  // Listen for auth callback from background script
  const authListener = (message) => {
    if (message.type === 'AUTH_SUCCESS') {
      // Store token with timestamp for expiration tracking
      chrome.storage.local.set({
        authToken: message.token,
        authTokenTimestamp: Date.now(),
        user: message.user
      }).then(() => {
        currentUser = message.user;
        document.getElementById('user-email').textContent = message.user.email;
        showView('main');
        loadClients();
      });
      chrome.runtime.onMessage.removeListener(authListener);
    }
  };
  
  chrome.runtime.onMessage.addListener(authListener);
  
  // Timeout for auth listener (30 minutes)
  setTimeout(() => {
    chrome.runtime.onMessage.removeListener(authListener);
  }, 30 * 60 * 1000);
}

async function logout() {
  await chrome.storage.local.remove(['authToken', 'user']);
  currentUser = null;
  clients = [];
  showView('auth');
}

// Page Info
async function getCurrentPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pageInfo = {
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl
      };
      
      document.getElementById('page-title-display').textContent = tab.title || tab.url;
    }
  } catch (error) {
    console.error('Error getting page info:', error);
  }
}

// Clients
async function loadClients() {
  try {
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    
    // Validate URL security before fetch
    if (!isSecureApiUrl(settings.apiUrl)) {
      showStatus('Insecure API URL - update settings to use HTTPS', 'error');
      return;
    }
    
    const { authToken } = await chrome.storage.local.get('authToken');
    
    const response = await fetch(`${settings.apiUrl}/api/clients`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      clients = await response.json();
      populateClientDropdown();
    }
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

function populateClientDropdown() {
  const select = document.getElementById('task-client');
  select.innerHTML = '<option value="">Select client...</option>';
  
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name || client.company_name || `Client ${client.id}`;
    select.appendChild(option);
  });
}

// Task Creation
async function createTask(event) {
  event.preventDefault();
  
  const title = document.getElementById('task-title').value.trim();
  if (!title) {
    showStatus('Please enter a task title', 'error');
    return;
  }
  
  const attachUrl = document.getElementById('attach-url').checked;
  
  const taskData = {
    title,
    client_id: document.getElementById('task-client').value || null,
    priority: document.getElementById('task-priority').value,
    due_date: document.getElementById('task-due').value || null,
    notes: document.getElementById('task-notes').value.trim(),
    source: 'chrome_extension',
    source_url: attachUrl && pageInfo ? pageInfo.url : null,
    source_title: attachUrl && pageInfo ? pageInfo.title : null
  };
  
  try {
    taskForm.classList.add('loading');
    
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    
    // Validate URL security before fetch
    if (!isSecureApiUrl(settings.apiUrl)) {
      showStatus('Insecure API URL - update settings to use HTTPS', 'error');
      taskForm.classList.remove('loading');
      return;
    }
    
    const { authToken } = await chrome.storage.local.get('authToken');
    
    const response = await fetch(`${settings.apiUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(taskData)
    });
    
    if (response.ok) {
      showStatus('Task created successfully!', 'success');
      resetForm();
      
      // Close popup after short delay
      setTimeout(() => window.close(), 1500);
    } else {
      const error = await response.json();
      showStatus(error.message || 'Failed to create task', 'error');
    }
  } catch (error) {
    console.error('Error creating task:', error);
    showStatus('Network error. Please try again.', 'error');
  } finally {
    taskForm.classList.remove('loading');
  }
}

function resetForm() {
  document.getElementById('task-title').value = '';
  document.getElementById('task-client').value = '';
  document.getElementById('task-priority').value = 'medium';
  document.getElementById('task-due').value = '';
  document.getElementById('task-notes').value = '';
}

// Quick Actions
async function startTimeTracker() {
  try {
    const settings = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
    
    // Validate URL security before fetch
    if (!isSecureApiUrl(settings.apiUrl)) {
      showStatus('Insecure API URL - update settings to use HTTPS', 'error');
      return;
    }
    
    const { authToken } = await chrome.storage.local.get('authToken');
    
    const response = await fetch(`${settings.apiUrl}/api/time-tracking/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        description: pageInfo?.title || 'Working',
        source_url: pageInfo?.url
      })
    });
    
    if (response.ok) {
      showStatus('Timer started!', 'success');
    } else {
      showStatus('Failed to start timer', 'error');
    }
  } catch (error) {
    showStatus('Network error', 'error');
  }
}

async function capturePage() {
  try {
    // Send message to content script to capture page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_PAGE' }, (response) => {
      if (response && response.success) {
        showStatus('Page captured!', 'success');
      }
    });
  } catch (error) {
    showStatus('Failed to capture page', 'error');
  }
}

function openAIChat() {
  chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL }, (settings) => {
    chrome.tabs.create({ url: `${settings.apiUrl}/ai-agents` });
  });
}

// View Management
function showView(viewName) {
  authView.classList.add('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.add('hidden');
  
  switch (viewName) {
    case 'auth':
      authView.classList.remove('hidden');
      break;
    case 'main':
      mainView.classList.remove('hidden');
      break;
    case 'settings':
      settingsView.classList.remove('hidden');
      break;
  }
}

// Status Messages
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 3000);
}

// Event Listeners
function setupEventListeners() {
  // Auth
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('register-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL }, (settings) => {
      chrome.tabs.create({ url: `${settings.apiUrl}/register` });
    });
  });
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Settings
  document.getElementById('settings-btn').addEventListener('click', () => showView('settings'));
  document.getElementById('back-btn').addEventListener('click', () => showView('main'));
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  
  // Task Form
  taskForm.addEventListener('submit', createTask);
  document.getElementById('cancel-btn').addEventListener('click', () => window.close());
  
  // Quick Actions
  document.getElementById('time-tracker-btn').addEventListener('click', startTimeTracker);
  document.getElementById('capture-btn').addEventListener('click', capturePage);
  document.getElementById('ai-btn').addEventListener('click', openAIChat);
}
