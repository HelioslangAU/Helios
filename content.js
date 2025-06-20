// Chinese Language Learning Extension - Content Script
class ChineseLanguageLearningExtension {
  constructor() {
    this.popup = null;
    this.currentCharacter = '';
    this.vocabList = [];
    this.dictionary = {};
    this.init();
  }

  async init() {
    await this.loadDictionary();
    await this.loadVocabList();
    this.setupEventListeners();
    this.injectSubtitleReader();
    console.log('Chinese Language Learning Extension initialized');
  }

  // Load Chinese dictionary data from CC-CEDICT .u8 file
  async loadDictionary() {
    try {
      this.dictionary = {};
      
      // Try to load from extension's dictionary file
      const dictionaryUrl = chrome.runtime.getURL('cedict_ts.u8');
      
      try {
        const response = await fetch(dictionaryUrl);
        const text = await response.text();
        this.parseCEDICT(text);
        console.log('CC-CEDICT loaded with', Object.keys(this.dictionary).length, 'entries');
      } catch (error) {
        console.warn('Could not load CC-CEDICT file, using fallback dictionary:', error);
        this.loadFallbackDictionary();
      }
    } catch (error) {
      console.error('Failed to load Chinese dictionary:', error);
      this.loadFallbackDictionary();
    }
  }

  // Parse CC-CEDICT format
  parseCEDICT(cedictText) {
  const lines = cedictText.split('\n');
  let processedEntries = 0;

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    try {
      const match = line.match(/^(.+?)\s+(.+?)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
      if (match) {
        const [, traditional, simplified, pinyin, definitions] = match;
        const traditionalClean = traditional.trim();
        const simplifiedClean = simplified.trim();
        const pinyinClean = pinyin.trim();
        const definitionList = definitions.split('/').filter(def => def.trim() !== '');

        const entryData = {
          traditional: traditionalClean,
          simplified: simplifiedClean,
          pinyin: pinyinClean,
          definition: definitionList.join('; '),
          tone: this.extractToneFromPinyin(pinyinClean)
        };

        // Store full traditional and simplified as keys
        if (!this.dictionary[traditionalClean]) {
          this.dictionary[traditionalClean] = { ...entryData, character: traditionalClean };
        }
        if (!this.dictionary[simplifiedClean]) {
          this.dictionary[simplifiedClean] = { ...entryData, character: simplifiedClean };
        }

        processedEntries++;
        if (processedEntries % 10000 === 0) {
          console.log(`Processed ${processedEntries} entries...`);
        }
      }
    } catch (error) {
      console.error('Error processing line:', line.substring(0, 100), error);
      continue;
    }
  }
  console.log(`Successfully processed ${processedEntries} CC-CEDICT entries`);
}

  // Extract tone number from pinyin
  extractToneFromPinyin(pinyin) {
    // Remove tone marks and extract first tone number
    const toneMarks = {
      'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'a': 0,
      'ē': 1, 'é': 2, 'ě': 3, 'è': 4, 'e': 0,
      'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'i': 0,
      'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4, 'o': 0,
      'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'u': 0,
      'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4, 'ü': 0
    };
    
    // Check for tone marks
    for (const char of pinyin) {
      if (toneMarks[char] !== undefined && toneMarks[char] > 0) {
        return toneMarks[char];
      }
    }
    
    // Check for tone numbers (like "ni3")
    const toneMatch = pinyin.match(/[1-4]/);
    if (toneMatch) {
      return parseInt(toneMatch[0]);
    }
    
    return 0; // Neutral tone
  }

