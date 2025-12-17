/**
 * Helios Platform Video Sidebar Controller
 * Generic sidebar for Netflix, Disney+, Prime, and other streaming platforms
 * Works exactly like YouTube sidebar but with platform-agnostic positioning
 */
class PlatformVideoSidebar {
  constructor() {
    this.sidebar = null;
    this.listContainer = null;
    this.currentSubtitles = [];
    this.currentTrack = null;
    this.videoBinding = null;
    this.isVisible = false;
    this.activeIndex = -1;
    this.currentSecondarySubtitles = [];
    this.resizeObserver = null;

    // Scroll detection
    this.userIsScrollingSidebar = false;
    this.sidebarScrollTimeout = null;
    this.isAutoScrolling = false;
    this.mouseInScrollZone = false;

    // Settings (same as YouTube sidebar)
    this.settings = {
      hotkeysEnabled: true,
      dualSubtitlesEnabled: false,
      secondarySubtitleLanguage: null,
      pauseOnHover: true,
      pauseAtEnd: false,
      hotkeys: {
        previous: { key: 'a', shift: false, ctrl: false, alt: false },
        next: { key: 'd', shift: false, ctrl: false, alt: false },
        restart: { key: 's', shift: false, ctrl: false, alt: false },
        toggle: { key: 'w', shift: false, ctrl: false, alt: false }
      }
    };

    // Pause on hover state
    this.pausedByHover = false;
    this.resumeTimeout = null;

    // Pause at end state tracking
    this.pausedAtEnd = false;

    // Update queue to prevent race conditions
    this.updateQueue = Promise.resolve();
    this.isUpdating = false;

    // Load settings from storage
    this._loadSettings();

    // Initialize on supported platforms (not YouTube)
    if (this._isSupportedPlatform() && !this._isYouTubePage()) {
      this._init();
    }
  }

