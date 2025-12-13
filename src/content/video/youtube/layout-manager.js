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

    // FORCE YouTube to recalculate the video player size
    // This is the "nudge" that makes the video actually shrink to make room for sidebar
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      console.log('[Helios Layout] Forced video player resize for sidebar activation');
    }, 100);
  }

  /**
   * Deactivate the sidebar layout modifications
   * Returns the page to normal theater mode
   */
  deactivate() {
    if (!this.isActive) return;

    console.log('[Helios Layout] Deactivating sidebar layout');

    // Remove the layout class FIRST
    document.body.classList.remove('helios-sidebar-active');

    this.isActive = false;

    // Clean up all observers
    this._disconnectAllObservers();

    // AGGRESSIVELY reset the containers to YouTube's default theater mode
    const fullBleed = document.querySelector('#full-bleed-container');
    const theaterContainer = document.querySelector('#player-theater-container');
    const watchFlexy = document.querySelector('ytd-watch-flexy');

    if (fullBleed) {
      // Remove ALL our modifications
      fullBleed.style.cssText = '';
      void fullBleed.offsetHeight; // Force reflow
    }

    if (theaterContainer) {
      // Remove ALL our modifications
      theaterContainer.style.cssText = '';
      void theaterContainer.offsetHeight; // Force reflow
    }

    // Remove any inline styles that may have been added to other elements
    this._cleanupInlineStyles();

    // FORCE YouTube to recalculate layout by toggling theater mode off and back on
    // This is the "nudge" that makes YouTube reset everything
    if (watchFlexy && watchFlexy.hasAttribute('theater')) {
      console.log('[Helios Layout] Forcing YouTube layout refresh');

      // Temporarily exit theater mode
      watchFlexy.removeAttribute('theater');
      void watchFlexy.offsetHeight; // Force reflow

      // Immediately re-enter theater mode
      setTimeout(() => {
        watchFlexy.setAttribute('theater', '');
        void watchFlexy.offsetHeight; // Force reflow

        // FORCE the video player to resize by dispatching a resize event
        // This makes YouTube recalculate the video dimensions
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          console.log('[Helios Layout] Layout refresh complete - video player resized');
        }, 100);
      }, 50);
    }

    console.log('[Helios Layout] Video containers reset to default YouTube state');
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
      document.querySelector('#secondary'),
      document.querySelector('#full-bleed-container'),
      document.querySelector('#player-theater-container')
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
