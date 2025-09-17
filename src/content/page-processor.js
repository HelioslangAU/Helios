class PageProcessor {
  constructor(dictionaryManager, vocabManager, unknownWordElements) {
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.unknownWordElements = new Map();
    this.injectedCSS = false;
    this.asbplayerObservers = new Set();
  }

  // Extract a sentence around a word from a given text node's container
  getSentenceContextFromNode(textNode, word) {
    let container = textNode?.parentElement;

    for (let i = 0; i < 5 && container; i++) {
      const displayStyle = window.getComputedStyle(container).display;
      if (["block", "list-item", "table-cell", "flex"].includes(displayStyle)) {
        break;
      }
      container = container.parentElement;
    }

    if (!container) container = textNode?.parentElement;
    if (!container) return word;

    const fullText = container.textContent || '';
    const sentences = fullText.split(/(?<=[.!?。！？\n])/);
    for (const sentence of sentences) {
      if (sentence.includes(word)) {
        const trimmed = sentence.trim();
        if (trimmed) return trimmed;
      }
    }
    return (container.textContent || '').trim() || word;
  }

  // Heuristics to detect likely subtitle containers (e.g., asbplayer)
  isLikelySubtitleElement(element) {
    const text = element.textContent || "";
    const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
    if (hasChinese) return true;
    const attributeText = [
      element.className,
      element.id,
      element.getAttribute("data-testid") || "",
      element.getAttribute("aria-label") || "",
    ].join(" ").toLowerCase();
    const subtitleKeywords = ["subtitle", "caption", "asbplayer", "timedtext"];
    return subtitleKeywords.some((kw) => attributeText.includes(kw));
  }

  // Discover and observe new subtitle-like elements for processing
  detectAsbplayerElements() {
    const selectors = [
      '.asbplayer-offscreen'
    ];
    const found = new Set();
    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (this.isLikelySubtitleElement(el)) {
            found.add(el);
          }
        });
      } catch (_) {}
    });
    found.forEach((el) => {
      if (!el.hasAttribute('data-chinese-processed')) {
        el.setAttribute('data-chinese-processed', 'true');
        this.observeSubtitleContainer(el);
      }
    });
  }

  processPageForUnknownWords() {
    // Ensure CSS is injected globally
    this.ensureGlobalCSS();
    const textNodes = this.getAllTextNodes(document.body);

    for (const textNode of textNodes) {
      this.processTextNodeForUnknownWords(textNode);
    }

    console.log('Page processed for unknown words');
  }

  calculateComprehensionPercentage() {
    // Get all text nodes in the body
    const textNodes = this.getAllTextNodes(document.body);
    let totalWords = 0;
    let knownWords = 0;

    for (const textNode of textNodes) {
        const chineseWords = this.extractChineseWords(textNode.textContent);
        for (const { word } of chineseWords) {
            totalWords++;
            if (this.vocabManager.isWordKnown(word)) {
                knownWords++;
            }
        }
    }
    if (totalWords === 0) return 100; // If no words, consider comprehension 100%
    return Math.round((knownWords / totalWords) * 100);
  }

  analyzeASBPlayerSubtitlesComprehension(subtitlesText) {
  // subtitlesText: string containing all subtitles for the video
  const chineseWords = this.extractChineseWords(subtitlesText);
  let totalWords = chineseWords.length;
  let knownWords = chineseWords.filter(({ word }) => this.vocabManager.isWordKnown(word)).length;
  if (totalWords === 0) return 100;
  return Math.round((knownWords / totalWords) * 100);
}


  ensureGlobalCSS() {
    if (this.injectedCSS) return;
    
    if (document.getElementById('chinese-extension-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'chinese-extension-styles';
    style.textContent = `
      .chinese-unknown-word {
        text-decoration: underline !important;
        text-decoration-color: #ff4444 !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 2px !important;
        cursor: help !important;
      }
      .chinese-unknown-word:hover {
        background-color: rgba(255, 68, 68, 0.1) !important;
      }
    `;
    document.head.appendChild(style);
    this.injectedCSS = true;
  }

  getAllTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Fix: Don't filter out existing processed elements for reprocessing
          if (parent.classList.contains('chinese-lang-extension-popup')) {
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

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    chineseWords.forEach(({ word, start, end }) => {
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }
      const span = document.createElement('span');
      span.textContent = word;
      span.setAttribute('data-word', word); // Always add data-word

      if (!this.vocabManager.isWordKnown(word) && this.dictionaryManager.dictionary[word]) {
        span.className = 'chinese-unknown-word';
        this.unknownWordElements.set(word, span);
      }

      fragment.appendChild(span);
      lastIndex = end;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  extractChineseWords(text) {
    const words = [];
    let i = 0;

    while (i < text.length) {
      if (this.isChineseCharacter(text[i])) {
        let longestWord = null;
        let longestLength = 0;

        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);
          if ([...candidate].every(c => this.isChineseCharacter(c)) && this.dictionaryManager.dictionary[candidate]) {
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
          if (this.dictionaryManager.dictionary[text[i]]) {
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
    const elements = document.querySelectorAll(`[data-word="${word}"]`);
    elements.forEach(element => {
      if (isKnown) {
        element.classList.remove('chinese-unknown-word');
      } else {
        element.classList.add('chinese-unknown-word');
      }
    });
  }

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

  isChineseCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x20000 && code <= 0x2A6DF);
  }

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
            this.dictionaryManager.dictionary[candidate]) {
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
            this.dictionaryManager.dictionary[candidate]) {
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

  // Fix: Better asbplayer integration
  observeSubtitleContainer(element) {
    // Ensure global CSS is available
    this.ensureGlobalCSS();

    // Track last text content to avoid unnecessary reprocessing
    if (!element._lastChineseText) {
      element._lastChineseText = element.textContent;
    }

    // Process immediately
    this.forceReprocessElement(element);
    element._lastChineseText = element.textContent;

    // Set up observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      let hasChanges = false;
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || 
            (mutation.type === 'characterData' && mutation.target.textContent.trim())) {
          hasChanges = true;
        }
      });
      if (hasChanges) {
        clearTimeout(this.asbplayerTimeout);
        this.asbplayerTimeout = setTimeout(() => {
          // Only reprocess if text content actually changed
          const currentText = element.textContent;
          if (element._lastChineseText !== currentText) {
            this.forceReprocessElement(element);
            element._lastChineseText = currentText;
          }
        }, 50);
      }
    });

    observer.observe(element, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    this.asbplayerObservers.add(observer);
  }

  forceReprocessElement(element) {

    // --- Preserve highlight if present ---
    let highlightedWord = null;
    let highlightText = null;
    const highlightEl = element.querySelector('.lookup-highlight');
    if (highlightEl) {
      highlightedWord = highlightEl.getAttribute('data-word') || highlightEl.textContent;
      highlightText = highlightEl.textContent;
    }

    // Clear existing processed spans in this element to avoid double-processing
    const existingSpans = element.querySelectorAll('span[data-word]');
    existingSpans.forEach(span => {
      const parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize(); // Merge adjacent text nodes
    });

    // Process all text nodes in the element
    const textNodes = this.getAllTextNodes(element);
    for (const textNode of textNodes) {
      this.processTextNodeForUnknownWords(textNode);
    }

    // --- Restore highlight if possible ---
    if (highlightedWord && highlightText) {
      // Find the new span for the same word/text
      const newHighlight = Array.from(element.querySelectorAll('span[data-word]')).find(
        el => el.textContent === highlightText
      );
      if (newHighlight) {
        newHighlight.classList.add('lookup-highlight');
        if (window.highlightManager) {
          window.highlightManager.currentHighlight = newHighlight;
        }
      }
    }
  const container = document.querySelector('.asbplayer-offscreen');
  if (container) {
    console.log(container.innerText);
    window.bannerManager.updateComprehension(this.analyzeASBPlayerSubtitlesComprehension(container.innerText));
  } else {
    console.warn("ASBPlayer subtitle container not found!");
  }
    console.log('Finished reprocessing, unknown words should be underlined');
  }

  // Remove unknown word styling and clear tracked elements
  clearUnknownWordHighlights() {
    try {
      document.querySelectorAll('.chinese-unknown-word').forEach((el) => {
        el.classList.remove('chinese-unknown-word');
      });
      this.unknownWordElements?.clear?.();
    } catch (_) {}
  }

  // Clear both lookup highlight and unknown word highlights
  clearHighlights() {
    try {
      if (window.highlightManager && window.highlightManager.removeLookupHighlight) {
        window.highlightManager.removeLookupHighlight();
      }
    } catch (_) {}
    this.clearUnknownWordHighlights();
  }

  // Handle auto-highlight toggling and reprocessing
  handleAutoHighlightUpdate(enabled, extensionEnabled = true) {
    if (enabled && extensionEnabled) {
      this.processPageForUnknownWords();
    } else {
      this.clearUnknownWordHighlights();
    }
  }
}