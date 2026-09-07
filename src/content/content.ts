import { AnkiManager } from '@/content/anki-manager';
import { BannerManager } from '@/content/banner-manager';
import { DictionaryManagerProxy } from '@/content/dictionary-bridge';
import { FrequencyManager } from '@/content/frequency-manager';
import { LanguageRegistry } from '@/content/languages/language-registry';
import { PageProcessor } from '@/content/page-processor';
import { MultiCardPopupManager } from '@/content/popup/multi-card-popup-manager';
import { PronunciationManager } from '@/content/pronunciation-manager';
import { provideServices, services } from '@/content/services';
import { SettingsSync } from '@/content/settings/settings-sync';
import { HighlightManager } from '@/content/text-highlighter';
import { ActivationController } from '@/content/utils/activation-controller';
import { AsbplayerIntegration } from '@/content/utils/asbplayer-integration';
import { FeatureToggle } from '@/content/utils/feature-toggle';
import { LanguageSwitchCoordinator } from '@/content/utils/language-switch-coordinator';
import { LookupController } from '@/content/utils/lookup-controller';
import { TextScanner } from '@/content/utils/text-scanner';
import { VocabManager } from '@/content/vocab-manager';
import { YouTubeSidebar } from '@/content/youtube-sidebar';
import type { VideoFeatureManager } from '@/content/video/video-feature-manager';
import { items, storage } from '@/config/storage';
import { browser } from 'wxt/browser';

export class ChineseLanguageLearningExtension {
  activation: ActivationController;
  textScanner: TextScanner;
  highlightManager: HighlightManager | null;
  dictionaryManager: DictionaryManagerProxy | null;
  vocabManager: VocabManager | null;
  frequencyManager: FrequencyManager | null;
  pageProcessor: PageProcessor | null;
  popup: MultiCardPopupManager | null;
  bannerManager: BannerManager | null;
  pronunciationManager: PronunciationManager | null;
  lookup: LookupController | null;
  featureToggle: FeatureToggle | null;
  settings: SettingsSync | null;
  asb: AsbplayerIntegration | null;
  videoFeature: VideoFeatureManager | null;
  youtubeSidebar: YouTubeSidebar | null;
  languageRegistry: LanguageRegistry | null;
  languageSwitchCoordinator: LanguageSwitchCoordinator | null;
  /** Whether this page currently has Helios running on it. */
  isRunning: boolean;

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
    this.isRunning = false;

