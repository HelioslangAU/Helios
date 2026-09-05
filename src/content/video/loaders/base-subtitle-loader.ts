import type { VideoDetector } from '@/content/video/core/video-detector';
import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Base class for platform-specific subtitle loaders
 * Provides common functionality and retry logic
 */
export class BasePlatformSubtitleLoader {
  videoDetector: VideoDetector;
  pageScriptInjected: boolean;
  pendingRequest: { resolve: (result: any) => void } | null;
  pendingContentRequest: { resolve: (result: any) => void } | null;

  constructor(videoDetector: VideoDetector) {
    this.videoDetector = videoDetector;
    this.pageScriptInjected = false;
    this.pendingRequest = null;
    this.pendingContentRequest = null;
  }

  /**
   * Check if current page matches this platform
   * Must be implemented by subclasses
   */
  isPlatformPage(): boolean {
    throw new Error('isPlatformPage() must be implemented by subclass');
  }

  /**
   * Get platform name (for logging)
   * Must be implemented by subclasses
   */
  getPlatformName(): string {
    throw new Error('getPlatformName() must be implemented by subclass');
  }

  /**
   * Inject platform-specific page script
   * Must be implemented by subclasses
   */
  _injectPageScript(): void {
    throw new Error('_injectPageScript() must be implemented by subclass');
  }

  /**
   * Setup platform-specific event listeners
   * Must be implemented by subclasses
   */
  _setupEventListeners(): void {
    throw new Error('_setupEventListeners() must be implemented by subclass');
  }

  /**
   * Get available subtitle tracks
   * Must be implemented by subclasses
   */
  async getAvailableTracks(): Promise<any[]> {
    throw new Error('getAvailableTracks() must be implemented by subclass');
  }

