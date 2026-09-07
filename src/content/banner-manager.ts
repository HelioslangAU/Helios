import { PATHS } from '@/config/paths';
import { services } from '@/content/services';
import { HeliosSideTab, type SentenceBreakdown, type SideTabStats } from '@/content/side-tab';

interface BannerStats {
    knownWords: number;
    learningWords: number;
    ignoredWords: number;
    comprehension: number | null;
    pageWords: number;
    uniqueComprehension: number | null;
    sentenceBreakdownPercentage: number | null;
    sentenceBreakdown: SentenceBreakdown;
}

export class BannerManager {
    sideTab: Element | null;
    sideTabInstance: HeliosSideTab | null;
    lastStats: BannerStats;
    refreshTimeout?: ReturnType<typeof setTimeout> | null;
    /**
     * Whether the tab should be visible once it finishes loading. show/hide can
     * both be called before the async mount completes, so the decision is
     * latched here and applied on creation.
     */
    pendingVisible = false;

    constructor() {
        this.sideTab = null;
        this.sideTabInstance = null;
        this.lastStats = {
            knownWords: 0,
            learningWords: 0,
            ignoredWords: 0,
            comprehension: 100,
            pageWords: 0,
            uniqueComprehension: 100,
            sentenceBreakdownPercentage: 100,
            sentenceBreakdown: { totalSentences: 0, t0Sentences: 0, t1Sentences: 0, t2Sentences: 0 }
        };
        this.init();
    }

    init(): void {
        this.injectSideTabCSS();
        this.createSideTab();
    }

    injectSideTabCSS(): void {
        if (!document.getElementById('language-extension-side-tab-css')) {
            const link = document.createElement('link');
            link.id = 'language-extension-side-tab-css';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            // File paths are centralized in src/config/paths.ts
            link.href = PATHS.url(PATHS.CSS.SIDE_TAB);
            document.head.appendChild(link);
        }
    }

    async createSideTab(): Promise<void> {
        // Fetch the HTML for the side tab
        // File paths are centralized in src/config/paths.ts
        const sideTabUrl = PATHS.url(PATHS.HTML.SIDE_TAB);
        const response = await fetch(sideTabUrl);
        const html = await response.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;
        this.sideTab = temp.firstElementChild;
        // Mount hidden. This fetch races the startup enabled/disabled check, and
        // mounting visible made the tab flash onto pages it should never appear
        // on — or stay up, when hideBanner() arrived before the instance existed.
        (this.sideTab as HTMLElement).style.display = 'none';
        document.body.appendChild(this.sideTab!);

        // Now that the side tab is in the DOM, we can instantiate the side tab logic
        this.sideTabInstance = new HeliosSideTab();

        // Apply whatever visibility was decided while this was still loading.
        if (this.pendingVisible) {
            this.sideTabInstance.show();
        }

        // Calculate and update initial stats
        const comprehensionRaw = await services.pageProcessor!.calculateComprehensionPercentage();
        const pageWords = await this.calculatePageWordsCount();
        const knownWordsCount = services.vocabManager!.getKnownWordsCount();
        const learningWordsCount = services.vocabManager?.getLearningWordsCount
            ? services.vocabManager.getLearningWordsCount()
            : 0;
        const ignoredWordsCount = services.vocabManager?.getIgnoredWordsCount
            ? services.vocabManager.getIgnoredWordsCount()
            : 0;

        const uniqueStats = services.pageProcessor?.getUniqueWordStats
            ? services.pageProcessor.getUniqueWordStats()
            : { totalUnique: 0, knownUnique: 0 };

        const comprehension =
            uniqueStats.totalUnique > 0 && Number.isFinite(comprehensionRaw)
                ? comprehensionRaw
                : null;
        const breakdown = services.pageProcessor?.getSentenceBreakdownStats
            ? services.pageProcessor.getSentenceBreakdownStats()
            : { totalSentences: 0, t0Sentences: 0, t1Sentences: 0, t2Sentences: 0 };

        // Same rule as refreshData: nothing measured means no figure. This is
        // the initial-load path, and it carried its own copy of the defaults.
        const uniqueComprehension =
            uniqueStats.totalUnique > 0
                ? Math.round((uniqueStats.knownUnique / uniqueStats.totalUnique) * 100)
                : null;

        const sentenceBreakdownPercentage =
            breakdown.totalSentences > 0
                ? Math.round(((breakdown.t0Sentences + breakdown.t1Sentences + breakdown.t2Sentences) / breakdown.totalSentences) * 100)
                : null;

        this.updateStats({
            knownWords: knownWordsCount,
            learningWords: learningWordsCount,
            ignoredWords: ignoredWordsCount,
            comprehension,
            pageWords: pageWords,
            uniqueComprehension,
            sentenceBreakdownPercentage,
            sentenceBreakdown: breakdown
        });

        // Set initial hover tooltips for comprehension and unique stats
        const totalTokens = services.pageProcessor?.getTotalWordsCount
            ? services.pageProcessor.getTotalWordsCount()
            : 0;
        const knownTokens = services.pageProcessor?.getKnownWordsCount
            ? services.pageProcessor.getKnownWordsCount()
            : 0;

        if (this.sideTabInstance?.updateComprehensionTooltip) {
            this.sideTabInstance.updateComprehensionTooltip(knownTokens, totalTokens);
        }
        if (this.sideTabInstance?.updateUniqueTooltip) {
            this.sideTabInstance.updateUniqueTooltip(uniqueStats.knownUnique || 0, uniqueStats.totalUnique || 0);
        }
        if (this.sideTabInstance?.updateSentenceBreakdownTooltip) {
            this.sideTabInstance.updateSentenceBreakdownTooltip(breakdown);
        }

        // Update language-specific features
        this.updateLanguageFeatures();

        // Listen for language changes to update language-specific features
        if (services.languageRegistry) {
            services.languageRegistry.on('languageChanged', () => {
                this.updateLanguageFeatures();
            });
        }
    }