  // Fallback dictionary in case CC-CEDICT file is not available
  loadFallbackDictionary() {
    this.dictionary = {
      '你': { 
        traditional: '你', 
        simplified: '你', 
        pinyin: 'nǐ', 
        definition: 'you (informal)', 
        tone: 3 
      },
      '好': { 
        traditional: '好', 
        simplified: '好', 
        pinyin: 'hǎo', 
        definition: 'good, well', 
        tone: 3 
      },
      '我': { 
        traditional: '我', 
        simplified: '我', 
        pinyin: 'wǒ', 
        definition: 'I, me', 
        tone: 3 
      },
      '是': { 
        traditional: '是', 
        simplified: '是', 
        pinyin: 'shì', 
        definition: 'to be, yes', 
        tone: 4 
      },
      '的': { 
        traditional: '的', 
        simplified: '的', 
        pinyin: 'de', 
        definition: 'possessive particle', 
        tone: 0 
      },
      '不': { 
        traditional: '不', 
        simplified: '不', 
        pinyin: 'bù', 
        definition: 'not, no', 
        tone: 4 
      },
      '在': { 
        traditional: '在', 
        simplified: '在', 
        pinyin: 'zài', 
        definition: 'at, in, on', 
        tone: 4 
      },
      '有': { 
        traditional: '有', 
        simplified: '有', 
        pinyin: 'yǒu', 
        definition: 'to have, there is', 
        tone: 3 
      },
      '中': { 
        traditional: '中', 
        simplified: '中', 
        pinyin: 'zhōng', 
        definition: 'middle, center, China', 
        tone: 1 
      },
      '国': { 
        traditional: '國', 
        simplified: '国', 
        pinyin: 'guó', 
        definition: 'country, nation', 
        tone: 2 
      }
    };
    
    console.log('Fallback dictionary loaded with', Object.keys(this.dictionary).length, 'characters');
  }

  // Load saved vocabulary list
  async loadVocabList() {
    try {
      const result = await chrome.storage.local.get(['chineseVocabList']);
      this.vocabList = result.chineseVocabList || [];
    } catch (error) {
      console.error('Failed to load vocab list:', error);
    }
  }

  // Save vocabulary list
  async saveVocabList() {
    try {
      await chrome.storage.local.set({ chineseVocabList: this.vocabList });
    } catch (error) {
      console.error('Failed to save vocab list:', error);
    }
  }

  // Setup event listeners for shift+hover and clicks
  setupEventListeners() {
    this.isShiftPressed = false;
    this.hoverTimeout = null;
    
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('click', (e) => this.hidePopup(e));
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Prevent text selection during shift mode
    document.addEventListener('selectstart', (e) => {
      if (this.isShiftPressed) {
        e.preventDefault();
        return false;
      }
    });
    
    document.addEventListener('dragstart', (e) => {
      if (this.isShiftPressed) {
        e.preventDefault();
        return false;
      }
    });
    
    // Keep the old text selection method as backup (only when shift is not pressed)
    document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
    
    console.log('Event listeners setup complete');
  }

  // Handle mouse movement for shift+hover
  handleMouseMove(event) {
    if (!this.isShiftPressed) return;
    
    // Clear previous timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Add small delay to avoid too many lookups
    this.hoverTimeout = setTimeout(() => {
      const character = this.getCharacterAtPosition(event);
      if (character) {
        this.currentCharacter = character;
        this.showDictionaryPopup(event.pageX, event.pageY, character);
      }
    }, 100);
  }

