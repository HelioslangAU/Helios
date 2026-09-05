import { BannerManager } from '@/content/banner-manager';
import { provideServices } from '@/content/services';
import { YouTubeSidebar } from '@/content/youtube-sidebar';
import type { ActivationController } from '@/content/utils/activation-controller';
import type { TextScanner } from '@/content/utils/text-scanner';

interface FeatureToggleDeps {
  activation: ActivationController;
  textScanner?: TextScanner;
  pageProcessor?: any;
  popup?: any;
  sidebarManager?: any;
  pronunciationManager?: any;
  bannerManager?: BannerManager | null;
  videoFeature?: any;
  youtubeSidebar?: YouTubeSidebar | null;
  parentExtension?: any;
}

interface FeatureToggleSettings {
  extensionEnabled?: boolean;
  autoHighlight?: boolean;
  activationKey?: string;
}

// constructor: add bannerManager and store it
export class FeatureToggle {
  activation: ActivationController;
  textScanner: TextScanner | undefined;
  pageProcessor: any;
  popup: any;
  sidebarManager: any;
  pronunciationManager: any;
  bannerManager: BannerManager | null | undefined;
  videoFeature: any;
  youtubeSidebar: YouTubeSidebar | null | undefined;
  parentExtension: any;
  extensionEnabled: boolean;
  autoHighlight: boolean;

  constructor({ activation, textScanner, pageProcessor, popup, sidebarManager, pronunciationManager, bannerManager, videoFeature, youtubeSidebar, parentExtension }: FeatureToggleDeps) {
    this.activation = activation;
    this.textScanner = textScanner;
    this.pageProcessor = pageProcessor;
    this.popup = popup;
    this.sidebarManager = sidebarManager;
    this.pronunciationManager = pronunciationManager;
    this.bannerManager = bannerManager;
    this.videoFeature = videoFeature;
    this.youtubeSidebar = youtubeSidebar;
    this.parentExtension = parentExtension; // Reference to parent extension
    this.extensionEnabled = true;
    this.autoHighlight = true;
  }

  applyInitial(settings: FeatureToggleSettings = {}): void {
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

  setEnabled(enabled: boolean): void {
    this.extensionEnabled = enabled;
    if (enabled) this.enable(); else this.disable();
  }

  setAutoHighlight(enabled: boolean): void {
    this.autoHighlight = enabled;
    // autoHighlight is only read when enable() runs, so re-apply the highlight
    // pass here instead of waiting for the next enable/disable cycle.
    if (this.pageProcessor && this.pageProcessor.handleAutoHighlightUpdate) {
      this.pageProcessor.handleAutoHighlightUpdate(this.autoHighlight, this.extensionEnabled);
    }
  }

  enable(): void {
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
      provideServices({ bannerManager: this.bannerManager });
      if (this.parentExtension) {
        this.parentExtension.bannerManager = this.bannerManager;
      }
      console.log('✨ Banner created on re-enable');
    } else if (this.bannerManager) {
      this.bannerManager.showBanner();
    }

    // Restart pronunciation observer if it wasn't started on load
    if (this.pronunciationManager && this.pronunciationManager.observeForDynamicContent) {
      this.pronunciationManager.observeForDynamicContent();
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
      }).catch((error: any) => {
        console.warn('⚠️ Failed to initialize video feature on re-enable', error);
      });
    } else if (this.videoFeature && this.videoFeature.videoDetector) {
      // Restart video detection if already initialized
      this.videoFeature.videoDetector.start();

      // Check if overlays were destroyed - if so, re-detect videos to recreate them
      const bindings = this.videoFeature.videoDetector.getAllBindings();
      if (bindings.length === 0) {
        // No bindings exist - trigger video detection to recreate overlays
        this.videoFeature.videoDetector._detectVideos();
      } else {
        // Show existing video overlays if they exist
        bindings.forEach((binding: any) => {
          if (binding.overlay && binding.overlay.container) {
            binding.overlay.container.style.display = '';
          }
        });
      }

      // Auto-load subtitles if on YouTube
      if (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be")) {
        document.dispatchEvent(new CustomEvent('helios-autoload-youtube-subtitles'));
      }
    }
  }

  disable(): void {
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
    this.pronunciationManager && this.pronunciationManager.destroy && this.pronunciationManager.destroy();

    // Disable video features
    if (this.youtubeSidebar && this.youtubeSidebar.hide) {
      this.youtubeSidebar.hide();
    }

    // Stop video detection and destroy all video overlays (including keyboard listeners)
    if (this.videoFeature && this.videoFeature.videoDetector) {
      // Stop the video detection timer (critical!)
      this.videoFeature.videoDetector.stop();

      // Destroy all video overlays (removes keyboard listeners and cleans up)
      const bindings = this.videoFeature.videoDetector.getAllBindings();
      bindings.forEach((binding: any) => {
        if (binding.overlay) {
          // Hide the overlay
          if (binding.overlay.container) {
            binding.overlay.container.style.display = 'none';
          }
          // Destroy to remove all event listeners including keyboard shortcuts
          if (binding.overlay.destroy) {
            binding.overlay.destroy();
          }
        }
      });

      // Clear all bindings
      if (this.videoFeature.videoDetector.clearAllBindings) {
        this.videoFeature.videoDetector.clearAllBindings();
      }
    }

    // Destroy YouTube-specific video features
    if (this.videoFeature && this.videoFeature.youtubeLoader) {
      if (this.videoFeature.youtubeLoader.destroy) {
        this.videoFeature.youtubeLoader.destroy();
      }
    }
  }
}