    /**
     * Update language-specific features in the side tab
     */
    updateLanguageFeatures(): void {
        if (!this.sideTabInstance) return;

        try {
            // Get current language code directly from languageRegistry
            const language = services.languageRegistry?.getCurrentLanguage();

            console.log('Banner Manager: Current language code:', language);

            if (language) {
                this.sideTabInstance.updateLanguageFeatures(language);
            } else {
                console.warn('Banner Manager: No language currently set');
            }
        } catch (error) {
            console.error('Banner Manager: Error getting language:', error);
        }
    }

    /**
     * Calculate total words on the page or in video subtitles
     * If video subtitles are active, returns subtitle word count
     * Otherwise, returns page word count
     */
    async calculatePageWordsCount(): Promise<number> {
        try {
            // First, check if video subtitles are active
            const subtitleText = this.getVideoSubtitleText();

            if (subtitleText !== null) {
                // Video subtitles are active - reuse PageProcessor's cached totals
                if (services.pageProcessor && typeof services.pageProcessor.getTotalWordsCount === 'function') {
                    const cachedTotal = services.pageProcessor.getTotalWordsCount();
                    if (cachedTotal && Number.isFinite(cachedTotal)) {
                        return cachedTotal;
                    }
                }

                // Fallback: if cache is not available yet, derive from adapter once
                const adapter = services.languageRegistry?.getAdapter();
                if (adapter) {
                    const words = await adapter.extractWords(subtitleText, services.dictionaryManager?.dictionary || {});
                    return words.length;
                }
                return 0;
            }

            // No video subtitles - calculate from page text
            const textNodes = this.getAllTextNodes(document.body);
            let totalWords = 0;

            for (const textNode of textNodes) {
                const adapter = services.languageRegistry?.getAdapter();
                if (adapter) {
                    const words = await adapter.extractWords(textNode.textContent, services.dictionaryManager?.dictionary || {});
                    totalWords += words.length;
                }
            }

            return totalWords;
        } catch (e) {
            console.warn('Failed to calculate page words count:', e);
            return 0;
        }
    }

