/**
 * Manages subtitle functionality for a single video element
 */
class VideoBinding {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.subtitleCollection = new SubtitleCollection();
    this.overlay = new SubtitleOverlay(videoElement);
    this.updateInterval = null;
    this.isBound = false;

    // Loading state management
    this.isLoadingSubtitles = false;
    this.wasPausedBeforeLoading = false;
    this.loadingIndicator = null;
  }

  /**
   * Bind to video element and start subtitle synchronization
   */
  bind() {
    if (this.isBound) return;

    this._setupEventListeners();
    this._startSubtitleSync();
    this._setupSidebarReadyListener();

    this.isBound = true;
    console.log('[Helios Video] Bound to video element:', this.videoElement);
  }

  /**
   * Setup listener for sidebar ready event
   */
  _setupSidebarReadyListener() {
    document.addEventListener('helios-sidebar-ready', () => {
      // Sidebar has finished loading and scrolling to position
      // Now we can resume the video if it was playing
      if (this.isLoadingSubtitles) {
        console.log('[Helios Video] Sidebar ready - finishing subtitle load');
        this.finishLoadingSubtitles();
      }
    });
  }

  /**
   * Setup video event listeners
   */
  _setupEventListeners() {
    this.videoElement.addEventListener('play', () => {
      this._startSubtitleSync();
    });

    this.videoElement.addEventListener('pause', () => {
      this._pauseSubtitleSync();
    });

    this.videoElement.addEventListener('seeked', () => {
      this._updateSubtitles();
    });

    this.videoElement.addEventListener('emptied', () => {
      this._pauseSubtitleSync();
    });

    this.videoElement.addEventListener('ended', () => {
      this._pauseSubtitleSync();
      this.overlay.clear();
    });
  }

  /**
   * Start subtitle synchronization loop
   */
  _startSubtitleSync() {
    if (this.updateInterval) return;

    // Update subtitles every 100ms
    this.updateInterval = setInterval(() => {
      this._updateSubtitles();
    }, 100);
  }

  /**
   * Pause subtitle synchronization
   */
  _pauseSubtitleSync() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update displayed subtitles based on current video time
   */
  _updateSubtitles() {
    // Check if an ad is currently playing (YouTube specific)
    if (this._isAdPlaying()) {
      this.overlay.clear();
      return;
    }

    const currentTime = this.videoElement.currentTime * 1000; // Convert to milliseconds
    const activeSubtitles = this.subtitleCollection.getSubtitlesAt(currentTime);

    if (activeSubtitles.length > 0) {
      this.overlay.show(activeSubtitles);
    } else {
      this.overlay.clear();
    }

    // Notify listeners of time update
    this._notifyTimeUpdate(currentTime);
  }

  /**
   * Check if an advertisement is currently playing (YouTube specific)
   * @returns {boolean}
   */
  _isAdPlaying() {
    // Check for YouTube ad indicators
    if (window.location.hostname.includes('youtube.com')) {
      // YouTube adds .ad-showing class to video container during ads
      const playerContainer = document.querySelector('.html5-video-player');
      if (playerContainer && playerContainer.classList.contains('ad-showing')) {
        return true;
      }

      // Additional check: YouTube's ad module
      const adModule = document.querySelector('.video-ads');
      if (adModule && adModule.offsetParent !== null) {
        return true;
      }

      // Check if video is in an ad container
      const videoAd = document.querySelector('.ad-showing video');
      if (videoAd === this.videoElement) {
        return true;
      }
    }

    return false;
  }

  /**
   * Start loading subtitles - pause video if not ad, show loading indicator
   */
  startLoadingSubtitles() {
    if (this.isLoadingSubtitles) return;

    this.isLoadingSubtitles = true;
    const isAd = this._isAdPlaying();

    if (!isAd) {
      // Only pause video if it's not an ad
      this.wasPausedBeforeLoading = this.videoElement.paused;
      if (!this.wasPausedBeforeLoading) {
        this.videoElement.pause();
        console.log('[Helios Video] Paused video for subtitle loading');
      }

      // Show loading indicator
      this._showLoadingIndicator();
    } else {
      console.log('[Helios Video] Ad detected - loading subtitles silently in background');
    }
  }

  /**
   * Finish loading subtitles - resume video if it was playing, hide loading indicator
   */
  finishLoadingSubtitles() {
    if (!this.isLoadingSubtitles) return;

    this.isLoadingSubtitles = false;
    const isAd = this._isAdPlaying();

    if (!isAd) {
      // Hide loading indicator
      this._hideLoadingIndicator();

      // Resume video if it was playing before
      if (!this.wasPausedBeforeLoading) {
        this.videoElement.play().catch(err => {
          console.warn('[Helios Video] Could not auto-resume video:', err);
        });
        console.log('[Helios Video] Resumed video after subtitle loading');
      }
    }

    this.wasPausedBeforeLoading = false;
  }

  /**
   * Load subtitles from entries
   * @param {SubtitleEntry[]} entries - Subtitle entries
   * @param {Object} track - Optional track information
   */
  loadSubtitles(entries, track = null) {
    this.subtitleCollection = new SubtitleCollection(entries);

    // Sync to current video position
    const currentTime = this.videoElement.currentTime * 1000;
    this._updateSubtitles();

    console.log(`[Helios Video] Loaded ${entries.length} subtitles at time ${currentTime}ms`);

    // Notify that subtitles were loaded
    this._notifySubtitlesLoaded(entries, track);

    // DON'T finish loading yet - wait for sidebar to scroll to position
    // finishLoadingSubtitles() will be called when sidebar signals it's ready
  }

  /**
   * Clear all subtitles (for new video)
   */
  clearSubtitles() {
    this.subtitleCollection = new SubtitleCollection();
    this.overlay.clear();
    console.log('[Helios Video] Cleared all subtitles');
  }

  /**
   * Load subtitles from file
   * @param {File} file - Subtitle file
   */
  async loadSubtitleFile(file) {
    try {
      const entries = await SubtitleParser.parseFile(file);
      this.loadSubtitles(entries);
      return true;
    } catch (error) {
      console.error('[Helios Video] Failed to load subtitle file:', error);
      return false;
    }
  }

  /**
   * Load subtitles from text content
   * @param {string} content - Subtitle file content
   * @param {string} filename - Optional filename
   */
  loadSubtitleText(content, filename = '') {
    try {
      const entries = SubtitleParser.parse(content, filename);
      this.loadSubtitles(entries);
      return true;
    } catch (error) {
      console.error('[Helios Video] Failed to parse subtitles:', error);
      return false;
    }
  }

  /**
   * Seek video to specific time
   * @param {number} timeMs - Time in milliseconds
   */
  seekTo(timeMs) {
    this.videoElement.currentTime = timeMs / 1000;
  }

  /**
   * Get current subtitles
   * @returns {SubtitleCollection}
   */
  getSubtitles() {
    return this.subtitleCollection;
  }

  /**
   * Notify listeners of time update
   * @param {number} currentTime - Current time in milliseconds
   */
  _notifyTimeUpdate(currentTime) {
    const event = new CustomEvent('helios-video-timeupdate', {
      detail: {
        currentTime,
        videoElement: this.videoElement,
        binding: this
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Notify that subtitles were loaded
   * @param {SubtitleEntry[]} entries - Subtitle entries
   * @param {Object} track - Optional track information
   */
  _notifySubtitlesLoaded(entries = [], track = null) {
    const event = new CustomEvent('helios-subtitles-loaded', {
      detail: {
        entries: entries,
        track: track,
        subtitleCount: this.subtitleCollection.getCount(),
        videoElement: this.videoElement,
        binding: this
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Show loading indicator on video
   */
  _showLoadingIndicator() {
    if (this.loadingIndicator) return;

    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'helios-subtitle-loading-indicator';
    this.loadingIndicator.innerHTML = `
      <div class="helios-loading-spinner"></div>
      <div class="helios-loading-text">Loading subtitles...</div>
    `;

    // Insert near video element
    const videoContainer = this.videoElement.parentElement;
    if (videoContainer) {
      videoContainer.appendChild(this.loadingIndicator);
    }
  }

  /**
   * Hide loading indicator
   */
  _hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.remove();
      this.loadingIndicator = null;
    }
  }

  /**
   * Unbind from video element
   */
  unbind() {
    this._pauseSubtitleSync();
    this.overlay.destroy();
    this._hideLoadingIndicator();
    this.isBound = false;
  }

  /**
   * Check if video has valid source
   * @returns {boolean}
   */
  hasValidSource() {
    if (this.videoElement.src) return true;

    // Check for source elements
    const sources = this.videoElement.querySelectorAll('source');
    for (const source of sources) {
      if (source.src) return true;
    }

    return false;
  }
}
