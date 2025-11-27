// Accute Chrome Extension - Content Script

// Quick Add Overlay Component
class AccuteQuickAdd {
  constructor() {
    this.overlay = null;
    this.isVisible = false;
  }
  
  createOverlay() {
    if (this.overlay) return this.overlay;
    
    const overlay = document.createElement('div');
    overlay.id = 'accute-quick-add-overlay';
    overlay.innerHTML = `
      <style>
        #accute-quick-add-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 2147483647;
          display: none;
          align-items: flex-start;
          justify-content: center;
          padding-top: 100px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        #accute-quick-add-overlay.visible {
          display: flex;
        }
        
        .accute-modal {
          background: #1a1a2e;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          animation: accute-slide-in 0.2s ease-out;
        }
        
        @keyframes accute-slide-in {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .accute-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .accute-modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .accute-modal-header .accute-logo {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #e5a660, #d76082);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          color: white;
        }
        
        .accute-close-btn {
          background: transparent;
          border: none;
          color: #a0a0b0;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        
        .accute-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        
        .accute-modal-body {
          padding: 20px;
        }
        
        .accute-form-group {
          margin-bottom: 16px;
        }
        
        .accute-form-group label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #a0a0b0;
          margin-bottom: 6px;
        }
        
        .accute-form-group input,
        .accute-form-group textarea,
        .accute-form-group select {
          width: 100%;
          padding: 10px 12px;
          background: #0a0a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #ffffff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .accute-form-group input:focus,
        .accute-form-group textarea:focus,
        .accute-form-group select:focus {
          border-color: #e5a660;
        }
        
        .accute-form-group textarea {
          resize: vertical;
          min-height: 80px;
        }
        
        .accute-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .accute-page-context {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #0a0a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 12px;
          color: #a0a0b0;
        }
        
        .accute-page-context input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #e5a660;
        }
        
        .accute-page-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #ffffff;
        }
        
        .accute-modal-footer {
          display: flex;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .accute-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .accute-btn-primary {
          background: linear-gradient(135deg, #e5a660, #d76082);
          color: white;
        }
        
        .accute-btn-primary:hover {
          opacity: 0.9;
        }
        
        .accute-btn-secondary {
          background: #252540;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .accute-btn-secondary:hover {
          background: #1a1a2e;
        }
        
        .accute-status {
          padding: 8px 12px;
          margin-bottom: 16px;
          border-radius: 6px;
          font-size: 13px;
          text-align: center;
        }
        
        .accute-status.success {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }
        
        .accute-status.error {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .accute-status.hidden {
          display: none;
        }
      </style>
      
      <div class="accute-modal">
        <div class="accute-modal-header">
          <h3>
            <span class="accute-logo">A</span>
            Quick Add Task
          </h3>
          <button class="accute-close-btn" id="accute-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="accute-modal-body">
          <div class="accute-status hidden" id="accute-status"></div>
          
          <div class="accute-form-group">
            <label for="accute-title">Task Title</label>
            <input type="text" id="accute-title" placeholder="What needs to be done?" autofocus>
          </div>
          
          <div class="accute-form-row">
            <div class="accute-form-group">
              <label for="accute-priority">Priority</label>
              <select id="accute-priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div class="accute-form-group">
              <label for="accute-due">Due Date</label>
              <input type="date" id="accute-due">
            </div>
          </div>
          
          <div class="accute-form-group">
            <label for="accute-notes">Notes</label>
            <textarea id="accute-notes" placeholder="Add any notes..."></textarea>
          </div>
          
          <div class="accute-form-group">
            <label>Source</label>
            <div class="accute-page-context">
              <input type="checkbox" id="accute-attach-url" checked>
              <span class="accute-page-title" id="accute-page-title"></span>
            </div>
          </div>
        </div>
        
        <div class="accute-modal-footer">
          <button class="accute-btn accute-btn-secondary" id="accute-cancel">Cancel</button>
          <button class="accute-btn accute-btn-primary" id="accute-submit">Add Task</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.overlay = overlay;
    
    // Setup event listeners
    overlay.querySelector('#accute-close').addEventListener('click', () => this.hide());
    overlay.querySelector('#accute-cancel').addEventListener('click', () => this.hide());
    overlay.querySelector('#accute-submit').addEventListener('click', () => this.submit());
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
    
    // Submit on Ctrl+Enter
    overlay.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        this.submit();
      }
    });
    
    return overlay;
  }
  
  show(pageInfo = {}, prefill = {}) {
    const overlay = this.createOverlay();
    
    // Update page info
    overlay.querySelector('#accute-page-title').textContent = pageInfo.title || document.title;
    
    // Prefill form
    if (prefill.title) {
      overlay.querySelector('#accute-title').value = prefill.title;
    }
    
    // Store page info
    this.pageInfo = {
      title: pageInfo.title || document.title,
      url: pageInfo.url || window.location.href
    };
    
    overlay.classList.add('visible');
    this.isVisible = true;
    
    // Focus title input
    setTimeout(() => {
      overlay.querySelector('#accute-title').focus();
    }, 100);
  }
  
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      this.isVisible = false;
      
      // Reset form
      this.overlay.querySelector('#accute-title').value = '';
      this.overlay.querySelector('#accute-notes').value = '';
      this.overlay.querySelector('#accute-priority').value = 'medium';
      this.overlay.querySelector('#accute-due').value = '';
      this.overlay.querySelector('#accute-status').classList.add('hidden');
    }
  }
  
  showStatus(message, type) {
    const status = this.overlay.querySelector('#accute-status');
    status.textContent = message;
    status.className = `accute-status ${type}`;
  }
  
  async submit() {
    const title = this.overlay.querySelector('#accute-title').value.trim();
    
    if (!title) {
      this.showStatus('Please enter a task title', 'error');
      return;
    }
    
    const attachUrl = this.overlay.querySelector('#accute-attach-url').checked;
    
    const taskData = {
      title,
      priority: this.overlay.querySelector('#accute-priority').value,
      due_date: this.overlay.querySelector('#accute-due').value || null,
      notes: this.overlay.querySelector('#accute-notes').value.trim(),
      source_url: attachUrl ? this.pageInfo.url : null,
      source_title: attachUrl ? this.pageInfo.title : null
    };
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_TASK',
        data: taskData
      });
      
      if (response.success) {
        this.showStatus('Task created successfully!', 'success');
        setTimeout(() => this.hide(), 1500);
      } else {
        this.showStatus(response.error || 'Failed to create task', 'error');
      }
    } catch (error) {
      this.showStatus('Error creating task', 'error');
    }
  }
}

// Initialize quick add overlay
const quickAdd = new AccuteQuickAdd();

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SHOW_QUICK_ADD':
      quickAdd.show(message.pageInfo, message.prefill);
      sendResponse({ success: true });
      break;
      
    case 'CAPTURE_PAGE':
      // Handled by background script directly
      sendResponse({ success: true });
      break;
  }
  
  return true;
});

// Log that content script is loaded
console.log('Accute extension content script loaded');
