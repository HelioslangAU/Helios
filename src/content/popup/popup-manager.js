/**
 * PopupManager - Main popup orchestrator
 * Coordinates all popup components for basic single-definition popups
 */
class PopupManager {
  constructor({ highlightManager, dictionaryManager, vocabManager, frequencyManager, languageRegistry }) {
    this.highlightManager = highlightManager;
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.frequencyManager = frequencyManager;
    this.languageRegistry = languageRegistry;
    this.popup = null;
    this.isMouseOverPopup = false;
    this.isMouseOverHighlight = false;
    this.hideTimeout = null;
    this.capturedSentence = null;

    // Initialize external managers
    this.ankiManager = new AnkiManager();
    this.ankiManager.initialize(this.dictionaryManager);
    this.pronunciationManager = new PopupPronunciationManager();

    // Initialize internal components
    this.cardManager = new CardManager(this.dictionaryManager, new DefinitionFilter(), this.languageRegistry);

    // Initialize popup settings manager
    this.settingsManager = new PopupSettingsManager();
  }

  showDictionaryPopup(x, y, character, sentence) {
    // CRITICAL: Remove ALL existing popups immediately (synchronously)
    this.hidePopup();
    this.removeAllPopupsFromPage();

    this.capturedSentence = sentence;

    // Create popup element with correct size from the start
    const popup = PopupPositioner.createPopupElement(this.settingsManager.settings.popupFontSize);

    // Prepare data
    const dictionaryData = this.cardManager.prepareBasicPopupData(character);
    dictionaryData.isKnown = this.vocabManager.isWordKnown(character);
    dictionaryData.isIgnored = this.vocabManager.isWordIgnored(character);
    dictionaryData.frequency = this.frequencyManager?.getFrequency(character);

    // Build content
    const currentLanguage = this.languageRegistry.getCurrentLanguage();
    popup.innerHTML = PopupContentBuilder.createBasicContent(
      character,
      dictionaryData,
      this.vocabManager,
      this.frequencyManager,
      this.settingsManager.settings,
      currentLanguage
    );

    // Add to DOM and position
    document.body.appendChild(popup);
    const positioned = PopupPositioner.positionPopup(popup, this.highlightManager);

    if (!positioned) {
      return;
    }

    this.popup = popup;

    // Apply settings to the popup
    this.settingsManager.onPopupCreated(popup);

    // Remove creating class to enable transitions after initial setup
    popup.classList.remove('creating');

    // Track word lookup for recent vocabulary
    if (dictionaryData && dictionaryData.matches && dictionaryData.matches.length > 0) {
      this.vocabManager.trackWordLookup(character, dictionaryData.matches[0]);
    }

    // Setup event handlers
    const managers = {
      vocabManager: this.vocabManager,
      ankiManager: this.ankiManager,
      pronunciationManager: this.pronunciationManager,
      frequencyManager: this.frequencyManager,
      dictionaryManager: this.dictionaryManager,
      popupManager: this,
      settingsManager: this.settingsManager
    };

    PopupEventHandler.setupEvents(popup, character, managers, { isMultiCard: false });
  }

  scheduleHidePopup() {
    clearTimeout(this.hideTimeout);

    // Check if persistent mode is enabled
    if (this.settingsManager.shouldPreventAutoHide()) {
      return; // Don't auto-hide in persistent mode
    }

    this.hideTimeout = setTimeout(() => {
      if (!this.isMouseOverPopup && !this.isMouseOverHighlight) {
        this.hidePopup();
        this.highlightManager.removeLookupHighlight();
      }
    }, 50);
  }

  hidePopup(event) {
    if (!this.popup) return;

    if (event && this.popup.contains(event.target)) {
      return;
    }

    // Clear any pending hide timeouts
    clearTimeout(this.hideTimeout);

    // Immediately hide popup SYNCHRONOUSLY
    this.settingsManager.onPopupDestroyed();

    // Remove popup IMMEDIATELY (not async)
    if (this.popup && this.popup.parentNode) {
      this.popup.remove();
    }
    this.popup = null;
    this.isMouseOverPopup = false;
  }

  // Remove ALL popups from the page (nuclear option to prevent stacking)
  removeAllPopupsFromPage() {
    const allPopups = document.querySelectorAll('.chinese-lang-extension-popup');
    allPopups.forEach(popup => {
      if (popup.parentNode) {
        popup.remove();
      }
    });

    // Also clear our reference
    this.popup = null;
    this.isMouseOverPopup = false;
  }
  incrementSessionCounter() {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["todayLookupCount", "lastResetDate"], (result) => {
        const today = new Date().toDateString();
        const lastReset = result.lastResetDate || "";
        let lookupCount = result.todayLookupCount || 0;

        if (lastReset !== today) {
          lookupCount = 0;
        }

        lookupCount++;
        chrome.storage.local.set({
          todayLookupCount: lookupCount,
          lastResetDate: today,
        });
      });
    }
  }
}