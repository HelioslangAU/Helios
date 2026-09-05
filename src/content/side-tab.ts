/**
 * Helios Side Tab - Three-State Panel
 * Manages the collapsible side panel with stats and actions
 */

export interface SentenceBreakdown {
  totalSentences: number;
  t0Sentences: number;
  t1Sentences: number;
  t2Sentences: number;
}

export interface SideTabStats {
  knownWords?: number;
  learningWords?: number;
  ignoredWords?: number;
  comprehension?: number;
  pageWords?: number;
  uniqueComprehension?: number;
  sentenceBreakdownPercentage?: number;
  sentenceBreakdown?: SentenceBreakdown;
}

export class HeliosSideTab {
    container: HTMLElement | null;
    state: string;

    // Elements
    peekTab: HTMLElement | null;
    partialView: HTMLElement | null;
    fullView: HTMLElement | null;

    // Buttons
    expandBtn: HTMLElement | null;
    partialCloseBtn: HTMLElement | null;
    closeBtn: HTMLElement | null;
    settingsBtn: HTMLElement | null;
    youtubeSubtitlesBtn: HTMLElement | null;
    positionToggleBtn: HTMLElement | null;

    // Pinyin controls (full view)
    pinyinContainer: HTMLElement | null;
    pinyinCheckbox: HTMLInputElement | null;
    pinyinStatus: HTMLElement | null;

    // Debouncing state for pinyin toggle
    pinyinToggling: boolean;

    // Stat elements - Partial view
    partialComprehension: HTMLElement | null;
    partialKnownWords: HTMLElement | null;
    partialPageWords: HTMLElement | null;
    partialUniqueComprehension: HTMLElement | null;
    partialSentenceBreakdown: HTMLElement | null;

    // Stat elements - Full view
    fullComprehension: HTMLElement | null;
    fullKnownWords: HTMLElement | null;
    fullLearningWords: HTMLElement | null;
    fullIgnoredWords: HTMLElement | null;
    fullPageWords: HTMLElement | null;
    comprehensionProgress: HTMLElement | null;
    fullUniqueComprehension: HTMLElement | null;
    fullSentenceBreakdown: HTMLElement | null;
    breakdownT0: HTMLElement | null;
    breakdownT1: HTMLElement | null;
    breakdownT2: HTMLElement | null;

    // Data
    knownWordsCount: number;
    learningWordsCount: number;
    ignoredWordsCount: number;
    comprehensionPercentage: number;
    pageWordsCount: number;
    uniqueComprehensionPercentage: number;
    sentenceBreakdownPercentage: number;
    sentenceBreakdown: SentenceBreakdown;

    // Position state
    position: string;

    // Listeners
    handleKeydown: ((e: KeyboardEvent) => void) | null = null;
    handleDocumentClick: ((e: MouseEvent) => void) | null = null;

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
        this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox') as HTMLInputElement | null;
        this.pinyinStatus = document.getElementById('pinyin-status');

        // Debouncing state for pinyin toggle
        this.pinyinToggling = false;

        // Stat elements - Partial view
        this.partialComprehension = document.getElementById('partial-comprehension');
        this.partialKnownWords = document.getElementById('partial-known-words');
        this.partialPageWords = document.getElementById('partial-page-words');
        this.partialUniqueComprehension = document.getElementById('partial-unique-comprehension');
        this.partialSentenceBreakdown = document.getElementById('partial-sentence-breakdown');

        // Stat elements - Full view
        this.fullComprehension = document.getElementById('full-comprehension');
        this.fullKnownWords = document.getElementById('full-known-words');
        this.fullLearningWords = document.getElementById('full-learning-words');
        this.fullIgnoredWords = document.getElementById('full-ignored-words');
        this.fullPageWords = document.getElementById('full-page-words');
        this.comprehensionProgress = document.getElementById('comprehension-progress');
        this.fullUniqueComprehension = document.getElementById('full-unique-comprehension');
        this.fullSentenceBreakdown = document.getElementById('full-sentence-breakdown');
        this.breakdownT0 = document.getElementById('breakdown-t0');
        this.breakdownT1 = document.getElementById('breakdown-t1');
        this.breakdownT2 = document.getElementById('breakdown-t2');

