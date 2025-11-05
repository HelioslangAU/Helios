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
  init() {
    if (this.isInitialized) return;

    this.subtitleSelector = new SubtitleSelectorModal();
    // this._createLoadButton(); // Removed - using YouTube sidebar instead
    this._setupKeyboardShortcuts();
    this._setupAutoLoad();
    this._setupLanguageChangeListener();

    this.isInitialized = true;

    // Immediately trigger auto-load if video is already detected
    if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        console.log('[Helios Video] Triggering immediate auto-load');
        setTimeout(() => this.autoLoadSubtitles(), 1500);
      }
    }
  }

  /**
   * Setup automatic subtitle loading on YouTube
   */
  _setupAutoLoad() {
    if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
      // Auto-load when video is detected
      document.addEventListener('helios-video-detected', () => {
        if (!this.hasAutoLoaded) {
          setTimeout(() => this.autoLoadSubtitles(), 1500);
        }
      });

      // Auto-load on URL change (new video)
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          this.hasAutoLoaded = false;
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
        console.log('[Helios Video] Language changed to:', newLanguage);

        // Reset auto-load flag and reload subtitles with new language
        this.hasAutoLoaded = false;

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
    if (this.hasAutoLoaded) return;
    if (!this.youtubeLoader || !this.youtubeLoader.isYouTubePage()) return;

    try {
      // Get target language from language registry (already loaded and synced)
      let targetLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

      // Fallback: if language registry not available, read from storage
      if (!window.languageRegistry) {
        const settings = await chrome.storage.sync.get(['targetLanguage']);
        targetLanguage = settings.targetLanguage?.toLowerCase() || 'zh';
      }

      console.log('[Helios Video] Auto-loading subtitles for target language:', targetLanguage);

      // Get available tracks
      const tracks = await this.youtubeLoader.getAvailableTracks();

      if (tracks.length === 0) {
        console.log('[Helios Video] No subtitles available for this video');
        this._showNotification('No subtitles available', 'error');
        return;
      }

      // Find matching track
      const matchingTrack = this._findMatchingTrack(tracks, targetLanguage);

      if (matchingTrack) {
        this.hasAutoLoaded = true;
        await this._loadYouTubeTrack(matchingTrack);
        // Use display name from language code if languageName is just a code (2-3 chars)
        const displayName = (matchingTrack.languageName && matchingTrack.languageName.length > 3)
          ? matchingTrack.languageName
          : this._getLanguageDisplayName(matchingTrack.language || targetLanguage);
        this._showNotification(`Loaded ${displayName} subtitles`, 'success');
      } else {
        console.log('[Helios Video] No subtitles found for target language:', targetLanguage);
        const languageName = this._getLanguageDisplayName(targetLanguage);
        this._showNotification(`No ${languageName} subtitles available`, 'error');
      }
    } catch (error) {
      console.error('[Helios Video] Auto-load failed:', error);
    }
  }

  /**
   * Find best matching track for target language
   */
  _findMatchingTrack(tracks, targetLanguage) {
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
      console.log('[Helios Video] Fetching YouTube subtitle tracks...');
      const tracks = await this.youtubeLoader.getAvailableTracks();

      if (tracks.length > 0) {
        // Show track selector
        this.subtitleSelector.show(tracks, async (track) => {
          console.log('[Helios Video] Loading track:', track.languageName);
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
  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + S = Toggle subtitle panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this._toggleSubtitlePanel();
      }

      // Ctrl/Cmd + Shift + Y = Auto-load YouTube subtitles
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Y') {
        e.preventDefault();
        this.hasAutoLoaded = false;
        this.autoLoadSubtitles();
      }
    });
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