    /**
     * Get video subtitle text (helper method)
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
        return allSubtitleText;
    }

    /**
     * Get all text nodes in an element (excluding script/style)
     */
    getAllTextNodes(element: Element): Text[] {
        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip if parent is script, style, or our own UI elements
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    const tagName = parent.tagName.toLowerCase();
                    if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Skip our own UI elements
                    if (parent.closest('.helios-side-tab') ||
                        parent.closest('.popup-container')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Only accept nodes with actual text content
                    if (node.textContent!.trim().length === 0) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node: Node | null;
        while (node = walker.nextNode()) {
            textNodes.push(node as Text);
        }

        return textNodes;
    }

    /**
     * Update all stats at once
     * @param stats - { knownWords, learningWords, ignoredWords, comprehension, pageWords, uniqueComprehension, sentenceBreakdownPercentage, sentenceBreakdown }
     */
    updateStats(stats: Partial<BannerStats>): void {
        if (!this.sideTabInstance) return;

        const safeStats: SideTabStats = {};

        if (stats.knownWords !== undefined) {
            const val = Number(stats.knownWords);
            if (Number.isFinite(val)) {
                this.lastStats.knownWords = val;
            }
            safeStats.knownWords = this.lastStats.knownWords;
        }

        if (stats.learningWords !== undefined) {
            const val = Number(stats.learningWords);
            if (Number.isFinite(val)) {
                this.lastStats.learningWords = val;
            }
            safeStats.learningWords = this.lastStats.learningWords;
        }

        if (stats.ignoredWords !== undefined) {
            const val = Number(stats.ignoredWords);
            if (Number.isFinite(val)) {
                this.lastStats.ignoredWords = val;
            }
            safeStats.ignoredWords = this.lastStats.ignoredWords;
        }

        if (stats.comprehension !== undefined) {
            const val = Number(stats.comprehension);
            if (Number.isFinite(val)) {
                this.lastStats.comprehension = val;
            }
            safeStats.comprehension = this.lastStats.comprehension;
        }

        if (stats.pageWords !== undefined) {
            const val = Number(stats.pageWords);
            if (Number.isFinite(val)) {
                this.lastStats.pageWords = val;
            }
      safeStats.pageWords = this.lastStats.pageWords;
    }

    if (stats.uniqueComprehension !== undefined) {
      const val = Number(stats.uniqueComprehension);
      if (Number.isFinite(val)) {
        this.lastStats.uniqueComprehension = val;
      }
      safeStats.uniqueComprehension = this.lastStats.uniqueComprehension;
    }

    if (stats.sentenceBreakdownPercentage !== undefined) {
      const val = Number(stats.sentenceBreakdownPercentage);
      if (Number.isFinite(val)) {
        this.lastStats.sentenceBreakdownPercentage = val;
      }
      safeStats.sentenceBreakdownPercentage = this.lastStats.sentenceBreakdownPercentage;
    }

    if (stats.sentenceBreakdown !== undefined) {
      this.lastStats.sentenceBreakdown = stats.sentenceBreakdown;
      safeStats.sentenceBreakdown = this.lastStats.sentenceBreakdown;
        }

        this.sideTabInstance.updateStats(safeStats);
    }

    updateComprehension(comprehension: number): void {
        if (!this.sideTabInstance) return;
        this.updateStats({ comprehension });
    }

    updateKnownWords(knownWords: number): void {
        if (!this.sideTabInstance) return;
        this.updateStats({ knownWords });
    }

    updatePageWords(pageWords: number): void {
        if (!this.sideTabInstance) return;
        this.updateStats({ pageWords });
    }

    /**
     * Refresh all data - recalculate comprehension, page words, and known words
     * This method is called when data changes and the sidebar needs to be updated
     * Uses debouncing to prevent excessive calls
     */
    refreshData(): void {
        if (!this.sideTabInstance) return;

        // Debounce to prevent excessive updates
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

      this.refreshTimeout = setTimeout(async () => {
        try {
          // Recalculate comprehension and page words
          const comprehensionRaw = await services.pageProcessor?.calculateComprehensionPercentage();
          const pageWordsRaw = await this.calculatePageWordsCount();
          const knownWordsRaw = services.vocabManager?.getKnownWordsCount();
          const learningWordsRaw = services.vocabManager?.getLearningWordsCount
            ? services.vocabManager.getLearningWordsCount()
            : NaN;
          const ignoredWordsRaw = services.vocabManager?.getIgnoredWordsCount
            ? services.vocabManager.getIgnoredWordsCount()
            : NaN;

          const pageWords = Number.isFinite(pageWordsRaw) ? pageWordsRaw : this.lastStats.pageWords;
          const knownWords = Number.isFinite(knownWordsRaw) ? knownWordsRaw : this.lastStats.knownWords;
          const learningWords = Number.isFinite(learningWordsRaw) ? learningWordsRaw : this.lastStats.learningWords;
          const ignoredWords = Number.isFinite(ignoredWordsRaw) ? ignoredWordsRaw : this.lastStats.ignoredWords;

          // Read derived stats from PageProcessor after comprehension calculation (which updates caches)
          const uniqueStats = services.pageProcessor?.getUniqueWordStats
            ? services.pageProcessor.getUniqueWordStats()
            : { totalUnique: 0, knownUnique: 0 };

          const breakdown = services.pageProcessor?.getSentenceBreakdownStats
            ? services.pageProcessor.getSentenceBreakdownStats()
            : { totalSentences: 0, t0Sentences: 0, t1Sentences: 0, t2Sentences: 0 };

          // No words measured means no figure, not the previous page's figure.
          const comprehension = Number.isFinite(comprehensionRaw)
            ? comprehensionRaw
            : uniqueStats.totalUnique > 0
              ? this.lastStats.comprehension
              : null;

          const uniqueComprehension =
            uniqueStats.totalUnique > 0
              ? Math.round((uniqueStats.knownUnique / uniqueStats.totalUnique) * 100)
              : null;

          const sentenceBreakdownPercentage =
            breakdown.totalSentences > 0
              ? Math.round(((breakdown.t0Sentences + breakdown.t1Sentences + breakdown.t2Sentences) / breakdown.totalSentences) * 100)
              : null;

          // Update all stats
          this.updateStats({
            knownWords: knownWords,
            learningWords: learningWords,
            ignoredWords: ignoredWords,
            comprehension,
            pageWords: pageWords,
            uniqueComprehension,
            sentenceBreakdownPercentage,
            sentenceBreakdown: breakdown
          });

          // Update hover tooltips with raw counts
          const totalTokens = services.pageProcessor?.getTotalWordsCount
            ? services.pageProcessor.getTotalWordsCount()
            : 0;
          const knownTokens = services.pageProcessor?.getKnownWordsCount
            ? services.pageProcessor.getKnownWordsCount()
            : 0;

          if (this.sideTabInstance?.updateComprehensionTooltip) {
            this.sideTabInstance.updateComprehensionTooltip(knownTokens, totalTokens);
          }
          if (this.sideTabInstance?.updateUniqueTooltip) {
            this.sideTabInstance.updateUniqueTooltip(uniqueStats.knownUnique || 0, uniqueStats.totalUnique || 0);
          }
          if (this.sideTabInstance?.updateSentenceBreakdownTooltip) {
            this.sideTabInstance.updateSentenceBreakdownTooltip(breakdown);
          }

          console.log(
            '📊 Sidebar data refreshed - Comprehension:',
            comprehension + '%',
            'Known Words:',
            knownWords,
            'Learning Words:',
            learningWords,
            'Ignored Words:',
            ignoredWords,
            'Page Words:',
            pageWords,
            'Unique Comprehension:',
            uniqueComprehension + '%',
            'Sentence breakdown:',
            sentenceBreakdownPercentage + '%'
          );
        } catch (error) {
          console.error('Error refreshing sidebar data:', error);
        }
        this.refreshTimeout = null;
      }, 300); // 300ms debounce - prevents updates more frequent than every 300ms
    }

    /**
     * Called when vocabulary is updated (word marked as known/unknown)
     * This is an alias for refreshData() for backwards compatibility
     */
    onVocabUpdate(): void {
        this.refreshData();
    }

    /**
     * Called when pronunciation toggle is changed
     * Updates the pinyin UI state in the side tab
     * @param enabled - Whether pronunciation is enabled
     */
    onPronunciationToggle(enabled: boolean): void {
        if (!this.sideTabInstance) return;

        // Update pinyin UI state in the side tab
        this.sideTabInstance.updatePinyinUI(enabled);
    }

    /**
     * Called when pinyin toggle is changed
     * Updates the pinyin UI state in the side tab
     * @param enabled - Whether pinyin is enabled
     */
    onPinyinToggle(enabled: boolean): void {
        if (!this.sideTabInstance) return;

        // Update pinyin UI state in the side tab
        this.sideTabInstance.updatePinyinUI(enabled);
    }

    hideBanner(): void {
        this.pendingVisible = false;
        if (this.sideTabInstance) {
            this.sideTabInstance.hide();
        }
    }

    showBanner(): void {
        this.pendingVisible = true;
        if (this.sideTabInstance) {
            this.sideTabInstance.show();
        }
    }
}
