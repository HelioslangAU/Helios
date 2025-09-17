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
    this.pinyinManager = null;
    this.lookup = null;
    this.featureToggle = null;
    this.settings = null;
    this.asb = null;

    this.init();
  }

  async init() {
    console.log("🔍 Initializing Chinese Language Learning Extension...");

    // Core managers
    this.dictionaryManager = new DictionaryManager();
    this.vocabManager = new VocabManager();
    this.highlightManager = new HighlightManager();
    this.frequencyManager = new FrequencyManager();

    await Promise.all([
      this.dictionaryManager.loadDictionary(),
      this.vocabManager.loadKnownWords(),
      this.frequencyManager.loadFrequencyList(),
    ]);

    this.pageProcessor = new PageProcessor(this.dictionaryManager, this.vocabManager);
    window.pageProcessor = this.pageProcessor;
    this.bannerManager = new BannerManager();
    window.bannerManager = this.bannerManager;
    window.vocabManager = this.vocabManager;

    this.pinyinManager = new PinyinManager(this.dictionaryManager, this.pageProcessor);
    this.pinyinManager.observeForDynamicContent();

    this.popup = new MultiCardPopupManager({
      highlightManager: this.highlightManager,
      dictionaryManager: this.dictionaryManager,
      vocabManager: this.vocabManager,
      frequencyManager: this.frequencyManager,
    });
    window.highlightManager = this.highlightManager;

    this.lookup = new LookupController({
      pageProcessor: this.pageProcessor,
      highlightManager: this.highlightManager,
      popup: this.popup,
      activation: this.activation,
    });

    this.featureToggle = new FeatureToggle({
      activation: this.activation,
      textScanner: this.textScanner,
      pageProcessor: this.pageProcessor,
      popup: this.popup,
      bannerManager: this.bannerManager,
      pinyinManager: this.pinyinManager,
    });

    this.settings = new SettingsSync({
      onLoaded: (s) => this.featureToggle.applyInitial(s || {}),
      onToggled: (enabled) => {
        this.featureToggle.setEnabled(enabled);
        if (enabled) this._registerScanner();
      },
      onSettingsUpdated: (s) => window.ContentSettingsApplier?.apply(this, s),
      onActivationKeyChanged: (key) => this.activation.setKey(key),
      onAutoHighlightChanged: (enabled) => this.featureToggle.setAutoHighlight(enabled),
    });
    await this.settings.load();

    this._registerScanner();

    this.asb = new AsbplayerIntegration(this.pageProcessor);
    this.asb.start();

    console.log("🔍 Chinese Language Learning Extension initialized successfully");
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
      // Ctrl+G for pinyin
      if (
        e.ctrlKey &&
        e.key &&
        e.key.toLowerCase &&
        e.key.toLowerCase() === "g" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        this.pinyinManager && this.pinyinManager.togglePinyin();
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
