/**
 * Extracts and loads YouTube captions/subtitles
 */
class YouTubeSubtitleLoader {
  constructor(videoDetector) {
    this.videoDetector = videoDetector;
    this.pageScriptInjected = false;
    this.pendingRequest = null;

    if (this.isYouTubePage()) {
      this._injectPageScript();
      this._setupEventListeners();
    }
  }

  /**
   * Check if current page is YouTube
   * @returns {boolean}
   */
  isYouTubePage() {
    return window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  /**
   * Inject page context script
   * This script runs in YouTube's page context (not extension context)
   * allowing access to window.ytcfg and other YouTube internals
   */
  _injectPageScript() {
    if (this.pageScriptInjected) return;

    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/content/video/youtube/youtube-page-script.js');
      script.onload = () => {
        script.remove();
      };
      script.onerror = () => {
        console.error('[Helios YouTube] Failed to inject page script');
      };

      (document.head || document.documentElement).appendChild(script);
      this.pageScriptInjected = true;
    } catch (error) {
      console.error('[Helios YouTube] Error injecting page script:', error);
    }
  }

  /**
   * Setup event listeners for communication with page script
   */
  _setupEventListeners() {
    window.addEventListener('helios-youtube-subtitles-response', (event) => {
      if (this.pendingRequest) {
        const { resolve } = this.pendingRequest;
        this.pendingRequest = null;

        const { success, tracks, error } = event.detail;

        if (success && tracks) {
          resolve(tracks);
        } else {
          console.warn('[Helios YouTube] Page script error:', error);
          resolve([]);
        }
      }
    });
  }

  /**
   * Extract available subtitle tracks from YouTube player
   * Uses page context script to access YouTube's internal API
   * @returns {Promise<Array>}
   */
  async getAvailableTracks() {
    if (!this.isYouTubePage()) {
      return [];
    }

    if (!this.pageScriptInjected) {
      console.warn('[Helios YouTube] Page script not injected yet');
      return [];
    }

    try {
      // Request tracks from page script
      const tracks = await new Promise((resolve) => {
        this.pendingRequest = { resolve };

        // Dispatch request event
        window.dispatchEvent(new CustomEvent('helios-youtube-request-subtitles', {
          detail: { videoId: this._getCurrentVideoId() }
        }));

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.pendingRequest) {
            console.warn('[Helios YouTube] Timeout waiting for page script response');
            this.pendingRequest = null;
            resolve([]);
          }
        }, 5000);
      });

      return tracks;
    } catch (error) {
      console.error('[Helios YouTube] Failed to get subtitle tracks:', error);
      return [];
    }
  }

  /**
   * Get current video ID from URL
   * @returns {string|null}
   */
  _getCurrentVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }


  /**
   * Load subtitles from YouTube track
   * @param {string} trackUrl - YouTube caption track URL
   * @returns {Promise<SubtitleEntry[]>}
   */
  async loadTrack(trackUrl) {
    try {
      // Fetch caption data
      const response = await fetch(trackUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xml = await response.text();

      // Parse XML captions
      const entries = this._parseYouTubeCaptions(xml);

      return entries;
    } catch (error) {
      console.error('[Helios YouTube] Failed to load track:', error);
      throw error;
    }
  }

  /**
   * Parse YouTube XML captions to subtitle entries
   * Supports both srv3 format (<p> tags) and standard format (<text> tags)
   * @param {string} xml - YouTube caption XML
   * @returns {SubtitleEntry[]}
   */
  _parseYouTubeCaptions(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.error('[Helios YouTube] XML parsing error:', parserError.textContent);
        return [];
      }

      // Try srv3 format first (<p> tags with t/d attributes)
      let subtitleNodes = doc.querySelectorAll('p');
      let isSrv3Format = subtitleNodes.length > 0;

      // Fallback to standard format (<text> tags with start/dur attributes)
      if (!isSrv3Format) {
        subtitleNodes = doc.querySelectorAll('text');
      }

      const entries = [];
      let index = 0;

      subtitleNodes.forEach((node, i) => {
        let start, duration;

        if (isSrv3Format) {
          // srv3 format: <p t="2300" d="2933">text</p>
          start = parseFloat(node.getAttribute('t') || '0'); // Already in milliseconds
          duration = parseFloat(node.getAttribute('d') || '0'); // Already in milliseconds
        } else {
          // Standard format: <text start="2.3" dur="2.933">text</text>
          start = parseFloat(node.getAttribute('start') || '0') * 1000; // Convert to ms
          duration = parseFloat(node.getAttribute('dur') || '0') * 1000; // Convert to ms
        }

        const end = start + duration;

        // Decode HTML entities (preserve original formatting)
        let text = node.textContent;
        text = this._decodeHTMLEntities(text).trim();

        if (text) {
          entries.push(new SubtitleEntry({ index: index++, start, end, text }));
        }
      });

      return entries;
    } catch (error) {
      console.error('[Helios YouTube] Error parsing captions:', error);
      return [];
    }
  }

  /**
   * Decode HTML entities (matches asbplayer's approach)
   * Properly handles HTML tags including ruby text (important for Japanese)
   * @param {string} text
   * @returns {string}
   */
  _decodeHTMLEntities(text) {
    const helperElement = document.createElement('div');
    helperElement.innerHTML = text;

    // Remove <rt> element content (ruby text for furigana)
    // This prevents furigana from appearing in the subtitle text
    const rubyTextElements = [...helperElement.getElementsByTagName('rt')];
    for (const rubyTextElement of rubyTextElements) {
      rubyTextElement.remove();
    }

    // Extract clean text content, removing all HTML tags
    return helperElement.textContent || helperElement.innerText || '';
  }

  /**
   * Auto-load YouTube subtitles in preferred language
   * @param {string} preferredLanguage - Language code (e.g., 'en', 'ja', 'zh')
   */
  async autoLoadSubtitles(preferredLanguage = 'en') {
    const tracks = await this.getAvailableTracks();

    if (tracks.length === 0) {
      console.warn('[Helios YouTube] No subtitle tracks available for this video');

      // Clear existing subtitles from video binding and sidebar
      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        binding.loadSubtitles([]);  // Load empty array to clear
      }

      return false;
    }

    // Find preferred language track (exact match, manual)
    let selectedTrack = tracks.find(t => t.language === preferredLanguage && !t.isAutoGenerated);

    // Fallback to auto-generated with exact match
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => t.language === preferredLanguage);
    }

    // Fallback to partial match (e.g., 'zh' matches 'zh-Hans' or 'zh-Hant')
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => t.language.startsWith(preferredLanguage) && !t.isAutoGenerated);
    }

    // Fallback to partial match auto-generated
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => t.language.startsWith(preferredLanguage));
    }

    // NO FALLBACK - if no matching language, clear existing subtitles
    if (!selectedTrack) {
      // Clear existing subtitles from video binding and sidebar
      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        binding.loadSubtitles([]);  // Load empty array to clear
      }

      return false;
    }

    try {
      const entries = await this.loadTrack(selectedTrack.url);

      // Load into video binding
      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        binding.loadSubtitles(entries);
        return true;
      } else {
        console.error('[Helios YouTube] No video binding found');
      }
    } catch (error) {
      console.error('[Helios YouTube] Failed to auto-load subtitles:', error);
      return false;
    }

    return false;
  }
}
