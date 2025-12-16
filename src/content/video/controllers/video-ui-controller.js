/**
 * Controls video UI elements (load button, shortcuts, etc.)
 */
class VideoUIController {
  constructor(videoDetector, fileLoader, youtubeLoader) {
    this.videoDetector = videoDetector;
    this.fileLoader = fileLoader;
    this.youtubeLoader = youtubeLoader;
    this.loadButton = null;
    this.subtitleSelector = null;
    this.isInitialized = false;
    this.hasAutoLoaded = false;
    this.isCurrentlyLoading = false;

    // Language code mappings (extension language -> YouTube language codes)
    // Supports both 2-letter codes (zh, en, es) and full names (chinese, english, spanish)
    this.languageMap = {
      // Chinese
      'chinese': ['zh-Hans', 'zh-CN', 'zh', 'zh-TW', 'zh-HK'],
      'zh': ['zh-Hans', 'zh-CN', 'zh', 'zh-TW', 'zh-HK'],
      // Japanese
      'japanese': ['ja', 'jp'],
      'ja': ['ja', 'jp'],
      // Korean
      'korean': ['ko', 'kr'],
      'ko': ['ko', 'kr'],
      // Spanish
      'spanish': ['es', 'es-ES', 'es-419'],
      'es': ['es', 'es-ES', 'es-419'],
      // French
      'french': ['fr', 'fr-FR'],
      'fr': ['fr', 'fr-FR'],
      // German
      'german': ['de', 'de-DE'],
      'de': ['de', 'de-DE'],
      // Italian
      'italian': ['it', 'it-IT'],
      'it': ['it', 'it-IT'],
      // Portuguese
      'portuguese': ['pt', 'pt-BR', 'pt-PT'],
      'pt': ['pt', 'pt-BR', 'pt-PT'],
      // Russian
      'russian': ['ru', 'ru-RU'],
      'ru': ['ru', 'ru-RU'],
      // Arabic
      'arabic': ['ar'],
      'ar': ['ar'],
      // Hindi
      'hindi': ['hi'],
      'hi': ['hi'],
      // English
      'english': ['en', 'en-US', 'en-GB'],
      'en': ['en', 'en-US', 'en-GB']
    };
  }

