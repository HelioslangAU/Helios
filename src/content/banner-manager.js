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
        const comprehension = window.pageProcessor.calculateComprehensionPercentage();
        const pageWords = this.calculatePageWordsCount();

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
     * Calculate total words on the page
     * @returns {number}
     */
    calculatePageWordsCount() {
        try {
            const textNodes = this.getAllTextNodes(document.body);
            let totalWords = 0;

            for (const textNode of textNodes) {
                const adapter = window.languageRegistry.getAdapter();
                const words = adapter.extractWords(textNode.textContent, window.dictionaryManager.dictionary);
                totalWords += words.length;
            }

            return totalWords;
        } catch (e) {
            console.warn('Failed to calculate page words count:', e);
            return 0;
        }
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