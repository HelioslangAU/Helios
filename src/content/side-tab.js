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

        // Stat elements - Full view
        this.fullComprehension = document.getElementById('full-comprehension');
        this.fullKnownWords = document.getElementById('full-known-words');
        this.fullPageWords = document.getElementById('full-page-words');
        this.comprehensionProgress = document.getElementById('comprehension-progress');

        // Data
        this.knownWordsCount = 0;
        this.comprehensionPercentage = 0;
        this.pageWordsCount = 0;

        this.initEventListeners();
        this.loadState();
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
     * Update stats
     * @param {Object} stats - { knownWords, comprehension, pageWords }
     */
    updateStats(stats) {
        // Re-query all elements to ensure fresh references
        this.refreshElementReferences();

        if (stats.knownWords !== undefined) {
            this.knownWordsCount = stats.knownWords;
            this.updateKnownWords(stats.knownWords);
        }

        if (stats.comprehension !== undefined) {
            this.comprehensionPercentage = stats.comprehension;
            this.updateComprehension(stats.comprehension);
        }

        if (stats.pageWords !== undefined) {
            this.pageWordsCount = stats.pageWords;
            this.updatePageWords(stats.pageWords);
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

        // Stat elements - Full view
        this.fullComprehension = document.getElementById('full-comprehension');
        this.fullKnownWords = document.getElementById('full-known-words');
        this.fullPageWords = document.getElementById('full-page-words');
        this.comprehensionProgress = document.getElementById('comprehension-progress');

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
            this.fullComprehension.textContent = formatted;
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

        if (this.partialKnownWords) {
            this.partialKnownWords.textContent = formatted;
        }

        if (this.fullKnownWords) {
            this.fullKnownWords.textContent = formatted;
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
        console.log('[Helios Side Tab] Toggling YouTube subtitle panel');
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