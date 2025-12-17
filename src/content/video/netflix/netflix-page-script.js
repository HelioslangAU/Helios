/**
 * Netflix Page Context Script
 * Based on asbplayer's approach for extracting Netflix subtitles
 *
 * This script runs in the page context (not extension context)
 * which allows access to Netflix's internal APIs and player data
 */

(function() {
  'use strict';

  console.log('[Helios Netflix Page] Page script loaded');

  const WEBVTT_PROFILE = 'webvtt-lssdh-ios8';
  const manifestPattern = /manifest|licensedManifest/;
  const subTracks = new Map(); // Store subtitle URLs by movieId -> trackId -> url

  /**
   * Get Netflix API
   */
  function getAPI() {
    if (typeof netflix === 'undefined') {
      return undefined;
    }
    return netflix?.appContext?.state?.playerApp?.getAPI?.();
  }

  /**
   * Get video player
   */
  function getVideoPlayer() {
    return getAPI()?.videoPlayer;
  }

  /**
   * Get current player instance
   */
  function player() {
    const netflixVideo = getVideoPlayer();

    if (netflixVideo) {
      const playerSessionIds = netflixVideo.getAllPlayerSessionIds?.() || [];

      if (playerSessionIds.length === 0) {
        console.error('[Helios Netflix Page] No Netflix player session IDs');
        return undefined;
      }

      const playerSessionId = playerSessionIds[playerSessionIds.length - 1];
      return netflixVideo.getVideoPlayerBySessionId?.(playerSessionId);
    }

    console.error('[Helios Netflix Page] Missing netflix global');
    return undefined;
  }

  /**
   * Extract URL from track (legacy method)
   */
  function extractUrlLegacy(track) {
    if (track.isForcedNarrative || track.isNoneTrack || !track.cdnlist?.length || !track.ttDownloadables) {
      return undefined;
    }

    const webvttDL = track.ttDownloadables[WEBVTT_PROFILE];

    if (!webvttDL?.downloadUrls) {
      return undefined;
    }

    return webvttDL.downloadUrls[track.cdnlist.find(cdn => webvttDL.downloadUrls[cdn.id])?.id];
  }

  /**
   * Extract URL from track (modern method)
   */
  function extractUrl(track) {
    if (track.isForcedNarrative || track.isNoneTrack || !track.ttDownloadables) {
      return undefined;
    }

    const webvttDL = track.ttDownloadables[WEBVTT_PROFILE];

    if (!webvttDL?.urls || webvttDL.urls.length === 0) {
      return 'lazy'; // URL not loaded yet
    }

    return webvttDL.urls[0].url;
  }

  /**
   * Store subtitle track when intercepted from Netflix API
   */
  function storeSubTrack(video) {
    const timedTextTracks = video.timedtexttracks || [];

    for (const track of timedTextTracks) {
      const url = extractUrlLegacy(track) ?? extractUrl(track);

      if (url === undefined) {
        continue;
      }

      if (!subTracks.has(video.movieId)) {
        subTracks.set(video.movieId, new Map());
      }

      subTracks.get(video.movieId).set(track.new_track_id, url);
      console.log('[Helios Netflix Page] Stored track:', track.new_track_id, 'URL:', url);
    }
  }

  /**
   * Intercept JSON.stringify to inject webvtt profile
   */
  const originalStringify = JSON.stringify;
  JSON.stringify = function(value) {
    if (typeof value?.url === 'string' && manifestPattern.test(value.url)) {
      for (let objectValue of Object.values(value)) {
        objectValue?.profiles?.unshift(WEBVTT_PROFILE);
      }
    }
    return originalStringify.apply(this, arguments);
  };

  /**
   * Intercept JSON.parse to capture subtitle tracks
   */
  const originalParse = JSON.parse;
  JSON.parse = function() {
    const value = originalParse.apply(this, arguments);

    if (value?.result?.movieId) {
      storeSubTrack(value.result);
    }

    return value;
  };

  /**
   * Get Netflix subtitles
   */
  async function getNetflixSubtitles() {
    try {
      const np = player();
      const titleId = np?.getMovieId();

      if (!np || !titleId) {
        console.warn('[Helios Netflix Page] Player or title ID not available');
        return null;
      }

      const storedTracks = subTracks.get(titleId) || new Map();
      const textTracks = np.getTimedTextTrackList();

      if (!textTracks || textTracks.length === 0) {
        console.warn('[Helios Netflix Page] No text tracks available');
        return null;
      }

      console.log('[Helios Netflix Page] Found', textTracks.length, 'text tracks');
      console.log('[Helios Netflix Page] Stored tracks:', storedTracks.size);

      const tracks = textTracks
        .filter(track => {
          // Filter out tracks without language code
          if (!track.bcp47) return false;

          // Filter out "Off" tracks
          if (track.displayName === 'Off' || track.isNoneTrack) return false;

          // Filter out forced narrative tracks
          if (track.isForcedNarrative) return false;

          // SHOW ALL TRACKS - including lazy ones
          // Users should see all available subtitle options
          return true;
        })
        .map(track => {
          const isClosedCaptions = track.rawTrackType === 'CLOSEDCAPTIONS';
          const language = isClosedCaptions ? `${track.bcp47.toLowerCase()}-cc` : track.bcp47.toLowerCase();
          const baseLang = track.bcp47.toLowerCase();

          // Try to find URL with both trackId formats
          let url = storedTracks.get(track.trackId);

          // If not found, try to match by language code in stored ID
          if (!url || url === 'lazy') {
            for (const [storedId, storedUrl] of storedTracks.entries()) {
              // Check if stored ID contains the language code
              // Format is like: T:2:0;1;en;0;0;0;
              if ((storedId.includes(`;${baseLang};`) || storedId.includes(`;${language};`)) &&
                  storedUrl && storedUrl !== 'lazy') {
                console.log('[Helios Netflix Page] Matched track by language:', storedId, 'for', track.displayName);
                url = storedUrl;
                break;
              }
            }
          }

          return {
            id: track.trackId,
            language: language,
            languageName: track.displayName || track.bcp47,
            url: url || 'lazy', // Keep lazy tracks - they'll be loaded on-demand
            isClosedCaptions: isClosedCaptions,
            isForcedNarrative: track.isForcedNarrative || false,
            rawTrack: track
          };
        });
        // Don't filter out lazy tracks - show all available subtitle options

      return tracks;
    } catch (error) {
      console.error('[Helios Netflix Page] Error getting subtitles:', error);
      return null;
    }
  }

  /**
   * Trigger Netflix to load subtitle URL by setting the track
   * Based on ASB Player's proven approach with 1-second polling interval
   */
  async function loadSubtitleUrl(trackId, language) {
    try {
      const np = player();
      if (!np) {
        return null;
      }

      const titleId = np.getMovieId();
      const storedTracks = subTracks.get(titleId) || new Map();
      const currentTrack = np.getTimedTextTrack();

      // Find the track
      const track = np.getTimedTextTrackList()?.find(t => t.trackId === trackId);
      if (!track) {
        console.error('[Helios Netflix Page] Track not found:', trackId);
        return null;
      }

      // Check if URL is already available by trackId
      let existingUrl = storedTracks.get(trackId);

      // If not found by trackId, try matching by language in stored track IDs
      if (!existingUrl || existingUrl === 'lazy') {
        const baseLang = language.replace('-cc', '');
        for (const [storedId, storedUrl] of storedTracks.entries()) {
          if ((storedId.includes(`;${baseLang};`) || storedId.includes(`;${language};`)) &&
              storedUrl && storedUrl !== 'lazy') {
            console.log('[Helios Netflix Page] Found URL by language match:', storedId);
            existingUrl = storedUrl;
            break;
          }
        }
      }

      if (existingUrl && existingUrl !== 'lazy') {
        console.log('[Helios Netflix Page] Using existing URL');
        return existingUrl;
      }

      // Temporarily set the track to trigger loading
      console.log('[Helios Netflix Page] Setting track to trigger URL loading:', track.displayName);
      await np.setTimedTextTrack(track);

      // Poll for the URL to appear using ASB Player's timing (10 attempts × 1000ms = 10 seconds)
      // Netflix needs more time between polls to populate the URL
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const url = storedTracks.get(trackId);
        if (url && url !== 'lazy') {
          console.log('[Helios Netflix Page] URL loaded after', (i + 1), 'seconds');
          // Revert to original track
          if (currentTrack) {
            await np.setTimedTextTrack(currentTrack);
          }
          return url;
        }
      }

      console.error('[Helios Netflix Page] Timeout waiting for URL to load after 10 seconds');
      return null;
    } catch (error) {
      console.error('[Helios Netflix Page] Error loading subtitle URL:', error);
      return null;
    }
  }

  /**
   * Fetch subtitle content
   */
  async function fetchSubtitleContent(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('[Helios Netflix Page] Error fetching subtitle content:', error);
      return null;
    }
  }

  /**
   * Listen for subtitle track list requests
   */
  window.addEventListener('helios-netflix-request-subtitles', async (event) => {
    console.log('[Helios Netflix Page] Received subtitle request');

    const tracks = await getNetflixSubtitles();

    if (tracks && tracks.length > 0) {
      console.log('[Helios Netflix Page] Sending', tracks.length, 'tracks to content script');
      window.dispatchEvent(new CustomEvent('helios-netflix-subtitles-response', {
        detail: { success: true, tracks: tracks }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('helios-netflix-subtitles-response', {
        detail: { success: false, error: 'No tracks available' }
      }));
    }
  });

  /**
   * Listen for subtitle URL loading requests
   */
  window.addEventListener('helios-netflix-load-subtitle-url', async (event) => {
    const { trackId, language } = event.detail;
    console.log('[Helios Netflix Page] Loading URL for track:', trackId);

    const url = await loadSubtitleUrl(trackId, language);

    window.dispatchEvent(new CustomEvent('helios-netflix-subtitle-url-response', {
      detail: { trackId, url, success: url !== null }
    }));
  });

  /**
   * Listen for subtitle content requests
   */
  window.addEventListener('helios-netflix-request-subtitle-content', async (event) => {
    console.log('[Helios Netflix Page] Received subtitle content request');

    const { url } = event.detail;

    if (!url) {
      window.dispatchEvent(new CustomEvent('helios-netflix-subtitle-content-response', {
        detail: { success: false, error: 'No URL provided' }
      }));
      return;
    }

    const content = await fetchSubtitleContent(url);

    if (content) {
      window.dispatchEvent(new CustomEvent('helios-netflix-subtitle-content-response', {
        detail: { success: true, content: content }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('helios-netflix-subtitle-content-response', {
        detail: { success: false, error: 'Failed to fetch content' }
      }));
    }
  });

  /**
   * Listen for video seek requests
   * Using Netflix's player API to seek avoids anti-tampering issues
   */
  window.addEventListener('helios-netflix-seek-request', (event) => {
    const { timeMs } = event.detail;
    console.log('[Helios Netflix Page] Received seek request:', timeMs, 'ms');

    try {
      const np = player();

      if (!np) {
        console.error('[Helios Netflix Page] Player not available for seeking');
        window.dispatchEvent(new CustomEvent('helios-netflix-seek-response', {
          detail: { success: false, error: 'Player not available' }
        }));
        return;
      }

      // Netflix player uses milliseconds for seek
      np.seek(timeMs);

      console.log('[Helios Netflix Page] Seek successful:', timeMs, 'ms');
      window.dispatchEvent(new CustomEvent('helios-netflix-seek-response', {
        detail: { success: true, timeMs: timeMs }
      }));
    } catch (error) {
      console.error('[Helios Netflix Page] Seek error:', error);
      window.dispatchEvent(new CustomEvent('helios-netflix-seek-response', {
        detail: { success: false, error: error.message }
      }));
    }
  });

  console.log('[Helios Netflix Page] Ready to fetch subtitles and handle seeking');
})();
