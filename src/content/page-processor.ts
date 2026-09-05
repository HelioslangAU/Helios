import { isInsideOcrPdfTextLayer, OCR_PDF_TEXT_LAYER_SELECTOR } from '@/content/config/constants';
import { services } from '@/content/services';
import type { DictionaryManager } from '@/content/dictionary-manager';
import type { DictionaryManagerProxy } from '@/content/dictionary-bridge';
import type { VocabManager } from '@/content/vocab-manager';
import type { LanguageRegistry } from '@/content/languages/language-registry';
import type { BaseLanguageAdapter, ExtractedWord } from '@/content/languages/base-language-adapter';

interface SentenceRange {
  start: number;
  end: number;
}

/** Per-glyph OCR/PDF overlay box, stitched into line runs. */
interface OcrBox {
  el: HTMLElement;
  top: number;
  left: number;
  width: number;
  height: number;
  text: string;
}

interface OcrLineContext {
  lineText: string;
  offsetInLine: number;
  run: OcrBox[];
}

/** Result of position-based word detection (hover/click lookups). */
interface WordAtPosition {
  word: string;
  textNode: Text;
  start: number;
  end: number;
  ocrGlyphSpans?: HTMLElement[];
}

interface CoreStats {
  totalTokens: number;
  knownTokens: number;
  uniqueWords: Set<string>;
  uniqueKnownWords: Set<string>;
  sentencesWithWords: number;
  t0Sentences: number;
  t1Sentences: number;
  t2Sentences: number;
}

type CoreStatsResult = CoreStats & { uniqueTotal: number; uniqueKnown: number };

export class PageProcessor {
  dictionaryManager: DictionaryManager | DictionaryManagerProxy;
  vocabManager: VocabManager;
  languageRegistry: LanguageRegistry;
  unknownWordElements: Map<string, HTMLElement>;
  injectedCSS: boolean;
  asbplayerObservers: Set<MutationObserver>;

  // Performance optimization: debouncing
  reprocessTimeout: ReturnType<typeof setTimeout> | null;
  isReprocessing: boolean;
  asbplayerTimeout?: ReturnType<typeof setTimeout> | null;

  // Lazily populated stats caches (read via the getters below)
  _subtitleWordsCache?: { text: string; allWords: ExtractedWord[] };
  lastTotalWords?: number;
  lastKnownWords?: number;
  lastUniqueWordsTotal?: number;
  lastUniqueWordsKnown?: number;
  lastSentencesWithWords?: number;
  lastT0Sentences?: number;
  lastT1Sentences?: number;
  lastT2Sentences?: number;

