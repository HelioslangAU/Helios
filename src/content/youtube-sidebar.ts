import { storage } from '@/config/storage';
import { TheaterModeController } from '@/content/video/youtube/theater-mode-controller';
import { YouTubeLayoutManager } from '@/content/video/youtube/layout-manager';
import { SidebarPositioner } from '@/content/video/youtube/sidebar-positioner';
import { SubtitleSelectorModal } from '@/content/video/ui/subtitle-selector-modal';
import { ShortcutHelper } from '@/content/utils/shortcut-helper';
import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';
import type { VideoBinding } from '@/content/video/core/video-binding';

interface HotkeyConfig {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

interface YTSidebarSettings {
  hotkeysEnabled: boolean;
  dualSubtitlesEnabled: boolean;
  secondarySubtitleLanguage: string | null;
  pauseOnHover: boolean;
  pauseAtEnd: boolean;
  autoPlayAfterNav: boolean;
  hotkeys: {
    previous: HotkeyConfig;
    next: HotkeyConfig;
    restart: HotkeyConfig;
    toggle: HotkeyConfig;
  };
}

/**
 * Helios YouTube Sidebar Controller
 * Manages the YouTube-specific sidebar with subtitle list
 *
 * Refactored to use modular architecture:
 * - TheaterModeController: Manages theater mode state (loaded via manifest.json)
 * - YouTubeLayoutManager: Handles page layout modifications (loaded via manifest.json)
 * - SidebarPositioner: Manages sidebar positioning and synchronization (loaded via manifest.json)
 */
export class YouTubeSidebar {
  sidebar: HTMLElement | null;
  listContainer: HTMLElement | null;
  currentSubtitles: SubtitleEntry[];
  currentTrack: any;
  videoBinding: VideoBinding | null;
  isVisible: boolean;
  activeIndex: number;
  currentSecondarySubtitles: SubtitleEntry[];

  // Modular components (NEW!)
  theaterModeController: TheaterModeController | null;
  layoutManager: YouTubeLayoutManager | null;
  sidebarPositioner: SidebarPositioner | null;

  // Scroll detection for preventing auto-scroll during user interaction
  userIsScrollingPage: boolean;
  userIsScrollingSidebar: boolean;
  pageScrollTimeout: ReturnType<typeof setTimeout> | null;
  sidebarScrollTimeout: ReturnType<typeof setTimeout> | null;
  isAutoScrolling: boolean;
  mouseInScrollZone: boolean;

  // Race condition protection for subtitle updates
  isUpdatingSubtitles: boolean;
  pendingSubtitleUpdate: { entries: SubtitleEntry[]; track: any } | null;

  // Settings
  settings: YTSidebarSettings;

  // Pause on hover state tracking
  pausedByHover: boolean;
  resumeTimeout: ReturnType<typeof setTimeout> | null;

  // Pause at end state tracking
  lastSubtitleIndex: number;
  pausedAtEnd: boolean;

