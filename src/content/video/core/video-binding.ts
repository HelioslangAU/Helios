import { SubtitleCollection } from '@/content/video/models/subtitle-collection';
import { SubtitleParser } from '@/content/video/parsers/subtitle-parser';
import { SubtitleOverlay } from '@/content/video/ui/subtitle-overlay';
import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Manages subtitle functionality for a single video element
 */
export class VideoBinding {
  videoElement: HTMLVideoElement;
  subtitleCollection: SubtitleCollection;
  overlay: SubtitleOverlay;
  updateInterval: ReturnType<typeof setInterval> | null;
  isBound: boolean;

  // Loading state management
  isLoadingSubtitles: boolean;
  wasPausedBeforeLoading: boolean;
  loadingIndicator: HTMLDivElement | null;

  _playHandler: (() => void) | null = null;
  _pauseHandler: (() => void) | null = null;
  _seekedHandler: (() => void) | null = null;
  _emptiedHandler: (() => void) | null = null;
  _endedHandler: (() => void) | null = null;

  constructor(videoElement: HTMLVideoElement) {
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
  bind(): void {
    if (this.isBound) return;

    this._setupEventListeners();
    this._startSubtitleSync();
    this._setupSidebarReadyListener();

    this.isBound = true;
  }

  /**
   * Setup listener for sidebar ready event
   */
  _setupSidebarReadyListener(): void {
    document.addEventListener('helios-sidebar-ready', () => {
      // Sidebar has finished loading and scrolling to position
      // Now we can resume the video if it was playing
      if (this.isLoadingSubtitles) {
        this.finishLoadingSubtitles();
      }
    });
  }

  /**
   * Setup video event listeners
   */
  _setupEventListeners(): void {
    // Store handlers so we can remove them later
    this._playHandler = () => this._startSubtitleSync();
    this._pauseHandler = () => this._pauseSubtitleSync();
    this._seekedHandler = () => this._updateSubtitles();
    this._emptiedHandler = () => this._pauseSubtitleSync();
    this._endedHandler = () => {
      this._pauseSubtitleSync();
      this.overlay.clear();
    };

    this.videoElement.addEventListener('play', this._playHandler);
    this.videoElement.addEventListener('pause', this._pauseHandler);
    this.videoElement.addEventListener('seeked', this._seekedHandler);
    this.videoElement.addEventListener('emptied', this._emptiedHandler);
    this.videoElement.addEventListener('ended', this._endedHandler);
  }

  /**
   * Start subtitle synchronization loop
   */
  _startSubtitleSync(): void {
    if (this.updateInterval) return;

    // Update subtitles every 100ms
    this.updateInterval = setInterval(() => {
      this._updateSubtitles();
    }, 100);
  }

  /**
   * Pause subtitle synchronization
   */
  _pauseSubtitleSync(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update displayed subtitles based on current video time
   */
  _updateSubtitles(): void {
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
   */
  _isAdPlaying(): boolean {
    // Check for YouTube ad indicators
    if (window.location.hostname.includes('youtube.com')) {
      // YouTube adds .ad-showing class to video container during ads
      const playerContainer = document.querySelector('.html5-video-player');
      if (playerContainer && playerContainer.classList.contains('ad-showing')) {
        return true;
      }

      // Additional check: YouTube's ad module
      const adModule = document.querySelector<HTMLElement>('.video-ads');
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
  startLoadingSubtitles(): void {
    if (this.isLoadingSubtitles) return;

    this.isLoadingSubtitles = true;
    const isAd = this._isAdPlaying();

    if (!isAd) {
      // Only pause video if it's not an ad
      this.wasPausedBeforeLoading = this.videoElement.paused;
      if (!this.wasPausedBeforeLoading) {
        this.videoElement.pause();
      }

      // Show loading indicator (disabled - using YouTube sidebar loading state only)
      // this._showLoadingIndicator();
    }
  }

  /**
   * Finish loading subtitles - resume video if it was playing, hide loading indicator
   */
  finishLoadingSubtitles(): void {
    if (!this.isLoadingSubtitles) return;

    this.isLoadingSubtitles = false;
    const isAd = this._isAdPlaying();

    if (!isAd) {
      // Hide loading indicator (disabled - using YouTube sidebar loading state only)
      // this._hideLoadingIndicator();

      // Resume video if it was playing before
      if (!this.wasPausedBeforeLoading) {
        this.videoElement.play().catch(err => {
          console.warn('[Helios Video] Could not auto-resume video:', err);
        });
      }
    }

    this.wasPausedBeforeLoading = false;
  }

  /**
   * Load subtitles from entries
   * @param entries - Subtitle entries
   * @param track - Optional track information
   */
  loadSubtitles(entries: SubtitleEntry[], track: any = null): void {
    this.subtitleCollection = new SubtitleCollection(entries);

    // Sync to current video position
    const currentTime = this.videoElement.currentTime * 1000;
    this._updateSubtitles();

    // Notify that subtitles were loaded
    this._notifySubtitlesLoaded(entries, track);

    // DON'T finish loading yet - wait for sidebar to scroll to position
    // finishLoadingSubtitles() will be called when sidebar signals it's ready
  }

  /**
   * Clear all subtitles (for new video)
   */
  clearSubtitles(): void {
    this.subtitleCollection = new SubtitleCollection();
    this.overlay.clear();
  }

  /**
   * Load subtitles from file
   * @param file - Subtitle file
   */
  async loadSubtitleFile(file: File): Promise<boolean> {
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
   * @param content - Subtitle file content
   * @param filename - Optional filename
   */
  loadSubtitleText(content: string, filename: string = ''): boolean {
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
   * @param timeMs - Time in milliseconds
   */
  seekTo(timeMs: number): void {
    // Check if we're on Netflix - use Netflix API to avoid anti-tampering
    const isNetflix = window.location.hostname.includes('netflix.com');

    if (isNetflix) {
      // Use Netflix's player API via page script
      window.dispatchEvent(new CustomEvent('helios-netflix-seek-request', {
        detail: { timeMs }
      }));
    } else {
      // Standard seek for other platforms
      this.videoElement.currentTime = timeMs / 1000;
    }
  }

  /**
   * Get current subtitles
   */
  getSubtitles(): SubtitleCollection {
    return this.subtitleCollection;
  }

  /**
   * Notify listeners of time update
   * @param currentTime - Current time in milliseconds
   */
  _notifyTimeUpdate(currentTime: number): void {
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
   * @param entries - Subtitle entries
   * @param track - Optional track information
   */
  _notifySubtitlesLoaded(entries: SubtitleEntry[] = [], track: any = null): void {
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
  _showLoadingIndicator(): void {
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
  _hideLoadingIndicator(): void {
    if (this.loadingIndicator) {
      this.loadingIndicator.remove();
      this.loadingIndicator = null;
    }
  }

  /**
   * Unbind from video element
   */
  unbind(): void {
    // Clean up subtitle sync
    this._pauseSubtitleSync();

    // Remove all event listeners
    if (this.videoElement && this._playHandler) {
      this.videoElement.removeEventListener('play', this._playHandler);
      this.videoElement.removeEventListener('pause', this._pauseHandler!);
      this.videoElement.removeEventListener('seeked', this._seekedHandler!);
      this.videoElement.removeEventListener('emptied', this._emptiedHandler!);
      this.videoElement.removeEventListener('ended', this._endedHandler!);

      // Clear handler references
      this._playHandler = null;
      this._pauseHandler = null;
      this._seekedHandler = null;
      this._emptiedHandler = null;
      this._endedHandler = null;
    }

    // Clean up UI elements
    this.overlay.destroy();
    this._hideLoadingIndicator();

    this.isBound = false;
  }

  /**
   * Check if video has valid source
   */
  hasValidSource(): boolean {
    if (this.videoElement.src) return true;

    // Check for source elements
    const sources = this.videoElement.querySelectorAll('source');
    for (const source of sources) {
      if (source.src) return true;
    }

    return false;
  }
}
