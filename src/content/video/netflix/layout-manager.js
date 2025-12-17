/**
 * Netflix Layout Manager
 *
 * Manages Netflix page layout modifications for the Helios sidebar.
 * Uses a clean, modular approach similar to YouTube but adapted for Netflix's DOM structure.
 *
 * Key principles:
 * - Only modify the video player container area
 * - Use CSS classes as single source of truth
 * - No inline styles where possible
 * - Proper cleanup on disable
 */
class NetflixLayoutManager {
  constructor() {
    this.isActive = false;
    this.sidebarWidth = 420; // px
    this.observers = [];
    this.modifiedElements = new Set();

    // Race condition protection
    this.operationInProgress = false;
    this.pendingOperation = null;

    // Timing constants for smooth transitions
    this.RESIZE_DELAY = 100; // ms delay before triggering resize
  }

  /**
   * Activate the sidebar layout modifications
   * This shrinks the video container to make room for the sidebar
   */
  async activate() {
    if (this.isActive) return;

    // If operation is in progress, queue this activation
    if (this.operationInProgress) {
      this.pendingOperation = 'activate';
      return;
    }

    this.operationInProgress = true;

    try {
      // Add the primary layout class to the body
      // This triggers all CSS rules for the sidebar-active state
      document.body.classList.add('helios-sidebar-active-netflix');

      this.isActive = true;

      // Set up observer to maintain layout if Netflix fights back
      this._setupLayoutMaintenanceObserver();

      // Force Netflix to recalculate the video player size
      this._triggerVideoResize();
    } finally {
      this.operationInProgress = false;

      // Process any pending operation
      if (this.pendingOperation === 'deactivate') {
        this.pendingOperation = null;
        await this.deactivate();
      } else {
        this.pendingOperation = null;
      }
    }
  }

  /**
   * Deactivate the sidebar layout modifications
   * Returns the page to normal fullscreen mode
   */
  async deactivate() {
    if (!this.isActive) return;

    // If operation is in progress, queue this deactivation
    if (this.operationInProgress) {
      this.pendingOperation = 'deactivate';
      return;
    }

    this.operationInProgress = true;

    try {
      // Remove the layout class FIRST
      document.body.classList.remove('helios-sidebar-active-netflix');

      this.isActive = false;

      // Clean up all observers
      this._disconnectAllObservers();

      // Reset the containers to Netflix's default
      const videoContainer = document.querySelector('.watch-video');
      const playerContainer = document.querySelector('.NFPlayer');

      if (videoContainer) {
        // Remove ALL our modifications
        videoContainer.style.cssText = '';
        void videoContainer.offsetHeight; // Force reflow
      }

      if (playerContainer) {
        // Remove ALL our modifications
        playerContainer.style.cssText = '';
        void playerContainer.offsetHeight; // Force reflow
      }

      // Remove any inline styles that may have been added to other elements
      this._cleanupInlineStyles();

      // Trigger resize to force video player recalculation
      this._triggerVideoResize();
    } finally {
      this.operationInProgress = false;

      // Process any pending operation
      if (this.pendingOperation === 'activate') {
        this.pendingOperation = null;
        await this.activate();
      } else {
        this.pendingOperation = null;
      }
    }
  }

  /**
   * Set up a MutationObserver to re-apply layout if Netflix removes it
   * This is more targeted than the old implementation - only watches specific elements
   * @private
   */
  _setupLayoutMaintenanceObserver() {
    // Clean up any existing observer first
    this._disconnectAllObservers();

    const body = document.body;
    if (!body) return;

    // Observer to ensure body class stays applied
    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Only re-apply if we're supposed to be active and class is missing
          if (this.isActive && !body.classList.contains('helios-sidebar-active-netflix')) {
            body.classList.add('helios-sidebar-active-netflix');
          }
        }
      });
    });

    bodyObserver.observe(body, {
      attributes: true,
      attributeFilter: ['class']
    });

    this.observers.push(bodyObserver);
  }

  /**
   * Disconnect all MutationObservers
   * @private
   */
  _disconnectAllObservers() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Clean up any inline styles that may have been added
   * @private
   */
  _cleanupInlineStyles() {
    // Remove inline styles from elements we may have modified
    const elementsToClean = [
      document.querySelector('.watch-video'),
      document.querySelector('.NFPlayer'),
      document.querySelector('.watch-video--player-view'),
      document.querySelector('.sizing-wrapper')
    ];

    elementsToClean.forEach(element => {
      if (element) {
        // Remove specific properties we may have set
        element.style.removeProperty('margin-right');
        element.style.removeProperty('margin-left');
        element.style.removeProperty('position');
        element.style.removeProperty('max-width');
        element.style.removeProperty('width');
      }
    });
  }

  /**
   * Get the current video player container
   * @returns {HTMLElement|null}
   */
  getVideoPlayerContainer() {
    return document.querySelector('.NFPlayer') || document.querySelector('.watch-video--player-view');
  }

  /**
   * Get the primary content container (video + controls)
   * @returns {HTMLElement|null}
   */
  getPrimaryContainer() {
    return document.querySelector('.watch-video');
  }

  /**
   * Get the dimensions of the video player
   * @returns {DOMRect|null}
   */
  getVideoPlayerDimensions() {
    const player = this.getVideoPlayerContainer();
    return player ? player.getBoundingClientRect() : null;
  }

  /**
   * Check if we're currently in fullscreen mode
   * @returns {boolean}
   */
  isInFullscreen() {
    return document.fullscreenElement !== null ||
           document.webkitFullscreenElement !== null;
  }

  /**
   * Trigger a window resize event to force Netflix to recalculate video dimensions
   * @private
   */
  _triggerVideoResize() {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, this.RESIZE_DELAY);
  }

  /**
   * Clean up all modifications and observers
   */
  cleanup() {
    this.deactivate();
    this.modifiedElements.clear();
  }
}
