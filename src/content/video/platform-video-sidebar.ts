import { browser } from 'wxt/browser';
import { provideServices, revokeService, services } from '@/content/services';
import { items, storage } from '@/config/storage';
import { VideoConstants } from '@/content/video/config/video-constants';
import { PlatformDetector } from '@/content/video/core/platform-detector';
import { formatHotkeyDisplay, type HotkeyConfig } from '@/content/video/sidebar/hotkey-display';
import { extractPotentialWords } from '@/content/video/sidebar/subtitle-text';
import { binarySearchSubtitle, findMatchingSubtitle, formatTime } from '@/content/video/sidebar/subtitle-timing';
import {
  adjustVideoLayout,
  applyPlatformPositioning,
  removeVideoLayoutAdjustment,
  resetFullscreenStyles,
  syncSidebarPosition
} from '@/content/video/sidebar/video-layout';
import { SubtitleSelectorModal } from '@/content/video/ui/subtitle-selector-modal';
import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';
import type { VideoBinding } from '@/content/video/core/video-binding';

interface PlatformSidebarSettings {
  hotkeysEnabled: boolean;
  dualSubtitlesEnabled: boolean;
  secondarySubtitleLanguage: string | null;
  pauseOnHover: boolean;
  pauseAtEnd: boolean;
  hotkeys: {
    previous: HotkeyConfig;
    next: HotkeyConfig;
    restart: HotkeyConfig;
    toggle: HotkeyConfig;
  };
}

/**
 * Helios Platform Video Sidebar Controller
 * Generic sidebar for Netflix, Disney+, Prime, and other streaming platforms
 * Works exactly like YouTube sidebar but with platform-agnostic positioning
 */
export class PlatformVideoSidebar {
  sidebar: HTMLElement | null;
  listContainer: HTMLElement | null;
  currentSubtitles: SubtitleEntry[];
  currentTrack: any;
  videoBinding: VideoBinding | null;
  isVisible: boolean;
  activeIndex: number;
  currentSecondarySubtitles: SubtitleEntry[];
  resizeObserver: ResizeObserver | null;

  // Scroll detection
  userIsScrollingSidebar: boolean;
  sidebarScrollTimeout: ReturnType<typeof setTimeout> | null;
  isAutoScrolling: boolean;
  mouseInScrollZone: boolean;

  // Settings (same as YouTube sidebar)
  settings: PlatformSidebarSettings;

  // Pause on hover state
  pausedByHover: boolean;
  resumeTimeout: ReturnType<typeof setTimeout> | null;

  // Pause at end state tracking
  pausedAtEnd: boolean;

  // Hotkey jumping flag (prevents auto-pause when using A/D keys)
  isHotkeyJumping: boolean;

  // Update queue to prevent race conditions
  updateQueue: Promise<void>;
  isUpdating: boolean;

  videoFeatureEnabled?: boolean;

  // Elements resolved from sidebar HTML after load
  subtitleSection: HTMLElement | null = null;
  settingsSection: HTMLElement | null = null;
  settingsBtn: HTMLElement | null = null;
  closeBtn: HTMLElement | null = null;
  selectCaptionBtn: HTMLElement | null = null;
  notificationElement: HTMLElement | null = null;
  notificationMessage: HTMLElement | null = null;
  hotkeysToggle: HTMLInputElement | null = null;
  dualSubtitlesToggle: HTMLInputElement | null = null;
  secondaryLanguageSelect: HTMLSelectElement | null = null;
  secondaryLanguageContainer: HTMLElement | null = null;
  pauseOnHoverToggle: HTMLInputElement | null = null;
  pauseAtEndToggle: HTMLInputElement | null = null;
  increaseSizeBtn: HTMLElement | null = null;
  decreaseSizeBtn: HTMLElement | null = null;
  sizeInput: HTMLInputElement | null = null;
  opacityInput: HTMLInputElement | null = null;
  hotkeyPrevInput: HTMLInputElement | null = null;
  hotkeyNextInput: HTMLInputElement | null = null;
  hotkeyRestartInput: HTMLInputElement | null = null;
  hotkeyToggleInput: HTMLInputElement | null = null;

  notificationTimeout: ReturnType<typeof setTimeout> | null = null;
  resizeHandler: (() => void) | null = null;

  // Stored document/window event handlers (removed on destroy)
  _fullscreenHandler: (() => void) | null = null;
  _subtitlesLoadedListener: EventListener | null = null;
  _videoTimeUpdateListener: EventListener | null = null;
  _toggleSubtitlePanelListener: EventListener | null = null;
  _vocabUpdatedListener: EventListener | null = null;
  _videoNotificationListener: EventListener | null = null;
  _hotkeyListener: ((e: KeyboardEvent) => void) | null = null;
  _globalMouseMoveListener: EventListener | null = null;

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

    // Hotkey jumping flag (prevents auto-pause when using A/D keys)
    this.isHotkeyJumping = false;

    // Update queue to prevent race conditions
    this.updateQueue = Promise.resolve();
    this.isUpdating = false;

