class BannerManager {
    constructor() {
        this.sideTab = null;
        this.sideTabInstance = null;
        this.init();
    }

    init() {
        this.injectSideTabCSS();
        this.createSideTab();
    }

    injectSideTabCSS() {
        if (!document.getElementById('language-extension-side-tab-css')) {
            const link = document.createElement('link');
            link.id = 'language-extension-side-tab-css';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            // File paths are centralized in src/config/paths.js
            link.href = window.PATHS ? window.PATHS.getChromeURL('CSS.SIDE_TAB') : chrome.runtime.getURL('src/ui/side-tab/side-tab.css');
            document.head.appendChild(link);
        }
    }

    async createSideTab() {
        // Fetch the HTML for the side tab
        // File paths are centralized in src/config/paths.js
        const sideTabUrl = window.PATHS ? window.PATHS.getChromeURL('HTML.SIDE_TAB') : chrome.runtime.getURL('src/ui/side-tab/side-tab.html');
        const response = await fetch(sideTabUrl);
        const html = await response.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;
        this.sideTab = temp.firstElementChild;
        document.body.appendChild(this.sideTab);

        // Now that the side tab is in the DOM, we can instantiate the side tab logic
        this.sideTabInstance = new HeliosSideTab();

        // Calculate and update initial stats
        const comprehension = await window.pageProcessor.calculateComprehensionPercentage();
        const pageWords = await this.calculatePageWordsCount();

        this.updateStats({
            knownWords: window.vocabManager.getKnownWordsCount(),
            comprehension: comprehension,
            pageWords: pageWords
        });

        // Update language-specific features
        this.updateLanguageFeatures();

        // Listen for language changes to update language-specific features
        if (window.languageRegistry) {
            window.languageRegistry.on('languageChanged', () => {
                this.updateLanguageFeatures();
            });
        }
    }

    /**
     * Update language-specific features in the side tab
     */
    updateLanguageFeatures() {
        if (!this.sideTabInstance) return;

        try {
            // Get current language code directly from languageRegistry
            const language = window.languageRegistry?.getCurrentLanguage();

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
     * @returns {number}
     */
    async calculatePageWordsCount() {
        try {
            // First, check if video subtitles are active
            const subtitleText = this.getVideoSubtitleText();
            
            if (subtitleText !== null) {
                // Video subtitles are active - calculate words from subtitle text
                const adapter = window.languageRegistry?.getAdapter();
                if (adapter) {
                    const words = await adapter.extractWords(subtitleText, window.dictionaryManager?.dictionary || {});
                    return words.length;
                }
                return 0;
            }

            // No video subtitles - calculate from page text
            const textNodes = this.getAllTextNodes(document.body);
            let totalWords = 0;

            for (const textNode of textNodes) {
                const adapter = window.languageRegistry?.getAdapter();
                if (adapter) {
                    const words = await adapter.extractWords(textNode.textContent, window.dictionaryManager?.dictionary || {});
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
     * @returns {string|null}
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
        return allSubtitleText;
    }

    /**
     * Get all text nodes in an element (excluding script/style)
     * @param {Element} element
     * @returns {Text[]}
     */
    getAllTextNodes(element) {
        const textNodes = [];
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
                    if (node.textContent.trim().length === 0) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    /**
     * Update all stats at once
     * @param {Object} stats - { knownWords, comprehension, pageWords }
     */
    updateStats(stats) {
        if (!this.sideTabInstance) return;
        this.sideTabInstance.updateStats(stats);
    }

    updateComprehension(comprehension) {
        if (!this.sideTabInstance) return;
        this.sideTabInstance.updateStats({ comprehension });
    }

    updateKnownWords(knownWords) {
        if (!this.sideTabInstance) return;
        this.sideTabInstance.updateStats({ knownWords });
    }

    updatePageWords(pageWords) {
        if (!this.sideTabInstance) return;
        this.sideTabInstance.updateStats({ pageWords });
    }

    /**
     * Refresh all data - recalculate comprehension, page words, and known words
     * This method is called when data changes and the sidebar needs to be updated
     * Uses debouncing to prevent excessive calls
     */
    refreshData() {
        if (!this.sideTabInstance) return;

        // Debounce to prevent excessive updates
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(async () => {
            try {
                // Recalculate comprehension and page words
                const comprehension = await window.pageProcessor?.calculateComprehensionPercentage() || 0;
                const pageWords = await this.calculatePageWordsCount();
                const knownWords = window.vocabManager?.getKnownWordsCount() || 0;

                // Update all stats
                this.updateStats({
                    knownWords: knownWords,
                    comprehension: comprehension,
                    pageWords: pageWords
                });

                console.log('📊 Sidebar data refreshed - Comprehension:', comprehension + '%', 'Known Words:', knownWords, 'Page Words:', pageWords);
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
    onVocabUpdate() {
        this.refreshData();
    }

    /**
     * Called when pronunciation toggle is changed
     * Updates the pinyin UI state in the side tab
     * @param {boolean} enabled - Whether pronunciation is enabled
     */
    onPronunciationToggle(enabled) {
        if (!this.sideTabInstance) return;
        
        // Update pinyin UI state in the side tab
        this.sideTabInstance.updatePinyinUI(enabled);
    }

    /**
     * Called when pinyin toggle is changed
     * Updates the pinyin UI state in the side tab
     * @param {boolean} enabled - Whether pinyin is enabled
     */
    onPinyinToggle(enabled) {
        if (!this.sideTabInstance) return;
        
        // Update pinyin UI state in the side tab
        this.sideTabInstance.updatePinyinUI(enabled);
    }

    hideBanner() {
        if (this.sideTabInstance) {
            this.sideTabInstance.hide();
        }
    }

    showBanner() {
        if (this.sideTabInstance) {
            this.sideTabInstance.show();
        }
    }
}