  _storageChangeListener: ((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void) | null;

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
  autoPlayToggle: HTMLInputElement | null = null;
  hotkeyPrevInput: HTMLInputElement | null = null;
  hotkeyNextInput: HTMLInputElement | null = null;
  hotkeyRestartInput: HTMLInputElement | null = null;
  hotkeyToggleInput: HTMLInputElement | null = null;

  navigationInterval: ReturnType<typeof setInterval> | null = null;
  notificationTimeout: ReturnType<typeof setTimeout> | null = null;
  _hotkeyListener: ((e: KeyboardEvent) => Promise<void>) | null = null;
  _globalMouseMoveListener: EventListener | null = null;
  layoutObserver: MutationObserver | null = null;
  resizeObserver: ResizeObserver | null = null;
  resizeHandler: (() => void) | null = null;
  currentVideoId: string | null = null;

  constructor() {
    this.sidebar = null;
    this.listContainer = null;
    this.currentSubtitles = [];
    this.currentTrack = null;
    this.videoBinding = null;
    this.isVisible = false;
    this.activeIndex = -1;
    this.currentSecondarySubtitles = []; // Store secondary subtitles for sidebar display

    // Modular components (NEW!)
    this.theaterModeController = new TheaterModeController();
    this.layoutManager = new YouTubeLayoutManager();
    this.sidebarPositioner = null; // Created after sidebar element exists

    // Scroll detection for preventing auto-scroll during user interaction
    this.userIsScrollingPage = false; // Flag to track if user is scrolling the main page
    this.userIsScrollingSidebar = false; // Flag to track if user is manually scrolling the sidebar
    this.pageScrollTimeout = null; // Timeout reference to reset page scroll flag
    this.sidebarScrollTimeout = null; // Timeout reference to reset sidebar scroll flag
    this.isAutoScrolling = false; // Flag to prevent detecting auto-scroll as user scroll
    this.mouseInScrollZone = false; // Flag to track if mouse is in the right 35% scroll zone

    // Race condition protection for subtitle updates
    this.isUpdatingSubtitles = false;
    this.pendingSubtitleUpdate = null;

    // Settings
    this.settings = {
      hotkeysEnabled: true,
      dualSubtitlesEnabled: false,
      secondarySubtitleLanguage: null,
      pauseOnHover: true,
      pauseAtEnd: false,  // Pause at the end of each subtitle
      // Navigation behavior settings
      autoPlayAfterNav: false,  // Auto-play after A/S/D navigation (when video is paused)
      hotkeys: {
        previous: { key: 'a', shift: false, ctrl: false, alt: false },
        next: { key: 'd', shift: false, ctrl: false, alt: false },
        restart: { key: 's', shift: false, ctrl: false, alt: false },
        toggle: { key: 'w', shift: false, ctrl: false, alt: false }
      }
    };

    // Pause on hover state tracking
    this.pausedByHover = false;
    this.resumeTimeout = null;

    // Pause at end state tracking
    this.lastSubtitleIndex = -1;  // Track last subtitle to detect changes
    this.pausedAtEnd = false;  // Track if we paused at subtitle end

    // Load settings from storage
    this._loadSettings();

    // Listen for storage changes to sync settings from main settings page
    // Store listener reference so we can remove it on destroy
    this._storageChangeListener = (changes, areaName) => {
      if (areaName === 'local' && (changes.videoPlayer || changes.ytSidebarSettings)) {
        this._loadSettings().then(() => {
          // Update UI elements to reflect new settings
          if (this.sidebar) {
            this._applySettingsToUI();
          }
        });
      }
    };
    chrome.storage.onChanged.addListener(this._storageChangeListener);

    if (this.isYouTubePage()) {
      this._init();
    }
  }

  /**
   * Check if current page is YouTube
   */
  isYouTubePage(): boolean {
    return window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  /**
   * Check if current page is a YouTube watch page
   */
  isWatchPage(): boolean {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
  }

  /**
   * Check if an advertisement is currently playing
   */
  _isAdPlaying(): boolean {
    // YouTube adds .ad-showing class to video container during ads
    const playerContainer = document.querySelector('.html5-video-player');
    if (playerContainer && playerContainer.classList.contains('ad-showing')) {
      return true;
    }

    // Additional check: YouTube's ad module
    const adModule = document.querySelector<HTMLElement>('.video-ads');
    if (adModule && adModule.offsetParent !== null) {
      return true;
    }

    return false;
  }

  /**
   * Initialize sidebar
   */
  async _init(): Promise<void> {
    await this._loadSidebar();
    this._setupEventListeners();
    this._setupNavigationListener();

    // Set up theater mode change observer
    this.theaterModeController!.observeTheaterModeChanges();

    // Only show sidebar and adjust layout if on watch page
    if (this.isWatchPage()) {
      // Show sidebar (this will force theater mode and activate layout)
      await this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Load sidebar HTML
   */
  async _loadSidebar(): Promise<void> {
    try {
      const response = await fetch(chrome.runtime.getURL('ui/youtube-sidebar/youtube-sidebar.html'));
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      this.sidebar = doc.querySelector<HTMLElement>('.helios-youtube-sidebar');

      // Inject CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('ui/youtube-sidebar/youtube-sidebar.css');
      document.head.appendChild(link);

      // Wait for ytd-watch-flexy and inject sidebar into it
      // This way the sidebar is positioned within the theater container
      const injectSidebar = () => {
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        if (watchFlexy) {
          watchFlexy.appendChild(this.sidebar!);

          // Initialize sidebar positioner now that sidebar element exists
          this.sidebarPositioner = new SidebarPositioner(this.sidebar!, this.layoutManager!);
        } else {
          setTimeout(injectSidebar, 100);
        }
      };
      injectSidebar();

      // Get elements
      this.listContainer = this.sidebar!.querySelector<HTMLElement>('#yt-subtitle-list');
      this.subtitleSection = this.sidebar!.querySelector<HTMLElement>('#yt-subtitle-section');
      this.settingsSection = this.sidebar!.querySelector<HTMLElement>('#yt-settings-section');
      this.settingsBtn = this.sidebar!.querySelector<HTMLElement>('#yt-settings-btn');
      this.closeBtn = this.sidebar!.querySelector<HTMLElement>('#yt-close-btn');
      this.selectCaptionBtn = this.sidebar!.querySelector<HTMLElement>('#yt-select-caption-btn');
      this.notificationElement = this.sidebar!.querySelector<HTMLElement>('#yt-notification');
      this.notificationMessage = this.sidebar!.querySelector<HTMLElement>('.yt-notification-message');

      // Get settings elements
      this.hotkeysToggle = this.sidebar!.querySelector<HTMLInputElement>('#yt-hotkeys-toggle');
      this.dualSubtitlesToggle = this.sidebar!.querySelector<HTMLInputElement>('#yt-dual-subtitles-toggle');
      this.secondaryLanguageSelect = this.sidebar!.querySelector<HTMLSelectElement>('#yt-secondary-language-select');
      this.secondaryLanguageContainer = this.sidebar!.querySelector<HTMLElement>('#yt-secondary-language-container');
      this.pauseOnHoverToggle = this.sidebar!.querySelector<HTMLInputElement>('#yt-pause-on-hover-toggle');
      this.pauseAtEndToggle = this.sidebar!.querySelector<HTMLInputElement>('#yt-pause-at-end-toggle');

      // Caption size controls
      this.increaseSizeBtn = this.sidebar!.querySelector<HTMLElement>('#yt-increase-size-btn');
      this.decreaseSizeBtn = this.sidebar!.querySelector<HTMLElement>('#yt-decrease-size-btn');
      this.sizeInput = this.sidebar!.querySelector<HTMLInputElement>('#yt-size-input');
      this.opacityInput = this.sidebar!.querySelector<HTMLInputElement>('#yt-opacity-input');

      // Navigation behavior settings elements
      this.autoPlayToggle = this.sidebar!.querySelector<HTMLInputElement>('#yt-auto-play-toggle');

      // Setup header button listeners
      this._setupHeaderButtons();

      // Setup settings listeners
      this._setupSettingsListeners();

      // Setup hotkey input listeners (commented out - hotkeys now configured in main settings)
      // this._setupHotkeyInputs();

      // Apply loaded settings to UI
      this._applySettingsToUI();

      // Don't set isVisible = true here, let _init() handle it based on page type
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to load:', error);
    }
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners(): void {
    // Listen for subtitles being loaded
    document.addEventListener('helios-subtitles-loaded', (e) => {
      const { track, entries } = (e as CustomEvent).detail;
      this.updateSubtitles(entries, track);
    });

    // Listen for time updates to highlight current subtitle
    document.addEventListener('helios-video-timeupdate', (e) => {
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
    });

    // Toggle sidebar visibility
    document.addEventListener('helios-toggle-subtitle-panel', () => {
      this.toggle();
    });

    // Listen for vocabulary updates to refresh underlining
    document.addEventListener('helios-vocab-updated', (e) => {
      const detail = e && (e as CustomEvent).detail;
      const rawWords = detail ? detail.words : null;
      const changedWords = Array.isArray(rawWords) || typeof rawWords === 'string'
        ? rawWords
        : null;

      // Update underlining without full re-render to avoid jarring refresh
      this._updateUnderlining(changedWords).catch(err => {
        console.error('[Helios YouTube Sidebar] Error updating underlining:', err);
      });
    });

    // Setup global mouse listener for pause-on-hover resume logic
    this._setupPauseOnHoverListener();

    // Listen for video notifications to display in sidebar
    document.addEventListener('helios-video-notification', (e) => {
      const { message, type } = (e as CustomEvent).detail;
      this._showNotification(message, type);
    });

    // Listen for subtitle load failures to remove loading overlay
    document.addEventListener('helios-subtitle-load-failed', () => {

    });

    // Setup hotkeys
    this._setupHotkeys().catch(err => {
      console.error('[Helios YouTube Sidebar] Error setting up hotkeys:', err);
    });

    // Block 't' key to prevent exiting theater mode when sidebar is visible
    this._blockTheaterModeToggle();

    // Setup scroll detection to prevent auto-scroll during user page scrolling
    this._setupScrollDetection();
  }

  /**
   * Block 't' key from toggling theater mode when sidebar is visible
   * This prevents users from accidentally exiting theater mode, which breaks the sidebar layout
   */
  _blockTheaterModeToggle(): void {
    document.addEventListener('keydown', (e) => {
      // Only block 't' key when:
      // 1. Sidebar is visible
      // 2. User is not typing in an input field
      // 3. Key is 't' without modifiers
      const target = e.target as HTMLElement;
      if (
        this.isVisible &&
        e.key.toLowerCase() === 't' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        target.tagName !== 'INPUT' &&
        target.tagName !== 'TEXTAREA' &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }, true); // Use capture phase to intercept before YouTube's handlers
  }

  /**
   * Setup navigation listener to show/hide sidebar based on page type
   */
  _setupNavigationListener(): void {
    let lastUrl = window.location.href;

    // Check URL changes periodically (YouTube is a SPA)
    // Store interval so we can clear it on destroy
    this.navigationInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        const wasWatchPage = lastUrl.includes('/watch');
        const isWatchPage = this.isWatchPage();
        lastUrl = window.location.href;

        // Clear subtitle data when leaving a watch page OR entering a new watch page
        if (wasWatchPage || isWatchPage) {
          this._clearSubtitleData();
        }

        // Show sidebar only on watch pages
        if (isWatchPage) {
          // Show sidebar (will force theater mode automatically)
          setTimeout(async () => {
            await this.show();
          }, 100);
        } else {
          this.hide();
        }
      }
    }, 500);
  }

  /**
   * Setup scroll detection to prevent auto-scroll when user is scrolling
   */
  _setupScrollDetection(): void {
    // Listen for window scroll events (main YouTube page scrolling)
    const handlePageScroll = () => {
      // Set flag to true when user scrolls the page
      this.userIsScrollingPage = true;

      // Clear existing timeout
      if (this.pageScrollTimeout) {
        clearTimeout(this.pageScrollTimeout);
      }

      // Reset flag after 1.5 seconds of no scrolling (more responsive)
      this.pageScrollTimeout = setTimeout(() => {
        this.userIsScrollingPage = false;
      }, 1500);
    };

    window.addEventListener('scroll', handlePageScroll, { passive: true });

    // Listen for sidebar container scroll events (user manually scrolling subtitles)
    const handleSidebarScroll = (e: Event) => {
      // Don't count auto-scroll as user scroll
      if (this.isAutoScrolling) {
        return;
      }

      // Note: Cannot preventDefault in passive scroll listener
      // The wheel event handler (non-passive) handles scroll prevention
      // This handler just tracks user scrolling for auto-scroll logic

      // Set flag to true when user manually scrolls the sidebar
      this.userIsScrollingSidebar = true;

      // Clear existing timeout
      if (this.sidebarScrollTimeout) {
        clearTimeout(this.sidebarScrollTimeout);
      }

      // Reset flag after 2 seconds of no scrolling
      this.sidebarScrollTimeout = setTimeout(() => {
        this.userIsScrollingSidebar = false;
      }, 2000);
    };

    // Track mouse position to determine if user is in scroll zone
    const handleMouseMove = (e: MouseEvent) => {
      if (!this.listContainer) return;

      const rect = this.listContainer.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const containerWidth = rect.width;

      // Right 35% is the scroll zone
      const scrollZoneStart = containerWidth * 0.65;
      this.mouseInScrollZone = relativeX >= scrollZoneStart;
    };

    const handleMouseLeave = () => {
      this.mouseInScrollZone = false;
    };

    // Prevent scroll when not in scroll zone
    const preventScrollOutsideZone = (e: Event) => {
      if (!this.mouseInScrollZone && !this.isAutoScrolling) {
        e.preventDefault();
        return false;
      }
    };

    // Add sidebar scroll listener when listContainer is available
    // This will be called after _loadSidebar completes
    if (this.listContainer) {
      this.listContainer.addEventListener('scroll', handleSidebarScroll, { passive: true });
      this.listContainer.addEventListener('mousemove', handleMouseMove, { passive: true });
      this.listContainer.addEventListener('mouseleave', handleMouseLeave, { passive: true });
      this.listContainer.addEventListener('wheel', preventScrollOutsideZone, { passive: false });
    } else {
      // Wait for listContainer to be ready
      const checkListContainer = setInterval(() => {
        if (this.listContainer) {
          clearInterval(checkListContainer);
          this.listContainer.addEventListener('scroll', handleSidebarScroll, { passive: true });
          this.listContainer.addEventListener('mousemove', handleMouseMove, { passive: true });
          this.listContainer.addEventListener('mouseleave', handleMouseLeave, { passive: true });
          this.listContainer.addEventListener('wheel', preventScrollOutsideZone, { passive: false });
        }
      }, 100);
    }
  }

  /**
   * Sync sidebar height and position to match video player
   * Makes the sidebar feel integrated into YouTube instead of an overlay
   */
  // OLD METHOD REMOVED: _syncSidebarToVideoHeight()
  // Now handled by SidebarPositioner.start()

  /**
   * Setup keyboard hotkeys (Migaku-style)
   */
  async _setupHotkeys(): Promise<void> {
    // Load shortcuts from unified system
    const navShortcuts = await ShortcutHelper.getVideoNavigationShortcuts();

    // Remove existing listener if any
    if (this._hotkeyListener) {
      document.removeEventListener('keydown', this._hotkeyListener);
    }

    // Create new listener with current shortcut config
    this._hotkeyListener = async (e: KeyboardEvent) => {
      // Only trigger if hotkeys are enabled and we're on YouTube watch page
      if (!this.settings.hotkeysEnabled || !window.location.pathname.includes('/watch')) {
        return;
      }

      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Reload shortcuts in case they were updated
      const currentNavShortcuts = await ShortcutHelper.getVideoNavigationShortcuts();

      // Previous subtitle
      if (ShortcutHelper.matchesSingleKeyShortcut(e, currentNavShortcuts.previous)) {
        e.preventDefault();
        this._jumpToPreviousSubtitle();
      }
      // Next subtitle
      else if (ShortcutHelper.matchesSingleKeyShortcut(e, currentNavShortcuts.next)) {
        e.preventDefault();
        this._jumpToNextSubtitle();
      }
      // Jump to current subtitle start
      else if (ShortcutHelper.matchesSingleKeyShortcut(e, currentNavShortcuts.restart)) {
        e.preventDefault();
        this._jumpToCurrentSubtitleStart();
      }
      // Toggle subtitle visibility (overlay)
      else if (ShortcutHelper.matchesSingleKeyShortcut(e, currentNavShortcuts.toggle)) {
        e.preventDefault();
        this._toggleSubtitleOverlay();
      }
    };

    document.addEventListener('keydown', this._hotkeyListener);
  }

  /**
   * Setup header button listeners
   */
  _setupHeaderButtons(): void {
    // Settings button - toggle between subtitle and settings view
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        this._toggleSettings();
      });
    }

    // Close button - smart behavior:
    // - If in settings view, go back to subtitle view
    // - If in subtitle view, close the sidebar
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        const isShowingSettings = this.settingsSection!.style.display !== 'none';

        if (isShowingSettings) {
          // Go back to subtitle view
          this._toggleSettings();
        } else {
          // Close the sidebar
          this.hide();
        }
      });
    }

    // Caption selector button - show modal to select caption track
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
      // Switch to subtitle view
      this.settingsSection!.style.display = 'none';
      this.subtitleSection!.style.display = 'flex';

      // Change close button back to X icon
      this.closeBtn!.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      this.closeBtn!.setAttribute('title', 'Close');
    } else {
      // Switch to settings view
      this.subtitleSection!.style.display = 'none';
      this.settingsSection!.style.display = 'flex';

      // Change close button to back arrow icon (pointing right)
      this.closeBtn!.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
      this.closeBtn!.setAttribute('title', 'Back to subtitles');

      // Update language dropdown with available tracks
      this._updateLanguageDropdown();
    }
  }

  /**
   * Update language dropdown with available tracks
   */
  async _updateLanguageDropdown(): Promise<void> {
    if (!this.secondaryLanguageSelect) return;

    try {
      // Request available tracks
      const tracksPromise = new Promise<any[]>((resolve) => {
        const handler = (event: Event) => {
          document.removeEventListener('helios-youtube-tracks-response', handler);
          resolve((event as CustomEvent).detail.tracks || []);
        };
        document.addEventListener('helios-youtube-tracks-response', handler);

        document.dispatchEvent(new CustomEvent('helios-youtube-request-tracks', {
          detail: { videoId: this._getCurrentVideoId() }
        }));

        setTimeout(() => {
          document.removeEventListener('helios-youtube-tracks-response', handler);
          resolve([]);
        }, 3000);
      });

      const tracks = await tracksPromise;

      if (!tracks || tracks.length === 0) {
        return;
      }

      // Create a map to store unique language entries
      // Key: full language code (e.g., "en", "zh-Hans", "zh-Hant")
      // Value: display name
      const languageMap = new Map<string, string>();

      tracks.forEach(track => {
        const langCode = track.language;
        const langName = track.languageName || track.language;

        if (langCode && !languageMap.has(langCode)) {
          // Keep Chinese variants separate
          if (langCode.startsWith('zh')) {
            languageMap.set(langCode, langName);
          } else {
            // For other languages, use base code but keep full name
            const baseCode = langCode.split('-')[0];
            if (!languageMap.has(baseCode)) {
              languageMap.set(baseCode, this._getLanguageDisplayName(langName, langCode));
            }
          }
        }
      });

      // Store current selection
      const currentSelection = this.settings.secondarySubtitleLanguage;

      // Clear existing options (no Auto-detect)
      this.secondaryLanguageSelect.innerHTML = '';

      // Add available languages sorted alphabetically
      const sortedLanguages = Array.from(languageMap.entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      );

      sortedLanguages.forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        this.secondaryLanguageSelect!.appendChild(option);
      });

      // Restore selection if it's still available
      if (currentSelection && languageMap.has(currentSelection)) {
        this.secondaryLanguageSelect.value = currentSelection;
      } else if (sortedLanguages.length > 0) {
        // Select first language by default
        this.secondaryLanguageSelect.value = sortedLanguages[0][0];
        this.settings.secondarySubtitleLanguage = sortedLanguages[0][0];
      }
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to update language dropdown:', error);
    }
  }

  /**
   * Get proper display name for language
   */
  _getLanguageDisplayName(youtubeName: string, langCode: string): string {
    // Language code to proper name mapping
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'pl': 'Polish',
      'sv': 'Swedish',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'ms': 'Malay',
      'cs': 'Czech',
      'da': 'Danish',
      'fi': 'Finnish',
      'el': 'Greek',
      'he': 'Hebrew',
      'hu': 'Hungarian',
      'no': 'Norwegian',
      'ro': 'Romanian',
      'sk': 'Slovak',
      'uk': 'Ukrainian'
    };

    // If YouTube provides a good name, use it (especially for Chinese variants)
    if (youtubeName && youtubeName.length > 2 && !youtubeName.includes('-')) {
      return youtubeName;
    }

    // Otherwise, use our mapping
    const baseCode = langCode.split('-')[0];
    return languageNames[baseCode] || youtubeName || langCode;
  }

  /**
   * Setup settings UI listeners
   */
  _setupSettingsListeners(): void {
    // Hotkeys toggle
    if (this.hotkeysToggle) {
      this.hotkeysToggle.addEventListener('change', (e) => {
        this.settings.hotkeysEnabled = (e.target as HTMLInputElement).checked;
        this._saveSettings();
      });
    }

    // Dual subtitles toggle
    if (this.dualSubtitlesToggle) {
      this.dualSubtitlesToggle.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.settings.dualSubtitlesEnabled = checked;
        this._saveSettings();

        // Show/hide secondary language selector
        if (this.secondaryLanguageContainer) {
          this.secondaryLanguageContainer.style.display = checked ? 'block' : 'none';
        }

        // Trigger subtitle reload if dual subtitles enabled, clear if disabled
        if (checked) {
          this._loadSecondarySubtitles();
        } else {
          // Clear secondary subtitles from overlay (no need to re-render sidebar)
          this.currentSecondarySubtitles = [];
          if (this.videoBinding && this.videoBinding.overlay) {
            this.videoBinding.overlay.clearSecondarySubtitles();
          }
          // No need to re-render sidebar - dual subtitles only affect overlay
        }
      });
    }

    // Secondary language select
    if (this.secondaryLanguageSelect) {
      this.secondaryLanguageSelect.addEventListener('change', (e) => {
        this.settings.secondarySubtitleLanguage = (e.target as HTMLSelectElement).value || null;
        this._saveSettings();

        // Reload secondary subtitles with new language
        if (this.settings.dualSubtitlesEnabled) {
          this._loadSecondarySubtitles();
        }
      });
    }

    // Pause on hover toggle
    if (this.pauseOnHoverToggle) {
      this.pauseOnHoverToggle.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.settings.pauseOnHover = checked;
        this._saveSettings();

        // Update overlay setting
        if (this.videoBinding && this.videoBinding.overlay) {
          this.videoBinding.overlay.setPauseOnHover(checked);
        }
      });
    }

    // Pause at end toggle
    if (this.pauseAtEndToggle) {
      this.pauseAtEndToggle.addEventListener('change', (e) => {
        this.settings.pauseAtEnd = (e.target as HTMLInputElement).checked;
        this._saveSettings();
      });
    }

    // Auto-play after navigation toggle
    if (this.autoPlayToggle) {
      this.autoPlayToggle.addEventListener('change', (e) => {
        this.settings.autoPlayAfterNav = (e.target as HTMLInputElement).checked;
        this._saveSettings();
      });
    }

    // Caption size buttons
    // Caption size controls
    if (this.increaseSizeBtn) {
      this.increaseSizeBtn.addEventListener('click', () => {
        this._adjustCaptionSize(5); // Increase by 5px
      });
    }

    if (this.decreaseSizeBtn) {
      this.decreaseSizeBtn.addEventListener('click', () => {
        this._adjustCaptionSize(-5); // Decrease by 5px
      });
    }

    // Caption size input field
    if (this.sizeInput) {
      // Update when user changes the value
      this.sizeInput.addEventListener('change', (e) => {
        const newSize = parseInt((e.target as HTMLInputElement).value, 10);
        if (!isNaN(newSize)) {
          this._setCaptionSize(newSize);
        }
      });

      // Update on input for real-time feedback
      this.sizeInput.addEventListener('input', (e) => {
        const newSize = parseInt((e.target as HTMLInputElement).value, 10);
        if (!isNaN(newSize) && newSize >= 20 && newSize <= 80) {
          this._setCaptionSize(newSize, false); // Don't show notification on input
        }
      });

      // Prevent scrolling when focused
      this.sizeInput.addEventListener('wheel', (e) => {
        e.preventDefault();
      });
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
   * Setup hotkey input listeners for customization
   */
  _setupHotkeyInputs(): void {
    // YouTube's native controls that should be blocked when no modifiers are used
    const youtubeControlKeys = [
      'k', // Play/Pause
      ' ', // Space - Play/Pause
      'j', // Rewind 10s
      'l', // Forward 10s
      'left', // Rewind 5s
      'right', // Forward 5s
      'up', // Volume up
      'down', // Volume down
      'm', // Mute
      'f', // Fullscreen
      't', // Theater mode
      'i', // Miniplayer
      'c', // Captions
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', // Seek to %
      'home', // Start
      'end', // End
      '<', '>', // Playback speed
      '/', // Search
      'escape' // Exit fullscreen
    ];

    const inputs: Array<{ element: HTMLInputElement | null; key: keyof YTSidebarSettings['hotkeys'] }> = [
      { element: this.hotkeyPrevInput, key: 'previous' },
      { element: this.hotkeyNextInput, key: 'next' },
      { element: this.hotkeyRestartInput, key: 'restart' },
      { element: this.hotkeyToggleInput, key: 'toggle' }
    ];

    inputs.forEach(({ element, key }) => {
      if (!element) return;

      // Make input focusable and show cursor on click
      element.addEventListener('click', (e) => {
        element.removeAttribute('readonly');
        element.select();
        element.placeholder = 'Press any key...';
      });

      // Capture keypress and update hotkey
      element.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignore modifier keys alone
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
          return;
        }

        // Normalize key names for special keys
        let keyName = e.key;
        if (keyName.startsWith('Arrow')) {
          keyName = keyName.substring(5); // "ArrowLeft" -> "Left"
        }

        const newHotkey: HotkeyConfig = {
          key: keyName.toLowerCase(),
          shift: e.shiftKey,
          ctrl: e.ctrlKey || e.metaKey, // Meta (Cmd) treated as Ctrl
          alt: e.altKey
        };

        // Check if this conflicts with YouTube controls (only if no modifiers used)
        const hasModifiers = newHotkey.shift || newHotkey.ctrl || newHotkey.alt;
        if (!hasModifiers && youtubeControlKeys.includes(newHotkey.key)) {
          const displayKey = this._formatHotkeyDisplay(newHotkey);
          this._showNotification(
            `'${displayKey}' is used by YouTube. Try adding Shift, Ctrl, or Alt (e.g., Shift+${displayKey})`,
            'error'
          );
          element.blur();
          element.setAttribute('readonly', 'true');
          return;
        }

        // Check if key combination is already used by another hotkey
        const existingUse = Object.entries(this.settings.hotkeys).find(
          ([k, v]) => k !== key &&
                      v.key === newHotkey.key &&
                      v.shift === newHotkey.shift &&
                      v.ctrl === newHotkey.ctrl &&
                      v.alt === newHotkey.alt
        );

        if (existingUse) {
          const comboStr = this._formatHotkeyDisplay(newHotkey);
          this._showNotification(`Key '${comboStr}' is already used for ${existingUse[0]}`, 'error');
          element.blur();
          element.setAttribute('readonly', 'true');
          return;
        }

        // Update settings
        this.settings.hotkeys[key] = newHotkey;
        const displayText = this._formatHotkeyDisplay(newHotkey);
        element.value = displayText;
        element.blur();
        element.setAttribute('readonly', 'true');

        this._saveSettings();
        this._showNotification(`Hotkey updated to '${displayText}'`, 'success');
      });

      // Handle blur - restore readonly and placeholder
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
   * Format hotkey object for display (e.g., "Ctrl+Shift+L")
   */
  _formatHotkeyDisplay(hotkey: HotkeyConfig): string {
    const parts: string[] = [];
    if (hotkey.ctrl) parts.push('Ctrl');
    if (hotkey.shift) parts.push('Shift');
    if (hotkey.alt) parts.push('Alt');

    // Capitalize first letter of key for display
    const keyDisplay = hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1);
    parts.push(keyDisplay);

    return parts.join('+');
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

    // Apply navigation behavior settings to UI
    if (this.autoPlayToggle) {
      this.autoPlayToggle.checked = this.settings.autoPlayAfterNav || false;
    }

    // Update caption size input field with current value
    if (this.sizeInput && this.videoBinding && this.videoBinding.overlay) {
      const currentSize = this.videoBinding.overlay.subtitleSize || 40;
      this.sizeInput.value = String(currentSize);
    }

    // Update background opacity input (0–100%)
    if (this.opacityInput && this.videoBinding && this.videoBinding.overlay) {
      const opacity = this.videoBinding.overlay.getSubtitleBackgroundOpacity();
      this.opacityInput.value = String(Math.round((opacity !== undefined ? opacity : 0.4) * 100));
    }

    // Hotkey inputs removed - configure in main settings Video Player tab
  }

  /**
   * OLD METHODS REMOVED - Now handled by modular components:
   * - _enableTheaterMode() -> TheaterModeController.enable()
   * - _adjustVideoLayout() -> YouTubeLayoutManager.activate()
   * - _setupLayoutObserver() -> YouTubeLayoutManager (internal)
   * - _syncSidebarToVideoHeight() -> SidebarPositioner.start()
   */

  /**
   * Update subtitles in sidebar
   */
  async updateSubtitles(entries: SubtitleEntry[], track: any): Promise<void> {
    // Race condition protection: if already updating, queue this update
    if (this.isUpdatingSubtitles) {
      this.pendingSubtitleUpdate = { entries, track };
      return;
    }

    this.isUpdatingSubtitles = true;

    try {
      // Deduplicate entries before storing to prevent duplicate subtitles in sidebar
      this.currentSubtitles = this._deduplicateEntries(entries || []);
      this.currentTrack = track;
      this.currentSecondarySubtitles = []; // Reset secondary subtitles

      // Remove loading overlay from video player


      // Render subtitle list (async)
      await this._renderSubtitleList().catch(err => {
        console.error('[Helios YouTube Sidebar] Error rendering subtitle list:', err);
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
      this.isUpdatingSubtitles = false;

      // Process any pending update
      if (this.pendingSubtitleUpdate) {
        const { entries: pendingEntries, track: pendingTrack } = this.pendingSubtitleUpdate;
        this.pendingSubtitleUpdate = null;
        await this.updateSubtitles(pendingEntries, pendingTrack);
      }
    }
  }

  /**
   * Deduplicate subtitle entries to prevent duplicate subtitles in sidebar
   * Removes entries with identical text and overlapping time ranges
   */
  _deduplicateEntries(entries: SubtitleEntry[]): SubtitleEntry[] {
    if (!entries || entries.length === 0) {
      return [];
    }

    // CRITICAL: Sort FIRST by start time before deduplication
    // This ensures we process entries in chronological order
    const sortedEntries = [...entries].sort((a, b) => a.start - b.start);

    const textGroups = new Map<string, SubtitleEntry[]>(); // Group entries by text

    // Group all entries by their text content
    for (const entry of sortedEntries) {
      const normalizedText = entry.text.trim();
      if (!textGroups.has(normalizedText)) {
        textGroups.set(normalizedText, []);
      }
      textGroups.get(normalizedText)!.push(entry);
    }

    const deduplicated: SubtitleEntry[] = [];

    // Process each text group
    for (const [text, groupEntries] of textGroups.entries()) {
      if (groupEntries.length === 1) {
        // Only one entry with this text - keep it
        deduplicated.push(groupEntries[0]);
      } else {
        // Multiple entries with same text - need to deduplicate by time overlap
        const kept: SubtitleEntry[] = [];

        for (const entry of groupEntries) {
          // Check if this entry overlaps with any already kept entry
          const overlapsWithKept = kept.some(keptEntry => {
            // Two entries overlap if one starts before the other ends
            return !(entry.end <= keptEntry.start || entry.start >= keptEntry.end);
          });

          if (!overlapsWithKept) {
            // No overlap with any kept entry - keep this one
            kept.push(entry);
          } else {
            // Overlaps with at least one kept entry
            // Replace the overlapping entry if this one has longer duration
            const overlappingIndex = kept.findIndex(keptEntry => {
              return !(entry.end <= keptEntry.start || entry.start >= keptEntry.end);
            });

            if (overlappingIndex !== -1) {
              const overlapping = kept[overlappingIndex];
              if (entry.getDuration() > overlapping.getDuration()) {
                kept[overlappingIndex] = entry;
              }
            }
          }
        }

        deduplicated.push(...kept);
      }
    }

    // Final sort by start time to ensure chronological order
    deduplicated.sort((a, b) => a.start - b.start);

    return deduplicated;
  }

  /**
   * Load secondary subtitles for dual subtitle display
   */
  async _loadSecondarySubtitles(): Promise<void> {
    if (!this.videoBinding) {
      console.warn('[Helios YouTube Sidebar] Cannot load secondary subtitles: no video binding');
      return;
    }

    try {
      // Dispatch event to request available tracks
      const tracksPromise = new Promise<any[]>((resolve) => {
        const handler = (event: Event) => {
          document.removeEventListener('helios-youtube-tracks-response', handler);
          resolve((event as CustomEvent).detail.tracks || []);
        };
        document.addEventListener('helios-youtube-tracks-response', handler);

        // Request tracks
        document.dispatchEvent(new CustomEvent('helios-youtube-request-tracks', {
          detail: { videoId: this._getCurrentVideoId() }
        }));

        // Timeout after 3 seconds
        setTimeout(() => {
          document.removeEventListener('helios-youtube-tracks-response', handler);
          resolve([]);
        }, 3000);
      });

      const tracks = await tracksPromise;

      if (!tracks || tracks.length === 0) {
        console.warn('[Helios YouTube Sidebar] No subtitle tracks available');
        return;
      }

      // Find secondary subtitle track
      let secondaryTrack: any = null;
      const currentTrackUrl = this.currentTrack?.url;

      if (this.settings.secondarySubtitleLanguage) {
        // User explicitly selected a language - find that language
        // Prefer a different track than the current one if possible
        const selectedLang = this.settings.secondarySubtitleLanguage;
        const matchingTracks = tracks.filter(t => {
          // Match exact language code or language prefix (e.g., "en" matches "en-US")
          return t.language === selectedLang ||
                 t.language?.startsWith(selectedLang + '-') ||
                 t.language?.split('-')[0] === selectedLang;
        });

        // Try to find a different track than current
        secondaryTrack = matchingTracks.find(t => t.url !== currentTrackUrl) || matchingTracks[0];

        if (matchingTracks.length === 0) {
          console.warn('[Helios YouTube Sidebar] No tracks found for language:', selectedLang);
        }
      } else {
        // Auto-detect: prefer English if available, otherwise first track different from current
        const currentLang = this.currentTrack?.language;

        // Try English first (but different track)
        const englishTracks = tracks.filter(t => t.language === 'en' || t.language?.startsWith('en-'));
        secondaryTrack = englishTracks.find(t => t.url !== currentTrackUrl) || englishTracks[0];

        // If no English or it's the same track, try any other language
        if (!secondaryTrack || secondaryTrack.url === currentTrackUrl) {
          secondaryTrack = tracks.find(t => t.url !== currentTrackUrl) || tracks[0];
        }
      }

      if (!secondaryTrack || !secondaryTrack.url) {
        console.warn('[Helios YouTube Sidebar] No suitable secondary track found');
        return;
      }

      // Don't load if it's the exact same track
      if (secondaryTrack.url === currentTrackUrl) {
        console.warn('[Helios YouTube Sidebar] Secondary track is same as primary, skipping');
        return;
      }

      // Use the YouTube loader's loadTrack method
      const youtubeLoader = window.heliosVideoFeature?.youtubeLoader;
      if (!youtubeLoader) {
        console.warn('[Helios YouTube Sidebar] YouTube loader not available');
        return;
      }

      const secondaryEntries = await youtubeLoader.loadTrack(secondaryTrack.url);

      if (secondaryEntries.length === 0) {
        console.warn('[Helios YouTube Sidebar] No secondary subtitle entries parsed');
        return;
      }

      // Store secondary subtitles for sidebar display
      this.currentSecondarySubtitles = secondaryEntries;

      // Pass to video binding overlay
      if (this.videoBinding.overlay) {
        this.videoBinding.overlay.setSecondarySubtitles(secondaryEntries);
      }

      // No need to re-render sidebar - dual subtitles only affect overlay display
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to load secondary subtitles:', error);
    }
  }

  /**
   * Get current video ID from URL
   */
  _getCurrentVideoId(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Save user's subtitle track preference
   * Stores both per-video and global language variant preferences
   */
  async _saveTrackPreference(track: any): Promise<void> {
    try {
      const result = await storage.get(['subtitlePreferences']);
      const prefs: Record<string, any> = result.subtitlePreferences || { global: {}, perVideo: {} };

      // Save global preference (language variant - e.g., zh-Hans over zh-Hant)
      const baseLanguage = track.language.split('-')[0]; // e.g., 'zh' from 'zh-Hans'
      prefs.global[baseLanguage] = track.language;

      // Save per-video preference
      const videoId = this._getCurrentVideoId();
      if (videoId) {
        prefs.perVideo[videoId] = {
          language: track.language,
          languageName: track.languageName,
          isAutoGenerated: track.isAutoGenerated || false,
          url: track.url
        };
      }

      await storage.set({ subtitlePreferences: prefs });
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to save track preference:', error);
    }
  }

  /**
   * Show notification in sidebar
   */
  _showNotification(message: string, type: string = 'info'): void {
    if (!this.notificationElement || !this.notificationMessage) return;

    // Clear any existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    // Set message and type
    this.notificationMessage.textContent = message;
    this.notificationElement.className = `yt-notification yt-notification-${type}`;
    this.notificationElement.style.display = 'block';

    // Auto-hide after 3 seconds
    this.notificationTimeout = setTimeout(() => {
      this.notificationElement!.style.display = 'none';
    }, 3000);
  }

  /**
   * Extract potential words from text for preloading
   * @param text - Text to extract words from
   * @returns Array of potential words
   */
  _extractPotentialWords(text: string): string[] {
    const words: string[] = [];
    const currentLang = window.languageRegistry?.getCurrentLanguage();
    const adapter = window.languageRegistry?.getAdapter();

    if (currentLang && ['zh', 'ja', 'ko'].includes(currentLang)) {
      // For CJK languages, extract unique characters and sequences up to maxWordLength
      // This ensures longer words (like idioms and chengyus) are preloaded
      const seen = new Set<string>();
      const maxWordLength = adapter?.getConfig()?.maxWordLength || 10;

      // Extract single characters (keep everything from subtitles except whitespace)
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char.trim() && !seen.has(char)) {
          words.push(char);
          seen.add(char);
        }
      }

      // Extract sequences from 2 to maxWordLength characters
      // This ensures longer words (4+ characters like idioms/chengyus) are preloaded
      for (let len = 2; len <= maxWordLength; len++) {
        for (let i = 0; i <= text.length - len; i++) {
          const candidate = text.substring(i, i + len);
          // Keep sequences as they appear in subtitles (skip only whitespace and duplicates)
          if (candidate.trim() && !seen.has(candidate)) {
            words.push(candidate);
            seen.add(candidate);
          }
        }
      }
    } else {
      // For space-separated languages, extract words including apostrophes
      // Pattern allows apostrophes and hyphens within words (e.g., "don't", "M'appelle")
      const matches = text.match(/[\p{L}\p{M}]+(?:[''-][\p{L}\p{M}]+)*/gu);
      if (matches) {
        words.push(...matches.map(w => w.toLowerCase()));
      }
    }

    // Return unique words
    return [...new Set(words)];
  }

  /**
   * Render subtitle list
   */
  async _renderSubtitleList(): Promise<void> {
    if (!this.listContainer) return;

    // Clear existing
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

    // Preload words from all subtitles before rendering
    if (window.dictionaryManager && (window.dictionaryManager as any).preloadWords) {
      const allWordsToPreload: string[] = [];
      this.currentSubtitles.forEach(entry => {
        const words = this._extractPotentialWords(entry.text);
        allWordsToPreload.push(...words);
      });

      // Preload unique words
      const uniqueWords = [...new Set(allWordsToPreload)];
      if (uniqueWords.length > 0) {
        await (window.dictionaryManager as any).preloadWords(uniqueWords);
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

      // Text container (for dual subtitles)
      const textContainer = document.createElement('div');
      textContainer.className = 'yt-subtitle-text-container';

      // Primary subtitle text with word-level underlining for unknown words
      const primaryText = document.createElement('div');
      primaryText.className = 'yt-subtitle-text yt-subtitle-text-primary';

      // Extract words using language adapter (handles Chinese, English, etc.)
      const adapter = window.languageRegistry?.getAdapter();

      if (adapter && adapter.extractWords && window.dictionaryManager) {
        // Preload potential words from this subtitle text before extraction
        const wordsToPreload = this._extractPotentialWords(entry.text);
        if (wordsToPreload.length > 0 && (window.dictionaryManager as any).preloadWords) {
          await (window.dictionaryManager as any).preloadWords(wordsToPreload);
        }

        const dictionary: any = window.dictionaryManager?.dictionary || {};
        // Use language-aware word extraction
        const extractedWords: any[] = await adapter.extractWords(entry.text, dictionary);

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
            // Only underline if: word is in dictionary, not known, and not ignored
            const cleanWord = word.toLowerCase();

            if (window.vocabManager &&
                dictionary[cleanWord] &&
                !window.vocabManager.isWordKnown(cleanWord) &&
                !window.vocabManager.isWordIgnored(cleanWord) &&
                !window.vocabManager.isWordLearning(cleanWord)) {
              wordSpan.classList.add('unknown-word');
            } else if (window.vocabManager.isWordLearning(cleanWord)) {
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

      // Secondary subtitle text (if available)
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

      // Click to seek
      item.addEventListener('click', () => {
        this._seekToSubtitle(entry);
      });

      this.listContainer.appendChild(item);
    }
  }

  /**
   * Check if popup is currently visible
   * Used to prevent video resume when user is reading popup
   */
  _isPopupVisible(): boolean {
    // Check if popup manager exists and has an active popup
    if (window.popupManager && (window.popupManager as any).popup) {
      const popup = (window.popupManager as any).popup;
      // Check if popup exists in DOM and is visible
      return popup && popup.parentElement && popup.style.display !== 'none';
    }
    return false;
  }

  /**
   * Setup global mousemove listener for pause-on-hover resume logic
   * Resumes video when mouse leaves both sidebar word and popup
   */
  _setupPauseOnHoverListener(): void {
    this._globalMouseMoveListener = (e) => {
      if (!this.settings.pauseOnHover || !this.pausedByHover) return;

      // Check if mouse is over popup or sidebar word
      const target = e.target as HTMLElement | null;
      const isOverPopup = target && target.closest('.chinese-lang-extension-popup');
      const isOverSidebarWord = target && target.closest('.yt-subtitle-word');

      // If not over either, resume video after a short delay
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
        // Cancel resume if mouse moves back over popup or word
        if (this.resumeTimeout) {
          clearTimeout(this.resumeTimeout);
          this.resumeTimeout = null;
        }
      }
    };

    document.addEventListener('mousemove', this._globalMouseMoveListener);
  }

  /**
   * Update underlining on existing word spans without re-rendering
   * This preserves scroll position and avoids jarring refresh
   * @param changedWords - Optional word or list of words whose state changed
   */
  async _updateUnderlining(changedWords: string | string[] | null = null): Promise<void> {
    if (!this.listContainer || !window.vocabManager || !window.dictionaryManager) return;

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

      const dictionary: any = window.dictionaryManager.dictionary || {};
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
                                 !window.vocabManager.isWordKnown(cleanWord) &&
                                 !window.vocabManager.isWordIgnored(cleanWord) &&
                                 !window.vocabManager.isWordLearning(cleanWord);

          // Remove all word state classes first
          wordSpan.classList.remove('unknown-word', 'learning-word');

          if (shouldUnderline) {
            wordSpan.classList.add('unknown-word');
          } else if (window.vocabManager.isWordLearning(cleanWord)) {
            wordSpan.classList.add('learning-word');
          }
          updatedCount++;
        });
        console.log('[Helios YouTube Sidebar] Fast-path underlining update for word', cleanWord, '- spans updated:', updatedCount);
      });

      const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
      console.log('[Helios YouTube Sidebar] _updateUnderlining fast-path for', normalizedWords.length, 'word(s) took', (t1 - t0).toFixed(1), 'ms');
      return;
    }

    // Fallback: full update of all subtitle word spans (used for bulk operations)
    console.warn('[Helios YouTube Sidebar] Falling back to full O(N) underlining update for all subtitle words');
    const wordSpans = this.listContainer.querySelectorAll('.yt-subtitle-word');
    const wordsToCheck = Array.from(wordSpans).map(span => {
      const word = span.textContent || span.getAttribute('data-helios-word');
      return word ? word.toLowerCase() : null;
    }).filter((w): w is string => w !== null);

    // Preload words to ensure they're in cache
    if (wordsToCheck.length > 0 && (window.dictionaryManager as any).preloadWords) {
      await (window.dictionaryManager as any).preloadWords(wordsToCheck);
    }

    const dictionary: any = window.dictionaryManager.dictionary || {};

    let updatedCount = 0;
    wordSpans.forEach(wordSpan => {
      const word = wordSpan.textContent || wordSpan.getAttribute('data-helios-word');
      if (!word) return;

      const cleanWord = word.toLowerCase();
      const shouldUnderline = dictionary[cleanWord] &&
                             !window.vocabManager.isWordKnown(cleanWord) &&
                             !window.vocabManager.isWordIgnored(cleanWord) &&
                             !window.vocabManager.isWordLearning(cleanWord);

      // Remove all word state classes first
      wordSpan.classList.remove('unknown-word', 'learning-word');

      if (shouldUnderline) {
        wordSpan.classList.add('unknown-word');
      } else if (window.vocabManager.isWordLearning(cleanWord)) {
        wordSpan.classList.add('learning-word');
      }
      updatedCount++;
    });

    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios YouTube Sidebar] Full O(N) underlining update touched', wordSpans.length, 'spans, updated', updatedCount, 'spans in', (t1 - t0).toFixed(1), 'ms');
  }

  /**
   * Find matching secondary subtitle based on time overlap
   */
  _findMatchingSubtitle(primaryEntry: SubtitleEntry, secondarySubtitles: SubtitleEntry[]): SubtitleEntry | null {
    let bestMatch: SubtitleEntry | null = null;
    let maxOverlap = 0;

    for (const secondary of secondarySubtitles) {
      // Calculate overlap duration
      const overlapStart = Math.max(primaryEntry.start, secondary.start);
      const overlapEnd = Math.min(primaryEntry.end, secondary.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = secondary;
      }
    }

    // Only return match if there's significant overlap (at least 50ms)
    return maxOverlap >= 50 ? bestMatch : null;
  }

  /**
   * Update active subtitle highlight
   */
  _updateActiveSubtitle(currentTime: number): void {
    if (!this.listContainer || this.currentSubtitles.length === 0) return;

    // Don't update during ads
    if (this._isAdPlaying()) {
      return;
    }

    // Find active subtitle
    const activeEntry = this.currentSubtitles.find(entry =>
      currentTime >= entry.start && currentTime <= entry.end
    );

    if (!activeEntry) {
      // Clear active state
      if (this.activeIndex !== -1) {
        const prevActive = this.listContainer.querySelector('.yt-subtitle-item.active');
        if (prevActive) {
          prevActive.classList.remove('active');
        }
        this.activeIndex = -1;
      }

      // Reset pause at end state when between subtitles
      this.pausedAtEnd = false;

      return;
    }

    const newIndex = this.currentSubtitles.indexOf(activeEntry);
    if (newIndex === this.activeIndex) {
      // Same subtitle - check if we should pause at the end
      if (this.settings.pauseAtEnd && this.videoBinding && !this.pausedAtEnd) {
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

    // Moving to a new subtitle
    // If pause-at-end is enabled and we didn't pause yet (subtitle was too short), pause now
    if (this.settings.pauseAtEnd && !this.pausedAtEnd && this.activeIndex !== -1 && this.videoBinding) {
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
        if (!this.userIsScrollingPage && !this.userIsScrollingSidebar) {
          // Manually center the subtitle for consistent behavior
          this._scrollSubtitleToCenter(item);
        }
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Scroll a subtitle item to the center of the list container
   * This ensures consistent centering behavior on every subtitle change
   */
  _scrollSubtitleToCenter(item: HTMLElement): void {
    if (!this.listContainer || !item) return;

    // Set auto-scrolling flag to prevent detecting this as user scroll
    this.isAutoScrolling = true;

    // Use requestAnimationFrame for smoother, more responsive scrolling
    requestAnimationFrame(() => {
      const containerRect = this.listContainer!.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      // Calculate the scroll position needed to center the item
      const containerCenter = containerRect.height / 2;
      const itemCenter = itemRect.height / 2;
      const scrollOffset = (itemRect.top - containerRect.top) - containerCenter + itemCenter;

      // Smooth scroll to the calculated position
      this.listContainer!.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });

      // Reset auto-scrolling flag after animation completes
      // Smooth scroll typically takes ~300-500ms
      setTimeout(() => {
        this.isAutoScrolling = false;
      }, 600);
    });
  }

  /**
   * Seek to subtitle
   */
  _seekToSubtitle(entry: SubtitleEntry): void {
    if (this.videoBinding) {
      this.videoBinding.seekTo(entry.start);
    }
  }

  /**
   * Format time in MM:SS format
   */
  _formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Expand to full Helios sidebar
   */
  _expandHelios(): void {
    // Dispatch event to open main sidebar
    document.dispatchEvent(new CustomEvent('helios-open-sidebar'));
  }

  /**
   * Show caption selector modal
   */
  async _showCaptionSelector(): Promise<void> {
    // Get available tracks from YouTube loader
    const youtubeLoader = window.heliosVideoFeature?.youtubeLoader;
    if (!youtubeLoader) {
      console.warn('[Helios YouTube Sidebar] YouTube loader not available');
      this._showNotification('YouTube loader not available', 'error');
      return;
    }

    // Show loading notification
    this._showNotification('Loading available captions...', 'info');

    try {
      let tracks = await youtubeLoader.getAvailableTracks();

      // If there are no existing YouTube caption tracks, still open the selector
      // so the user can use the "Import File" option to add their own subtitles.
      if (!tracks || tracks.length === 0) {
        console.log('[Helios YouTube Sidebar] No built-in caption tracks available, showing import-only selector');
        this._showNotification('No built-in captions found. You can import your own file.', 'info');
        tracks = [];
      }

      // Create or get subtitle selector modal
      if (!window.subtitleSelectorModal) {
        window.subtitleSelectorModal = new SubtitleSelectorModal();
      }

      // Show modal with tracks, callback, and current track
      window.subtitleSelectorModal.show(tracks, async (selectedTrack: any) => {
        this._showNotification(`Loading ${selectedTrack.languageName} captions...`, 'info');

        try {
          // Save the user's subtitle preference
          await this._saveTrackPreference(selectedTrack);

          // Load the selected track
          const entries = await youtubeLoader.loadTrack(selectedTrack.url);

          if (entries.length === 0) {
            this._showNotification('No captions found in selected track', 'error');
            return;
          }

          // Load into video binding with track info
          const binding = window.heliosVideoFeature?.videoDetector?.getPrimaryBinding();
          if (binding) {
            binding.loadSubtitles(entries, selectedTrack);
            this._showNotification(`Loaded ${entries.length} captions (${selectedTrack.languageName})`, 'success');
          } else {
            this._showNotification('Video binding not found', 'error');
          }
        } catch (error) {
          console.error('[Helios YouTube Sidebar] Error loading track:', error);
          this._showNotification('Failed to load captions', 'error');
        }
      }, this.currentTrack);
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Error getting tracks:', error);
      this._showNotification('Failed to get available captions', 'error');
    }
  }

  /**
   * Show sidebar
   * Uses the new modular architecture to cleanly handle layout and positioning
   * IMPORTANT: Forces theater mode before showing sidebar and keeps it enforced
   */
  async show(): Promise<void> {
    if (!this.sidebar) return;

    // CRITICAL: Force theater mode FIRST with enforcement enabled
    // The enforcement will continuously ensure theater mode stays enabled
    // Pass true to enable continuous enforcement
    const theaterEnabled = await this.theaterModeController!.enable(true);
    if (!theaterEnabled) {
      console.warn('[Helios YouTube Sidebar] Failed to enable theater mode, sidebar may not display correctly');
      // Even if initial enable failed, enforcement may recover it
    } else {
      console.log('[Helios YouTube Sidebar] Theater mode enabled with enforcement active');
    }

    // Remove hidden class from sidebar
    this.sidebar.classList.remove('hidden');
    this.isVisible = true;

    // Activate layout manager (pushes video left to make room for sidebar)
    this.layoutManager!.activate();

    // Start sidebar positioner (syncs height and position with video player)
    if (this.sidebarPositioner) {
      this.sidebarPositioner.start();
    }
  }

  /**
   * Hide sidebar
   * Properly cleans up all layout modifications and returns to normal theater mode
   */
  hide(): void {
    if (!this.sidebar) return;

    // Remove loading overlay


    // Add hidden class to sidebar
    this.sidebar.classList.add('hidden');
    this.isVisible = false;

    // Deactivate layout manager (restores normal theater mode)
    this.layoutManager!.deactivate();

    // Stop sidebar positioner
    if (this.sidebarPositioner) {
      this.sidebarPositioner.stop();
    }
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
   * Hotkey: Jump to previous subtitle
   */
  _jumpToPreviousSubtitle(): void {
    if (!this.videoBinding) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const wasPlaying = !this.videoBinding.videoElement.paused;
    const subtitleCollection = this.videoBinding.getSubtitles();
    const targetSubtitle = subtitleCollection.getPreviousSubtitle(currentTime);

    if (targetSubtitle) {
      this.videoBinding.seekTo(targetSubtitle.start);

      // Smart playback handling
      if (wasPlaying || this.settings.autoPlayAfterNav) {
        setTimeout(() => {
          this.videoBinding!.videoElement.play();
        }, 100);
      }
    }
  }

  /**
   * Hotkey: Jump to next subtitle
   */
  _jumpToNextSubtitle(): void {
    if (!this.videoBinding) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const wasPlaying = !this.videoBinding.videoElement.paused;
    const subtitleCollection = this.videoBinding.getSubtitles();
    const nextSubtitle = subtitleCollection.getNextSubtitle(currentTime);

    if (nextSubtitle) {
      this.videoBinding.seekTo(nextSubtitle.start);

      // Smart playback handling
      if (wasPlaying || this.settings.autoPlayAfterNav) {
        setTimeout(() => {
          this.videoBinding!.videoElement.play();
        }, 100);
      }
    } else {
      console.warn('[Helios Hotkeys] No next subtitle found. Current time:', currentTime / 1000);
    }
  }

  /**
   * Hotkey: Jump to current subtitle start (S key)
   * Always restarts current subtitle, or goes to previous if in a gap
   */
  _jumpToCurrentSubtitleStart(): void {
    if (!this.videoBinding || this.currentSubtitles.length === 0) return;

    const currentTime = this.videoBinding.videoElement.currentTime * 1000;
    const wasPlaying = !this.videoBinding.videoElement.paused;

    // Try to find the currently active subtitle
    let targetSubtitle = this.currentSubtitles.find(entry =>
      currentTime >= entry.start && currentTime <= entry.end
    );

    // If no active subtitle (in a gap), go to the previous subtitle
    if (!targetSubtitle) {
      const previousSubs = this.currentSubtitles.filter(entry => entry.end < currentTime);
      if (previousSubs.length > 0) {
        targetSubtitle = previousSubs[previousSubs.length - 1];
      }
    }

    if (targetSubtitle) {
      this.videoBinding.seekTo(targetSubtitle.start);

      // Smart playback handling
      if (wasPlaying || this.settings.autoPlayAfterNav) {
        setTimeout(() => {
          this.videoBinding!.videoElement.play();
        }, 100);
      }
    }
  }

  /**
   * Hotkey: Toggle subtitle overlay visibility
   */
  _toggleSubtitleOverlay(): void {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    // Use the overlay's toggleVisibility method for persistent state
    const isVisible = this.videoBinding.overlay.toggleVisibility();
  }

  /**
   * Load settings from chrome storage
   */
  async _loadSettings(): Promise<void> {
    try {
      // Load from new unified videoPlayer settings (preferred)
      const result = await storage.get(['videoPlayer', 'ytSidebarSettings']);

      if (result.videoPlayer) {
        // Use new unified settings
        this.settings = { ...this.settings, ...result.videoPlayer } as YTSidebarSettings;
      } else if (result.ytSidebarSettings) {
        // Fallback to old settings (for backward compatibility)
        this.settings = { ...this.settings, ...result.ytSidebarSettings };
      }
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to chrome storage
   */
  async _saveSettings(): Promise<void> {
    try {
      // Save to both new and old locations for backward compatibility
      await storage.setRaw({
        videoPlayer: this.settings,
        ytSidebarSettings: this.settings
      });
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to save settings:', error);
    }
  }

  /**
   * Adjust caption size by the given amount
   * @param delta - Amount to change size by (positive to increase, negative to decrease)
   */
  _adjustCaptionSize(delta: number): void {
    if (!this.videoBinding || !this.videoBinding.overlay) {
      this._showNotification('No video overlay available', 'error');
      return;
    }

    const overlay = this.videoBinding.overlay;
    const currentSize = overlay.subtitleSize || 40;
    const newSize = Math.max(20, Math.min(80, currentSize + delta));

    this._setCaptionSize(newSize);
  }

  /**
   * Set caption size to a specific value
   * @param size - New size in pixels
   * @param showNotification - Whether to show notification (default: true)
   */
  _setCaptionSize(size: number, showNotification: boolean = true): void {
    if (!this.videoBinding || !this.videoBinding.overlay) {
      if (showNotification) {
        this._showNotification('No video overlay available', 'error');
      }
      return;
    }

    const overlay = this.videoBinding.overlay;
    const clampedSize = Math.max(20, Math.min(80, size));

    // Update overlay subtitle size
    overlay.subtitleSize = clampedSize;

    // Update input field value
    if (this.sizeInput) {
      this.sizeInput.value = String(clampedSize);
    }

    // Save the new size to storage
    overlay._saveSize();

    // Re-render subtitles with new size
    if (overlay.currentSubtitles && overlay.currentSubtitles.length > 0) {
      overlay._render().catch(err => {
        console.error('[Helios Subtitle Overlay] Error rendering subtitles:', err);
      });
    }

    // Show feedback notification
    if (showNotification) {
      this._showNotification(`Caption size: ${clampedSize}px`, 'success');
    }
  }

  /**
   * Clear all subtitle data when navigating to a new video
   * This ensures old subtitles don't persist when loading a new video
   */
  _clearSubtitleData(): void {
    // Clear the subtitle list container
    if (this.listContainer) {
      this.listContainer.innerHTML = '';
    }

    // Reset subtitle-related state
    this.currentSubtitles = [];
    this.currentVideoId = null;
    // NOTE: Don't clear videoBinding - it's managed by the video detection system
    // and is needed for auto-loading subtitles

    // Show loading state
    this._showLoadingState();
  }

  /**
   * Show loading state in sidebar (positioned over video center)
   */
  _showLoadingState(): void {
    // Show loading in sidebar - position it in the lower portion of the video (60% down)
    if (this.listContainer) {
      const videoPlayer = document.querySelector('.html5-video-player');
      const sidebarRect = this.sidebar?.getBoundingClientRect();

      let topPosition = '60%';

      // If we can get the video player position, calculate position at 60% down from video top
      if (videoPlayer && sidebarRect) {
        const videoRect = videoPlayer.getBoundingClientRect();
        const sidebarTop = sidebarRect.top;
        const videoPositionAt60Percent = videoRect.top + (videoRect.height * 0.6);
        const relativePosition = videoPositionAt60Percent - sidebarTop;
        topPosition = `${relativePosition}px`;
      }

      const sidebarLoadingHTML = `
        <div class="subtitle-loading-state" style="position: absolute; top: ${topPosition}; left: 50%; transform: translate(-50%, -50%); width: auto;">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading subtitles...</div>
        </div>
      `;
      this.listContainer.innerHTML = sidebarLoadingHTML;
    }
  }


  /**
   * Destroy sidebar
   */
  destroy(): void {
    // Clear navigation interval
    if (this.navigationInterval) {
      clearInterval(this.navigationInterval);
      this.navigationInterval = null;
    }

    // Clear notification timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }

    // Remove hotkey listener
    if (this._hotkeyListener) {
      document.removeEventListener('keydown', this._hotkeyListener);
      this._hotkeyListener = null;
    }

    // Remove storage change listener
    if (this._storageChangeListener) {
      chrome.storage.onChanged.removeListener(this._storageChangeListener);
      this._storageChangeListener = null;
    }

    // Remove pause-on-hover listener
    if (this._globalMouseMoveListener) {
      document.removeEventListener('mousemove', this._globalMouseMoveListener);
      this._globalMouseMoveListener = null;
    }

    // Remove loading overlay


    // Cleanup theater mode controller
    if (this.theaterModeController) {
      this.theaterModeController.cleanup();
      this.theaterModeController = null;
    }

    // Cleanup layout manager
    if (this.layoutManager) {
      this.layoutManager.cleanup();
      this.layoutManager = null;
    }

    // Disconnect layout observer
    if (this.layoutObserver) {
      this.layoutObserver.disconnect();
      this.layoutObserver = null;
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove resize handler
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Clear scroll detection timeouts
    if (this.pageScrollTimeout) {
      clearTimeout(this.pageScrollTimeout);
      this.pageScrollTimeout = null;
    }

    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
      this.sidebarScrollTimeout = null;
    }

    // Clear resume timeout from pause-on-hover
    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    if (this.sidebar && this.sidebar.parentElement) {
      this.sidebar.parentElement.removeChild(this.sidebar);
    }
    this.sidebar = null;

    // Remove video layout adjustment
    const pageManager = document.querySelector<HTMLElement>('#page-manager');
    if (pageManager) {
      pageManager.classList.remove('helios-sidebar-active');
      pageManager.classList.remove('helios-sidebar-hidden');
      pageManager.style.marginRight = '0';
      pageManager.style.position = '';
    }
  }
}
