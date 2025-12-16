/**
 * Helios Toggle Button for YouTube Player
 *
 * Adds a toggle button to the bottom-right corner of the YouTube video player
 * to show/hide the Helios sidebar and video layout adjustments.
 */
class HeliosToggleButton {
  constructor(sidebar) {
    this.sidebar = sidebar;
    this.button = null;
    this.isInjected = false;
  }

  /**
   * Initialize and inject the button into YouTube player controls
   */
  init() {
    if (this.isInjected) return;

    this._createButton();
    this._injectButton();
    this._setupEventListeners();

    this.isInjected = true;
    console.log('[Helios Toggle Button] Initialized');
  }

  /**
   * Create the toggle button element
   */
  _createButton() {
    this.button = document.createElement('button');
    this.button.className = 'helios-youtube-toggle-btn ytp-button';
    this.button.title = 'Toggle Helios Sidebar (W)';
    this.button.setAttribute('aria-label', 'Toggle Helios Sidebar');

    // Create image element for Helios logo
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icons/icon48.png');
    img.className = 'helios-toggle-icon';
    img.alt = 'Helios';
    this.button.appendChild(img);

    // Add CSS styles
    this._injectStyles();

    // Update button state based on sidebar visibility
    this._updateButtonState();
  }

  /**
   * Inject CSS styles for the button
   */
  _injectStyles() {
    if (document.getElementById('helios-toggle-button-styles')) return;

    const style = document.createElement('style');
    style.id = 'helios-toggle-button-styles';
    style.textContent = `
      .helios-youtube-toggle-btn {
        width: 36px;
        height: 36px;
        padding: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.1s cubic-bezier(0.4, 0.0, 1, 1);
        vertical-align: top;
      }

      .helios-youtube-toggle-btn:hover {
        opacity: 0.7;
      }

      .helios-youtube-toggle-btn .helios-toggle-icon {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: brightness(0) invert(1);
        transition: filter 0.2s ease;
      }

      .helios-youtube-toggle-btn.active .helios-toggle-icon {
        filter: brightness(0) saturate(100%) invert(47%) sepia(96%) saturate(2488%) hue-rotate(202deg) brightness(100%) contrast(91%);
      }

      /* Style to match YouTube's native buttons */
      .ytp-chrome-controls .helios-youtube-toggle-btn {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inject button into YouTube player controls, next to autoplay toggle
   */
  _injectButton() {
    const injectIntoPlayer = () => {
      // Find the right controls section where autoplay lives
      const rightControls = document.querySelector('.ytp-right-controls');

      if (!rightControls) {
        console.warn('[Helios Toggle Button] Right controls not found, retrying...');
        setTimeout(injectIntoPlayer, 500);
        return;
      }

      // Remove existing button if any
      const existing = document.querySelector('.helios-youtube-toggle-btn');
      if (existing) {
        existing.remove();
      }

      // Find the autoplay button (it's usually first or second in right controls)
      const autoplayButton = rightControls.querySelector('.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]');

      if (autoplayButton) {
        // Insert Helios button right before autoplay button
        rightControls.insertBefore(this.button, autoplayButton);
        console.log('[Helios Toggle Button] Injected next to autoplay button');
      } else {
        // Fallback: insert as first item in right controls
        rightControls.insertBefore(this.button, rightControls.firstChild);
        console.log('[Helios Toggle Button] Injected at start of right controls (autoplay not found)');
      }
    };

    injectIntoPlayer();
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Button click handler
    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._handleToggle();
    });

    // Listen for sidebar visibility changes to update button state
    // Store handler so we can remove it on destroy
    this._visibilityChangedHandler = (e) => {
      this._updateButtonState();
    };
    document.addEventListener('helios-sidebar-visibility-changed', this._visibilityChangedHandler);

    // Re-inject button on navigation (YouTube is a SPA)
    // Store interval so we can clear it on destroy
    let lastUrl = window.location.href;
    this.navigationInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (this._isWatchPage()) {
          setTimeout(() => this._injectButton(), 500);
        }
      }
    }, 1000);
  }

  /**
   * Handle button toggle
   */
  _handleToggle() {
    if (!this.sidebar) {
      console.warn('[Helios Toggle Button] Sidebar not available');
      return;
    }

    // Toggle sidebar
    this.sidebar.toggle();

    // Update button state
    this._updateButtonState();

    console.log('[Helios Toggle Button] Toggled sidebar:', this.sidebar.isVisible ? 'visible' : 'hidden');
  }

  /**
   * Update button visual state based on sidebar visibility
   */
  _updateButtonState() {
    if (!this.button || !this.sidebar) return;

    if (this.sidebar.isVisible) {
      this.button.classList.add('active');
      this.button.title = 'Hide Helios Sidebar (W)';
    } else {
      this.button.classList.remove('active');
      this.button.title = 'Show Helios Sidebar (W)';
    }
  }

  /**
   * Check if current page is a YouTube watch page
   */
  _isWatchPage() {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
  }

  /**
   * Show button
   */
  show() {
    if (this.button) {
      this.button.style.display = 'flex';
    }
  }

  /**
   * Hide button
   */
  hide() {
    if (this.button) {
      this.button.style.display = 'none';
    }
  }

  /**
   * Destroy button
   */
  destroy() {
    // Clear navigation interval
    if (this.navigationInterval) {
      clearInterval(this.navigationInterval);
      this.navigationInterval = null;
    }

    // Remove event listener
    if (this._visibilityChangedHandler) {
      document.removeEventListener('helios-sidebar-visibility-changed', this._visibilityChangedHandler);
      this._visibilityChangedHandler = null;
    }

    // Remove button from DOM
    if (this.button && this.button.parentElement) {
      this.button.parentElement.removeChild(this.button);
    }
    this.button = null;
    this.isInjected = false;
  }
}
