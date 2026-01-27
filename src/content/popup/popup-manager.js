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
    this.currentCharacter = null; // Track the word currently shown in popup

    // Mouse tracking flags
    this.isMouseOverPopup = false;
    this.isSubtitleWordPopup = false; // Track if popup is for subtitle word

    // Prevent concurrent popup creation
    this.popupCreationInProgress = false;
    this.currentPopupRequestId = null;

    // Global mouse tracking for better hide detection
    this.globalMouseMoveHandler = null;
    this.lastMousePosition = { x: 0, y: 0 };
    this.mouseCheckInterval = null;

    // Initialize managers
    this.ankiManager = new AnkiManager();
    this.ankiManager.initialize(this.dictionaryManager);
    this.pronunciationManager = new PopupPronunciationManager();
    this.cardManager = new CardManager(this.dictionaryManager, new DefinitionFilter(), this.languageRegistry);
    this.settingsManager = new PopupSettingsManager();
  }

  async showDictionaryPopup(x, y, character, sentence) {
    // Generate unique request ID for this popup creation
    
    const requestId = Date.now() + Math.random();
    this.currentPopupRequestId = requestId;

    // Clear any pending hide timers immediately
    clearTimeout(this.hideTimeout);

    // CRITICAL: Remove ALL existing popups immediately (synchronously)
    this.hidePopup();
    this.removeAllPopupsFromPage();

    // Mark that popup creation is in progress
    this.popupCreationInProgress = true;

    this.capturedSentence = sentence;

    try {
      // Ensure dictionary entry is loaded (for async dictionary proxy)
      // This also updates the sync dictionary cache
      if (this.dictionaryManager.getDefinition) {

        await this.dictionaryManager.getDefinition(character);
        // Small delay to ensure cache is updated
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Check if this request was cancelled (newer request came in)
      if (this.currentPopupRequestId !== requestId) {
        return; // Another popup request is in progress, abort this one
      }

      // Create popup element with correct size from the start
      const popup = PopupPositioner.createPopupElement(this.settingsManager.settings.popupFontSize);

      // Prepare data - now async to handle base form lookups
      const dictionaryData = await this.cardManager.prepareBasicPopupData(character);
      
      // Check again if cancelled
      if (this.currentPopupRequestId !== requestId) {
        // Clean up the popup element we created
        if (popup.parentNode) {
          popup.remove();
        }
        return;
      }
      
      // If still no matches, try one more time after a brief delay
      if (!dictionaryData.matches || dictionaryData.matches.length === 0) {
        console.log('⚠️ No matches found, retrying dictionary lookup...');
        await this.dictionaryManager.getDefinition(character);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check again if cancelled
        if (this.currentPopupRequestId !== requestId) {
          if (popup.parentNode) {
            popup.remove();
          }
          return;
        }
        
        // Re-prepare data
        const retryData = await this.cardManager.prepareBasicPopupData(character);
        if (retryData.matches && retryData.matches.length > 0) {
          dictionaryData.matches = retryData.matches;
          console.log('✅ Found matches on retry:', retryData.matches.length);
        }
      }
      
      // Final check before creating popup
      if (this.currentPopupRequestId !== requestId) {
        if (popup.parentNode) {
          popup.remove();
        }
        return;
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
        currentLanguage,
        this.dictionaryManager.dictionary
      );

      // Add to DOM and position
      document.body.appendChild(popup);
      const positioned = PopupPositioner.positionPopup(popup, this.highlightManager);

      if (!positioned) {
        if (popup.parentNode) {
          popup.remove();
        }
        return;
      }

      // Final check - make sure we're still the active request
      if (this.currentPopupRequestId !== requestId) {
        if (popup.parentNode) {
          popup.remove();
        }
        return;
      }

      this.popup = popup;
      this.currentCharacter = character; // Track current character for hotkeys

      // Apply settings to the popup
      this.settingsManager.onPopupCreated(popup);

      // Remove creating class to enable transitions after initial setup
      popup.classList.remove('creating');

      // Start global mouse tracking for better hide detection
      this._startGlobalMouseTracking();

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
    } finally {
      // Only clear the flag if this is still the current request
      if (this.currentPopupRequestId === requestId) {
        this.popupCreationInProgress = false;
      }
    }
  }

  /**
   * Start global mouse tracking to detect when mouse leaves popup/highlight area
   * This provides more reliable detection than relying solely on mouseenter/mouseleave events
   * @private
   */
  _startGlobalMouseTracking() {
    // Clean up any existing tracking first
    this._stopGlobalMouseTracking();

    // Track mouse position globally
    this.globalMouseMoveHandler = (e) => {
      this.lastMousePosition = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener('mousemove', this.globalMouseMoveHandler, { passive: true });

    // Periodically check if mouse is still over popup or highlight
    this.mouseCheckInterval = setInterval(() => {
      if (!this.popup) {
        this._stopGlobalMouseTracking();
        return;
      }

      // Get elements at current mouse position
      const elementAtMouse = document.elementFromPoint(
        this.lastMousePosition.x,
        this.lastMousePosition.y
      );

      if (!elementAtMouse) return;

      // Check if mouse is over popup or its children
      const isOverPopup = this.popup && this.popup.contains(elementAtMouse);

      // Check if mouse is over highlight or its children
      const isOverHighlight = this.highlightManager?.currentHighlight &&
                             this.highlightManager.currentHighlight.contains(elementAtMouse);

      // Check if mouse is over a subtitle word (data-subtitle-word attribute)
      let isOverSubtitleWord = false;
      let checkElement = elementAtMouse;
      for (let i = 0; i < 5 && checkElement; i++) {
        if (checkElement.getAttribute?.('data-subtitle-word') === 'true') {
          isOverSubtitleWord = true;
          break;
        }
        checkElement = checkElement.parentElement;
      }

      // Update flags based on actual DOM position
      const wasOverPopup = this.isMouseOverPopup;
      const wasOverHighlight = this.highlightManager?.isMouseOverHighlight;

      this.isMouseOverPopup = isOverPopup;
      if (this.highlightManager) {
        this.highlightManager.isMouseOverHighlight = isOverHighlight || isOverSubtitleWord;
      }

      // If mouse was over popup/highlight but now isn't, trigger hide
      if ((wasOverPopup || wasOverHighlight) && !isOverPopup && !isOverHighlight && !isOverSubtitleWord) {
        this.scheduleHidePopup();
      }
    }, 50); // Check every 50ms for responsive detection
  }

  /**
   * Stop global mouse tracking
   * @private
   */
  _stopGlobalMouseTracking() {
    if (this.globalMouseMoveHandler) {
      document.removeEventListener('mousemove', this.globalMouseMoveHandler);
      this.globalMouseMoveHandler = null;
    }

    if (this.mouseCheckInterval) {
      clearInterval(this.mouseCheckInterval);
      this.mouseCheckInterval = null;
    }
  }

  scheduleHidePopup() {
    clearTimeout(this.hideTimeout);

    // Don't auto-hide in persistent mode (unless this is a subtitle word popup)
    if (!this.isSubtitleWordPopup && this.settingsManager.shouldPreventAutoHide()) {
      return;
    }

    // Hide popup after a short delay when mouse leaves both word and popup
    // Reduced to 50ms for more responsive hiding with fast mouse movement
    this.hideTimeout = setTimeout(() => {
      // For both subtitle words and regular words, only hide if mouse is not over popup or highlight
      if (!this.isMouseOverPopup && !this.highlightManager.isMouseOverHighlight) {
        this.hidePopup();
        this.highlightManager.removeLookupHighlight();
      }
    }, 50);
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

    // Stop global mouse tracking
    this._stopGlobalMouseTracking();

    // Clean up keyboard listener
    if (PopupEventHandler && PopupEventHandler.cleanupKeyboardListener) {
      PopupEventHandler.cleanupKeyboardListener();
    }

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

    // Stop global mouse tracking
    this._stopGlobalMouseTracking();

    // Clean up keyboard listener
    if (PopupEventHandler && PopupEventHandler.cleanupKeyboardListener) {
      PopupEventHandler.cleanupKeyboardListener();
    }
    this._resetState();
  }

  _resetState() {
    this.popup = null;
    this.currentCharacter = null; // Clear current character
    this.isMouseOverPopup = false;
    this.isSubtitleWordPopup = false; // Reset subtitle word flag
    // Clear any pending timers
    clearTimeout(this.hideTimeout);
    this.hideTimeout = null;
    // Don't reset popupCreationInProgress here - let it be reset by the next creation
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