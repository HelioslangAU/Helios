/**
 * Detects and manages video elements on the page
 */
class VideoDetector {
  constructor() {
    this.bindings = new Map(); // Map<HTMLVideoElement, VideoBinding>
    this.detectionInterval = null;
    this.isRunning = false;
  }

  /**
   * Start detecting video elements
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this._detectVideos();

    // Continuously scan for new videos
    this.detectionInterval = setInterval(() => {
      this._detectVideos();
    }, 2000);
  }

  /**
   * Stop detecting video elements
   */
  stop() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Detect all video elements on the page
   */
  _detectVideos() {
    const videos = this._findAllVideos();

    videos.forEach((video) => {
      if (!this.bindings.has(video)) {
        this._bindToVideo(video);
      }
    });

    // Clean up bindings for removed videos
    this._cleanupRemovedVideos();
  }

  /**
   * Find all video elements including those in shadow DOM
   * @returns {HTMLVideoElement[]}
   */
  _findAllVideos() {
    const videos = [];

    // Regular DOM videos
    const regularVideos = document.querySelectorAll('video');
    regularVideos.forEach((video) => {
      if (this._isValidVideo(video)) {
        videos.push(video);
      }
    });

    // Shadow DOM videos
    const shadowVideos = this._findShadowDOMVideos();
    shadowVideos.forEach((video) => {
      if (this._isValidVideo(video)) {
        videos.push(video);
      }
    });

    return videos;
  }

  /**
   * Find videos in shadow DOM
   * @returns {HTMLVideoElement[]}
   */
  _findShadowDOMVideos() {
    const videos = [];
    const shadowHosts = document.querySelectorAll('*');

    shadowHosts.forEach((host) => {
      if (host.shadowRoot) {
        const shadowVideos = host.shadowRoot.querySelectorAll('video');
        shadowVideos.forEach((video) => videos.push(video));
      }
    });

    return videos;
  }

  /**
   * Check if video element is valid for binding
   * @param {HTMLVideoElement} video
   * @returns {boolean}
   */
  _isValidVideo(video) {
    // Check if already bound
    if (this.bindings.has(video)) return false;

    // Check if video is in DOM
    if (!document.contains(video)) return false;

    // Check if video has dimensions (is visible)
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    return true;
  }

  /**
   * Bind to a video element
   * @param {HTMLVideoElement} video
   */
  _bindToVideo(video) {
    const binding = new VideoBinding(video);
    binding.bind();

    this.bindings.set(video, binding);

    // Notify that a new video was detected
    this._notifyVideoDetected(video, binding);
  }

  /**
   * Cleanup bindings for videos that are no longer in DOM
   */
  _cleanupRemovedVideos() {
    const videosToRemove = [];

    this.bindings.forEach((binding, video) => {
      if (!document.contains(video)) {
        binding.unbind();
        videosToRemove.push(video);
      }
    });

    videosToRemove.forEach((video) => {
      this.bindings.delete(video);
    });
  }

  /**
   * Get binding for a specific video element
   * @param {HTMLVideoElement} video
   * @returns {VideoBinding|null}
   */
  getBinding(video) {
    return this.bindings.get(video) || null;
  }

  /**
   * Get all current bindings
   * @returns {VideoBinding[]}
   */
  getAllBindings() {
    return Array.from(this.bindings.values());
  }

  /**
   * Get the primary (largest) video element
   * @returns {VideoBinding|null}
   */
  getPrimaryBinding() {
    let largestBinding = null;
    let largestArea = 0;

    this.bindings.forEach((binding, video) => {
      const rect = video.getBoundingClientRect();
      const area = rect.width * rect.height;

      if (area > largestArea) {
        largestArea = area;
        largestBinding = binding;
      }
    });

    return largestBinding;
  }

  /**
   * Notify that a video was detected
   * @param {HTMLVideoElement} video
   * @param {VideoBinding} binding
   */
  _notifyVideoDetected(video, binding) {
    const event = new CustomEvent('helios-video-detected', {
      detail: { video, binding }
    });
    document.dispatchEvent(event);
  }

  /**
   * Clear all bindings without destroying the detector
   * Used when disabling the extension
   */
  clearAllBindings() {
    this.bindings.forEach((binding) => {
      binding.unbind();
    });

    this.bindings.clear();
  }

  /**
   * Destroy all bindings and stop detection
   */
  destroy() {
    this.stop();

    this.bindings.forEach((binding) => {
      binding.unbind();
    });

    this.bindings.clear();
  }
}