        // Data
        this.knownWordsCount = 0;
        this.learningWordsCount = 0;
        this.ignoredWordsCount = 0;
        this.comprehensionPercentage = 0;
        this.pageWordsCount = 0;
        this.uniqueComprehensionPercentage = 0;
        this.sentenceBreakdownPercentage = 0;
        this.sentenceBreakdown = { totalSentences: 0, t0Sentences: 0, t1Sentences: 0, t2Sentences: 0 };

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
    initEventListeners(): void {
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
            if (!(e.target as Element).closest('button')) {
                this.setState('full');
            }
        });

        // Click outside full view to collapse to partial
        this.handleDocumentClick = (e) => {
            if (this.state === 'full' &&
                !this.fullView!.contains(e.target as Node) &&
                !this.partialView!.contains(e.target as Node) &&
                !this.peekTab!.contains(e.target as Node)) {
                this.setState('partial');
            }
        };

        document.addEventListener('click', this.handleDocumentClick);

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
            this.handlePinyinToggle((e.target as HTMLInputElement).checked);
        });

        // Also allow clicking the container
        this.pinyinContainer?.addEventListener('click', (e) => {
            if (e.target !== this.pinyinCheckbox && !(e.target as Element).closest('.pinyin-slider')) {
                this.pinyinCheckbox!.checked = !this.pinyinCheckbox!.checked;
                this.handlePinyinToggle(this.pinyinCheckbox!.checked);
            }
        });

        // Position toggle button
        this.positionToggleBtn?.addEventListener('click', () => {
            this.togglePosition();
        });

        // Keyboard shortcuts
        this.handleKeydown = (e) => {
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
        };

        document.addEventListener('keydown', this.handleKeydown);
    }

    /**
     * Set the current state
     * @param newState - 'closed', 'partial', or 'full'
     */
    setState(newState: string): void {
        if (this.state === newState) return;

        const validStates = ['closed', 'partial', 'full'];
        if (!validStates.includes(newState)) {
            console.error(`Invalid state: ${newState}`);
            return;
        }

        this.state = newState;
        this.container!.setAttribute('data-state', newState);
        this.saveState();

        // Trigger custom event
        this.container!.dispatchEvent(new CustomEvent('statechange', {
            detail: { state: newState }
        }));
    }

    /**
     * Toggle between states
     */
    toggleState(): void {
        const stateMap: Record<string, string> = {
            'closed': 'partial',
            'partial': 'full',
            'full': 'closed'
        };
        this.setState(stateMap[this.state]);
    }

    /**
     * Save state to localStorage
     */
    saveState(): void {
        try {
            localStorage.setItem('helios-side-tab-state', this.state);
        } catch (e) {
            console.warn('Failed to save side tab state:', e);
        }
    }

    /**
     * Load state from localStorage
     */
    loadState(): void {
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
    togglePosition(): void {
        const newPosition = this.position === 'right' ? 'left' : 'right';
        this.setPosition(newPosition);
    }

    /**
     * Set the position of the side tab
     * @param position - 'left' or 'right'
     */
    setPosition(position: string): void {
        if (this.position === position) return;

        const validPositions = ['left', 'right'];
        if (!validPositions.includes(position)) {
            console.error(`Invalid position: ${position}`);
            return;
        }

        this.position = position;
        this.container!.setAttribute('data-position', position);
        this.savePosition();
        this.updatePositionUI();
    }

    /**
     * Save position to localStorage
     */
    savePosition(): void {
        try {
            localStorage.setItem('helios-side-tab-position', this.position);
        } catch (e) {
            console.warn('Failed to save side tab position:', e);
        }
    }

    /**
     * Load position from localStorage
     */
    loadPosition(): void {
        try {
            const savedPosition = localStorage.getItem('helios-side-tab-position');
            if (savedPosition && ['left', 'right'].includes(savedPosition)) {
                this.setPosition(savedPosition);
            } else {
                // Set default position if no saved position exists
                this.container!.setAttribute('data-position', this.position);
            }
        } catch (e) {
            console.warn('Failed to load side tab position:', e);
            // Set default position on error
            this.container!.setAttribute('data-position', this.position);
        }
    }

    /**
     * Update position UI elements
     */
    updatePositionUI(): void {
        if (this.positionToggleBtn) {
            const tooltipText = this.position === 'right' ? 'Move to Left Side' : 'Move to Right Side';
            this.positionToggleBtn.setAttribute('data-tooltip', tooltipText);
        }
    }

    /**
     * Update stats
     * @param stats - { knownWords, learningWords, ignoredWords, comprehension, pageWords, uniqueComprehension, sentenceBreakdownPercentage, sentenceBreakdown }
     */
    updateStats(stats: SideTabStats): void {
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

        if (stats.sentenceBreakdownPercentage !== undefined) {
            this.updateSentenceBreakdownCoverage(stats.sentenceBreakdownPercentage);
        }

        if (stats.sentenceBreakdown !== undefined) {
            this.sentenceBreakdown = stats.sentenceBreakdown;
            this.updateSentenceBreakdownBreakdown(stats.sentenceBreakdown);
        }
    }

    /**
     * Refresh all element references
     */
    refreshElementReferences(): void {
        // Stat elements - Partial view
        this.partialComprehension = document.getElementById('partial-comprehension');
        this.partialKnownWords = document.getElementById('partial-known-words');
        this.partialPageWords = document.getElementById('partial-page-words');
        this.partialUniqueComprehension = document.getElementById('partial-unique-comprehension');
        this.partialSentenceBreakdown = document.getElementById('partial-sentence-breakdown');

        // Stat elements - Full view
        this.fullComprehension = document.getElementById('full-comprehension');
        this.fullKnownWords = document.getElementById('full-known-words');
        this.fullLearningWords = document.getElementById('full-learning-words');
        this.fullIgnoredWords = document.getElementById('full-ignored-words');
        this.fullPageWords = document.getElementById('full-page-words');
        this.comprehensionProgress = document.getElementById('comprehension-progress');
        this.fullUniqueComprehension = document.getElementById('full-unique-comprehension');
        this.fullSentenceBreakdown = document.getElementById('full-sentence-breakdown');
        this.breakdownT0 = document.getElementById('breakdown-t0');
        this.breakdownT1 = document.getElementById('breakdown-t1');
        this.breakdownT2 = document.getElementById('breakdown-t2');

        // Pinyin elements
        this.pinyinContainer = document.getElementById('pinyin-toggle-container');
        this.pinyinCheckbox = document.getElementById('pinyin-toggle-checkbox') as HTMLInputElement | null;
        this.pinyinStatus = document.getElementById('pinyin-status');
    }

    /**
     * Update comprehension display
     * @param percentage
     */
    updateComprehension(percentage: number): void {
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
     * @param count
     */
    updateKnownWords(count: number): void {
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
     * @param count
     */
    updateLearningWords(count: number): void {
        if (this.fullLearningWords) {
            this.fullLearningWords.textContent = Number.isFinite(count)
                ? count.toLocaleString()
                : `${count}`;
        }
    }

    /**
     * Update ignored words display (expanded view only)
     * @param count
     */
    updateIgnoredWords(count: number): void {
        if (this.fullIgnoredWords) {
            this.fullIgnoredWords.textContent = Number.isFinite(count)
                ? count.toLocaleString()
                : `${count}`;
        }
    }

    /**
     * Update page words display
     * @param count
     */
    updatePageWords(count: number): void {
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
     * @param percentage
     */
    updateUniqueComprehension(percentage: number): void {
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
     * @param knownTokens
     * @param totalTokens
     */
    updateComprehensionTooltip(knownTokens: number, totalTokens: number): void {
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
     * @param knownUnique
     * @param totalUnique
     */
    updateUniqueTooltip(knownUnique: number, totalUnique: number): void {
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
     * Update the hover tooltip and full-view display for sentence breakdown (overall % and count).
     * @param breakdown
     */
    updateSentenceBreakdownTooltip(breakdown: SentenceBreakdown | null | undefined): void {
        const total = breakdown?.totalSentences || 0;
        const inScope = (breakdown?.t0Sentences || 0) + (breakdown?.t1Sentences || 0) + (breakdown?.t2Sentences || 0);
        const tooltipText = `${inScope}/${total} sentences are all known, all but 1, or all but 2 words`;

        if (this.fullSentenceBreakdown) {
            const pctSpan = this.fullSentenceBreakdown.querySelector('.stat-main-percentage');
            const countSpan = this.fullSentenceBreakdown.querySelector('.stat-secondary-count');
            if (pctSpan) {
                pctSpan.textContent = `${Math.round(this.sentenceBreakdownPercentage || 0)}%`;
            }
            if (countSpan) {
                countSpan.textContent = `${inScope}/${total}`;
            }
            this.fullSentenceBreakdown.title = tooltipText;
        }
        this.updateSentenceBreakdownBreakdown(breakdown || this.sentenceBreakdown);
    }

    /**
     * Update sentence breakdown overall percentage (compact panel and main full value).
     * @param percentage
     */
    updateSentenceBreakdownCoverage(percentage: number): void {
        this.sentenceBreakdownPercentage = percentage;
        const formatted = `${Math.round(percentage)}%`;

        if (this.partialSentenceBreakdown) {
            this.partialSentenceBreakdown.textContent = formatted;
        }

        if (this.fullSentenceBreakdown) {
            const pctSpan = this.fullSentenceBreakdown.querySelector('.stat-main-percentage');
            if (pctSpan) {
                pctSpan.textContent = formatted;
            }
        }
    }

    /**
     * Update the expanded breakdown rows (All known %, T1 %, T2 %).
     * @param breakdown
     */
    updateSentenceBreakdownBreakdown(breakdown: SentenceBreakdown | null | undefined): void {
        const total = breakdown?.totalSentences || 0;
        const t0 = breakdown?.t0Sentences || 0;
        const t1 = breakdown?.t1Sentences || 0;
        const t2 = breakdown?.t2Sentences || 0;

        const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

        if (this.breakdownT0) {
            this.breakdownT0.textContent = `${pct(t0)}%`;
        }
        if (this.breakdownT1) {
            this.breakdownT1.textContent = `${pct(t1)}%`;
        }
        if (this.breakdownT2) {
            this.breakdownT2.textContent = `${pct(t2)}%`;
        }
    }

    /**
     * Format number with commas
     * @param num
     * @returns formatted string
     */
    formatNumber(num: number): string {
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
    handleSettings(): void {
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
     * @param shouldEnable - Whether to enable or disable
     */
    handlePinyinToggle(shouldEnable: boolean): void {
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
     * @param isEnabled
     */
    updatePinyinUI(isEnabled: boolean): void {
        // Update full view container
        if (this.pinyinContainer) {
            if (isEnabled) {
                this.pinyinContainer.classList.add('active');
                this.pinyinStatus!.textContent = 'Visible';
            } else {
                this.pinyinContainer.classList.remove('active');
                this.pinyinStatus!.textContent = 'Hidden';
            }
        }

        // Sync checkbox state
        if (this.pinyinCheckbox) {
            this.pinyinCheckbox.checked = isEnabled;
        }
    }

    /**
     * Update language-specific features
     * @param language - Current language code
     */
    updateLanguageFeatures(language: string): void {
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
     * @returns boolean
     */
    isYouTubePage(): boolean {
        return window.location.hostname.includes('youtube.com') ||
               window.location.hostname.includes('youtu.be');
    }

    /**
     * Update YouTube-specific features
     */
    updateYouTubeFeatures(): void {
        const isYouTube = this.isYouTubePage();

        // Show/hide YouTube subtitles button in full view
        if (this.youtubeSubtitlesBtn) {
            this.youtubeSubtitlesBtn.style.display = isYouTube ? 'flex' : 'none';
        }
    }

    /**
     * Handle YouTube Subtitles button click
     */
    handleYouTubeSubtitles(): void {
        // Dispatch event to toggle YouTube sidebar
        document.dispatchEvent(new CustomEvent('helios-toggle-subtitle-panel'));
    }


    /**
     * Show loading state
     */
    showLoading(): void {
        this.container!.classList.add('loading');
    }

    /**
     * Hide loading state
     */
    hideLoading(): void {
        this.container!.classList.remove('loading');
    }

    /**
     * Show the side tab
     */
    show(): void {
        this.container!.style.display = 'block';
    }

    /**
     * Hide the side tab
     */
    hide(): void {
        this.container!.style.display = 'none';
    }

    /**
     * Destroy the side tab
     */
    destroy(): void {
        // Remove event listeners
        if (this.handleKeydown) {
            document.removeEventListener('keydown', this.handleKeydown);
            this.handleKeydown = null;
        }

        if (this.handleDocumentClick) {
            document.removeEventListener('click', this.handleDocumentClick);
            this.handleDocumentClick = null;
        }

        // Remove from DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
