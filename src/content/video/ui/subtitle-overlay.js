/**
 * Manages subtitle overlay display on top of video elements
 * Positioning approach inspired by ASB Player
 */
class SubtitleOverlay {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.container = null;
    this.currentSubtitles = [];
    this.secondarySubtitles = []; // Secondary subtitle track for dual display
    this.lastRenderedIndexes = [];
    this.isFullscreen = false;
    this.offsetMs = 0;
    this.contentPositionOffset = 75; // Distance from bottom like ASB Player
    this.pauseOnHover = false; // Pause video when hovering over subtitle words
    this.pausedByHover = false; // Track if video is currently paused by hover feature
    this.resumeTimeout = null; // Timeout for delayed resume
    this.isVisible = true; // Track whether overlay should be visible (toggled by 'w' key)

    // Dragging state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.customOffsetX = 0;
    this.customOffsetY = 0;
    this.hasCustomPosition = false;

    // Observers for event-driven updates
    this.resizeObserver = null;
    this.intersectionObserver = null;

    // Load pause on hover setting
    this._loadPauseOnHoverSetting();

    this._init();
    this._setupFullscreenListener();
    this._setupEventDrivenUpdates();
    this._setupDragging();
    this._setupShiftKeyInterception();
    this._setupVocabUpdateListener();
    this._setupPopupListener();
  }

  /**
   * Initialize overlay container
   */
  _init() {
    this.container = document.createElement('div');
    this.container.className = 'helios-subtitle-overlay';
    this.container.setAttribute('data-helios-subtitle-overlay', 'true');

    // Append to body like ASB Player
    document.body.appendChild(this.container);

    // Apply initial position
    this._updatePosition();
  }

  /**
   * Setup event-driven position updates using ResizeObserver and IntersectionObserver
   */
  _setupEventDrivenUpdates() {
    // Watch for video element size/position changes
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isFullscreen) {
        this._updatePosition();
      }
    });
    this.resizeObserver.observe(this.videoElement);

    // Watch for video visibility changes (scrolling, etc.)
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._updatePosition();
        } else {
          // Hide subtitles when video is not visible
          this.container.style.display = 'none';
        }
      });
    }, {
      threshold: 0.1 // Trigger when at least 10% of video is visible
    });
    this.intersectionObserver.observe(this.videoElement);

    // Also listen for window resize and scroll events as fallback
    window.addEventListener('resize', this._handleWindowResize);
    window.addEventListener('scroll', this._handleWindowScroll, true); // Use capture for better performance
  }

  /**
   * Handle window resize event
   */
  _handleWindowResize = () => {
    if (!this.isFullscreen) {
      this._updatePosition();
    }
  };

  /**
   * Handle window scroll event (debounced)
   */
  _handleWindowScroll = () => {
    if (!this.isFullscreen && !this.scrollTimeout) {
      this.scrollTimeout = setTimeout(() => {
        this._updatePosition();
        this.scrollTimeout = null;
      }, 50);
    }
  };

  /**
   * Update overlay position based on video element (ASB Player style)
   */
  _updatePosition() {
    const rect = this.videoElement.getBoundingClientRect();

    // Only show subtitles if video is visible AND overlay is toggled visible
    if (rect.width === 0 || rect.height === 0 || !this.isVisible) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = '';

    // Position fixed to viewport
    this.container.style.position = 'fixed';

    if (this.hasCustomPosition) {
      // Use custom dragged position
      this.container.style.left = (rect.left + rect.width / 2 + this.customOffsetX) + 'px';
      this.container.style.top = (rect.top + rect.height - this.contentPositionOffset + this.customOffsetY) + 'px';
    } else {
      // Default position: center horizontally on video
      const videoCenter = rect.left + rect.width / 2;
      this.container.style.left = videoCenter + 'px';

      // Calculate top position: video bottom - offset (like ASB Player)
      const bottomPosition = rect.top + rect.height - this.contentPositionOffset;
      this.container.style.top = Math.max(bottomPosition, 0) + 'px';
    }

    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '2147483647';
    this.container.style.pointerEvents = 'auto'; // Changed to auto for dragging
    this.container.style.width = 'auto';

    // Match video width like ASB Player (with some padding)
    this.container.style.maxWidth = (rect.width * 0.9) + 'px';
  }

  /**
   * Setup dragging functionality for subtitles
   */
  _setupDragging() {
    // Mouse down on container - start dragging
    this.container.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on a word (for hover lookup)
      if (e.target.classList.contains('helios-subtitle-word')) {
        return;
      }

      e.preventDefault();
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.container.style.cursor = 'grabbing';
      this.container.style.userSelect = 'none';
    });

    // Mouse move - drag
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        this.customOffsetX += deltaX;
        this.customOffsetY += deltaY;
        this.hasCustomPosition = true;

        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        // Immediately update position
        const rect = this.videoElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.container.style.left = (rect.left + rect.width / 2 + this.customOffsetX) + 'px';
          this.container.style.top = (rect.top + rect.height - this.contentPositionOffset + this.customOffsetY) + 'px';
        }
      }
    });

    // Mouse up - stop dragging
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = 'move';
        this.container.style.userSelect = 'text';
      }
    });

    // Set move cursor when hovering (if not on a word)
    this.container.addEventListener('mouseover', (e) => {
      if (!this.isDragging && !e.target.classList.contains('helios-subtitle-word')) {
        this.container.style.cursor = 'move';
      }
    });

    // Double-click to reset position
    this.container.addEventListener('dblclick', (e) => {
      // Don't reset if double-clicking on a word
      if (e.target.classList.contains('helios-subtitle-word')) {
        return;
      }

      this.hasCustomPosition = false;
      this.customOffsetX = 0;
      this.customOffsetY = 0;
      this._updatePosition();
    });
  }

  /**
   * Setup shift key interception for subtitle words
   * No longer needed - kept as empty method for backward compatibility
   */
  _setupShiftKeyInterception() {
    // Subtitle words now work automatically via data-subtitle-word attribute
    // The lookup-controller.js checks for this attribute and bypasses shift requirement
  }

  /**
   * Setup fullscreen change listener
   */
  _setupFullscreenListener() {
    const fullscreenHandler = () => {
      this.isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );

      if (this.isFullscreen) {
        this._handleFullscreen();
      } else {
        this._updatePosition();
      }
    };

    document.addEventListener('fullscreenchange', fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenHandler);
    document.addEventListener('mozfullscreenchange', fullscreenHandler);
  }

  /**
   * Handle fullscreen mode positioning
   */
  _handleFullscreen() {
    if (this.container.parentElement === document.body) {
      this.container.remove();
    }

    // In fullscreen, find the fullscreen parent
    const fullscreenParent = this._findFullscreenParent();
    if (fullscreenParent && fullscreenParent !== this.container.parentElement) {
      fullscreenParent.appendChild(this.container);
    }

    // Position for fullscreen - centered on actual video
    const rect = this.videoElement.getBoundingClientRect();
    const videoCenter = rect.left + rect.width / 2;

    this.container.style.position = 'fixed';
    this.container.style.left = videoCenter + 'px';
    this.container.style.bottom = this.contentPositionOffset + 'px';
    this.container.style.top = 'auto';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.maxWidth = (rect.width * 0.9) + 'px';
  }

  /**
   * Find suitable parent for fullscreen mode (like ASB Player)
   */
  _findFullscreenParent() {
    // Check all fullscreen API variants
    const fullscreenElement =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (fullscreenElement) {
      return fullscreenElement;
    }

    // Check for picture-in-picture mode
    if (document.pictureInPictureElement === this.videoElement) {
      return document.body;
    }

    // Find the best parent container for the video
    let current = this.videoElement.parentElement;
    let chosen = document.body;
    let maxArea = 0;

    // Walk up the DOM tree and find the largest container that could be fullscreen
    while (current && current !== document.body.parentElement) {
      const rect = current.getBoundingClientRect();
      const area = rect.width * rect.height;
      const style = window.getComputedStyle(current);

      // Prioritize containers that look like fullscreen containers
      const isFullscreenCandidate =
        rect.height > 0 &&
        (area > maxArea ||
         style.position === 'fixed' ||
         style.position === 'absolute' ||
         current.classList.contains('fullscreen') ||
         current.classList.contains('player'));

      if (isFullscreenCandidate && area > maxArea) {
        chosen = current;
        maxArea = area;
      }

      current = current.parentElement;
    }

    return chosen;
  }

  /**
   * Set secondary subtitles for dual display
   * @param {SubtitleEntry[]} subtitles - Secondary subtitle entries
   */
  setSecondarySubtitles(subtitles) {
    this.secondarySubtitles = subtitles || [];
    console.log(`[Helios Subtitle Overlay] Secondary subtitles set: ${this.secondarySubtitles.length} entries`);

    // Re-render to show dual subtitles
    if (this.currentSubtitles.length > 0) {
      this._render();
    }
  }

  /**
   * Clear secondary subtitles
   */
  clearSecondarySubtitles() {
    this.secondarySubtitles = [];

    // Re-render without secondary subtitles
    if (this.currentSubtitles.length > 0) {
      this._render();
    }
  }

  /**
   * Load pause on hover setting from storage
   */
  async _loadPauseOnHoverSetting() {
    try {
      const result = await chrome.storage.local.get(['ytSidebarSettings']);
      if (result.ytSidebarSettings && result.ytSidebarSettings.pauseOnHover !== undefined) {
        this.pauseOnHover = result.ytSidebarSettings.pauseOnHover;
      }
    } catch (error) {
      console.error('[Helios Subtitle Overlay] Failed to load pause on hover setting:', error);
    }
  }

  /**
   * Set pause on hover setting
   * @param {boolean} enabled - Whether to pause video on hover
   */
  setPauseOnHover(enabled) {
    this.pauseOnHover = enabled;
    console.log(`[Helios Subtitle Overlay] Pause on hover ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Setup listener for vocabulary updates to refresh underlining
   */
  _setupVocabUpdateListener() {
    document.addEventListener('helios-vocab-updated', () => {
      // Update underlining WITHOUT full re-render to preserve popup
      if (this.currentSubtitles.length > 0) {
        setTimeout(async () => {
          await this._updateSubtitleUnderlining();
        }, 50);
      }
    });
  }

  /**
   * Update underlining on existing subtitle words without re-rendering
   * Used when vocabulary changes to avoid closing popup
   */
  async _updateSubtitleUnderlining() {
    if (!window.dictionaryManager || !window.vocabManager) return;
    
    const wordSpans = this.container.querySelectorAll('.helios-subtitle-word');
    const wordsToCheck = Array.from(wordSpans).map(span => {
      const word = span.getAttribute('data-helios-word');
      return word ? word.toLowerCase() : null;
    }).filter(w => w !== null);

    // Preload words to ensure they're in cache
    if (wordsToCheck.length > 0 && window.dictionaryManager.preloadWords) {
      await window.dictionaryManager.preloadWords(wordsToCheck);
    }

    const dictionary = window.dictionaryManager?.dictionary || {};
    
    wordSpans.forEach(wordSpan => {
      const word = wordSpan.getAttribute('data-helios-word');
      if (!word) return;

      const cleanWord = word.toLowerCase();

      // Remove existing unknown-word class
      wordSpan.classList.remove('unknown-word');

      // Re-check if word should be underlined
      if (window.vocabManager &&
          dictionary[cleanWord] &&
          !window.vocabManager.isWordKnown(cleanWord) &&
          !window.vocabManager.isWordIgnored(cleanWord)) {
        wordSpan.classList.add('unknown-word');
      }
    });
  }

  /**
   * Setup listener for popup hide events to resume video
   */
  _setupPopupListener() {
    // Use a global mousemove listener to detect when mouse leaves both word and popup
    document.addEventListener('mousemove', (e) => {
      if (!this.pauseOnHover || !this.pausedByHover) return;

      // Check if mouse is over popup or subtitle word
      const target = e.target;
      const isOverPopup = target && target.closest('.chinese-lang-extension-popup');
      const isOverSubtitleWord = target && target.closest('.helios-subtitle-word');

      // If not over either, resume video after a short delay
      if (!isOverPopup && !isOverSubtitleWord) {
        if (!this.resumeTimeout) {
          this.resumeTimeout = setTimeout(() => {
            if (this.videoElement && this.videoElement.paused && this.pausedByHover) {
              this.videoElement.play();
              this.pausedByHover = false;
            }
            this.resumeTimeout = null;
          }, 300);
        }
      } else {
        // Cancel resume if mouse moves back over popup or word
        if (this.resumeTimeout) {
          clearTimeout(this.resumeTimeout);
          this.resumeTimeout = null;
        }
      }
    });
  }

  /**
   * Update underlining on existing word spans without re-rendering
   * This preserves hover states and popups
   */
  async _updateUnderlining() {
    if (!this.container || !window.vocabManager || !window.dictionaryManager) return;

    const wordSpans = this.container.querySelectorAll('.helios-subtitle-word');
    const wordsToCheck = Array.from(wordSpans).map(span => {
      const word = span.getAttribute('data-helios-word');
      return word ? word.toLowerCase() : null;
    }).filter(w => w !== null);

    // Preload words to ensure they're in cache
    if (wordsToCheck.length > 0 && window.dictionaryManager.preloadWords) {
      await window.dictionaryManager.preloadWords(wordsToCheck);
    }

    const dictionary = window.dictionaryManager.dictionary || {};

    wordSpans.forEach(wordSpan => {
      const word = wordSpan.getAttribute('data-helios-word');
      if (!word) return;

      const cleanWord = word.toLowerCase();
      const shouldUnderline = dictionary[cleanWord] &&
                             !window.vocabManager.isWordKnown(cleanWord) &&
                             !window.vocabManager.isWordIgnored(cleanWord);

      if (shouldUnderline) {
        wordSpan.classList.add('unknown-word');
      } else {
        wordSpan.classList.remove('unknown-word');
      }
    });
  }

  /**
   * Check if the popup is currently visible
   * @returns {boolean}
   */
  _isPopupVisible() {
    // Check if popup manager exists and has an active popup
    if (window.popupManager && window.popupManager.popup) {
      const popup = window.popupManager.popup;
      // Check if popup exists in DOM and is visible
      return popup && popup.parentElement && popup.style.display !== 'none';
    }
    return false;
  }

  /**
   * Display subtitles
   * @param {SubtitleEntry[]} subtitles - Subtitles to display
   */
  show(subtitles) {
    // Check if subtitles have actually changed
    const currentIndexes = subtitles.map(s => s.index);
    const hasChanged =
      currentIndexes.length !== this.lastRenderedIndexes.length ||
      currentIndexes.some((idx, i) => idx !== this.lastRenderedIndexes[i]);

    if (hasChanged) {
      this.currentSubtitles = subtitles;
      this.lastRenderedIndexes = currentIndexes;
      this._render().catch(err => {
        console.error('[Helios Subtitle Overlay] Error rendering subtitles:', err);
      });
    }
  }

  /**
   * Extract potential words from text for preloading
   * This is a simple extraction to get candidate words before the full extractWords call
   * @param {string} text - Text to extract words from
   * @returns {string[]} - Array of potential words
   */
  _extractPotentialWords(text) {
    const words = [];
    const currentLang = window.languageRegistry?.getCurrentLanguage();
    const adapter = window.languageRegistry?.getAdapter();
    
    if (currentLang && ['zh', 'ja', 'ko'].includes(currentLang)) {
      // For CJK languages, extract unique characters and sequences up to maxWordLength
      // This ensures longer words (like idioms and chengyus) are preloaded
      const seen = new Set();
      const maxWordLength = adapter?.getConfig()?.maxWordLength || 10;
      
      // Extract single characters (keep everything from subtitles except whitespace)
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char.trim() && !seen.has(char)) {
          words.push(char);
          seen.add(char);
        }
      }
      
      // Extract sequences from 2 to maxWordLength characters
      // This ensures longer words (4+ characters like idioms/chengyus) are preloaded
      for (let len = 2; len <= maxWordLength; len++) {
        for (let i = 0; i <= text.length - len; i++) {
          const candidate = text.substring(i, i + len);
          // Keep sequences as they appear in subtitles (skip only whitespace and duplicates)
          if (candidate.trim() && !seen.has(candidate)) {
            words.push(candidate);
            seen.add(candidate);
          }
        }
      }
    } else {
      // For space-separated languages, extract words including apostrophes
      // Pattern allows apostrophes and hyphens within words (e.g., "don't", "M'appelle")
      const matches = text.match(/[\p{L}\p{M}]+(?:[''-][\p{L}\p{M}]+)*/gu);
      if (matches) {
        words.push(...matches.map(w => w.toLowerCase()));
      }
    }
    
    // Return unique words
    return [...new Set(words)];
  }

  /**
   * Render current subtitles to DOM
   */
  async _render() {
    // Clean up any popups/highlights before clearing DOM
    if (window.popupManager) {
      window.popupManager.hidePopup();
    }
    if (window.highlightManager) {
      window.highlightManager.removeLookupHighlight();
    }

    // Clear existing content
    this.container.innerHTML = '';

    if (this.currentSubtitles.length === 0) {
      return;
    }

    // Get current video time for matching secondary subtitles
    const currentTime = this.videoElement.currentTime * 1000;

    // Create subtitle elements with hover-enabled words
    for (const subtitle of this.currentSubtitles) {
      // Create container for dual subtitles
      const dualContainer = document.createElement('div');
      dualContainer.className = 'helios-subtitle-dual-container';

      // Primary subtitle
      const primarySubtitleEl = document.createElement('div');
      primarySubtitleEl.className = 'helios-subtitle-text helios-subtitle-primary';
      primarySubtitleEl.setAttribute('data-subtitle-index', subtitle.index);

      // Extract words using language adapter (handles Chinese, English, etc.)
      const adapter = window.languageRegistry?.getAdapter();
      
      if (adapter && adapter.extractWords && window.dictionaryManager) {
        // Preload potential words from subtitle text before extraction
        // This ensures words are in cache for extractWords to find them
        const wordsToPreload = this._extractPotentialWords(subtitle.text);
        if (wordsToPreload.length > 0 && window.dictionaryManager.preloadWords) {
          await window.dictionaryManager.preloadWords(wordsToPreload);
        }
        
        const dictionary = window.dictionaryManager?.dictionary || {};
        // Use language-aware word extraction
        const extractedWords = await adapter.extractWords(subtitle.text, dictionary);

        // Additional safeguard: preload the actual extracted words to ensure they're in cache
        // This is especially important for longer words (4+ characters) that jieba finds
        const extractedWordsToPreload = extractedWords
          .filter(({ isTargetLang }) => isTargetLang !== false)
          .map(({ word }) => word.toLowerCase());
        if (extractedWordsToPreload.length > 0 && window.dictionaryManager.preloadWords) {
          await window.dictionaryManager.preloadWords(extractedWordsToPreload);
        }

        // Refresh dictionary reference after preloading to ensure cache is up to date
        const dictionaryAfterPreload = window.dictionaryManager?.dictionary || {};

        // Check if language uses spaces between words (not CJK languages)
        const currentLang = window.languageRegistry?.getCurrentLanguage();
        const usesSpaces = currentLang && !['zh', 'ja', 'ko'].includes(currentLang);

        extractedWords.forEach(({ word, offset, isTargetLang }, index) => {
          // Create word span or plain text based on whether it's target language
          const wordSpan = document.createElement('span');

          if (isTargetLang !== false) {
            // Target language word - add interactive features
            wordSpan.className = 'helios-subtitle-word';
            wordSpan.style.cursor = 'pointer';
            wordSpan.style.pointerEvents = 'auto';
            wordSpan.setAttribute('data-helios-word', word);

            // Mark this element as a subtitle word so we can intercept events
            wordSpan.setAttribute('data-subtitle-word', 'true');

            // Check if word is unknown and add styling
            // Only underline if: word is in dictionary, not known, and not ignored
            const cleanWord = word.toLowerCase();

            if (window.vocabManager &&
                dictionaryAfterPreload[cleanWord] &&
                !window.vocabManager.isWordKnown(cleanWord) &&
                !window.vocabManager.isWordIgnored(cleanWord)) {
              wordSpan.classList.add('unknown-word');
            }

            // Add pause on hover listeners
            wordSpan.addEventListener('mouseenter', () => {
              if (this.pauseOnHover && this.videoElement && !this.videoElement.paused) {
                // Cancel any pending resume
                if (this.resumeTimeout) {
                  clearTimeout(this.resumeTimeout);
                  this.resumeTimeout = null;
                }

                this.videoElement.pause();
                this.pausedByHover = true;
              }
            });

            wordSpan.addEventListener('mouseleave', () => {
              if (this.pauseOnHover && this.pausedByHover) {
                // Delay resume to allow user to move mouse to popup
                this.resumeTimeout = setTimeout(() => {
                  // Only resume if popup is not visible
                  if (!this._isPopupVisible()) {
                    if (this.videoElement && this.videoElement.paused) {
                      this.videoElement.play();
                    }
                    this.pausedByHover = false;
                  }
                  this.resumeTimeout = null;
                }, 200); // 200ms delay allows smooth transition to popup
              }
            });
          } else {
            // Non-target language text (e.g., English in Chinese captions)
            // Display as plain text without interactive features
            wordSpan.className = 'helios-subtitle-plain-text';
            wordSpan.style.cursor = 'default';
            wordSpan.style.pointerEvents = 'none';
          }

          wordSpan.textContent = word;
          primarySubtitleEl.appendChild(wordSpan);

          // Add space after word (except for last word) for languages that use spaces
          if (usesSpaces && index < extractedWords.length - 1) {
            primarySubtitleEl.appendChild(document.createTextNode(' '));
          }
        });
      } else {
        // Fallback: display text as-is if no adapter available
        primarySubtitleEl.textContent = subtitle.text;
      }

      // Make text still selectable for copying
      primarySubtitleEl.style.userSelect = 'text';
      primarySubtitleEl.style.pointerEvents = 'auto';

      dualContainer.appendChild(primarySubtitleEl);

      // Secondary subtitle (if available and dual subtitles enabled)
      if (this.secondarySubtitles.length > 0) {
        // Find matching secondary subtitle based on time overlap
        const matchingSecondary = this._findMatchingSecondarySubtitle(subtitle);

        if (matchingSecondary) {
          const secondarySubtitleEl = document.createElement('div');
          secondarySubtitleEl.className = 'helios-subtitle-text helios-subtitle-secondary';
          secondarySubtitleEl.textContent = matchingSecondary.text;
          secondarySubtitleEl.style.userSelect = 'text';
          dualContainer.appendChild(secondarySubtitleEl);
        }
      }

      this.container.appendChild(dualContainer);
    }
  }

  /**
   * Find secondary subtitle that matches the timing of primary subtitle
   * @param {SubtitleEntry} primarySubtitle
   * @returns {SubtitleEntry|null}
   */
  _findMatchingSecondarySubtitle(primarySubtitle) {
    if (!this.secondarySubtitles || this.secondarySubtitles.length === 0) {
      return null;
    }

    // Find secondary subtitle that has the most overlap with primary
    let bestMatch = null;
    let maxOverlap = 0;

    for (const secondary of this.secondarySubtitles) {
      // Calculate overlap duration
      const overlapStart = Math.max(primarySubtitle.start, secondary.start);
      const overlapEnd = Math.min(primarySubtitle.end, secondary.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = secondary;
      }
    }

    // Only return match if there's significant overlap (at least 50ms)
    return maxOverlap >= 50 ? bestMatch : null;
  }

  /**
   * Handle subtitle text interaction (for manual text selection)
   * @param {MouseEvent} event
   * @param {SubtitleEntry} subtitle
   */
  _handleSubtitleClick(event, subtitle) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      // Trigger word lookup (integrate with existing lookup system)
      const customEvent = new CustomEvent('helios-subtitle-selection', {
        detail: {
          text: selectedText,
          subtitle: subtitle,
          position: { x: event.clientX, y: event.clientY }
        }
      });
      document.dispatchEvent(customEvent);
    }
  }

  /**
   * Clear displayed subtitles
   */
  clear() {
    if (this.lastRenderedIndexes.length > 0) {
      this.currentSubtitles = [];
      this.lastRenderedIndexes = [];
      this.container.innerHTML = '';

      // Clean up any popups/highlights from subtitle words
      if (window.popupManager) {
        window.popupManager.hidePopup();
      }
      if (window.highlightManager) {
        window.highlightManager.removeLookupHighlight();
      }
    }
  }

  /**
   * Apply time offset to subtitle display
   * @param {number} offsetMs - Offset in milliseconds
   */
  setOffset(offsetMs) {
    this.offsetMs = offsetMs;
  }

  /**
   * Toggle subtitle overlay visibility (for 'w' hotkey)
   * @returns {boolean} - New visibility state
   */
  toggleVisibility() {
    this.isVisible = !this.isVisible;

    if (this.isVisible) {
      // Show overlay by updating position
      this._updatePosition();
      console.log('[Helios Subtitle Overlay] Subtitles shown');
    } else {
      // Hide overlay
      this.container.style.display = 'none';
      console.log('[Helios Subtitle Overlay] Subtitles hidden');
    }

    return this.isVisible;
  }

  /**
   * Destroy overlay and cleanup
   */
  destroy() {
    // Disconnect observers
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    // Remove event listeners
    window.removeEventListener('resize', this._handleWindowResize);
    window.removeEventListener('scroll', this._handleWindowScroll, true);

    // Clear any pending timeouts
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    // Remove from DOM
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
  }
}
