/**
 * Helios Side Tab - Three-State Panel
 * Manages the collapsible side panel with stats and actions
 */

class HeliosSideTab {
    constructor() {
        this.container = document.getElementById('helios-side-tab');
        this.state = 'closed'; // closed, partial, full

        // Elements
        this.peekTab = document.getElementById('side-tab-peek');
        this.partialView = document.getElementById('side-tab-partial');
        this.fullView = document.getElementById('side-tab-full');

        // Buttons
        this.expandBtn = document.getElementById('partial-expand-btn');
        this.partialCloseBtn = document.getElementById('partial-close-btn');
        this.closeBtn = document.getElementById('full-close-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.youtubeSubtitlesBtn = document.getElementById('youtube-subtitles-btn');
        this.positionToggleBtn = document.getElementById('position-toggle-btn');

        // Pinyin controls (full view)
        this.pinyinContainer = document.getElementById('pinyin-toggle-container');
        this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox');
        this.pinyinStatus = document.getElementById('pinyin-status');

        // Debouncing state for pinyin toggle
        this.pinyinToggling = false;

        // Stat elements - Partial view
        this.partialComprehension = document.getElementById('partial-comprehension');
        this.partialKnownWords = document.getElementById('partial-known-words');
        this.partialPageWords = document.getElementById('partial-page-words');
        this.partialUniqueComprehension = document.getElementById('partial-unique-comprehension');
        this.partialT1Sentences = document.getElementById('partial-t1-sentences');

        // Stat elements - Full view
        this.fullComprehension = document.getElementById('full-comprehension');
        this.fullKnownWords = document.getElementById('full-known-words');
        this.fullLearningWords = document.getElementById('full-learning-words');
        this.fullIgnoredWords = document.getElementById('full-ignored-words');
        this.fullPageWords = document.getElementById('full-page-words');
        this.comprehensionProgress = document.getElementById('comprehension-progress');
        this.fullUniqueComprehension = document.getElementById('full-unique-comprehension');
        this.fullT1Sentences = document.getElementById('full-t1-sentences');

        // Data
        this.knownWordsCount = 0;
        this.learningWordsCount = 0;
        this.ignoredWordsCount = 0;
        this.comprehensionPercentage = 0;
        this.pageWordsCount = 0;
        this.uniqueComprehensionPercentage = 0;
        this.t1SentencePercentage = 0;

        // Position state
        this.position = 'right'; // 'left' or 'right'

        this.initEventListeners();
        this.loadState();
        this.loadPosition();
        this.updatePositionUI();
        this.updateYouTubeFeatures();
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Peek tab click - open to partial
        this.peekTab?.addEventListener('click', () => {
            this.setState('partial');
        });

        // Expand button - open to full
        this.expandBtn?.addEventListener('click', () => {
            this.setState('full');
        });

        // Partial close button - completely close side tab
        this.partialCloseBtn?.addEventListener('click', () => {
            this.setState('closed');
        });

        // Full close button - close to partial
        this.closeBtn?.addEventListener('click', () => {
            this.setState('partial');
        });

        // Partial view click (except on buttons) - toggle between partial and full
        this.partialView?.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                this.setState('full');
            }
        });

        // Click outside full view to collapse to partial
        document.addEventListener('click', (e) => {
            if (this.state === 'full' &&
                !this.fullView.contains(e.target) &&
                !this.partialView.contains(e.target) &&
                !this.peekTab.contains(e.target)) {
                this.setState('partial');
            }
        });

        // Settings button
        this.settingsBtn?.addEventListener('click', () => {
            this.handleSettings();
        });

        // YouTube Subtitles button (full view)
        this.youtubeSubtitlesBtn?.addEventListener('click', () => {
            this.handleYouTubeSubtitles();
        });

        // Pinyin toggle checkbox (Chinese only)
        this.pinyinCheckbox?.addEventListener('change', (e) => {
            this.handlePinyinToggle(e.target.checked);
        });

        // Also allow clicking the container
        this.pinyinContainer?.addEventListener('click', (e) => {
            if (e.target !== this.pinyinCheckbox && !e.target.closest('.pinyin-slider')) {
                this.pinyinCheckbox.checked = !this.pinyinCheckbox.checked;
                this.handlePinyinToggle(this.pinyinCheckbox.checked);
            }
        });

        // Position toggle button
        this.positionToggleBtn?.addEventListener('click', () => {
            this.togglePosition();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to close/collapse
            if (e.key === 'Escape' && this.state !== 'closed') {
                if (this.state === 'full') {
                    this.setState('partial');
                } else if (this.state === 'partial') {
                    this.setState('closed');
                }
            }

            // Alt + S to toggle side tab
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                this.toggleState();
            }
        });
    }

    /**
     * Set the current state
     * @param {string} newState - 'closed', 'partial', or 'full'
     */
    setState(newState) {
        if (this.state === newState) return;

        const validStates = ['closed', 'partial', 'full'];
        if (!validStates.includes(newState)) {
            console.error(`Invalid state: ${newState}`);
            return;
        }

        this.state = newState;
        this.container.setAttribute('data-state', newState);
        this.saveState();

        // Trigger custom event
        this.container.dispatchEvent(new CustomEvent('statechange', {
            detail: { state: newState }
        }));
    }

    /**
     * Toggle between states
     */
    toggleState() {
        const stateMap = {
            'closed': 'partial',
            'partial': 'full',
            'full': 'closed'
        };
        this.setState(stateMap[this.state]);
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            localStorage.setItem('helios-side-tab-state', this.state);
        } catch (e) {
            console.warn('Failed to save side tab state:', e);
        }
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const savedState = localStorage.getItem('helios-side-tab-state');
            if (savedState && ['closed', 'partial', 'full'].includes(savedState)) {
                this.setState(savedState);
            }
        } catch (e) {
            console.warn('Failed to load side tab state:', e);
        }
    }

    /**
     * Toggle position between left and right
     */
    togglePosition() {
        const newPosition = this.position === 'right' ? 'left' : 'right';
        this.setPosition(newPosition);
    }

    /**
     * Set the position of the side tab
     * @param {string} position - 'left' or 'right'
     */
    setPosition(position) {
        if (this.position === position) return;

        const validPositions = ['left', 'right'];
        if (!validPositions.includes(position)) {
            console.error(`Invalid position: ${position}`);
            return;
        }

        this.position = position;
        this.container.setAttribute('data-position', position);
        this.savePosition();
        this.updatePositionUI();
    }

    /**
     * Save position to localStorage
     */
    savePosition() {
        try {
            localStorage.setItem('helios-side-tab-position', this.position);
        } catch (e) {
            console.warn('Failed to save side tab position:', e);
        }
    }

    /**
     * Load position from localStorage
     */
    loadPosition() {
        try {
            const savedPosition = localStorage.getItem('helios-side-tab-position');
            if (savedPosition && ['left', 'right'].includes(savedPosition)) {
                this.setPosition(savedPosition);
            } else {
                // Set default position if no saved position exists
                this.container.setAttribute('data-position', this.position);
            }
        } catch (e) {
            console.warn('Failed to load side tab position:', e);
            // Set default position on error
            this.container.setAttribute('data-position', this.position);
        }
    }

    /**
     * Update position UI elements
     */
    updatePositionUI() {
        if (this.positionToggleBtn) {
            const tooltipText = this.position === 'right' ? 'Move to Left Side' : 'Move to Right Side';
            this.positionToggleBtn.setAttribute('data-tooltip', tooltipText);
        }
    }

    /**
     * Update stats
     * @param {Object} stats - { knownWords, learningWords, ignoredWords, comprehension, pageWords, uniqueComprehension, t1SentencePercentage }
     */
    updateStats(stats) {
        // Re-query all elements to ensure fresh references
        this.refreshElementReferences();

        if (stats.knownWords !== undefined) {
            this.knownWordsCount = stats.knownWords;
            this.updateKnownWords(stats.knownWords);
        }

        if (stats.learningWords !== undefined) {
            this.learningWordsCount = stats.learningWords;
            this.updateLearningWords(stats.learningWords);
        }

        if (stats.ignoredWords !== undefined) {
            this.ignoredWordsCount = stats.ignoredWords;
            this.updateIgnoredWords(stats.ignoredWords);
        }

        if (stats.comprehension !== undefined) {
            this.comprehensionPercentage = stats.comprehension;
            this.updateComprehension(stats.comprehension);
        }

        if (stats.pageWords !== undefined) {
            this.pageWordsCount = stats.pageWords;
            this.updatePageWords(stats.pageWords);
        }

        if (stats.uniqueComprehension !== undefined) {
            this.updateUniqueComprehension(stats.uniqueComprehension);
        }

        if (stats.t1SentencePercentage !== undefined) {
            this.updateT1SentenceCoverage(stats.t1SentencePercentage);
        }
    }

    /**
     * Refresh all element references
     */
    refreshElementReferences() {
        // Stat elements - Partial view
        this.partialComprehension = document.getElementById('partial-comprehension');
        this.partialKnownWords = document.getElementById('partial-known-words');
        this.partialPageWords = document.getElementById('partial-page-words');
        this.partialUniqueComprehension = document.getElementById('partial-unique-comprehension');
        this.partialT1Sentences = document.getElementById('partial-t1-sentences');

        // Stat elements - Full view
        this.fullComprehension = document.getElementById('full-comprehension');
        this.fullKnownWords = document.getElementById('full-known-words');
        this.fullLearningWords = document.getElementById('full-learning-words');
        this.fullIgnoredWords = document.getElementById('full-ignored-words');
        this.fullPageWords = document.getElementById('full-page-words');
        this.comprehensionProgress = document.getElementById('comprehension-progress');
        this.fullUniqueComprehension = document.getElementById('full-unique-comprehension');
        this.fullT1Sentences = document.getElementById('full-t1-sentences');

        // Pinyin elements
        this.pinyinContainer = document.getElementById('pinyin-toggle-container');
        this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox');
        this.pinyinStatus = document.getElementById('pinyin-status');
    }

    /**
     * Update comprehension display
     * @param {number} percentage
     */
    updateComprehension(percentage) {
        const formatted = `${Math.round(percentage)}%`;

        if (this.partialComprehension) {
            this.partialComprehension.textContent = formatted;
        }

        if (this.fullComprehension) {
            const pctSpan = this.fullComprehension.querySelector('.stat-main-percentage');
            if (pctSpan) {
                pctSpan.textContent = formatted;
            }
        }

        if (this.comprehensionProgress) {
            this.comprehensionProgress.style.width = `${percentage}%`;
        }
    }

    /**
     * Update known words display
     * @param {number} count
     */
    updateKnownWords(count) {
        const formatted = this.formatNumber(count);
        const tooltipText = `${count} known words`;

        if (this.partialKnownWords) {
            this.partialKnownWords.textContent = formatted;
            const item = this.partialKnownWords.closest('.partial-stat-item');
            if (item) {
                item.setAttribute('data-tooltip', tooltipText);
            }
        }

        if (this.fullKnownWords) {
            // In expanded view, always show the exact count (with commas)
            this.fullKnownWords.textContent = Number.isFinite(count)
                ? count.toLocaleString()
                : formatted;
            this.fullKnownWords.title = tooltipText;
        }
    }

    /**
     * Update learning words display (expanded view only)
     * @param {number} count
     */
    updateLearningWords(count) {
        if (this.fullLearningWords) {
            this.fullLearningWords.textContent = Number.isFinite(count)
                ? count.toLocaleString()
                : `${count}`;
        }
    }

    /**
     * Update ignored words display (expanded view only)
     * @param {number} count
     */
    updateIgnoredWords(count) {
        if (this.fullIgnoredWords) {
            this.fullIgnoredWords.textContent = Number.isFinite(count)
                ? count.toLocaleString()
                : `${count}`;
        }
    }

    /**
     * Update page words display
     * @param {number} count
     */
    updatePageWords(count) {
        const formatted = this.formatNumber(count);

        if (this.partialPageWords) {
            this.partialPageWords.textContent = formatted;
        }

        if (this.fullPageWords) {
            this.fullPageWords.textContent = formatted;
        }
    }

    /**
     * Update unique-word comprehension display
     * @param {number} percentage
     */
    updateUniqueComprehension(percentage) {
        this.uniqueComprehensionPercentage = percentage;
        const formatted = `${Math.round(percentage)}%`;

        if (this.partialUniqueComprehension) {
            this.partialUniqueComprehension.textContent = formatted;
        }

        if (this.fullUniqueComprehension) {
            const pctSpan = this.fullUniqueComprehension.querySelector('.stat-main-percentage');
            if (pctSpan) {
                pctSpan.textContent = formatted;
            }
        }
    }

    /**
     * Update the hover tooltip text for comprehension with raw counts.
     * @param {number} knownTokens
     * @param {number} totalTokens
     */
    updateComprehensionTooltip(knownTokens, totalTokens) {
        const tooltipText = `${knownTokens}/${totalTokens} words known`;

        // Partial view tooltip (CSS-driven via data-tooltip)
        if (this.partialComprehension) {
            const item = this.partialComprehension.closest('.partial-stat-item');
            if (item) {
                item.setAttribute('data-tooltip', tooltipText);
            }
        }

        // Full view: show percentage + raw counts and native title tooltip
        if (this.fullComprehension) {
            const pctSpan = this.fullComprehension.querySelector('.stat-main-percentage');
            const countSpan = this.fullComprehension.querySelector('.stat-secondary-count');
            if (pctSpan) {
                pctSpan.textContent = `${Math.round(this.comprehensionPercentage || 0)}%`;
            }
            if (countSpan) {
                countSpan.textContent = `${knownTokens}/${totalTokens}`;
            }
            this.fullComprehension.title = tooltipText;
        }
    }

    /**
     * Update the hover tooltip text for unique-word stats with raw counts.
     * @param {number} knownUnique
     * @param {number} totalUnique
     */
    updateUniqueTooltip(knownUnique, totalUnique) {
        const tooltipText = `${knownUnique}/${totalUnique} unique words known`;

        // Partial view tooltip (CSS-driven via data-tooltip)
        if (this.partialUniqueComprehension) {
            const item = this.partialUniqueComprehension.closest('.partial-stat-item');
            if (item) {
                item.setAttribute('data-tooltip', tooltipText);
            }
        }

        // Full view: show percentage + raw counts and native title tooltip
        if (this.fullUniqueComprehension) {
            const pctSpan = this.fullUniqueComprehension.querySelector('.stat-main-percentage');
            const countSpan = this.fullUniqueComprehension.querySelector('.stat-secondary-count');
            if (pctSpan) {
                pctSpan.textContent = `${Math.round(this.uniqueComprehensionPercentage || 0)}%`;
            }
            if (countSpan) {
                countSpan.textContent = `${knownUnique}/${totalUnique}`;
            }
            this.fullUniqueComprehension.title = tooltipText;
        }
    }

    /**
     * Update the hover tooltip and display for T1 sentence stats with raw counts.
     * @param {number} t1Count
     * @param {number} totalSentences
     */
    updateT1Tooltip(t1Count, totalSentences) {
        const tooltipText = `${t1Count}/${totalSentences} sentences are T1 (all but one word known)`;

        // Full view: show percentage + raw counts and native title tooltip
        if (this.fullT1Sentences) {
            const pctSpan = this.fullT1Sentences.querySelector('.stat-main-percentage');
            const countSpan = this.fullT1Sentences.querySelector('.stat-secondary-count');
            if (pctSpan) {
                pctSpan.textContent = `${Math.round(this.t1SentencePercentage || 0)}%`;
            }
            if (countSpan) {
                countSpan.textContent = `${t1Count}/${totalSentences}`;
            }
            this.fullT1Sentences.title = tooltipText;
        }
    }

    /**
     * Update T1 sentence coverage display
     * @param {number} percentage
     */
    updateT1SentenceCoverage(percentage) {
        this.t1SentencePercentage = percentage;
        const formatted = `${Math.round(percentage)}%`;

        if (this.partialT1Sentences) {
            this.partialT1Sentences.textContent = formatted;
        }

        if (this.fullT1Sentences) {
            const pctSpan = this.fullT1Sentences.querySelector('.stat-main-percentage');
            if (pctSpan) {
                pctSpan.textContent = formatted;
            }
        }
    }

    /**
     * Format number with commas
     * @param {number} num
     * @returns {string}
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    /**
     * Handle settings
     */
    handleSettings() {
        console.log('Opening settings...');

        // Send message to background script to open options page
        // Content scripts can't directly call openOptionsPage()
        chrome.runtime.sendMessage({ action: 'openSettings' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error opening settings:', chrome.runtime.lastError);
            }
        });
    }

    /**
     * Handle Pinyin toggle (Chinese only)
     * @param {boolean} shouldEnable - Whether to enable or disable
     */
    handlePinyinToggle(shouldEnable) {
        // Prevent rapid toggling
        if (this.pinyinToggling) {
            console.log('Pinyin toggle in progress, ignoring...');
            // Revert checkbox to current state
            if (this.pinyinCheckbox && window.pronunciationManager) {
                this.pinyinCheckbox.checked = window.pronunciationManager.isEnabled();
            }
            return;
        }

        if (!window.pronunciationManager) {
            console.warn('PronunciationManager not available');
            return;
        }

        // Set toggling flag
        this.pinyinToggling = true;

        // Get current state
        const currentState = window.pronunciationManager.isEnabled();

        // Only toggle if the state is different
        if (shouldEnable !== currentState) {
            console.log('Toggling pronunciation:', shouldEnable);
            window.pronunciationManager.togglePronunciation();
        }

        // Update UI immediately with the desired state
        this.updatePinyinUI(shouldEnable);

        // Verify and update UI again after toggle completes
        setTimeout(() => {
            const actualState = window.pronunciationManager.isEnabled();
            this.updatePinyinUI(actualState);
            this.pinyinToggling = false;
        }, 500);
    }

    /**
     * Update Pinyin UI state
     * @param {boolean} isEnabled
     */
    updatePinyinUI(isEnabled) {
        // Update full view container
        if (this.pinyinContainer) {
            if (isEnabled) {
                this.pinyinContainer.classList.add('active');
                this.pinyinStatus.textContent = 'Visible';
            } else {
                this.pinyinContainer.classList.remove('active');
                this.pinyinStatus.textContent = 'Hidden';
            }
        }

        // Sync checkbox state
        if (this.pinyinCheckbox) {
            this.pinyinCheckbox.checked = isEnabled;
        }
    }

    /**
     * Update language-specific features
     * @param {string} language - Current language code
     */
    updateLanguageFeatures(language) {
        const isChinese = language && (
            language.toLowerCase() === 'zh' ||
            language.toLowerCase() === 'chinese' ||
            language.toLowerCase().includes('chin')
        );

        // Show/hide pinyin toggle in full view
        if (this.pinyinContainer) {
            if (isChinese) {
                this.pinyinContainer.style.display = 'flex';

                // Initialize checkbox state based on pronunciation manager
                if (window.pronunciationManager) {
                    const isEnabled = window.pronunciationManager.isEnabled();
                    this.updatePinyinUI(isEnabled);
                }
            } else {
                this.pinyinContainer.style.display = 'none';
            }
        }
    }

    /**
     * Check if current page is YouTube
     * @returns {boolean}
     */
    isYouTubePage() {
        return window.location.hostname.includes('youtube.com') ||
               window.location.hostname.includes('youtu.be');
    }

    /**
     * Update YouTube-specific features
     */
    updateYouTubeFeatures() {
        const isYouTube = this.isYouTubePage();

        // Show/hide YouTube subtitles button in full view
        if (this.youtubeSubtitlesBtn) {
            this.youtubeSubtitlesBtn.style.display = isYouTube ? 'flex' : 'none';
        }
    }

    /**
     * Handle YouTube Subtitles button click
     */
    handleYouTubeSubtitles() {
        // Dispatch event to toggle YouTube sidebar
        document.dispatchEvent(new CustomEvent('helios-toggle-subtitle-panel'));
    }


    /**
     * Show loading state
     */
    showLoading() {
        this.container.classList.add('loading');
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.container.classList.remove('loading');
    }

    /**
     * Show the side tab
     */
    show() {
        this.container.style.display = 'block';
    }

    /**
     * Hide the side tab
     */
    hide() {
        this.container.style.display = 'none';
    }

    /**
     * Destroy the side tab
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);

        // Remove from DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeliosSideTab;
}
