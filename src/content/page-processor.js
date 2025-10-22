class PageProcessor {
  constructor(dictionaryManager, vocabManager, languageRegistry, unknownWordElements) {
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.languageRegistry = languageRegistry;
    this.unknownWordElements = new Map();
    this.injectedCSS = false;
    this.asbplayerObservers = new Set();
    
    // Initialize processing when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeProcessing());
    } else {
      this.initializeProcessing();
    }
  }

  initializeProcessing() {
    // Process the page initially
    this.processPageForUnknownWords();
    // Set up observer for dynamic changes
    //this.observePageChanges();
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
    const adapter = this.languageRegistry.getAdapter();
    const sentenceBoundary = adapter ? adapter.getSentenceBoundary() : /(?<=[.!?。！？\n])/;
    const sentences = fullText.split(sentenceBoundary);
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
    const adapter = this.languageRegistry.getAdapter();
    const hasTargetLanguage = adapter ? adapter.containsTargetLanguage(text) : false;
    if (hasTargetLanguage) return true;
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
        const adapter = this.languageRegistry.getAdapter();
        const words = adapter ? adapter.extractWords(textNode.textContent, this.dictionaryManager.dictionary) : [];
        for (const { word } of words) {
            totalWords++;
            if (this.vocabManager.isWordKnown(word)) {
                knownWords++;
            }
        }
    }

    // Store totals for sidebar access
    this.lastTotalWords = totalWords;
    this.lastKnownWords = knownWords;

    if (totalWords === 0) return 100; // If no words, consider comprehension 100%
    const percentage = Math.round((knownWords / totalWords) * 100);

    // Notify sidebar of updated data
    this.notifySidebarUpdate();

    return percentage;
  }

  getTotalWordsCount() {
    return this.lastTotalWords || 0;
  }

  getKnownWordsCount() {
    return this.lastKnownWords || 0;
  }

  notifySidebarUpdate() {
    // Notify sidebar manager of data changes
    if (window.sidebarManager && window.sidebarManager.refreshData) {
      // Use a small delay to ensure all processing is complete
      setTimeout(() => {
        window.sidebarManager.refreshData();
      }, 100);
    }
  }

  reprocessPage() {
    // Clear existing data
    this.unknownWordElements.clear();

    // Reprocess the page
    this.processPageForUnknownWords();

    // Recalculate comprehension
    this.calculateComprehensionPercentage();
  }

  analyzeASBPlayerSubtitlesComprehension(subtitlesText) {
  // subtitlesText: string containing all subtitles for the video
  const adapter = this.languageRegistry.getAdapter();
  const words = adapter ? adapter.extractWords(subtitlesText, this.dictionaryManager.dictionary) : [];
  let totalWords = words.length;
  let knownWords = words.filter(({ word }) => this.vocabManager.isWordKnown(word)).length;
  if (totalWords === 0) return 100;
  return Math.round((knownWords / totalWords) * 100);
}


  ensureGlobalCSS() {
    if (this.injectedCSS) return;
    
    if (document.getElementById('chinese-extension-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'chinese-extension-styles';
    style.textContent = `
      .lang-unknown-word {
        text-decoration: underline !important;
        text-decoration-color: #ff4444 !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 2px !important;
        cursor: help !important;
      }
      .lang-unknown-word:hover {
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

    const adapter = this.languageRegistry.getAdapter();
    const words = adapter ? adapter.extractWords(text, this.dictionaryManager.dictionary) : [];
    if (words.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    words.forEach(({ word, start, end }) => {
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }
      const span = document.createElement('span');
      span.textContent = word;
      span.setAttribute('data-word', word); // Always add data-word

      // Convert word to lowercase for dictionary lookup while preserving display
      const lowercaseWord = word.toLowerCase();
      if (!this.vocabManager.isWordKnown(lowercaseWord) && 
          this.dictionaryManager.dictionary[lowercaseWord] && 
          !this.vocabManager.isWordIgnored(lowercaseWord)) {
        span.className = 'lang-unknown-word';
        this.unknownWordElements.set(lowercaseWord, span);
      }

      fragment.appendChild(span);
      lastIndex = end;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  // Legacy method - now handled by language adapters
  extractChineseWords(text) {
    console.warn('extractChineseWords is deprecated. Use language adapters instead.');
    const adapter = this.languageRegistry.getAdapter();
    return adapter ? adapter.extractWords(text, this.dictionaryManager.dictionary) : [];
  }

  updateWordStyling(word, isKnownOrIgnored) {
    const elements = document.querySelectorAll(`[data-word="${word}"]`);
    elements.forEach(element => {
      if (isKnownOrIgnored) {
        // Remove underline for both known and ignored words
        element.classList.remove('lang-unknown-word');
      } else {
        // Add underline only for unknown words (not ignored)
        if (!this.vocabManager.isWordIgnored(word)) {
          element.classList.add('lang-unknown-word');
        }
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

  // Legacy method - now handled by language adapters
  isChineseCharacter(char) {
    console.warn('isChineseCharacter is deprecated. Use language adapters instead.');
    const adapter = this.languageRegistry.getAdapter();
    return adapter ? adapter.isTargetCharacter(char) : false;
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

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    // For space-separated languages, find complete words, not individual characters
    const words = adapter.extractWords(text, this.dictionaryManager.dictionary);
    
    for (const wordData of words) {
      const range = document.createRange();
      range.setStart(textNode, wordData.start);
      range.setEnd(textNode, wordData.end);
      
      const rect = range.getBoundingClientRect();
      
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom) {
        return {
          word: wordData.word,
          textNode,
          start: wordData.start,
          end: wordData.end
        };
      }
    }
    
    return null;
  }

  findLongestWord(textNode, startOffset) {
    const text = textNode.textContent;
    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    // Use adapter's extractWords method to find all words
    const words = adapter.extractWords(text, this.dictionaryManager.dictionary);
    
    // Find the word that contains the startOffset position
    for (const wordData of words) {
      if (startOffset >= wordData.start && startOffset < wordData.end) {
        return {
          word: wordData.word,
          textNode,
          start: wordData.start,
          end: wordData.end
        };
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

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    // Use adapter's extractWords method to find all words
    const words = adapter.extractWords(textNode.textContent, this.dictionaryManager.dictionary);
    
    // Find the word that contains the offset position
    for (const wordData of words) {
      if (offset >= wordData.start && offset < wordData.end) {
        return {
          word: wordData.word,
          textNode,
          start: wordData.start,
          end: wordData.end
        };
      }
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
      document.querySelectorAll('.lang-unknown-word').forEach((el) => {
        el.classList.remove('lang-unknown-word');
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