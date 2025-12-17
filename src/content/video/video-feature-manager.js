/**
 * Main manager for Helios proprietary video player features
 * Coordinates all video-related components
 */
class VideoFeatureManager {
  constructor() {
    this.videoDetector = null;
    this.fileLoader = null;
    this.youtubeLoader = null;
    this.netflixLoader = null;
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

    // Load settings
    await this._loadSettings();

    if (!this.isEnabled) {
      return;
    }

    // Inject CSS
    this._injectStyles();

    // Initialize core components
    this.videoDetector = new VideoDetector();
    this.fileLoader = new SubtitleFileLoader(this.videoDetector);
    this.youtubeLoader = new YouTubeSubtitleLoader(this.videoDetector);
    this.netflixLoader = new NetflixSubtitleLoader(this.videoDetector);
    this.uiController = new VideoUIController(this.videoDetector, this.fileLoader, this.youtubeLoader, this.netflixLoader);

    // Initialize all components
    this.videoDetector.start();
    await this.fileLoader.init();
    // NetflixSubtitleLoader no longer needs init() - it extends BasePlatformSubtitleLoader
    await this.uiController.init();

    // Setup integration event listeners
    this._setupIntegrationEvents();

    // Don't auto-load - let user choose manually
    // Auto-load YouTube subtitles if on YouTube
    // if (this.youtubeLoader.isYouTubePage()) {
    //   this._setupYouTubeAutoLoad();
    // }

    this.isInitialized = true;
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

    // Auto-load YouTube subtitles - DISABLED (now handled by VideoUIController)
    // document.addEventListener('helios-autoload-youtube-subtitles', async () => {
    //   if (this.youtubeLoader.isYouTubePage()) {
    //     // Get current language
    //     let language = 'en';
    //     if (window.languageRegistry) {
    //       language = window.languageRegistry.getCurrentLanguage();
    //     }
    //     await this.youtubeLoader.autoLoadSubtitles(language);
    //   }
    // });

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
   * DISABLED - now handled by VideoUIController
   */
  _setupYouTubeAutoLoad() {
    // OLD CODE - Now handled by VideoUIController.autoLoadSubtitles()
    // This method is disabled to prevent conflicts with the new loading system
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
  }
}

// Global instance
if (!window.heliosVideoFeature) {
  window.heliosVideoFeature = new VideoFeatureManager();
}
