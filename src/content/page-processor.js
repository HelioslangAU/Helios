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

    console.log(`⚡ Processing ${textNodes.length} text nodes...`);

    // Prioritize visible content for faster perceived performance
    const { visibleNodes, hiddenNodes } = this.partitionTextNodesByVisibility(textNodes);

    console.log(`📊 ${visibleNodes.length} visible, ${hiddenNodes.length} hidden nodes`);

    // INSTANT PROCESSING: Process visible nodes synchronously for immediate feedback
    // Then batch process remaining hidden nodes in background
    if (visibleNodes.length > 0) {
      const start = Date.now();
      visibleNodes.forEach(node => {
        try {
          this.processTextNodeForUnknownWords(node);
        } catch (e) {
          console.warn('Error processing visible node:', e);
        }
      });
      console.log(`✅ Visible nodes processed in ${Date.now() - start}ms`);

      // Calculate comprehension immediately after visible content is processed
      // This gives quick feedback to banner/stats even before full page is done
      this.calculateComprehensionPercentage();
    }

    // Process hidden nodes in background batches
    if (hiddenNodes.length > 0) {
      this.processBatchedTextNodes(hiddenNodes, () => {
        // Recalculate comprehension after all processing is complete
        this.calculateComprehensionPercentage();
        console.log(`📊 Full page comprehension calculated`);
      });
    } else if (visibleNodes.length === 0) {
      // If there are no nodes at all, still calculate
      this.calculateComprehensionPercentage();
    }
  }

  /**
   * Partition text nodes into visible and hidden for prioritized processing
   * @param {Array} textNodes - All text nodes
   * @returns {Object} - {visibleNodes, hiddenNodes}
   */
  partitionTextNodesByVisibility(textNodes) {
    const visibleNodes = [];
    const hiddenNodes = [];

    for (const node of textNodes) {
      const element = node.parentElement;
      if (!element) continue;

      // Quick visibility check
      const rect = element.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

      if (isVisible) {
        visibleNodes.push(node);
      } else {
        hiddenNodes.push(node);
      }
    }

    return { visibleNodes, hiddenNodes };
  }

  /**
   * Process text nodes in batches using requestIdleCallback for better performance
   * @param {Array} textNodes - Array of text nodes to process
   * @param {Function} onComplete - Callback when processing is complete
   */
  processBatchedTextNodes(textNodes, onComplete = null) {
    if (textNodes.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const BATCH_SIZE = 100; // Process 100 nodes at a time (increased for speed)
    let currentIndex = 0;
    const startTime = Date.now();

    const processBatch = (deadline) => {
      // Process nodes while we have idle time
      while (currentIndex < textNodes.length && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
        const batchEnd = Math.min(currentIndex + BATCH_SIZE, textNodes.length);

        for (let i = currentIndex; i < batchEnd; i++) {
          try {
            this.processTextNodeForUnknownWords(textNodes[i]);
          } catch (error) {
            // Skip problematic nodes
            console.warn('Error processing text node:', error);
          }
        }

        currentIndex = batchEnd;

        // Break if we've processed a batch
        if (currentIndex % BATCH_SIZE === 0) {
          break;
        }
      }

      // If there are more nodes, schedule next batch
      if (currentIndex < textNodes.length) {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(processBatch, { timeout: 1000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => processBatch({ timeRemaining: () => 50, didTimeout: false }), 0);
        }
      } else {
        const elapsed = Date.now() - startTime;
        console.log(`✅ Batch complete: ${textNodes.length} nodes in ${elapsed}ms`);
        if (onComplete) onComplete();
      }
    };

    // Start processing
    if (window.requestIdleCallback) {
      window.requestIdleCallback(processBatch, { timeout: 1000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => processBatch({ timeRemaining: () => 50, didTimeout: false }), 0);
    }
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