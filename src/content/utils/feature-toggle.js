class FeatureToggle {
  constructor({ activation, textScanner, pageProcessor, popup, bannerManager, pinyinManager }) {
    this.activation = activation;
    this.textScanner = textScanner;
    this.pageProcessor = pageProcessor;
    this.popup = popup;
    this.bannerManager = bannerManager;
    this.pinyinManager = pinyinManager;
    this.extensionEnabled = true;
    this.autoHighlight = true;
  }

  applyInitial(settings = {}) {
    this.extensionEnabled = settings.extensionEnabled ?? true;
    this.autoHighlight = settings.autoHighlight ?? true;
    if (settings.activationKey) this.activation.setKey(settings.activationKey);
    if (this.extensionEnabled) {
      this.enable();
    }
  }

  setEnabled(enabled) {
    this.extensionEnabled = enabled;
    if (enabled) this.enable(); else this.disable();
  }

  setAutoHighlight(enabled) {
    this.autoHighlight = enabled;
    this.pageProcessor.handleAutoHighlightUpdate(enabled, this.extensionEnabled);
  }

  enable() {
    if (this.autoHighlight) {
      this.pageProcessor.processPageForUnknownWords();
    }
    this.bannerManager && this.bannerManager.showBanner && this.bannerManager.showBanner();
  }

  disable() {
    this.textScanner && this.textScanner.unregister();
    this.popup && this.popup.hidePopup && this.popup.hidePopup();
    this.pageProcessor && this.pageProcessor.clearHighlights && this.pageProcessor.clearHighlights();
    this.bannerManager && this.bannerManager.hideBanner && this.bannerManager.hideBanner();
    this.pinyinManager && this.pinyinManager.destroy && this.pinyinManager.destroy();
  }
}


