/**
 * Netflix Page Script - Runs in Netflix's page context
 * Based on asbplayer's Netflix extraction technique
 * Intercepts JSON to force WebVTT format and extract subtitle URLs
 */

(function() {
    'use strict';

    console.log('[Helios Netflix] Page script injected');

    // Store subtitle tracks: movieId -> trackId -> URL
    const subTracks = new Map();

    // Pattern to detect manifest URLs
    const manifestPattern = /manifest|licensedmanifest/;
    const webvttProfile = 'webvtt-lssdh-ios8';

    // Save original JSON methods
    const originalStringify = JSON.stringify;
    const originalParse = JSON.parse;

    /**
     * Override JSON.stringify to force WebVTT format in requests
     */
    JSON.stringify = function(value) {
        if ('string' === typeof value?.url && manifestPattern.test(value.url)) {
            // Force WebVTT profile for all subtitle tracks
            for (let objectValue of Object.values(value)) {
                if (objectValue && typeof objectValue === 'object') {
                    const profiles = objectValue.profiles;
                    if (Array.isArray(profiles) && !profiles.includes(webvttProfile)) {
                        profiles.unshift(webvttProfile);
                    }
                }
            }
        }
        return originalStringify.apply(this, arguments);
    };

    /**
     * Override JSON.parse to intercept subtitle track URLs
     */
    JSON.parse = function() {
        const value = originalParse.apply(this, arguments);

        // Check if this is a Netflix video result with subtitle tracks
        if (value?.result?.movieId) {
            storeSubtitleTrack(value.result);
        }

        return value;
    };

    /**
     * Extract and store subtitle track URLs from Netflix response
     */
    function storeSubtitleTrack(video) {
        const movieId = video.movieId;
        const timedTextTracks = video.timedtexttracks || [];

        if (timedTextTracks.length === 0) {
            return;
        }

        if (!subTracks.has(movieId)) {
            subTracks.set(movieId, new Map());
        }

        const trackMap = subTracks.get(movieId);

        for (const track of timedTextTracks) {
            const trackId = track.new_track_id || track.id;
            const url = extractUrl(track);

            if (url && url !== 'lazy') {
                trackMap.set(trackId, {
                    url: url,
                    language: track.language,
                    languageDescription: track.languageDescription,
                    isForced: track.isForcedNarrative || false,
                    isClosedCaptions: track.cdnlist?.[0]?.content_profile === 'webvtt-lssdh-ios8'
                });

                console.log('[Helios Netflix] Stored subtitle track:', {
                    movieId,
                    trackId,
                    language: track.language,
                    url: url.substring(0, 100) + '...'
                });
            }
        }
    }

    /**
     * Extract URL from track data
     */
    function extractUrl(track) {
        const downloadables = track.ttDownloadables || {};

        for (const [key, value] of Object.entries(downloadables)) {
            if (value && typeof value === 'object' && 'urls' in value) {
                const urls = value.urls || [];
                if (urls.length > 0) {
                    return urls[0]?.url;
                }
            }
        }

        return null;
    }

    /**
     * Get Netflix video player API
     */
    function getVideoPlayer() {
        try {
            return window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
        } catch (e) {
            console.error('[Helios Netflix] Error accessing video player:', e);
            return null;
        }
    }

    /**
     * Get current player instance
     */
    function getPlayer() {
        try {
            const netflixVideo = getVideoPlayer();
            if (!netflixVideo) return null;

            const playerSessionIds = netflixVideo.getAllPlayerSessionIds?.() || [];
            const playerSessionId = playerSessionIds[playerSessionIds.length - 1];

            return netflixVideo.getVideoPlayerBySessionId?.(playerSessionId);
        } catch (e) {
            console.error('[Helios Netflix] Error getting player:', e);
            return null;
        }
    }

    /**
     * Get current movie/episode ID
     */
    function getCurrentMovieId() {
        try {
            const player = getPlayer();
            return player?.getMovieId?.() || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get all available subtitle tracks for current video
     */
    function getAllSubtitleTracks() {
        const movieId = getCurrentMovieId();
        if (!movieId) {
            console.log('[Helios Netflix] No current movie ID');
            return [];
        }

        const trackMap = subTracks.get(movieId);
        if (!trackMap || trackMap.size === 0) {
            console.log('[Helios Netflix] No subtitle tracks found for movie:', movieId);
            return [];
        }

        const tracks = [];
        for (const [trackId, trackData] of trackMap.entries()) {
            tracks.push({
                trackId,
                ...trackData
            });
        }

        return tracks;
    }

    /**
     * Get video title/basename
     */
    function getVideoTitle() {
        try {
            const player = getPlayer();
            const metadata = player?.getMovieMetadata?.();

            if (metadata) {
                const title = metadata.title || 'Netflix Video';
                const season = metadata.season;
                const episode = metadata.episode;

                if (season && episode) {
                    return `${title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                }

                return title;
            }

            return 'Netflix Video';
        } catch (e) {
            return 'Netflix Video';
        }
    }

    /**
     * Get all available tracks using Netflix API (ASBPlayer approach)
     */
    function getAllAvailableTracks() {
        try {
            const player = getPlayer();
            if (!player) {
                console.log('[Helios Netflix] No player available');
                return [];
            }

            const movieId = getCurrentMovieId();
            if (!movieId) {
                console.log('[Helios Netflix] No current movie ID');
                return [];
            }

            const storedTracks = subTracks.get(movieId);
            if (!storedTracks) {
                console.log('[Helios Netflix] No stored tracks for movie:', movieId);
                return [];
            }

            // Get available tracks from Netflix API
            const timedTextTrackList = player.getTimedTextTrackList?.() || [];

            const availableTracks = [];
            for (const track of timedTextTrackList) {
                const trackId = track.trackId;
                const storedTrackData = storedTracks.get(trackId);

                if (storedTrackData) {
                    const isClosedCaptions = track.rawTrackType === 'CLOSEDCAPTIONS';
                    availableTracks.push({
                        trackId: trackId,
                        language: track.bcp47 || track.language,
                        languageDescription: track.displayName || track.languageDescription,
                        url: storedTrackData.url,
                        isForced: track.isForcedNarrative || storedTrackData.isForced || false,
                        isClosedCaptions: isClosedCaptions
                    });
                }
            }

            return availableTracks;
        } catch (e) {
            console.error('[Helios Netflix] Error getting available tracks:', e);
            return [];
        }
    }

    /**
     * Listen for subtitle requests from content script
     */
    window.addEventListener('helios-netflix-request-subtitles', (event) => {
        console.log('[Helios Netflix] Received subtitle request');

        const tracks = getAllAvailableTracks();
        const title = getVideoTitle();
        const movieId = getCurrentMovieId();

        window.dispatchEvent(new CustomEvent('helios-netflix-subtitles-response', {
            detail: {
                tracks,
                title,
                movieId,
                timestamp: Date.now()
            }
        }));

        console.log('[Helios Netflix] Sent subtitle response:', {
            trackCount: tracks.length,
            title,
            movieId
        });
    });

    /**
     * Listen for specific track requests
     */
    window.addEventListener('helios-netflix-request-track', (event) => {
        const { trackId } = event.detail || {};
        const movieId = getCurrentMovieId();

        if (!movieId || !trackId) {
            return;
        }

        const trackMap = subTracks.get(movieId);
        const trackData = trackMap?.get(trackId);

        if (trackData) {
            window.dispatchEvent(new CustomEvent('helios-netflix-track-response', {
                detail: {
                    trackId,
                    ...trackData
                }
            }));
        }
    });

    console.log('[Helios Netflix] Page script ready and listening for requests');
})();