  /**
   * Load subtitle track with automatic retry logic
   * @param track - Track object or URL
   * @param retryCount - Current retry attempt
   */
  async loadTrack(track: any, retryCount: number = 0): Promise<SubtitleEntry[]> {
    const MAX_RETRIES = 2;
    const platformName = this.getPlatformName();

    try {
      console.log(`[Helios ${platformName}] Loading track:`, track.language || track, retryCount > 0 ? `(retry ${retryCount})` : '');

      // Call platform-specific load implementation
      const entries = await this._loadTrackImpl(track);

      if (!entries || entries.length === 0) {
        throw new Error('No subtitle entries returned');
      }

      console.log(`[Helios ${platformName}] Parsed entries:`, entries.length);
      return entries;

    } catch (error) {
      console.error(`[Helios ${platformName}] Failed to load track:`, error);

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        const retryDelay = retryCount === 0 ? 2000 : 3000;
        console.log(`[Helios ${platformName}] Error occurred, retrying in ${retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.loadTrack(track, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Platform-specific track loading implementation
   * Must be implemented by subclasses
   * @param track - Track object or URL
   */
  async _loadTrackImpl(track: any): Promise<SubtitleEntry[]> {
    throw new Error('_loadTrackImpl() must be implemented by subclass');
  }

  /**
   * Parse subtitle content with error handling
   * @param content - Raw subtitle content
   * @param format - Format type ('xml', 'dfxp', 'vtt', etc.)
   */
  parseSubtitles(content: string, format: string = 'xml'): SubtitleEntry[] {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, format === 'xml' ? 'text/xml' : 'text/html');

      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.error(`[Helios ${this.getPlatformName()}] Parsing error:`, parserError.textContent);
        return [];
      }

      // Call platform-specific parser
      return this._parseSubtitleContent(doc, content);

    } catch (error) {
      console.error(`[Helios ${this.getPlatformName()}] Error parsing subtitles:`, error);
      return [];
    }
  }

  /**
   * Platform-specific subtitle parsing
   * Must be implemented by subclasses
   * @param doc - Parsed XML/HTML document
   * @param rawContent - Raw content string
   */
  _parseSubtitleContent(doc: Document, rawContent: string): SubtitleEntry[] {
    throw new Error('_parseSubtitleContent() must be implemented by subclass');
  }

  /**
   * Clean text by removing control characters and formatting marks
   * Common utility for all platforms
   * @param text - Text to clean
   */
  cleanText(text: string): string {
    if (!text) return '';

    return text
      // Trim first
      .trim()

      // Bidirectional text markers
      .replace(/\u200E/g, '') // LRM (Left-to-Right Mark)
      .replace(/\u200F/g, '') // RLM (Right-to-Left Mark)
      .replace(/\u202A/g, '') // LRE (Left-to-Right Embedding)
      .replace(/\u202B/g, '') // RLE (Right-to-Left Embedding)
      .replace(/\u202C/g, '') // PDF (Pop Directional Formatting)
      .replace(/\u202D/g, '') // LRO (Left-to-Right Override)
      .replace(/\u202E/g, '') // RLO (Right-to-Left Override)

      // Zero-width characters
      .replace(/\u200B/g, '') // Zero Width Space
      .replace(/\u200C/g, '') // Zero Width Non-Joiner
      .replace(/\u200D/g, '') // Zero Width Joiner
      .replace(/\uFEFF/g, '') // Zero Width No-Break Space (BOM)

      // Other invisible/control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // C0 and C1 control codes

      // Normalize whitespace
      .replace(/\s+/g, ' ')

      // Final trim
      .trim();
  }

  /**
   * Parse timecode to milliseconds
   * Supports multiple formats: HH:MM:SS.mmm, HH:MM:SS:mmm, seconds.milliseconds
   * @param timeCode - Time code string
   */
  parseTimeCode(timeCode: string): number | null {
    if (!timeCode) return null;

    try {
      // Check if it's already in milliseconds (just a number)
      if (/^\d+$/.test(timeCode)) {
        return parseInt(timeCode);
      }

      // Format: HH:MM:SS.mmm or HH:MM:SS:mmm
      if (timeCode.includes(':')) {
        const parts = timeCode.split(':');
        let hours = 0, minutes = 0, seconds = 0;

        if (parts.length === 3) {
          hours = parseInt(parts[0]);
          minutes = parseInt(parts[1]);
          // Handle both . and : as decimal separator
          seconds = parseFloat(parts[2].replace(':', '.'));
        } else if (parts.length === 2) {
          minutes = parseInt(parts[0]);
          seconds = parseFloat(parts[1].replace(':', '.'));
        }

        return (hours * 3600 + minutes * 60 + seconds) * 1000;
      }

      // Format: seconds.milliseconds
      if (timeCode.includes('.')) {
        return Math.floor(parseFloat(timeCode) * 1000);
      }

      // Fallback: try to parse as float seconds
      return Math.floor(parseFloat(timeCode) * 1000);

    } catch (error) {
      console.error(`[Helios ${this.getPlatformName()}] Error parsing timecode:`, timeCode, error);
      return null;
    }
  }

  /**
   * Make async request with timeout
   * @param requestFn - Function that dispatches request
   * @param eventName - Event name to listen for response
   * @param timeout - Timeout in milliseconds
   */
  async makeRequestWithTimeout(requestFn: () => void, eventName: string, timeout: number = 15000): Promise<any> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequest) {
          console.warn(`[Helios ${this.getPlatformName()}] Timeout waiting for ${eventName}`);
          this.pendingRequest = null;
          resolve(null);
        }
      }, timeout);

      this.pendingRequest = {
        resolve: (result: any) => {
          clearTimeout(timeoutId);
          resolve(result);
        }
      };

      requestFn();
    });
  }

  /**
   * Inject script helper
   * @param scriptPath - Path to script file
   * @param onLoad - Optional load callback
   * @param onError - Optional error callback
   */
  injectScript(scriptPath: string, onLoad?: () => void, onError?: () => void): boolean {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(scriptPath);

      if (onLoad) {
        script.onload = () => {
          script.remove();
          onLoad();
        };
      }

      if (onError) {
        script.onerror = () => {
          console.error(`[Helios ${this.getPlatformName()}] Failed to inject script:`, scriptPath);
          if (onError) onError();
        };
      }

      (document.head || document.documentElement).appendChild(script);
      return true;

    } catch (error) {
      console.error(`[Helios ${this.getPlatformName()}] Error injecting script:`, error);
      return false;
    }
  }
}
