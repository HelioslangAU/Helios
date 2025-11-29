/**
 * Helios YouTube Sidebar Controller
 * Manages the YouTube-specific sidebar with subtitle list
 */
class YouTubeSidebar {
  constructor() {
    this.sidebar = null;
    this.listContainer = null;
    this.currentSubtitles = [];
    this.currentTrack = null;
    this.videoBinding = null;
    this.isVisible = false;
    this.activeIndex = -1;
    this.layoutObserver = null; // Observer to maintain layout during YouTube navigation
    this.currentSecondarySubtitles = []; // Store secondary subtitles for sidebar display
    this.resizeObserver = null; // Observer to sync sidebar height with video player
    this.resizeHandler = null; // Window resize handler for cleanup

    // Scroll detection for preventing auto-scroll during user interaction
    this.userIsScrollingPage = false; // Flag to track if user is scrolling the main page
    this.userIsScrollingSidebar = false; // Flag to track if user is manually scrolling the sidebar
    this.pageScrollTimeout = null; // Timeout reference to reset page scroll flag
    this.sidebarScrollTimeout = null; // Timeout reference to reset sidebar scroll flag
    this.isAutoScrolling = false; // Flag to prevent detecting auto-scroll as user scroll
    this.mouseInScrollZone = false; // Flag to track if mouse is in the right 35% scroll zone

    // Settings
    this.settings = {
      hotkeysEnabled: true,
      dualSubtitlesEnabled: false,
      secondarySubtitleLanguage: null,
      pauseOnHover: true,
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

    // Current track tracking
    this.currentTrack = null;

    // Load settings from storage
    this._loadSettings();

    if (this.isYouTubePage()) {
      this._init();
    }
  }

  /**
   * Check if current page is YouTube
   */
  isYouTubePage() {
    return window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  /**
   * Check if current page is a YouTube watch page
   */
  isWatchPage() {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
  }

  /**
   * Initialize sidebar
   */
  async _init() {
    await this._loadSidebar();
    this._setupEventListeners();
    this._setupNavigationListener();

    // Only show sidebar and adjust layout if on watch page
    if (this.isWatchPage()) {
      this._enableTheaterMode();
      this._adjustVideoLayout();
      this.show();
      // Sync sidebar height with video player
      setTimeout(() => this._syncSidebarToVideoHeight(), 500);
    } else {
      this.hide();
    }
  }

  /**
   * Load sidebar HTML
   */
  async _loadSidebar() {
    try {
      const response = await fetch(chrome.runtime.getURL('src/ui/youtube-sidebar/youtube-sidebar.html'));
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      this.sidebar = doc.querySelector('.helios-youtube-sidebar');

      // Inject CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/ui/youtube-sidebar/youtube-sidebar.css');
      document.head.appendChild(link);

      // Wait for page-manager and inject sidebar into it
      const injectSidebar = () => {
        const pageManager = document.querySelector('#page-manager');
        if (pageManager) {
          pageManager.appendChild(this.sidebar);
        } else {
          setTimeout(injectSidebar, 100);
        }
      };
      injectSidebar();

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

      // Get hotkey input elements
      this.hotkeyPrevInput = this.sidebar.querySelector('#yt-hotkey-prev');
      this.hotkeyNextInput = this.sidebar.querySelector('#yt-hotkey-next');
      this.hotkeyRestartInput = this.sidebar.querySelector('#yt-hotkey-restart');
      this.hotkeyToggleInput = this.sidebar.querySelector('#yt-hotkey-toggle');

      // Setup header button listeners
      this._setupHeaderButtons();

      // Setup settings listeners
      this._setupSettingsListeners();

      // Setup hotkey input listeners
      this._setupHotkeyInputs();

      // Apply loaded settings to UI
      this._applySettingsToUI();

      // Don't set isVisible = true here, let _init() handle it based on page type
      console.log('[Helios YouTube Sidebar] Initialized');
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to load:', error);
    }
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Listen for subtitles being loaded
    document.addEventListener('helios-subtitles-loaded', (e) => {
      const { track, entries } = e.detail;
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

    // Listen for vocabulary updates to refresh underlining
    document.addEventListener('helios-vocab-updated', () => {
      // Update underlining without full re-render to avoid jarring refresh
      this._updateUnderlining().catch(err => {
        console.error('[Helios YouTube Sidebar] Error updating underlining:', err);
      });
    });

    // Setup global mouse listener for pause-on-hover resume logic
    this._setupPauseOnHoverListener();

    // Listen for video notifications to display in sidebar
    document.addEventListener('helios-video-notification', (e) => {
      const { message, type } = e.detail;
      this._showNotification(message, type);
    });

    // Setup hotkeys
    this._setupHotkeys();

    // Setup scroll detection to prevent auto-scroll during user page scrolling
    this._setupScrollDetection();
  }

  /**
   * Setup navigation listener to show/hide sidebar based on page type
   */
  _setupNavigationListener() {
    let lastUrl = window.location.href;

    // Check URL changes periodically (YouTube is a SPA)
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;

        // Show sidebar only on watch pages
        if (this.isWatchPage()) {
          this.show();
          // Re-enable theater mode and adjust layout when navigating to watch page
          setTimeout(() => {
            this._enableTheaterMode();
            this._adjustVideoLayout();
            this._syncSidebarToVideoHeight();
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
  _setupScrollDetection() {
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
    const handleSidebarScroll = (e) => {
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
    const handleMouseMove = (e) => {
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
    const preventScrollOutsideZone = (e) => {
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
  _syncSidebarToVideoHeight() {
    if (!this.sidebar) return;

    const syncHeight = () => {
      // Find the video player container and page-manager
      const videoPlayer = document.querySelector('.html5-video-player');
      const pageManager = document.querySelector('#page-manager');

      // Try different containers in order of preference
      const ytdWatchFlexy = document.querySelector('ytd-watch-flexy');
      const playerContainer = document.querySelector('#player-container');
      const playerContainerOuter = document.querySelector('#player-container-outer');

      if (!videoPlayer || !pageManager) {
        // Retry after a short delay if not found
        setTimeout(syncHeight, 100);
        return;
      }

      const playerRect = videoPlayer.getBoundingClientRect();

      // Set sidebar height to match video player height EXACTLY
      this.sidebar.style.setProperty('height', `${playerRect.height}px`, 'important');

      // Calculate position using getBoundingClientRect (actual visual position)
      // Since sidebar is absolutely positioned within page-manager, we need the
      // visual offset of the video relative to page-manager
      const pageManagerRect = pageManager.getBoundingClientRect();
      const topRelativeToPageManager = playerRect.top - pageManagerRect.top;

      this.sidebar.style.setProperty('top', `${topRelativeToPageManager}px`, 'important');

      console.log(`[Helios YouTube Sidebar] Sync complete - Height: ${playerRect.height}px, Top: ${topRelativeToPageManager}px, Video top: ${playerRect.top}px, PageManager top: ${pageManagerRect.top}px`);
    };

    // Initial sync
    syncHeight();

    // Setup ResizeObserver to keep sidebar synced when video player resizes
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    const videoPlayer = document.querySelector('.html5-video-player');
    if (videoPlayer) {
      this.resizeObserver = new ResizeObserver(() => {
        syncHeight();
      });

      this.resizeObserver.observe(videoPlayer);

      // Also observe the player container for theater mode changes
      const playerContainer = document.querySelector('#player-container');
      if (playerContainer) {
        this.resizeObserver.observe(playerContainer);
      }
    }

    // Only sync on window resize, NOT on scroll
    const resizeHandler = () => syncHeight();
    window.addEventListener('resize', resizeHandler);

    // Store handler for cleanup
    this.resizeHandler = resizeHandler;
  }

  /**
   * Setup keyboard hotkeys (Migaku-style)
   */
  _setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      // Only trigger if hotkeys are enabled and we're on YouTube watch page
      if (!this.settings.hotkeysEnabled || !window.location.pathname.includes('/watch')) {
        return;
      }

      // Don't trigger if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Normalize key name for arrow keys
      let keyName = e.key;
      if (keyName.startsWith('Arrow')) {
        keyName = keyName.substring(5); // "ArrowLeft" -> "Left"
      }
      const key = keyName.toLowerCase();

      // Check if this key combination matches any of our hotkeys
      const matchesHotkey = (hotkey) => {
        return hotkey.key === key &&
               hotkey.shift === e.shiftKey &&
               (hotkey.ctrl === (e.ctrlKey || e.metaKey)) &&
               hotkey.alt === e.altKey;
      };

      // Previous subtitle
      if (matchesHotkey(this.settings.hotkeys.previous)) {
        e.preventDefault();
        this._jumpToPreviousSubtitle();
      }
      // Next subtitle
      else if (matchesHotkey(this.settings.hotkeys.next)) {
        e.preventDefault();
        this._jumpToNextSubtitle();
      }
      // Jump to current subtitle start
      else if (matchesHotkey(this.settings.hotkeys.restart)) {
        e.preventDefault();
        this._jumpToCurrentSubtitleStart();
      }
      // Toggle subtitle visibility (overlay)
      else if (matchesHotkey(this.settings.hotkeys.toggle)) {
        e.preventDefault();
        this._toggleSubtitleOverlay();
      }
    });
  }

  /**
   * Setup header button listeners
   */
  _setupHeaderButtons() {
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
        const isShowingSettings = this.settingsSection.style.display !== 'none';

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
  _toggleSettings() {
    const isShowingSettings = this.settingsSection.style.display !== 'none';

    if (isShowingSettings) {
      // Switch to subtitle view
      this.settingsSection.style.display = 'none';
      this.subtitleSection.style.display = 'flex';

      // Change close button back to X icon
      this.closeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      this.closeBtn.setAttribute('title', 'Close');
    } else {
      // Switch to settings view
      this.subtitleSection.style.display = 'none';
      this.settingsSection.style.display = 'flex';

      // Change close button to back arrow icon (pointing right)
      this.closeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
      this.closeBtn.setAttribute('title', 'Back to subtitles');

      // Update language dropdown with available tracks
      this._updateLanguageDropdown();
    }
  }

  /**
   * Update language dropdown with available tracks
   */
  async _updateLanguageDropdown() {
    if (!this.secondaryLanguageSelect) return;

    try {
      // Request available tracks
      const tracksPromise = new Promise((resolve) => {
        const handler = (event) => {
          document.removeEventListener('helios-youtube-tracks-response', handler);
          resolve(event.detail.tracks || []);
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
      const languageMap = new Map();

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
        this.secondaryLanguageSelect.appendChild(option);
      });

      // Restore selection if it's still available
      if (currentSelection && languageMap.has(currentSelection)) {
        this.secondaryLanguageSelect.value = currentSelection;
      } else if (sortedLanguages.length > 0) {
        // Select first language by default
        this.secondaryLanguageSelect.value = sortedLanguages[0][0];
        this.settings.secondarySubtitleLanguage = sortedLanguages[0][0];
      }

      console.log('[Helios YouTube Sidebar] Updated language dropdown with', languageMap.size, 'languages');
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to update language dropdown:', error);
    }
  }

  /**
   * Get proper display name for language
   */
  _getLanguageDisplayName(youtubeName, langCode) {
    // Language code to proper name mapping
    const languageNames = {
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
  _setupSettingsListeners() {
    // Hotkeys toggle
    if (this.hotkeysToggle) {
      this.hotkeysToggle.addEventListener('change', (e) => {
        this.settings.hotkeysEnabled = e.target.checked;
        this._saveSettings();
        console.log(`[Helios YouTube Sidebar] Hotkeys ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    }

    // Dual subtitles toggle
    if (this.dualSubtitlesToggle) {
      this.dualSubtitlesToggle.addEventListener('change', (e) => {
        this.settings.dualSubtitlesEnabled = e.target.checked;
        this._saveSettings();

        // Show/hide secondary language selector
        if (this.secondaryLanguageContainer) {
          this.secondaryLanguageContainer.style.display = e.target.checked ? 'block' : 'none';
        }

        // Trigger subtitle reload if dual subtitles enabled, clear if disabled
        if (e.target.checked) {
          this._loadSecondarySubtitles();
        } else {
          // Clear secondary subtitles from both overlay and sidebar
          this.currentSecondarySubtitles = [];
          if (this.videoBinding && this.videoBinding.overlay) {
            this.videoBinding.overlay.clearSecondarySubtitles();
          }
          // Re-render sidebar list without secondary subtitles
          this._renderSubtitleList().catch(err => {
            console.error('[Helios YouTube Sidebar] Error re-rendering subtitle list:', err);
          });
        }

        console.log(`[Helios YouTube Sidebar] Dual subtitles ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    }

    // Secondary language select
    if (this.secondaryLanguageSelect) {
      this.secondaryLanguageSelect.addEventListener('change', (e) => {
        this.settings.secondarySubtitleLanguage = e.target.value || null;
        this._saveSettings();

        // Reload secondary subtitles with new language
        if (this.settings.dualSubtitlesEnabled) {
          this._loadSecondarySubtitles();
        }

        console.log(`[Helios YouTube Sidebar] Secondary language set to: ${e.target.value || 'auto'}`);
      });
    }

    // Pause on hover toggle
    if (this.pauseOnHoverToggle) {
      this.pauseOnHoverToggle.addEventListener('change', (e) => {
        this.settings.pauseOnHover = e.target.checked;
        this._saveSettings();

        // Update overlay setting
        if (this.videoBinding && this.videoBinding.overlay) {
          this.videoBinding.overlay.setPauseOnHover(e.target.checked);
        }

        console.log(`[Helios YouTube Sidebar] Pause on hover ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    }
  }

  /**
   * Setup hotkey input listeners for customization
   */
  _setupHotkeyInputs() {
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

    const inputs = [
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

        const newHotkey = {
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
  _formatHotkeyDisplay(hotkey) {
    const parts = [];
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

    // Apply hotkey values to inputs
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
   * Enable YouTube theater mode
   */
  _enableTheaterMode() {
    // Wait for YouTube to be ready
    setTimeout(() => {
      const ytdWatchFlexy = document.querySelector('ytd-watch-flexy');
      if (ytdWatchFlexy && !ytdWatchFlexy.hasAttribute('theater')) {
        // Click the theater mode button
        const theaterButton = document.querySelector('button.ytp-size-button');
        if (theaterButton) {
          theaterButton.click();
          console.log('[Helios YouTube Sidebar] Enabled theater mode');
        }
      }
    }, 1000);
  }

  /**
   * Adjust video layout to accommodate sidebar
   * CRITICAL: Always push video, never cover it
   */
  _adjustVideoLayout() {
    // Wait for page-manager to exist (YouTube uses dynamic loading)
    const checkAndAdjust = () => {
      const pageManager = document.querySelector('#page-manager');
      if (pageManager) {
        pageManager.classList.add('helios-sidebar-active');
        pageManager.classList.remove('helios-sidebar-hidden');

        // Also directly set the margin and position to ensure it applies
        pageManager.style.marginRight = '420px';
        pageManager.style.position = 'relative';
        pageManager.style.transition = 'margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

        console.log('[Helios YouTube Sidebar] Video layout adjusted - sidebar will push video');

        // Setup observer to re-enforce layout on YouTube SPA navigation
        this._setupLayoutObserver(pageManager);
      } else {
        // Retry after a short delay
        setTimeout(checkAndAdjust, 100);
      }
    };
    checkAndAdjust();
  }

  /**
   * Setup MutationObserver to maintain layout during YouTube navigation
   */
  _setupLayoutObserver(pageManager) {
    if (this.layoutObserver) return; // Already setup

    this.layoutObserver = new MutationObserver(() => {
      // Re-enforce classes and styles when YouTube modifies the DOM
      if (this.isVisible && !pageManager.classList.contains('helios-sidebar-active')) {
        pageManager.classList.add('helios-sidebar-active');
        pageManager.classList.remove('helios-sidebar-hidden');
        pageManager.style.marginRight = '420px';
        pageManager.style.position = 'relative';
        console.log('[Helios YouTube Sidebar] Layout re-enforced after DOM change');
      }
    });

    // Observe the entire ytd-app for changes (catches SPA navigation)
    const ytdApp = document.querySelector('ytd-app');
    if (ytdApp) {
      this.layoutObserver.observe(ytdApp, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  /**
   * Update subtitles in sidebar
   */
  updateSubtitles(entries, track) {
    this.currentSubtitles = entries || [];
    this.currentTrack = track;
    this.currentSecondarySubtitles = []; // Reset secondary subtitles

    // Render subtitle list (async)
    this._renderSubtitleList().catch(err => {
      console.error('[Helios YouTube Sidebar] Error rendering subtitle list:', err);
    });

    // Update language dropdown with new video's available languages
    this._updateLanguageDropdown();

    // Load secondary subtitles if dual subtitles enabled
    if (this.settings.dualSubtitlesEnabled) {
      this._loadSecondarySubtitles();
    }
  }

  /**
   * Load secondary subtitles for dual subtitle display
   */
  async _loadSecondarySubtitles() {
    if (!this.videoBinding) {
      console.warn('[Helios YouTube Sidebar] Cannot load secondary subtitles: no video binding');
      return;
    }

    try {
      // Dispatch event to request available tracks
      const tracksPromise = new Promise((resolve) => {
        const handler = (event) => {
          document.removeEventListener('helios-youtube-tracks-response', handler);
          resolve(event.detail.tracks || []);
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

      console.log('[Helios YouTube Sidebar] Found', tracks.length, 'available subtitle tracks');

      // Find secondary subtitle track
      let secondaryTrack = null;
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

      console.log('[Helios YouTube Sidebar] Loading secondary subtitles:', secondaryTrack.languageName);

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

      // Re-render sidebar list with dual subtitles
      this._renderSubtitleList().catch(err => {
        console.error('[Helios YouTube Sidebar] Error re-rendering subtitle list:', err);
      });

      console.log(`[Helios YouTube Sidebar] Loaded ${secondaryEntries.length} secondary subtitles`);
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to load secondary subtitles:', error);
    }
  }

  /**
   * Get current video ID from URL
   */
  _getCurrentVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Show notification in sidebar
   */
  _showNotification(message, type = 'info') {
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
      this.notificationElement.style.display = 'none';
    }, 3000);
  }

  /**
   * Extract potential words from text for preloading
   * @param {string} text - Text to extract words from
   * @returns {string[]} - Array of potential words
   */
  _extractPotentialWords(text) {
    const words = [];
    const currentLang = window.languageRegistry?.getCurrentLanguage();
    
    if (currentLang && ['zh', 'ja', 'ko'].includes(currentLang)) {
      // For CJK languages, extract unique characters and common sequences (1-3 chars)
      const seen = new Set();
      
      // Extract single characters
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char.trim() && !seen.has(char)) {
          words.push(char);
          seen.add(char);
        }
      }
      
      // Extract 2-3 character sequences (most common word lengths)
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
  async _renderSubtitleList() {
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
    if (window.dictionaryManager && window.dictionaryManager.preloadWords) {
      const allWordsToPreload = [];
      this.currentSubtitles.forEach(entry => {
        const words = this._extractPotentialWords(entry.text);
        allWordsToPreload.push(...words);
      });
      
      // Preload unique words
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
        if (wordsToPreload.length > 0 && window.dictionaryManager.preloadWords) {
          await window.dictionaryManager.preloadWords(wordsToPreload);
        }
        
        const dictionary = window.dictionaryManager?.dictionary || {};
        // Use language-aware word extraction
        const extractedWords = adapter.extractWords(entry.text, dictionary);

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
  _isPopupVisible() {
    // Check if popup manager exists and has an active popup
    if (window.popupManager && window.popupManager.popup) {
      const popup = window.popupManager.popup;
      // Check if popup exists in DOM and is visible
      return popup && popup.parentElement && popup.style.display !== 'none';
    }
    return false;
  }

  /**
   * Setup global mousemove listener for pause-on-hover resume logic
   * Resumes video when mouse leaves both sidebar word and popup
   */
  _setupPauseOnHoverListener() {
    document.addEventListener('mousemove', (e) => {
      if (!this.settings.pauseOnHover || !this.pausedByHover) return;

      // Check if mouse is over popup or sidebar word
      const target = e.target;
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
    });
  }

  /**
   * Update underlining on existing word spans without re-rendering
   * This preserves scroll position and avoids jarring refresh
   */
  async _updateUnderlining() {
    if (!this.listContainer || !window.vocabManager || !window.dictionaryManager) return;

    const wordSpans = this.listContainer.querySelectorAll('.yt-subtitle-word');
    const wordsToCheck = Array.from(wordSpans).map(span => {
      const word = span.textContent || span.getAttribute('data-helios-word');
      return word ? word.toLowerCase() : null;
    }).filter(w => w !== null);

    // Preload words to ensure they're in cache
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
   * Find matching secondary subtitle based on time overlap
   */
  _findMatchingSubtitle(primaryEntry, secondarySubtitles) {
    let bestMatch = null;
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
  _updateActiveSubtitle(currentTime) {
    if (!this.listContainer || this.currentSubtitles.length === 0) return;

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
      return;
    }

    const newIndex = this.currentSubtitles.indexOf(activeEntry);
    if (newIndex === this.activeIndex) return;

    // Update active state
    this.activeIndex = newIndex;

    const items = this.listContainer.querySelectorAll('.yt-subtitle-item');
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
  _scrollSubtitleToCenter(item) {
    if (!this.listContainer || !item) return;

    // Set auto-scrolling flag to prevent detecting this as user scroll
    this.isAutoScrolling = true;

    // Use requestAnimationFrame for smoother, more responsive scrolling
    requestAnimationFrame(() => {
      const containerRect = this.listContainer.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      // Calculate the scroll position needed to center the item
      const containerCenter = containerRect.height / 2;
      const itemCenter = itemRect.height / 2;
      const scrollOffset = (itemRect.top - containerRect.top) - containerCenter + itemCenter;

      // Smooth scroll to the calculated position
      this.listContainer.scrollBy({
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
  _seekToSubtitle(entry) {
    if (this.videoBinding) {
      this.videoBinding.seekTo(entry.start);
    }
  }

  /**
   * Format time in MM:SS format
   */
  _formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Expand to full Helios sidebar
   */
  _expandHelios() {
    // Dispatch event to open main sidebar
    document.dispatchEvent(new CustomEvent('helios-open-sidebar'));
  }

  /**
   * Show caption selector modal
   */
  async _showCaptionSelector() {
    console.log('[Helios YouTube Sidebar] Opening caption selector');

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
      const tracks = await youtubeLoader.getAvailableTracks();

      if (tracks.length === 0) {
        this._showNotification('No caption tracks available', 'error');
        return;
      }

      console.log('[Helios YouTube Sidebar] Available tracks:', tracks.length);

      // Create or get subtitle selector modal
      if (!window.subtitleSelectorModal) {
        window.subtitleSelectorModal = new SubtitleSelectorModal();
      }

      // Show modal with tracks, callback, and current track
      window.subtitleSelectorModal.show(tracks, async (selectedTrack) => {
        console.log('[Helios YouTube Sidebar] Selected track:', selectedTrack.languageName);
        this._showNotification(`Loading ${selectedTrack.languageName} captions...`, 'info');

        try {
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
   */
  show() {
    if (this.sidebar) {
      this.sidebar.classList.remove('hidden');
      this.isVisible = true;

      // Adjust video layout
      const pageManager = document.querySelector('#page-manager');
      if (pageManager) {
        pageManager.classList.add('helios-sidebar-active');
        pageManager.classList.remove('helios-sidebar-hidden');
        pageManager.style.marginRight = '420px';
        pageManager.style.position = 'relative';
      }

      // Sync sidebar height with video player
      setTimeout(() => this._syncSidebarToVideoHeight(), 100);
    }
  }

  /**
   * Hide sidebar
   */
  hide() {
    if (this.sidebar) {
      this.sidebar.classList.add('hidden');
      this.isVisible = false;

      // Remove video layout adjustment
      const pageManager = document.querySelector('#page-manager');
      if (pageManager) {
        pageManager.classList.remove('helios-sidebar-active');
        pageManager.classList.remove('helios-sidebar-hidden');
        pageManager.style.marginRight = '0';
        pageManager.style.position = '';
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
   * Hotkey: Jump to previous subtitle
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
   * Hotkey: Jump to next subtitle
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
   * Hotkey: Jump to current subtitle start
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
   * Hotkey: Toggle subtitle overlay visibility
   */
  _toggleSubtitleOverlay() {
    if (!this.videoBinding || !this.videoBinding.overlay) return;

    // Use the overlay's toggleVisibility method for persistent state
    const isVisible = this.videoBinding.overlay.toggleVisibility();
    console.log(`[Helios Hotkeys] Subtitle overlay ${isVisible ? 'shown' : 'hidden'}`);
  }

  /**
   * Load settings from chrome storage
   */
  async _loadSettings() {
    try {
      const result = await chrome.storage.local.get(['ytSidebarSettings']);
      if (result.ytSidebarSettings) {
        const loaded = result.ytSidebarSettings;

        // Migrate old hotkey format (string) to new format (object with modifiers)
        if (loaded.hotkeys) {
          Object.keys(loaded.hotkeys).forEach(key => {
            const hotkey = loaded.hotkeys[key];
            // If it's a string (old format), convert to new format
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
      console.error('[Helios YouTube Sidebar] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to chrome storage
   */
  async _saveSettings() {
    try {
      await chrome.storage.local.set({ ytSidebarSettings: this.settings });
      console.log('[Helios YouTube Sidebar] Settings saved');
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to save settings:', error);
    }
  }

  /**
   * Destroy sidebar
   */
  destroy() {
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

    if (this.sidebar && this.sidebar.parentElement) {
      this.sidebar.parentElement.removeChild(this.sidebar);
    }
    this.sidebar = null;

    // Remove video layout adjustment
    const pageManager = document.querySelector('#page-manager');
    if (pageManager) {
      pageManager.classList.remove('helios-sidebar-active');
      pageManager.classList.remove('helios-sidebar-hidden');
      pageManager.style.marginRight = '0';
      pageManager.style.position = '';
    }
  }
}
