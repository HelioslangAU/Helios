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
    // CHECK IF EXTENSION IS DISABLED FIRST - don't initialize anything if off
    const enabledCheck = await chrome.storage.local.get(['extensionEnabled']);
    const isExtensionEnabled = enabledCheck.extensionEnabled !== false; // default to true

    if (!isExtensionEnabled) {
      console.log("⏸️ Extension is disabled - skipping initialization");

      // Set up listener to initialize when extension gets enabled
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.extensionEnabled && changes.extensionEnabled.newValue === true) {
          console.log("▶️ Extension enabled - initializing now...");
          // Re-run initialization
          this.init();
        }
      });

      return; // EXIT EARLY - don't initialize anything
    }

    // Inject font links to ensure Montserrat loads properly
    this._injectFontLinks();

    console.log("🔍 Initializing Language Learning Extension...");

    // Initialize language registry first
    this.languageRegistry = new LanguageRegistry();
    
    // Get target language first, then initialize only that adapter
    const settingsCheck = await chrome.storage.local.get(['targetLanguage']);
    const targetLanguage = settingsCheck.targetLanguage || 'zh'; // default to Chinese
    
    // Initialize only the target language adapter for better performance
    this.languageRegistry.initializeLanguageAdapter(targetLanguage);
    if (targetLanguage) {
      this.languageRegistry.setLanguage(targetLanguage);
    }
    
    window.languageRegistry = this.languageRegistry;

    // Core managers - use DictionaryManagerProxy for offscreen dictionary
    this.dictionaryManager = new DictionaryManagerProxy(this.languageRegistry);
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
        const targetLanguage = s?.targetLanguage;
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
    console.log(`📚 Checking dictionary for language: ${currentLang}`);

    // Load dictionary (will skip if already loaded in offscreen)
    // Dictionary persists in offscreen document across page reloads
    await Promise.all([
      this.dictionaryManager.loadDictionary(),
      this.vocabManager.loadKnownWords(),
      this.frequencyManager.loadFrequencyList(),
    ]);

    console.log(`✅ Dictionary and resources ready`);

    // Initialize AnkiManager - sync will trigger automatically when connection is detected
    if (window.AnkiManager) {
      const ankiManager = new AnkiManager();
      ankiManager.initialize(this.dictionaryManager);
      // Check connection (will trigger sync if connected and not already synced)
      ankiManager.checkAnkiConnect().catch(error => {
        console.warn("🃏 Anki connection check failed:", error);
      });
    }

    // Extension is enabled if we got here - create all components
    this.pageProcessor = new PageProcessor(this.dictionaryManager, this.vocabManager, this.languageRegistry);
    window.pageProcessor = this.pageProcessor;
    window.dictionaryManager = this.dictionaryManager;

    this.bannerManager = new BannerManager();
    window.bannerManager = this.bannerManager;
    window.sidebarManager = this.bannerManager;

    window.vocabManager = this.vocabManager;
    window.languageRegistry = this.languageRegistry;

    this.pronunciationManager = new PronunciationManager(this.dictionaryManager, this.pageProcessor, this.languageRegistry);
    window.pronunciationManager = this.pronunciationManager;
    this.pronunciationManager.observeForDynamicContent();

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
        await this.videoFeature.init();
        console.log("✅ Helios video player initialized");

        // Make accessible globally for debugging
        window.heliosVideo = this.videoFeature;

        // Initialize YouTube-specific sidebar
        if (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be")) {
          try {
            this.youtubeSidebar = new YouTubeSidebar();
            console.log("✅ YouTube sidebar initialized");
          } catch (error) {
            console.warn("⚠️ YouTube sidebar failed to initialize", error);
          }
        }
      } catch (error) {
        console.warn("⚠️ Helios video feature failed to initialize", error);
      }
    }

    // Load current settings for feature toggle
    const currentSettings = await chrome.storage.local.get(['activationKey', 'autoHighlight']);

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

    // Apply initial settings (extension is enabled if we got here)
    this.featureToggle.applyInitial({ ...currentSettings, extensionEnabled: true });

    // Register scanner
    {
      this._registerScanner();
    }

    // Keep ASB player integration as fallback (can be removed later)
    if (!this.videoFeature && window.location.hostname.includes("youtube.com")) {
      this.asb = new AsbplayerIntegration(this.pageProcessor);
      this.asb.start();
    }

    console.log("🔍 Language Learning Extension initialized successfully");
  }

  _injectFontLinks() {
    // Check if fonts are already injected
    if (document.getElementById('helios-montserrat-font')) {
      return; // Already injected
    }

    // Inject Montserrat font link
    const montserratLink = document.createElement('link');
    montserratLink.id = 'helios-montserrat-font';
    montserratLink.rel = 'stylesheet';
    montserratLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(montserratLink);

    // Also inject Inter font (for Chinese)
    if (!document.getElementById('helios-inter-font')) {
      const interLink = document.createElement('link');
      interLink.id = 'helios-inter-font';
      interLink.rel = 'stylesheet';
      interLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
      document.head.appendChild(interLink);
    }
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
