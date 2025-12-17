/**
 * Netflix Subtitle Loader - Content Script
 * Extracts subtitles from Netflix by communicating with page script
 */

class NetflixSubtitleLoader {
    constructor() {
        this.onSubtitlesLoaded = null;
        this.currentTracks = [];
        this.loadedTrackUrls = new Set();

        console.log('[Helios Netflix Loader] Initialized');
    }

    /**
     * Check if we're on Netflix
     */
    isNetflixPage() {
        return window.location.hostname.includes('netflix.com');
    }

    /**
     * Check if user is watching a video (not just browsing)
     */
    isWatchingVideo() {
        // Check for Netflix video player
        const videoElement = document.querySelector('video');
        const isWatchPage = window.location.pathname.includes('/watch');

        return !!(videoElement && isWatchPage);
    }

    /**
     * Initialize the loader
     */
    async init() {
        if (!this.isNetflixPage()) {
            console.log('[Helios Netflix Loader] Not on Netflix, skipping initialization');
            return;
        }

        console.log('[Helios Netflix Loader] Initializing on Netflix');

        // NOTE: Page script is injected early via netflix-early-inject.js at document_start
        // We don't need to inject or wait for it - it's already running

        // Set up event listeners
        this._setupEventListeners();

        // Wait for video to be available
        await this._waitForVideo();

        // Monitor for video changes (episode transitions)
        this._monitorVideoChanges();

        console.log('[Helios Netflix Loader] Initialization complete');
    }

