/**
 * Theater Mode Controller
 *
 * Manages YouTube's theater mode state for optimal video player layout.
 * Provides a clean API to enable/disable theater mode and track its state.
 */
class TheaterModeController {
  constructor() {
    this.isTheaterMode = false;
    this.theaterChangeCallbacks = [];
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
   * Enable theater mode if not already enabled
   * @returns {Promise<boolean>} True if theater mode was enabled successfully
   */
  async enable() {
    // Check if already in theater mode
    if (this.isActive()) {
      this.isTheaterMode = true;
      return true;
    }

    // Find and click the theater mode button
    const theaterButton = document.querySelector('button.ytp-size-button');
    if (!theaterButton) {
      console.warn('[Helios] Theater mode button not found');
      return false;
    }

    // Click the button and wait for theater mode to activate
    theaterButton.click();
    return this._waitForTheaterMode(true);
  }

  /**
   * Disable theater mode if currently enabled
   * @returns {Promise<boolean>} True if theater mode was disabled successfully
   */
  async disable() {
    // Check if already not in theater mode
    if (!this.isActive()) {
      this.isTheaterMode = false;
      return true;
    }

    // Find and click the theater mode button
    const theaterButton = document.querySelector('button.ytp-size-button');
    if (!theaterButton) {
      console.warn('[Helios] Theater mode button not found');
      return false;
    }

    // Click the button and wait for theater mode to deactivate
    theaterButton.click();
    return this._waitForTheaterMode(false);
  }

  /**
   * Wait for theater mode to reach expected state
   * @private
   * @param {boolean} expectedState - Expected theater mode state
   * @returns {Promise<boolean>}
   */
  _waitForTheaterMode(expectedState = true) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds total (20 * 100ms)

      const checkState = () => {
        const currentState = this.isActive();

        if (currentState === expectedState) {
          this.isTheaterMode = expectedState;
          this._notifyTheaterModeChange(expectedState);
          resolve(true);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkState, 100);
        } else {
          console.warn(`[Helios] Theater mode ${expectedState ? 'activation' : 'deactivation'} timeout`);
          resolve(false);
        }
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
   * (e.g., user clicking the theater mode button)
   */
  observeTheaterModeChanges() {
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (!watchFlexy) return;

    // Use MutationObserver to watch for theater attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'theater') {
          const isNowTheater = this.isActive();
          if (isNowTheater !== this.isTheaterMode) {
            this.isTheaterMode = isNowTheater;
            this._notifyTheaterModeChange(isNowTheater);
          }
        }
      });
    });

    observer.observe(watchFlexy, {
      attributes: true,
      attributeFilter: ['theater']
    });

    this.theaterObserver = observer;
  }

  /**
   * Clean up and disconnect observers
   */
  cleanup() {
    if (this.theaterObserver) {
      this.theaterObserver.disconnect();
      this.theaterObserver = null;
    }
    this.theaterChangeCallbacks = [];
  }
}
