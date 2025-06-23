class ChineseLanguageLearningExtension {
  constructor() {
    this.popup = null;
    this.currentHighlight = null;
    this.dictionary = {};
    this.vocabList = [];
    this.knownWords = new Set(); // Track known words
    this.unknownWordElements = new Map(); // Track unknown word elements for styling
    this.isShiftPressed = false;
    this.hoverTimeout = null;
    this.lastMouseEvent = null;
    this.lastHighlightInfo = null;
    this.currentWord = null;
    this.pageProcessed = false;
    this.isMouseOverPopup = false;
    this.isMouseOverHighlight = false;
    
    this.init();
  }

  async init() {
    await Promise.all([this.loadDictionary(), this.loadKnownWords()]);
    this.initTextScannerEvents();
    this.injectStyles();
    this.processPageForUnknownWords();
    console.log('Chinese Language Learning Extension initialized');
  }

  //#region Dictionary Loading 
  async loadDictionary() {
    try {
      const dictionaryUrl = chrome.runtime.getURL('cedict_ts.u8');
      const response = await fetch(dictionaryUrl);
      const text = await response.text();
      this.parseCEDICT(text);
      console.log('CC-CEDICT loaded with', Object.keys(this.dictionary).length, 'entries');
    } catch (error) {
      console.warn('Could not load CC-CEDICT file:', error);
    }
  }

  parseCEDICT(cedictText) {
    const lines = cedictText.split('\n');
    let processedEntries = 0;

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      const match = line.match(/^(.+?)\s+(.+?)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
      if (!match) continue;

      const [, traditional, simplified, pinyin, definitions] = match;
      const entryData = {
        traditional: traditional.trim(),
        simplified: simplified.trim(),
        pinyin: pinyin.trim(),
        definition: definitions.split('/').filter(def => def.trim()).join('; '),
        tone: this.extractToneFromPinyin(pinyin.trim())
      };

      const tradKey = traditional.trim();
      const simpKey = simplified.trim();

      if (tradKey === simpKey) {
        if (!this.dictionary[tradKey]) this.dictionary[tradKey] = [];
        this.dictionary[tradKey].push({ ...entryData, character: tradKey });
      } else {
        [tradKey, simpKey].forEach(key => {
          if (!this.dictionary[key]) this.dictionary[key] = [];
          this.dictionary[key].push({ ...entryData, character: key });
        });
      }

      processedEntries++;
    }
    console.log(`Successfully processed ${processedEntries} CC-CEDICT entries`);
  }

  extractToneFromPinyin(pinyin) {
    const toneMarks = {
      'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
      'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
      'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4
    };
    
    for (const char of pinyin) {
      if (toneMarks[char] > 0) return toneMarks[char];
    }
    
    const toneMatch = pinyin.match(/[1-4]/);
    return toneMatch ? parseInt(toneMatch[0]) : 0;
  }
  //#endregion

  //#region Known Words Management
  async loadKnownWords() {
    try {
      const stored = localStorage.getItem('chineseExtensionKnownWords');
      if (stored) {
        this.knownWords = new Set(JSON.parse(stored));
        this.reprocessPage();
        console.log('Known words loaded from localStorage');
      } else {
        this.knownWords = new Set();
        this.reprocessPage();
        console.log('No known words found in localStorage, starting fresh');
      }
    } catch (err) {
      console.warn('Failed to load known words from localStorage.', err);
      this.knownWords = new Set();
      this.reprocessPage();
    }
  }

  async saveKnownWords() {
    try {
      // In a real extension, use chrome.storage.sync.set()
      localStorage.setItem('chineseExtensionKnownWords', JSON.stringify([...this.knownWords]));
    } catch (error) {
      console.warn('Could not save known words:', error);
    }
  }

  exportKnownWordsToFile() {
    const data = {
      knownWords: [...this.knownWords],
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chinese-known-words.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  markWordAsKnown(word) {
    this.knownWords.add(word);
    this.saveKnownWords();
    this.updateWordStyling(word, true);
    console.log('Marked word as known:', word);
    this.reprocessPage();
  }

  markWordAsUnknown(word) {
    this.knownWords.delete(word);
    this.saveKnownWords();
    this.updateWordStyling(word, false);
    console.log('Marked word as unknown:', word);
  }

  isWordKnown(word) {
    return this.knownWords.has(word);
  }
  //#endregion

  //#region Page Processing and Styling
  injectStyles() {
    if (document.getElementById('chinese-extension-styles')) return;
    const style = document.createElement('style');
    style.id = 'chinese-extension-styles';
    document.head.appendChild(style);
  }

  processPageForUnknownWords() {
    //if (this.pageProcessed) return;
    
    // Process all text nodes in the document
    const textNodes = this.getAllTextNodes(document.body);
    
    for (const textNode of textNodes) {
      this.processTextNodeForUnknownWords(textNode);
    }
    
    this.pageProcessed = true;
    console.log('Page processed for unknown words');
  }

  getAllTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script, style, and already processed nodes
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if already processed or part of our extension
          if (parent.classList.contains('chinese-unknown-word') ||
              parent.classList.contains('chinese-lang-extension-popup')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    return textNodes;
  }

  processTextNodeForUnknownWords(textNode) {
    const text = textNode.textContent;
    if (!text) return;

    const chineseWords = this.extractChineseWords(text);
    if (chineseWords.length === 0) return;

    // Create document fragment to build the replacement content
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    chineseWords.forEach(({ word, start, end }) => {
      // Add text before the Chinese word
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      // Create span for Chinese word with appropriate styling
      const span = document.createElement('span');
      span.textContent = word;
      
      if (!this.isWordKnown(word) && this.dictionary[word]) {
        span.className = 'chinese-unknown-word';
        span.setAttribute('data-word', word);
        this.unknownWordElements.set(word, span);
      }

      fragment.appendChild(span);
      lastIndex = end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace the text node with the fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  extractChineseWords(text) {
    const words = [];
    let i = 0;

    while (i < text.length) {
      if (this.isChineseCharacter(text[i])) {
        // Try to find the longest word starting from this position
        let longestWord = null;
        let longestLength = 0;

        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);
          if ([...candidate].every(c => this.isChineseCharacter(c)) && this.dictionary[candidate]) {
            if (len > longestLength) {
              longestWord = candidate;
              longestLength = len;
            }
          }
        }

        if (longestWord) {
          words.push({
            word: longestWord,
            start: i,
            end: i + longestLength
          });
          i += longestLength;
        } else {
          // Single character fallback
          if (this.dictionary[text[i]]) {
            words.push({
              word: text[i],
              start: i,
              end: i + 1
            });
          }
          i++;
        }
      } else {
        i++;
      }
    }

    return words;
  }

  updateWordStyling(word, isKnown) {
    // Find all elements with this word and update styling
    const elements = document.querySelectorAll(`[data-word="${word}"]`);
    elements.forEach(element => {
      if (isKnown) {
        element.classList.remove('chinese-unknown-word');
      } else {
        element.classList.add('chinese-unknown-word');
      }
    });
  }

  // Reprocess page when DOM changes
  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReprocess = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              shouldReprocess = true;
              break;
            }
          }
        }
      });
      
      if (shouldReprocess) {
        setTimeout(() => this.processPageForUnknownWords(), 100);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  //#endregion

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
    if (this.popup && this.isMouseOverPopup) {
      return;
    }

    const characterInfo = this.getCharacterAtPosition(event);

    if (characterInfo && characterInfo.word) {
      // Clear any pending hide timeout when we find a valid character
      clearTimeout(this.hideTimeout);
      
      if (
        this.currentWord === characterInfo.word &&
        this.currentHighlight &&
        this.currentHighlight.textContent === characterInfo.word
      ) return;

      this.removeLookupHighlight();

      const newCharacterInfo = this.getCharacterAtPosition(event);
      if (!newCharacterInfo) {
        this.scheduleHidePopup();
        return;
      }
      
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        this.highlightLookupText(newCharacterInfo.textNode, newCharacterInfo.start, newCharacterInfo.end);
        this.showDictionaryPopup(this.currentHighlight.getBoundingClientRect().left, this.currentHighlight.getBoundingClientRect().bottom, newCharacterInfo.word);
      }, 10);
      
      this.currentWord = newCharacterInfo.word;
    } else {
      // Schedule hide with grace period instead of immediate hide
      this.scheduleHidePopup();
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
      this.removeLookupHighlight();
      this.hidePopup();
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
    this.hidePopup(event);
  }

  toggleShiftMode(active) {
    document.body.style.cursor = active ? 'help' : '';
    document.body.toggleAttribute('data-shift-active', active);
    if (active) window.getSelection()?.removeAllRanges();
  }

  

  highlightLookupText(node, start, end) {
    this.removeLookupHighlight();

    if (!node || start === end || !node.parentNode) return;

    const text = node.textContent;
    const before = text.slice(0, start);
    const target = text.slice(start, end);
    const after = text.slice(end);

    const beforeNode = document.createTextNode(before);
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'lookup-highlight';
    highlightSpan.textContent = target;
    const afterNode = document.createTextNode(after);

    const parent = node.parentNode;
    parent.insertBefore(beforeNode, node);
    parent.insertBefore(highlightSpan, node);
    parent.insertBefore(afterNode, node);
    parent.removeChild(node);

    this.currentHighlight = highlightSpan;

    // Add mouse events to the highlight
    highlightSpan.addEventListener('mouseenter', () => {
      this.isMouseOverHighlight = true;
    });

    highlightSpan.addEventListener('mouseleave', () => {
      this.isMouseOverHighlight = false;
    });
  }

  removeLookupHighlight() {
    if (this.currentHighlight && this.currentHighlight.parentNode) {
      const parent = this.currentHighlight.parentNode;
      const text = this.currentHighlight.textContent;
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, this.currentHighlight);
      parent.normalize();
      this.currentHighlight = null;
    }
  }

  // Character Detection 
  getCharacterAtPosition(event) {
    try {
      const accurateResult = this.getCharacterAtPositionAccurate(event);
      if (accurateResult) return accurateResult;
      
      return this.getCharacterAtPositionFallback(event);
    } catch (error) {
      console.error('Error getting character at position:', error);
      return null;
    }
  }

  getCharacterAtPositionAccurate(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element) return null;

    const textNodes = this.getTextNodes(element);
    
    for (const textNode of textNodes) {
      const result = this.checkTextNodeAtPosition(textNode, event.clientX, event.clientY);
      if (result) return result;
    }
    
    return null;
  }

  checkTextNodeAtPosition(textNode, x, y) {
    const text = textNode.textContent;
    if (!text) return null;

    const range = document.createRange();
    
    for (let i = 0; i < text.length; i++) {
      if (!this.isChineseCharacter(text[i])) continue;
      
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      
      const rect = range.getBoundingClientRect();
      
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom) {
        
        const wordResult = this.findLongestWord(textNode, i);
        if (wordResult) return wordResult;
        
        return { 
          word: text[i], 
          textNode, 
          start: i, 
          end: i + 1 
        };
      }
    }
    
    return null;
  }

  findLongestWord(textNode, startOffset) {
    const text = textNode.textContent;
    
    for (let len = 5; len >= 1; len--) {
      if (startOffset + len <= text.length) {
        const candidate = text.substring(startOffset, startOffset + len);
        
        if ([...candidate].every(c => this.isChineseCharacter(c)) &&
            this.dictionary[candidate]) {
          return { 
            word: candidate, 
            textNode, 
            start: startOffset, 
            end: startOffset + len 
          };
        }
      }
    }
    
    return null;
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    
    return textNodes;
  }

  getCharacterAtPositionFallback(event) {
    const offsets = [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 }
    ];
    
    for (const offset of offsets) {
      const result = this.tryGetCharacterAtPoint(
        event.clientX + offset.x, 
        event.clientY + offset.y
      );
      if (result) return result;
    }
    
    return null;
  }

  tryGetCharacterAtPoint(x, y) {
    const caret = document.caretPositionFromPoint?.(x, y);
    if (!caret?.offsetNode) return null;

    let { offsetNode: textNode, offset } = caret;
    if (textNode.nodeType !== Node.TEXT_NODE) return null;

    for (let len = 5; len >= 1; len--) {
      if (offset + len <= textNode.textContent.length) {
        const candidate = textNode.textContent.substring(offset, offset + len);
        if ([...candidate].every(c => this.isChineseCharacter(c)) &&
            this.dictionary[candidate]) {
          return { word: candidate, textNode, start: offset, end: offset + len };
        }
      }
    }

    const text = textNode.textContent;
    if (this.isChineseCharacter(text[offset])) {
      return { word: text[offset], textNode, start: offset, end: offset + 1 };
    }

    return null;
  }

  isChineseCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x20000 && code <= 0x2A6DF);
  }

  //#region Popup Management
  showDictionaryPopup(x, y, character) {
    this.hidePopup();

    const popup = document.createElement('div');
    popup.className = 'chinese-lang-extension-popup';
    popup.innerHTML = this.createPopupContent(character);

    // Default position (fallback)
    let posX = x, posY = y;

    // If there is a highlight, position popup exactly below it
    if (this.currentHighlight) {
      const rect = this.currentHighlight.getBoundingClientRect();
      posX = rect.left + window.scrollX;
      posY = rect.bottom + window.scrollY; // No extra gap
    }

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;

    document.body.appendChild(popup);
    this.popup = popup;
    this.setupPopupEventListeners(character);
    this.setupPopupMouseEvents();
  }

  setupPopupMouseEvents() {
    if (!this.popup) return;

    this.popup.addEventListener('mouseenter', () => {
      this.isMouseOverPopup = true;
      // Clear any pending hide timeout when entering popup
      clearTimeout(this.hideTimeout);
    });

    this.popup.addEventListener('mouseleave', () => {
      this.isMouseOverPopup = false;
      // Schedule hide with grace period when leaving popup
      this.scheduleHidePopup();
    });
  }

  scheduleHidePopup() {
  // Clear any existing timeout
  clearTimeout(this.hideTimeout);
  
  // Schedule hide after grace period
  this.hideTimeout = setTimeout(() => {
    if (!this.isMouseOverPopup && !this.isMouseOverHighlight) {
      this.hidePopup();
      this.removeLookupHighlight();
    }
  }, 50); // 50ms grace period
}

  createPopupContent(character) {
    const matches = this.dictionary[character] || [];
    const isInVocab = this.vocabList.some(item => item.character === character);
    const isKnown = this.isWordKnown(character);

    if (matches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character highlight">${character}</div>
          <div class="definition">Character not found in dictionary</div>
          <div class="popup-buttons">
            <button class="close-btn">Close</button>
          </div>
        </div>
      `;
    }

    const definitionsHtml = matches.map((def, idx) => {
      const toneClass = `tone-${def.tone}`;
      const variants = def.traditional !== def.simplified
        ? `<div class="variants">Traditional: ${def.traditional} | Simplified: ${def.simplified}</div>`
        : '';
      
      const defs = def.definition.split(';').map(d => d.trim()).filter(Boolean);
      const bullets = defs.length > 1
        ? `<ul class="definition-list">${defs.map(d => `<li>${d}</li>`).join('')}</ul>`
        : `<div class="definition">${defs[0]}</div>`;

      return `
        <div class="definition-block">
          <div class="pinyin">
            <span class="pinyin-text">${def.pinyin}</span>
            <span class="tone-indicator ${toneClass}">${def.tone}</span>
            ${matches.length > 1 ? `<span class="def-index">${idx + 1}</span>` : ''}
          </div>
          ${variants}${bullets}
        </div>
      `;
    }).join('');

    return `
      <div class="popup-content">
        <div class="character highlight">${character}</div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="add-vocab-btn" ${isInVocab ? 'disabled' : ''}>
            ${isInVocab ? 'Already in Vocab' : 'Add to Vocab'}
          </button>
          <button class="${isKnown ? 'mark-unknown-btn' : 'mark-known-btn'}">
            ${isKnown ? 'Mark Unknown' : 'Mark Known'}
          </button>
          <button class="close-btn">Close</button>
        </div>
      </div>
    `;
  }

  setupPopupEventListeners(character) {
    const addVocabBtn = this.popup.querySelector('.add-vocab-btn:not([disabled])');
    const markKnownBtn = this.popup.querySelector('.mark-known-btn');
    const markUnknownBtn = this.popup.querySelector('.mark-unknown-btn');
    const closeBtn = this.popup.querySelector('.close-btn');

    addVocabBtn?.addEventListener('click', () => this.addToVocab(character));
    markKnownBtn?.addEventListener('click', () => {
      this.markWordAsKnown(character);
      this.hidePopup();
    });
    markUnknownBtn?.addEventListener('click', () => {
      this.markWordAsUnknown(character);
      this.hidePopup();
    });
    closeBtn?.addEventListener('click', () => this.hidePopup());
  }

  addToVocab(character) {
    const matches = this.dictionary[character];
    if (!matches || matches.length === 0) return;

    const vocabItem = {
      character: character,
      pinyin: matches[0].pinyin,
      definition: matches[0].definition,
      dateAdded: new Date().toISOString()
    };

    this.vocabList.push(vocabItem);
    this.saveVocabList();
    this.updatePopupButton('Added to Vocab!', true);
    
    setTimeout(() => {
      if (this.popup) {
        this.updatePopupButton('Already in Vocab', true);
      }
    }, 1500);
  }

  async saveVocabList() {
    try {
      // In a real extension, use chrome.storage.sync.set()
      localStorage.setItem('chineseExtensionVocabList', JSON.stringify(this.vocabList));
    } catch (error) {
      console.warn('Could not save vocab list:', error);
    }
  }

  async loadVocabList() {
    try {
      const stored = localStorage.getItem('chineseExtensionVocabList');
      if (stored) {
        this.vocabList = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Could not load vocab list:', error);
    }
  }

  updatePopupButton(text, disabled) {
    const addBtn = this.popup?.querySelector('.add-vocab-btn');
    if (addBtn) {
      addBtn.textContent = text;
      addBtn.disabled = disabled;
    }
  }

  hidePopup(event) {
    // Don't hide popup if mouse is over it or if this is called from a click inside the popup
    if (this.popup && event && this.popup.contains(event.target)) {
      return;
    }
    
    if (this.popup && (!event || !this.popup.contains(event.target))) {
      this.popup.remove();
      this.popup = null;
      this.isMouseOverPopup = false;
    }
  }

  // Method to manually reprocess page (useful for dynamic content)
  reprocessPage() {
    this.pageProcessed = false;
    // Clear existing styling
    document.querySelectorAll('.chinese-unknown-word').forEach(el => {
      el.classList.remove('chinese-unknown-word');
    });
    this.unknownWordElements.clear();
    this.processPageForUnknownWords();
  }

  // Method to get statistics
  getStats() {
    const totalWords = Object.keys(this.dictionary).length;
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