/**
 * Netflix Subtitle Loader
 * Extends BasePlatformSubtitleLoader for common functionality
 * Handles DFXP/TTML and WebVTT formats with lazy URL loading
 */
class NetflixSubtitleLoader extends BasePlatformSubtitleLoader {
  constructor(videoDetector) {
    super(videoDetector);
    this.pendingTrackRequest = null;

    if (this.isPlatformPage()) {
      // NOTE: Page script is injected early via netflix-early-inject.js at document_start
      // We just need to mark it as injected
      this.pageScriptInjected = true;
      this._setupEventListeners();
    }
  }

  /**
   * @override
   */
  getPlatformName() {
    return 'Netflix';
  }

  /**
   * @override
   */
  isPlatformPage() {
    return window.location.hostname.includes('netflix.com');
  }

  /**
   * Backward compatibility alias
   */
  isNetflixPage() {
    return this.isPlatformPage();
  }

  /**
   * @override
   * Note: Page script is injected early via netflix-early-inject.js
   * This method is here for compatibility but doesn't need to do anything
   */
  _injectPageScript() {
    if (this.pageScriptInjected) return;

    const success = this.injectScript(
      'src/content/video/netflix/netflix-page-script.js',
      () => {
        console.log('[Helios Netflix] Page script injected successfully');
        this.pageScriptInjected = true;
      },
      () => console.error('[Helios Netflix] Failed to inject page script')
    );

    if (success) {
      this.pageScriptInjected = true;
    }
  }

  /**
   * @override
   * Setup event listeners for communication with page script
   */
  _setupEventListeners() {
    // Listen for track list responses
    window.addEventListener('helios-netflix-subtitles-response', (event) => {
      if (this.pendingTrackRequest) {
        const { resolve } = this.pendingTrackRequest;
        this.pendingTrackRequest = null;

        const { tracks } = event.detail || {};

        if (tracks && tracks.length > 0) {
          console.log('[Helios Netflix] Received tracks from page script:', tracks.length);
          resolve(tracks);
        } else {
          console.warn('[Helios Netflix] No tracks available');
          resolve([]);
        }
      }
    });

    // Listen for subtitle content responses
    window.addEventListener('helios-netflix-subtitle-content-response', (event) => {
      if (this.pendingContentRequest) {
        const { resolve } = this.pendingContentRequest;
        this.pendingContentRequest = null;

        const { success, content, error } = event.detail;

        if (success && content) {
          console.log('[Helios Netflix] Received subtitle content');
          resolve(content);
        } else {
          console.warn('[Helios Netflix] Content fetch error:', error);
          resolve(null);
        }
      }
    });
  }

