// Pronunciation Manager for Chinese Language Learning Extension
class PronunciationManager {
  constructor() {
    this.audioCache = new Map();
    this.isPlaying = false;
    this.currentAudio = null;

    // Audio source configuration
    this.sources = {
      chinesepod101: {
        name: "ChinesePod101",
        baseUrl:
          "https://assets.languagepod101.com/dictionary/chinese/audiomp3.php",
        priority: 1,
      },
      forvo: {
        name: "Forvo",
        baseUrl:
          "https://apifree.forvo.com/action/word-pronunciations/format/json/word",
        priority: 2,
        requiresKey: true,
      },
    };

    // Fallback methods
    this.fallbacks = ["google-translate", "web-speech"];

    console.log("🔊 PronunciationManager initialized");
  }

  /**
   * Get audio URL for a Chinese word/character
   * @param {string} word - Chinese character or word
   * @param {string} language - Language code (default: 'zh')
   * @returns {Promise<string|null>} Audio URL or null if not found
   */
  async getAudioUrl(word, language = "zh") {
    if (!word || word.trim() === "") {
      console.warn("🔊 No word provided for audio lookup");
      return null;
    }

    const cacheKey = `${language}-${word}`;

    // Check cache first
    if (this.audioCache.has(cacheKey)) {
      console.log(`🔊 Audio URL found in cache for: ${word}`);
      return this.audioCache.get(cacheKey);
    }

    // Try ChinesePod101 first
    let audioUrl = await this.tryChinesePod101(word);

    // Try other sources if ChinesePod101 fails
    if (!audioUrl) {
      audioUrl = await this.tryGoogleTranslate(word, language);
    }

    // Cache the result (even if null to avoid repeated failed requests)
    this.audioCache.set(cacheKey, audioUrl);

    // Clean cache if it gets too large
    if (this.audioCache.size > 1000) {
      this.cleanCache();
    }

    return audioUrl;
  }

