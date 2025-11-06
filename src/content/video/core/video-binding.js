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
   * Load subtitles from entries
   * @param {SubtitleEntry[]} entries - Subtitle entries
   */
  loadSubtitles(entries) {
    this.subtitleCollection = new SubtitleCollection(entries);
    this._updateSubtitles();

    console.log(`[Helios Video] Loaded ${entries.length} subtitles`);

    // Notify that subtitles were loaded
    this._notifySubtitlesLoaded();
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
   */
  _notifySubtitlesLoaded() {
    const event = new CustomEvent('helios-subtitles-loaded', {
      detail: {
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
