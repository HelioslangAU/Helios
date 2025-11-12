// constructor: add bannerManager and store it
class FeatureToggle {
  constructor({ activation, textScanner, pageProcessor, popup, sidebarManager, pinyinManager, bannerManager, videoFeature, youtubeSidebar, parentExtension }) {
    this.activation = activation;
    this.textScanner = textScanner;
    this.pageProcessor = pageProcessor;
    this.popup = popup;
    this.sidebarManager = sidebarManager;
    this.pinyinManager = pinyinManager;
    this.bannerManager = bannerManager;
    this.videoFeature = videoFeature;
    this.youtubeSidebar = youtubeSidebar;
    this.parentExtension = parentExtension; // Reference to parent extension
    this.extensionEnabled = true;
    this.autoHighlight = true;
  }

  applyInitial(settings = {}) {
    this.extensionEnabled = settings.extensionEnabled ?? true;
    this.autoHighlight = settings.autoHighlight ?? true;
    if (settings.activationKey) this.activation.setKey(settings.activationKey);

    console.log(`🎚️ FeatureToggle.applyInitial - enabled: ${this.extensionEnabled}, autoHighlight: ${this.autoHighlight}`);

    if (this.extensionEnabled) {
      this.enable();
    } else {
      this.disable(); // ensure banner and other UI are hidden on startup
    }
  }

  setEnabled(enabled) {
    this.extensionEnabled = enabled;
    if (enabled) this.enable(); else this.disable();
  }

  enable() {
    // Re-enable page processing
    if (this.pageProcessor && this.pageProcessor.startProcessing) {
      this.pageProcessor.startProcessing();
    }

    if (this.autoHighlight) {
      this.pageProcessor.processPageForUnknownWords();
    }
    this.sidebarManager && this.sidebarManager.showSidebar && this.sidebarManager.showSidebar();

    // Create banner if it doesn't exist (was disabled on load)
    if (!this.bannerManager && typeof BannerManager !== 'undefined') {
      this.bannerManager = new BannerManager();
      window.bannerManager = this.bannerManager;
      if (this.parentExtension) {
        this.parentExtension.bannerManager = this.bannerManager;
      }
      console.log('✨ Banner created on re-enable');
    } else if (this.bannerManager) {
      this.bannerManager.showBanner();
    }

    // Restart pronunciation observer if it wasn't started on load
    if (this.pinyinManager && this.pinyinManager.observeForDynamicContent) {
      this.pinyinManager.observeForDynamicContent();
    }

    // Re-enable video features if on YouTube
    if (this.youtubeSidebar && this.youtubeSidebar.isWatchPage && this.youtubeSidebar.isWatchPage()) {
      this.youtubeSidebar.show();
    }

    // Create YouTube sidebar if it doesn't exist (was disabled on load)
    if (!this.youtubeSidebar && typeof YouTubeSidebar !== 'undefined' &&
        (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be"))) {
      try {
        this.youtubeSidebar = new YouTubeSidebar();
        if (this.parentExtension) {
          this.parentExtension.youtubeSidebar = this.youtubeSidebar;
        }
        console.log('✨ YouTube sidebar created on re-enable');
      } catch (error) {
        console.warn('⚠️ Failed to create YouTube sidebar on re-enable', error);
      }
    }

    // Initialize video feature if it wasn't initialized (was disabled on load)
    if (this.videoFeature && !this.videoFeature.isInitialized) {
      this.videoFeature.init().then(() => {
        console.log('✨ Video feature initialized on re-enable');

        // Auto-load subtitles if on YouTube
        if (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be")) {
          // Trigger auto-load event
          document.dispatchEvent(new CustomEvent('helios-autoload-youtube-subtitles'));
        }
      }).catch(error => {
        console.warn('⚠️ Failed to initialize video feature on re-enable', error);
      });
    } else if (this.videoFeature && this.videoFeature.videoDetector) {
      // Just restart video detection if already initialized
      this.videoFeature.videoDetector.start();

      // Show existing video overlays
      const bindings = this.videoFeature.videoDetector.getAllBindings();
      bindings.forEach(binding => {
        if (binding.overlay && binding.overlay.container) {
          binding.overlay.container.style.display = '';
        }
      });

      // Auto-load subtitles if on YouTube
      if (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be")) {
        document.dispatchEvent(new CustomEvent('helios-autoload-youtube-subtitles'));
      }
    }
  }

  disable() {
    // Remove all event listeners
    this.textScanner && this.textScanner.unregister();

    // Stop all page processing and disconnect observers
    if (this.pageProcessor && this.pageProcessor.stopProcessing) {
      this.pageProcessor.stopProcessing();
    } else if (this.pageProcessor && this.pageProcessor.clearHighlights) {
      // Fallback for older code
      this.pageProcessor.clearHighlights();
    }

    // Hide and cleanup UI elements
    this.popup && this.popup.hidePopup && this.popup.hidePopup();
    this.sidebarManager && this.sidebarManager.hideSidebar && this.sidebarManager.hideSidebar();
    this.bannerManager && this.bannerManager.hideBanner && this.bannerManager.hideBanner();

    // Destroy pronunciation manager (removes observers and pronunciation)
    this.pinyinManager && this.pinyinManager.destroy && this.pinyinManager.destroy();

    // Disable video features
    if (this.youtubeSidebar && this.youtubeSidebar.hide) {
      this.youtubeSidebar.hide();
    }

    // Stop video detection and hide all video overlays
    if (this.videoFeature && this.videoFeature.videoDetector) {
      // Stop the video detection timer (critical!)
      this.videoFeature.videoDetector.stop();

      // Hide all video overlays
      const bindings = this.videoFeature.videoDetector.getAllBindings();
      bindings.forEach(binding => {
        if (binding.overlay && binding.overlay.container) {
          binding.overlay.container.style.display = 'none';
        }
      });
    }
  }
}