  /**
   * Initialize UI controls
   */
  async init() {
    if (this.isInitialized) return;

    this.subtitleSelector = new SubtitleSelectorModal();
    // this._createLoadButton(); // Removed - using YouTube sidebar instead
    try {
      await this._setupKeyboardShortcuts();
    } catch (err) {
      console.error('[VideoUIController] Error setting up keyboard shortcuts:', err);
    }
    this._setupAutoLoad();
    this._setupLanguageChangeListener();

    this.isInitialized = true;

    // Immediately trigger auto-load if video is already detected
    if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        setTimeout(() => this.autoLoadSubtitles(), 1500);
      }
    }
  }

  /**
   * Setup automatic subtitle loading on YouTube
   */
  _setupAutoLoad() {
    if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
      // Auto-load on URL change (new video)
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;

          // Clear old subtitles from previous video
          const binding = this.videoDetector.getPrimaryBinding();
          if (binding) {
            binding.clearSubtitles();
          }

          // Reset auto-load flags and load new subtitles
          this.hasAutoLoaded = false;
          this.isCurrentlyLoading = false;
          setTimeout(() => this.autoLoadSubtitles(), 1500);
        }
      }, 1000);
    }
  }

  /**
   * Setup listener for language changes to reload subtitles
   */
  _setupLanguageChangeListener() {
    if (!this.youtubeLoader || !this.youtubeLoader.isYouTubePage()) return;

    // Listen for language change from the language registry
    if (window.languageRegistry) {
      window.languageRegistry.on('languageChanged', async (newLanguage) => {
        // Clear old subtitles
        const binding = this.videoDetector.getPrimaryBinding();
        if (binding) {
          binding.clearSubtitles();
        }

        // Reset auto-load flags and reload subtitles with new language
        this.hasAutoLoaded = false;
        this.isCurrentlyLoading = false;

        // Small delay to ensure dictionary is loaded
        setTimeout(() => {
          this.autoLoadSubtitles();
        }, 500);
      });
    }
  }

  /**
   * Automatically load subtitles based on target language
   */
  async autoLoadSubtitles() {
    // Prevent duplicate loading attempts
    if (this.hasAutoLoaded || this.isCurrentlyLoading) {
      return;
    }

    if (!this.youtubeLoader || !this.youtubeLoader.isYouTubePage()) {
      return;
    }

    const binding = this.videoDetector.getPrimaryBinding();
    if (!binding) {
      return;
    }

    this.isCurrentlyLoading = true;

    try {
      // Start loading state (pause video if not ad, show loading indicator)
      binding.startLoadingSubtitles();

      // Get target language from language registry (already loaded and synced)
      let targetLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

      // Fallback: if language registry not available, read from storage
      if (!window.languageRegistry) {
        const settings = await chrome.storage.sync.get(['targetLanguage']);
        targetLanguage = settings.targetLanguage?.toLowerCase() || 'zh';
      }

      // Get available tracks
      const tracks = await this.youtubeLoader.getAvailableTracks();

      if (tracks.length === 0) {
        binding.finishLoadingSubtitles();
        this.isCurrentlyLoading = false;
        this._showNotification('No subtitles available', 'error');
        // Also notify sidebar to remove loading overlay
        document.dispatchEvent(new CustomEvent('helios-subtitle-load-failed'));
        return;
      }

      // Find matching track (now async to check preferences)
      const matchingTrack = await this._findMatchingTrack(tracks, targetLanguage);

      if (matchingTrack) {
        this.hasAutoLoaded = true;
        await this._loadYouTubeTrack(matchingTrack);
        // Use display name from language code if languageName is just a code (2-3 chars)
        const displayName = (matchingTrack.languageName && matchingTrack.languageName.length > 3)
          ? matchingTrack.languageName
          : this._getLanguageDisplayName(matchingTrack.language || targetLanguage);
        this._showNotification(`Loaded ${displayName} subtitles`, 'success');
      } else {
        binding.finishLoadingSubtitles();
        const languageName = this._getLanguageDisplayName(targetLanguage);
        this._showNotification(`No ${languageName} subtitles available`, 'error');
        // Also notify sidebar to remove loading overlay
        document.dispatchEvent(new CustomEvent('helios-subtitle-load-failed'));
      }
    } catch (error) {
      console.error('[Helios Video] Auto-load failed:', error);
      binding.finishLoadingSubtitles();
      // Also notify sidebar to remove loading overlay
      document.dispatchEvent(new CustomEvent('helios-subtitle-load-failed'));
    } finally {
      this.isCurrentlyLoading = false;
    }
  }

  /**
   * Find best matching track for target language
   * Checks saved preferences first, then falls back to default matching
   */
  async _findMatchingTrack(tracks, targetLanguage) {
    // PRIORITY 1: Check for per-video preference
    const videoId = this._getCurrentVideoId();
    if (videoId) {
      try {
        const result = await chrome.storage.local.get(['subtitlePreferences']);
        const perVideoPref = result.subtitlePreferences?.perVideo?.[videoId];

        if (perVideoPref) {
          const preferredTrack = tracks.find(t =>
            t.language === perVideoPref.language &&
            (t.isAutoGenerated || false) === perVideoPref.isAutoGenerated
          );
          if (preferredTrack) {
            return preferredTrack;
          }
        }
      } catch (error) {
        console.error('[Helios Video] Error loading per-video preference:', error);
      }
    }

    // PRIORITY 2: Check for global language variant preference
    try {
      const result = await chrome.storage.local.get(['subtitlePreferences']);
      const globalPref = result.subtitlePreferences?.global?.[targetLanguage];

      if (globalPref) {
        const preferredTrack = tracks.find(t =>
          t.language === globalPref && !t.isAutoGenerated
        );
        if (preferredTrack) {
          return preferredTrack;
        }
      }
    } catch (error) {
      console.error('[Helios Video] Error loading global preference:', error);
    }

    // PRIORITY 3: Fall back to default matching logic
    const possibleCodes = this.languageMap[targetLanguage] || [];

    // First try: exact match (prefer manual over auto-generated)
    for (const code of possibleCodes) {
      const track = tracks.find(t =>
        t.language === code && !t.isAutoGenerated
      );
      if (track) return track;
    }

    // Second try: exact match (including auto-generated)
    for (const code of possibleCodes) {
      const track = tracks.find(t => t.language === code);
      if (track) return track;
    }

    // Third try: partial match (e.g., "zh" matches "zh-Hans")
    for (const code of possibleCodes) {
      const track = tracks.find(t =>
        t.language.startsWith(code) || code.startsWith(t.language)
      );
      if (track) return track;
    }

    return null;
  }

  /**
   * Get current video ID from URL
   */
  _getCurrentVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Get display name for language code
   */
  _getLanguageDisplayName(code) {
    const languageNames = {
      'chinese': 'Chinese',
      'zh': 'Chinese',
      'japanese': 'Japanese',
      'ja': 'Japanese',
      'korean': 'Korean',
      'ko': 'Korean',
      'spanish': 'Spanish',
      'es': 'Spanish',
      'french': 'French',
      'fr': 'French',
      'german': 'German',
      'de': 'German',
      'italian': 'Italian',
      'it': 'Italian',
      'portuguese': 'Portuguese',
      'pt': 'Portuguese',
      'russian': 'Russian',
      'ru': 'Russian',
      'arabic': 'Arabic',
      'ar': 'Arabic',
      'hindi': 'Hindi',
      'hi': 'Hindi',
      'english': 'English',
      'en': 'English'
    };
    return languageNames[code.toLowerCase()] || code;
  }

  /**
   * Show notification to user (dispatches event for sidebar to handle)
   */
  _showNotification(message, type = 'info') {
    // Dispatch event for YouTube sidebar to show notification
    document.dispatchEvent(new CustomEvent('helios-video-notification', {
      detail: { message, type }
    }));
  }

  /**
   * Create floating load button
   */
  _createLoadButton() {
    this.loadButton = document.createElement('button');
    this.loadButton.className = 'helios-load-button';
    this.loadButton.title = 'Load Subtitles';
    this.loadButton.innerHTML = '📄';

    this.loadButton.addEventListener('click', () => {
      this._showSubtitleOptions();
    });

    // Only show button when videos are detected
    document.addEventListener('helios-video-detected', () => {
      if (!this.loadButton.parentElement) {
        document.body.appendChild(this.loadButton);
      }
    });
  }

  /**
   * Show subtitle loading options
   */
  async _showSubtitleOptions() {
    // Check if we're on YouTube
    const isYouTube = this.youtubeLoader && this.youtubeLoader.isYouTubePage();

    if (isYouTube) {
      // Get available YouTube tracks
      const tracks = await this.youtubeLoader.getAvailableTracks();

      if (tracks.length > 0) {
        // Show track selector
        this.subtitleSelector.show(tracks, async (track) => {
          await this._loadYouTubeTrack(track);
        });
      } else {
        // No tracks found, offer file upload
        this.fileLoader.openFilePicker();
      }
    } else {
      // Not YouTube, just open file picker
      this.fileLoader.openFilePicker();
    }
  }

  /**
   * Load YouTube subtitle track
   */
  async _loadYouTubeTrack(track) {
    try {
      const entries = await this.youtubeLoader.loadTrack(track.url);
      const binding = this.videoDetector.getPrimaryBinding();

      if (binding && entries.length > 0) {
        binding.loadSubtitles(entries);
        console.log(`[Helios Video] ✅ Loaded ${entries.length} subtitles (${track.languageName})`);

        // Dispatch event for subtitle panel to update
        document.dispatchEvent(new CustomEvent('helios-subtitles-loaded', {
          detail: { track, entries }
        }));
      }
    } catch (error) {
      console.error('[Helios Video] Failed to load YouTube track:', error);
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  async _setupKeyboardShortcuts() {
    // Load shortcut configuration
    const shortcuts = await ShortcutHelper.getVideoShortcuts();
    const panelShortcut = shortcuts.togglePanel;
    const youtubeShortcut = shortcuts.loadYouTube;

    // Remove existing listener if any
    if (this._keyboardListener) {
      document.removeEventListener('keydown', this._keyboardListener);
    }

    // Create new listener with current shortcut config
    this._keyboardListener = (e) => {
      // Don't trigger if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Toggle subtitle panel
      if (ShortcutHelper.matchesVideoShortcut(e, panelShortcut)) {
        e.preventDefault();
        this._toggleSubtitlePanel();
        return;
      }

      // Auto-load YouTube subtitles
      if (ShortcutHelper.matchesVideoShortcut(e, youtubeShortcut)) {
        e.preventDefault();
        this.hasAutoLoaded = false;
        this.autoLoadSubtitles();
        return;
      }
    };

    document.addEventListener('keydown', this._keyboardListener);
  }

  /**
   * Toggle subtitle panel
   */
  _toggleSubtitlePanel() {
    const event = new CustomEvent('helios-toggle-subtitle-panel');
    document.dispatchEvent(event);
  }

  /**
   * Hide load button
   */
  hideLoadButton() {
    if (this.loadButton && this.loadButton.parentElement) {
      this.loadButton.style.display = 'none';
    }
  }

  /**
   * Show load button
   */
  showLoadButton() {
    if (this.loadButton) {
      this.loadButton.style.display = 'flex';
    }
  }

  /**
   * Destroy UI controller
   */
  destroy() {
    if (this.loadButton && this.loadButton.parentElement) {
      this.loadButton.parentElement.removeChild(this.loadButton);
    }
    this.loadButton = null;
    this.isInitialized = false;
  }
}