  /**
   * @override
   * Get available subtitle tracks
   */
  async getAvailableTracks() {
    if (!this.isNetflixPage()) {
      return [];
    }

    if (!this.pageScriptInjected) {
      console.warn('[Helios Netflix] Page script not injected yet');
      return [];
    }

    try {
      const tracks = await new Promise((resolve) => {
        this.pendingTrackRequest = { resolve };

        window.dispatchEvent(new CustomEvent('helios-netflix-request-subtitles'));

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.pendingTrackRequest) {
            console.warn('[Helios Netflix] Timeout waiting for tracks');
            this.pendingTrackRequest = null;
            resolve([]);
          }
        }, 5000);
      });

      return tracks;
    } catch (error) {
      console.error('[Helios Netflix] Failed to get subtitle tracks:', error);
      return [];
    }
  }

  /**
   * @override
   * Platform-specific implementation of track loading
   */
  async _loadTrackImpl(track) {
    let url = track.url;

    // If URL is lazy or not available, request it from page script
    if (!url || url === 'lazy' || url === 'lazy-load') {
      console.log('[Helios Netflix] URL not available, requesting lazy load...');
      url = await this._loadSubtitleUrl(track.id, track.language);

      if (!url) {
        throw new Error('Failed to load subtitle URL');
      }
    }

    console.log('[Helios Netflix] Fetching content from URL');

    // Request subtitle content from page script
    const content = await this._fetchSubtitleContent(url);

    if (!content) {
      throw new Error('Failed to fetch subtitle content');
    }

    console.log('[Helios Netflix] Received content length:', content.length);

    // Parse Netflix subtitles (DFXP/TTML or WebVTT format)
    return this._parseNetflixSubtitles(content);
  }

  /**
   * Fetch subtitle content from URL via page script
   * @param {string} url - Subtitle URL
   * @returns {Promise<string|null>}
   */
  async _fetchSubtitleContent(url) {
    return new Promise((resolve) => {
      this.pendingContentRequest = { resolve };

      window.dispatchEvent(new CustomEvent('helios-netflix-request-subtitle-content', {
        detail: { url: url }
      }));

      // Timeout after 15 seconds (increased for slower connections)
      setTimeout(() => {
        if (this.pendingContentRequest) {
          console.warn('[Helios Netflix] Timeout waiting for content');
          this.pendingContentRequest = null;
          resolve(null);
        }
      }, 15000);
    });
  }

  /**
   * Request page script to load subtitle URL
   * @param {string} trackId - Track ID
   * @param {string} language - Language code
   * @returns {Promise<string|null>}
   */
  async _loadSubtitleUrl(trackId, language) {
    return new Promise((resolve) => {
      // Setup one-time listener for response
      const responseHandler = (event) => {
        if (event.detail.trackId === trackId) {
          window.removeEventListener('helios-netflix-subtitle-url-response', responseHandler);
          resolve(event.detail.url);
        }
      };

      window.addEventListener('helios-netflix-subtitle-url-response', responseHandler);

      // Request URL loading
      window.dispatchEvent(new CustomEvent('helios-netflix-load-subtitle-url', {
        detail: { trackId, language }
      }));

      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('helios-netflix-subtitle-url-response', responseHandler);
        resolve(null);
      }, 10000);
    });
  }

  /**
   * Parse Netflix subtitles (DFXP/TTML or WebVTT format)
   * @param {string} content - Subtitle content
   * @returns {SubtitleEntry[]}
   */
  _parseNetflixSubtitles(content) {
    try {
      console.log('[Helios Netflix] Content preview:', content.substring(0, 500));
      console.log('[Helios Netflix] Content length:', content.length);

      // Check if it's XML-based (DFXP/TTML)
      if (content.trim().startsWith('<?xml') || content.includes('<tt ') || content.includes('<ttml')) {
        console.log('[Helios Netflix] Detected DFXP/TTML format');
        return this._parseDFXP(content);
      }

      // Check if it's WebVTT
      if (content.includes('WEBVTT')) {
        console.log('[Helios Netflix] Detected WebVTT format');
        return this._parseWebVTT(content);
      }

      // Try to parse as generic subtitle format
      console.warn('[Helios Netflix] Unknown subtitle format, trying generic parser');
      return SubtitleParser.parse(content, 'subtitle.vtt');
    } catch (error) {
      console.error('[Helios Netflix] Error parsing subtitles:', error);
      return [];
    }
  }

  /**
   * Parse DFXP/TTML format (Netflix's common format)
   * @param {string} xml - DFXP/TTML XML content
   * @returns {SubtitleEntry[]}
   */
  _parseDFXP(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.error('[Helios Netflix] XML parsing error:', parserError.textContent);
        return [];
      }

      // Find all <p> elements (subtitle entries)
      const subtitleNodes = doc.querySelectorAll('p');
      console.log('[Helios Netflix] Found DFXP nodes:', subtitleNodes.length);

      const entries = [];
      let index = 0;

      subtitleNodes.forEach((node) => {
        const begin = node.getAttribute('begin');
        const end = node.getAttribute('end');

        if (!begin || !end) return;

        const startMs = this.parseTimeCode(begin);
        const endMs = this.parseTimeCode(end);

        // Extract text from node, handling nested spans properly
        let text = this._extractTextFromDFXPNode(node);

        if (text && startMs !== null && endMs !== null) {
          entries.push(new SubtitleEntry({
            index: index++,
            start: startMs,
            end: endMs,
            text: text
          }));
        }
      });

      console.log('[Helios Netflix] Parsed DFXP entries:', entries.length);
      return entries;
    } catch (error) {
      console.error('[Helios Netflix] Error parsing DFXP:', error);
      return [];
    }
  }

  /**
   * Extract clean text from DFXP node, removing control characters and metadata
   * Uses base class cleanText() method
   * @param {Element} node - DFXP subtitle node
   * @returns {string} - Clean text
   */
  _extractTextFromDFXPNode(node) {
    return this.cleanText(node.textContent || '');
  }

  /**
   * Parse WebVTT format
   * @param {string} content - WebVTT content
   * @returns {SubtitleEntry[]}
   */
  _parseWebVTT(content) {
    console.log('[Helios Netflix] Parsing WebVTT, content length:', content.length);

    // Use VTT parser which handles class tags internally
    const entries = VTTParser.parse(content);

    // Apply additional text cleaning to each entry
    entries.forEach(entry => {
      entry.text = this.cleanText(entry.text);
    });

    console.log('[Helios Netflix] WebVTT parsed:', entries.length, 'entries');
    if (entries.length > 0) {
      console.log('[Helios Netflix] First entry sample:', {
        start: entries[0].start,
        end: entries[0].end,
        text: entries[0].text.substring(0, 100)
      });
    }

    return entries;
  }

  /**
   * @override
   * Platform-specific subtitle parsing - delegates to format-specific parsers
   * @param {Document} doc - Parsed XML/HTML document
   * @param {string} rawContent - Raw content string
   * @returns {SubtitleEntry[]}
   */
  _parseSubtitleContent(doc, rawContent) {
    return this._parseNetflixSubtitles(rawContent);
  }

  /**
   * Get video element (for compatibility with VideoUIController)
   * @returns {HTMLVideoElement|null}
   */
  getVideoElement() {
    return document.querySelector('video');
  }

  /**
   * Check if user is watching a video (not just browsing)
   * @returns {boolean}
   */
  isWatchingVideo() {
    const videoElement = document.querySelector('video');
    const isWatchPage = window.location.pathname.includes('/watch');
    return !!(videoElement && isWatchPage);
  }

  /**
   * Auto-load Netflix subtitles in preferred language
   * @param {string} preferredLanguage - Language code
   * @returns {Promise<boolean>}
   */
  async autoLoadSubtitles(preferredLanguage = 'en') {
    console.log('[Helios Netflix] Auto-loading subtitles for language:', preferredLanguage);

    const tracks = await this.getAvailableTracks();

    if (tracks.length === 0) {
      console.warn('[Helios Netflix] No subtitle tracks available');
      return false;
    }

    console.log('[Helios Netflix] Available tracks:', tracks.map(t => `${t.language} (${t.languageName})`));

    // Find preferred language track
    let selectedTrack = tracks.find(t => t.language === preferredLanguage && !t.isClosedCaptions);

    // Fallback to closed captions
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => t.language === preferredLanguage);
    }

    // Fallback to partial match
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => t.language.startsWith(preferredLanguage));
    }

    if (!selectedTrack) {
      console.log('[Helios Netflix] No captions available for target language:', preferredLanguage);
      return false;
    }

    console.log('[Helios Netflix] Selected track:', selectedTrack.language, selectedTrack.languageName);

    try {
      const entries = await this.loadTrack(selectedTrack);

      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        binding.loadSubtitles(entries, selectedTrack);
        console.log(`[Helios Netflix] Loaded ${entries.length} subtitles (${selectedTrack.languageName})`);
        return true;
      } else {
        console.error('[Helios Netflix] No video binding found');
      }
    } catch (error) {
      console.error('[Helios Netflix] Failed to auto-load subtitles:', error);
      return false;
    }

    return false;
  }
}
