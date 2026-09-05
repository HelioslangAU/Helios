import type { YouTubeLayoutManager } from '@/content/video/youtube/layout-manager';

/**
 * Sidebar Positioner
 *
 * Handles positioning and sizing of the Helios sidebar relative to the video player.
 * Keeps the sidebar synchronized with video player dimensions and position.
 *
 * Key approach:
 * - Sidebar is positioned within the theater container's coordinate space
 * - Height matches video player exactly
 * - Top position aligns with video player top
 * - Uses ResizeObserver and IntersectionObserver for smooth tracking
 */
export class SidebarPositioner {
  sidebar: HTMLElement;
  layoutManager: YouTubeLayoutManager;
  resizeObserver: ResizeObserver | null;
  intersectionObserver: IntersectionObserver | null;
  isActive: boolean;
  syncDebounceTimer: ReturnType<typeof setTimeout> | null;

  // Timing constants
  SYNC_DEBOUNCE_DELAY: number;

  constructor(sidebarElement: HTMLElement, layoutManager: YouTubeLayoutManager) {
    this.sidebar = sidebarElement;
    this.layoutManager = layoutManager;
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.isActive = false;
    this.syncDebounceTimer = null;

    // Timing constants
    this.SYNC_DEBOUNCE_DELAY = 16; // ~60fps for smooth updates
  }

  /**
   * Start positioning the sidebar
   * Sets up observers to keep sidebar synchronized with video player
   */
  start(): void {
    if (this.isActive) return;

    // Initial position sync
    this._syncPosition();

    // Set up observers to maintain position
    this._setupResizeObserver();
    this._setupIntersectionObserver();

    this.isActive = true;
  }

  /**
   * Stop positioning and clean up observers
   */
  stop(): void {
    if (!this.isActive) return;

    // Clear any pending sync timers
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }

    this._disconnectObservers();

    this.isActive = false;
  }

  /**
   * Synchronize sidebar position with video player (debounced)
   * @private
   */
  _syncPosition(): void {
    // Debounce to avoid excessive updates
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(() => {
      this._syncPositionImmediate();
      this.syncDebounceTimer = null;
    }, this.SYNC_DEBOUNCE_DELAY);
  }

  /**
   * Immediately synchronize sidebar position (no debounce)
   * @private
   */
  _syncPositionImmediate(): void {
    const videoPlayer = this.layoutManager.getVideoPlayerContainer();
    const watchFlexy = document.querySelector('ytd-watch-flexy');

    if (!videoPlayer || !watchFlexy) {
      console.warn('[Helios Positioner] Video player or watch-flexy not found');
      return;
    }

    // Get dimensions
    const playerRect = videoPlayer.getBoundingClientRect();
    const watchFlexyRect = watchFlexy.getBoundingClientRect();

    // Calculate position relative to ytd-watch-flexy
    const topRelativeToWatchFlexy = playerRect.top - watchFlexyRect.top;

    // Update sidebar dimensions and position
    // Note: We don't use inline styles if possible - the CSS handles most positioning
    // We only update dynamic values that can't be predetermined
    this.sidebar.style.setProperty('height', `${playerRect.height}px`, 'important');
    this.sidebar.style.setProperty('top', `${topRelativeToWatchFlexy}px`, 'important');
  }

  /**
   * Set up ResizeObserver to watch for video player size changes
   * @private
   */
  _setupResizeObserver(): void {
    this._disconnectResizeObserver();

    const videoPlayer = this.layoutManager.getVideoPlayerContainer();
    if (!videoPlayer) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.isActive) {
        this._syncPosition();
      }
    });

    this.resizeObserver.observe(videoPlayer);
  }

  /**
   * Set up IntersectionObserver to watch for video player visibility changes
   * @private
   */
  _setupIntersectionObserver(): void {
    this._disconnectIntersectionObserver();

    const videoPlayer = this.layoutManager.getVideoPlayerContainer();
    if (!videoPlayer) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && this.isActive) {
            // Video player is visible, sync position
            this._syncPosition();
          }
        });
      },
      {
        threshold: [0, 0.1, 0.5, 0.9, 1.0]
      }
    );

    this.intersectionObserver.observe(videoPlayer);
  }

  /**
   * Disconnect resize observer
   * @private
   */
  _disconnectResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Disconnect intersection observer
   * @private
   */
  _disconnectIntersectionObserver(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  /**
   * Disconnect all observers
   * @private
   */
  _disconnectObservers(): void {
    this._disconnectResizeObserver();
    this._disconnectIntersectionObserver();
  }

  /**
   * Force an immediate position sync
   * Useful after layout changes or when sidebar visibility changes
   */
  forceSync(): void {
    // Clear any pending debounced sync and do it immediately
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    this._syncPositionImmediate();
  }

  /**
   * Clean up all observers and reset state
   */
  cleanup(): void {
    this.stop();

    // Remove any inline styles we added
    if (this.sidebar) {
      this.sidebar.style.removeProperty('height');
      this.sidebar.style.removeProperty('top');
    }
  }
}
