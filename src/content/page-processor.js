class PageProcessor {
  constructor(dictionaryManager, vocabManager, languageRegistry, unknownWordElements) {
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.languageRegistry = languageRegistry;
    this.unknownWordElements = new Map();
    this.injectedCSS = false;
    this.asbplayerObservers = new Set();

    // Performance optimization: debouncing
    this.reprocessTimeout = null;
    this.isReprocessing = false;

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
    
    // Listen for subtitle loaded events to recalculate comprehension
    this.setupSubtitleEventListeners();
  }

  /**
   * Setup event listeners for video subtitle events
   */
  setupSubtitleEventListeners() {
    // Listen for when subtitles are loaded (only fires once when subtitles are first loaded)
    document.addEventListener('helios-subtitles-loaded', () => {
      // Recalculate comprehension when subtitles are loaded
      setTimeout(async () => {
        await this.calculateComprehensionPercentage();
        // Notify sidebar after calculation
        this.notifySidebarUpdate();
        console.log('📊 Comprehension recalculated after subtitle load');
      }, 100);
    });

    // Note: We do NOT listen to 'helios-video-timeupdate' because:
    // 1. It fires every 100ms (every video tick)
    // 2. Subtitle text doesn't change - it's the full subtitle file
    // 3. Comprehension should only update when:
    //    - Subtitles are loaded
    //    - Vocabulary changes (word marked as known/unknown)
    //    - Page content changes
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

    // Use getBaseText to exclude pinyin/ruby RT tags
    const fullText = this.getBaseText(container) || container.textContent || '';
    const adapter = this.languageRegistry.getAdapter();
    const sentenceBoundary = adapter ? adapter.getSentenceBoundary() : /(?<=[.!?。！？\n])/;
    const sentences = fullText.split(sentenceBoundary);
    for (const sentence of sentences) {
      if (sentence.includes(word)) {
        const trimmed = sentence.trim();
        if (trimmed) return trimmed;
      }
    }
    // Use getBaseText for fallback too
    return this.getBaseText(container).trim() || word;
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

    // INSTANT PROCESSING: Process visible nodes for immediate feedback
    // Note: processTextNodeForUnknownWords is now async, but we process in parallel
    if (visibleNodes.length > 0) {
      const start = Date.now();
      // Process visible nodes in parallel (they preload words asynchronously)
      Promise.all(
        visibleNodes.map(node => 
          this.processTextNodeForUnknownWords(node).catch(e => {
            console.warn('Error processing visible node:', e);
          })
        )
      ).then(() => {
        console.log(`✅ Visible nodes processed in ${Date.now() - start}ms`);
      });

      // Calculate comprehension immediately after visible content is processed
      // This gives quick feedback to banner/stats even before full page is done
      this.calculateComprehensionPercentage().then(() => {
        // Notify sidebar after calculation
        this.notifySidebarUpdate();
      });
    }

    // Process hidden nodes in background batches
    if (hiddenNodes.length > 0) {
      this.processBatchedTextNodesAsync(hiddenNodes, async () => {
        // Recalculate comprehension after all processing is complete
        await this.calculateComprehensionPercentage();
        // Notify sidebar after calculation
        this.notifySidebarUpdate();
        console.log(`📊 Full page comprehension calculated`);
      });
    } else if (visibleNodes.length === 0) {
      // If there are no nodes at all, still calculate
      this.calculateComprehensionPercentage().then(() => {
        // Notify sidebar after calculation
        this.notifySidebarUpdate();
      });
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
            // Note: processTextNodeForUnknownWords is now async, but we call it without await
            // for performance. The async preloading happens inside.
            this.processTextNodeForUnknownWords(textNodes[i]).catch(err => {
              console.warn('Error processing text node:', err);
            });
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

  /**
   * Process text nodes in batches asynchronously (for async dictionary)
   * @param {Array} textNodes - Array of text nodes to process
   * @param {Function} onComplete - Callback when processing is complete
   */
  async processBatchedTextNodesAsync(textNodes, onComplete = null) {
    if (textNodes.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const BATCH_SIZE = 50; // Smaller batch size for async processing
    let currentIndex = 0;
    const startTime = Date.now();

    while (currentIndex < textNodes.length) {
      const batchEnd = Math.min(currentIndex + BATCH_SIZE, textNodes.length);
      const batch = textNodes.slice(currentIndex, batchEnd);

      // Process batch in parallel
      await Promise.all(
        batch.map(node => 
          this.processTextNodeForUnknownWords(node).catch(err => {
            console.warn('Error processing text node:', err);
          })
        )
      );

      currentIndex = batchEnd;

      // Yield to browser between batches
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Async batch complete: ${textNodes.length} nodes in ${elapsed}ms`);
    if (onComplete) onComplete();
  }

  /**
   * Check if video subtitles are active and get all subtitle text
   * @returns {string|null} - All subtitle text if video is active, null otherwise
   */
  getVideoSubtitleText() {
    // Check if video feature is available and initialized
    if (!window.heliosVideoFeature || !window.heliosVideoFeature.isInitialized) {
      return null;
    }

    // Get the primary video binding
    const binding = window.heliosVideoFeature.getPrimaryBinding();
    if (!binding) {
      return null;
    }

    // Check if subtitles are loaded
    const subtitleCollection = binding.getSubtitles();
    if (!subtitleCollection || subtitleCollection.isEmpty()) {
      return null;
    }

    // Get all subtitle entries and combine their text
    const entries = subtitleCollection.getAll();
    if (entries.length === 0) {
      return null;
    }

    // Combine all subtitle text
    const allSubtitleText = entries.map(entry => entry.text).join(' ');
    //console.log(allSubtitleText);
    return allSubtitleText;
  }

  /**
   * Calculate comprehension percentage from subtitle text
   * @param {string} subtitleText - Combined subtitle text
   * @returns {Promise<number>} - Comprehension percentage
   */
  async calculateSubtitleComprehension(subtitleText) {
    if (!subtitleText || !subtitleText.trim()) {
      return 100; // If no text, consider comprehension 100%
    }

    const adapter = this.languageRegistry.getAdapter();
    const words = adapter ? await adapter.extractWords(subtitleText, this.dictionaryManager.dictionary) : [];
    
    let totalWords = words.length;
    let knownWords = words.filter(({ word }) => this.vocabManager.isWordKnown(word)).length;

    // Store totals for sidebar access
    this.lastTotalWords = totalWords;
    this.lastKnownWords = knownWords;

    if (totalWords === 0) return 100; // If no words, consider comprehension 100%
    console.log(`Subtitle comprehension: ${knownWords} / ${totalWords} = ${Math.round((knownWords / totalWords) * 100)}%`);
    return Math.round((knownWords / totalWords) * 100);
  }

  async calculateComprehensionPercentage() {
    // First, check if video subtitles are active
    const subtitleText = this.getVideoSubtitleText();
    
    if (subtitleText !== null) {
      // Video subtitles are active - calculate based on subtitle text only
      const percentage = await this.calculateSubtitleComprehension(subtitleText);
      // NOTE: Do NOT call notifySidebarUpdate() here - let the caller decide when to notify
      // This prevents circular calls with refreshData()
      return percentage;
    }

    // No video subtitles - calculate normally from page text
    const textNodes = this.getAllTextNodes(document.body);
    let totalWords = 0;
    let knownWords = 0;

    for (const textNode of textNodes) {
        const adapter = this.languageRegistry.getAdapter();
        const words = adapter ? await adapter.extractWords(textNode.textContent, this.dictionaryManager.dictionary) : [];
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

    // NOTE: Do NOT call notifySidebarUpdate() here - let the caller decide when to notify
    // This prevents circular calls with refreshData()

    return percentage;
  }

  getTotalWordsCount() {
    return this.lastTotalWords || 0;
  }

  getKnownWordsCount() {
    return this.lastKnownWords || 0;
  }

  notifySidebarUpdate() {
    // Notify banner manager (which manages the side tab) of data changes
    if (window.bannerManager && window.bannerManager.refreshData) {
      // Use a small delay to ensure all processing is complete
      setTimeout(() => {
        window.bannerManager.refreshData();
      }, 100);
    }
  }

  reprocessPage() {
    // Debounce reprocessing to prevent excessive calls
    if (this.reprocessTimeout) {
      clearTimeout(this.reprocessTimeout);
    }

    this.reprocessTimeout = setTimeout(() => {
      // Skip if already reprocessing
      if (this.isReprocessing) return;

      this.isReprocessing = true;

      // Use requestAnimationFrame for smooth UI updates
      requestAnimationFrame(() => {
        // Clear existing data
        this.unknownWordElements.clear();

        // Reprocess the page
        this.processPageForUnknownWords();

        // Recalculate comprehension
        this.calculateComprehensionPercentage().then(() => {});

        this.isReprocessing = false;
      });
    }, 50); // 50ms debounce
  }

  async analyzeASBPlayerSubtitlesComprehension(subtitlesText) {
  // subtitlesText: string containing all subtitles for the video
  const adapter = this.languageRegistry.getAdapter();
  const words = adapter ? await adapter.extractWords(subtitlesText, this.dictionaryManager.dictionary) : [];
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
      /* NEVER underline words inside popup - absolute priority */
      .chinese-lang-extension-popup .lang-unknown-word,
      .chinese-lang-extension-popup * .lang-unknown-word {
        text-decoration: none !important;
        background-color: transparent !important;
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

          // Don't process script, style, noscript tags
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip Helios subtitle overlay to avoid re-wrapping YouTube subtitles
          if (parent.closest('[data-helios-subtitle-overlay="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip Helios YouTube subtitle sidebar/panel to avoid double-wrapping
          if (parent.closest('[data-helios-panel="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }

          // Don't process popup content - check if ANY ancestor is the popup
          if (parent.closest('.chinese-lang-extension-popup')) {
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

  async processTextNodeForUnknownWords(textNode) {
    // Safety check: NEVER process popup content
    if (textNode.parentElement && textNode.parentElement.closest('.chinese-lang-extension-popup')) {
      return;
    }

    // Avoid double-wrapping if this text node already sits inside a processed span
    if (textNode.parentElement && textNode.parentElement.closest('span[data-word]')) {
      return;
    }

    const text = textNode.textContent;
    if (!text) return;

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return;

    // Preload potential words before extraction (for async dictionary)
    if (this.dictionaryManager.preloadWords) {
      const potentialWords = this.extractPotentialWords(text, adapter);
      if (potentialWords.length > 0) {
        await this.dictionaryManager.preloadWords(potentialWords);
      }
    }

    const words = await adapter.extractWords(text, this.dictionaryManager.dictionary);
    if (words.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    words.forEach(({ word, start, end, dictionaryForm }) => {
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }
      const span = document.createElement('span');
      span.textContent = word;
      span.setAttribute('data-word', word); // Always add data-word
      
      // If dictionaryForm is available (e.g., for contractions or base forms), store it
      if (dictionaryForm) {
        span.setAttribute('data-dictionary-form', dictionaryForm);
      }

      // Convert word to lowercase for dictionary lookup while preserving display
      const lowercaseWord = word.toLowerCase();
      // Use dictionaryForm if available, otherwise use the word itself
      const lookupWord = dictionaryForm ? dictionaryForm.toLowerCase() : lowercaseWord;
      
      // Check if word exists in dictionary (using base form if contraction)
      const hasDictionaryEntry = this.dictionaryManager.dictionary[lookupWord];
      
      if (!this.vocabManager.isWordKnown(lowercaseWord) && 
          hasDictionaryEntry && 
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

    // Safety check: node might have been removed from DOM during async processing
    if (!textNode.parentNode) {
      return;
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  /**
   * Extract potential words from text for preloading
   * This helps with async dictionary by preloading words before extraction
   */
  extractPotentialWords(text, adapter) {
    const potentialWords = new Set();
    
    // For character-based languages (like Chinese), extract all 1-5 character sequences
    if (adapter.getScanResolution && adapter.getScanResolution() === 'char') {
      for (let i = 0; i < text.length; i++) {
        if (adapter.isTargetCharacter && adapter.isTargetCharacter(text[i])) {
          // Try sequences of 1-5 characters
          for (let len = 1; len <= Math.min(5, text.length - i); len++) {
            const candidate = text.substring(i, i + len);
            if ([...candidate].every(c => adapter.isTargetCharacter(c))) {
              potentialWords.add(candidate);
            }
          }
        }
      }
    } else {
      // For word-based languages, extract words using word boundaries
      // Pattern allows apostrophes and hyphens within words (e.g., "don't", "M'appelle")
      // This matches the pattern used in extractWords to ensure consistency
      const wordRegex = /\b[\p{L}\p{M}]+(?:[''-][\p{L}\p{M}]+)*\b/gu;
      let match;
      while ((match = wordRegex.exec(text)) !== null) {
        potentialWords.add(match[0].toLowerCase());
      }
    }
    
    return Array.from(potentialWords);
  }

  // Legacy method - now handled by language adapters
  async extractChineseWords(text) {
    console.warn('extractChineseWords is deprecated. Use language adapters instead.');
    const adapter = this.languageRegistry.getAdapter();
    return adapter ? await adapter.extractWords(text, this.dictionaryManager.dictionary) : [];
  }

  updateWordStyling(word, isKnownOrIgnored) {
    // Normalize word to lowercase for matching
    const normalizedWord = word.toLowerCase();

    // Find all elements with this word (case-insensitive)
    const elements = document.querySelectorAll(`[data-word]`);
    let updatedCount = 0;

    elements.forEach(element => {
      const elementWord = element.getAttribute('data-word');
      if (elementWord && elementWord.toLowerCase() === normalizedWord) {
        if (isKnownOrIgnored) {
          // Remove underline for both known and ignored words
          element.classList.remove('lang-unknown-word');
          updatedCount++;
        } else {
          // Add underline only for unknown words (not ignored)
          if (!this.vocabManager.isWordIgnored(normalizedWord)) {
            element.classList.add('lang-unknown-word');
            updatedCount++;
          }
        }
      }
    });

    console.log(`Updated ${updatedCount} instances of "${word}" on page`);
    
    // Recalculate comprehension after word status change
    // This ensures comprehension updates immediately when words are marked as known/ignored
    setTimeout(async () => {
      await this.calculateComprehensionPercentage();
    }, 50);
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

  async getCharacterAtPosition(event) {
    try {
      const accurateResult = await this.getCharacterAtPositionAccurate(event);
      if (accurateResult) return accurateResult;
      
      return await this.getCharacterAtPositionFallback(event);
    } catch (error) {
      console.error('Error getting character at position:', error);
      return null;
    }
  }

  async getCharacterAtPositionAccurate(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element) return null;

    const adapter = this.languageRegistry.getAdapter();
    const isCharacterBased = adapter && adapter.getScanResolution() === 'char';

    // OPTIMIZATION: Check if we clicked on a processed word span
    // For character-based languages, we still need character-level detection within the span
    const wordSpan = element.closest('span[data-word]');
    if (wordSpan && wordSpan.hasAttribute('data-word')) {
      const rect = wordSpan.getBoundingClientRect();
      
      // Verify the click is actually within this span's bounds
      if (event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom) {
        const textNodes = this.getTextNodes(wordSpan);
        if (textNodes.length > 0) {
          const textNode = textNodes[0];
          const textContent = textNode.textContent;
          
          // For character-based languages, detect which character was clicked
          // and find the longest word starting from that character
          if (isCharacterBased && adapter.isTargetCharacter) {
            const range = document.createRange();
            for (let i = 0; i < textContent.length; i++) {
              if (!adapter.isTargetCharacter(textContent[i])) continue;
              
              range.setStart(textNode, i);
              range.setEnd(textNode, i + 1);
              const charRect = range.getBoundingClientRect();
              
              if (event.clientX >= charRect.left && event.clientX <= charRect.right &&
                  event.clientY >= charRect.top && event.clientY <= charRect.bottom) {
                // Found the clicked character - find longest word from this position using jieba
                const wordResult = await this.findLongestWord(textNode, i);
                if (wordResult) return wordResult;
                
                // Fall back to single character
                return {
                  word: textContent[i],
                  textNode: textNode,
                  start: i,
                  end: i + 1
                };
              }
            }
          } else {
            // For non-character-based languages, return the whole word
            const word = wordSpan.getAttribute('data-word');
            return {
              word: word,
              textNode: textNode,
              start: 0,
              end: textContent.length
            };
          }
        }
      }
    }

    const textNodes = this.getTextNodes(element);

    for (const textNode of textNodes) {
      const result = await this.checkTextNodeAtPosition(textNode, event.clientX, event.clientY);
      if (result) return result;
    }

    return null;
  }

  /**
   * Get base text from element, excluding pronunciation (RT tags)
   */
  getBaseText(element) {
    if (!element) return '';

    let baseText = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip text nodes inside <rt> tags (pronunciation)
          if (node.parentElement && node.parentElement.tagName === 'RT') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    while (node = walker.nextNode()) {
      baseText += node.textContent;
    }

    return baseText;
  }

  async checkTextNodeAtPosition(textNode, x, y) {
    if (!textNode || !textNode.parentElement) return null;

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    // Get the parent element to extract full text context
    let container = textNode.parentElement;

    // If inside a ruby element, go up to the wrapper
    if (container.tagName === 'RUBY') {
      container = container.parentElement;
    }

    // Get base text (excluding pronunciation RT tags)
    const text = this.getBaseText(container);
    if (!text) return null;

    // Check if this is a character-based language (like Chinese, Japanese)
    const isCharacterBased = adapter.getScanResolution() === 'char';

    // For character-based languages, use character-by-character detection
    if (isCharacterBased) {
      // OPTIMIZATION: First check if we're clicking on an already-processed word span
      // But still do character-level detection within the span to find the longest word
      const allSpans = container.querySelectorAll('span[data-word]');
      for (const span of allSpans) {
        const rect = span.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right &&
            y >= rect.top && y <= rect.bottom) {
          const textNodes = this.getTextNodes(span);
          if (textNodes.length > 0) {
            const textNode = textNodes[0];
            const textContent = textNode.textContent;
            
            // Do character-by-character detection within this span
            const range = document.createRange();
            for (let i = 0; i < textContent.length; i++) {
              if (!adapter.isTargetCharacter || !adapter.isTargetCharacter(textContent[i])) continue;
              
              range.setStart(textNode, i);
              range.setEnd(textNode, i + 1);
              const charRect = range.getBoundingClientRect();
              
              if (x >= charRect.left && x <= charRect.right &&
                  y >= charRect.top && y <= charRect.bottom) {
                // Found the clicked character - find longest word from this position using jieba
                const wordResult = await this.findLongestWord(textNode, i);
                if (wordResult) return wordResult;
                
                // Fall back to single character
                return {
                  word: textContent[i],
                  textNode: textNode,
                  start: i,
                  end: i + 1
                };
              }
            }
          }
        }
      }

      // Fallback to character-by-character detection if no processed span found
      const allTextNodes = this.getTextNodes(container);

      for (const node of allTextNodes) {
        const nodeText = node.textContent;
        const range = document.createRange();

        for (let i = 0; i < nodeText.length; i++) {
          if (!adapter.isTargetCharacter || !adapter.isTargetCharacter(nodeText[i])) continue;

          range.setStart(node, i);
          range.setEnd(node, i + 1);

          const rect = range.getBoundingClientRect();

          if (x >= rect.left && x <= rect.right &&
              y >= rect.top && y <= rect.bottom) {

            // Try to find longest word starting from this character using jieba
            const wordResult = await this.findLongestWord(node, i);
            if (wordResult) return wordResult;

            // Fall back to single character
            return {
              word: nodeText[i],
              textNode: node,
              start: i,
              end: i + 1
            };
          }
        }
      }
      return null;
    }

    // For word-based languages, use word boundaries
    const words = await adapter.extractWords(text, this.dictionaryManager.dictionary);
    let currentOffset = 0;

    for (const wordData of words) {
      const allTextNodes = this.getTextNodes(container);

      for (const node of allTextNodes) {
        const nodeText = node.textContent;
        const nodeLength = nodeText.length;

        if (wordData.start < currentOffset + nodeLength && wordData.end > currentOffset) {
          const localStart = Math.max(0, wordData.start - currentOffset);
          const localEnd = Math.min(nodeLength, wordData.end - currentOffset);

          const range = document.createRange();
          range.setStart(node, localStart);
          range.setEnd(node, localEnd);

          const rect = range.getBoundingClientRect();

          if (x >= rect.left && x <= rect.right &&
              y >= rect.top && y <= rect.bottom) {
            return {
              word: wordData.word,
              textNode: node,
              start: localStart,
              end: localEnd
            };
          }
        }

        currentOffset += nodeLength;
      }
    }

    return null;
  }

  async findLongestWord(textNode, startOffset) {
    const text = textNode.textContent;
    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    const isCharacterBased = adapter.getScanResolution() === 'char';

    // For character-based languages, find words starting from the position
    if (isCharacterBased) {
      // Extract the remaining text from the hovered position
      const remainingText = text.substring(startOffset);
      if (remainingText.length === 0) return null;
      
      // Use jieba to segment the remaining text to find words starting from this position
      const words = await adapter.extractWords(remainingText, this.dictionaryManager.dictionary);
      
      // Return the first word found (jieba segments in order, so first is the word starting at position)
      if (words.length > 0) {
        return {
          word: words[0].word,
          textNode,
          start: startOffset,
          end: startOffset + words[0].word.length
        };
      }
      
      // No word found starting from this position
      return null;
    } else {
      // For non-character-based languages (space-separated), find the word containing the position
      // This preserves the original behavior for languages with spaces
      const words = await adapter.extractWords(text, this.dictionaryManager.dictionary);
      
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
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip text nodes inside <rt> tags (pronunciation annotations)
          if (node.parentElement && node.parentElement.tagName === 'RT') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
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

  async getCharacterAtPositionFallback(event) {
    const offsets = [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 }
    ];
    
    for (const offset of offsets) {
      const result = await this.tryGetCharacterAtPoint(
        event.clientX + offset.x, 
        event.clientY + offset.y
      );
      if (result) return result;
    }
    
    return null;
  }

  async tryGetCharacterAtPoint(x, y) {
    const caret = document.caretPositionFromPoint?.(x, y);
    if (!caret?.offsetNode) return null;

    let { offsetNode: textNode, offset } = caret;
    if (textNode.nodeType !== Node.TEXT_NODE) return null;

    // OPTIMIZATION: Check if the text node is inside a processed word span
    // This avoids calling extractWords (which uses jieba) for already-processed words
    const parentSpan = textNode.parentElement?.closest('span[data-word]');
    if (parentSpan && parentSpan.hasAttribute('data-word')) {
      const word = parentSpan.getAttribute('data-word');
      const wordText = parentSpan.textContent;
      const textContent = textNode.textContent;
      
      // Find word position in text node
      const wordIndex = textContent.indexOf(wordText);
      if (wordIndex !== -1 && offset >= wordIndex && offset < wordIndex + wordText.length) {
        return {
          word: word,
          textNode: textNode,
          start: wordIndex,
          end: wordIndex + wordText.length
        };
      }
    }

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    // Use adapter's extractWords method to find all words
    const words = await adapter.extractWords(textNode.textContent, this.dictionaryManager.dictionary);
    
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
    // Process nodes in parallel (they handle async preloading internally)
    Promise.all(
      textNodes.map(node => 
        this.processTextNodeForUnknownWords(node).catch(err => {
          console.warn('Error processing text node in forceReprocessElement:', err);
        })
      )
    );

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