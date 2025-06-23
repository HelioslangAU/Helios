class ChineseLanguageLearningExtension {
  constructor() {
    this.popup = null;
    this.currentHighlight = null;
    this.dictionary = {};
    this.vocabList = [];
    this.isShiftPressed = false;
    this.hoverTimeout = null;
    this.lastMouseEvent = null;
    this.lastHighlightInfo = null;
    this.currentWord = null;
    
    this.init();
  }

  async init() {
    await Promise.all([this.loadDictionary()]);
    //this.setupEventListeners();
    this.initTextScannerEvents();
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
    //addEvent(document, 'pointerdown', this._onPointerDownTS.bind(this), capture);
    //addEvent(document, 'pointerup', this._onPointerUpTS.bind(this), capture);
    addEvent(document, 'keydown', this._onKeyDownTS.bind(this), capture);
    addEvent(document, 'keyup', this._onKeyUpTS.bind(this), capture);
    addEvent(document, 'selectstart', this._onSelectStartTS.bind(this), capture);
    addEvent(document, 'contextmenu', this._onContextMenuTS.bind(this), capture);
    addEvent(document, 'click', this._onClickTS.bind(this), capture);
  }

_onPointerMoveTS(event) {
    if (!this.isShiftPressed) return;
    this.lastPointerEvent = event;

    const characterInfo = this.getCharacterAtPosition(event);

    if (characterInfo && characterInfo.word) {
        if (
            this.currentWord === characterInfo.word &&
            this.currentHighlight &&
            this.currentHighlight.textContent === characterInfo.word
        ) return;

        this.removeLookupHighlight();

        // Re-find the text node after removing highlight
        const newCharacterInfo = this.getCharacterAtPosition(event);
        if (!newCharacterInfo) {
            this.hidePopup();
            return;
        }
        clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {

        this.showDictionaryPopup(event.pageX, event.pageY, newCharacterInfo.word);
        this.highlightLookupText(newCharacterInfo.textNode, newCharacterInfo.start, newCharacterInfo.end);
      }, 10);
        this.currentWord = newCharacterInfo.word;
        console.log('Character info:', newCharacterInfo);
    } else {
        this.hidePopup();
        this.removeLookupHighlight();
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

  preventSelection(event) {
    if (this.isShiftPressed) {
      event.preventDefault();
      return false;
    }
  }

  preventContextMenu(event) {
    if (this.isShiftPressed) {
      event.preventDefault();
      return false;
    }
  }

  highlightLookupText(node, start, end) {
  // Remove previous highlight if it exists
  this.removeLookupHighlight();

  if (!node || start === end || !node.parentNode) return;

  const text = node.textContent;
  const before = text.slice(0, start);
  const target = text.slice(start, end);
  const after = text.slice(end);

  // Create new nodes
  const beforeNode = document.createTextNode(before);
  const highlightSpan = document.createElement('span');
  highlightSpan.className = 'lookup-highlight';
  highlightSpan.textContent = target;
  const afterNode = document.createTextNode(after);

  // Replace the original text node
  const parent = node.parentNode;
  parent.insertBefore(beforeNode, node);
  parent.insertBefore(highlightSpan, node);
  parent.insertBefore(afterNode, node);
  parent.removeChild(node);

  // Save reference for later removal
  this.currentHighlight = highlightSpan;
}

// Removes the highlight
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
    // First try the more accurate approach
    const accurateResult = this.getCharacterAtPositionAccurate(event);
    if (accurateResult) return accurateResult;
    
    // Fallback to original method
    return this.getCharacterAtPositionFallback(event);
  } catch (error) {
    console.error('Error getting character at position:', error);
    return null;
  }
}

getCharacterAtPositionAccurate(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return null;

  // Find all text nodes within the element
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

  // Create a range to measure each character position
  const range = document.createRange();
  
  for (let i = 0; i < text.length; i++) {
    if (!this.isChineseCharacter(text[i])) continue;
    
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    
    const rect = range.getBoundingClientRect();
    
    // Check if the mouse position is within this character's bounds
    // Use a more generous hit area (not just the center)
    if (x >= rect.left && x <= rect.right && 
        y >= rect.top && y <= rect.bottom) {
      
      // Try to find the longest word starting from this position
      const wordResult = this.findLongestWord(textNode, i);
      if (wordResult) return wordResult;
      
      // Fallback to single character
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
  
  // Try to extract the longest word (up to 5 chars)
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

// Fallback method (your original approach with improvements)
getCharacterAtPositionFallback(event) {
  // Try multiple points around the cursor for better accuracy
  const offsets = [
    { x: 0, y: 0 },     // Original position
    { x: -2, y: 0 },    // Slightly left
    { x: 2, y: 0 },     // Slightly right
    { x: 0, y: -1 },    // Slightly up
    { x: 0, y: 1 }      // Slightly down
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

  // Your existing word extraction logic
  for (let len = 5; len >= 1; len--) {
    if (offset + len <= textNode.textContent.length) {
      const candidate = textNode.textContent.substring(offset, offset + len);
      if ([...candidate].every(c => this.isChineseCharacter(c)) &&
          this.dictionary[candidate]) {
        return { word: candidate, textNode, start: offset, end: offset + len };
      }
    }
  }

  // Fallback to single character
  const text = textNode.textContent;
  if (this.isChineseCharacter(text[offset])) {
    return { word: text[offset], textNode, start: offset, end: offset + 1 };
  }

  return null;
}

  isChineseCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
           (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
           (code >= 0x20000 && code <= 0x2A6DF); // CJK Extension B
  }

  //#region Popup Management
  // Popup Management
  showDictionaryPopup(x, y, character) {
    this.hidePopup();

    const popup = document.createElement('div');
    popup.className = 'chinese-lang-extension-popup';
    popup.innerHTML = this.createPopupContent(character);

    // Use the highlight range for positioning if available
    let posX = x, posY = y + 20;
    if (this.currentHighlightRange) {
      const rects = this.currentHighlightRange.getClientRects();
      if (rects.length > 0) {
        const rect = rects[0];
        posX = rect.left + window.scrollX;
        posY = rect.bottom + window.scrollY + 4;
      }
    }

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;

    document.body.appendChild(popup);
    this.popup = popup;
    this.setupPopupEventListeners(character);
  }

  createPopupContent(character) {
    const matches = this.dictionary[character] || [];
    const isInVocab = this.vocabList.some(item => item.character === character);

    if (matches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character highlight">${character}</div>
          <div class="definition">Character not found in dictionary</div>
          <button class="add-vocab-btn" disabled>Unknown Character</button>
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
          <button class="close-btn">Close</button>
        </div>
      </div>
    `;
  }

  setupPopupEventListeners(character) {
    const addVocabBtn = this.popup.querySelector('.add-vocab-btn:not([disabled])');
    const closeBtn = this.popup.querySelector('.close-btn');

    addVocabBtn?.addEventListener('click', () => this.addToVocab(character));
    closeBtn?.addEventListener('click', () => this.hidePopup());
  }

  updatePopupButton(text, disabled) {
    const addBtn = this.popup?.querySelector('.add-vocab-btn');
    if (addBtn) {
      addBtn.textContent = text;
      addBtn.disabled = disabled;
    }
  }

  hidePopup(event) {
    if (this.popup && (!event || !this.popup.contains(event.target))) {
      this.popup.remove();
      this.popup = null;
    }
  }
}

//#endregion

// Initialize extension
new ChineseLanguageLearningExtension();