  /**
   * Try to get audio from ChinesePod101
   * @param {string} word - Chinese word
   * @returns {Promise<string|null>} Audio URL or null
   */
  async tryChinesePod101(word) {
    try {
      // ChinesePod101 URL pattern - try multiple variations
      const urls = [
        `${this.sources.chinesepod101.baseUrl}?word=${encodeURIComponent(
          word
        )}`,
        `https://assets.languagepod101.com/dictionary/chinese/audiomp3.php?kana=${encodeURIComponent(
          word
        )}`,
        `https://assets.languagepod101.com/dictionary/chinese/audio/${encodeURIComponent(
          word
        )}.mp3`,
      ];

      console.log(`🔊 Trying ChinesePod101 for: ${word}`);

      // Try each URL pattern
      for (const url of urls) {
        try {
          // For ChinesePod101, we'll optimistically return the URL
          // since CORS prevents us from testing it directly
          console.log(`🔊 Using ChinesePod101 URL for: ${word}`);
          return url;
        } catch (error) {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.log(`🔊 ChinesePod101 failed for ${word}:`, error.message);
      return null;
    }
  }

  /**
   * Try to get audio from Google Translate (unofficial)
   * @param {string} word - Chinese word
   * @param {string} language - Language code
   * @returns {Promise<string|null>} Audio URL or null
   */
  async tryGoogleTranslate(word, language = "zh") {
    try {
      // Google Translate TTS URL pattern
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${language}&client=tw-ob&q=${encodeURIComponent(
        word
      )}`;

      console.log(`🔊 Trying Google Translate for: ${word}`);

      // Test the URL
      const response = await fetch(url, { method: "HEAD" });

      if (response.ok) {
        console.log(`🔊 Google Translate audio found for: ${word}`);
        return url;
      } else {
        console.log(
          `🔊 Google Translate failed for ${word}: ${response.status}`
        );
        return null;
      }
    } catch (error) {
      console.log(`🔊 Google Translate failed for ${word}:`, error.message);
      return null;
    }
  }

  /**
   * Play pronunciation for a word
   * @param {string} word - Chinese word to pronounce
   * @param {string} language - Language code
   * @returns {Promise<boolean>} Success status
   */
  async playPronunciation(word, language = "zh") {
    try {
      console.log(`🔊 Playing pronunciation for: ${word}`);

      // Stop any currently playing audio
      this.stopCurrentAudio();

      // Get audio URL
      let audioUrl = await this.getAudioUrl(word, language);

      // Fallback to Web Speech API if no URL found
      if (!audioUrl) {
        console.log(`🔊 No audio URL found, using Web Speech API fallback`);
        return this.playWebSpeech(word, language);
      }

      // Create and play audio
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.crossOrigin = "anonymous"; // Try to avoid CORS issues

      // Set up event listeners
      this.currentAudio.addEventListener("loadstart", () => {
        console.log(`🔊 Loading audio for: ${word}`);
        this.isPlaying = true;
      });

      this.currentAudio.addEventListener("canplay", () => {
        console.log(`🔊 Audio ready for: ${word}`);
      });

      this.currentAudio.addEventListener("ended", () => {
        console.log(`🔊 Audio finished for: ${word}`);
        this.isPlaying = false;
        this.currentAudio = null;
      });

      this.currentAudio.addEventListener("error", (e) => {
        console.warn(`🔊 Audio error for ${word}:`, e);
        this.isPlaying = false;
        this.currentAudio = null;

        // Fallback to Web Speech API
        this.playWebSpeech(word, language);
      });

      // Play the audio
      await this.currentAudio.play();
      return true;
    } catch (error) {
      console.error(`🔊 Error playing pronunciation for ${word}:`, error);
      this.isPlaying = false;
      this.currentAudio = null;

      // Fallback to Web Speech API
      return this.playWebSpeech(word, language);
    }
  }

  /**
   * Fallback to Web Speech API
   * @param {string} word - Word to pronounce
   * @param {string} language - Language code
   * @returns {boolean} Success status
   */
  playWebSpeech(word, language = "zh") {
    try {
      if (!("speechSynthesis" in window)) {
        console.warn("🔊 Web Speech API not supported");
        return false;
      }

      console.log(`🔊 Using Web Speech API for: ${word}`);

      // Stop any current speech
      speechSynthesis.cancel();

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = language === "zh" ? "zh-CN" : language;
      utterance.rate = 0.8; // Slightly slower for better clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to find a Chinese voice
      const voices = speechSynthesis.getVoices();
      const chineseVoice = voices.find(
        (voice) =>
          voice.lang.startsWith("zh") ||
          voice.name.toLowerCase().includes("chinese") ||
          voice.name.toLowerCase().includes("mandarin")
      );

      if (chineseVoice) {
        utterance.voice = chineseVoice;
        console.log(`🔊 Using Chinese voice: ${chineseVoice.name}`);
      }

      // Event listeners
      utterance.addEventListener("start", () => {
        console.log(`🔊 Web Speech started for: ${word}`);
        this.isPlaying = true;
      });

      utterance.addEventListener("end", () => {
        console.log(`🔊 Web Speech finished for: ${word}`);
        this.isPlaying = false;
      });

      utterance.addEventListener("error", (e) => {
        console.error(`🔊 Web Speech error for ${word}:`, e);
        this.isPlaying = false;
      });

      // Speak
      speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error(`🔊 Web Speech API error for ${word}:`, error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * Stop currently playing audio
   */
  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    this.isPlaying = false;
  }

  /**
   * Check if audio is currently playing
   * @returns {boolean} Playing status
   */
  getPlayingStatus() {
    return this.isPlaying;
  }

  /**
   * Clean cache when it gets too large
   */
  cleanCache() {
    if (this.audioCache.size > 500) {
      // Remove oldest entries (simple FIFO)
      const entries = Array.from(this.audioCache.entries());
      const toKeep = entries.slice(-500); // Keep last 500 entries

      this.audioCache.clear();
      toKeep.forEach(([key, value]) => {
        this.audioCache.set(key, value);
      });

      console.log("🔊 Audio cache cleaned");
    }
  }

  /**
   * Clear all cached audio URLs
   */
  clearCache() {
    this.audioCache.clear();
    console.log("🔊 Audio cache cleared");
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.audioCache.size,
      maxSize: 1000,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
    };
  }

  /**
   * Preload audio for a word (optional optimization)
   * @param {string} word - Word to preload
   * @param {string} language - Language code
   */
  async preloadAudio(word, language = "zh") {
    try {
      await this.getAudioUrl(word, language);
      console.log(`🔊 Preloaded audio for: ${word}`);
    } catch (error) {
      console.warn(`🔊 Failed to preload audio for ${word}:`, error);
    }
  }
}
