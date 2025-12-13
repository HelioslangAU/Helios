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

    // Click the button
    theaterButton.click();

    // Wait for theater mode to activate
    return this._waitForTheaterMode();
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

    // Click the button
    theaterButton.click();

    // Wait for theater mode to deactivate
    return this._waitForTheaterModeOff();
  }

  /**
   * Wait for theater mode to activate
   * @private
   * @returns {Promise<boolean>}
   */
  _waitForTheaterMode() {
    return new Promise((resolve) => {
      const checkTheaterMode = () => {
        if (this.isActive()) {
          this.isTheaterMode = true;
          this._notifyTheaterModeChange(true);
          resolve(true);
          return;
        }

        // Retry up to 20 times (2 seconds total)
        if (!this.theaterCheckCount) this.theaterCheckCount = 0;
        this.theaterCheckCount++;

        if (this.theaterCheckCount < 20) {
          setTimeout(checkTheaterMode, 100);
        } else {
          this.theaterCheckCount = 0;
          console.warn('[Helios] Theater mode activation timeout');
          resolve(false);
        }
      };

      checkTheaterMode();
    });
  }

  /**
   * Wait for theater mode to deactivate
   * @private
   * @returns {Promise<boolean>}
   */
  _waitForTheaterModeOff() {
    return new Promise((resolve) => {
      const checkTheaterMode = () => {
        if (!this.isActive()) {
          this.isTheaterMode = false;
          this._notifyTheaterModeChange(false);
          resolve(true);
          return;
        }

        // Retry up to 20 times (2 seconds total)
        if (!this.theaterOffCheckCount) this.theaterOffCheckCount = 0;
        this.theaterOffCheckCount++;

        if (this.theaterOffCheckCount < 20) {
          setTimeout(checkTheaterMode, 100);
        } else {
          this.theaterOffCheckCount = 0;
          console.warn('[Helios] Theater mode deactivation timeout');
          resolve(false);
        }
      };

      checkTheaterMode();
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
