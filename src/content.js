class ChineseLanguageLearningExtension {
  constructor() {
    this.isShiftPressed = false;
    this.hoverTimeout = null;
    this.lastMouseEvent = null;
    this.lastHighlightInfo = null;
    this.currentWord = null;

    this.dictionaryManager = null;
    this.vocabManager = null;
    this.pageProcessor = null;
    this.highlightManager = null;
    this.popup = null;
    
    this.init();
  }

  async init() {
    this.dictionaryManager = new DictionaryManager();
    this.vocabManager = new VocabManager();
    this.highlightManager = new HighlightManager();

    await Promise.all([this.dictionaryManager.loadDictionary(), this.vocabManager.loadKnownWords()]);

    this.pageProcessor = new PageProcessor(this.dictionaryManager, this.vocabManager);
    window.pageProcessor = this.pageProcessor; // Make globally accessible for popup updates
    this.popup = new PopupManager({
      highlightManager: this.highlightManager,
      dictionaryManager: this.dictionaryManager,
      vocabManager: this.vocabManager
    });

    // Set up communication between components    
    // Make highlightManager globally accessible for highlight preservation
    window.highlightManager = this.highlightManager;

    this.initTextScannerEvents();
    this.pageProcessor.processPageForUnknownWords();
    this.initAsbplayerIntegration();
    console.log('Chinese Language Learning Extension initialized');
  }

  initTextScannerEvents() {
    const capture = true;
    if (this._textScannerListeners) {
      this._textScannerListeners.forEach(({target, type, listener, options}) => {
        target.removeEventListener(type, listener, options);
      });
    }
    this._textScannerListeners = [];

    const addEvent = (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      this._textScannerListeners.push({target, type, listener, options});
    };

    addEvent(document, 'pointermove', this._onPointerMoveTS.bind(this), capture);
    addEvent(document, 'keydown', this._onKeyDownTS.bind(this), capture);
    addEvent(document, 'keyup', this._onKeyUpTS.bind(this), capture);
    addEvent(document, 'selectstart', this._onSelectStartTS.bind(this), capture);
    addEvent(document, 'contextmenu', this._onContextMenuTS.bind(this), capture);
    addEvent(document, 'click', this._onClickTS.bind(this), capture);
  }

  _onPointerMoveTS(event) {
    if (!this.isShiftPressed) return;
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
        this.highlightManager.currentHighlight.textContent === characterInfo.word
      ) return;

      this.highlightManager.removeLookupHighlight();

      const newCharacterInfo = this.pageProcessor.getCharacterAtPosition(event);
      if (!newCharacterInfo) {
        this.popup.scheduleHidePopup();
        return;
      }
      
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        this.highlightManager.highlightLookupText(newCharacterInfo.textNode, newCharacterInfo.start, newCharacterInfo.end);
        this.popup.showDictionaryPopup(this.highlightManager.currentHighlight.getBoundingClientRect().left, this.highlightManager.currentHighlight.getBoundingClientRect().bottom, newCharacterInfo.word);
      }, 10);
      
      this.currentWord = newCharacterInfo.word;
    } else {
      this.popup.scheduleHidePopup();
    }
  }

  _onKeyDownTS(event) {
    if (event.key === 'Shift' && !this.isShiftPressed) {
      this.isShiftPressed = true;
      this.toggleShiftMode(true);
      if (this.lastPointerEvent) {
        this._onPointerMoveTS(this.lastPointerEvent);
      }
    }
  }

  _onKeyUpTS(event) {
    if (event.key === 'Shift') {
      this.isShiftPressed = false;
      this.toggleShiftMode(false);
      this.highlightManager.removeLookupHighlight();
      this.popup.hidePopup();
      clearTimeout(this.hoverTimeout);
    }
  }

  _onSelectStartTS(event) {
    if (this.isShiftPressed) {
      event.preventDefault();
      return false;
    }
  }

  _onContextMenuTS(event) {
    if (this.isShiftPressed) {
      event.preventDefault();
      return false;
    }
  }

  _onClickTS(event) {
    this.popup.hidePopup(event);
  }

  toggleShiftMode(active) {
    document.body.style.cursor = active ? 'help' : '';
    document.body.toggleAttribute('data-shift-active', active);
    if (active) window.getSelection()?.removeAllRanges();
  }

  reprocessPage() {
    document.querySelectorAll('.chinese-unknown-word').forEach(el => {
      el.classList.remove('chinese-unknown-word');
    });
    this.pageProcessor.unknownWordElements.clear();
    this.pageProcessor.processPageForUnknownWords();
  }

  getStats() {
    const totalWords = Object.keys(this.dictionaryManager.dictionary).length;
    const knownWords = this.vocabManager.knownWords.size;
    const unknownWordsOnPage = document.querySelectorAll('.chinese-unknown-word').length;
    
    return {
      totalWords,
      knownWords,
      unknownWordsOnPage,
      knowledgePercentage: totalWords > 0 ? ((knownWords / totalWords) * 100).toFixed(1) : 0
    };
  }

  exportKnownWords() {
    const data = {
      knownWords: [...this.vocabManager.knownWords],
      vocabList: this.vocabManager.vocabList,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  importKnownWords(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (data.knownWords && Array.isArray(data.knownWords)) {
        this.vocabManager.knownWords = new Set([...this.vocabManager.knownWords, ...data.knownWords]);
        this.vocabManager.saveKnownWords();
      }
      if (data.vocabList && Array.isArray(data.vocabList)) {
        const existingCharacters = new Set(this.vocabManager.vocabList.map(item => item.character));
        const newVocabItems = data.vocabList.filter(item => !existingCharacters.has(item.character));
        this.vocabManager.vocabList.push(...newVocabItems);
        this.vocabManager.saveVocabList();
      }
      this.reprocessPage();
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // Fixed asbplayer integration
  initAsbplayerIntegration() {
    console.log('Initializing asbplayer integration...');
    
    // Multiple strategies to detect asbplayer
    this.detectAsbplayerElements();
    
    // Also set up a periodic check for new asbplayer elements
    this.asbplayerInterval = setInterval(() => {
      this.detectAsbplayerElements();
    }, 2000);
    
    // Stop checking after 60 seconds
    setTimeout(() => {
      if (this.asbplayerInterval) {
        clearInterval(this.asbplayerInterval);
        console.log('Stopped periodic asbplayer detection');
      }
    }, 60000);
  }
  
  detectAsbplayerElements() {
    // More comprehensive asbplayer detection
    const selectors = [
      '[class*="asbplayer"]',
      '[id*="asbplayer"]',
      '[class*="subtitle"]',
      '[class*="caption"]',
      'video + div', // Common pattern for subtitle overlays
      '.ytp-caption-segment', // YouTube captions
      '.netflix-player .player-timedtext', // Netflix
      '[data-uia="player-caption-text"]' // Netflix alternative
    ];
    
    const foundElements = new Set();
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
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
    foundElements.forEach(element => {
      if (!element.hasAttribute('data-chinese-processed')) {
        element.setAttribute('data-chinese-processed', 'true');
        console.log('Found asbplayer/subtitle element:', element);
        this.pageProcessor.observeSubtitleContainer(element);
      }
    });
  }
  
  isLikelySubtitleElement(element) {
    // Check if element or its children contain Chinese characters
    const text = element.textContent || '';
    const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
    
    if (hasChinese) return true;
    
    // Check element attributes and classes for subtitle-related keywords
    const attributeText = [
      element.className,
      element.id,
      element.getAttribute('data-testid') || '',
      element.getAttribute('aria-label') || ''
    ].join(' ').toLowerCase();
    
    const subtitleKeywords = ['subtitle', 'caption', 'asbplayer', 'timedtext'];
    return subtitleKeywords.some(keyword => attributeText.includes(keyword));
  }
}

// Initialize extension when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ChineseLanguageLearningExtension();
  });
} else {
  new ChineseLanguageLearningExtension();
}