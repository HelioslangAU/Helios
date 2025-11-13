/**
 * Main manager for Helios proprietary video player features
 * Coordinates all video-related components
 */
class VideoFeatureManager {
  constructor() {
    this.videoDetector = null;
    this.fileLoader = null;
    this.youtubeLoader = null;
    this.panelController = null;
    this.uiController = null;
    this.isInitialized = false;
    this.isEnabled = true;
  }

  /**
   * Initialize the video feature
   */
  async init() {
    if (this.isInitialized) return;

    console.log('[Helios Video] Initializing video feature...');

    // Load settings
    await this._loadSettings();

    if (!this.isEnabled) {
      console.log('[Helios Video] Video feature is disabled');
      return;
    }

    // Inject CSS
    this._injectStyles();

    // Initialize core components
    this.videoDetector = new VideoDetector();
    this.fileLoader = new SubtitleFileLoader(this.videoDetector);
    this.youtubeLoader = new YouTubeSubtitleLoader(this.videoDetector);
    // this.panelController = new SubtitlePanelController(this.videoDetector); // Disabled - using YouTube sidebar
    this.uiController = new VideoUIController(this.videoDetector, this.fileLoader, this.youtubeLoader);

    // Initialize all components
    this.videoDetector.start();
    this.fileLoader.init();
    // this.panelController.init(); // Disabled - using YouTube sidebar
    this.uiController.init();

    // Setup integration event listeners
    this._setupIntegrationEvents();

    // Don't auto-load - let user choose manually
    // Auto-load YouTube subtitles if on YouTube
    // if (this.youtubeLoader.isYouTubePage()) {
    //   this._setupYouTubeAutoLoad();
    // }

    this.isInitialized = true;
    console.log('[Helios Video] Video feature initialized successfully');
  }

  /**
   * Load settings from storage
   */
  async _loadSettings() {
    try {
      const settings = await chrome.storage.local.get(['videoFeatureEnabled']);
      this.isEnabled = settings.videoFeatureEnabled !== false; // Default to true
    } catch (error) {
      console.error('[Helios Video] Failed to load settings:', error);
      this.isEnabled = true; // Default to enabled
    }
  }

  /**
   * Inject CSS styles
   */
  _injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/ui/video/video-styles.css');
    document.head.appendChild(link);
  }

  /**
   * Setup integration events with other Helios features
   */
  _setupIntegrationEvents() {
    // Toggle subtitle panel
    document.addEventListener('helios-toggle-subtitle-panel', () => {
      this.panelController.toggle();
    });

    // Auto-load YouTube subtitles
    document.addEventListener('helios-autoload-youtube-subtitles', async () => {
      if (this.youtubeLoader.isYouTubePage()) {
        // Get current language
        let language = 'en';
        if (window.languageRegistry) {
          language = window.languageRegistry.getCurrentLanguage();
        }
        await this.youtubeLoader.autoLoadSubtitles(language);
      }
    });

    // Integrate subtitle text selection with main lookup system
    document.addEventListener('helios-subtitle-selection', (e) => {
      const { text, position } = e.detail;

      // Trigger existing Helios word lookup
      if (window.heliosPageProcessor) {
        // Use your existing lookup system
        const customEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: position.x,
          clientY: position.y
        });

        // Create a temporary element with the selected text
        const tempEl = document.createElement('span');
        tempEl.textContent = text;
        tempEl.style.position = 'absolute';
        tempEl.style.left = position.x + 'px';
        tempEl.style.top = position.y + 'px';
        tempEl.style.visibility = 'hidden';
        document.body.appendChild(tempEl);

        // Trigger lookup
        setTimeout(() => {
          if (tempEl.parentElement) {
            tempEl.parentElement.removeChild(tempEl);
          }
        }, 100);
      }
    });

    // Handle track requests from YouTube sidebar for dual subtitles
    document.addEventListener('helios-youtube-request-tracks', async (e) => {
      if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
        try {
          const tracks = await this.youtubeLoader.getAvailableTracks();
          document.dispatchEvent(new CustomEvent('helios-youtube-tracks-response', {
            detail: { tracks }
          }));
        } catch (error) {
          console.error('[Helios Video] Failed to get tracks:', error);
          document.dispatchEvent(new CustomEvent('helios-youtube-tracks-response', {
            detail: { tracks: [] }
          }));
        }
      } else {
        document.dispatchEvent(new CustomEvent('helios-youtube-tracks-response', {
          detail: { tracks: [] }
        }));
      }
    });
  }

  /**
   * Setup YouTube auto-load with delay
   */
  _setupYouTubeAutoLoad() {
    // Wait for YouTube player to be ready
    let attempts = 0;
    const maxAttempts = 10;

    const tryAutoLoad = async () => {
      attempts++;

      const binding = this.videoDetector.getPrimaryBinding();
      if (binding && binding.hasValidSource()) {
        // Auto-load after 2 seconds
        setTimeout(async () => {
          // Get current language from Helios settings
          let language = 'en'; // default

          // Try to get from language registry
          if (window.languageRegistry) {
            const currentLang = window.languageRegistry.getCurrentLanguage();
            // Map Helios language codes to YouTube language codes
            const langMap = {
              'zh': 'zh', // Chinese (will match zh-Hans or zh-Hant)
              'en': 'en',
              'ja': 'ja',
              'es': 'es',
              'fr': 'fr',
              'de': 'de',
              'ko': 'ko'
            };
            language = langMap[currentLang] || currentLang;
            console.log('[Helios Video] Using language for YouTube subtitles:', language);
          }

          await this.youtubeLoader.autoLoadSubtitles(language);
        }, 2000);
      } else if (attempts < maxAttempts) {
        setTimeout(tryAutoLoad, 1000);
      }
    };

    // Start trying after initial delay
    setTimeout(tryAutoLoad, 3000);
  }

  /**
   * Enable video feature
   */
  enable() {
    this.isEnabled = true;
    chrome.storage.local.set({ videoFeatureEnabled: true });

    if (!this.isInitialized) {
      this.init();
    }
  }

  /**
   * Disable video feature
   */
  disable() {
    this.isEnabled = false;
    chrome.storage.local.set({ videoFeatureEnabled: false });

    if (this.isInitialized) {
      this.destroy();
    }
  }

  /**
   * Get current video bindings
   */
  getVideoBindings() {
    return this.videoDetector ? this.videoDetector.getAllBindings() : [];
  }

  /**
   * Get primary video binding
   */
  getPrimaryBinding() {
    return this.videoDetector ? this.videoDetector.getPrimaryBinding() : null;
  }

  /**
   * Manually load subtitle file
   */
  loadSubtitleFile() {
    if (this.fileLoader) {
      this.fileLoader.openFilePicker();
    }
  }

  /**
   * Destroy the video feature
   */
  destroy() {
    if (this.videoDetector) {
      this.videoDetector.destroy();
    }

    if (this.fileLoader) {
      this.fileLoader.destroy();
    }

    if (this.panelController) {
      this.panelController.destroy();
    }

    if (this.uiController) {
      this.uiController.destroy();
    }

    this.isInitialized = false;
    console.log('[Helios Video] Video feature destroyed');
  }
}

// Global instance
if (!window.heliosVideoFeature) {
  window.heliosVideoFeature = new VideoFeatureManager();
}