  constructor(
    dictionaryManager: DictionaryManager | DictionaryManagerProxy,
    vocabManager: VocabManager,
    languageRegistry: LanguageRegistry,
    unknownWordElements?: unknown
  ) {
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

  initializeProcessing(): void {
    // Process the page initially
    this.processPageForUnknownWords();
    // Set up observer for dynamic changes
    //this.observePageChanges();

    // Listen for subtitle loaded events to recalculate comprehension
    this.setupSubtitleEventListeners();
  }

  /**
   * Get a signature of current video subtitle state (count + text length) for stability checks.
   * @returns null if no video subtitles
   */
  _getVideoSubtitleSignature(): { count: number; length: number } | null {
    if (!services.videoFeature?.isInitialized) return null;
    const binding = services.videoFeature.getPrimaryBinding();
    if (!binding) return null;
    const collection = binding.getSubtitles();
    if (!collection || collection.isEmpty()) return null;
    const text = this.getVideoSubtitleText();
    return { count: collection.getCount(), length: text ? text.length : 0 };
  }

  /**
   * Wait for subtitle load to stabilize, then recalculate comprehension and notify.
   * Retries at intervals so that platforms that load subtitles in chunks get full data before T1/stats.
   */
  async _recalculateComprehensionAfterSubtitleLoad(): Promise<void> {
    const delays = [100, 500, 1500, 3000];
    let lastSignature: { count: number; length: number } | null = null;
    let lastNotifiedSignature: { count: number; length: number } | null = null;

    for (const delayMs of delays) {
      await new Promise((r) => setTimeout(r, delayMs));
      const sig = this._getVideoSubtitleSignature();
      if (!sig) break;
      if (sig.count === 0 && sig.length === 0) break;

      const changed = !lastSignature || sig.count !== lastSignature.count || sig.length !== lastSignature.length;
      lastSignature = sig;

      if (changed || lastNotifiedSignature === null) {
        await this.calculateComprehensionPercentage();
        this.notifySidebarUpdate();
        lastNotifiedSignature = sig;
        console.log(`📊 Comprehension recalculated after subtitle load (${sig.count} cues, ${sig.length} chars)`);
      }

      // If nothing changed since previous delay, assume stable (optional early exit)
      if (!changed && lastNotifiedSignature && sig.count === lastNotifiedSignature.count && sig.length === lastNotifiedSignature.length) {
        break;
      }
    }
  }

  /**
   * Setup event listeners for video subtitle events
   */
  setupSubtitleEventListeners(): void {
    // Listen for when subtitles are loaded (may fire when first batch is ready; full load can be delayed)
    document.addEventListener('helios-subtitles-loaded', () => {
      this._recalculateComprehensionAfterSubtitleLoad();
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
  getSentenceContextFromNode(textNode: Text | null | undefined, word: string): string {
    let container: HTMLElement | null | undefined = textNode?.parentElement;

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
  isLikelySubtitleElement(element: Element): boolean {
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
  detectAsbplayerElements(): void {
    const selectors = [
      '.asbplayer-offscreen'
    ];
    const found = new Set<Element>();
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

  processPageForUnknownWords(): void {
    // Ensure CSS is injected globally
    this.ensureGlobalCSS();

    // Per-glyph OCR/PDF overlays must be stitched into lines before wrapping,
    // otherwise each character is treated as its own word.
    const ocrPromise = this.processOcrTextLayers().catch((e) => {
      console.warn('Error processing OCR text layers:', e);
    });

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
      Promise.all([
        ocrPromise,
        ...visibleNodes.map(node =>
          this.processTextNodeForUnknownWords(node).catch(e => {
            console.warn('Error processing visible node:', e);
          })
        )
      ]).then(() => {
        console.log(`✅ Visible nodes processed in ${Date.now() - start}ms`);
        this.calculateComprehensionPercentage().then(() => {
          this.notifySidebarUpdate();
        });
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
        await ocrPromise;
        // Recalculate comprehension after all processing is complete
        await this.calculateComprehensionPercentage();
        // Notify sidebar after calculation
        this.notifySidebarUpdate();
        console.log(`📊 Full page comprehension calculated`);
      });
    } else if (visibleNodes.length === 0) {
      // OCR-only pages have no remaining text nodes; wait for overlay stitching
      ocrPromise.then(() => {
        this.calculateComprehensionPercentage().then(() => {
          this.notifySidebarUpdate();
        });
      });
    }
  }

  /**
   * Partition text nodes into visible and hidden for prioritized processing
   * @param textNodes - All text nodes
   * @returns {visibleNodes, hiddenNodes}
   */
  partitionTextNodesByVisibility(textNodes: Text[]): { visibleNodes: Text[]; hiddenNodes: Text[] } {
    const visibleNodes: Text[] = [];
    const hiddenNodes: Text[] = [];

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
   * @param textNodes - Array of text nodes to process
   * @param onComplete - Callback when processing is complete
   */
  processBatchedTextNodes(textNodes: Text[], onComplete: (() => void) | null = null): void {
    if (textNodes.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const BATCH_SIZE = 100; // Process 100 nodes at a time (increased for speed)
    let currentIndex = 0;
    const startTime = Date.now();

    const processBatch = (deadline: IdleDeadline) => {
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
   * @param textNodes - Array of text nodes to process
   * @param onComplete - Callback when processing is complete
   */
  async processBatchedTextNodesAsync(textNodes: Text[], onComplete: (() => void | Promise<void>) | null = null): Promise<void> {
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
   * @returns All subtitle text if video is active, null otherwise
   */
  getVideoSubtitleText(): string | null {
    // Check if video feature is available and initialized
    if (!services.videoFeature || !services.videoFeature.isInitialized) {
      return null;
    }

    // Get the primary video binding
    const binding = services.videoFeature.getPrimaryBinding();
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
    const allSubtitleText = entries.map((entry: any) => entry.text).join(' ');
    //console.log(allSubtitleText);
    return allSubtitleText;
  }

  /**
   * Get video subtitle text and per-cue ranges (each cue = one "sentence" for T1).
   */
  getVideoSubtitleTextAndCueRanges(): { text: string; cueRanges: SentenceRange[] } | null {
    if (!services.videoFeature?.isInitialized) return null;
    const binding = services.videoFeature.getPrimaryBinding();
    if (!binding) return null;
    const collection = binding.getSubtitles();
    if (!collection || collection.isEmpty()) return null;
    const entries = collection.getAll();
    if (entries.length === 0) return null;

    const cueRanges: SentenceRange[] = [];
    let index = 0;
    const parts: string[] = [];
    for (const entry of entries) {
      const text = entry.text || '';
      cueRanges.push({ start: index, end: index + text.length });
      parts.push(text);
      index += text.length + 1; // +1 for space between cues
    }
    const text = parts.join(' ');
    return { text, cueRanges };
  }

  /**
   * Calculate comprehension percentage from subtitle text
   * @param subtitleText - Combined subtitle text
   * @param cueRanges - Per-cue ranges in subtitleText (each cue = one sentence for T1)
   * @returns Comprehension percentage
   */
  async calculateSubtitleComprehension(subtitleText: string, cueRanges: SentenceRange[] | null = null): Promise<number> {
    if (!subtitleText || !subtitleText.trim()) {
      return 100; // If no text, consider comprehension 100%
    }

    const adapter = this.languageRegistry.getAdapter();

    // Cache segmentation results so we don't rerun jieba for every vocab change
    if (!this._subtitleWordsCache || this._subtitleWordsCache.text !== subtitleText) {
      const allWords: ExtractedWord[] = adapter ? await adapter.extractWords(subtitleText, this.dictionaryManager.dictionary) : [];
      this._subtitleWordsCache = {
        text: subtitleText,
        allWords
      };
    }

    const allWords = this._subtitleWordsCache.allWords || [];
    // Filter to only target language words (exclude punctuation, spaces, non-target language)
    const words = allWords.filter(({ isTargetLang }) => isTargetLang !== false);

    let totalWords = words.length;
    let knownWords = words.filter(({ word }) => this.vocabManager.isWordKnown(word)).length;

    // Print all unknown words to console
    const unknownWords = words
      .filter(({ word }) => !this.vocabManager.isWordKnown(word))
      .map(({ word }) => word);
    console.log('📝 Unknown words:', unknownWords);
    const stats = this._calculateCoreStatsFromWords(words, subtitleText, adapter, {
      logT1Stats: true,
      logT2Stats: true,
      cueRanges: cueRanges || undefined
    });



    // Store totals for sidebar access
    this.lastTotalWords = stats.totalTokens;
    this.lastKnownWords = stats.knownTokens;
    this.lastUniqueWordsTotal = stats.uniqueTotal;
    this.lastUniqueWordsKnown = stats.uniqueKnown;
    this.lastSentencesWithWords = stats.sentencesWithWords;
    this.lastT0Sentences = stats.t0Sentences;
    this.lastT1Sentences = stats.t1Sentences;
    this.lastT2Sentences = stats.t2Sentences;

    if (stats.totalTokens === 0) return 100; // If no words, consider comprehension 100%
    console.log(
      `Subtitle comprehension: ${stats.knownTokens} / ${stats.totalTokens} = ${Math.round(
        (stats.knownTokens / stats.totalTokens) * 100
      )}%`
    );
    return Math.round((stats.knownTokens / stats.totalTokens) * 100);
  }

  async calculateComprehensionPercentage(): Promise<number> {
    // First, check if video subtitles are active (get text + per-cue ranges so each cue = one sentence for T1)
    const subtitleData = this.getVideoSubtitleTextAndCueRanges();

    if (subtitleData !== null) {
      // Video subtitles are active - calculate based on subtitle text only
      const percentage = await this.calculateSubtitleComprehension(subtitleData.text, subtitleData.cueRanges);
      // NOTE: Do NOT call notifySidebarUpdate() here - let the caller decide when to notify
      // This prevents circular calls with refreshData()
      return percentage;
    }

    // No video subtitles - calculate normally from page text
    const textNodes = this.getAllTextNodes(document.body);
    const texts = textNodes.map((node) => node.textContent || '');
    texts.push(...this.getOcrLayerLineTexts());
    const aggregateStats = {
      totalTokens: 0,
      knownTokens: 0,
      uniqueWords: new Set<string>(),
      uniqueKnownWords: new Set<string>(),
      sentencesWithWords: 0,
      t0Sentences: 0,
      t1Sentences: 0,
      t2Sentences: 0
    };

    const adapter = this.languageRegistry.getAdapter();

    for (const text of texts) {
      if (!adapter) continue;
      if (!text.trim()) continue;

      const allWords: ExtractedWord[] =
        (await adapter.extractWords(text, this.dictionaryManager.dictionary)) || [];
      // Filter to only target language words (exclude punctuation, spaces, non-target language)
      const words = allWords.filter(({ isTargetLang }) => isTargetLang !== false);

      const statsForNode = this._calculateCoreStatsFromWords(
        words,
        text,
        adapter
      );

      // Aggregate token stats
      aggregateStats.totalTokens += statsForNode.totalTokens;
      aggregateStats.knownTokens += statsForNode.knownTokens;

      // Aggregate unique words
      statsForNode.uniqueWords.forEach((w) => aggregateStats.uniqueWords.add(w));
      statsForNode.uniqueKnownWords.forEach((w) =>
        aggregateStats.uniqueKnownWords.add(w)
      );

      // Aggregate sentence stats
      aggregateStats.sentencesWithWords += statsForNode.sentencesWithWords;
      aggregateStats.t0Sentences += statsForNode.t0Sentences;
      aggregateStats.t1Sentences += statsForNode.t1Sentences;
      aggregateStats.t2Sentences += statsForNode.t2Sentences;
    }

    // Store totals for sidebar access
    this.lastTotalWords = aggregateStats.totalTokens;
    this.lastKnownWords = aggregateStats.knownTokens;
    this.lastUniqueWordsTotal = aggregateStats.uniqueWords.size;
    this.lastUniqueWordsKnown = aggregateStats.uniqueKnownWords.size;
    this.lastSentencesWithWords = aggregateStats.sentencesWithWords;
    this.lastT0Sentences = aggregateStats.t0Sentences;
    this.lastT1Sentences = aggregateStats.t1Sentences;
    this.lastT2Sentences = aggregateStats.t2Sentences;

    if (aggregateStats.totalTokens === 0) return 100; // If no words, consider comprehension 100%
    const percentage = Math.round(
      (aggregateStats.knownTokens / aggregateStats.totalTokens) * 100
    );

    // NOTE: Do NOT call notifySidebarUpdate() here - let the caller decide when to notify
    // This prevents circular calls with refreshData()

    return percentage;
  }

  getTotalWordsCount(): number {
    return this.lastTotalWords || 0;
  }

  getKnownWordsCount(): number {
    return this.lastKnownWords || 0;
  }
  /**
   * Get unique word stats for the last processed content.
   */
  getUniqueWordStats(): { totalUnique: number; knownUnique: number } {
    return {
      totalUnique: this.lastUniqueWordsTotal || 0,
      knownUnique: this.lastUniqueWordsKnown || 0
    };
  }

  /**
   * Get T1 sentence stats for the last processed content.
   * A sentence counts if it has at least one target-language word.
   * It is T1 when exactly one of those words is not known/ignored.
   */
  getT1SentenceStats(): { totalSentences: number; t1Sentences: number } {
    return {
      totalSentences: this.lastSentencesWithWords || 0,
      t1Sentences: this.lastT1Sentences || 0
    };
  }

  /**
   * Get T2 sentence stats for the last processed content.
   * A sentence counts if it has at least one target-language word.
   * It is T2 when exactly two of those words are not known/ignored (user knows all but 2).
   */
  getT2SentenceStats(): { totalSentences: number; t2Sentences: number } {
    return {
      totalSentences: this.lastSentencesWithWords || 0,
      t2Sentences: this.lastT2Sentences || 0
    };
  }

  /**
   * Get sentence breakdown stats for the last processed content.
   * Total = sentences with at least one target-language word.
   * t0 = all words known/ignored, t1 = exactly 1 unknown, t2 = exactly 2 unknown.
   * Overall "sentence breakdown" % = (t0 + t1 + t2) / total (sentences that are fully known, or all but 1, or all but 2).
   */
  getSentenceBreakdownStats(): { totalSentences: number; t0Sentences: number; t1Sentences: number; t2Sentences: number } {
    return {
      totalSentences: this.lastSentencesWithWords || 0,
      t0Sentences: this.lastT0Sentences || 0,
      t1Sentences: this.lastT1Sentences || 0,
      t2Sentences: this.lastT2Sentences || 0
    };
  }

  /**
   * Core stats helper used by both subtitle and page-based comprehension.
   * Computes token-level, unique-word, and sentence-level T1/T2 stats.
   * @param words - Array of word objects from extractWords (must already be filtered to target language)
   * @param text - Full text these words came from (optional for token-only stats)
   * @param adapter - Language adapter (required when text is provided for sentence splitting)
   * @param options - Options: { logT1Stats: boolean } - log T1 sentence stats (used for subtitle path only)
   */
  _calculateCoreStatsFromWords(
    words: ExtractedWord[],
    text: string | null = null,
    adapter: BaseLanguageAdapter | null = null,
    options: { logT1Stats?: boolean; logT2Stats?: boolean; cueRanges?: SentenceRange[] } = {}
  ): CoreStatsResult {
    const stats: CoreStats = {
      totalTokens: 0,
      knownTokens: 0,
      uniqueWords: new Set(),
      uniqueKnownWords: new Set(),
      sentencesWithWords: 0,
      t0Sentences: 0,
      t1Sentences: 0,
      t2Sentences: 0
    };

    if (!Array.isArray(words) || words.length === 0) {
      return {
        ...stats,
        uniqueTotal: 0,
        uniqueKnown: 0
      };
    }

    // Token-level and unique-word stats
    for (const { word } of words) {
      if (!word) continue;
      stats.totalTokens++;

      const normalized = typeof word === 'string' ? word.toLowerCase() : word;
      stats.uniqueWords.add(normalized);

      const isKnownOrIgnored =
        this.vocabManager.isWordKnown(word) ||
        this.vocabManager.isWordIgnored(word);

      if (isKnownOrIgnored) {
        stats.knownTokens++;
        stats.uniqueKnownWords.add(normalized);
      }
    }

    // Sentence-level T1 stats: use per-cue ranges (subtitle) or regex sentence boundaries (page text)
    const ranges: SentenceRange[] = options.cueRanges && options.cueRanges.length > 0
      ? options.cueRanges
      : (text && adapter && typeof adapter.getSentenceBoundary === 'function'
          ? this._splitTextIntoSentenceRanges(
              text,
              adapter.getSentenceBoundary() || /(?<=[.!?。！？\n])/
            )
          : []);

    if (ranges.length > 0) {
      let wordsInSentencesWithWords = 0;
      for (const { start, end } of ranges) {
        // Collect words that fall within this sentence/cue range
        // NOTE: word offsets are based on the original full text
        const sentenceWords = words.filter(
          ({ start: wStart, end: wEnd }) =>
            typeof wStart === 'number' &&
            typeof wEnd === 'number' &&
            wStart >= start &&
            wEnd <= end
        );

        if (sentenceWords.length === 0) continue;

        stats.sentencesWithWords++;
        wordsInSentencesWithWords += sentenceWords.length;

        let unknownCount = 0;
        for (const { word } of sentenceWords) {
          const isKnownOrIgnored =
            this.vocabManager.isWordKnown(word) ||
            this.vocabManager.isWordIgnored(word);
          if (!isKnownOrIgnored) unknownCount++;
        }

        if (unknownCount === 0) stats.t0Sentences++;
        if (unknownCount === 1) stats.t1Sentences++;
        if (unknownCount === 2) stats.t2Sentences++;
      }
      if (options.logT1Stats) {
        console.log(
          `📊 T1 sentences: ${stats.sentencesWithWords} sentences with words, ${wordsInSentencesWithWords} total words in those sentences, ${stats.t1Sentences} T1`
        );
      }
      if (options.logT2Stats) {
        console.log(
          `📊 T2 sentences: ${stats.sentencesWithWords} sentences with words, ${wordsInSentencesWithWords} total words in those sentences, ${stats.t2Sentences} T2`
        );
      }
    }

    return {
      ...stats,
      uniqueTotal: stats.uniqueWords.size,
      uniqueKnown: stats.uniqueKnownWords.size
    };
  }

  /**
   * Split a text into sentence ranges (start/end indices) using a sentence-boundary regex.
   * Works even when the regex produces zero-width matches (common with lookbehind boundaries).
   */
  _splitTextIntoSentenceRanges(text: string, sentenceBoundary: RegExp): SentenceRange[] {
    if (!text) return [];

    const source = sentenceBoundary instanceof RegExp ? sentenceBoundary.source : '(?<=[.!?。！？\\n])';
    const flagsRaw = sentenceBoundary instanceof RegExp ? sentenceBoundary.flags : '';
    const flags = flagsRaw.includes('g') ? flagsRaw : `${flagsRaw}g`;

    let re: RegExp;
    try {
      re = new RegExp(source, flags);
    } catch (_) {
      re = /(?<=[.!?。！？\n])/g;
    }

    const ranges: SentenceRange[] = [];
    let start = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      const end = match.index;

      // Avoid infinite loops on zero-width matches
      if (re.lastIndex === match.index) {
        re.lastIndex++;
      }

      if (end > start) {
        ranges.push({ start, end });
      }
      start = end;
    }

    if (start < text.length) {
      ranges.push({ start, end: text.length });
    }

    return ranges;
  }

  notifySidebarUpdate(): void {
    // Notify banner manager (which manages the side tab) of data changes
    if (services.bannerManager?.refreshData) {
      // Use a small delay to ensure all processing is complete
      setTimeout(() => {
        services.bannerManager!.refreshData();
      }, 100);
    }
  }

  reprocessPage(): void {
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

  async analyzeASBPlayerSubtitlesComprehension(subtitlesText: string): Promise<number> {
  // subtitlesText: string containing all subtitles for the video
  const adapter = this.languageRegistry.getAdapter();
  const allWords: ExtractedWord[] = adapter ? await adapter.extractWords(subtitlesText, this.dictionaryManager.dictionary) : [];
  // Filter to only target language words (exclude punctuation, spaces, non-target language)
  const words = allWords.filter(({ isTargetLang }) => isTargetLang !== false);
  const stats = this._calculateCoreStatsFromWords(words, subtitlesText, adapter);
  if (stats.totalTokens === 0) return 100;
  return Math.round((stats.knownTokens / stats.totalTokens) * 100);
}


  ensureGlobalCSS(): void {
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
      .lang-learning-word {
        text-decoration: underline !important;
        text-decoration-color: #9333ea !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 2px !important;
        cursor: help !important;
      }
      .lang-learning-word:hover {
        background-color: rgba(147, 51, 234, 0.1) !important;
      }
      /* NEVER underline words inside popup - absolute priority */
      .chinese-lang-extension-popup .lang-unknown-word,
      .chinese-lang-extension-popup * .lang-unknown-word,
      .chinese-lang-extension-popup .lang-learning-word,
      .chinese-lang-extension-popup * .lang-learning-word {
        text-decoration: none !important;
        background-color: transparent !important;
      }
      /* OCR/PDF overlays style ALL descendant spans as position:absolute.
         Keep Helios wraps (nested inside the positioned glyph boxes) inline. */
      .text-layer > span span[data-word],
      .textLayer > span span[data-word],
      .text-layer > span span.lookup-highlight,
      .textLayer > span span.lookup-highlight {
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
        display: inline !important;
      }
      .text-layer > span:has(span[data-word], span.lookup-highlight),
      .textLayer > span:has(span[data-word], span.lookup-highlight) {
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);
    this.injectedCSS = true;
  }

  getAllTextNodes(element: Node): Text[] {
    const textNodes: Text[] = [];
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

          // OCR/PDF overlays are processed as stitched lines, not per text node
          if (isInsideOcrPdfTextLayer(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          return node.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    return textNodes;
  }

  async processTextNodeForUnknownWords(textNode: Text): Promise<void> {
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
    if ((this.dictionaryManager as DictionaryManagerProxy).preloadWords) {
      const potentialWords = this.extractPotentialWords(text, adapter);
      if (potentialWords.length > 0) {
        await (this.dictionaryManager as DictionaryManagerProxy).preloadWords(potentialWords);
      }
    }

    const words: ExtractedWord[] = await adapter.extractWords(text, this.dictionaryManager.dictionary);
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
          !this.vocabManager.isWordIgnored(lowercaseWord) &&
          !this.vocabManager.isWordLearning(lowercaseWord)) {
        span.className = 'lang-unknown-word';
        this.unknownWordElements.set(lowercaseWord, span);
      } else if (hasDictionaryEntry && this.vocabManager.isWordLearning(lowercaseWord)) {
        span.className = 'lang-learning-word';
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

  async processOcrTextLayers(): Promise<void> {
    const runs = this._getOcrLayerRuns();
    if (runs.length === 0) return;

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return;

    if ((this.dictionaryManager as DictionaryManagerProxy).preloadWords) {
      const potential = new Set<string>();
      for (const run of runs) {
        this.extractPotentialWords(run.map((b) => b.text).join(''), adapter)
          .forEach((w) => potential.add(w));
      }
      if (potential.size > 0) {
        await (this.dictionaryManager as DictionaryManagerProxy).preloadWords([...potential]);
      }
    }

    for (const run of runs) {
      await this._processOcrRun(run, adapter);
    }
  }

  getOcrLayerLineTexts(): string[] {
    return this._getOcrLayerRuns()
      .map((run) => run.map((b) => b.text).join(''))
      .filter((text) => text.trim());
  }

  _getOcrLayerRuns(): OcrBox[][] {
    const runs: OcrBox[][] = [];
    document.querySelectorAll(OCR_PDF_TEXT_LAYER_SELECTOR).forEach((layer) => {
      runs.push(...this._groupOcrBoxesIntoRuns(this._getOcrLayerBoxes(layer)));
    });
    return runs;
  }

  _getOcrLayerBoxes(layer: Element): HTMLElement[] {
    return Array.from(layer.children).filter((el) => el.tagName === 'SPAN') as HTMLElement[];
  }

  _getOcrBoxMetrics(el: HTMLElement): OcrBox {
    const top = parseFloat(el.style.top);
    const left = parseFloat(el.style.left);
    const width = parseFloat(el.style.width);
    const height = parseFloat(el.style.height);
    return {
      el,
      top: Number.isFinite(top) ? top : el.offsetTop,
      left: Number.isFinite(left) ? left : el.offsetLeft,
      width: Number.isFinite(width) && width > 0 ? width : el.offsetWidth || 0,
      height: Number.isFinite(height) && height > 0 ? height : el.offsetHeight || 0,
      text: this.getBaseText(el)
    };
  }

  _groupOcrBoxesIntoRuns(boxes: HTMLElement[]): OcrBox[][] {
    const parsed = boxes.map((el) => this._getOcrBoxMetrics(el)).filter((b) => b.text.length > 0);
    parsed.sort((a, b) => a.top - b.top || a.left - b.left);

    const lines: Array<{ top: number; boxes: OcrBox[] }> = [];
    for (const box of parsed) {
      const tolerance = Math.max(8, (box.height || 20) * 0.4);
      const line = lines.find((l) => Math.abs(l.top - box.top) <= tolerance);
      if (line) {
        line.boxes.push(box);
      } else {
        lines.push({ top: box.top, boxes: [box] });
      }
    }

    const runs: OcrBox[][] = [];
    for (const line of lines) {
      line.boxes.sort((a, b) => a.left - b.left);
      let current: OcrBox[] = [];
      for (const box of line.boxes) {
        if (current.length === 0) {
          current.push(box);
          continue;
        }
        const prev = current[current.length - 1];
        const gap = box.left - (prev.left + prev.width);
        const maxGap = Math.max(prev.width, box.width, 20) * 1.75;
        if (gap > maxGap) {
          runs.push(current);
          current = [box];
        } else {
          current.push(box);
        }
      }
      if (current.length) runs.push(current);
    }
    return runs;
  }

  async _processOcrRun(run: OcrBox[], adapter: BaseLanguageAdapter): Promise<void> {
    const isGlyphRun = run.length > 1 && run.every((b) => [...b.text].length <= 2);
    if (!isGlyphRun) {
      for (const box of run) {
        for (const node of this.getTextNodes(box.el)) {
          await this.processTextNodeForUnknownWords(node);
        }
      }
      return;
    }

    const lineText = run.map((b) => b.text).join('');
    const words: ExtractedWord[] = await adapter.extractWords(lineText, this.dictionaryManager.dictionary);
    if (!words.length) return;

    let offset = 0;
    const ranges = run.map((b) => {
      const start = offset;
      offset += b.text.length;
      return { el: b.el, start, end: offset };
    });

    for (const { word, start, end, dictionaryForm, isTargetLang } of words) {
      if (isTargetLang === false) continue;
      const covered = ranges.filter((b) => b.end > start && b.start < end);
      for (const box of covered) {
        this._stampOcrBoxWord(box.el, word, dictionaryForm);
      }
    }
  }

  _stampOcrBoxWord(boxEl: HTMLElement, word: string, dictionaryForm?: string | null): void {
    let span = boxEl.querySelector<HTMLElement>('span[data-word]');
    if (!span) {
      span = document.createElement('span');
      while (boxEl.firstChild) {
        span.appendChild(boxEl.firstChild);
      }
      boxEl.appendChild(span);
    }
    this._applyWordSpanState(span, word, dictionaryForm);
  }

  _applyWordSpanState(span: HTMLElement, word: string, dictionaryForm?: string | null): void {
    span.setAttribute('data-word', word);
    if (dictionaryForm) {
      span.setAttribute('data-dictionary-form', dictionaryForm);
    } else {
      span.removeAttribute('data-dictionary-form');
    }

    const lowercaseWord = word.toLowerCase();
    const lookupWord = dictionaryForm ? dictionaryForm.toLowerCase() : lowercaseWord;
    const hasDictionaryEntry = this.dictionaryManager.dictionary[lookupWord];

    span.classList.remove('lang-unknown-word', 'lang-learning-word');
    if (
      !this.vocabManager.isWordKnown(lowercaseWord) &&
      hasDictionaryEntry &&
      !this.vocabManager.isWordIgnored(lowercaseWord) &&
      !this.vocabManager.isWordLearning(lowercaseWord)
    ) {
      span.classList.add('lang-unknown-word');
      this.unknownWordElements.set(lowercaseWord, span);
    } else if (hasDictionaryEntry && this.vocabManager.isWordLearning(lowercaseWord)) {
      span.classList.add('lang-learning-word');
      this.unknownWordElements.set(lowercaseWord, span);
    }
  }

  _getOcrPositionedBox(element: Element | null | undefined): HTMLElement | null {
    const layer = element?.closest?.(OCR_PDF_TEXT_LAYER_SELECTOR);
    if (!layer || !element) return null;
    let el: Element | null = element.nodeType === Node.ELEMENT_NODE ? element : element.parentElement;
    while (el && el !== layer) {
      if (el.parentElement === layer && el.tagName === 'SPAN') return el as HTMLElement;
      el = el.parentElement;
    }
    return null;
  }

  _getOcrLineContext(textNode: Text, offsetInNode: number): OcrLineContext | null {
    const boxEl = this._getOcrPositionedBox(textNode.parentElement);
    if (!boxEl) return null;
    const runs = this._groupOcrBoxesIntoRuns(this._getOcrLayerBoxes(boxEl.parentElement!));
    const run = runs.find((r) => r.some((b) => b.el === boxEl));
    if (!run || run.length < 2) return null;

    let lineText = '';
    let offsetInLine = 0;
    let found = false;
    for (const box of run) {
      if (box.el === boxEl) {
        offsetInLine = lineText.length + offsetInNode;
        found = true;
      }
      lineText += box.text;
    }
    return found ? { lineText, offsetInLine, run } : null;
  }

  _getOcrGlyphSpansForRange(run: OcrBox[] | null | undefined, rangeStart: number, rangeEnd: number): HTMLElement[] {
    if (!run?.length || rangeEnd <= rangeStart) return [];
    const spans: HTMLElement[] = [];
    let coveredLength = 0;
    let offset = 0;
    for (const box of run) {
      const start = offset;
      const end = offset + box.text.length;
      offset = end;
      if (end > rangeStart && start < rangeEnd) {
        spans.push(box.el.querySelector<HTMLElement>('span[data-word]') || box.el);
        coveredLength += box.text.length;
      }
    }
    // Word sits inside a single box holding more characters than the word
    // (e.g. inline 贵姓 boxed as one span, word resolved to 贵): highlighting
    // the whole box would not match the popup, so fall back to wrap-mode
    // text-range highlighting by returning no glyph spans.
    if (spans.length === 1 && coveredLength > rangeEnd - rangeStart) return [];
    return spans;
  }

  /**
   * Extract potential words from text for preloading
   * This helps with async dictionary by preloading words before extraction
   */
  extractPotentialWords(text: string, adapter: BaseLanguageAdapter): string[] {
    const potentialWords = new Set<string>();

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
      const wordRegex = /(?<![\p{L}\p{M}])([\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*)(?![\p{L}\p{M}])/gu;
      let match: RegExpExecArray | null;
      while ((match = wordRegex.exec(text)) !== null) {
        potentialWords.add(match[0].toLowerCase());
      }
    }

    return Array.from(potentialWords);
  }

  // Legacy method - now handled by language adapters
  async extractChineseWords(text: string): Promise<ExtractedWord[]> {
    console.warn('extractChineseWords is deprecated. Use language adapters instead.');
    const adapter = this.languageRegistry.getAdapter();
    return adapter ? await adapter.extractWords(text, this.dictionaryManager.dictionary) : [];
  }

  updateWordStyling(word: string, isKnownOrIgnored: boolean): void {
    // Normalize word to lowercase for matching
    const normalizedWord = word.toLowerCase();

    // Find all elements with this word (case-insensitive)
    const elements = document.querySelectorAll(`[data-word]`);
    let updatedCount = 0;

    elements.forEach(element => {
      const elementWord = element.getAttribute('data-word');
      if (elementWord && elementWord.toLowerCase() === normalizedWord) {
        // Remove all state classes first
        element.classList.remove('lang-unknown-word', 'lang-learning-word');

        if (isKnownOrIgnored) {
          // Check if it's learning, known, or ignored
          if (this.vocabManager.isWordLearning(normalizedWord)) {
            element.classList.add('lang-learning-word');
          }
          // Known and ignored words don't get underlined
          updatedCount++;
        } else {
          // Add underline for unknown words (not ignored, not learning)
          if (!this.vocabManager.isWordIgnored(normalizedWord) &&
              !this.vocabManager.isWordLearning(normalizedWord)) {
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

  observePageChanges(): void {
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
  isChineseCharacter(char: string): boolean {
    console.warn('isChineseCharacter is deprecated. Use language adapters instead.');
    const adapter = this.languageRegistry.getAdapter();
    return adapter ? adapter.isTargetCharacter(char) : false;
  }

  async getCharacterAtPosition(event: MouseEvent): Promise<WordAtPosition | null> {
    try {
      const accurateResult = await this.getCharacterAtPositionAccurate(event);
      if (accurateResult) return accurateResult;

      return await this.getCharacterAtPositionFallback(event);
    } catch (error) {
      console.error('Error getting character at position:', error);
      return null;
    }
  }

  async getCharacterAtPositionAccurate(event: MouseEvent): Promise<WordAtPosition | null> {
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
          const textContent = textNode.textContent!;

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
            const word = wordSpan.getAttribute('data-word')!;
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
  getBaseText(element: Element | null): string {
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
      }
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      baseText += node.textContent;
    }

    return baseText;
  }

  async checkTextNodeAtPosition(textNode: Text, x: number, y: number): Promise<WordAtPosition | null> {
    if (!textNode || !textNode.parentElement) return null;

    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    // Get the parent element to extract full text context
    let container: HTMLElement | null = textNode.parentElement;

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
      const allSpans = container!.querySelectorAll('span[data-word]');
      for (const span of allSpans) {
        const rect = span.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right &&
            y >= rect.top && y <= rect.bottom) {
          const textNodes = this.getTextNodes(span);
          if (textNodes.length > 0) {
            const textNode = textNodes[0];
            const textContent = textNode.textContent!;

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
      const allTextNodes = this.getTextNodes(container!);

      for (const node of allTextNodes) {
        const nodeText = node.textContent!;
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
    const words: ExtractedWord[] = await adapter.extractWords(text, this.dictionaryManager.dictionary);
    let currentOffset = 0;

    for (const wordData of words) {
      const allTextNodes = this.getTextNodes(container!);

      for (const node of allTextNodes) {
        const nodeText = node.textContent!;
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

  async findLongestWord(textNode: Text, startOffset: number): Promise<WordAtPosition | null> {
    let text = textNode.textContent!;
    const localStart = startOffset;
    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return null;

    const ocrContext = this._getOcrLineContext(textNode, startOffset);
    if (ocrContext) {
      text = ocrContext.lineText;
      startOffset = ocrContext.offsetInLine;
    }

    const isCharacterBased = adapter.getScanResolution() === 'char';

    // For character-based languages, find words starting from the position
    if (isCharacterBased) {
      // Extract the remaining text from the hovered position
      const remainingText = text.substring(startOffset);
      if (remainingText.length === 0) return null;

      // Use jieba to segment the remaining text to find words starting from this position
      const words: ExtractedWord[] = await adapter.extractWords(remainingText, this.dictionaryManager.dictionary);

      // Return the first word found (jieba segments in order, so first is the word starting at position)
      if (words.length > 0) {
        const word = words[0].word;
        const result: WordAtPosition = {
          word,
          textNode,
          start: localStart,
          end: Math.min(textNode.textContent!.length, localStart + word.length)
        };
        if (ocrContext) {
          result.ocrGlyphSpans = this._getOcrGlyphSpansForRange(
            ocrContext.run,
            startOffset,
            startOffset + word.length
          );
        }
        return result;
      }

      // No word found starting from this position
      return null;
    } else {
      // For non-character-based languages (space-separated), find the word containing the position
      // This preserves the original behavior for languages with spaces
      const words: ExtractedWord[] = await adapter.extractWords(text, this.dictionaryManager.dictionary);

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

  getTextNodes(element: Node): Text[] {
    const textNodes: Text[] = [];
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
      }
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      if (node.textContent!.trim()) {
        textNodes.push(node as Text);
      }
    }

    return textNodes;
  }

  async getCharacterAtPositionFallback(event: MouseEvent): Promise<WordAtPosition | null> {
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

  async tryGetCharacterAtPoint(x: number, y: number): Promise<WordAtPosition | null> {
    const caret = document.caretPositionFromPoint?.(x, y);
    if (!caret?.offsetNode) return null;

    const { offsetNode, offset } = caret;
    if (offsetNode.nodeType !== Node.TEXT_NODE) return null;
    const textNode = offsetNode as Text;

    // OPTIMIZATION: Check if the text node is inside a processed word span
    // This avoids calling extractWords (which uses jieba) for already-processed words.
    // Skip this shortcut on OCR glyph overlays so we can highlight the full word.
    const parentSpan = textNode.parentElement?.closest('span[data-word]');
    const ocrContextEarly = this._getOcrLineContext(textNode, offset);
    if (!ocrContextEarly && parentSpan && parentSpan.hasAttribute('data-word')) {
      const word = parentSpan.getAttribute('data-word')!;
      const wordText = parentSpan.textContent!;
      const textContent = textNode.textContent!;

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

    const ocrContext = ocrContextEarly || this._getOcrLineContext(textNode, offset);
    if (ocrContext) {
      const ocrWords: ExtractedWord[] = await adapter.extractWords(ocrContext.lineText, this.dictionaryManager.dictionary);
      for (const wordData of ocrWords) {
        if (ocrContext.offsetInLine >= wordData.start && ocrContext.offsetInLine < wordData.end) {
          // Node-relative start of the word (hover may be mid-word)
          const nodeStart = Math.max(0, offset - (ocrContext.offsetInLine - wordData.start));
          return {
            word: wordData.word,
            textNode,
            start: nodeStart,
            end: Math.min(textNode.textContent!.length, nodeStart + wordData.word.length),
            ocrGlyphSpans: this._getOcrGlyphSpansForRange(
              ocrContext.run,
              wordData.start,
              wordData.end
            )
          };
        }
      }
    }

    // Use adapter's extractWords method to find all words
    const words: ExtractedWord[] = await adapter.extractWords(textNode.textContent!, this.dictionaryManager.dictionary);

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
  observeSubtitleContainer(element: Element & { _lastChineseText?: string | null }): void {
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
            (mutation.type === 'characterData' && mutation.target.textContent!.trim())) {
          hasChanges = true;
        }
      });
      if (hasChanges) {
        clearTimeout(this.asbplayerTimeout!);
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

  async forceReprocessElement(element: Element): Promise<void> {

    // --- Preserve highlight if present ---
    let highlightedWord: string | null = null;
    let highlightText: string | null = null;
    const highlightEl = element.querySelector('.lookup-highlight');
    if (highlightEl) {
      highlightedWord = highlightEl.getAttribute('data-word') || highlightEl.textContent;
      highlightText = highlightEl.textContent;
    }

    // Clear existing processed spans in this element to avoid double-processing
    const existingSpans = element.querySelectorAll('span[data-word]');
    existingSpans.forEach(span => {
      const parent = span.parentNode!;
      parent.replaceChild(document.createTextNode(span.textContent!), span);
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
        if (services.highlightManager) {
          services.highlightManager.currentHighlight = newHighlight as HTMLElement;
        }
      }
    }
  const container = document.querySelector<HTMLElement>('.asbplayer-offscreen');
  if (container) {
    console.log(container.innerText);
    services.bannerManager!.updateComprehension(
      await this.analyzeASBPlayerSubtitlesComprehension(container.innerText)
    );
  } else {
    console.warn("ASBPlayer subtitle container not found!");
  }
    console.log('Finished reprocessing, unknown words should be underlined');
  }

  // Remove unknown and learning word styling and clear tracked elements
  clearUnknownWordHighlights(): void {
    try {
      document.querySelectorAll('.lang-unknown-word').forEach((el) => {
        el.classList.remove('lang-unknown-word');
      });
      document.querySelectorAll('.lang-learning-word').forEach((el) => {
        el.classList.remove('lang-learning-word');
      });
      this.unknownWordElements?.clear?.();
    } catch (_) {}
  }

  // Clear both lookup highlight and unknown word highlights
  clearHighlights(): void {
    try {
      if (services.highlightManager && services.highlightManager.removeLookupHighlight) {
        services.highlightManager.removeLookupHighlight();
      }
    } catch (_) {}
    this.clearUnknownWordHighlights();
  }

  // Handle auto-highlight toggling and reprocessing
  handleAutoHighlightUpdate(enabled: boolean, extensionEnabled: boolean = true): void {
    if (enabled && extensionEnabled) {
      this.processPageForUnknownWords();
    } else {
      this.clearUnknownWordHighlights();
    }
  }

  /**
   * Clean up all observers and timeouts
   */
  cleanup(): void {
    // Clear any pending timeouts
    if (this.reprocessTimeout) {
      clearTimeout(this.reprocessTimeout);
      this.reprocessTimeout = null;
    }

    if (this.asbplayerTimeout) {
      clearTimeout(this.asbplayerTimeout);
      this.asbplayerTimeout = null;
    }

    // Disconnect all ASBPlayer observers
    if (this.asbplayerObservers) {
      this.asbplayerObservers.forEach(observer => {
        observer.disconnect();
      });
      this.asbplayerObservers.clear();
    }

    // Clear unknown word elements
    if (this.unknownWordElements) {
      this.unknownWordElements.clear();
    }

    console.log('[PageProcessor] Cleanup complete');
  }
}
