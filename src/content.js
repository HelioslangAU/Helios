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
    this.bannerManager = null;
    this.pinyinManager = null; // NEW: Add pinyin manager

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
    this.bannerManager = new BannerManager();
    window.bannerManager = this.bannerManager; // Make globally accessible for banner updates

    // NEW: Initialize pinyin manager after dictionary and page processor are ready
    this.pinyinManager = new PinyinManager(
      this.dictionaryManager,
      this.pageProcessor
    );

    // NEW: Start observing for dynamic content changes
    this.pinyinManager.observeForDynamicContent();

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
        // NEW: Resume pinyin observation
        if (this.pinyinManager) {
          this.pinyinManager.observeForDynamicContent();
        }
      }
    } else {
      // Disable extension functionality
      this.removeTextScannerEvents();
      this.hidePopup();
      this.clearHighlights();
      // NEW: Clean up pinyin
      if (this.pinyinManager) {
        this.pinyinManager.destroy();
      }
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

    // NEW: Pinyin toggle with Ctrl+G
    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "g" &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (this.pinyinManager) {
        this.pinyinManager.togglePinyin();
      }
      return false;
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
      '.asbplayer-offscreen'
      // '[id*="asbplayer"]',
      // '[class*="subtitle"]',
      // '[class*="caption"]',
      // "video + div", // Common pattern for subtitle overlays
      // ".ytp-caption-segment", // YouTube captions
      // ".netflix-player .player-timedtext", // Netflix
      // '[data-uia="player-caption-text"]', // Netflix alternative
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

// NEW: Add PinyinManager class definition here (since you want everything in one file)
class PinyinManager {
  constructor(dictionaryManager, pageProcessor) {
    this.dictionaryManager = dictionaryManager;
    this.pageProcessor = pageProcessor;
    this.pinyinEnabled = false;
    this.processedElements = new Set();
    this.originalTextNodes = new Map(); // Store original text for restoration
  }

  togglePinyin() {
    this.pinyinEnabled = !this.pinyinEnabled;
    console.log("🔤 Pinyin toggle:", this.pinyinEnabled ? "ON" : "OFF");

    if (this.pinyinEnabled) {
      this.addPinyinToPage();
    } else {
      this.removePinyinFromPage();
    }
  }

  addPinyinToPage() {
    console.log("🔤 Adding pinyin to page...");

    // Inject CSS if not already present
    this.injectPinyinCSS();

    // Get all text nodes that contain Chinese characters
    const textNodes = this.getAllChineseTextNodes(document.body);

    for (const textNode of textNodes) {
      this.processTextNodeForPinyin(textNode);
    }

    console.log("🔤 Pinyin added to", textNodes.length, "text nodes");
  }

  removePinyinFromPage() {
    console.log("🔤 Removing pinyin from page...");

    // Remove all wrapper elements and restore original text
    const wrapperElements = document.querySelectorAll(".helios-pinyin-wrapper");
    wrapperElements.forEach((wrapper) => {
      const parent = wrapper.parentNode;
      // Get all the Chinese text content (excluding pinyin)
      const textContent = Array.from(wrapper.childNodes)
        .map((node) => {
          if (node.tagName === "RUBY") {
            // For ruby elements, get only the base text (not the rt)
            return node.firstChild ? node.firstChild.textContent : "";
          } else {
            // For text nodes, get the content as-is
            return node.textContent;
          }
        })
        .join("");

      const textNode = document.createTextNode(textContent);
      parent.replaceChild(textNode, wrapper);
    });

    // Also remove any standalone ruby elements that might be left
    const rubyElements = document.querySelectorAll("ruby.helios-pinyin");
    rubyElements.forEach((ruby) => {
      const parent = ruby.parentNode;
      const originalText = ruby.firstChild
        ? ruby.firstChild.textContent
        : ruby.textContent;
      const textNode = document.createTextNode(originalText);
      parent.replaceChild(textNode, ruby);
    });

    // Normalize text nodes to merge adjacent ones
    this.normalizeTextNodes(document.body);

    this.processedElements.clear();
    this.originalTextNodes.clear();

    console.log("🔤 Pinyin removed from page");
  }

  injectPinyinCSS() {
    if (document.getElementById("helios-pinyin-styles")) return;

    const style = document.createElement("style");
    style.id = "helios-pinyin-styles";
    style.textContent = `
      .helios-pinyin-wrapper {
        display: inline;
      }

      ruby.helios-pinyin {
        ruby-align: center;
        ruby-position: over;
        display: inline-ruby;
        vertical-align: baseline;
      }

      ruby.helios-pinyin rt {
        font-size: 0.6em;
        color: #666;
        font-weight: normal;
        line-height: 1.1;
        text-align: center;
        display: ruby-text;
        unicode-bidi: isolate;
        font-family: inherit;
        letter-spacing: 0;
      }

      @media (prefers-color-scheme: dark) {
        ruby.helios-pinyin rt {
          color: #aaa;
        }
      }

      ruby.helios-pinyin + ruby.helios-pinyin {
        margin-left: 1px;
      }

      ruby.helios-pinyin {
        font-variant-east-asian: normal;
      }

      ruby.helios-pinyin rt {
        white-space: nowrap;
        overflow: visible;
        text-overflow: clip;
      }
    `;
    document.head.appendChild(style);
  }

  getAllChineseTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip script, style, and our own popup elements
        const tagName = parent.tagName.toLowerCase();
        if (["script", "style", "noscript"].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.classList.contains("chinese-lang-extension-popup")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if already processed or if it's inside a ruby element
        if (parent.closest("ruby.helios-pinyin")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Only accept if contains Chinese characters
        const text = node.textContent.trim();
        return this.containsChinese(text)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }

  processTextNodeForPinyin(textNode) {
    const text = textNode.textContent;
    if (!text || this.processedElements.has(textNode)) return;

    // Store original text for restoration
    this.originalTextNodes.set(textNode, text);
    this.processedElements.add(textNode);

    const rubyHTML = this.convertTextToRuby(text);

    if (rubyHTML !== text) {
      const wrapper = document.createElement("span");
      wrapper.innerHTML = rubyHTML;
      wrapper.classList.add("helios-pinyin-wrapper");

      textNode.parentNode.replaceChild(wrapper, textNode);
    }
  }

  convertTextToRuby(text) {
    let result = "";
    let i = 0;

    while (i < text.length) {
      if (this.isChineseCharacter(text[i])) {
        // Try to find the longest word first (word-by-word approach)
        let longestWord = null;
        let longestLength = 0;

        // Check for words of length 5 down to 1
        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);

          // Make sure all characters in candidate are Chinese
          if ([...candidate].every((c) => this.isChineseCharacter(c))) {
            // Check if this word exists in our dictionary
            if (this.dictionaryManager.dictionary[candidate]) {
              if (len > longestLength) {
                longestWord = candidate;
                longestLength = len;
              }
            }
          }
        }

        if (longestWord) {
          // Found a word - get its pinyin
          const pinyin = this.getPinyinForWord(longestWord);
          if (pinyin) {
            result += `<ruby class="helios-pinyin">${longestWord}<rt>${pinyin}</rt></ruby>`;
          } else {
            // Fallback to character-by-character
            result += this.convertCharactersToPinyin(longestWord);
          }
          i += longestLength;
        } else {
          // No word found, process single character
          const char = text[i];
          const pinyin = this.getPinyinForCharacter(char);
          if (pinyin) {
            result += `<ruby class="helios-pinyin">${char}<rt>${pinyin}</rt></ruby>`;
          } else {
            result += char;
          }
          i++;
        }
      } else {
        // Non-Chinese character, add as-is
        result += text[i];
        i++;
      }
    }

    return result;
  }

  convertCharactersToPinyin(word) {
    let result = "";
    for (const char of word) {
      const pinyin = this.getPinyinForCharacter(char);
      if (pinyin) {
        result += `<ruby class="helios-pinyin">${char}<rt>${pinyin}</rt></ruby>`;
      } else {
        result += char;
      }
    }
    return result;
  }

  getPinyinForWord(word) {
    const entries = this.dictionaryManager.dictionary[word];
    if (entries && entries.length > 0) {
      // Use the first entry's pinyin
      return entries[0].pinyin;
    }
    return null;
  }

  getPinyinForCharacter(character) {
    const entries = this.dictionaryManager.dictionary[character];
    if (entries && entries.length > 0) {
      // For single characters, use the first entry's pinyin
      return entries[0].pinyin;
    }
    return null;
  }

  containsChinese(text) {
    return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
  }

  isChineseCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df)
    );
  }

  normalizeTextNodes(element) {
    // Helper function to merge adjacent text nodes after removing ruby elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    const elementsToNormalize = [element];
    let node;
    while ((node = walker.nextNode())) {
      elementsToNormalize.push(node);
    }

    elementsToNormalize.forEach((el) => {
      if (el.normalize) {
        el.normalize();
      }
    });
  }

  // Handle dynamic content changes (for subtitle sites like Netflix, etc.)
  observeForDynamicContent() {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }

    this.contentObserver = new MutationObserver((mutations) => {
      if (!this.pinyinEnabled) return;

      let shouldReprocess = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (
              node.nodeType === Node.ELEMENT_NODE ||
              node.nodeType === Node.TEXT_NODE
            ) {
              // Check if the added content contains Chinese text
              const text = node.textContent || "";
              if (this.containsChinese(text)) {
                shouldReprocess = true;
                break;
              }
            }
          }
        }
      });

      if (shouldReprocess) {
        // Debounce reprocessing to avoid performance issues
        clearTimeout(this.reprocessTimeout);
        this.reprocessTimeout = setTimeout(() => {
          this.addPinyinToPage();
        }, 100);
      }
    });

    this.contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Clean up method
  destroy() {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }
    if (this.reprocessTimeout) {
      clearTimeout(this.reprocessTimeout);
    }
    this.removePinyinFromPage();
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
