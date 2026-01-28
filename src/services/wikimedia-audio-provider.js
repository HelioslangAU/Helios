/**
 * Wikimedia Commons / Wiktionary Audio Provider
 * Based on Yomitan's proven implementation
 *
 * Uses background script to bypass CORS restrictions
 * Fetches native speaker pronunciations from Lingua Libre and Wiktionary
 */
class WikimediaAudioProvider {
  constructor() {
    this.cache = new Map();

    // Language code mappings (ISO 639-1 to ISO 639-3 for Lingua Libre)
    this.iso639_3Map = {
      'zh': 'zho',  // Chinese (Mandarin)
      'ja': 'jpn',  // Japanese
      'ko': 'kor',  // Korean
      'en': 'eng',  // English
      'es': 'spa',  // Spanish
      'fr': 'fra',  // French
      'de': 'deu',  // German
      'ru': 'rus',  // Russian
      'ar': 'ara',  // Arabic
      'it': 'ita',  // Italian
      'pt': 'por',  // Portuguese
    };

    // ISO 639-1 codes for Wiktionary
    this.iso639_1Map = {
      'zh': 'zh',
      'ja': 'ja',
      'ko': 'ko',
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'ru': 'ru',
      'ar': 'ar',
      'it': 'it',
      'pt': 'pt',
    };
  }

  /**
   * Get audio URL for a word from Wikimedia sources
   * @param {string} word - The word to find pronunciation for
   * @param {string} language - Language code (e.g., 'zh', 'en', 'ja')
   * @returns {Promise<Object|null>} Audio info {url, filename, source, type} or null
   */
  async getAudioUrl(word, language = 'zh') {
    const cacheKey = `${language}-${word}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Try Lingua Libre first (highest quality native speaker recordings)
      let audioInfo = await this.searchLinguaLibre(word, language);

      if (audioInfo) {
        this.cache.set(cacheKey, audioInfo);
        return audioInfo;
      }

      // Try Wiktionary audio files
      audioInfo = await this.searchWiktionary(word, language);

      if (audioInfo) {
        this.cache.set(cacheKey, audioInfo);
        return audioInfo;
      }

      // Nothing found
      this.cache.set(cacheKey, null);
      return null;

    } catch (error) {
      console.error('[Wikimedia Audio] Error fetching audio:', error);
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Search Lingua Libre for audio files
   * Uses background script to avoid CORS issues
   */
  async searchLinguaLibre(word, language) {
    try {
      const iso639_3 = this.iso639_3Map[language];
      if (!iso639_3) {
        console.log(`[Wikimedia Audio] No ISO 639-3 code for language: ${language}`);
        return null;
      }

      console.log(`[Wikimedia Audio] Searching Lingua Libre for: ${word} (${iso639_3})`);

      // Send request to background script to bypass CORS
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_WIKIMEDIA_AUDIO',
        source: 'lingua-libre',
        word: word,
        language: language,
        iso639_3: iso639_3
      });

      if (response && response.success && response.data) {
        console.log(`[Wikimedia Audio] ✅ Found Lingua Libre audio for: ${word}`);
        return {
          url: response.data.url,
          filename: response.data.filename,
          source: 'wikimedia-lingua-libre',
          type: 'native'
        };
      }

      return null;

    } catch (error) {
      console.error('[Wikimedia Audio] Lingua Libre search error:', error);
      return null;
    }
  }

  /**
   * Search Wiktionary for audio files
   * Uses background script to avoid CORS issues
   */
  async searchWiktionary(word, language) {
    try {
      const iso = this.iso639_1Map[language];
      if (!iso) {
        console.log(`[Wikimedia Audio] No ISO 639-1 code for language: ${language}`);
        return null;
      }

      console.log(`[Wikimedia Audio] Searching Wiktionary for: ${word} (${iso})`);

      // Send request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_WIKIMEDIA_AUDIO',
        source: 'wiktionary',
        word: word,
        language: language,
        iso: iso
      });

      if (response && response.success && response.data) {
        console.log(`[Wikimedia Audio] ✅ Found Wiktionary audio for: ${word}`);
        return {
          url: response.data.url,
          filename: response.data.filename,
          source: 'wikimedia-wiktionary',
          type: 'native'
        };
      }

      return null;

    } catch (error) {
      console.error('[Wikimedia Audio] Wiktionary search error:', error);
      return null;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize() {
    return this.cache.size;
  }
}

// Initialize global instance
if (!window.WikimediaAudioProvider) {
  window.WikimediaAudioProvider = new WikimediaAudioProvider();
}
