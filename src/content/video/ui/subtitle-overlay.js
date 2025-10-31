/**
 * Manages subtitle overlay display on top of video elements
 * Positioning approach inspired by ASB Player
 */
class SubtitleOverlay {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.container = null;
    this.currentSubtitles = [];
    this.lastRenderedIndexes = [];
    this.isFullscreen = false;
    this.offsetMs = 0;
    this.positionUpdateInterval = null;
    this.contentPositionOffset = 75; // Distance from bottom like ASB Player

    // Dragging state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.customOffsetX = 0;
    this.customOffsetY = 0;
    this.hasCustomPosition = false;

    this._init();
    this._setupFullscreenListener();
    this._setupPositionUpdater();
    this._setupDragging();
    this._setupShiftKeyInterception();
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
   * Setup position updater interval (like ASB Player does)
   */
  _setupPositionUpdater() {
    // Update position every second to handle page changes
    this.positionUpdateInterval = setInterval(() => {
      if (!this.isFullscreen) {
        this._updatePosition();
      }
    }, 1000);
  }

  /**
   * Update overlay position based on video element (ASB Player style)
   */
  _updatePosition() {
    const rect = this.videoElement.getBoundingClientRect();

    // Only show subtitles if video is visible
    if (rect.width === 0 || rect.height === 0) {
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
   * Track mouse position over subtitle words
   * Allows popup to stay open when hovering subtitle words
   */
  _setupShiftKeyInterception() {
    // Use mouseover/mouseout for proper event bubbling
    document.addEventListener('mouseover', (e) => {
      if (e.target?.getAttribute('data-subtitle-word') === 'true' && window.popupManager) {
        window.popupManager.isMouseOverSubtitleWord = true;
      }
    }, true);

    document.addEventListener('mouseout', (e) => {
      if (e.target?.getAttribute('data-subtitle-word') === 'true' && window.popupManager) {
        window.popupManager.isMouseOverSubtitleWord = false;
      }
    }, true);
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
    if (document.fullscreenElement) {
      return document.fullscreenElement;
    }

    let current = this.videoElement.parentElement;
    let chosen = document.body;

    while (current && current !== document.body.parentElement) {
      const rect = current.getBoundingClientRect();
      if (rect.height > 0) {
        chosen = current;
        break;
      }
      current = current.parentElement;
    }

    return chosen;
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
      this._render();
    }
  }

  /**
   * Render current subtitles to DOM
   */
  _render() {
    // Clear existing content
    this.container.innerHTML = '';

    if (this.currentSubtitles.length === 0) {
      return;
    }

    // Create subtitle elements with hover-enabled words
    this.currentSubtitles.forEach((subtitle, index) => {
      const subtitleEl = document.createElement('div');
      subtitleEl.className = 'helios-subtitle-text';
      subtitleEl.setAttribute('data-subtitle-index', subtitle.index);

      // Split text into words and wrap each in a span for hover detection
      const words = subtitle.text.split(/(\s+)/); // Keep spaces
      words.forEach(wordText => {
        if (wordText.trim().length > 0) {
          // Create word span
          const wordSpan = document.createElement('span');
          wordSpan.className = 'helios-subtitle-word';
          wordSpan.textContent = wordText;
          wordSpan.style.cursor = 'pointer';
          wordSpan.style.pointerEvents = 'auto';
          wordSpan.style.padding = '2px';
          wordSpan.style.borderRadius = '2px';
          wordSpan.style.transition = 'background 0.2s';
          wordSpan.setAttribute('data-helios-word', wordText.trim());

          // Add hover effect
          wordSpan.addEventListener('mouseenter', () => {
            wordSpan.style.background = 'rgba(255, 107, 71, 0.2)';
          });

          wordSpan.addEventListener('mouseleave', () => {
            wordSpan.style.background = 'transparent';
          });

          // Mark this element as a subtitle word so we can intercept events
          wordSpan.setAttribute('data-subtitle-word', 'true');

          subtitleEl.appendChild(wordSpan);
        } else {
          // Keep spaces as text nodes
          subtitleEl.appendChild(document.createTextNode(wordText));
        }
      });

      // Make text still selectable for copying
      subtitleEl.style.userSelect = 'text';
      subtitleEl.style.pointerEvents = 'auto';

      this.container.appendChild(subtitleEl);
    });
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
   * Destroy overlay and cleanup
   */
  destroy() {
    // Clear position update interval
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }

    // Remove from DOM
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
  }
}
