/**
 * Controls the subtitle list panel and synchronizes with video
 */
class SubtitlePanelController {
  constructor(videoDetector) {
    this.videoDetector = videoDetector;
    this.panel = null;
    this.currentBinding = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the panel controller
   */
  init() {
    if (this.isInitialized) return;

    this.panel = new SubtitleListPanel();

    // Setup subtitle click handler (seek video)
    this.panel.onSubtitleClick = (subtitle) => {
      if (this.currentBinding) {
        this.currentBinding.seekTo(subtitle.start);
      }
    };

    // Listen for subtitle load events
    this._setupEventListeners();

    this.isInitialized = true;
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // When subtitles are loaded
    document.addEventListener('helios-subtitles-loaded', (e) => {
      const { binding } = e.detail;
      this.currentBinding = binding;

      const collection = binding.getSubtitles();
      this.panel.loadSubtitles(collection);
      this.panel.show();
    });

    // Update current time
    document.addEventListener('helios-video-timeupdate', (e) => {
      const { currentTime, binding } = e.detail;

      if (binding === this.currentBinding) {
        this.panel.updateCurrentTime(currentTime);
      }
    });

    // Listen for subtitle selection from overlay
    document.addEventListener('helios-subtitle-selection', (e) => {
      const { text, position } = e.detail;
      // This will integrate with your existing lookup system
      console.log('[Helios Video] Subtitle text selected:', text);
    });
  }

  /**
   * Show the panel
   */
  show() {
    if (this.panel) {
      this.panel.show();
    }
  }

  /**
   * Hide the panel
   */
  hide() {
    if (this.panel) {
      this.panel.hide();
    }
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.panel) {
      this.panel.toggle();
    }
  }

  /**
   * Destroy the controller
   */
  destroy() {
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
    this.isInitialized = false;
  }
}