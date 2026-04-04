/**
 * Theater Mode Controller
 *
 * Manages YouTube's theater mode state for optimal video player layout.
 * Provides a clean API to enable/disable theater mode and track its state.
 *
 * Enhanced with:
 * - Persistent enforcement to keep theater mode enabled
 * - Robust button finding with multiple fallback strategies
 * - Automatic retry mechanisms
 * - Protection against user or YouTube disabling theater mode
 */
class TheaterModeController {
  constructor() {
    this.isTheaterMode = false;
    this.theaterChangeCallbacks = [];
    this.enforcementEnabled = false;
    this.enforcementInterval = null;
    this.theaterObserver = null;

    // Configuration
    this.ENFORCEMENT_CHECK_INTERVAL = 500; // Check every 500ms
    this.MAX_BUTTON_FIND_ATTEMPTS = 15; // Increased attempts
    this.BUTTON_FIND_RETRY_DELAY = 300; // 300ms between attempts
    this.THEATER_ACTIVATION_TIMEOUT = 3000; // 3 seconds max wait
  }

  /**
   * Check if theater mode is currently active
   * @returns {boolean} True if theater mode is active
   */
  isActive() {
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    return watchFlexy?.hasAttribute('theater') || false;
  }

  /**
   * Find the theater mode button using multiple strategies
   * @private
   * @returns {Promise<HTMLElement|null>} The theater button or null
   */
  async _findTheaterButton() {
    let attempts = 0;

    while (attempts < this.MAX_BUTTON_FIND_ATTEMPTS) {
      // Strategy 1: Direct class selector
      let button = document.querySelector('button.ytp-size-button');
      if (button) return button;

      // Strategy 2: Without 'button' prefix
      button = document.querySelector('.ytp-size-button');
      if (button) return button;

      // Strategy 3: Search by title/aria-label containing 'theater'
      const allButtons = document.querySelectorAll('button.ytp-button');
      button = Array.from(allButtons).find(btn => {
        const title = btn.getAttribute('title')?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        return title.includes('theater') || ariaLabel.includes('theater');
      });
      if (button) return button;

      // Strategy 4: Search in player controls
      const playerControls = document.querySelector('.ytp-right-controls');
      if (playerControls) {
        const buttons = playerControls.querySelectorAll('button');
        button = Array.from(buttons).find(btn => {
          const title = btn.getAttribute('title')?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          return title.includes('theater') ||
                 ariaLabel.includes('theater') ||
                 title.includes('wide') ||
                 ariaLabel.includes('wide');
        });
        if (button) return button;
      }

      // Strategy 5: Look for the size button icon
      button = document.querySelector('button[data-tooltip-target-id*="theater"]');
      if (button) return button;

      attempts++;
      if (attempts < this.MAX_BUTTON_FIND_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, this.BUTTON_FIND_RETRY_DELAY));
      }
    }

    return null;
  }

  /**
   * Enable theater mode if not already enabled
   * Enhanced with better error handling and enforcement
   * @param {boolean} enableEnforcement - Whether to continuously enforce theater mode
   * @returns {Promise<boolean>} True if theater mode was enabled successfully
   */
  async enable(enableEnforcement = true) {
    console.log('[Helios Theater] Enabling theater mode...');

    // Check if already in theater mode
    if (this.isActive()) {
      console.log('[Helios Theater] Already in theater mode');
      this.isTheaterMode = true;

      // Start enforcement if requested
      if (enableEnforcement) {
        this._startEnforcement();
      }

      return true;
    }

    // Find the theater button with retry logic
    const theaterButton = await this._findTheaterButton();

    if (!theaterButton) {
      console.error('[Helios Theater] Theater mode button not found after', this.MAX_BUTTON_FIND_ATTEMPTS, 'attempts');

      // Try to force theater mode by setting the attribute directly (fallback)
      const watchFlexy = document.querySelector('ytd-watch-flexy');
      if (watchFlexy && !watchFlexy.hasAttribute('theater')) {
        console.log('[Helios Theater] Attempting direct attribute manipulation as fallback');
        watchFlexy.setAttribute('theater', '');

        // Wait a bit and check if it worked
        await new Promise(resolve => setTimeout(resolve, 500));

        if (this.isActive()) {
          console.log('[Helios Theater] Direct attribute manipulation successful');
          this.isTheaterMode = true;

          if (enableEnforcement) {
            this._startEnforcement();
          }

          return true;
        }
      }

      return false;
    }

    console.log('[Helios Theater] Found theater button, clicking...');

    // Click the button and wait for theater mode to activate
    theaterButton.click();
    const success = await this._waitForTheaterMode(true);

    if (success && enableEnforcement) {
      this._startEnforcement();
    }

    return success;
  }

  /**
   * Disable theater mode if currently enabled
   * Note: This also stops the enforcement mechanism
   * @returns {Promise<boolean>} True if theater mode was disabled successfully
   */
  async disable() {
    console.log('[Helios Theater] Disabling theater mode...');

    // Stop enforcement first
    this._stopEnforcement();

    // Check if already not in theater mode
    if (!this.isActive()) {
      this.isTheaterMode = false;
      console.log('[Helios Theater] Already not in theater mode');
      return true;
    }

    // Find the theater mode button
    const theaterButton = await this._findTheaterButton();

    if (!theaterButton) {
      console.warn('[Helios Theater] Theater mode button not found, trying direct attribute removal');

      // Fallback: remove attribute directly
      const watchFlexy = document.querySelector('ytd-watch-flexy');
      if (watchFlexy && watchFlexy.hasAttribute('theater')) {
        watchFlexy.removeAttribute('theater');

        await new Promise(resolve => setTimeout(resolve, 500));

        if (!this.isActive()) {
          this.isTheaterMode = false;
          console.log('[Helios Theater] Direct attribute removal successful');
          return true;
        }
      }

      return false;
    }

    // Click the button and wait for theater mode to deactivate
    theaterButton.click();
    return this._waitForTheaterMode(false);
  }

  /**
   * Start enforcement mechanism to keep theater mode enabled
   * This continuously checks and re-enables theater mode if it gets disabled
   * @private
   */
  _startEnforcement() {
    if (this.enforcementEnabled) {
      console.log('[Helios Theater] Enforcement already running');
      return;
    }

    console.log('[Helios Theater] Starting theater mode enforcement');
    this.enforcementEnabled = true;

    // Clear any existing interval
    if (this.enforcementInterval) {
      clearInterval(this.enforcementInterval);
    }

    // Check theater mode state periodically and re-enable if needed
    this.enforcementInterval = setInterval(async () => {
      if (!this.enforcementEnabled) {
        return;
      }

      // Only enforce on watch pages
      const isWatchPage = window.location.pathname === '/watch';
      if (!isWatchPage) {
        return;
      }

      // Check if theater mode is still active
      if (!this.isActive()) {
        console.log('[Helios Theater] Theater mode was disabled, re-enabling...');

        // Try to re-enable without starting another enforcement loop
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        if (watchFlexy) {
          watchFlexy.setAttribute('theater', '');

          // Notify of change
          this.isTheaterMode = true;
          this._notifyTheaterModeChange(true);
        }
      }
    }, this.ENFORCEMENT_CHECK_INTERVAL);
  }

  /**
   * Stop enforcement mechanism
   * @private
   */
  _stopEnforcement() {
    console.log('[Helios Theater] Stopping theater mode enforcement');
    this.enforcementEnabled = false;

    if (this.enforcementInterval) {
      clearInterval(this.enforcementInterval);
      this.enforcementInterval = null;
    }
  }

  /**
   * Wait for theater mode to reach expected state
   * Enhanced with better timeout handling
   * @private
   * @param {boolean} expectedState - Expected theater mode state
   * @returns {Promise<boolean>}
   */
  _waitForTheaterMode(expectedState = true) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const maxWaitTime = this.THEATER_ACTIVATION_TIMEOUT;
      const checkInterval = 100; // Check every 100ms

      const checkState = () => {
        const currentState = this.isActive();
        const elapsed = Date.now() - startTime;

        if (currentState === expectedState) {
          console.log(`[Helios Theater] Theater mode ${expectedState ? 'enabled' : 'disabled'} successfully (${elapsed}ms)`);
          this.isTheaterMode = expectedState;
          this._notifyTheaterModeChange(expectedState);
          resolve(true);
          return;
        }

        if (elapsed >= maxWaitTime) {
          console.warn(`[Helios Theater] Theater mode ${expectedState ? 'activation' : 'deactivation'} timeout after ${elapsed}ms`);

          // Even if timeout, if we're trying to enable and we see the attribute, consider it success
          if (expectedState && currentState) {
            console.log('[Helios Theater] Theater mode attribute detected despite timeout, considering success');
            this.isTheaterMode = true;
            this._notifyTheaterModeChange(true);
            resolve(true);
          } else {
            resolve(false);
          }
          return;
        }

        setTimeout(checkState, checkInterval);
      };

      checkState();
    });
  }

  /**
   * Register a callback to be notified when theater mode changes
   * @param {Function} callback - Called with (isTheaterMode: boolean)
   */
  onTheaterModeChange(callback) {
    this.theaterChangeCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks of theater mode change
   * @private
   * @param {boolean} isActive
   */
  _notifyTheaterModeChange(isActive) {
    this.theaterChangeCallbacks.forEach(callback => {
      try {
        callback(isActive);
      } catch (error) {
        console.error('[Helios] Error in theater mode change callback:', error);
      }
    });
  }

  /**
   * Set up observer to watch for external theater mode changes
   * Enhanced to re-enable theater mode if enforcement is active
   * (e.g., user clicking the theater mode button or YouTube changing layout)
   */
  observeTheaterModeChanges() {
    // Clean up existing observer if any
    if (this.theaterObserver) {
      this.theaterObserver.disconnect();
      this.theaterObserver = null;
    }

    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (!watchFlexy) {
      console.warn('[Helios Theater] ytd-watch-flexy not found, will retry observer setup');

      // Retry after a delay
      setTimeout(() => {
        this.observeTheaterModeChanges();
      }, 1000);

      return;
    }

    // Use MutationObserver to watch for theater attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'theater') {
          const isNowTheater = this.isActive();

          // If theater mode changed
          if (isNowTheater !== this.isTheaterMode) {
            console.log(`[Helios Theater] Theater mode changed: ${this.isTheaterMode} -> ${isNowTheater}`);

            // If enforcement is enabled and theater mode was disabled, re-enable it
            if (this.enforcementEnabled && !isNowTheater) {
              console.log('[Helios Theater] Enforcement active: re-enabling theater mode');
              watchFlexy.setAttribute('theater', '');
              this.isTheaterMode = true;
              this._notifyTheaterModeChange(true);
            } else {
              // Otherwise just update our state and notify
              this.isTheaterMode = isNowTheater;
              this._notifyTheaterModeChange(isNowTheater);
            }
          }
        }
      });
    });

    observer.observe(watchFlexy, {
      attributes: true,
      attributeFilter: ['theater']
    });

    this.theaterObserver = observer;
    console.log('[Helios Theater] Observer set up successfully');
  }

  /**
   * Clean up and disconnect observers
   * Enhanced to also stop enforcement
   */
  cleanup() {
    console.log('[Helios Theater] Cleaning up theater mode controller');

    // Stop enforcement
    this._stopEnforcement();

    // Disconnect observer
    if (this.theaterObserver) {
      this.theaterObserver.disconnect();
      this.theaterObserver = null;
    }

    // Clear callbacks
    this.theaterChangeCallbacks = [];

    // Reset state
    this.isTheaterMode = false;
  }

  /**
   * Get enforcement status
   * @returns {boolean} True if enforcement is active
   */
  isEnforcementActive() {
    return this.enforcementEnabled;
  }
}
