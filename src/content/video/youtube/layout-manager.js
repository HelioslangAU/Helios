/**
 * YouTube Layout Manager
 *
 * Manages YouTube page layout modifications for the Helios sidebar.
 * Uses a clean, modular approach that only affects the video player area,
 * not the entire page (unlike the old implementation).
 *
 * Key principles:
 * - Only modify #primary (video area), NOT #page-manager (entire page)
 * - Use CSS classes as single source of truth
 * - No inline styles where possible
 * - Proper cleanup on disable
 */
class YouTubeLayoutManager {
  constructor() {
    this.isActive = false;
    this.sidebarWidth = 420; // px
    this.observers = [];
    this.modifiedElements = new Set();
  }

  /**
   * Activate the sidebar layout modifications
   * This shrinks the video container to make room for the sidebar
   */
  activate() {
    if (this.isActive) return;

    console.log('[Helios Layout] Activating sidebar layout');

    // Add the primary layout class to the body
    // This triggers all CSS rules for the sidebar-active state
    document.body.classList.add('helios-sidebar-active');

    this.isActive = true;

    // Set up observer to maintain layout if YouTube fights back
    this._setupLayoutMaintenanceObserver();
  }

  /**
   * Deactivate the sidebar layout modifications
   * Returns the page to normal theater mode
   */
  deactivate() {
    if (!this.isActive) return;

    console.log('[Helios Layout] Deactivating sidebar layout');

    // Remove the layout class - CSS handles the rest
    document.body.classList.remove('helios-sidebar-active');

    this.isActive = false;

    // Clean up all observers
    this._disconnectAllObservers();

    // Remove any inline styles that may have been added
    this._cleanupInlineStyles();
  }

  /**
   * Set up a MutationObserver to re-apply layout if YouTube removes it
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
          if (this.isActive && !body.classList.contains('helios-sidebar-active')) {
            console.log('[Helios Layout] Re-applying sidebar-active class');
            body.classList.add('helios-sidebar-active');
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
      document.querySelector('#page-manager'),
      document.querySelector('ytd-watch-flexy'),
      document.querySelector('#primary'),
      document.querySelector('#secondary')
    ];

    elementsToClean.forEach(element => {
      if (element) {
        // Remove specific properties we may have set
        element.style.removeProperty('margin-right');
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
    return document.querySelector('.html5-video-player');
  }

  /**
   * Get the primary content container (video + metadata)
   * @returns {HTMLElement|null}
   */
  getPrimaryContainer() {
    return document.querySelector('ytd-watch-flexy #primary');
  }

  /**
   * Get the theater container element
   * @returns {HTMLElement|null}
   */
  getTheaterContainer() {
    return document.querySelector('ytd-watch-flexy[theater]');
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
   * Check if we're currently in theater mode
   * @returns {boolean}
   */
  isInTheaterMode() {
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    return watchFlexy?.hasAttribute('theater') || false;
  }

  /**
   * Clean up all modifications and observers
   */
  cleanup() {
    this.deactivate();
    this.modifiedElements.clear();
  }
}