    /**
     * Wait for video element to be available
     */
    async _waitForVideo() {
        return new Promise((resolve) => {
            if (this.isWatchingVideo()) {
                resolve();
                return;
            }

            const observer = new MutationObserver(() => {
                if (this.isWatchingVideo()) {
                    observer.disconnect();
                    resolve();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Also check URL changes for navigation to watch page
            const checkUrl = () => {
                if (this.isWatchingVideo()) {
                    observer.disconnect();
                    clearInterval(urlCheckInterval);
                    resolve();
                }
            };
            const urlCheckInterval = setInterval(checkUrl, 500);
        });
    }

    /**
     * Inject page script into Netflix's page context
     */
    _injectPageScript() {
        if (this.pageScriptInjected) {
            console.log('[Helios Netflix Loader] Page script already injected');
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/content/video/netflix/netflix-page-script.js');
        script.onload = () => {
            console.log('[Helios Netflix Loader] Page script loaded');
            script.remove();
        };
        script.onerror = (error) => {
            console.error('[Helios Netflix Loader] Failed to inject page script:', error);
        };

        (document.head || document.documentElement).appendChild(script);
        this.pageScriptInjected = true;
    }


    /**
     * Set up event listeners for page script communication
     */
    _setupEventListeners() {
        // Listen for subtitle data from page script
        window.addEventListener('helios-netflix-subtitles-response', async (event) => {
            const { tracks, title, movieId } = event.detail || {};

            console.log('[Helios Netflix Loader] Received subtitles:', {
                trackCount: tracks?.length || 0,
                title,
                movieId
            });

            if (tracks && tracks.length > 0) {
                this.currentTracks = tracks;
                await this._loadSubtitlesFromTracks(tracks);
            }
        });

        // Listen for specific track responses
        window.addEventListener('helios-netflix-track-response', async (event) => {
            const trackData = event.detail;
            if (trackData) {
                await this._loadSubtitleFromTrack(trackData);
            }
        });
    }

    /**
     * Request subtitles from page script
     */
    requestSubtitles() {
        console.log('[Helios Netflix Loader] Requesting subtitles from page script');
        window.dispatchEvent(new CustomEvent('helios-netflix-request-subtitles'));
    }

    /**
     * Get available subtitle tracks (returns Promise)
     */
    async getAvailableTracks() {
        return new Promise((resolve) => {
            // Set up one-time listener for tracks response
            const handler = (event) => {
                const { tracks } = event.detail || {};
                window.removeEventListener('helios-netflix-subtitles-response', handler);

                // Convert to format matching YouTube tracks
                const formattedTracks = (tracks || []).map(track => ({
                    trackId: track.trackId,
                    language: track.language,
                    languageName: track.languageDescription || track.language,
                    url: track.url,
                    isForced: track.isForced || false,
                    isClosedCaptions: track.isClosedCaptions || false,
                    // Netflix-specific fields
                    _netflixTrack: track
                }));

                console.log('[Helios Netflix Loader] Available tracks:', formattedTracks);
                resolve(formattedTracks);
            };

            window.addEventListener('helios-netflix-subtitles-response', handler);

            // Request tracks
            this.requestSubtitles();

            // Timeout after 5 seconds
            setTimeout(() => {
                window.removeEventListener('helios-netflix-subtitles-response', handler);
                resolve([]);
            }, 5000);
        });
    }

    /**
     * Load a specific track by track object
     */
    async loadTrack(track) {
        console.log('[Helios Netflix Loader] Loading specific track:', track.language);

        // If track has the original Netflix data, use that
        const trackData = track._netflixTrack || track;

        const success = await this._loadSubtitleFromTrack(trackData);
        if (success) {
            this.loadedTrackUrls.add(trackData.url);
        }
        return success;
    }

    /**
     * Load subtitles from available tracks
     */
    async _loadSubtitlesFromTracks(tracks) {
        // Filter for target language tracks (non-forced, non-CC preferred)
        const sortedTracks = [...tracks].sort((a, b) => {
            // Prefer non-forced over forced
            if (a.isForced !== b.isForced) return a.isForced ? 1 : -1;
            // Prefer non-CC over CC
            if (a.isClosedCaptions !== b.isClosedCaptions) return a.isClosedCaptions ? 1 : -1;
            return 0;
        });

        // Try to load the first suitable track
        for (const track of sortedTracks) {
            if (this.loadedTrackUrls.has(track.url)) {
                console.log('[Helios Netflix Loader] Track already loaded:', track.language);
                continue;
            }

            const success = await this._loadSubtitleFromTrack(track);
            if (success) {
                this.loadedTrackUrls.add(track.url);
                break; // Load first successful track
            }
        }
    }

    /**
     * Load subtitle from a specific track
     */
    async _loadSubtitleFromTrack(track) {
        try {
            console.log('[Helios Netflix Loader] Fetching subtitle:', {
                language: track.language,
                url: track.url.substring(0, 100) + '...'
            });

            const response = await fetch(track.url);
            if (!response.ok) {
                console.error('[Helios Netflix Loader] Failed to fetch subtitle:', response.status);
                return false;
            }

            const vttText = await response.text();
            console.log('[Helios Netflix Loader] Fetched VTT, length:', vttText.length);

            // Debug: Log first 500 characters of VTT to see format
            console.log('[Helios Netflix Loader] VTT sample:', vttText.substring(0, 500));

            // Parse VTT (static method)
            const subtitles = VTTParser.parse(vttText);

            console.log('[Helios Netflix Loader] Parsed subtitles:', subtitles.length, 'entries');

            // Notify listeners
            if (this.onSubtitlesLoaded && subtitles.length > 0) {
                this.onSubtitlesLoaded({
                    subtitles,
                    language: track.language,
                    languageDescription: track.languageDescription,
                    source: 'netflix'
                });
            }

            return true;
        } catch (error) {
            console.error('[Helios Netflix Loader] Error loading subtitle:', error);
            return false;
        }
    }

    /**
     * Monitor for video changes (episode transitions)
     */
    _monitorVideoChanges() {
        let lastMovieId = null;

        const checkForChange = () => {
            // Request subtitles periodically to detect changes
            this.requestSubtitles();
        };

        // Check every 5 seconds for episode changes
        setInterval(checkForChange, 5000);

        // Also listen for video element changes
        const observer = new MutationObserver(() => {
            const videoElement = document.querySelector('video');
            if (videoElement && !videoElement.hasAttribute('data-helios-monitored')) {
                videoElement.setAttribute('data-helios-monitored', 'true');

                // When video loads new content, clear loaded tracks
                videoElement.addEventListener('loadedmetadata', () => {
                    console.log('[Helios Netflix Loader] Video metadata loaded, clearing track cache');
                    this.loadedTrackUrls.clear();
                    setTimeout(() => this.requestSubtitles(), 1000);
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Get video element
     */
    getVideoElement() {
        return document.querySelector('video');
    }

    /**
     * Clean up
     */
    destroy() {
        this.onSubtitlesLoaded = null;
        this.currentTracks = [];
        this.loadedTrackUrls.clear();
        console.log('[Helios Netflix Loader] Destroyed');
    }
}