    // Load settings from storage and check if video feature is enabled
    this._loadSettings().then(() => {
      // Only initialize if video feature is enabled globally
      if (this.videoFeatureEnabled && this._isSupportedPlatform() && !this._isYouTubePage()) {
        this._init();
      }
    });
  }

  /**
   * Register an interval through the content-script context when one exists, so
   * it is cleared automatically if the script is invalidated (extension reload,
   * SPA navigation away). Falls back to the global for the non-content-script
   * pages that load this module. The returned id still works with clearInterval.
   */
  _setInterval(handler: () => void, ms: number): ReturnType<typeof setInterval> {
    // ctx.setInterval hands back the DOM's numeric timer id; the ambient global
    // here is typed as Node's Timeout, so normalize to the global's own id type
    // to keep the existing clearInterval call sites working.
    return (services.ctx?.setInterval(handler, ms) ?? setInterval(handler, ms)) as ReturnType<typeof setInterval>;
  }

  /**
   * Register a document/window listener through the content-script context when
   * one exists, so it is removed automatically on invalidation. The listener can
   * still be removed early with the normal removeEventListener.
   */
  _addEventListener<E extends Event>(
    target: EventTarget,
    type: string,
    handler: (event: E) => void,
    options?: AddEventListenerOptions
  ): void {
    if (services.ctx) {
      services.ctx.addEventListener(target, type, handler as EventListener, options);
    } else {
      target.addEventListener(type, handler as EventListener, options);
    }
  }

  /**
   * Check if current page is a supported streaming platform (not YouTube)
   */
  _isSupportedPlatform(): boolean {
    const hostname = window.location.hostname.toLowerCase();
    return hostname.includes('netflix.com') ||
           hostname.includes('disneyplus.com') ||
           hostname.includes('amazon.') ||
           hostname.includes('primevideo.com');
  }

  /**
   * Check if current page is YouTube (to avoid conflict)
   */
  _isYouTubePage(): boolean {
    return window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  /**
   * Initialize sidebar
   */
  async _init(): Promise<void> {
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
  _setupNavigationListener(): void {
    let lastUrl = window.location.href;

    // Check URL changes periodically (for SPAs)
    this._setInterval(() => {
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
          }, VideoConstants.TIMING.NAVIGATION_DELAY);
        } else {
          this.hide();
        }
      }
    }, VideoConstants.TIMING.NAVIGATION_POLL);
  }

  /**
   * Check if current page is a watch/video page
   */
  _isWatchPage(): boolean {
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
  async _loadSidebar(): Promise<void> {
    try {
      const response = await fetch(browser.runtime.getURL('/ui/youtube-sidebar/youtube-sidebar.html'));
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      this.sidebar = doc.querySelector<HTMLElement>('.helios-youtube-sidebar');

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
      link.href = browser.runtime.getURL('/ui/youtube-sidebar/youtube-sidebar.css');
      document.head.appendChild(link);

      // Append to body with fixed positioning
      document.body.appendChild(this.sidebar);

      // Apply platform-specific positioning
      this._applyPlatformPositioning();

      // Get elements
      this.listContainer = this.sidebar.querySelector<HTMLElement>('#yt-subtitle-list');
      this.subtitleSection = this.sidebar.querySelector<HTMLElement>('#yt-subtitle-section');
      this.settingsSection = this.sidebar.querySelector<HTMLElement>('#yt-settings-section');
      this.settingsBtn = this.sidebar.querySelector<HTMLElement>('#yt-settings-btn');
      this.closeBtn = this.sidebar.querySelector<HTMLElement>('#yt-close-btn');
      this.selectCaptionBtn = this.sidebar.querySelector<HTMLElement>('#yt-select-caption-btn');
      this.notificationElement = this.sidebar.querySelector<HTMLElement>('#yt-notification');
      this.notificationMessage = this.sidebar.querySelector<HTMLElement>('.yt-notification-message');

      // Get settings elements
      this.hotkeysToggle = this.sidebar.querySelector<HTMLInputElement>('#yt-hotkeys-toggle');
      this.dualSubtitlesToggle = this.sidebar.querySelector<HTMLInputElement>('#yt-dual-subtitles-toggle');
      this.secondaryLanguageSelect = this.sidebar.querySelector<HTMLSelectElement>('#yt-secondary-language-select');
      this.secondaryLanguageContainer = this.sidebar.querySelector<HTMLElement>('#yt-secondary-language-container');
      this.pauseOnHoverToggle = this.sidebar.querySelector<HTMLInputElement>('#yt-pause-on-hover-toggle');
      this.pauseAtEndToggle = this.sidebar.querySelector<HTMLInputElement>('#yt-pause-at-end-toggle');

      // Caption size controls
      this.increaseSizeBtn = this.sidebar.querySelector<HTMLElement>('#yt-increase-size-btn');
      this.decreaseSizeBtn = this.sidebar.querySelector<HTMLElement>('#yt-decrease-size-btn');
      this.sizeInput = this.sidebar.querySelector<HTMLInputElement>('#yt-size-input');
      this.opacityInput = this.sidebar.querySelector<HTMLInputElement>('#yt-opacity-input');

      // Get hotkey input elements
      this.hotkeyPrevInput = this.sidebar.querySelector<HTMLInputElement>('#yt-hotkey-prev');
      this.hotkeyNextInput = this.sidebar.querySelector<HTMLInputElement>('#yt-hotkey-next');
      this.hotkeyRestartInput = this.sidebar.querySelector<HTMLInputElement>('#yt-hotkey-restart');
      this.hotkeyToggleInput = this.sidebar.querySelector<HTMLInputElement>('#yt-hotkey-toggle');

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
  _applyPlatformPositioning(): void {
    if (!this.sidebar) return;

    applyPlatformPositioning(this.sidebar);
    this.isVisible = false;
  }


  /**
   * Adjust video layout to push video left and make room for sidebar
   */
  _adjustVideoLayout(): void {
    adjustVideoLayout();
  }

  /**
   * Reset fullscreen styles when exiting fullscreen
   */
  _resetFullscreenStyles(): void {
    resetFullscreenStyles();
  }

  /**
   * Sync sidebar height to match video player height
   */
  _syncSidebarToVideoHeight(): void {
    if (!this.sidebar) return;

    const syncHeight = () => {
      try {
        // Find the video element
        const videoElement = document.querySelector('video');

        if (!videoElement) {
          setTimeout(syncHeight, VideoConstants.TIMING.LAYOUT_RETRY);
          return;
        }

        const videoRect = videoElement.getBoundingClientRect();
        const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement);

        syncSidebarPosition(this.sidebar!, isFullscreen);
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
    let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
    const resizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(syncHeight, VideoConstants.TIMING.RESIZE_DEBOUNCE);
    };
    // _syncSidebarToVideoHeight() can run multiple times; drop the previous
    // registration so repeated calls do not stack duplicate resize handlers.
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this._addEventListener(window, 'resize', resizeHandler);
    this.resizeHandler = resizeHandler;

    // Setup fullscreen listener
    this._setupFullscreenListener();
  }

  /**
   * Setup fullscreen change listener
   */
  _setupFullscreenListener(): void {
    let layoutEnforcer: ReturnType<typeof setInterval> | null = null;

    const fullscreenHandler = () => {
      try {
        const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement);

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
          const fullscreenEl = (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement) as HTMLElement | null;
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
          this.sidebar.style.setProperty('z-index', VideoConstants.Z_INDEX.SIDEBAR_FULLSCREEN.toString(), 'important');

          // Continuously enforce layout adjustments in fullscreen (Netflix fights back)
          layoutEnforcer = this._setInterval(() => {
            this._adjustVideoLayout();
          }, VideoConstants.TIMING.FULLSCREEN_ENFORCE);

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

    // _setupFullscreenListener() is reached from _syncSidebarToVideoHeight(),
    // which can run multiple times; drop the previous registration so repeated
    // calls do not stack duplicate fullscreen handlers.
    if (this._fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this._fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
      document.removeEventListener('mozfullscreenchange', this._fullscreenHandler);
    }
    this._fullscreenHandler = fullscreenHandler;

    this._addEventListener(document, 'fullscreenchange', fullscreenHandler);
    this._addEventListener(document, 'webkitfullscreenchange', fullscreenHandler);
    this._addEventListener(document, 'mozfullscreenchange', fullscreenHandler);
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners(): void {
    // Listen for subtitles being loaded
    this._subtitlesLoadedListener = (e) => {
      const { track, entries, binding } = (e as CustomEvent).detail;
      this.videoBinding = binding;
      this.updateSubtitles(entries, track);
    };
    this._addEventListener(document, 'helios-subtitles-loaded', this._subtitlesLoadedListener);

    // Listen for time updates to highlight current subtitle
    this._videoTimeUpdateListener = (e) => {
      const { currentTime, binding } = (e as CustomEvent).detail;

      // If this is a new binding, update overlay settings
      if (this.videoBinding !== binding) {
        this.videoBinding = binding;

        // Apply pause on hover setting to the overlay
        if (this.videoBinding && this.videoBinding.overlay) {
          this.videoBinding.overlay.setPauseOnHover(this.settings.pauseOnHover);
        }
      }

      this._updateActiveSubtitle(currentTime);
    };
    this._addEventListener(document, 'helios-video-timeupdate', this._videoTimeUpdateListener);

    // Toggle sidebar visibility
    this._toggleSubtitlePanelListener = () => {
      this.toggle();
    };
    this._addEventListener(document, 'helios-toggle-subtitle-panel', this._toggleSubtitlePanelListener);

    // Listen for vocabulary updates
    this._vocabUpdatedListener = (e) => {
      const rawWords = (e as CustomEvent)?.detail?.words;
      const changedWords = (Array.isArray(rawWords) || typeof rawWords === 'string') ? rawWords : null;

      this._updateUnderlining(changedWords).catch(err => {
        console.error('[Helios Platform Sidebar] Error updating underlining:', err);
      });
    };
    this._addEventListener(document, 'helios-vocab-updated', this._vocabUpdatedListener);

    // Setup global mouse listener for pause-on-hover
    this._setupPauseOnHoverListener();

    // Listen for video notifications
    this._videoNotificationListener = (e) => {
      const { message, type } = (e as CustomEvent).detail;
      this._showNotification(message, type);
    };
    this._addEventListener(document, 'helios-video-notification', this._videoNotificationListener);

    // Setup hotkeys
    this._setupHotkeys();

    // Setup scroll detection
    this._setupScrollDetection();
  }

  /**
   * Setup scroll detection
   */
  _setupScrollDetection(): void {
    const handleSidebarScroll = (e: Event) => {
      if (this.isAutoScrolling) return;

      this.userIsScrollingSidebar = true;

      if (this.sidebarScrollTimeout) {
        clearTimeout(this.sidebarScrollTimeout);
      }

      this.sidebarScrollTimeout = setTimeout(() => {
        this.userIsScrollingSidebar = false;
      }, VideoConstants.TIMING.SCROLL_RESET);
    };

    const handleMouseMove = (e: MouseEvent) => {
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

    const preventScrollOutsideZone = (e: Event) => {
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
  _setupHotkeys(): void {
    this._hotkeyListener = (e) => {
      // Only trigger if hotkeys are enabled and we're on a watch page
      if (!this.settings.hotkeysEnabled || !this._isWatchPage()) {
        return;
      }

      // Don't trigger if user is typing
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      let keyName = e.key;
      if (keyName.startsWith('Arrow')) {
        keyName = keyName.substring(5);
      }
      const key = keyName.toLowerCase();

      const matchesHotkey = (hotkey: HotkeyConfig) => {
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
    };
    this._addEventListener(document, 'keydown', this._hotkeyListener);
  }

  /**
   * Setup header buttons
   */
  _setupHeaderButtons(): void {
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        this._toggleSettings();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        const isShowingSettings = this.settingsSection!.style.display !== 'none';

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
  _toggleSettings(): void {
    const isShowingSettings = this.settingsSection!.style.display !== 'none';

    if (isShowingSettings) {
      this.settingsSection!.style.display = 'none';
      this.subtitleSection!.style.display = 'flex';

      this.closeBtn!.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      this.closeBtn!.setAttribute('title', 'Close');
    } else {
      this.subtitleSection!.style.display = 'none';
      this.settingsSection!.style.display = 'flex';

      this.closeBtn!.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
      this.closeBtn!.setAttribute('title', 'Back to subtitles');

      this._updateLanguageDropdown();
    }
  }

  /**
   * Update language dropdown with available tracks
   */
  async _updateLanguageDropdown(): Promise<void> {
    if (!this.secondaryLanguageSelect) return;

    try {
      const platform = PlatformDetector.detectPlatform();

      // Get the appropriate loader based on platform
      let platformLoader: any = null;
      if (platform === 'netflix') {
        platformLoader = services.videoFeature?.netflixLoader;
      } else if (platform === 'youtube') {
        platformLoader = services.videoFeature?.youtubeLoader;
      }

      if (!platformLoader || !platformLoader.getAvailableTracks) {
        console.warn('[Helios Platform Sidebar] Platform loader not available for:', platform);
        return;
      }

      const tracks = await platformLoader.getAvailableTracks();

      if (!tracks || tracks.length === 0) {
        return;
      }

      const languageMap = new Map<string, string>();

      tracks.forEach((track: any) => {
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
        this.secondaryLanguageSelect!.appendChild(option);
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
  _setupSettingsListeners(): void {
    if (this.hotkeysToggle) {
      this.hotkeysToggle.addEventListener('change', (e) => {
        this.settings.hotkeysEnabled = (e.target as HTMLInputElement).checked;
        this._saveSettings();
      });
    }

    if (this.dualSubtitlesToggle) {
      this.dualSubtitlesToggle.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.settings.dualSubtitlesEnabled = checked;
        this._saveSettings();

        if (this.secondaryLanguageContainer) {
          this.secondaryLanguageContainer.style.display = checked ? 'block' : 'none';
        }

        if (checked) {
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
        this.settings.secondarySubtitleLanguage = (e.target as HTMLSelectElement).value || null;
        this._saveSettings();

        if (this.settings.dualSubtitlesEnabled) {
          this._loadSecondarySubtitles();
        }
      });
    }

    if (this.pauseOnHoverToggle) {
      this.pauseOnHoverToggle.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.settings.pauseOnHover = checked;
        this._saveSettings();

        if (this.videoBinding && this.videoBinding.overlay) {
          this.videoBinding.overlay.setPauseOnHover(checked);
        }
      });
    }

    if (this.pauseAtEndToggle) {
      this.pauseAtEndToggle.addEventListener('change', (e) => {
        this.settings.pauseAtEnd = (e.target as HTMLInputElement).checked;
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
        const size = parseInt((e.target as HTMLInputElement).value);
        if (size && size >= 12 && size <= 100) {
          this._setSubtitleSize(size);
        }
      });

      // Input event (live update as user types)
      this.sizeInput.addEventListener('input', (e) => {
        const size = parseInt((e.target as HTMLInputElement).value);
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

    // Background opacity control
    if (this.opacityInput) {
      const applyOpacity = (pct: number) => {
        if (this.videoBinding && this.videoBinding.overlay && !isNaN(pct) && pct >= 0 && pct <= 100) {
          this.videoBinding.overlay.setSubtitleBackgroundOpacity(pct / 100);
        }
      };
      this.opacityInput.addEventListener('change', (e) => applyOpacity(parseInt((e.target as HTMLInputElement).value, 10)));
      this.opacityInput.addEventListener('input', (e) => applyOpacity(parseInt((e.target as HTMLInputElement).value, 10)));
    }
  }

  /**
   * Setup hotkey input listeners
   */
  _setupHotkeyInputs(): void {
    const inputs: Array<{ element: HTMLInputElement | null; key: keyof PlatformSidebarSettings['hotkeys'] }> = [
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

        const newHotkey: HotkeyConfig = {
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
  _formatHotkeyDisplay(hotkey: HotkeyConfig): string {
    return formatHotkeyDisplay(hotkey);
  }

  /**
   * Apply loaded settings to UI
   */
  _applySettingsToUI(): void {
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
      this.sizeInput.value = String(currentSize);
    }

    // Update opacity input with current overlay background opacity (0–100%)
    if (this.opacityInput && this.videoBinding && this.videoBinding.overlay) {
      const opacity = this.videoBinding.overlay.getSubtitleBackgroundOpacity();
      this.opacityInput.value = String(Math.round(opacity * 100));
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
  async updateSubtitles(entries: SubtitleEntry[], track: any): Promise<void> {
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
  async _loadSecondarySubtitles(): Promise<void> {
    if (!this.videoBinding) {
      console.warn('[Helios Platform Sidebar] Cannot load secondary subtitles: no video binding');
      return;
    }

    try {
      const platform = PlatformDetector.detectPlatform();

      // Get the appropriate loader based on platform
      let platformLoader: any = null;
      if (platform === 'netflix') {
        platformLoader = services.videoFeature?.netflixLoader;
      } else if (platform === 'youtube') {
        platformLoader = services.videoFeature?.youtubeLoader;
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
      let secondaryTrack: any = null;
      const currentTrackLang = this.currentTrack?.language;

      if (this.settings.secondarySubtitleLanguage) {
        const selectedLang = this.settings.secondarySubtitleLanguage;
        const matchingTracks = tracks.filter((t: any) => {
          return t.language === selectedLang ||
                 t.language?.startsWith(selectedLang + '-') ||
                 t.language?.split('-')[0] === selectedLang;
        });

        secondaryTrack = matchingTracks.find((t: any) => t.language !== currentTrackLang) || matchingTracks[0];
      } else {
        // Auto-detect: prefer English
        const englishTracks = tracks.filter((t: any) => t.language === 'en' || t.language?.startsWith('en-'));
        secondaryTrack = englishTracks.find((t: any) => t.language !== currentTrackLang) || englishTracks[0];

        if (!secondaryTrack || secondaryTrack.language === currentTrackLang) {
          secondaryTrack = tracks.find((t: any) => t.language !== currentTrackLang) || tracks[0];
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
  _showNotification(message: string, type: string = 'info'): void {
    if (!this.notificationElement || !this.notificationMessage) return;

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationMessage.textContent = message;
    this.notificationElement.className = `yt-notification yt-notification-${type}`;
    this.notificationElement.style.display = 'block';

    this.notificationTimeout = setTimeout(() => {
      this.notificationElement!.style.display = 'none';
    }, 3000);
  }

  /**
   * Extract potential words from text
   */
  _extractPotentialWords(text: string): string[] {
    const currentLang = services.languageRegistry?.getCurrentLanguage();
    // This sidebar has always used a fixed 10-character cap, unlike the YouTube
    // one which reads the adapter's maxWordLength.
    return extractPotentialWords(text, currentLang, () => 10);
  }

  /**
   * Render subtitle list
   */
  async _renderSubtitleList(): Promise<void> {
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
    if (services.dictionaryManager && (services.dictionaryManager as any).preloadWords) {
      const allWordsToPreload: string[] = [];
      this.currentSubtitles.forEach(entry => {
        const words = this._extractPotentialWords(entry.text);
        allWordsToPreload.push(...words);
      });

      const uniqueWords = [...new Set(allWordsToPreload)];
      if (uniqueWords.length > 0) {
        await (services.dictionaryManager as any).preloadWords(uniqueWords);
      }
    }

    // Create subtitle items
    for (const entry of this.currentSubtitles) {
      const index = this.currentSubtitles.indexOf(entry);
      const item = document.createElement('div');
      item.className = 'yt-subtitle-item';
      item.dataset.index = String(index);

      const timestamp = document.createElement('div');
      timestamp.className = 'yt-subtitle-timestamp';
      timestamp.textContent = this._formatTime(entry.start);

      const textContainer = document.createElement('div');
      textContainer.className = 'yt-subtitle-text-container';

      const primaryText = document.createElement('div');
      primaryText.className = 'yt-subtitle-text yt-subtitle-text-primary';

      const adapter = services.languageRegistry?.getAdapter();

      if (adapter && adapter.extractWords && services.dictionaryManager) {
        const wordsToPreload = this._extractPotentialWords(entry.text);
        if (wordsToPreload.length > 0 && (services.dictionaryManager as any).preloadWords) {
          await (services.dictionaryManager as any).preloadWords(wordsToPreload);
        }

        const dictionary: any = services.dictionaryManager?.dictionary || {};
        // Use language-aware word extraction (EXACTLY like YouTube)
        const extractedWords: any[] = await adapter.extractWords(entry.text, dictionary);

        // Additional safeguard: preload ALL extracted words (including those marked as non-target)
        // This ensures words that weren't found during initial extraction can be found after preloading
        const allExtractedWords = extractedWords.map(({ word }) => word.toLowerCase());
        if (allExtractedWords.length > 0 && (services.dictionaryManager as any).preloadWords) {
          await (services.dictionaryManager as any).preloadWords(allExtractedWords);
        }

        // Refresh dictionary reference after preloading
        const dictionaryAfterPreload: any = services.dictionaryManager?.dictionary || {};

        // Re-check words that were marked as non-target - they might be in dictionary now
        // This fixes cases where words weren't found during initial extraction due to timing
        extractedWords.forEach(extractedWord => {
          // findDictionaryForm only exists on space-separated adapters
          const formAdapter = adapter as any;
          if (extractedWord.isTargetLang === false && formAdapter && formAdapter.findDictionaryForm) {
            const dictionaryForm = formAdapter.findDictionaryForm(extractedWord.word, dictionaryAfterPreload);
            if (dictionaryForm) {
              // Word is in dictionary - mark as target language
              extractedWord.isTargetLang = true;
              extractedWord.dictionaryForm = dictionaryForm;
            }
          }
        });

        // Check if language uses spaces between words (not CJK languages)
        const currentLang = services.languageRegistry?.getCurrentLanguage();
        const usesSpaces = currentLang && !['zh', 'ja', 'ko'].includes(currentLang);

        extractedWords.forEach(({ word, offset, isTargetLang, dictionaryForm }, index) => {
          const wordSpan = document.createElement('span');

          if (isTargetLang !== false) {
            // Target language word - add interactive features
            wordSpan.className = 'yt-subtitle-word';
            wordSpan.style.cursor = 'pointer';

            // Mark as subtitle word for hover-without-shift functionality
            wordSpan.setAttribute('data-subtitle-word', 'true');
            // Use dictionaryForm if available (normalized form), otherwise use original word
            // This ensures lookups work correctly even if the original word has different casing
            const wordForLookup = dictionaryForm || word.toLowerCase();
            wordSpan.setAttribute('data-helios-word', wordForLookup);

            // Check if word is unknown and add styling
            // Use dictionaryForm if available (normalized form), otherwise use lowercase word
            const cleanWord = dictionaryForm || word.toLowerCase();

            // Underline unknown words (no length restriction, matches YouTube sidebar and caption overlay)
            if (services.vocabManager &&
                dictionaryAfterPreload[cleanWord] &&
                !services.vocabManager.isWordKnown(cleanWord) &&
                !services.vocabManager.isWordIgnored(cleanWord) &&
                !services.vocabManager.isWordLearning(cleanWord)) {
              wordSpan.classList.add('unknown-word');
            } else if (services.vocabManager!.isWordLearning(cleanWord)) {
              wordSpan.classList.add('learning-word');
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

          // Add space after word/punctuation if:
          // 1. Language uses spaces
          // 2. This is not the last word
          // 3. Next item is a word (not punctuation)
          // 4. Current item is either a word OR punctuation that should have space after it (not hyphens)
          if (usesSpaces && index < extractedWords.length - 1) {
            const currentIsWord = isTargetLang !== false;
            const nextWord = extractedWords[index + 1];
            const nextIsWord = nextWord && nextWord.isTargetLang !== false;

            // Check if current item is punctuation that should have space after it
            const punctuationWithSpaceAfter = /^[.!?,:;]$/.test(word.trim());
            const isHyphen = word.trim() === '-';

            // Add space if:
            // - Current is a word and next is a word, OR
            // - Current is punctuation that should have space after it and next is a word
            // But NOT if current is a hyphen
            if (nextIsWord && !isHyphen && (currentIsWord || punctuationWithSpaceAfter)) {
              primaryText.appendChild(document.createTextNode(' '));
            }
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
  _setupPauseOnHoverListener(): void {
    this._globalMouseMoveListener = (e) => {
      if (!this.settings.pauseOnHover || !this.pausedByHover) return;

      const target = e.target as HTMLElement | null;
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
          }, VideoConstants.TIMING.PAUSE_RESUME_DELAY);
        }
      } else {
        if (this.resumeTimeout) {
          clearTimeout(this.resumeTimeout);
          this.resumeTimeout = null;
        }
      }
    };

    this._addEventListener(document, 'mousemove', this._globalMouseMoveListener);
  }

  /**
   * Update underlining without re-rendering
   * @param changedWords - Optional word or list of words whose state changed
   */
  async _updateUnderlining(changedWords: string | string[] | null = null): Promise<void> {
    if (!this.listContainer || !services.vocabManager || !services.dictionaryManager) return;

    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();

    const hasChangedWords = Array.isArray(changedWords)
      ? changedWords.length > 0
      : !!changedWords;

    // Fast path: only update spans for specific changed words
    if (hasChangedWords) {
      const wordsArray = Array.isArray(changedWords) ? changedWords : [changedWords];
      const normalizedWords = Array.from(new Set(
        wordsArray
          .map(w => (w && typeof w === 'string' ? w.toLowerCase() : null))
          .filter((w): w is string => Boolean(w))
      ));

      if (normalizedWords.length === 0) {
        return;
      }

      const dictionary: any = services.dictionaryManager.dictionary || {};
      const hasCssEscape = window.CSS && typeof window.CSS.escape === 'function';

      normalizedWords.forEach(cleanWord => {
        let wordSpans: NodeListOf<Element> | Element[];
        if (hasCssEscape) {
          const selector = `.yt-subtitle-word[data-helios-word="${CSS.escape(cleanWord)}"]`;
          wordSpans = this.listContainer!.querySelectorAll(selector);
        } else {
          // Fallback: scan all subtitle word spans when CSS.escape is unavailable
          const allSpans = this.listContainer!.querySelectorAll('.yt-subtitle-word');
          wordSpans = Array.from(allSpans).filter(span => {
            const spanWord = (span.getAttribute('data-helios-word') || span.textContent || '').toLowerCase();
            return spanWord === cleanWord;
          });
        }

        let updatedCount = 0;
        wordSpans.forEach(wordSpan => {
          const shouldUnderline = dictionary[cleanWord] &&
                                 !services.vocabManager!.isWordKnown(cleanWord) &&
                                 !services.vocabManager!.isWordIgnored(cleanWord) &&
                                 !services.vocabManager!.isWordLearning(cleanWord);

          // Remove all word state classes first
          wordSpan.classList.remove('unknown-word', 'learning-word');

          if (shouldUnderline) {
            wordSpan.classList.add('unknown-word');
          } else if (services.vocabManager!.isWordLearning(cleanWord)) {
            wordSpan.classList.add('learning-word');
          }
          updatedCount++;
        });
        console.log('[Helios Platform Sidebar] Fast-path underlining update for word', cleanWord, '- spans updated:', updatedCount);
      });

      const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
      console.log('[Helios Platform Sidebar] _updateUnderlining fast-path for', normalizedWords.length, 'word(s) took', (t1 - t0).toFixed(1), 'ms');
      return;
    }

    // Fallback: full update of all subtitle word spans (used for bulk operations)
    console.warn('[Helios Platform Sidebar] Falling back to full O(N) underlining update for all subtitle words');
    const wordSpans = this.listContainer.querySelectorAll('.yt-subtitle-word');
    const wordsToCheck = Array.from(wordSpans).map(span => {
      const word = span.textContent || span.getAttribute('data-helios-word');
      return word ? word.toLowerCase() : null;
    }).filter((w): w is string => w !== null);

    if (wordsToCheck.length > 0 && (services.dictionaryManager as any).preloadWords) {
      await (services.dictionaryManager as any).preloadWords(wordsToCheck);
    }

    const dictionary: any = services.dictionaryManager.dictionary || {};

    let updatedCount = 0;
    wordSpans.forEach(wordSpan => {
      const word = wordSpan.textContent || wordSpan.getAttribute('data-helios-word');
      if (!word) return;

      const cleanWord = word.toLowerCase();
      const shouldUnderline = dictionary[cleanWord] &&
                             !services.vocabManager!.isWordKnown(cleanWord) &&
                             !services.vocabManager!.isWordIgnored(cleanWord) &&
                             !services.vocabManager!.isWordLearning(cleanWord);

      // Remove all word state classes first
      wordSpan.classList.remove('unknown-word', 'learning-word');

      if (shouldUnderline) {
        wordSpan.classList.add('unknown-word');
      } else if (services.vocabManager!.isWordLearning(cleanWord)) {
        wordSpan.classList.add('learning-word');
      }
      updatedCount++;
    });

    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios Platform Sidebar] Full O(N) underlining update touched', wordSpans.length, 'spans, updated', updatedCount, 'spans in', (t1 - t0).toFixed(1), 'ms');
  }

  /**
   * Binary search to find active subtitle by time (O(log n) performance)
   */
  _binarySearchSubtitle(currentTime: number): number {
    return binarySearchSubtitle(this.currentSubtitles, currentTime);
  }

  /**
   * Find matching secondary subtitle
   */
  _findMatchingSubtitle(primaryEntry: SubtitleEntry, secondarySubtitles: SubtitleEntry[]): SubtitleEntry | null {
    return findMatchingSubtitle(primaryEntry, secondarySubtitles);
  }

  /**
   * Update active subtitle highlight (optimized with binary search)
   */
  _updateActiveSubtitle(currentTime: number): void {
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

        // Pause when we're within threshold of the end (to account for update interval + buffer)
        if (timeRemaining <= VideoConstants.TIMING.PAUSE_AT_END_THRESHOLD && timeRemaining >= 0) {
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
    // BUT don't pause if user is jumping via hotkeys (A/D keys)
    if (this.settings.pauseAtEnd && !this.pausedAtEnd && this.activeIndex !== -1 && this.videoBinding && !this.isHotkeyJumping) {
      const video = this.videoBinding.videoElement;
      if (!video.paused) {
        video.pause();
      }
    }

    // Update active state - new subtitle
    this.activeIndex = newIndex;
    this.pausedAtEnd = false;  // Reset for new subtitle

    const items = this.listContainer.querySelectorAll<HTMLElement>('.yt-subtitle-item');
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
  _scrollSubtitleToCenter(item: HTMLElement): void {
    if (!this.listContainer || !item) return;

    this.isAutoScrolling = true;

    requestAnimationFrame(() => {
      const containerRect = this.listContainer!.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      const containerCenter = containerRect.height / 2;
      const itemCenter = itemRect.height / 2;
      const scrollOffset = (itemRect.top - containerRect.top) - containerCenter + itemCenter;

      this.listContainer!.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });

      setTimeout(() => {
        this.isAutoScrolling = false;
      }, VideoConstants.TIMING.AUTO_SCROLL_DURATION);
    });
  }

  /**
   * Seek to subtitle
   */
  _seekToSubtitle(entry: SubtitleEntry): void {
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
  _formatTime(ms: number): string {
    return formatTime(ms);
  }

  /**
   * Show caption selector
   */
  async _showCaptionSelector(): Promise<void> {
    console.log('[Helios Platform Sidebar] Opening caption selector');

    const platform = PlatformDetector.detectPlatform();

    // Get the appropriate loader based on platform
    let platformLoader: any = null;
    if (platform === 'netflix') {
      platformLoader = services.videoFeature?.netflixLoader;
    } else if (platform === 'youtube') {
      platformLoader = services.videoFeature?.youtubeLoader;
    }

    if (!platformLoader) {
      this._showNotification('Platform loader not available', 'error');
      return;
    }

    this._showNotification('Loading available captions...', 'info');

    try {
      let tracks = await platformLoader.getAvailableTracks();

      // If there are no existing tracks, still open the selector so the user
      // can use the "Import File" option to add their own subtitles.
      if (!tracks || tracks.length === 0) {
        console.log('[Helios Platform Sidebar] No built-in caption tracks available, showing import-only selector');
        this._showNotification('No built-in captions found. You can import your own file.', 'info');
        tracks = [];
      }

      console.log('[Helios Platform Sidebar] Available tracks:', tracks.length);

      if (!services.subtitleSelectorModal) {
        provideServices({ subtitleSelectorModal: new SubtitleSelectorModal() });
      }

      services.subtitleSelectorModal!.show(tracks, async (selectedTrack: any) => {
        console.log('[Helios Platform Sidebar] Selected track:', selectedTrack.languageName);
        this._showNotification(`Loading ${selectedTrack.languageName} captions...`, 'info');

        try {
          const entries = await platformLoader.loadTrack(selectedTrack);

          if (entries.length === 0) {
            this._showNotification('No captions found in selected track', 'error');
            return;
          }

          const binding = services.videoFeature?.videoDetector?.getPrimaryBinding();
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
  _clearSidebarState(): void {
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
  show(): void {
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
  hide(): void {
    if (this.sidebar) {
      console.log('[Helios Platform Sidebar] Hiding sidebar');
      this.sidebar.classList.add('hidden');
      this.sidebar.style.setProperty('display', 'none', 'important');
      this.sidebar.style.setProperty('visibility', 'hidden', 'important');
      this.sidebar.style.setProperty('opacity', '0', 'important');
      this.isVisible = false;

      // Remove video layout adjustment - restore Netflix to normal
      this._removeVideoLayoutAdjustment();
    }
  }

  /**
   * Remove video layout adjustment when hiding sidebar
   */
  _removeVideoLayoutAdjustment(): void {
    removeVideoLayoutAdjustment();
  }

  /**
   * Toggle sidebar visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Jump to previous subtitle
   */
  _jumpToPreviousSubtitle(): void {
    if (!this.videoBinding) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const subtitleCollection = this.videoBinding.getSubtitles();
    const previousSubtitle = subtitleCollection.getPreviousSubtitle(currentTime);

    if (previousSubtitle) {
      // Set flag to prevent pause-at-end from triggering
      this.isHotkeyJumping = true;
      this.videoBinding.seekTo(previousSubtitle.start);
      // Clear flag after short delay
      setTimeout(() => {
        this.isHotkeyJumping = false;
      }, VideoConstants.TIMING.HOTKEY_JUMP_DELAY);
      console.log('[Helios Hotkeys] Jumped to previous subtitle');
    }
  }

  /**
   * Jump to next subtitle
   */
  _jumpToNextSubtitle(): void {
    if (!this.videoBinding) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const subtitleCollection = this.videoBinding.getSubtitles();
    const nextSubtitle = subtitleCollection.getNextSubtitle(currentTime);

    if (nextSubtitle) {
      // Set flag to prevent pause-at-end from triggering
      this.isHotkeyJumping = true;
      this.videoBinding.seekTo(nextSubtitle.start);
      // Clear flag after short delay
      setTimeout(() => {
        this.isHotkeyJumping = false;
      }, VideoConstants.TIMING.HOTKEY_JUMP_DELAY);
      console.log('[Helios Hotkeys] Jumped to next subtitle');
    }
  }

  /**
   * Jump to current subtitle start
   */
  _jumpToCurrentSubtitleStart(): void {
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
  _toggleSubtitleOverlay(): void {
    if (!this.videoBinding || !this.videoBinding.overlay) {
      console.warn('[Helios Hotkeys] No video binding or overlay available');
      return;
    }

    const isVisible = this.videoBinding.overlay.toggleVisibility();
    console.log(`[Helios Hotkeys] Subtitle overlay ${isVisible ? 'shown' : 'hidden'}`);
  }

  /**
   * Adjust subtitle size by delta
   */
  _adjustSubtitleSize(delta: number): void {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    const currentSize = this.videoBinding.overlay.getSubtitleSize();
    const newSize = Math.max(12, Math.min(100, currentSize + delta));
    this._setSubtitleSize(newSize);
  }

  /**
   * Set subtitle size
   */
  _setSubtitleSize(size: number): void {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    const clampedSize = Math.max(12, Math.min(100, size));
    this.videoBinding.overlay.setSubtitleSize(clampedSize);

    // Update input field
    if (this.sizeInput) {
      this.sizeInput.value = String(clampedSize);
    }
  }

  /**
   * Load settings from storage
   */
  async _loadSettings(): Promise<void> {
    try {
      const [
        { value: platformSidebarSettings },
        { value: videoFeatureEnabled },
        { value: extensionEnabled },
      ] = await storage.getItems([
        items.platformSidebarSettings,
        items.videoFeatureEnabled,
        items.extensionEnabled,
      ]);

      // Check global video feature toggle
      this.videoFeatureEnabled = videoFeatureEnabled;

      // If extension is disabled globally, don't enable video features
      if (!extensionEnabled) {
        console.log('[Helios Platform Sidebar] Extension is disabled globally - sidebar will not initialize');
        this.videoFeatureEnabled = false;
        return; // Exit early, don't initialize
      }

      if (platformSidebarSettings) {
        const loaded: Record<string, any> = platformSidebarSettings;

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
      this.videoFeatureEnabled = true; // Default to enabled on error
    }
  }

  /**
   * Save settings to storage
   */
  async _saveSettings(): Promise<void> {
    try {
      await items.platformSidebarSettings.setValue(this.settings);
      console.log('[Helios Platform Sidebar] Settings saved');
    } catch (error) {
      console.error('[Helios Platform Sidebar] Failed to save settings:', error);
    }
  }

  /**
   * Destroy sidebar
   */
  destroy(): void {
    console.log('[Helios Platform Sidebar] Destroying sidebar...');

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Remove document-level event listeners
    if (this._fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this._fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
      document.removeEventListener('mozfullscreenchange', this._fullscreenHandler);
      this._fullscreenHandler = null;
    }

    if (this._subtitlesLoadedListener) {
      document.removeEventListener('helios-subtitles-loaded', this._subtitlesLoadedListener);
      this._subtitlesLoadedListener = null;
    }

    if (this._videoTimeUpdateListener) {
      document.removeEventListener('helios-video-timeupdate', this._videoTimeUpdateListener);
      this._videoTimeUpdateListener = null;
    }

    if (this._toggleSubtitlePanelListener) {
      document.removeEventListener('helios-toggle-subtitle-panel', this._toggleSubtitlePanelListener);
      this._toggleSubtitlePanelListener = null;
    }

    if (this._vocabUpdatedListener) {
      document.removeEventListener('helios-vocab-updated', this._vocabUpdatedListener);
      this._vocabUpdatedListener = null;
    }

    if (this._videoNotificationListener) {
      document.removeEventListener('helios-video-notification', this._videoNotificationListener);
      this._videoNotificationListener = null;
    }

    if (this._hotkeyListener) {
      document.removeEventListener('keydown', this._hotkeyListener);
      this._hotkeyListener = null;
    }

    if (this._globalMouseMoveListener) {
      document.removeEventListener('mousemove', this._globalMouseMoveListener);
      this._globalMouseMoveListener = null;
    }

    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
      this.sidebarScrollTimeout = null;
    }

    // Clear video binding reference
    if (this.videoBinding) {
      this.videoBinding = null;
    }

    // Clear subtitle data
    this.currentSubtitles = [];
    this.activeIndex = -1;

    // Remove video layout adjustment and restore Netflix to normal
    this._removeVideoLayoutAdjustment();

    // Remove sidebar from DOM
    if (this.sidebar && this.sidebar.parentElement) {
      this.sidebar.parentElement.removeChild(this.sidebar);
    }
    this.sidebar = null;

    console.log('[Helios Platform Sidebar] Sidebar destroyed');
  }
}

// Initialize platform sidebar
provideServices({ platformVideoSidebar: new PlatformVideoSidebar() });

// Listen for video feature toggle changes AND global extension toggle
browser.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Handle global extension toggle (extensionEnabled)
    if (changes.extensionEnabled) {
      const isEnabled = changes.extensionEnabled.newValue !== false;

      if (!isEnabled && services.platformVideoSidebar) {
        console.log('[Helios Platform Sidebar] Extension disabled - hiding and disabling sidebar');
        services.platformVideoSidebar.hide();
        // Optionally destroy to clean up completely
        services.platformVideoSidebar.destroy();
        revokeService('platformVideoSidebar');
      } else if (isEnabled && !services.platformVideoSidebar) {
        console.log('[Helios Platform Sidebar] Extension enabled - reinitializing sidebar');
        provideServices({ platformVideoSidebar: new PlatformVideoSidebar() });
      }
    }

    // Handle video feature specific toggle (videoFeatureEnabled)
    if (changes.videoFeatureEnabled) {
      const isEnabled = changes.videoFeatureEnabled.newValue !== false;

      if (!isEnabled && services.platformVideoSidebar) {
        console.log('[Helios Platform Sidebar] Video features disabled - destroying sidebar');
        services.platformVideoSidebar.destroy();
        revokeService('platformVideoSidebar');
      } else if (isEnabled && !services.platformVideoSidebar) {
        console.log('[Helios Platform Sidebar] Video features enabled - reinitializing sidebar');
        provideServices({ platformVideoSidebar: new PlatformVideoSidebar() });
      }
    }
  }
});
