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
  }

  /**
   * Bind to video element and start subtitle synchronization
   */
  bind() {
    if (this.isBound) return;

    this._setupEventListeners();
    this._startSubtitleSync();

    this.isBound = true;
    console.log('[Helios Video] Bound to video element:', this.videoElement);
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
   * Load subtitles from entries
   * @param {SubtitleEntry[]} entries - Subtitle entries
   * @param {Object} track - Optional track information
   */
  loadSubtitles(entries, track = null) {
    this.subtitleCollection = new SubtitleCollection(entries);
    this._updateSubtitles();

    console.log(`[Helios Video] Loaded ${entries.length} subtitles`);

    // Notify that subtitles were loaded
    this._notifySubtitlesLoaded(entries, track);
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
   * Unbind from video element
   */
  unbind() {
    this._pauseSubtitleSync();
    this.overlay.destroy();
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
