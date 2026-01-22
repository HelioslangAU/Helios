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
    this.subtitleSize = 36; // Font size in pixels (ASBplayer default: 36px)
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

    // Resizing state
    this.isResizing = false;
    this.resizeStartSize = 0;

    // Position maintenance interval (ASB Player approach - simple 1-second updates only)
    this.positionMaintenanceInterval = null;

    // URL monitoring for navigation cleanup
    this.lastUrl = window.location.href;
    this.urlCheckInterval = null;

    // Load settings (pause on hover + saved position)
    this._loadSettings();

    this._init();
    this._setupFullscreenListener();
    this._setupEventDrivenUpdates();
    this._setupDragging();
    this._setupResizeHandle();
    this._setupResizeShortcuts();
    this._setupShiftKeyInterception();
    this._setupVocabUpdateListener();
    this._setupPopupListener();
    this._setupUrlMonitoring();
  }

  /**
   * Initialize overlay container
   */
  _init() {
    this.container = document.createElement('div');
    this.container.className = 'helios-subtitle-overlay';
    this.container.setAttribute('data-helios-subtitle-overlay', 'true');

    // Create drag handle (visible grab area)
    this.dragHandle = document.createElement('div');
    this.dragHandle.className = 'helios-subtitle-drag-handle';
    this.dragHandle.innerHTML = '⋮⋮'; // Vertical dots for drag
    this.dragHandle.style.cssText = `
      position: absolute;
      top: 50%;
      left: -32px;
      width: 28px;
      height: 40px;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      letter-spacing: -2px;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(0, 0, 0, 0.6);
      border-radius: 6px;
      user-select: none;
      z-index: 2147483647;
      opacity: 0;
      transition: all 0.2s ease;
      pointer-events: auto;
      transform: translateY(-50%);
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    this.container.appendChild(this.dragHandle);

    // Create resize handle in bottom-right corner
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'helios-subtitle-resize-handle';
    this.resizeHandle.innerHTML = '⇲'; // Diagonal resize arrow
    this.resizeHandle.style.cssText = `
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 24px;
      height: 24px;
      cursor: nwse-resize;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: rgba(255, 255, 255, 0.8);
      background: rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      user-select: none;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: auto;
    `;
    this.container.appendChild(this.resizeHandle);

    // Show drag and resize handles on hover
    this.container.addEventListener('mouseenter', () => {
      if (!this.isDragging) {
        this.dragHandle.style.opacity = '1';
        this.resizeHandle.style.opacity = '1';
      }
    });
    this.container.addEventListener('mouseleave', () => {
      if (!this.isResizing && !this.isDragging) {
        this.dragHandle.style.opacity = '0';
        this.resizeHandle.style.opacity = '0';
      }
    });

    // Keep handles visible when hovering over them
    this.dragHandle.addEventListener('mouseenter', () => {
      this.dragHandle.style.opacity = '1';
    });
    this.resizeHandle.addEventListener('mouseenter', () => {
      this.resizeHandle.style.opacity = '1';
    });

    // Append to body like ASB Player
    document.body.appendChild(this.container);

    // Apply initial position
    this._updatePosition();
  }

  /**
   * Setup position updates - ASB Player approach (simple 1-second interval only)
   */
  _setupEventDrivenUpdates() {
    // ASB Player uses ONLY a 1-second interval - no scroll/resize/intersection observers!
    // This prevents competing updates and glitching during scroll
    this.positionMaintenanceInterval = setInterval(() => {
      if (!this.isFullscreen) {
        this._applyContainerStyles();
      }
    }, 1000); // Every second, like ASB Player
  }

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

    // Batch all style updates to avoid forced reflows
    const styles = {
      display: '',
      position: 'absolute',
      bottom: '',
      transform: 'translate(-50%, -100%)',
      zIndex: '2015',
      pointerEvents: 'auto',
      width: 'auto'
    };

    // Calculate absolute position with scroll compensation (ASB Player technique)
    const clampedY = Math.max(rect.top + window.scrollY, 0);
    const clampedHeight = Math.min(
      clampedY + rect.height,
      window.innerHeight + window.scrollY
    );

    if (this.hasCustomPosition) {
      // Use custom dragged position with scroll compensation
      styles.left = (rect.left + rect.width / 2 + this.customOffsetX) + 'px';
      styles.top = (clampedHeight - this.contentPositionOffset + this.customOffsetY) + 'px';
    } else {
      // Default position: center horizontally on video
      const videoCenter = rect.left + rect.width / 2;
      styles.left = videoCenter + 'px';

      // Calculate top position from document top (not viewport) - this prevents glitching during scroll
      styles.top = (clampedHeight - this.contentPositionOffset) + 'px';
    }

    // Match video width like ASB Player (with some padding)
    styles.maxWidth = (rect.width * 0.9) + 'px';

    // Apply all styles at once
    Object.assign(this.container.style, styles);
  }

  /**
   * Lightweight method to update only position/size styles (ASB Player pattern)
   * Called by continuous maintenance interval to ensure position stays correct
   */
  _applyContainerStyles() {
    const rect = this.videoElement.getBoundingClientRect();

    // Don't update if video is not visible
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    // Calculate absolute position with scroll compensation
    const clampedY = Math.max(rect.top + window.scrollY, 0);
    const clampedHeight = Math.min(
      clampedY + rect.height,
      window.innerHeight + window.scrollY
    );

    // Batch style updates
    const styles = {};

    // Update position based on whether custom position is set
    if (this.hasCustomPosition) {
      styles.left = (rect.left + rect.width / 2 + this.customOffsetX) + 'px';
      styles.top = (clampedHeight - this.contentPositionOffset + this.customOffsetY) + 'px';
    } else {
      styles.left = (rect.left + rect.width / 2) + 'px';
      styles.top = (clampedHeight - this.contentPositionOffset) + 'px';
    }

    // Update max width to match video width
    styles.maxWidth = (rect.width * 0.9) + 'px';

    // Apply all styles at once
    Object.assign(this.container.style, styles);
  }

  /**
   * Setup dragging functionality for subtitles (ASBPlayer approach - simple and smooth)
   */
  _setupDragging() {
    this.lastDragX = 0;
    this.lastDragY = 0;

    // Mouse down on drag handle or container - start dragging
    const startDrag = (e) => {
      // Don't start drag if clicking on a word (for hover lookup) or resize handle
      if (e.target.classList.contains('helios-subtitle-word') ||
          e.target.classList.contains('helios-subtitle-resize-handle')) {
        return;
      }

      e.preventDefault();
      this.isDragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.dragHandle.style.cursor = 'grabbing';
      this.container.style.cursor = 'grabbing';
      this.container.style.userSelect = 'none';
    };

    this.container.addEventListener('mousedown', startDrag);
    this.dragHandle.addEventListener('mousedown', startDrag);

    // Mouse move - Simple direct position updates like ASBPlayer
    this._dragMoveHandler = (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.lastDragX;
      const deltaY = e.clientY - this.lastDragY;

      this.customOffsetX += deltaX;
      this.customOffsetY += deltaY;
      this.hasCustomPosition = true;

      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;

      // Update position directly like ASBPlayer does
      const rect = this.videoElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const clampedY = Math.max(rect.top + window.scrollY, 0);
        const clampedHeight = Math.min(clampedY + rect.height, window.innerHeight + window.scrollY);

        this.container.style.left = (rect.left + rect.width / 2 + this.customOffsetX) + 'px';
        this.container.style.top = (clampedHeight - this.contentPositionOffset + this.customOffsetY) + 'px';
      }
    };
    document.addEventListener('mousemove', this._dragMoveHandler);

    // Mouse up - stop dragging and save position
    this._dragUpHandler = () => {
      if (!this.isDragging) return;

      this.isDragging = false;

      this.dragHandle.style.cursor = 'grab';
      this.container.style.cursor = '';
      this.container.style.userSelect = 'text';

      // Save position to storage for persistence across videos
      this._savePosition();
    };
    document.addEventListener('mouseup', this._dragUpHandler);

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

      // Save reset position to storage
      this._savePosition();
    });
  }

  /**
   * Setup resize handle for dragging to resize subtitles
   */
  _setupResizeHandle() {
    if (!this.resizeHandle) return;

    let resizeStartY = 0;
    let resizeStartSize = 0;

    // Mouse down on resize handle - start resizing
    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      resizeStartY = e.clientY;
      resizeStartSize = this.subtitleSize;
      this.resizeHandle.style.opacity = '1';
      document.body.style.cursor = 'nwse-resize';
    });

    // Mouse move - resize (store handler for cleanup)
    this._resizeMoveHandler = (e) => {
      if (this.isResizing) {
        // Calculate size change based on vertical movement
        // Moving down = smaller, moving up = larger (inverted because subtitles are at bottom)
        const deltaY = resizeStartY - e.clientY; // Inverted
        const sizeChange = Math.round(deltaY / 5); // 5px mouse movement = 1px font size change

        const newSize = Math.max(12, Math.min(100, resizeStartSize + sizeChange)); // Clamp between 12-100px

        if (newSize !== this.subtitleSize) {
          this.subtitleSize = newSize;
          this._applySubtitleSize();
        }
      }
    };
    document.addEventListener('mousemove', this._resizeMoveHandler);

    // Mouse up - stop resizing (store handler for cleanup)
    this._resizeUpHandler = () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
        this.resizeHandle.style.opacity = '0';
        this._saveSize();
        this._showSizeNotification();
      }
    };
    document.addEventListener('mouseup', this._resizeUpHandler);
  }

  /**
   * Setup keyboard shortcuts for resizing subtitles
   * Similar to ASBplayer, but with keyboard support for font size adjustment
   * Loads shortcuts from storage (videoNavigation settings)
   */
  async _setupResizeShortcuts() {
    // Load shortcuts from storage
    let shortcuts;
    if (window.ShortcutHelper) {
      shortcuts = await window.ShortcutHelper.getVideoNavigationShortcuts();
    } else {
      // Fallback to defaults if ShortcutHelper not available
      shortcuts = {
        toggle: { key: "W", ctrl: false, shift: false, alt: false, meta: false },
        increaseSize: { key: "Equal", ctrl: false, shift: true, alt: false, meta: false },
        decreaseSize: { key: "Minus", ctrl: false, shift: true, alt: false, meta: false }
      };
    }

    // Store shortcuts for later use
    this.shortcuts = shortcuts;

    // Store handler for cleanup
    this._keyboardShortcutHandler = (e) => {
      // Only work on YouTube watch pages
      if (!window.location.pathname.includes('/watch')) {
        return;
      }

      // Don't trigger if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Toggle subtitle visibility
      if (this._matchesShortcut(e, shortcuts.toggle)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.toggleVisibility();
      }
      // Increase subtitle size
      else if (this._matchesShortcut(e, shortcuts.increaseSize)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this._increaseSubtitleSize();
      }
      // Decrease subtitle size
      else if (this._matchesShortcut(e, shortcuts.decreaseSize)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this._decreaseSubtitleSize();
      }
    };
    document.addEventListener('keydown', this._keyboardShortcutHandler, true); // Use capture phase to intercept before YouTube
  }

  /**
   * Check if keyboard event matches a shortcut configuration
   * @param {KeyboardEvent} e - Keyboard event
   * @param {Object} shortcut - Shortcut config { key, ctrl, shift, alt, meta }
   * @returns {boolean} - True if event matches shortcut
   */
  _matchesShortcut(e, shortcut) {
    if (!shortcut || !shortcut.key) return false;

    // Normalize key comparison
    const eventKey = e.key.toUpperCase();
    const configKey = shortcut.key.toUpperCase();
    const eventCode = e.code ? e.code.toUpperCase() : '';

    // Check if key or code matches (for keys like '=' which can be 'Equal' code)
    const keyMatches = eventKey === configKey || eventCode === configKey;
    if (!keyMatches) return false;

    // Check modifiers match exactly
    const ctrlMatches = (shortcut.ctrl || shortcut.meta) ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
    const shiftMatches = shortcut.shift ? e.shiftKey : !e.shiftKey;
    const altMatches = shortcut.alt ? e.altKey : !e.altKey;

    return ctrlMatches && shiftMatches && altMatches;
  }

  /**
   * Increase subtitle font size by 2px (like ASBplayer's 20px position increment, but for size)
   */
  _increaseSubtitleSize() {
    this.subtitleSize += 2;
    this._applySubtitleSize();
    this._saveSize();
    this._showSizeNotification();
  }

  /**
   * Decrease subtitle font size by 2px (minimum 12px for readability)
   */
  _decreaseSubtitleSize() {
    this.subtitleSize = Math.max(12, this.subtitleSize - 2);
    this._applySubtitleSize();
    this._saveSize();
    this._showSizeNotification();
  }

  /**
   * Apply current subtitle size to all subtitle elements
   */
  _applySubtitleSize() {
    // Apply to primary subtitles
    const primarySubtitles = this.container.querySelectorAll('.helios-subtitle-primary');
    primarySubtitles.forEach(el => {
      el.style.fontSize = this.subtitleSize + 'px';
    });

    // Apply to secondary subtitles (slightly smaller)
    const secondarySubtitles = this.container.querySelectorAll('.helios-subtitle-secondary');
    secondarySubtitles.forEach(el => {
      el.style.fontSize = (this.subtitleSize * 0.8) + 'px';
    });
  }

  /**
   * Show temporary notification about current subtitle size
   */
  _showSizeNotification() {
    // Dispatch event to show notification via video notification system
    const event = new CustomEvent('helios-video-notification', {
      detail: {
        message: `Subtitle size: ${this.subtitleSize}px`,
        type: 'info'
      }
    });
    document.dispatchEvent(event);
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
    this._fullscreenHandler = () => {
      this.isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );

      // Use requestAnimationFrame for smooth transition
      requestAnimationFrame(() => {
        if (this.isFullscreen) {
          this._handleFullscreen();
        } else {
          this._updatePosition();
        }
      });
    };

    document.addEventListener('fullscreenchange', this._fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);
    document.addEventListener('mozfullscreenchange', this._fullscreenHandler);
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

    // Batch all style updates for smooth transition
    const styles = {
      position: 'fixed',
      left: videoCenter + 'px',
      bottom: this.contentPositionOffset + 'px',
      top: 'auto',
      transform: 'translateX(-50%)',
      maxWidth: (rect.width * 0.9) + 'px'
    };

    Object.assign(this.container.style, styles);
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

    // Re-render to show dual subtitles (async to prevent lag)
    if (this.currentSubtitles.length > 0) {
      requestAnimationFrame(() => {
        this._render().catch(err => {
          console.error('[Helios Subtitle Overlay] Error rendering dual subtitles:', err);
        });
      });
    }
  }

  /**
   * Clear secondary subtitles
   */
  clearSecondarySubtitles() {
    this.secondarySubtitles = [];

    // Re-render without secondary subtitles (async to prevent lag)
    if (this.currentSubtitles.length > 0) {
      requestAnimationFrame(() => {
        this._render().catch(err => {
          console.error('[Helios Subtitle Overlay] Error clearing dual subtitles:', err);
        });
      });
    }
  }

  /**
   * Detect current platform (youtube, netflix, or generic)
   */
  _detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('youtube.com')) {
      return 'youtube';
    } else if (hostname.includes('netflix.com')) {
      return 'netflix';
    }
    return 'generic';
  }

  /**
   * Load settings from storage (pause on hover + saved subtitle position + size)
   * Follows ASBplayer's approach of using chrome.storage for persistent subtitle settings
   * Now supports per-platform settings isolation
   */
  async _loadSettings() {
    try {
      const platform = this._detectPlatform();
      const result = await chrome.storage.local.get([
        'ytSidebarSettings',
        'subtitleSettings',
        // Legacy keys for migration
        'subtitlePosition',
        'subtitleSize',
        'subtitleVisibility'
      ]);

      // Load pause on hover setting
      if (result.ytSidebarSettings && result.ytSidebarSettings.pauseOnHover !== undefined) {
        this.pauseOnHover = result.ytSidebarSettings.pauseOnHover;
      }

      // Check if we have new platform-specific settings
      const platformSettings = result.subtitleSettings?.[platform];

      // Load saved subtitle position (platform-specific or legacy)
      const positionData = platformSettings?.position || result.subtitlePosition;
      if (positionData) {
        this.customOffsetX = positionData.offsetX || 0;
        this.customOffsetY = positionData.offsetY || 0;
        this.contentPositionOffset = positionData.bottomOffset || 75;
        this.hasCustomPosition = positionData.hasCustomPosition || false;
      }

      // Load saved subtitle size (platform-specific or legacy)
      const subtitleSize = platformSettings?.size !== undefined ? platformSettings.size : result.subtitleSize;
      if (subtitleSize !== undefined) {
        this.subtitleSize = subtitleSize;
      }

      // Load saved visibility state (platform-specific or legacy)
      const visibility = platformSettings?.visibility !== undefined ? platformSettings.visibility : result.subtitleVisibility;
      if (visibility !== undefined) {
        this.isVisible = visibility;

        // Apply visibility state immediately if hidden
        if (!this.isVisible) {
          this.container.style.display = 'none';
        }
      }

      console.log(`[Helios Subtitle Overlay] Loaded settings for platform: ${platform}`, {
        position: positionData,
        size: subtitleSize,
        visibility
      });
    } catch (error) {
      console.error('[Helios Subtitle Overlay] Failed to load settings:', error);
    }
  }

  /**
   * Save current subtitle position to storage (ASBplayer-style persistence)
   * Now platform-specific
   */
  async _savePosition() {
    try {
      const platform = this._detectPlatform();
      const positionData = {
        offsetX: this.customOffsetX,
        offsetY: this.customOffsetY,
        bottomOffset: this.contentPositionOffset,
        hasCustomPosition: this.hasCustomPosition
      };

      // Get existing settings
      const result = await chrome.storage.local.get(['subtitleSettings']);
      const subtitleSettings = result.subtitleSettings || {};

      // Update platform-specific position
      if (!subtitleSettings[platform]) {
        subtitleSettings[platform] = {};
      }
      subtitleSettings[platform].position = positionData;

      // Save back
      await chrome.storage.local.set({
        subtitleSettings,
        // Also save to legacy key for backward compatibility
        subtitlePosition: positionData
      });

      console.log(`[Helios Subtitle Overlay] Saved position for ${platform}:`, positionData);
    } catch (error) {
      console.error('[Helios Subtitle Overlay] Failed to save position:', error);
    }
  }

  /**
   * Save current subtitle size to storage (ASBplayer-style persistence)
   * Now platform-specific
   */
  async _saveSize() {
    try {
      const platform = this._detectPlatform();

      // Get existing settings
      const result = await chrome.storage.local.get(['subtitleSettings']);
      const subtitleSettings = result.subtitleSettings || {};

      // Update platform-specific size
      if (!subtitleSettings[platform]) {
        subtitleSettings[platform] = {};
      }
      subtitleSettings[platform].size = this.subtitleSize;

      // Save back
      await chrome.storage.local.set({
        subtitleSettings,
        // Also save to legacy key for backward compatibility
        subtitleSize: this.subtitleSize
      });

      console.log(`[Helios Subtitle Overlay] Saved size for ${platform}:`, this.subtitleSize);
    } catch (error) {
      console.error('[Helios Subtitle Overlay] Failed to save size:', error);
    }
  }

  /**
   * Save visibility state to storage (persists across all videos)
   * Now platform-specific
   */
  async _saveVisibility() {
    try {
      const platform = this._detectPlatform();

      // Get existing settings
      const result = await chrome.storage.local.get(['subtitleSettings']);
      const subtitleSettings = result.subtitleSettings || {};

      // Update platform-specific visibility
      if (!subtitleSettings[platform]) {
        subtitleSettings[platform] = {};
      }
      subtitleSettings[platform].visibility = this.isVisible;

      // Save back
      await chrome.storage.local.set({
        subtitleSettings,
        // Also save to legacy key for backward compatibility
        subtitleVisibility: this.isVisible
      });

      console.log(`[Helios Subtitle Overlay] Saved visibility for ${platform}:`, this.isVisible);
    } catch (error) {
      console.error('[Helios Subtitle Overlay] Failed to save visibility:', error);
    }
  }

  /**
   * Set pause on hover setting
   * @param {boolean} enabled - Whether to pause video on hover
   */
  setPauseOnHover(enabled) {
    this.pauseOnHover = enabled;
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

    // Listen for pinyin toggle to re-render subtitles with/without pinyin
    document.addEventListener('helios-pinyin-toggled', () => {
      // Re-render current subtitles to apply/remove pinyin
      if (this.currentSubtitles.length > 0) {
        requestAnimationFrame(() => {
          this._render().catch(err => {
            console.error('[Helios Subtitle Overlay] Error re-rendering after pinyin toggle:', err);
          });
        });
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
   * Setup URL monitoring to detect navigation away from video pages
   * Critical for YouTube SPA navigation - prevents captions persisting on non-watch pages
   */
  _setupUrlMonitoring() {
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;

      if (currentUrl !== this.lastUrl) {
        // URL changed - check if we left a watch page
        const wasWatchPage = this.lastUrl.includes('/watch');
        const isWatchPage = currentUrl.includes('/watch');

        if (wasWatchPage && !isWatchPage) {
          // Navigated away from video - immediately hide and clear overlay
          this.container.style.display = 'none';
          this.clear();
        }

        this.lastUrl = currentUrl;
      }
    }, 500); // Check every 500ms for navigation changes
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
    // Don't show if overlay is toggled off
    if (!this.isVisible) {
      return;
    }

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
    // Don't render if overlay is hidden
    if (!this.isVisible) {
      return;
    }

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
      primarySubtitleEl.style.fontSize = this.subtitleSize + 'px'; // Apply saved font size (ASBplayer-style)

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

        // Additional safeguard: preload ALL extracted words (including those marked as non-target)
        // This ensures words that weren't found during initial extraction can be found after preloading
        const allExtractedWords = extractedWords.map(({ word }) => word.toLowerCase());
        if (allExtractedWords.length > 0 && window.dictionaryManager.preloadWords) {
          await window.dictionaryManager.preloadWords(allExtractedWords);
        }

        // Refresh dictionary reference after preloading to ensure cache is up to date
        const dictionaryAfterPreload = window.dictionaryManager?.dictionary || {};

        // Re-check words that were marked as non-target - they might be in dictionary now
        // This fixes cases where words weren't found during initial extraction due to timing
        extractedWords.forEach(extractedWord => {
          if (extractedWord.isTargetLang === false && adapter && adapter.findDictionaryForm) {
            const dictionaryForm = adapter.findDictionaryForm(extractedWord.word, dictionaryAfterPreload);
            if (dictionaryForm) {
              // Word is in dictionary - mark as target language
              extractedWord.isTargetLang = true;
              extractedWord.dictionaryForm = dictionaryForm;
            }
          }
        });

        // Check if language uses spaces between words (not CJK languages)
        const currentLang = window.languageRegistry?.getCurrentLanguage();
        const usesSpaces = currentLang && !['zh', 'ja', 'ko'].includes(currentLang);

        extractedWords.forEach(({ word, offset, isTargetLang, dictionaryForm }, index) => {
          // Create word span or plain text based on whether it's target language
          const wordSpan = document.createElement('span');

          if (isTargetLang !== false) {
            // Target language word - add interactive features
            wordSpan.className = 'helios-subtitle-word';
            wordSpan.style.cursor = 'pointer';
            wordSpan.style.pointerEvents = 'auto';
            // Use dictionaryForm if available (normalized form), otherwise use original word
            // This ensures lookups work correctly even if the original word has different casing
            const wordForLookup = dictionaryForm || word.toLowerCase();
            wordSpan.setAttribute('data-helios-word', wordForLookup);

            // Mark this element as a subtitle word so we can intercept events
            wordSpan.setAttribute('data-subtitle-word', 'true');

            // Check if word is unknown and add styling
            // Only underline if: word is in dictionary, not known, and not ignored
            // Use dictionaryForm if available (normalized form), otherwise use lowercase word
            const cleanWord = dictionaryForm || word.toLowerCase();

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

          // Add space after word/punctuation if:
          // 1. Language uses spaces
          // 2. This is not the last word
          // 3. Next item is a word (not punctuation)
          // 4. Current item is either a word OR punctuation that should have space after it (not hyphens)
          if (usesSpaces && index < extractedWords.length - 1) {
            const currentIsWord = isTargetLang !== false;
            const nextWord = extractedWords[index + 1];
            const nextIsWord = nextWord && nextWord.isTargetLang !== false;
            
            // Check if current item is punctuation that should have space after it
            const punctuationWithSpaceAfter = /^[.!?,:;]$/.test(word.trim());
            const isHyphen = word.trim() === '-';
            
            // Add space if:
            // - Current is a word and next is a word, OR
            // - Current is punctuation that should have space after it and next is a word
            // But NOT if current is a hyphen
            if (nextIsWord && !isHyphen && (currentIsWord || punctuationWithSpaceAfter)) {
              primarySubtitleEl.appendChild(document.createTextNode(' '));
            }
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
          secondarySubtitleEl.style.fontSize = (this.subtitleSize * 0.8) + 'px'; // Secondary subtitles 80% of primary size
          secondarySubtitleEl.style.userSelect = 'text';
          dualContainer.appendChild(secondarySubtitleEl);
        }
      }

      this.container.appendChild(dualContainer);
    }

    // Apply pinyin immediately after rendering if enabled (prevents delay)
    if (window.pinyinManager && window.pinyinManager.isEnabled()) {
      // Process only the newly rendered subtitle container immediately (no delay)
      const textNodes = this._getChineseTextNodes(this.container);
      textNodes.forEach(node => {
        if (window.pinyinManager.processTextNodeForPinyin) {
          window.pinyinManager.processTextNodeForPinyin(node);
        }
      });
    }
  }

  /**
   * Get all Chinese text nodes within an element (helper for pinyin)
   * @param {HTMLElement} element
   * @returns {Node[]}
   */
  _getChineseTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.textContent.trim();
        // Check if contains Chinese characters (U+4E00 to U+9FFF)
        return /[\u4E00-\u9FFF]/.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
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
    if (!this.container) {
      console.warn('[Helios Subtitle Overlay] Container not initialized, cannot toggle visibility');
      return this.isVisible;
    }

    this.isVisible = !this.isVisible;

    if (this.isVisible) {
      // Show overlay - restore display and re-render current subtitles
      this.container.style.display = '';
      if (this.currentSubtitles.length > 0) {
        this._render().catch(err => {
          console.error('[Helios Subtitle Overlay] Error rendering subtitles:', err);
        });
      }
      this._updatePosition();
    } else {
      // Hide overlay - set display none and clear content
      this.container.style.display = 'none';
      this.container.innerHTML = '';
    }

    // Save visibility state to persist across videos
    this._saveVisibility();

    return this.isVisible;
  }

  /**
   * Get current subtitle size
   */
  getSubtitleSize() {
    return this.subtitleSize;
  }

  /**
   * Set subtitle size
   */
  setSubtitleSize(size) {
    const clampedSize = Math.max(12, Math.min(100, size));
    this.subtitleSize = clampedSize;

    // Re-render subtitles with new size
    this._render();

    // Save to settings
    this._saveSize();
  }

  /**
   * Destroy overlay and cleanup
   */
  destroy() {
    // Clear any pending timeouts
    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    // Clear position maintenance interval (ASB Player pattern)
    if (this.positionMaintenanceInterval) {
      clearInterval(this.positionMaintenanceInterval);
      this.positionMaintenanceInterval = null;
    }

    // Clear URL monitoring interval
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }

    // Remove all global event listeners to prevent memory leaks
    if (this._dragMoveHandler) {
      document.removeEventListener('mousemove', this._dragMoveHandler);
      this._dragMoveHandler = null;
    }

    if (this._dragUpHandler) {
      document.removeEventListener('mouseup', this._dragUpHandler);
      this._dragUpHandler = null;
    }

    if (this._resizeMoveHandler) {
      document.removeEventListener('mousemove', this._resizeMoveHandler);
      this._resizeMoveHandler = null;
    }

    if (this._resizeUpHandler) {
      document.removeEventListener('mouseup', this._resizeUpHandler);
      this._resizeUpHandler = null;
    }

    if (this._keyboardShortcutHandler) {
      document.removeEventListener('keydown', this._keyboardShortcutHandler);
      this._keyboardShortcutHandler = null;
    }

    if (this._fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this._fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
      document.removeEventListener('mozfullscreenchange', this._fullscreenHandler);
      this._fullscreenHandler = null;
    }

    if (this._vocabUpdateHandler) {
      document.removeEventListener('helios-vocab-updated', this._vocabUpdateHandler);
      this._vocabUpdateHandler = null;
    }

    if (this._pauseOnHoverHandler) {
      document.removeEventListener('mousemove', this._pauseOnHoverHandler);
      this._pauseOnHoverHandler = null;
    }

    // Remove from DOM
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
  }
}
