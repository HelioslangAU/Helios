class ChineseLanguageLearningExtension {
  constructor() {
    this.activation = new ActivationController();
    this.textScanner = new TextScanner();
    this.highlightManager = null;
    this.dictionaryManager = null;
    this.vocabManager = null;
    this.frequencyManager = null;
    this.pageProcessor = null;
    this.popup = null;
    this.bannerManager = null;
    this.pronunciationManager = null;
    this.lookup = null;
    this.featureToggle = null;
    this.settings = null;
    this.asb = null;
    this.videoFeature = null;
    this.youtubeSidebar = null;
    this.languageRegistry = null;
    this.languageSwitchCoordinator = null;

    this.init();
  }

  async init() {
    console.log("🔍 Initializing Language Learning Extension...");

    // Initialize language registry first
    this.languageRegistry = new LanguageRegistry();
    this.languageRegistry.initializeDefaultAdapters();
    window.languageRegistry = this.languageRegistry;

    // Core managers
    this.dictionaryManager = new DictionaryManager(this.languageRegistry);
    this.vocabManager = new VocabManager();
    this.highlightManager = new HighlightManager();
    this.frequencyManager = new FrequencyManager();

    // Initialize language switch coordinator
    this.languageSwitchCoordinator = new LanguageSwitchCoordinator({
      languageRegistry: this.languageRegistry,
      dictionaryManager: this.dictionaryManager,
      pageProcessor: null, // Will be set later
      popup: null, // Will be set later
      vocabManager: this.vocabManager
    });

    // Load settings first to get target language
    this.settings = new SettingsSync({
      onLoaded: (s) => {
        const targetLanguage = s?.targetLanguage || 'en';
        console.log(`🌍 Loading extension with target language: ${targetLanguage}`);
        console.log('📋 All settings received:', s);
        this.languageRegistry.setLanguage(targetLanguage);
        this.vocabManager.setCurrentLanguage(targetLanguage);
        this.featureToggle?.applyInitial(s || {});
      },
      onToggled: (enabled) => {
        this.featureToggle?.setEnabled(enabled);
        if (enabled) this._registerScanner();
      },
      onSettingsUpdated: (s) => window.ContentSettingsApplier?.apply(this, s),
      onActivationKeyChanged: (key) => this.activation.setKey(key),
      onAutoHighlightChanged: (enabled) => this.featureToggle?.setAutoHighlight(enabled),
      onLanguageChanged: async (languageCode) => {
        console.log(`🔄 Language change requested: ${languageCode}`);
        // Use the coordinator for smooth language switching
        await this.languageSwitchCoordinator.switchLanguage(languageCode);
      }
    });
    await this.settings.load();

    // Ensure vocab manager has the correct language before loading
    const currentLang = this.languageRegistry.getCurrentLanguage();
    this.vocabManager.setCurrentLanguage(currentLang);
    console.log(`📚 Loading dictionary for language: ${currentLang}`);

    await Promise.all([
      this.dictionaryManager.loadDictionary(),
      this.vocabManager.loadKnownWords(),
      this.frequencyManager.loadFrequencyList(),
    ]);

    console.log(`✅ Dictionary and resources loaded successfully`);

    // Load extension enabled state EARLY before creating UI components
    // This prevents them from auto-showing if extension is disabled
    const currentSettings = await chrome.storage.local.get([
      'extensionEnabled',
      'activationKey',
      'autoHighlight'
    ]);
    const isExtensionEnabled = currentSettings.extensionEnabled !== false; // default to true

    console.log(`🔍 Extension enabled state: ${isExtensionEnabled}`, currentSettings);

    this.pageProcessor = new PageProcessor(this.dictionaryManager, this.vocabManager, this.languageRegistry);
    window.pageProcessor = this.pageProcessor;
    window.dictionaryManager = this.dictionaryManager;

    // Only create banner if extension is enabled (prevents unwanted page processing)
    if (isExtensionEnabled) {
      this.bannerManager = new BannerManager();
      window.bannerManager = this.bannerManager;
    } else {
      this.bannerManager = null;
      console.log('⏸️ Banner not created (extension disabled)');
    }

    window.vocabManager = this.vocabManager;
    window.languageRegistry = this.languageRegistry;

    this.pronunciationManager = new PronunciationManager(this.dictionaryManager, this.pageProcessor, this.languageRegistry);
    window.pronunciationManager = this.pronunciationManager;

    // Only start observing if extension is enabled
    if (isExtensionEnabled) {
      this.pronunciationManager.observeForDynamicContent();
    } else {
      console.log('⏸️ Pronunciation observer not started (extension disabled)');
    }

    this.popup = new MultiCardPopupManager({
      highlightManager: this.highlightManager,
      dictionaryManager: this.dictionaryManager,
      vocabManager: this.vocabManager,
      frequencyManager: this.frequencyManager,
      languageRegistry: this.languageRegistry,
    });
    window.popupManager = this.popup; // Expose for subtitle overlay
    window.highlightManager = this.highlightManager;

    // Update language switch coordinator with initialized components
    this.languageSwitchCoordinator.pageProcessor = this.pageProcessor;
    this.languageSwitchCoordinator.popup = this.popup;
    window.languageSwitchCoordinator = this.languageSwitchCoordinator;

    this.lookup = new LookupController({
      pageProcessor: this.pageProcessor,
      highlightManager: this.highlightManager,
      popup: this.popup,
      activation: this.activation,
    });

    // Initialize proprietary video player feature (but don't start if disabled)
    // (currentSettings already loaded above)
    if (window.heliosVideoFeature) {
      try {
        this.videoFeature = window.heliosVideoFeature;

        // Only start video detection if extension is enabled
        if (isExtensionEnabled) {
          await this.videoFeature.init();
          console.log("✅ Helios video player initialized");
        } else {
          console.log("⏸️ Helios video player not started (extension disabled)");
        }

        // Make accessible globally for debugging
        window.heliosVideo = this.videoFeature;

        // Initialize YouTube-specific sidebar only if extension is enabled
        if (isExtensionEnabled && (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be"))) {
          try {
            this.youtubeSidebar = new YouTubeSidebar();
            console.log("✅ YouTube sidebar initialized");
          } catch (error) {
            console.warn("⚠️ YouTube sidebar failed to initialize", error);
          }
        } else if (!isExtensionEnabled && (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be"))) {
          this.youtubeSidebar = null;
          console.log("⏸️ YouTube sidebar not created (extension disabled)");
        }
      } catch (error) {
        console.warn("⚠️ Helios video feature failed to initialize", error);
      }
    }

    // Initialize FeatureToggle with video features
    this.featureToggle = new FeatureToggle({
      activation: this.activation,
      textScanner: this.textScanner,
      bannerManager: this.bannerManager,
      pageProcessor: this.pageProcessor,
      popup: this.popup,
      pronunciationManager: this.pronunciationManager,
      videoFeature: this.videoFeature,
      youtubeSidebar: this.youtubeSidebar,
      parentExtension: this, // Pass reference to parent for updating references
    });

    // Apply initial settings (currentSettings already loaded above)
    this.featureToggle.applyInitial(currentSettings);

    // Register scanner only if extension is enabled
    if (isExtensionEnabled) {
      this._registerScanner();
    }

    // Keep ASB player integration as fallback (can be removed later)
    if (!this.videoFeature && window.location.hostname.includes("youtube.com")) {
      this.asb = new AsbplayerIntegration(this.pageProcessor);
      this.asb.start();
    }

    console.log("🔍 Language Learning Extension initialized successfully");
  }

  _registerScanner() {
    const onPointerMove = (e) => this.lookup.onPointerMove(e);
    const onKeyDown = (e) => {
      // Activation key
      const wasActive = this.activation.isActive();
      this.activation.handleKeyDown(e, {
        onActivate: () => {
          this.activation.toggleActivationMode(true);
          if (this.lookup.lastPointerEvent) {
            this.lookup.onPointerMove(this.lookup.lastPointerEvent);
          }
        },
      });
      // Ctrl+G for pronunciation
      if (
        e.ctrlKey &&
        e.key &&
        e.key.toLowerCase &&
        e.key.toLowerCase() === "g" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        this.pronunciationManager && this.pronunciationManager.togglePronunciation();
        return false;
      }
    };
    const onKeyUp = (e) => {
      this.activation.handleKeyUp(e, {
        onDeactivate: () => {
          this.activation.toggleActivationMode(false);
          this.lookup.onDeactivate();
        },
      });
    };
    const onSelectStart = (e) => this.activation.blockDuringActivation(e);
    const onContextMenu = (e) => this.activation.blockDuringActivation(e);
    const onClick = (e) => this.lookup.onClick(e);

    this.textScanner.register({
      onPointerMove,
      onKeyDown,
      onKeyUp,
      onSelectStart,
      onContextMenu,
      onClick,
    });
  }

  getStats() {
    if (typeof getStats === "function") {
      try { return getStats(this.dictionaryManager, this.vocabManager); } catch (_) {}
    }
    if (!this.dictionaryManager || !this.vocabManager) return null;
    const totalWords = Object.keys(this.dictionaryManager.dictionary || {}).length;
    const knownWords = this.vocabManager.knownWords?.size || 0;
    const unknownWordsOnPage = document.querySelectorAll('.chinese-unknown-word').length;
    return {
      totalWords,
      knownWords,
      unknownWordsOnPage,
      knowledgePercentage: totalWords > 0 ? ((knownWords / totalWords) * 100).toFixed(1) : 0,
    };
  }
}


// Initialize extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ChineseLanguageLearningExtension();
  });
} else {
  new ChineseLanguageLearningExtension();
}