  // Handle key events for shift detection
  handleKeyDown(event) {
    if (event.key === 'Shift' && !this.isShiftPressed) {
      this.isShiftPressed = true;

      document.body.style.cursor = 'crosshair';
      document.body.setAttribute('data-shift-active', 'true');

      // Clear any existing text selection
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }

      console.log('Shift mode activated');
    }
  }

  handleKeyUp(event) {
    if (event.key === 'Shift') {
      this.isShiftPressed = false;

      document.body.style.cursor = '';
      document.body.removeAttribute('data-shift-active');
      this.hidePopup();

      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
      }

      console.log('Shift mode deactivated');
    }
  }

  // Get Chinese character at mouse position
  getCharacterAtPosition(event) {
    try {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element) return null;

      const range = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (range) {
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
          const text = textNode.textContent;
          const offset = range.startOffset;

          // Only consider Chinese characters
          if (!this.isChineseCharacter(text[offset])) return null;

          // Try to find the longest valid word (up to 5 chars) starting at offset
          let longestWord = '';
          for (let len = 5; len >= 1; len--) {
            const candidate = text.substr(offset, len);
            if (
              candidate.length === len &&
              [...candidate].every(c => this.isChineseCharacter(c)) &&
              this.dictionary[candidate]
            ) {
              longestWord = candidate;
              break; // Prefer the longest match
            }
          }

          // Fallback: single character if no compound word found
          if (!longestWord && this.isChineseCharacter(text[offset])) {
            longestWord = text[offset];
          }

          return longestWord || null;
        }
      }

      // Fallback: get first contiguous Chinese word from element
      const textContent = element.textContent || element.innerText;
      if (textContent) {
        const match = textContent.match(/[\u4e00-\u9fff]+/);
        if (match && this.dictionary[match[0]]) {
          return match[0];
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting character at position:', error);
      return null;
    }
  }

  // Check if character is Chinese
  isChineseCharacter(char) {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
      (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
      (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
      (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Extension E
      (code >= 0x2CEB0 && code <= 0x2EBEF) || // CJK Extension F
      (code >= 0x3000 && code <= 0x303F) ||  // CJK Symbols and Punctuation
      (code >= 0xFF00 && code <= 0xFFEF)     // Halfwidth and Fullwidth Forms
    );
  }

  // Handle text selection for dictionary lookup (backup method)
  handleTextSelection(event) {
    // Only use this if shift is not pressed (to avoid conflicts)
    if (this.isShiftPressed) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length === 1 && this.isChineseCharacter(selectedText)) {
      this.currentCharacter = selectedText;
      this.showDictionaryPopup(event.pageX, event.pageY, selectedText);
    } else if (selectedText && selectedText.length > 1) {
      // Handle multi-character selection - show first character
      for (let char of selectedText) {
        if (this.isChineseCharacter(char)) {
          this.currentCharacter = char;
          this.showDictionaryPopup(event.pageX, event.pageY, char);
          break;
        }
      }
    }
  }

  // Show dictionary popup
  showDictionaryPopup(x, y, character) {
    this.hidePopup();

    const popup = document.createElement('div');
    popup.className = 'chinese-lang-extension-popup';
    popup.innerHTML = this.createPopupContent(character);

    // Position popup
    popup.style.left = `${x}px`;
    popup.style.top = `${y + 20}px`;

    document.body.appendChild(popup);
    this.popup = popup;

    // Add CSS styles
    this.addPopupStyles();

    // Add event listeners to popup buttons
    this.setupPopupEventListeners(popup, character);
  }

  // Add CSS styles for popup
  addPopupStyles() {
    if (document.getElementById('chinese-extension-styles')) return;

    const style = document.createElement('style');
    style.id = 'chinese-extension-styles';
    style.textContent = `
      .chinese-lang-extension-popup {
        position: absolute;
        background: white;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #333;
      }
      
      .chinese-lang-extension-popup .character {
        font-size: 36px;
        font-weight: bold;
        color: #2196F3;
        margin-bottom: 8px;
        text-align: center;
        font-family: 'Microsoft YaHei', 'SimHei', 'Arial Unicode MS', sans-serif;
      }
      
      .chinese-lang-extension-popup .pinyin {
        font-size: 16px;
        color: #FF9800;
        font-weight: bold;
        margin-bottom: 8px;
        text-align: center;
        font-style: italic;
      }
      
      .chinese-lang-extension-popup .variants {
        font-size: 12px;
        color: #666;
        margin-bottom: 8px;
        text-align: center;
      }
      
      .chinese-lang-extension-popup .definition {
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
        line-height: 1.4;
      }
      
      .chinese-lang-extension-popup .tone-indicator {
        display: inline-block;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        color: white;
        text-align: center;
        line-height: 20px;
        font-size: 12px;
        font-weight: bold;
        margin-left: 8px;
      }
      
      .tone-1 { background-color: #F44336; }
      .tone-2 { background-color: #FF9800; }
      .tone-3 { background-color: #4CAF50; }
      .tone-4 { background-color: #2196F3; }
      .tone-0 { background-color: #9E9E9E; }
      
      .chinese-lang-extension-popup .popup-buttons {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      
      .chinese-lang-extension-popup button {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
      }
      
      .chinese-lang-extension-popup .add-vocab-btn {
        background-color: #4CAF50;
        color: white;
      }
      
      .chinese-lang-extension-popup .add-vocab-btn:hover {
        background-color: #45a049;
      }
      
      .chinese-lang-extension-popup .add-vocab-btn:disabled {
        background-color: #ccc;
        cursor: not-allowed;
      }
      
      .chinese-lang-extension-popup .close-btn {
        background-color: #f44336;
        color: white;
      }
      
      .chinese-lang-extension-popup .close-btn:hover {
        background-color: #da190b;
      }
      
      [data-shift-active="true"], [data-shift-active="true"] * {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
      [data-shift-active="true"] .chinese-lang-extension-popup,
      [data-shift-active="true"] .chinese-lang-extension-popup * {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }
      [data-shift-active="true"] *::selection {
        background: transparent !important;
      }
      [data-shift-active="true"] *::-moz-selection {
        background: transparent !important;
      }
    `;
    
    document.head.appendChild(style);
  }

  // Create popup content
  createPopupContent(character) {
    const definition = this.dictionary[character];
    const isInVocab = this.vocabList.some(item => item.character === character);

    if (!definition) {
      return `
        <div class="popup-content">
          <div class="character">${character}</div>
          <div class="definition">Character not found in dictionary</div>
          <button class="add-vocab-btn" disabled>
            Unknown Character
          </button>
        </div>
      `;
    }

    const toneClass = `tone-${definition.tone}`;
    const variants = definition.traditional !== definition.simplified 
      ? `Traditional: ${definition.traditional} | Simplified: ${definition.simplified}` 
      : '';

    return `
      <div class="popup-content">
        <div class="character">${character}</div>
        <div class="pinyin">
          ${definition.pinyin}
          <span class="tone-indicator ${toneClass}">${definition.tone}</span>
        </div>
        ${variants ? `<div class="variants">${variants}</div>` : ''}
        <div class="definition">${definition.definition}</div>
        <div class="popup-buttons">
          <button class="add-vocab-btn" ${isInVocab ? 'disabled' : ''}>
            ${isInVocab ? 'Already in Vocab' : 'Add to Vocab'}
          </button>
          <button class="close-btn">Close</button>
        </div>
      </div>
    `;
  }

  // Setup popup event listeners
  setupPopupEventListeners(popup, character) {
    const addVocabBtn = popup.querySelector('.add-vocab-btn');
    const closeBtn = popup.querySelector('.close-btn');

    if (addVocabBtn && !addVocabBtn.disabled) {
      addVocabBtn.addEventListener('click', () => this.addToVocab(character));
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePopup());
    }
  }

  // Add character to vocabulary list
  async addToVocab(character) {
    const definition = this.dictionary[character];
    if (definition && !this.vocabList.some(item => item.character === character)) {
      this.vocabList.push({
        character: character,
        traditional: definition.traditional,
        simplified: definition.simplified,
        pinyin: definition.pinyin,
        definition: definition.definition,
        tone: definition.tone,
        dateAdded: new Date().toISOString(),
        reviewCount: 0
      });
      
      await this.saveVocabList();
      
      // Update popup to show character was added
      if (this.popup) {
        const addBtn = this.popup.querySelector('.add-vocab-btn');
        if (addBtn) {
          addBtn.textContent = 'Added to Vocab!';
          addBtn.disabled = true;
        }
      }
    }
  }

  // Hide popup
  hidePopup(event) {
    if (this.popup && (!event || !this.popup.contains(event.target))) {
      this.popup.remove();
      this.popup = null;
    }
  }

  // Inject subtitle reader functionality
  injectSubtitleReader() {
    // Look for common video players and subtitle elements
    this.findAndProcessSubtitles();
    
    // Monitor for dynamically added subtitles
    const observer = new MutationObserver(() => {
      this.findAndProcessSubtitles();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Find and process subtitles
  findAndProcessSubtitles() {
    // Common subtitle selectors for popular video platforms
    const subtitleSelectors = [
      '.caption-window',           // YouTube
      '.player-timedtext',         // YouTube
      '.subtitle',                 // Generic
      '.subtitles',                // Generic
      '.captions',                 // Generic
      '[data-purpose="captions-display"]', // Udemy
      '.vjs-text-track-display',   // Video.js
      '.plyr__captions'            // Plyr
    ];

    subtitleSelectors.forEach(selector => {
      const subtitleElements = document.querySelectorAll(selector);
      subtitleElements.forEach(element => {
        if (!element.classList.contains('chinese-lang-extension-processed')) {
          this.processSubtitleElement(element);
          element.classList.add('chinese-lang-extension-processed');
        }
      });
    });
  }

  // Process individual subtitle elements
  processSubtitleElement(element) {
    // Make subtitle text selectable and add hover effects
    element.style.userSelect = 'text';
    element.style.cursor = 'text';
    
    // Add click handler for subtitle text
    element.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Highlight subtitle container for Chinese content
    element.style.border = '1px solid #FF9800';
    element.style.borderRadius = '3px';
    element.title = 'Hold Shift and hover over Chinese characters for translation';
  }
}

// Initialize the Chinese extension
const chineseLanguageLearningExtension = new ChineseLanguageLearningExtension();