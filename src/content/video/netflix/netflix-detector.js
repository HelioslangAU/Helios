/**
 * Netflix Detector - Helper for detecting Netflix video playback
 */

class NetflixDetector {
    constructor() {
        this.onVideoDetected = null;
        this.onVideoLost = null;
        this.currentVideoElement = null;
        this.isWatching = false;

        console.log('[Helios Netflix Detector] Initialized');
    }

    /**
     * Check if we're on Netflix
     */
    static isNetflixPage() {
        return window.location.hostname.includes('netflix.com');
    }

    /**
     * Check if user is on a watch page
     */
    static isWatchPage() {
        return window.location.pathname.includes('/watch');
    }

    /**
     * Find Netflix video element
     */
    findVideoElement() {
        const video = document.querySelector('video');

        if (video && this._isValidNetflixVideo(video)) {
            return video;
        }

        return null;
    }

    /**
     * Check if video element is valid Netflix video
     */
    _isValidNetflixVideo(video) {
        // Must have valid duration (not 0 or infinite)
        const hasValidDuration = video.duration > 0 && isFinite(video.duration);

        // Must have reasonable dimensions
        const hasValidSize = video.videoWidth > 0 && video.videoHeight > 0;

        return hasValidDuration && hasValidSize;
    }

    /**
     * Start detecting videos
     */
    startDetection() {
        console.log('[Helios Netflix Detector] Starting detection');

        // Check immediately
        this._checkForVideo();

        // Set up mutation observer for DOM changes
        this._setupMutationObserver();

        // Set up URL change detection
        this._setupUrlChangeDetection();

        // Periodic check as fallback
        this._setupPeriodicCheck();
    }

    /**
     * Check for video element
     */
    _checkForVideo() {
        const videoElement = this.findVideoElement();

        if (videoElement && !this.isWatching) {
            // Video detected
            this.isWatching = true;
            this.currentVideoElement = videoElement;

            console.log('[Helios Netflix Detector] Video detected:', {
                duration: videoElement.duration,
                dimensions: `${videoElement.videoWidth}x${videoElement.videoHeight}`
            });

            // Monitor video element for changes
            this._monitorVideoElement(videoElement);

            // Notify listeners
            if (this.onVideoDetected) {
                this.onVideoDetected(videoElement);
            }
        } else if (!videoElement && this.isWatching) {
            // Video lost
            this._handleVideoLost();
        }
    }

    /**
     * Handle video lost
     */
    _handleVideoLost() {
        console.log('[Helios Netflix Detector] Video lost');

        this.isWatching = false;
        this.currentVideoElement = null;

        if (this.onVideoLost) {
            this.onVideoLost();
        }
    }

    /**
     * Monitor video element for metadata changes
     */
    _monitorVideoElement(videoElement) {
        // Listen for metadata loaded (episode change)
        videoElement.addEventListener('loadedmetadata', () => {
            console.log('[Helios Netflix Detector] Video metadata changed');

            // Notify as new video detected
            if (this.onVideoDetected) {
                this.onVideoDetected(videoElement);
            }
        });

        // Listen for emptied event (video unloaded)
        videoElement.addEventListener('emptied', () => {
            console.log('[Helios Netflix Detector] Video emptied');
            this._handleVideoLost();
        });
    }

    /**
     * Set up mutation observer
     */
    _setupMutationObserver() {
        const observer = new MutationObserver(() => {
            this._checkForVideo();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.mutationObserver = observer;
    }

    /**
     * Set up URL change detection
     */
    _setupUrlChangeDetection() {
        let lastUrl = window.location.href;

        const checkUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('[Helios Netflix Detector] URL changed:', currentUrl);
                lastUrl = currentUrl;

                // Check for video after URL change
                setTimeout(() => this._checkForVideo(), 1000);
            }
        };

        // Check every second
        setInterval(checkUrlChange, 1000);
    }

    /**
     * Set up periodic check
     */
    _setupPeriodicCheck() {
        setInterval(() => {
            this._checkForVideo();
        }, 3000);
    }

    /**
     * Get current video element
     */
    getCurrentVideo() {
        return this.currentVideoElement;
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        this.onVideoDetected = null;
        this.onVideoLost = null;
        this.currentVideoElement = null;
        this.isWatching = false;

        console.log('[Helios Netflix Detector] Destroyed');
    }
}
