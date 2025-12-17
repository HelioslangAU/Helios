/**
 * Helios Toggle Button for Netflix Player
 *
 * Adds a toggle button to the Netflix video player controls
 * to show/hide the Helios sidebar and video layout adjustments.
 */
class NetflixToggleButton {
  constructor(sidebar) {
    this.sidebar = sidebar;
    this.button = null;
    this.isInjected = false;
  }

  /**
   * Initialize and inject the button into Netflix player controls
   */
  init() {
    if (this.isInjected) return;

    this._createButton();
    this._injectButton();
    this._setupEventListeners();

    this.isInjected = true;
  }

  /**
   * Create the toggle button element
   */
  _createButton() {
    this.button = document.createElement('button');
    this.button.className = 'helios-netflix-toggle-btn';
    this.button.title = 'Toggle Helios Sidebar (W)';
    this.button.setAttribute('aria-label', 'Toggle Helios Sidebar');
    this.button.setAttribute('data-uia', 'helios-toggle-button');

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
    if (document.getElementById('helios-netflix-toggle-button-styles')) return;

    const style = document.createElement('style');
    style.id = 'helios-netflix-toggle-button-styles';
    style.textContent = `
      .helios-netflix-toggle-btn {
        width: 48px;
        height: 48px;
        padding: 10px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.2s ease;
        vertical-align: middle;
        margin: 0 8px;
      }

      .helios-netflix-toggle-btn:hover {
        opacity: 0.7;
      }

      .helios-netflix-toggle-btn .helios-toggle-icon {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: brightness(0) invert(1);
        transition: filter 0.2s ease;
      }

      .helios-netflix-toggle-btn.active .helios-toggle-icon {
        filter: brightness(0) saturate(100%) invert(47%) sepia(96%) saturate(2488%) hue-rotate(202deg) brightness(100%) contrast(91%);
      }

      /* Style to match Netflix's native buttons */
      .watch-video--player-view .helios-netflix-toggle-btn {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inject button into Netflix player controls
   */
  _injectButton() {
    const injectIntoPlayer = () => {
      // Find Netflix player controls (bottom bar)
      const playerControls = document.querySelector('.PlayerControlsNeo__layout__top-start-controls, .PlayerControlsNeo__button-control-row');

      if (!playerControls) {
        console.warn('[Helios Netflix Toggle Button] Player controls not found, retrying...');
        setTimeout(injectIntoPlayer, 500);
        return;
      }

      // Remove existing button if any
      const existing = document.querySelector('.helios-netflix-toggle-btn');
      if (existing) {
        existing.remove();
      }

      // Insert Helios button as first item in controls
      playerControls.insertBefore(this.button, playerControls.firstChild);
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

    // Re-inject button on navigation (Netflix is a SPA)
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
      console.warn('[Helios Netflix Toggle Button] Sidebar not available');
      return;
    }

    // Toggle sidebar
    this.sidebar.toggle();

    // Update button state
    this._updateButtonState();
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
   * Check if current page is a Netflix watch page
   */
  _isWatchPage() {
    return window.location.pathname.includes('/watch');
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