  /**
   * Check if current page is a supported streaming platform (not YouTube)
   */
  _isSupportedPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    return hostname.includes('netflix.com') ||
           hostname.includes('disneyplus.com') ||
           hostname.includes('amazon.') ||
           hostname.includes('primevideo.com');
  }

  /**
   * Check if current page is YouTube (to avoid conflict)
   */
  _isYouTubePage() {
    return window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  /**
   * Initialize sidebar
   */
  async _init() {
    await this._loadSidebar();
    this._setupEventListeners();
    this._setupNavigationListener(); // Listen for SPA navigation

    // Only show sidebar if on a watch page
    const isWatchPage = this._isWatchPage();
    console.log('[Helios Platform Sidebar] Init - isWatchPage:', isWatchPage, 'URL:', window.location.pathname);

    if (isWatchPage) {
      this._adjustVideoLayout();
      this._syncSidebarToVideoHeight();
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Setup navigation listener for SPA platforms (Netflix, etc.)
   */
  _setupNavigationListener() {
    let lastUrl = window.location.href;

    // Check URL changes periodically (for SPAs) - reduced interval for faster response
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;

        // Clear sidebar state on navigation
        this._clearSidebarState();

        // Show sidebar when navigating to watch page
        if (this._isWatchPage()) {
          setTimeout(() => {
            this.show();
            this._adjustVideoLayout();
            this._syncSidebarToVideoHeight();
          }, 300); // Reduced delay for faster appearance
        } else {
          this.hide();
        }
      }
    }, 250); // Faster polling for quicker navigation detection
  }

  /**
   * Check if current page is a watch/video page
   */
  _isWatchPage() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname;

    if (hostname.includes('netflix.com')) {
      return pathname.includes('/watch');
    } else if (hostname.includes('disneyplus.com')) {
      return pathname.includes('/video') || pathname.includes('/play');
    } else if (hostname.includes('amazon.') || hostname.includes('primevideo.com')) {
      return pathname.includes('/detail') || pathname.includes('/player');
    }

    return false;
  }

  /**
   * Load sidebar HTML (reuse YouTube sidebar HTML)
   */
  async _loadSidebar() {
    try {
      const response = await fetch(chrome.runtime.getURL('src/ui/youtube-sidebar/youtube-sidebar.html'));
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      this.sidebar = doc.querySelector('.helios-youtube-sidebar');

      if (!this.sidebar) {
        console.error('[Helios Platform Sidebar] Could not find sidebar in HTML');
        return;
      }

      // Change class to platform-sidebar for different styling
      this.sidebar.classList.add('helios-platform-sidebar');

      // Add data attribute for identification by other components (subtitle overlay, etc.)
      this.sidebar.setAttribute('data-helios-sidebar', 'true');

      // Inject CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/ui/youtube-sidebar/youtube-sidebar.css');
      document.head.appendChild(link);

      // Append to body with fixed positioning
      document.body.appendChild(this.sidebar);

      // Apply platform-specific positioning
      this._applyPlatformPositioning();

      // Get elements
      this.listContainer = this.sidebar.querySelector('#yt-subtitle-list');
      this.subtitleSection = this.sidebar.querySelector('#yt-subtitle-section');
      this.settingsSection = this.sidebar.querySelector('#yt-settings-section');
      this.settingsBtn = this.sidebar.querySelector('#yt-settings-btn');
      this.closeBtn = this.sidebar.querySelector('#yt-close-btn');
      this.selectCaptionBtn = this.sidebar.querySelector('#yt-select-caption-btn');
      this.notificationElement = this.sidebar.querySelector('#yt-notification');
      this.notificationMessage = this.sidebar.querySelector('.yt-notification-message');

      // Get settings elements
      this.hotkeysToggle = this.sidebar.querySelector('#yt-hotkeys-toggle');
      this.dualSubtitlesToggle = this.sidebar.querySelector('#yt-dual-subtitles-toggle');
      this.secondaryLanguageSelect = this.sidebar.querySelector('#yt-secondary-language-select');
      this.secondaryLanguageContainer = this.sidebar.querySelector('#yt-secondary-language-container');
      this.pauseOnHoverToggle = this.sidebar.querySelector('#yt-pause-on-hover-toggle');
      this.pauseAtEndToggle = this.sidebar.querySelector('#yt-pause-at-end-toggle');

      // Caption size controls
      this.increaseSizeBtn = this.sidebar.querySelector('#yt-increase-size-btn');
      this.decreaseSizeBtn = this.sidebar.querySelector('#yt-decrease-size-btn');
      this.sizeInput = this.sidebar.querySelector('#yt-size-input');
      console.log('[Helios Platform Sidebar] Size input element found:', this.sizeInput);

      // Get hotkey input elements
      this.hotkeyPrevInput = this.sidebar.querySelector('#yt-hotkey-prev');
      this.hotkeyNextInput = this.sidebar.querySelector('#yt-hotkey-next');
      this.hotkeyRestartInput = this.sidebar.querySelector('#yt-hotkey-restart');
      this.hotkeyToggleInput = this.sidebar.querySelector('#yt-hotkey-toggle');

      // Setup header buttons
      this._setupHeaderButtons();

      // Setup settings listeners
      this._setupSettingsListeners();

      // Setup hotkey inputs
      this._setupHotkeyInputs();

      // Apply loaded settings to UI
      this._applySettingsToUI();

      console.log('[Helios Platform Sidebar] Sidebar loaded');
    } catch (error) {
      console.error('[Helios Platform Sidebar] Failed to load:', error);
    }
  }

  /**
   * Apply platform-specific positioning (fixed right side, full height)
   */
  _applyPlatformPositioning() {
    if (!this.sidebar) return;

    // Fixed position on right side
    this.sidebar.style.setProperty('position', 'fixed', 'important');
    this.sidebar.style.setProperty('right', '0', 'important');
    this.sidebar.style.setProperty('top', '0', 'important');
    this.sidebar.style.setProperty('height', '100vh', 'important');
    this.sidebar.style.setProperty('z-index', '2147483646', 'important'); // Just below subtitle overlay
    this.sidebar.style.setProperty('width', '420px', 'important');

    // Start hidden - will be shown by init() if on watch page
    this.sidebar.style.setProperty('display', 'none', 'important');
    this.sidebar.style.setProperty('visibility', 'hidden', 'important');
    this.sidebar.style.setProperty('opacity', '0', 'important');
    this.isVisible = false;
  }

  /**
   * Adjust video layout to push video left and make room for sidebar
   */
  _adjustVideoLayout() {
    try {
      const hostname = window.location.hostname.toLowerCase();
      const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

      if (isFullscreen) {
      // In fullscreen, adjust the fullscreen container to make room for sidebar
      const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;

      if (fullscreenEl) {
        // Set the fullscreen container to relative positioning so absolute children work correctly
        fullscreenEl.style.setProperty('position', 'relative', 'important');
        fullscreenEl.style.setProperty('width', '100vw', 'important');
        fullscreenEl.style.setProperty('height', '100vh', 'important');
        fullscreenEl.style.setProperty('overflow', 'hidden', 'important');
        fullscreenEl.style.setProperty('margin', '0', 'important');
        fullscreenEl.style.setProperty('padding', '0', 'important');
      }

      // Platform-specific adjustments
      if (hostname.includes('netflix.com')) {
        // Adjust Netflix's video container - this is the key element that needs to be sized
        const videoContainer = document.querySelector('.NFPlayer') ||
                              document.querySelector('.watch-video--player-view') ||
                              document.querySelector('.watch-video');

        if (videoContainer) {
          videoContainer.style.setProperty('width', 'calc(100vw - 420px)', 'important');
          videoContainer.style.setProperty('max-width', 'calc(100vw - 420px)', 'important');
          videoContainer.style.setProperty('min-width', 'calc(100vw - 420px)', 'important');
          videoContainer.style.setProperty('height', '100vh', 'important');
          videoContainer.style.setProperty('max-height', '100vh', 'important');
          videoContainer.style.setProperty('position', 'absolute', 'important');
          videoContainer.style.setProperty('left', '0', 'important');
          videoContainer.style.setProperty('top', '0', 'important');
          videoContainer.style.setProperty('margin', '0', 'important');
          videoContainer.style.setProperty('padding', '0', 'important');
        }

        // Find and adjust the video element itself
        const video = document.querySelector('video');
        if (video) {
          video.style.setProperty('width', '100%', 'important');
          video.style.setProperty('height', '100%', 'important');
          video.style.setProperty('max-width', '100%', 'important');
          video.style.setProperty('max-height', '100%', 'important');
          video.style.setProperty('object-fit', 'contain', 'important');
          video.style.setProperty('margin', '0', 'important');
          video.style.setProperty('padding', '0', 'important');
        }

        // Adjust Netflix's controls overlay
        const controlsOverlay = document.querySelector('.PlayerControlsNeo__layout');
        if (controlsOverlay) {
          controlsOverlay.style.setProperty('width', 'calc(100vw - 420px)', 'important');
          controlsOverlay.style.setProperty('max-width', 'calc(100vw - 420px)', 'important');
        }

        // Adjust Netflix's controls container (bottom bar with play/pause, etc.)
        const controls = document.querySelector('.PlayerControlsNeo__all-controls');
        if (controls) {
          controls.style.setProperty('width', 'calc(100vw - 420px)', 'important');
          controls.style.setProperty('max-width', 'calc(100vw - 420px)', 'important');
        }

        // Adjust Netflix subtitles in fullscreen
        const timedText = document.querySelector('.player-timedtext-text-container');
        if (timedText) {
          timedText.style.setProperty('max-width', 'calc(100vw - 420px)', 'important');
          timedText.style.setProperty('left', '0', 'important');
        }

        // Hide Netflix's native subtitle panel if it exists
        const nativeSubtitlePanel = document.querySelector('.watch-video--audio-subtitle-controller');
        if (nativeSubtitlePanel) {
          nativeSubtitlePanel.style.setProperty('display', 'none', 'important');
        }
      }
    } else {
      // Normal mode - find the video container based on platform
      let videoContainer = null;

      if (hostname.includes('netflix.com')) {
        videoContainer = document.querySelector('.watch-video') ||
                        document.querySelector('.NFPlayer') ||
                        document.querySelector('[data-uia="watch-video"]');
        document.body.style.overflowX = 'hidden';
      } else if (hostname.includes('disneyplus.com')) {
        videoContainer = document.querySelector('.btm-media-player-root') ||
                        document.querySelector('[data-testid="media-player-container"]');
      } else if (hostname.includes('amazon.') || hostname.includes('primevideo.com')) {
        videoContainer = document.querySelector('.dv-player-fullscreen') ||
                        document.querySelector('[data-testid="player-container"]') ||
                        document.querySelector('.cascadesContainer');
      }

      if (videoContainer) {
        videoContainer.style.width = 'calc(100% - 420px)';
        videoContainer.style.maxWidth = 'calc(100vw - 420px)';
        videoContainer.style.transition = 'width 0.2s ease, max-width 0.2s ease';

        if (hostname.includes('netflix.com')) {
          const timedText = document.querySelector('.player-timedtext-text-container');
          if (timedText) {
            timedText.style.maxWidth = 'calc(100vw - 420px)';
          }
        }
      } else {
        setTimeout(() => this._adjustVideoLayout(), 100);
      }
      }
    } catch (error) {
      console.error('[Helios Platform Sidebar] Error adjusting video layout:', error);
    }
  }

  /**
   * Reset fullscreen styles when exiting fullscreen
   */
  _resetFullscreenStyles() {
    try {
      const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes('netflix.com')) {
      // Reset Netflix video container
      const videoContainer = document.querySelector('.NFPlayer') ||
                            document.querySelector('.watch-video--player-view') ||
                            document.querySelector('.watch-video');

      if (videoContainer) {
        videoContainer.style.removeProperty('width');
        videoContainer.style.removeProperty('max-width');
        videoContainer.style.removeProperty('min-width');
        videoContainer.style.removeProperty('height');
        videoContainer.style.removeProperty('max-height');
        videoContainer.style.removeProperty('position');
        videoContainer.style.removeProperty('left');
        videoContainer.style.removeProperty('top');
        videoContainer.style.removeProperty('margin');
        videoContainer.style.removeProperty('padding');
      }

      // Reset video element
      const video = document.querySelector('video');
      if (video) {
        video.style.removeProperty('width');
        video.style.removeProperty('height');
        video.style.removeProperty('max-width');
        video.style.removeProperty('max-height');
        video.style.removeProperty('margin');
        video.style.removeProperty('padding');
      }

      // Reset controls
      const controlsOverlay = document.querySelector('.PlayerControlsNeo__layout');
      if (controlsOverlay) {
        controlsOverlay.style.removeProperty('width');
        controlsOverlay.style.removeProperty('max-width');
      }

      const controls = document.querySelector('.PlayerControlsNeo__all-controls');
      if (controls) {
        controls.style.removeProperty('width');
        controls.style.removeProperty('max-width');
      }

      // Reset subtitles
      const timedText = document.querySelector('.player-timedtext-text-container');
      if (timedText) {
        timedText.style.removeProperty('max-width');
        timedText.style.removeProperty('left');
      }

      // Show native subtitle panel again
      const nativeSubtitlePanel = document.querySelector('.watch-video--audio-subtitle-controller');
      if (nativeSubtitlePanel) {
        nativeSubtitlePanel.style.removeProperty('display');
      }
    }
    } catch (error) {
      console.error('[Helios Platform Sidebar] Error resetting fullscreen styles:', error);
    }
  }

  /**
   * Sync sidebar height to match video player height
   */
  _syncSidebarToVideoHeight() {
    if (!this.sidebar) return;

    const syncHeight = () => {
      try {
        // Find the video element
        const videoElement = document.querySelector('video');

        if (!videoElement) {
          setTimeout(syncHeight, 50); // Faster retry
          return;
        }

        const videoRect = videoElement.getBoundingClientRect();
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

        // In fullscreen, use fixed positioning to fill viewport
        if (isFullscreen) {
          this.sidebar.style.setProperty('height', '100vh', 'important');
          this.sidebar.style.setProperty('top', '0', 'important');
          this.sidebar.style.setProperty('position', 'fixed', 'important');
          this.sidebar.style.setProperty('right', '0', 'important');
        } else {
          // Normal mode - always use full viewport height and position at top
          // Netflix has its own page layout, so we use 100vh instead of matching video height
          this.sidebar.style.setProperty('height', '100vh', 'important');
          this.sidebar.style.setProperty('top', '0', 'important');
          this.sidebar.style.setProperty('position', 'fixed', 'important');
          this.sidebar.style.setProperty('right', '0', 'important');
        }

        // Ensure sidebar is always visible in fullscreen
        if (isFullscreen) {
          this.sidebar.style.setProperty('z-index', '2147483647', 'important'); // Highest z-index for fullscreen
        } else {
          this.sidebar.style.setProperty('z-index', '2147483646', 'important');
        }
      } catch (error) {
        console.error('[Helios Platform Sidebar] Error syncing sidebar height:', error);
      }
    };

    // Initial sync
    syncHeight();

    // Setup ResizeObserver to keep sidebar synced when video player resizes
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    const videoElement = document.querySelector('video');
    if (videoElement) {
      // Use ResizeObserver for efficient size change detection
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(syncHeight); // Use RAF for smooth updates
      });

      this.resizeObserver.observe(videoElement);

      // Also observe video parent container for fullscreen changes
      if (videoElement.parentElement) {
        this.resizeObserver.observe(videoElement.parentElement);
      }
    }

    // Sync on window resize with debouncing
    let resizeTimeout;
    const resizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(syncHeight, 16); // ~60fps
    };
    window.addEventListener('resize', resizeHandler);
    this.resizeHandler = resizeHandler;

    // Setup fullscreen listener
    this._setupFullscreenListener();
  }

  /**
   * Setup fullscreen change listener
   */
  _setupFullscreenListener() {
    let layoutEnforcer = null;

    const fullscreenHandler = () => {
      try {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

        // Clear existing enforcer
        if (layoutEnforcer) {
          clearInterval(layoutEnforcer);
          layoutEnforcer = null;
        }

        // IMMEDIATE check before any animation frame: force hide if not on watch page
        if (!this._isWatchPage() && this.sidebar) {
        this.sidebar.style.setProperty('display', 'none', 'important');
        this.sidebar.style.setProperty('visibility', 'hidden', 'important');
        this.sidebar.style.setProperty('opacity', '0', 'important');
        this.isVisible = false;
        return; // Exit immediately, don't do any layout adjustments
      }

      // Immediate update on fullscreen change
      requestAnimationFrame(() => {
        if (isFullscreen && this.sidebar) {
          // Only show sidebar in fullscreen if we're on a watch page
          if (!this._isWatchPage()) {
            this.sidebar.style.setProperty('display', 'none', 'important');
            this.sidebar.style.setProperty('visibility', 'hidden', 'important');
            this.isVisible = false;
            return; // Don't adjust layout or show sidebar if not on watch page
          }

          // Move sidebar to fullscreen element to ensure visibility
          const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
          if (fullscreenEl && !fullscreenEl.contains(this.sidebar)) {
            fullscreenEl.appendChild(this.sidebar);
          }

          // Ensure sidebar is visible and properly positioned
          this.sidebar.style.setProperty('position', 'fixed', 'important');
          this.sidebar.style.setProperty('right', '0', 'important');
          this.sidebar.style.setProperty('top', '0', 'important');
          this.sidebar.style.setProperty('display', 'flex', 'important');
          this.sidebar.style.setProperty('visibility', 'visible', 'important');
          this.sidebar.style.setProperty('opacity', '1', 'important');
          this.sidebar.style.setProperty('z-index', '2147483647', 'important');

          // Continuously enforce layout adjustments in fullscreen (Netflix fights back)
          layoutEnforcer = setInterval(() => {
            this._adjustVideoLayout();
          }, 100); // Re-apply every 100ms to counter Netflix's dynamic styling

          // Initial adjustment
          this._adjustVideoLayout();
        } else if (this.sidebar && !isFullscreen) {
          // Reset all fullscreen styles
          this._resetFullscreenStyles();

          // Move sidebar back to body when exiting fullscreen
          if (this.sidebar.parentElement !== document.body) {
            document.body.appendChild(this.sidebar);
          }

          // Re-check if we should show/hide sidebar based on current page
          if (this._isWatchPage()) {
            this._adjustVideoLayout();
            this._syncSidebarToVideoHeight();
          } else {
            this.hide();
          }
        }

        if (isFullscreen && this._isWatchPage()) {
          this._syncSidebarToVideoHeight();
          this._adjustVideoLayout();
        }
      });
      } catch (error) {
        console.error('[Helios Platform Sidebar] Error in fullscreen handler:', error);
      }
    };

    document.addEventListener('fullscreenchange', fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenHandler);
    document.addEventListener('mozfullscreenchange', fullscreenHandler);
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Listen for subtitles being loaded
    document.addEventListener('helios-subtitles-loaded', (e) => {
      const { track, entries, binding } = e.detail;
      this.videoBinding = binding;
      this.updateSubtitles(entries, track);
    });

    // Listen for time updates to highlight current subtitle
    document.addEventListener('helios-video-timeupdate', (e) => {
      const { currentTime, binding } = e.detail;

      // If this is a new binding, update overlay settings
      if (this.videoBinding !== binding) {
        this.videoBinding = binding;

        // Apply pause on hover setting to the overlay
        if (this.videoBinding && this.videoBinding.overlay) {
          this.videoBinding.overlay.setPauseOnHover(this.settings.pauseOnHover);
        }
      }

      this._updateActiveSubtitle(currentTime);
    });

    // Toggle sidebar visibility
    document.addEventListener('helios-toggle-subtitle-panel', () => {
      this.toggle();
    });

    // Listen for vocabulary updates
    document.addEventListener('helios-vocab-updated', () => {
      this._updateUnderlining().catch(err => {
        console.error('[Helios Platform Sidebar] Error updating underlining:', err);
      });
    });

    // Setup global mouse listener for pause-on-hover
    this._setupPauseOnHoverListener();

    // Listen for video notifications
    document.addEventListener('helios-video-notification', (e) => {
      const { message, type } = e.detail;
      this._showNotification(message, type);
    });

    // Setup hotkeys
    this._setupHotkeys();

    // Setup scroll detection
    this._setupScrollDetection();
  }

  /**
   * Setup scroll detection
   */
  _setupScrollDetection() {
    const handleSidebarScroll = (e) => {
      if (this.isAutoScrolling) return;

      this.userIsScrollingSidebar = true;

      if (this.sidebarScrollTimeout) {
        clearTimeout(this.sidebarScrollTimeout);
      }

      this.sidebarScrollTimeout = setTimeout(() => {
        this.userIsScrollingSidebar = false;
      }, 2000);
    };

    const handleMouseMove = (e) => {
      if (!this.listContainer) return;

      const rect = this.listContainer.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const containerWidth = rect.width;

      const scrollZoneStart = containerWidth * 0.65;
      this.mouseInScrollZone = relativeX >= scrollZoneStart;
    };

    const handleMouseLeave = () => {
      this.mouseInScrollZone = false;
    };

    const preventScrollOutsideZone = (e) => {
      if (!this.mouseInScrollZone && !this.isAutoScrolling) {
        e.preventDefault();
        return false;
      }
    };

    if (this.listContainer) {
      this.listContainer.addEventListener('scroll', handleSidebarScroll, { passive: true });
      this.listContainer.addEventListener('mousemove', handleMouseMove, { passive: true });
      this.listContainer.addEventListener('mouseleave', handleMouseLeave, { passive: true });
      this.listContainer.addEventListener('wheel', preventScrollOutsideZone, { passive: false });
    }
  }

  /**
   * Setup keyboard hotkeys
   */
  _setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      // Only trigger if hotkeys are enabled and we're on a watch page
      if (!this.settings.hotkeysEnabled || !this._isWatchPage()) {
        return;
      }

      // Don't trigger if user is typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      let keyName = e.key;
      if (keyName.startsWith('Arrow')) {
        keyName = keyName.substring(5);
      }
      const key = keyName.toLowerCase();

      const matchesHotkey = (hotkey) => {
        return hotkey.key === key &&
               hotkey.shift === e.shiftKey &&
               (hotkey.ctrl === (e.ctrlKey || e.metaKey)) &&
               hotkey.alt === e.altKey;
      };

      if (matchesHotkey(this.settings.hotkeys.previous)) {
        e.preventDefault();
        this._jumpToPreviousSubtitle();
      } else if (matchesHotkey(this.settings.hotkeys.next)) {
        e.preventDefault();
        this._jumpToNextSubtitle();
      } else if (matchesHotkey(this.settings.hotkeys.restart)) {
        e.preventDefault();
        this._jumpToCurrentSubtitleStart();
      } else if (matchesHotkey(this.settings.hotkeys.toggle)) {
        e.preventDefault();
        this._toggleSubtitleOverlay();
      }
    });
  }

  /**
   * Setup header buttons
   */
  _setupHeaderButtons() {
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        this._toggleSettings();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        const isShowingSettings = this.settingsSection.style.display !== 'none';

        if (isShowingSettings) {
          this._toggleSettings();
        } else {
          this.hide();
        }
      });
    }

    if (this.selectCaptionBtn) {
      this.selectCaptionBtn.addEventListener('click', () => {
        this._showCaptionSelector();
      });
    }
  }

  /**
   * Toggle between subtitle view and settings view
   */
  _toggleSettings() {
    const isShowingSettings = this.settingsSection.style.display !== 'none';

    if (isShowingSettings) {
      this.settingsSection.style.display = 'none';
      this.subtitleSection.style.display = 'flex';

      this.closeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      this.closeBtn.setAttribute('title', 'Close');
    } else {
      this.subtitleSection.style.display = 'none';
      this.settingsSection.style.display = 'flex';

      this.closeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
      this.closeBtn.setAttribute('title', 'Back to subtitles');

      this._updateLanguageDropdown();
    }
  }

  /**
   * Update language dropdown with available tracks
   */
  async _updateLanguageDropdown() {
    if (!this.secondaryLanguageSelect) return;

    try {
      const platform = PlatformDetector.detectPlatform();

      // Get the appropriate loader based on platform
      let platformLoader = null;
      if (platform === 'netflix') {
        platformLoader = window.heliosVideoFeature?.netflixLoader;
      } else if (platform === 'youtube') {
        platformLoader = window.heliosVideoFeature?.youtubeLoader;
      }

      if (!platformLoader || !platformLoader.getAvailableTracks) {
        console.warn('[Helios Platform Sidebar] Platform loader not available for:', platform);
        return;
      }

      const tracks = await platformLoader.getAvailableTracks();

      if (!tracks || tracks.length === 0) {
        return;
      }

      const languageMap = new Map();

      tracks.forEach(track => {
        const langCode = track.language;
        const langName = track.languageName || track.language;

        if (langCode && !languageMap.has(langCode)) {
          if (langCode.startsWith('zh')) {
            languageMap.set(langCode, langName);
          } else {
            const baseCode = langCode.split('-')[0];
            if (!languageMap.has(baseCode)) {
              languageMap.set(baseCode, langName);
            }
          }
        }
      });

      const currentSelection = this.settings.secondarySubtitleLanguage;
      this.secondaryLanguageSelect.innerHTML = '';

      const sortedLanguages = Array.from(languageMap.entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      );

      sortedLanguages.forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        this.secondaryLanguageSelect.appendChild(option);
      });

      if (currentSelection && languageMap.has(currentSelection)) {
        this.secondaryLanguageSelect.value = currentSelection;
      } else if (sortedLanguages.length > 0) {
        this.secondaryLanguageSelect.value = sortedLanguages[0][0];
        this.settings.secondarySubtitleLanguage = sortedLanguages[0][0];
      }

      console.log('[Helios Platform Sidebar] Updated language dropdown with', languageMap.size, 'languages');
    } catch (error) {
      console.error('[Helios Platform Sidebar] Failed to update language dropdown:', error);
    }
  }

  /**
   * Setup settings UI listeners
   */
  _setupSettingsListeners() {
    if (this.hotkeysToggle) {
      this.hotkeysToggle.addEventListener('change', (e) => {
        this.settings.hotkeysEnabled = e.target.checked;
        this._saveSettings();
      });
    }

    if (this.dualSubtitlesToggle) {
      this.dualSubtitlesToggle.addEventListener('change', (e) => {
        this.settings.dualSubtitlesEnabled = e.target.checked;
        this._saveSettings();

        if (this.secondaryLanguageContainer) {
          this.secondaryLanguageContainer.style.display = e.target.checked ? 'block' : 'none';
        }

        if (e.target.checked) {
          this._loadSecondarySubtitles();
        } else {
          this.currentSecondarySubtitles = [];
          if (this.videoBinding && this.videoBinding.overlay) {
            this.videoBinding.overlay.clearSecondarySubtitles();
          }
          this._renderSubtitleList().catch(err => {
            console.error('[Helios Platform Sidebar] Error re-rendering:', err);
          });
        }
      });
    }

    if (this.secondaryLanguageSelect) {
      this.secondaryLanguageSelect.addEventListener('change', (e) => {
        this.settings.secondarySubtitleLanguage = e.target.value || null;
        this._saveSettings();

        if (this.settings.dualSubtitlesEnabled) {
          this._loadSecondarySubtitles();
        }
      });
    }

    if (this.pauseOnHoverToggle) {
      this.pauseOnHoverToggle.addEventListener('change', (e) => {
        this.settings.pauseOnHover = e.target.checked;
        this._saveSettings();

        if (this.videoBinding && this.videoBinding.overlay) {
          this.videoBinding.overlay.setPauseOnHover(e.target.checked);
        }
      });
    }

    if (this.pauseAtEndToggle) {
      this.pauseAtEndToggle.addEventListener('change', (e) => {
        this.settings.pauseAtEnd = e.target.checked;
        this._saveSettings();
      });
    }

    // Caption size controls
    if (this.increaseSizeBtn) {
      this.increaseSizeBtn.addEventListener('click', () => {
        this._adjustSubtitleSize(4);
      });
    }

    if (this.decreaseSizeBtn) {
      this.decreaseSizeBtn.addEventListener('click', () => {
        this._adjustSubtitleSize(-4);
      });
    }

    if (this.sizeInput) {
      // Change event (when user finishes editing)
      this.sizeInput.addEventListener('change', (e) => {
        const size = parseInt(e.target.value);
        if (size && size >= 12 && size <= 100) {
          this._setSubtitleSize(size);
        }
      });

      // Input event (live update as user types)
      this.sizeInput.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        if (size && size >= 12 && size <= 100) {
          this._setSubtitleSize(size);
        }
      });

      // Scroll to adjust size
      this.sizeInput.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -2 : 2;
        this._adjustSubtitleSize(delta);
      }, { passive: false });
    }
  }

  /**
   * Setup hotkey input listeners
   */
  _setupHotkeyInputs() {
    const inputs = [
      { element: this.hotkeyPrevInput, key: 'previous' },
      { element: this.hotkeyNextInput, key: 'next' },
      { element: this.hotkeyRestartInput, key: 'restart' },
      { element: this.hotkeyToggleInput, key: 'toggle' }
    ];

    inputs.forEach(({ element, key }) => {
      if (!element) return;

      element.addEventListener('click', (e) => {
        element.removeAttribute('readonly');
        element.select();
        element.placeholder = 'Press any key...';
      });

      element.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
          return;
        }

        let keyName = e.key;
        if (keyName.startsWith('Arrow')) {
          keyName = keyName.substring(5);
        }

        const newHotkey = {
          key: keyName.toLowerCase(),
          shift: e.shiftKey,
          ctrl: e.ctrlKey || e.metaKey,
          alt: e.altKey
        };

        this.settings.hotkeys[key] = newHotkey;
        const displayText = this._formatHotkeyDisplay(newHotkey);
        element.value = displayText;
        element.blur();
        element.setAttribute('readonly', 'true');

        this._saveSettings();
        this._showNotification(`Hotkey updated to '${displayText}'`, 'success');
      });

      element.addEventListener('blur', () => {
        element.setAttribute('readonly', 'true');
        const displayText = this._formatHotkeyDisplay(this.settings.hotkeys[key]);
        element.placeholder = displayText;
        if (!element.value) {
          element.value = displayText;
        }
      });
    });
  }

  /**
   * Format hotkey for display
   */
  _formatHotkeyDisplay(hotkey) {
    const parts = [];
    if (hotkey.ctrl) parts.push('Ctrl');
    if (hotkey.shift) parts.push('Shift');
    if (hotkey.alt) parts.push('Alt');

    const keyDisplay = hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1);
    parts.push(keyDisplay);

    return parts.join('+');
  }

  /**
   * Apply loaded settings to UI
   */
  _applySettingsToUI() {
    if (this.hotkeysToggle) {
      this.hotkeysToggle.checked = this.settings.hotkeysEnabled;
    }

    if (this.dualSubtitlesToggle) {
      this.dualSubtitlesToggle.checked = this.settings.dualSubtitlesEnabled;
    }

    if (this.secondaryLanguageSelect && this.settings.secondarySubtitleLanguage) {
      this.secondaryLanguageSelect.value = this.settings.secondarySubtitleLanguage;
    }

    if (this.secondaryLanguageContainer) {
      this.secondaryLanguageContainer.style.display = this.settings.dualSubtitlesEnabled ? 'block' : 'none';
    }

    if (this.pauseOnHoverToggle) {
      this.pauseOnHoverToggle.checked = this.settings.pauseOnHover;
    }

    if (this.pauseAtEndToggle) {
      this.pauseAtEndToggle.checked = this.settings.pauseAtEnd;
    }

    // Update size input with current overlay size
    if (this.sizeInput && this.videoBinding && this.videoBinding.overlay) {
      const currentSize = this.videoBinding.overlay.getSubtitleSize();
      this.sizeInput.value = currentSize;
    }

    if (this.hotkeyPrevInput) {
      this.hotkeyPrevInput.value = this._formatHotkeyDisplay(this.settings.hotkeys.previous);
    }
    if (this.hotkeyNextInput) {
      this.hotkeyNextInput.value = this._formatHotkeyDisplay(this.settings.hotkeys.next);
    }
    if (this.hotkeyRestartInput) {
      this.hotkeyRestartInput.value = this._formatHotkeyDisplay(this.settings.hotkeys.restart);
    }
    if (this.hotkeyToggleInput) {
      this.hotkeyToggleInput.value = this._formatHotkeyDisplay(this.settings.hotkeys.toggle);
    }
  }

  /**
   * Update subtitles in sidebar (queued to prevent race conditions)
   */
  async updateSubtitles(entries, track) {
    // Queue the update to prevent race conditions from multiple calls
    this.updateQueue = this.updateQueue.then(async () => {
      // Skip if already updating with same data
      if (this.isUpdating &&
          this.currentTrack?.language === track?.language &&
          this.currentSubtitles.length === entries?.length) {
        console.log('[Helios Platform Sidebar] Skipping duplicate update');
        return;
      }

      this.isUpdating = true;
      console.log('[Helios Platform Sidebar] Updating subtitles:', entries?.length, 'entries');

      try {
        this.currentSubtitles = entries || [];
        this.currentTrack = track;
        this.currentSecondarySubtitles = [];

        // Render subtitle list (async)
        await this._renderSubtitleList().catch(err => {
          console.error('[Helios Platform Sidebar] Error rendering subtitle list:', err);
        });

        // Update language dropdown with new video's available languages
        this._updateLanguageDropdown();

        // Scroll to current subtitle position if video is not at start
        if (this.videoBinding) {
          const currentTime = this.videoBinding.videoElement.currentTime * 1000;
          if (currentTime > 1000) { // If more than 1 second into video
            this._updateActiveSubtitle(currentTime);
          }
        }

        // Signal that sidebar is ready (subtitles loaded and scrolled to position)
        document.dispatchEvent(new CustomEvent('helios-sidebar-ready'));

        // Load secondary subtitles if dual subtitles enabled
        if (this.settings.dualSubtitlesEnabled) {
          this._loadSecondarySubtitles();
        }
      } finally {
        this.isUpdating = false;
      }
    });

    return this.updateQueue;
  }

  /**
   * Load secondary subtitles for dual display
   */
  async _loadSecondarySubtitles() {
    if (!this.videoBinding) {
      console.warn('[Helios Platform Sidebar] Cannot load secondary subtitles: no video binding');
      return;
    }

    try {
      const platform = PlatformDetector.detectPlatform();

      // Get the appropriate loader based on platform
      let platformLoader = null;
      if (platform === 'netflix') {
        platformLoader = window.heliosVideoFeature?.netflixLoader;
      } else if (platform === 'youtube') {
        platformLoader = window.heliosVideoFeature?.youtubeLoader;
      }

      if (!platformLoader || !platformLoader.getAvailableTracks) {
        console.warn('[Helios Platform Sidebar] Platform loader not available');
        return;
      }

      const tracks = await platformLoader.getAvailableTracks();

      if (!tracks || tracks.length === 0) {
        console.warn('[Helios Platform Sidebar] No subtitle tracks available');
        return;
      }

      console.log('[Helios Platform Sidebar] Found', tracks.length, 'available subtitle tracks');

      // Find secondary subtitle track
      let secondaryTrack = null;
      const currentTrackLang = this.currentTrack?.language;

      if (this.settings.secondarySubtitleLanguage) {
        const selectedLang = this.settings.secondarySubtitleLanguage;
        const matchingTracks = tracks.filter(t => {
          return t.language === selectedLang ||
                 t.language?.startsWith(selectedLang + '-') ||
                 t.language?.split('-')[0] === selectedLang;
        });

        secondaryTrack = matchingTracks.find(t => t.language !== currentTrackLang) || matchingTracks[0];
      } else {
        // Auto-detect: prefer English
        const englishTracks = tracks.filter(t => t.language === 'en' || t.language?.startsWith('en-'));
        secondaryTrack = englishTracks.find(t => t.language !== currentTrackLang) || englishTracks[0];

        if (!secondaryTrack || secondaryTrack.language === currentTrackLang) {
          secondaryTrack = tracks.find(t => t.language !== currentTrackLang) || tracks[0];
        }
      }

      if (!secondaryTrack) {
        console.warn('[Helios Platform Sidebar] No suitable secondary track found');
        return;
      }

      if (secondaryTrack.language === currentTrackLang) {
        console.warn('[Helios Platform Sidebar] Secondary track is same as primary, skipping');
        return;
      }

      console.log('[Helios Platform Sidebar] Loading secondary subtitles:', secondaryTrack.languageName);

      const secondaryEntries = await platformLoader.loadTrack(secondaryTrack);

      if (secondaryEntries.length === 0) {
        console.warn('[Helios Platform Sidebar] No secondary subtitle entries parsed');
        return;
      }

      this.currentSecondarySubtitles = secondaryEntries;

      if (this.videoBinding.overlay) {
        this.videoBinding.overlay.setSecondarySubtitles(secondaryEntries);
      }

      this._renderSubtitleList().catch(err => {
        console.error('[Helios Platform Sidebar] Error re-rendering subtitle list:', err);
      });

      console.log(`[Helios Platform Sidebar] Loaded ${secondaryEntries.length} secondary subtitles`);
    } catch (error) {
      console.error('[Helios Platform Sidebar] Failed to load secondary subtitles:', error);
    }
  }

  /**
   * Show notification
   */
  _showNotification(message, type = 'info') {
    if (!this.notificationElement || !this.notificationMessage) return;

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationMessage.textContent = message;
    this.notificationElement.className = `yt-notification yt-notification-${type}`;
    this.notificationElement.style.display = 'block';

    this.notificationTimeout = setTimeout(() => {
      this.notificationElement.style.display = 'none';
    }, 3000);
  }

  /**
   * Extract potential words from text
   */
  _extractPotentialWords(text) {
    const words = [];
    const currentLang = window.languageRegistry?.getCurrentLanguage();

    if (currentLang && ['zh', 'ja', 'ko'].includes(currentLang)) {
      const seen = new Set();

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char.trim() && !seen.has(char)) {
          words.push(char);
          seen.add(char);
        }
      }

      for (let len = 2; len <= 3; len++) {
        for (let i = 0; i <= text.length - len; i++) {
          const candidate = text.substring(i, i + len);
          if (candidate.trim() && !seen.has(candidate)) {
            words.push(candidate);
            seen.add(candidate);
          }
        }
      }
    } else {
      const matches = text.match(/[\p{L}\p{M}]+/gu);
      if (matches) {
        words.push(...matches.map(w => w.toLowerCase()));
      }
    }

    return [...new Set(words)];
  }

  /**
   * Render subtitle list
   */
  async _renderSubtitleList() {
    if (!this.listContainer) return;

    console.log('[Helios Platform Sidebar] Rendering', this.currentSubtitles.length, 'subtitles');
    this.listContainer.innerHTML = '';

    if (this.currentSubtitles.length === 0) {
      this.listContainer.innerHTML = `
        <div class="yt-subtitle-empty">
          <div class="empty-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <line x1="9" y1="9" x2="15" y2="9"></line>
              <line x1="9" y1="13" x2="15" y2="13"></line>
            </svg>
          </div>
          <p>Subtitles will appear here</p>
          <small>Auto-loads based on your target language</small>
        </div>
      `;
      return;
    }

    // Preload words
    if (window.dictionaryManager && window.dictionaryManager.preloadWords) {
      const allWordsToPreload = [];
      this.currentSubtitles.forEach(entry => {
        const words = this._extractPotentialWords(entry.text);
        allWordsToPreload.push(...words);
      });

      const uniqueWords = [...new Set(allWordsToPreload)];
      if (uniqueWords.length > 0) {
        await window.dictionaryManager.preloadWords(uniqueWords);
      }
    }

    // Create subtitle items
    for (const entry of this.currentSubtitles) {
      const index = this.currentSubtitles.indexOf(entry);
      const item = document.createElement('div');
      item.className = 'yt-subtitle-item';
      item.dataset.index = index;

      const timestamp = document.createElement('div');
      timestamp.className = 'yt-subtitle-timestamp';
      timestamp.textContent = this._formatTime(entry.start);

      const textContainer = document.createElement('div');
      textContainer.className = 'yt-subtitle-text-container';

      const primaryText = document.createElement('div');
      primaryText.className = 'yt-subtitle-text yt-subtitle-text-primary';

      const adapter = window.languageRegistry?.getAdapter();

      if (adapter && adapter.extractWords && window.dictionaryManager) {
        const wordsToPreload = this._extractPotentialWords(entry.text);
        if (wordsToPreload.length > 0 && window.dictionaryManager.preloadWords) {
          await window.dictionaryManager.preloadWords(wordsToPreload);
        }

        const dictionary = window.dictionaryManager?.dictionary || {};
        // Use language-aware word extraction (EXACTLY like YouTube)
        const extractedWords = await adapter.extractWords(entry.text, dictionary);

        // Check if language uses spaces between words (not CJK languages)
        const currentLang = window.languageRegistry?.getCurrentLanguage();
        const usesSpaces = currentLang && !['zh', 'ja', 'ko'].includes(currentLang);

        extractedWords.forEach(({ word, offset, isTargetLang }, index) => {
          const wordSpan = document.createElement('span');

          if (isTargetLang !== false) {
            // Target language word - add interactive features
            wordSpan.className = 'yt-subtitle-word';
            wordSpan.style.cursor = 'pointer';

            // Mark as subtitle word for hover-without-shift functionality
            wordSpan.setAttribute('data-subtitle-word', 'true');
            wordSpan.setAttribute('data-helios-word', word);

            // Check if word is unknown and add styling
            const cleanWord = word.toLowerCase();

            if (window.vocabManager &&
                dictionary[cleanWord] &&
                !window.vocabManager.isWordKnown(cleanWord) &&
                !window.vocabManager.isWordIgnored(cleanWord)) {
              wordSpan.classList.add('unknown-word');
            }

            // Add pause-on-hover functionality for sidebar words
            wordSpan.addEventListener('mouseenter', () => {
              if (this.settings.pauseOnHover && this.videoBinding && this.videoBinding.videoElement) {
                // Cancel any pending resume
                if (this.resumeTimeout) {
                  clearTimeout(this.resumeTimeout);
                  this.resumeTimeout = null;
                }

                const video = this.videoBinding.videoElement;
                const wasPlaying = !video.paused;
                if (wasPlaying) {
                  video.pause();
                  this.pausedByHover = true;
                }
              }
            });
          } else {
            // Non-target language text - display as plain text
            wordSpan.className = 'yt-subtitle-plain-text';
            wordSpan.style.cursor = 'default';
          }

          wordSpan.textContent = word;
          primaryText.appendChild(wordSpan);

          // Add space after word (except for last word) for languages that use spaces
          if (usesSpaces && index < extractedWords.length - 1) {
            primaryText.appendChild(document.createTextNode(' '));
          }
        });
      } else {
        // Fallback: display text as-is if no adapter available
        primaryText.textContent = entry.text;
      }

      textContainer.appendChild(primaryText);

      // Secondary subtitle
      if (this.currentSecondarySubtitles.length > 0) {
        const matchingSecondary = this._findMatchingSubtitle(entry, this.currentSecondarySubtitles);
        if (matchingSecondary) {
          const secondaryText = document.createElement('div');
          secondaryText.className = 'yt-subtitle-text yt-subtitle-text-secondary';
          secondaryText.textContent = matchingSecondary.text;
          textContainer.appendChild(secondaryText);
        }
      }

      item.appendChild(timestamp);
      item.appendChild(textContainer);

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._seekToSubtitle(entry);
      });

      this.listContainer.appendChild(item);
    }
  }

  /**
   * Setup pause-on-hover listener
   */
  _setupPauseOnHoverListener() {
    document.addEventListener('mousemove', (e) => {
      if (!this.settings.pauseOnHover || !this.pausedByHover) return;

      const target = e.target;
      const isOverPopup = target && target.closest('.chinese-lang-extension-popup');
      const isOverSidebarWord = target && target.closest('.yt-subtitle-word');

      if (!isOverPopup && !isOverSidebarWord) {
        if (!this.resumeTimeout) {
          this.resumeTimeout = setTimeout(() => {
            if (this.videoBinding && this.videoBinding.videoElement &&
                this.videoBinding.videoElement.paused && this.pausedByHover) {
              this.videoBinding.videoElement.play();
              this.pausedByHover = false;
            }
            this.resumeTimeout = null;
          }, 300);
        }
      } else {
        if (this.resumeTimeout) {
          clearTimeout(this.resumeTimeout);
          this.resumeTimeout = null;
        }
      }
    });
  }

  /**
   * Update underlining without re-rendering
   */
  async _updateUnderlining() {
    if (!this.listContainer || !window.vocabManager || !window.dictionaryManager) return;

    const wordSpans = this.listContainer.querySelectorAll('.yt-subtitle-word');
    const wordsToCheck = Array.from(wordSpans).map(span => {
      const word = span.textContent || span.getAttribute('data-helios-word');
      return word ? word.toLowerCase() : null;
    }).filter(w => w !== null);

    if (wordsToCheck.length > 0 && window.dictionaryManager.preloadWords) {
      await window.dictionaryManager.preloadWords(wordsToCheck);
    }

    const dictionary = window.dictionaryManager.dictionary || {};

    wordSpans.forEach(wordSpan => {
      const word = wordSpan.textContent || wordSpan.getAttribute('data-helios-word');
      if (!word) return;

      const cleanWord = word.toLowerCase();
      const shouldUnderline = dictionary[cleanWord] &&
                             !window.vocabManager.isWordKnown(cleanWord) &&
                             !window.vocabManager.isWordIgnored(cleanWord);

      if (shouldUnderline) {
        wordSpan.classList.add('unknown-word');
      } else {
        wordSpan.classList.remove('unknown-word');
      }
    });
  }

  /**
   * Binary search to find active subtitle by time (O(log n) performance)
   */
  _binarySearchSubtitle(currentTime) {
    let left = 0;
    let right = this.currentSubtitles.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const entry = this.currentSubtitles[mid];

      if (currentTime >= entry.start && currentTime <= entry.end) {
        return mid; // Found active subtitle
      }

      if (currentTime < entry.start) {
        right = mid - 1; // Search left half
      } else {
        left = mid + 1; // Search right half
      }
    }

    return -1; // No active subtitle
  }

  /**
   * Find matching secondary subtitle
   */
  _findMatchingSubtitle(primaryEntry, secondarySubtitles) {
    let bestMatch = null;
    let maxOverlap = 0;

    for (const secondary of secondarySubtitles) {
      const overlapStart = Math.max(primaryEntry.start, secondary.start);
      const overlapEnd = Math.min(primaryEntry.end, secondary.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = secondary;
      }
    }

    return maxOverlap >= 50 ? bestMatch : null;
  }

  /**
   * Update active subtitle highlight (optimized with binary search)
   */
  _updateActiveSubtitle(currentTime) {
    if (!this.listContainer || this.currentSubtitles.length === 0) return;

    // Use binary search for O(log n) instead of O(n) performance
    const newIndex = this._binarySearchSubtitle(currentTime);

    if (newIndex === -1) {
      if (this.activeIndex !== -1) {
        const prevActive = this.listContainer.querySelector('.yt-subtitle-item.active');
        if (prevActive) {
          prevActive.classList.remove('active');
        }
        this.activeIndex = -1;
      }
      return;
    }

    // If same subtitle is still active, check for pause-at-end
    if (newIndex === this.activeIndex) {
      const activeEntry = this.currentSubtitles[newIndex];
      if (activeEntry && this.settings.pauseAtEnd && this.videoBinding && !this.pausedAtEnd) {
        // Calculate time remaining in subtitle (in milliseconds)
        const timeRemaining = activeEntry.end - currentTime;

        // Pause when we're within 150ms of the end (to account for 100ms update interval + buffer)
        // This ensures we catch the pause even if timing is slightly off
        if (timeRemaining <= 150 && timeRemaining >= 0) {
          const video = this.videoBinding.videoElement;
          if (!video.paused) {
            video.pause();
            this.pausedAtEnd = true;
          }
        }
      }
      return;
    }

    // If transitioning between subtitles and pause-at-end is enabled, pause before switching
    if (this.settings.pauseAtEnd && !this.pausedAtEnd && this.activeIndex !== -1 && this.videoBinding) {
      const video = this.videoBinding.videoElement;
      if (!video.paused) {
        video.pause();
      }
    }

    // Update active state - new subtitle
    this.activeIndex = newIndex;
    this.pausedAtEnd = false;  // Reset for new subtitle

    const items = this.listContainer.querySelectorAll('.yt-subtitle-item');
    items.forEach((item, index) => {
      if (index === newIndex) {
        item.classList.add('active');
        // Only auto-scroll if user is NOT scrolling (page or sidebar)
        if (!this.userIsScrollingSidebar) {
          this._scrollSubtitleToCenter(item);
        }
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Scroll subtitle to center
   */
  _scrollSubtitleToCenter(item) {
    if (!this.listContainer || !item) return;

    this.isAutoScrolling = true;

    requestAnimationFrame(() => {
      const containerRect = this.listContainer.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      const containerCenter = containerRect.height / 2;
      const itemCenter = itemRect.height / 2;
      const scrollOffset = (itemRect.top - containerRect.top) - containerCenter + itemCenter;

      this.listContainer.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });

      setTimeout(() => {
        this.isAutoScrolling = false;
      }, 600);
    });
  }

  /**
   * Seek to subtitle
   */
  _seekToSubtitle(entry) {
    if (!this.videoBinding || !this.videoBinding.videoElement) return;

    try {
      const video = this.videoBinding.videoElement;
      const seekTime = entry.start / 1000;

      // Validate seek time is within video duration
      if (video.duration && seekTime > video.duration) return;

      this.videoBinding.seekTo(entry.start);
    } catch (error) {
      console.error('[Helios Platform Sidebar] Seek error:', error);
    }
  }

  /**
   * Format time in MM:SS
   */
  _formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Show caption selector
   */
  async _showCaptionSelector() {
    console.log('[Helios Platform Sidebar] Opening caption selector');

    const platform = PlatformDetector.detectPlatform();

    // Get the appropriate loader based on platform
    let platformLoader = null;
    if (platform === 'netflix') {
      platformLoader = window.heliosVideoFeature?.netflixLoader;
    } else if (platform === 'youtube') {
      platformLoader = window.heliosVideoFeature?.youtubeLoader;
    }

    if (!platformLoader) {
      this._showNotification('Platform loader not available', 'error');
      return;
    }

    this._showNotification('Loading available captions...', 'info');

    try {
      const tracks = await platformLoader.getAvailableTracks();

      if (tracks.length === 0) {
        this._showNotification('No caption tracks available', 'error');
        return;
      }

      console.log('[Helios Platform Sidebar] Available tracks:', tracks.length);

      if (!window.subtitleSelectorModal) {
        window.subtitleSelectorModal = new SubtitleSelectorModal();
      }

      window.subtitleSelectorModal.show(tracks, async (selectedTrack) => {
        console.log('[Helios Platform Sidebar] Selected track:', selectedTrack.languageName);
        this._showNotification(`Loading ${selectedTrack.languageName} captions...`, 'info');

        try {
          const entries = await platformLoader.loadTrack(selectedTrack);

          if (entries.length === 0) {
            this._showNotification('No captions found in selected track', 'error');
            return;
          }

          const binding = window.heliosVideoFeature?.videoDetector?.getPrimaryBinding();
          if (binding) {
            binding.loadSubtitles(entries, selectedTrack);
            this._showNotification(`Loaded ${entries.length} captions (${selectedTrack.languageName})`, 'success');
          } else {
            this._showNotification('Video binding not found', 'error');
          }
        } catch (error) {
          console.error('[Helios Platform Sidebar] Error loading track:', error);
          this._showNotification('Failed to load captions', 'error');
        }
      }, this.currentTrack);
    } catch (error) {
      console.error('[Helios Platform Sidebar] Error getting tracks:', error);
      this._showNotification('Failed to get available captions', 'error');
    }
  }

  /**
   * Clear sidebar state (called on navigation)
   */
  _clearSidebarState() {
    console.log('[Helios Platform Sidebar] Clearing sidebar state on navigation');

    // Clear subtitle data
    this.currentSubtitles = [];
    this.currentTrack = null;
    this.currentSecondarySubtitles = [];
    this.activeIndex = -1;

    // Reset pause states
    this.pausedByHover = false;
    this.pausedAtEnd = false;

    // Clear resume timeout
    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    // Clear subtitle list display
    if (this.listContainer) {
      this.listContainer.innerHTML = '';
    }

    // Clear video overlay if it exists
    if (this.videoBinding && this.videoBinding.overlay) {
      this.videoBinding.overlay.clear();
      this.videoBinding.overlay.clearSecondarySubtitles();
    }

    // Reset video binding reference (will be set again when new video loads)
    this.videoBinding = null;

    console.log('[Helios Platform Sidebar] Sidebar state cleared');
  }

  /**
   * Show sidebar
   */
  show() {
    if (this.sidebar) {
      console.log('[Helios Platform Sidebar] Showing sidebar');
      this.sidebar.classList.remove('hidden');
      this.sidebar.style.setProperty('display', 'flex', 'important');
      this.sidebar.style.setProperty('visibility', 'visible', 'important');
      this.sidebar.style.setProperty('opacity', '1', 'important');
      this.isVisible = true;

      // Re-adjust video layout and sync height
      requestAnimationFrame(() => {
        this._adjustVideoLayout();
        this._syncSidebarToVideoHeight();
      });
    } else {
      console.warn('[Helios Platform Sidebar] Cannot show sidebar - sidebar element not found');
    }
  }

  /**
   * Hide sidebar
   */
  hide() {
    if (this.sidebar) {
      this.sidebar.classList.add('hidden');
      this.sidebar.style.setProperty('display', 'none', 'important');
      this.sidebar.style.setProperty('visibility', 'hidden', 'important');
      this.sidebar.style.setProperty('opacity', '0', 'important');
      this.isVisible = false;

      // Remove video layout adjustment
      this._removeVideoLayoutAdjustment();
    }
  }

  /**
   * Remove video layout adjustment when hiding sidebar
   */
  _removeVideoLayoutAdjustment() {
    const hostname = window.location.hostname.toLowerCase();
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

    // Restore video element in fullscreen
    if (isFullscreen) {
      const video = document.querySelector('video');
      if (video) {
        video.style.width = '';
        video.style.maxWidth = '';
        video.style.marginLeft = '';
        video.style.marginRight = '';
      }

      const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
      if (fullscreenEl) {
        fullscreenEl.style.paddingRight = '';
      }
    }

    // Restore normal mode containers
    let videoContainer = null;

    if (hostname.includes('netflix.com')) {
      videoContainer = document.querySelector('.watch-video') ||
                      document.querySelector('.NFPlayer') ||
                      document.querySelector('[data-uia="watch-video"]');
      document.body.style.overflowX = '';
    } else if (hostname.includes('disneyplus.com')) {
      videoContainer = document.querySelector('.btm-media-player-root') ||
                      document.querySelector('[data-testid="media-player-container"]');
    } else if (hostname.includes('amazon.') || hostname.includes('primevideo.com')) {
      videoContainer = document.querySelector('.dv-player-fullscreen') ||
                      document.querySelector('[data-testid="player-container"]') ||
                      document.querySelector('.cascadesContainer');
    }

    if (videoContainer) {
      videoContainer.style.width = '';
      videoContainer.style.maxWidth = '';

      if (hostname.includes('netflix.com')) {
        const timedText = document.querySelector('.player-timedtext-text-container');
        if (timedText) {
          timedText.style.maxWidth = '';
        }
      }
    }
  }

  /**
   * Toggle sidebar visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Jump to previous subtitle
   */
  _jumpToPreviousSubtitle() {
    if (!this.videoBinding) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const subtitleCollection = this.videoBinding.getSubtitles();
    const previousSubtitle = subtitleCollection.getPreviousSubtitle(currentTime);

    if (previousSubtitle) {
      this.videoBinding.seekTo(previousSubtitle.start);
      console.log('[Helios Hotkeys] Jumped to previous subtitle');
    }
  }

  /**
   * Jump to next subtitle
   */
  _jumpToNextSubtitle() {
    if (!this.videoBinding) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const subtitleCollection = this.videoBinding.getSubtitles();
    const nextSubtitle = subtitleCollection.getNextSubtitle(currentTime);

    if (nextSubtitle) {
      this.videoBinding.seekTo(nextSubtitle.start);
      console.log('[Helios Hotkeys] Jumped to next subtitle');
    }
  }

  /**
   * Jump to current subtitle start
   */
  _jumpToCurrentSubtitleStart() {
    if (!this.videoBinding || this.currentSubtitles.length === 0) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const activeSubtitle = this.currentSubtitles.find(entry =>
      currentTime >= entry.start && currentTime <= entry.end
    );

    if (activeSubtitle) {
      this.videoBinding.seekTo(activeSubtitle.start);
      console.log('[Helios Hotkeys] Jumped to current subtitle start');
    }
  }

  /**
   * Toggle subtitle overlay visibility
   */
  _toggleSubtitleOverlay() {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    const isVisible = this.videoBinding.overlay.toggleVisibility();
    console.log(`[Helios Hotkeys] Subtitle overlay ${isVisible ? 'shown' : 'hidden'}`);
  }

  /**
   * Adjust subtitle size by delta
   */
  _adjustSubtitleSize(delta) {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    const currentSize = this.videoBinding.overlay.getSubtitleSize();
    const newSize = Math.max(12, Math.min(100, currentSize + delta));
    this._setSubtitleSize(newSize);
  }

  /**
   * Set subtitle size
   */
  _setSubtitleSize(size) {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    const clampedSize = Math.max(12, Math.min(100, size));
    this.videoBinding.overlay.setSubtitleSize(clampedSize);

    // Update input field
    if (this.sizeInput) {
      this.sizeInput.value = clampedSize;
      console.log('[Helios Platform Sidebar] Updated size input to:', clampedSize);
    } else {
      console.warn('[Helios Platform Sidebar] Size input element not found!');
    }
  }

  /**
   * Load settings from storage
   */
  async _loadSettings() {
    try {
      const result = await chrome.storage.local.get(['platformSidebarSettings']);
      if (result.platformSidebarSettings) {
        const loaded = result.platformSidebarSettings;

        // Migrate old hotkey format
        if (loaded.hotkeys) {
          Object.keys(loaded.hotkeys).forEach(key => {
            const hotkey = loaded.hotkeys[key];
            if (typeof hotkey === 'string') {
              loaded.hotkeys[key] = {
                key: hotkey,
                shift: false,
                ctrl: false,
                alt: false
              };
            }
          });
        }

        this.settings = { ...this.settings, ...loaded };
      }
    } catch (error) {
      console.error('[Helios Platform Sidebar] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  async _saveSettings() {
    try {
      await chrome.storage.local.set({ platformSidebarSettings: this.settings });
      console.log('[Helios Platform Sidebar] Settings saved');
    } catch (error) {
      console.error('[Helios Platform Sidebar] Failed to save settings:', error);
    }
  }

  /**
   * Destroy sidebar
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
      this.sidebarScrollTimeout = null;
    }

    // Remove video layout adjustment
    this._removeVideoLayoutAdjustment();

    if (this.sidebar && this.sidebar.parentElement) {
      this.sidebar.parentElement.removeChild(this.sidebar);
    }
    this.sidebar = null;
  }
}

// Initialize platform sidebar
window.platformVideoSidebar = new PlatformVideoSidebar();
