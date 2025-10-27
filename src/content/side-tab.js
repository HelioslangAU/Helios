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

        // Pinyin controls (full view)
        this.pinyinContainer = document.getElementById('pinyin-toggle-container');
        this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox');
        this.pinyinStatus = document.getElementById('pinyin-status');

        // Pinyin button (partial view)
        this.partialPinyinBtn = document.getElementById('partial-pinyin-btn');
        this.partialPinyinLabel = this.partialPinyinBtn?.querySelector('.pinyin-label');

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

        // Partial view pinyin button
        this.partialPinyinBtn?.addEventListener('click', () => {
            if (window.pronunciationManager) {
                const newState = !window.pronunciationManager.isEnabled();
                this.handlePinyinToggle(newState);
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
        console.log('📊 Side tab updating stats:', stats);

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

        // Ensure pinyin button is still visible if it should be
        this.checkPinyinButtonVisibility();
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
        this.partialPinyinBtn = document.getElementById('partial-pinyin-btn');
        this.partialPinyinLabel = this.partialPinyinBtn?.querySelector('.pinyin-label');
        this.pinyinContainer = document.getElementById('pinyin-toggle-container');
        this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox');
        this.pinyinStatus = document.getElementById('pinyin-status');

        console.log('🔄 Refreshed all element references');
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

        // Update partial view button
        if (this.partialPinyinBtn) {
            if (isEnabled) {
                this.partialPinyinBtn.classList.add('active');
                if (this.partialPinyinLabel) {
                    this.partialPinyinLabel.textContent = 'ON';
                }
            } else {
                this.partialPinyinBtn.classList.remove('active');
                if (this.partialPinyinLabel) {
                    this.partialPinyinLabel.textContent = 'OFF';
                }
            }
        }
    }

    /**
     * Update language-specific features
     * @param {string} language - Current language code
     */
    updateLanguageFeatures(language) {
        console.log('Side tab: Updating language features for:', language);

        const isChinese = language && (
            language.toLowerCase() === 'zh' ||
            language.toLowerCase() === 'chinese' ||
            language.toLowerCase().includes('chin')
        );

        console.log('Side tab: Is Chinese?', isChinese);

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

        // Show/hide pinyin button in partial view
        if (this.partialPinyinBtn) {
            if (isChinese) {
                this.partialPinyinBtn.style.display = 'flex';

                // Initialize active state based on pronunciation manager
                if (window.pronunciationManager) {
                    const isEnabled = window.pronunciationManager.isEnabled();
                    this.updatePinyinUI(isEnabled);
                }
            } else {
                this.partialPinyinBtn.style.display = 'none';
            }
        }
    }

    /**
     * Check and maintain pinyin button visibility after stats update
     */
    checkPinyinButtonVisibility() {
        if (!window.languageRegistry) return;

        const currentLanguage = window.languageRegistry.getCurrentLanguage();
        const isChinese = currentLanguage && (
            currentLanguage.toLowerCase() === 'zh' ||
            currentLanguage.toLowerCase() === 'chinese' ||
            currentLanguage.toLowerCase().includes('chin')
        );

        console.log('🔍 Checking pinyin visibility - Language:', currentLanguage, 'Is Chinese:', isChinese);

        // Re-query elements if reference is lost
        if (!this.partialPinyinBtn || !document.body.contains(this.partialPinyinBtn)) {
            this.partialPinyinBtn = document.getElementById('partial-pinyin-btn');
            this.partialPinyinLabel = this.partialPinyinBtn?.querySelector('.pinyin-label');
            console.log('🔄 Refreshed partial pinyin button reference:', !!this.partialPinyinBtn);
        }

        if (!this.pinyinContainer || !document.body.contains(this.pinyinContainer)) {
            this.pinyinContainer = document.getElementById('pinyin-toggle-container');
            this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox');
            this.pinyinStatus = document.getElementById('pinyin-status');
            console.log('🔄 Refreshed full pinyin container reference:', !!this.pinyinContainer);
        }

        // Ensure correct visibility based on current language
        if (isChinese) {
            if (this.partialPinyinBtn) {
                const currentDisplay = this.partialPinyinBtn.style.display;
                const computedStyle = window.getComputedStyle(this.partialPinyinBtn);
                const svgElement = this.partialPinyinBtn.querySelector('svg');
                const textElements = this.partialPinyinBtn.querySelectorAll('text');

                console.log('📍 Partial pinyin button - Display:', currentDisplay);
                console.log('📍 Computed visibility:', computedStyle.visibility, 'Opacity:', computedStyle.opacity);
                console.log('📍 SVG exists:', !!svgElement, 'Text elements:', textElements.length);

                // Check text content
                if (textElements.length > 0) {
                    textElements.forEach((text, i) => {
                        const computedColor = window.getComputedStyle(text).fill;
                        const computedTextColor = window.getComputedStyle(text).color;
                        console.log(`📍 Text element ${i}:`, text.textContent, 'Fill attr:', text.getAttribute('fill'), 'Computed fill:', computedColor, 'Computed color:', computedTextColor);
                    });
                }

                const iconDiv = this.partialPinyinBtn.querySelector('.partial-icon');
                if (iconDiv) {
                    const iconComputedColor = window.getComputedStyle(iconDiv).color;
                    const svgComputedColor = window.getComputedStyle(svgElement).color;
                    const iconRect = iconDiv.getBoundingClientRect();
                    const svgRect = svgElement.getBoundingClientRect();
                    const buttonRect = this.partialPinyinBtn.getBoundingClientRect();

                    const buttonStyle = window.getComputedStyle(this.partialPinyinBtn);
                    const iconDivStyle = window.getComputedStyle(iconDiv);

                    console.log('📍 Icon div exists:', !!iconDiv, 'Classes:', iconDiv?.className);
                    console.log('📍 Icon div color:', iconComputedColor, 'SVG color:', svgComputedColor);
                    console.log('📏 Button dimensions:', buttonRect.width, 'x', buttonRect.height);
                    console.log('📏 Icon div dimensions:', iconRect.width, 'x', iconRect.height);
                    console.log('📏 SVG dimensions:', svgRect.width, 'x', svgRect.height);
                    console.log('📍 Button position:', buttonRect.top, buttonRect.left);
                    console.log('📍 Button z-index:', buttonStyle.zIndex, 'Icon z-index:', iconDivStyle.zIndex);
                    console.log('📍 Button transform:', buttonStyle.transform);

                    // Check if button is in viewport
                    const inViewport = buttonRect.top >= 0 &&
                                      buttonRect.left >= 0 &&
                                      buttonRect.bottom <= window.innerHeight &&
                                      buttonRect.right <= window.innerWidth;
                    console.log('📍 Button in viewport:', inViewport);

                    // Check what element is actually at the button's position
                    const centerX = buttonRect.left + buttonRect.width / 2;
                    const centerY = buttonRect.top + buttonRect.height / 2;
                    const elementAtPoint = document.elementFromPoint(centerX, centerY);
                    console.log('🎯 Element at button center:', elementAtPoint?.tagName, elementAtPoint?.className, elementAtPoint?.id);
                    console.log('🎯 Is it the button or its child?',
                        elementAtPoint === this.partialPinyinBtn ||
                        this.partialPinyinBtn.contains(elementAtPoint));
                }

                console.log('📍 Button HTML:', this.partialPinyinBtn.outerHTML.substring(0, 300));

                if (currentDisplay === 'none' || currentDisplay === '') {
                    this.partialPinyinBtn.style.display = 'flex';
                    console.log('✅ Restored partial pinyin button visibility');
                }

                // Force visibility and color
                this.partialPinyinBtn.style.visibility = 'visible';
                this.partialPinyinBtn.style.opacity = '1';

                // Force the SVG to have correct color
                if (svgElement) {
                    svgElement.style.color = 'rgba(168, 85, 247, 1)';
                    console.log('🎨 Forced SVG color to purple');
                }
            }

            if (this.pinyinContainer) {
                const currentDisplay = this.pinyinContainer.style.display;
                console.log('📍 Full pinyin container current display:', currentDisplay);
                if (currentDisplay === 'none' || currentDisplay === '') {
                    this.pinyinContainer.style.display = 'flex';
                    console.log('✅ Restored full pinyin container visibility');
                }
            }
        }
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
