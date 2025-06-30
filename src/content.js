class ChineseLanguageLearningExtension {
  constructor() {
    this.isActivationKeyPressed = false;
    this.hoverTimeout = null;
    this.lastMouseEvent = null;
    this.lastHighlightInfo = null;
    this.currentWord = null;
    this.extensionEnabled = true;
    this.activationKey = "Shift"; // Default activation key
    this.autoHighlight = true;
    this.popupTheme = "dark";

    this.dictionaryManager = null;
    this.vocabManager = null;
    this.pageProcessor = null;
    this.highlightManager = null;
    this.popup = null;

    this.init();
  }

  async init() {
    console.log("🔍 Initializing Chinese Language Learning Extension...");

    // Load extension settings first
    await this.loadExtensionSettings();

    // Only proceed if extension is enabled
    if (!this.extensionEnabled) {
      console.log("🔍 Extension is disabled, not initializing");
      return;
    }

    this.dictionaryManager = new DictionaryManager();
    this.vocabManager = new VocabManager();
    this.highlightManager = new HighlightManager();
    this.frequencyManager = new FrequencyManager();

    await Promise.all([
      this.dictionaryManager.loadDictionary(),
      this.vocabManager.loadKnownWords(),
      this.frequencyManager.loadFrequencyList(),
    ]);

    this.pageProcessor = new PageProcessor(
      this.dictionaryManager,
      this.vocabManager
    );
    window.pageProcessor = this.pageProcessor; // Make globally accessible for popup updates

    this.popup = new PopupManager({
      highlightManager: this.highlightManager,
      dictionaryManager: this.dictionaryManager,
      vocabManager: this.vocabManager,
      frequencyManager: this.frequencyManager,
    });

    // Set up communication between components
    // Make highlightManager globally accessible for highlight preservation
    window.highlightManager = this.highlightManager;

    this.initTextScannerEvents();

    // Apply auto-highlight setting (only affects automatic word marking, not manual lookup)
    if (this.autoHighlight) {
      this.pageProcessor.processPageForUnknownWords();
    }

    this.initAsbplayerIntegration();
    this.setupMessageListener();

    console.log(
      "🔍 Chinese Language Learning Extension initialized successfully"
    );
  }

  async loadExtensionSettings() {
    try {
      console.log("🔍 Loading extension settings...");

      // Request settings from background script
      const response = await chrome.runtime.sendMessage({
        action: "getExtensionSettings",
      });

      if (response && response.success) {
        this.extensionEnabled = response.settings.extensionEnabled;
        this.activationKey = response.settings.activationKey;
        this.autoHighlight = response.settings.autoHighlight;
        this.popupTheme = response.settings.popupTheme;

        console.log("🔍 Loaded settings:", response.settings);
      } else {
        console.log("🔍 Could not load settings, using defaults");
      }
    } catch (error) {
      console.log("🔍 Error loading settings, using defaults:", error);
      // Keep default values
    }
  }

  setupMessageListener() {
    // Listen for messages from background script (settings changes)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("🔍 Content script received message:", message.action);

      switch (message.action) {
        case "extensionToggled":
          this.handleExtensionToggled(message.enabled);
          break;

        case "settingsUpdated":
          this.handleSettingsUpdated(message.settings);
          break;

        case "updateActivationKey":
          this.handleActivationKeyUpdate(message.key);
          break;

        case "updateAutoHighlight":
          this.handleAutoHighlightUpdate(message.enabled);
          break;
      }

      sendResponse({ success: true });
    });
  }

  handleExtensionToggled(enabled) {
    console.log("🔍 Extension toggled:", enabled);
    this.extensionEnabled = enabled;

    if (enabled) {
      // Re-initialize if extension was disabled
      if (!this.dictionaryManager) {
        this.init();
      } else {
        // Re-enable text scanner events
        this.initTextScannerEvents();
        if (this.autoHighlight) {
          this.pageProcessor.processPageForUnknownWords();
        }
      }
    } else {
      // Disable extension functionality
      this.removeTextScannerEvents();
      this.hidePopup();
      this.clearHighlights();
    }
  }

  handleSettingsUpdated(settings) {
    console.log("🔍 Settings updated:", settings);

    if (settings.extensionEnabled !== undefined) {
      this.extensionEnabled = settings.extensionEnabled;
    }

    if (settings.activationKey !== undefined) {
      this.activationKey = settings.activationKey;
      console.log("🔍 Activation key updated to:", this.activationKey);
    }

    if (settings.autoHighlight !== undefined) {
      this.autoHighlight = settings.autoHighlight;
      this.handleAutoHighlightUpdate(settings.autoHighlight);
    }

    if (settings.popupTheme !== undefined) {
      this.popupTheme = settings.popupTheme;
      if (this.popup) {
        this.popup.updateTheme(settings.popupTheme);
      }
    }
  }

  handleActivationKeyUpdate(key) {
    console.log("🔍 Activation key updated:", key);
    this.activationKey = key;
    // Reset pressed state since key changed
    this.isActivationKeyPressed = false;
  }

  handleAutoHighlightUpdate(enabled) {
    console.log("🔍 Auto-highlight updated:", enabled);
    this.autoHighlight = enabled;

    if (enabled && this.extensionEnabled && this.pageProcessor) {
      // Enable automatic highlighting of unknown words
      this.pageProcessor.processPageForUnknownWords();
    } else {
      // Disable automatic highlighting - remove existing unknown word highlights
      // BUT keep manual lookup functionality working
      this.clearUnknownWordHighlights();
    }

    // Manual lookup should still work regardless of auto-highlight setting
    // The text scanner events remain active for manual lookups
  }

  clearUnknownWordHighlights() {
    document.querySelectorAll(".chinese-unknown-word").forEach((el) => {
      el.classList.remove("chinese-unknown-word");
    });
    if (this.pageProcessor) {
      this.pageProcessor.unknownWordElements.clear();
    }
  }

  hidePopup() {
    if (this.popup) {
      this.popup.hidePopup();
    }
  }

  clearHighlights() {
    if (this.highlightManager) {
      this.highlightManager.removeLookupHighlight();
    }
    this.clearUnknownWordHighlights();
  }

  removeTextScannerEvents() {
    if (this._textScannerListeners) {
      this._textScannerListeners.forEach(
        ({ target, type, listener, options }) => {
          target.removeEventListener(type, listener, options);
        }
      );
      this._textScannerListeners = [];
    }
  }

  initTextScannerEvents() {
    // Remove existing listeners first
    this.removeTextScannerEvents();

    const capture = true;
    this._textScannerListeners = [];

    const addEvent = (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      this._textScannerListeners.push({ target, type, listener, options });
    };

    addEvent(
      document,
      "pointermove",
      this._onPointerMoveTS.bind(this),
      capture
    );
    addEvent(document, "keydown", this._onKeyDownTS.bind(this), capture);
    addEvent(document, "keyup", this._onKeyUpTS.bind(this), capture);
    addEvent(
      document,
      "selectstart",
      this._onSelectStartTS.bind(this),
      capture
    );
    addEvent(
      document,
      "contextmenu",
      this._onContextMenuTS.bind(this),
      capture
    );
    addEvent(document, "click", this._onClickTS.bind(this), capture);
  }

  _onPointerMoveTS(event) {
    if (!this.extensionEnabled || !this.isActivationKeyPressed) return;

    this.lastPointerEvent = event;

    if (this.popup && this.popup.isMouseOverPopup) {
      return;
    }

    const characterInfo = this.pageProcessor.getCharacterAtPosition(event);

    if (characterInfo && characterInfo.word) {
      clearTimeout(this.hideTimeout);

      if (
        this.currentWord === characterInfo.word &&
        this.highlightManager.currentHighlight &&
        this.highlightManager.currentHighlight.textContent ===
          characterInfo.word
      )
        return;

      this.highlightManager.removeLookupHighlight();

      const newCharacterInfo = this.pageProcessor.getCharacterAtPosition(event);
      if (!newCharacterInfo) {
        this.popup.scheduleHidePopup();
        return;
      }

      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        this.highlightManager.highlightLookupText(
          newCharacterInfo.textNode,
          newCharacterInfo.start,
          newCharacterInfo.end
        );
        this.popup.showDictionaryPopup(
          this.highlightManager.currentHighlight.getBoundingClientRect().left,
          this.highlightManager.currentHighlight.getBoundingClientRect().bottom,
          newCharacterInfo.word
        );
      }, 10);

      this.currentWord = newCharacterInfo.word;
    } else {
      this.popup.scheduleHidePopup();
    }
  }

  _onKeyDownTS(event) {
    if (!this.extensionEnabled) return;

    // Check if the pressed key matches our activation key
    if (event.key === this.activationKey && !this.isActivationKeyPressed) {
      this.isActivationKeyPressed = true;
      this.toggleActivationMode(true);
      if (this.lastPointerEvent) {
        this._onPointerMoveTS(this.lastPointerEvent);
      }
    }
  }

  _onKeyUpTS(event) {
    if (!this.extensionEnabled) return;

    if (event.key === this.activationKey) {
      this.isActivationKeyPressed = false;
      this.toggleActivationMode(false);
      clearTimeout(this.hoverTimeout);
    }
  }

  _onSelectStartTS(event) {
    if (!this.extensionEnabled) return;

    if (this.isActivationKeyPressed) {
      event.preventDefault();
      return false;
    }
  }

  _onContextMenuTS(event) {
    if (!this.extensionEnabled) return;

    if (this.isActivationKeyPressed) {
      event.preventDefault();
      return false;
    }
  }

  _onClickTS(event) {
    if (!this.extensionEnabled) return;

    this.popup.hidePopup(event);
    this.highlightManager.removeLookupHighlight();
  }

  toggleActivationMode(active) {
    document.body.style.cursor = active ? "help" : "";
    document.body.toggleAttribute("data-activation-active", active);
    if (active) window.getSelection()?.removeAllRanges();
  }

  reprocessPage() {
    if (!this.extensionEnabled || !this.pageProcessor) return;

    this.clearUnknownWordHighlights();
    if (this.autoHighlight) {
      this.pageProcessor.processPageForUnknownWords();
    }
  }

  getStats() {
    if (!this.dictionaryManager || !this.vocabManager) return null;

    const totalWords = Object.keys(this.dictionaryManager.dictionary).length;
    const knownWords = this.vocabManager.knownWords.size;
    const unknownWordsOnPage = document.querySelectorAll(
      ".chinese-unknown-word"
    ).length;

    return {
      totalWords,
      knownWords,
      unknownWordsOnPage,
      knowledgePercentage:
        totalWords > 0 ? ((knownWords / totalWords) * 100).toFixed(1) : 0,
    };
  }

  exportKnownWords() {
    if (!this.vocabManager) return null;

    const data = {
      knownWords: [...this.vocabManager.knownWords],
      vocabList: this.vocabManager.vocabList,
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  importKnownWords(jsonData) {
    if (!this.vocabManager) return false;

    try {
      const data = JSON.parse(jsonData);
      if (data.knownWords && Array.isArray(data.knownWords)) {
        this.vocabManager.knownWords = new Set([
          ...this.vocabManager.knownWords,
          ...data.knownWords,
        ]);
        this.vocabManager.saveKnownWords();
      }
      if (data.vocabList && Array.isArray(data.vocabList)) {
        const existingCharacters = new Set(
          this.vocabManager.vocabList.map((item) => item.character)
        );
        const newVocabItems = data.vocabList.filter(
          (item) => !existingCharacters.has(item.character)
        );
        this.vocabManager.vocabList.push(...newVocabItems);
        this.vocabManager.saveVocabList();
      }
      this.reprocessPage();
      return true;
    } catch (error) {
      console.error("Error importing data:", error);
      return false;
    }
  }

  // Fixed asbplayer integration
  initAsbplayerIntegration() {
    if (!this.extensionEnabled) return;

    console.log("Initializing asbplayer integration...");

    // Multiple strategies to detect asbplayer
    this.detectAsbplayerElements();

    // Also set up a periodic check for new asbplayer elements
    this.asbplayerInterval = setInterval(() => {
      if (this.extensionEnabled) {
        this.detectAsbplayerElements();
      }
    }, 2000);

    // Stop checking after 60 seconds
    setTimeout(() => {
      if (this.asbplayerInterval) {
        clearInterval(this.asbplayerInterval);
        console.log("Stopped periodic asbplayer detection");
      }
    }, 60000);
  }

  detectAsbplayerElements() {
    if (!this.extensionEnabled) return;

    // More comprehensive asbplayer detection
    const selectors = [
      '[class*="asbplayer"]',
      '[id*="asbplayer"]',
      '[class*="subtitle"]',
      '[class*="caption"]',
      "video + div", // Common pattern for subtitle overlays
      ".ytp-caption-segment", // YouTube captions
      ".netflix-player .player-timedtext", // Netflix
      '[data-uia="player-caption-text"]', // Netflix alternative
    ];

    const foundElements = new Set();

    selectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          // Check if element contains Chinese text or is likely a subtitle container
          if (this.isLikelySubtitleElement(element)) {
            foundElements.add(element);
          }
        });
      } catch (e) {
        // Ignore selector errors
      }
    });

    // Process any new elements found
    foundElements.forEach((element) => {
      if (!element.hasAttribute("data-chinese-processed")) {
        element.setAttribute("data-chinese-processed", "true");
        if (this.pageProcessor) {
          this.pageProcessor.observeSubtitleContainer(element);
        }
      }
    });
  }

  isLikelySubtitleElement(element) {
    // Check if element or its children contain Chinese characters
    const text = element.textContent || "";
    const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);

    if (hasChinese) return true;

    // Check element attributes and classes for subtitle-related keywords
    const attributeText = [
      element.className,
      element.id,
      element.getAttribute("data-testid") || "",
      element.getAttribute("aria-label") || "",
    ]
      .join(" ")
      .toLowerCase();

    const subtitleKeywords = ["subtitle", "caption", "asbplayer", "timedtext"];
    return subtitleKeywords.some((keyword) => attributeText.includes(keyword));
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
