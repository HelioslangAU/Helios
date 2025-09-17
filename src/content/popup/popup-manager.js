/**
 * PopupManager - Main popup orchestrator
 * Coordinates all popup components for basic single-definition popups
 */
class PopupManager {
  constructor({ highlightManager, dictionaryManager, vocabManager, frequencyManager }) {
    this.highlightManager = highlightManager;
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.frequencyManager = frequencyManager;
    this.popup = null;
    this.isMouseOverPopup = false;
    this.isMouseOverHighlight = false;
    this.hideTimeout = null;
    this.capturedSentence = null;

    // Initialize external managers
    this.ankiManager = new AnkiManager();
    this.ankiManager.initialize(this.dictionaryManager);
    this.pronunciationManager = new PronunciationManager();

    // Initialize internal components
    this.cardManager = new CardManager(this.dictionaryManager, new DefinitionFilter());

    // Initialize popup settings manager
    this.settingsManager = new PopupSettingsManager();
  }

  showDictionaryPopup(x, y, character, sentence) {
    this.hidePopup();
    this.capturedSentence = sentence;

    // Create popup element
    const popup = PopupPositioner.createPopupElement();

    // Prepare data
    const dictionaryData = this.cardManager.prepareBasicPopupData(character);
    dictionaryData.isKnown = this.vocabManager.isWordKnown(character);
    dictionaryData.frequency = this.frequencyManager?.getFrequency(character);

    // Build content
    popup.innerHTML = PopupContentBuilder.createBasicContent(
      character,
      dictionaryData,
      this.vocabManager,
      this.frequencyManager,
      this.settingsManager.settings
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

    PopupEventHandler.setupBasicEvents(popup, character, managers);
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
    if (this.popup && event && this.popup.contains(event.target)) {
      return;
    }
    if (this.popup && (!event || !this.popup.contains(event.target))) {
      this.settingsManager.onPopupDestroyed();
      this.popup.remove();
      this.popup = null;
      this.isMouseOverPopup = false;
    }
  }

  saveToVocabList(character) {
    try {
      const matches = this.dictionaryManager.dictionary[character] || [];
      const definition = matches.length > 0 ? matches[0].definition : "No definition available";
      const pinyin = matches.length > 0 ? matches[0].pinyin : "";

      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
          const vocabItems = result.chineseExtensionVocabList || [];
          const exists = vocabItems.some(item => (item.character || item.word) === character);

          if (!exists) {
            const newItem = {
              character: character,
              word: character,
              definition: definition.length > 100 ? definition.substring(0, 97) + "..." : definition,
              pinyin: pinyin,
              dateAdded: new Date().toISOString(),
              reviewCount: 0,
            };

            vocabItems.push(newItem);
            chrome.storage.local.set({ chineseExtensionVocabList: vocabItems });
          }
        });
      }

      this.incrementSessionCounter();
    } catch (error) {
      console.warn("Could not save to vocab list:", error);
    }
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