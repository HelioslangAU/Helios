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

    // Popup state
    this.popup = null;
    this.capturedSentence = null;
    this.hideTimeout = null;

    // Mouse tracking flags
    this.isMouseOverPopup = false;
    this.isSubtitleWordPopup = false; // Track if popup is for subtitle word

    // Initialize managers
    this.ankiManager = new AnkiManager();
    this.ankiManager.initialize(this.dictionaryManager);
    this.pronunciationManager = new PopupPronunciationManager();
    this.cardManager = new CardManager(this.dictionaryManager, new DefinitionFilter(), this.languageRegistry);
    this.settingsManager = new PopupSettingsManager();
  }

  async showDictionaryPopup(x, y, character, sentence) {
    // Clear any pending hide timers immediately
    clearTimeout(this.hideTimeout);

    // CRITICAL: Remove ALL existing popups immediately (synchronously)
    this.hidePopup();
    this.removeAllPopupsFromPage();

    this.capturedSentence = sentence;

    // Ensure dictionary entry is loaded (for async dictionary proxy)
    // This also updates the sync dictionary cache
    if (this.dictionaryManager.getDefinition) {
      await this.dictionaryManager.getDefinition(character);
      // Small delay to ensure cache is updated
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Create popup element with correct size from the start
    const popup = PopupPositioner.createPopupElement(this.settingsManager.settings.popupFontSize);

    // Prepare data - now async to handle base form lookups
    const dictionaryData = await this.cardManager.prepareBasicPopupData(character);
    
    // If still no matches, try one more time after a brief delay
    if (!dictionaryData.matches || dictionaryData.matches.length === 0) {
      console.log('⚠️ No matches found, retrying dictionary lookup...');
      await this.dictionaryManager.getDefinition(character);
      await new Promise(resolve => setTimeout(resolve, 50));
      // Re-prepare data
      const retryData = await this.cardManager.prepareBasicPopupData(character);
      if (retryData.matches && retryData.matches.length > 0) {
        dictionaryData.matches = retryData.matches;
        console.log('✅ Found matches on retry:', retryData.matches.length);
      }
    }
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

    // Don't auto-hide in persistent mode (unless this is a subtitle word popup)
    if (!this.isSubtitleWordPopup && this.settingsManager.shouldPreventAutoHide()) {
      return;
    }

    // Hide popup after a short delay when mouse leaves both word and popup
    // 100ms is enough time for mouse travel while feeling more responsive
    this.hideTimeout = setTimeout(() => {
      // For both subtitle words and regular words, only hide if mouse is not over popup or highlight
      if (!this.isMouseOverPopup && !this.highlightManager.isMouseOverHighlight) {
        this.hidePopup();
        this.highlightManager.removeLookupHighlight();
      }
    }, 100);
  }

  hidePopup(event) {
    if (!this.popup) {
      return;
    }
    if (event?.target && this.popup.contains(event.target)) {
      return;
    }

    clearTimeout(this.hideTimeout);
    this.settingsManager.onPopupDestroyed();

    if (this.popup?.parentNode) {
      this.popup.remove();
    }

    this._resetState();
  }

  removeAllPopupsFromPage() {
    const allPopups = document.querySelectorAll('.chinese-lang-extension-popup');
    allPopups.forEach(popup => {
      if (popup.parentNode) {
        popup.remove();
      }
    });
    this._resetState();
  }

  _resetState() {
    this.popup = null;
    this.isMouseOverPopup = false;
    this.isSubtitleWordPopup = false; // Reset subtitle word flag
    // Clear any pending timers
    clearTimeout(this.hideTimeout);
    this.hideTimeout = null;
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