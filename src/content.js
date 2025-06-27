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
    this.popup = new PopupManager({
      highlightManager: this.highlightManager,
      dictionaryManager: this.dictionaryManager,
      vocabManager: this.vocabManager
    });


    this.initTextScannerEvents();
    this.injectStyles();
    this.pageProcessor.processPageForUnknownWords();
    console.log('Chinese Language Learning Extension initialized');
  }


  injectStyles() {
    if (document.getElementById('chinese-extension-styles')) return;
    const style = document.createElement('style');
    style.id = 'chinese-extension-styles';
    document.head.appendChild(style);
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

    // Check if mouse is over popup - if so, don't process character detection
    if (this.popup && this.popup.isMouseOverPopup) {
      return;
    }

    const characterInfo = this.pageProcessor.getCharacterAtPosition(event);

    if (characterInfo && characterInfo.word) {
      // Clear any pending hide timeout when we find a valid character
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
      // Schedule hide with grace period instead of immediate hide
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


  // Method to manually reprocess page (useful for dynamic content)
  reprocessPage() {
    // Clear existing styling
    document.querySelectorAll('.chinese-unknown-word').forEach(el => {
      el.classList.remove('chinese-unknown-word');
    });
    this.pageProcessor.unknownWordElements.clear();
    this.processPageForUnknownWords();
  }

  // Method to get statistics
  getStats() {
    const totalWords = Object.keys(this.dictionaryManager.dictionary).length;
    const knownWords = this.knownWords.size;
    const unknownWordsOnPage = document.querySelectorAll('.chinese-unknown-word').length;
    
    return {
      totalWords,
      knownWords,
      unknownWordsOnPage,
      knowledgePercentage: totalWords > 0 ? ((knownWords / totalWords) * 100).toFixed(1) : 0
    };
  }

  // Export/Import functionality for known words
  exportKnownWords() {
    const data = {
      knownWords: [...this.knownWords],
      vocabList: this.vocabList,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  importKnownWords(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (data.knownWords && Array.isArray(data.knownWords)) {
        this.knownWords = new Set([...this.knownWords, ...data.knownWords]);
        this.saveKnownWords();
      }
      if (data.vocabList && Array.isArray(data.vocabList)) {
        // Merge vocab lists, avoiding duplicates
        const existingCharacters = new Set(this.vocabList.map(item => item.character));
        const newVocabItems = data.vocabList.filter(item => !existingCharacters.has(item.character));
        this.vocabList.push(...newVocabItems);
        this.saveVocabList();
      }
      this.reprocessPage();
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
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