    // Both directions, always. This used to live inside the disabled branch
    // of init(), so a page that loaded while Helios was on never learned it
    // had been switched off: the highlights, the hover lookup and the side tab
    // all carried on until the tab was reloaded.
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes.extensionEnabled) return;
      if (changes.extensionEnabled.newValue === false) {
        this.disable();
      } else if (changes.extensionEnabled.newValue === true && !this.isRunning) {
        void this.start();
      }
    });

    void this.start();
  }

  /** Run init and keep its failure from becoming an unhandled rejection. */
  start(): Promise<void> {
    return this.init().catch((error) => {
      console.error('🔍 Helios failed to initialize on this page:', error);
    });
  }

  async init(): Promise<void> {
    // CHECK IF EXTENSION IS DISABLED FIRST - don't initialize anything if off
    const isExtensionEnabled = await items.extensionEnabled.getValue();

    if (!isExtensionEnabled) {
      console.log("⏸️ Extension is disabled - skipping initialization");
      return; // EXIT EARLY - don't initialize anything
    }

    this.isRunning = true;

    console.log("🔍 Initializing Language Learning Extension...");

    // Initialize language registry first
    this.languageRegistry = new LanguageRegistry();

    // Get target language first, then initialize only that adapter
    const targetLanguage = await items.targetLanguage.getValue() || 'zh'; // default to Chinese

    // Initialize only the target language adapter for better performance
    this.languageRegistry.initializeLanguageAdapter(targetLanguage);
    if (targetLanguage) {
      this.languageRegistry.setLanguage(targetLanguage);
    }

    provideServices({ languageRegistry: this.languageRegistry });

    // Core managers - use DictionaryManagerProxy for offscreen dictionary
    this.dictionaryManager = new DictionaryManagerProxy(this.languageRegistry);
    this.vocabManager = new VocabManager();
    this.highlightManager = new HighlightManager();
    this.frequencyManager = new FrequencyManager();

    // Initialize language switch coordinator
    this.languageSwitchCoordinator = new LanguageSwitchCoordinator({
      languageRegistry: this.languageRegistry,
      dictionaryManager: this.dictionaryManager,
      pageProcessor: null as any, // Will be set later
      popup: null, // Will be set later
      vocabManager: this.vocabManager
    });

    // Load settings first to get target language
    this.settings = new SettingsSync({
      onLoaded: (s: any) => {
        const targetLanguage = s?.targetLanguage;
        console.log(`🌍 Loading extension with target language: ${targetLanguage}`);
        console.log('📋 All settings received:', s);
        this.languageRegistry!.setLanguage(targetLanguage);
        this.vocabManager!.setCurrentLanguage(targetLanguage);
        this.featureToggle?.applyInitial(s || {});
      },
      onToggled: (enabled: boolean) => {
        this.featureToggle?.setEnabled(enabled);
        if (enabled) this._registerScanner();
      },
      onSettingsUpdated: (s: any) => window.ContentSettingsApplier?.apply(this, s),
      onActivationKeyChanged: (key: string) => this.activation.setKey(key),
      onAutoHighlightChanged: (enabled: boolean) => this.featureToggle?.setAutoHighlight(enabled),
      onLanguageChanged: async (languageCode: string) => {
        console.log(`🔄 Language change requested: ${languageCode}`);
        // Use the coordinator for smooth language switching
        await this.languageSwitchCoordinator!.switchLanguage(languageCode);
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
      ankiManager.checkAnkiConnect().catch((error: unknown) => {
        console.warn("🃏 Anki connection check failed:", error);
      });
      provideServices({ ankiManager });
    }

    // Extension is enabled if we got here - create all components
    this.pageProcessor = new PageProcessor(this.dictionaryManager, this.vocabManager, this.languageRegistry);
    provideServices({ pageProcessor: this.pageProcessor, dictionaryManager: this.dictionaryManager });

    this.bannerManager = new BannerManager();
    provideServices({ bannerManager: this.bannerManager });

    provideServices({ vocabManager: this.vocabManager, languageRegistry: this.languageRegistry });

    this.pronunciationManager = new PronunciationManager(this.dictionaryManager, this.pageProcessor, this.languageRegistry);
    provideServices({ pronunciationManager: this.pronunciationManager });
    this.pronunciationManager.observeForDynamicContent();

    this.popup = new MultiCardPopupManager({
      highlightManager: this.highlightManager,
      dictionaryManager: this.dictionaryManager,
      vocabManager: this.vocabManager,
      frequencyManager: this.frequencyManager,
      languageRegistry: this.languageRegistry,
    });
    provideServices({ popupManager: this.popup, highlightManager: this.highlightManager });

    // Update language switch coordinator with initialized components
    this.languageSwitchCoordinator.pageProcessor = this.pageProcessor;
    this.languageSwitchCoordinator.popup = this.popup;

    this.lookup = new LookupController({
      pageProcessor: this.pageProcessor,
      highlightManager: this.highlightManager,
      popup: this.popup,
      activation: this.activation,
    });

    // Initialize proprietary video player feature (but don't start if disabled)
    if (services.videoFeature) {
      try {
        this.videoFeature = services.videoFeature;
        await this.videoFeature.init();
        console.log("✅ Helios video player initialized");

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
    const [activationKey, autoHighlight] = await storage.getItems([
      items.activationKey,
      items.autoHighlight,
    ]);

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
    this.featureToggle.applyInitial({
      activationKey: activationKey.value as string,
      autoHighlight: autoHighlight.value as boolean,
      extensionEnabled: true,
    });

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

  /**
   * Stop everything this page has running.
   *
   * Turning Helios off has to mean nothing is left working in the background,
   * not merely that the popup says so: the pointer and key listeners come off,
   * the marks come off the words, the side tab and any open card close, and
   * the video features shut down. What survives is storage — the vocabulary is
   * the durable asset and is never touched by a toggle.
   */
  disable(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log("⏸️ Extension disabled - shutting this page down");

    // Hover lookup and the activation key.
    this.textScanner.unregister();
    this.activation.toggleActivationMode(false);

    // Any card still open, and the lookup highlight under it.
    this.popup?.hidePopup?.();
    this.popup?.removeAllPopupsFromPage?.();
    this.highlightManager?.removeLookupHighlight?.();

    // Observers and timers that would keep re-processing the page.
    this.pageProcessor?.cleanup?.();
    this.videoFeature?.destroy?.();
    this.youtubeSidebar?.destroy?.();

    // The comprehension side tab.
    this.bannerManager?.hideBanner?.();

    // The marks themselves. These are the classes page-processor.ts actually
    // writes; the coordinator's own clear routine still names an older set and
    // removes nothing.
    for (const el of document.querySelectorAll(
      '.lang-unknown-word, .lang-learning-word, .chinese-unknown-word',
    )) {
      el.classList.remove(
        'lang-unknown-word',
        'lang-learning-word',
        'chinese-unknown-word',
      );
    }
  }

  _registerScanner(): void {
    const onPointerMove = (e: PointerEvent) => this.lookup!.onPointerMove(e);
    const onKeyDown = (e: KeyboardEvent) => {
      // Activation key
      const wasActive = this.activation.isActive();
      this.activation.handleKeyDown(e, {
        onActivate: () => {
          this.activation.toggleActivationMode(true);
          if (this.lookup!.lastPointerEvent) {
            this.lookup!.onPointerMove(this.lookup!.lastPointerEvent);
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
    const onKeyUp = (e: KeyboardEvent) => {
      this.activation.handleKeyUp(e, {
        onDeactivate: () => {
          this.activation.toggleActivationMode(false);
          this.lookup!.onDeactivate();
        },
      });
    };
    const onSelectStart = (e: Event) => this.activation.blockDuringActivation(e);
    const onContextMenu = (e: Event) => this.activation.blockDuringActivation(e);
    const onClick = (e: MouseEvent) => this.lookup!.onClick(e);

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
    if (!this.dictionaryManager || !this.vocabManager) return null;
    const totalWords = Object.keys(this.dictionaryManager.dictionary || {}).length;
    const knownWords = this.vocabManager.getKnownWordsCount();
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
