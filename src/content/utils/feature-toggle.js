// constructor: add bannerManager and store it
class FeatureToggle {
  constructor({ activation, textScanner, pageProcessor, popup, sidebarManager, pinyinManager, bannerManager }) {
    this.activation = activation;
    this.textScanner = textScanner;
    this.pageProcessor = pageProcessor;
    this.popup = popup;
    this.sidebarManager = sidebarManager;
    this.pinyinManager = pinyinManager;
    this.bannerManager = bannerManager;
    this.extensionEnabled = true;
    this.autoHighlight = true;
  }

  applyInitial(settings = {}) {
    this.extensionEnabled = settings.extensionEnabled ?? true;
    this.autoHighlight = settings.autoHighlight ?? true;
    if (settings.activationKey) this.activation.setKey(settings.activationKey);
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
    if (this.autoHighlight) {
      this.pageProcessor.processPageForUnknownWords();
    }
    this.sidebarManager && this.sidebarManager.showSidebar && this.sidebarManager.showSidebar();
    this.bannerManager && this.bannerManager.showBanner && this.bannerManager.showBanner();
  }

  disable() {
    this.textScanner && this.textScanner.unregister();
    this.popup && this.popup.hidePopup && this.popup.hidePopup();
    this.pageProcessor && this.pageProcessor.clearHighlights && this.pageProcessor.clearHighlights();
    this.sidebarManager && this.sidebarManager.hideSidebar && this.sidebarManager.hideSidebar();
    this.pinyinManager && this.pinyinManager.destroy && this.pinyinManager.destroy();
    this.bannerManager && this.bannerManager.hideBanner && this.bannerManager.hideBanner();
  }
}