/**
 * Language Registry
 * 
 * Central registry for managing language adapters and switching between languages.
 * Provides a unified interface for language-specific operations.
 */
class LanguageRegistry {
  constructor() {
    this.adapters = new Map();
    this.currentAdapter = null;
    this.currentLanguageCode = null;
    this.eventListeners = new Map();
  }

  /**
   * Register a language adapter
   * @param {string} languageCode - ISO 639-1 language code (e.g., 'zh', 'en', 'es')
   * @param {BaseLanguageAdapter} adapter - Language adapter instance
   */
  register(languageCode, adapter) {
    if (!adapter || typeof adapter.isTargetCharacter !== 'function') {
      throw new Error('Invalid adapter: must extend BaseLanguageAdapter');
    }

    this.adapters.set(languageCode, adapter);
    console.log(`Registered language adapter: ${languageCode} (${adapter.getDisplayName()})`);
  }

  /**
   * Set the active language
   * @param {string} languageCode - Language code to switch to
   * @returns {boolean} - True if language was switched successfully
   */
  setLanguage(languageCode) {
    if (!this.adapters.has(languageCode)) {
      console.error(`Language adapter not found: ${languageCode}`);
      return false;
    }

    const previousLanguage = this.currentLanguageCode;
    this.currentLanguageCode = languageCode;
    this.currentAdapter = this.adapters.get(languageCode);

    console.log(`Switched to language: ${languageCode} (${this.currentAdapter.getDisplayName()})`);

    // Emit language change event
    this.emit('languageChanged', {
      previousLanguage,
      currentLanguage: languageCode,
      adapter: this.currentAdapter
    });

    return true;
  }

  /**
   * Get the current language adapter
   * @returns {BaseLanguageAdapter|null} - Current adapter or null if none set
   */
  getAdapter() {
    return this.currentAdapter;
  }

  /**
   * Get the current language code
   * @returns {string|null} - Current language code or null if none set
   */
  getCurrentLanguage() {
    return this.currentLanguageCode;
  }
  

  /**
   * Get all registered language adapters
   * @returns {Map} - Map of language codes to adapters
   */
  getAllAdapters() {
    return new Map(this.adapters);
  }

  /**
   * Get available language codes
   * @returns {Array<string>} - Array of registered language codes
   */
  getAvailableLanguages() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get language information
   * @param {string} languageCode - Language code to get info for
   * @returns {Object|null} - Language config or null if not found
   */
  getLanguageInfo(languageCode) {
    const adapter = this.adapters.get(languageCode);
    return adapter ? adapter.getConfig() : null;
  }

  getScanResolution(languageCode) {
    const adapter = this.adapters.get(languageCode);
    return adapter ? adapter.getConfig().scanResolution : null;
  }

  getCaseSensitive(languageCode) {
    const adapter = this.adapters.get(languageCode);
    return adapter ? adapter.getConfig().caseSensitive : false;
  }

  /**
   * Check if a language is registered
   * @param {string} languageCode - Language code to check
   * @returns {boolean} - True if language is registered
   */
  hasLanguage(languageCode) {
    return this.adapters.has(languageCode);
  }

  /**
   * Get dictionary path for current language
   * @returns {string|null} - Dictionary path or null if no language set
   */
  getDictionaryPath() {
    return this.currentAdapter ? this.currentAdapter.getDictionaryPath() : null;
  }

  /**
   * Check if character belongs to current language
   * @param {string} char - Character to check
   * @returns {boolean} - True if character belongs to current language
   */
  isTargetCharacter(char) {
    return this.currentAdapter ? this.currentAdapter.isTargetCharacter(char) : false;
  }

  /**
   * Extract words from text using current language
   * @param {string} text - Text to process
   * @param {Object} dictionary - Dictionary to validate against
   * @returns {Promise<Array>} - Array of word objects
   */
  async extractWords(text, dictionary) {
    if (!this.currentAdapter) return [];
    const result = this.currentAdapter.extractWords(text, dictionary);
    // Handle both sync and async adapters
    return result instanceof Promise ? await result : result;
  }

  /**
   * Parse dictionary using current language
   * @param {string} dictionaryText - Raw dictionary text
   * @returns {Object} - Parsed dictionary
   */
  parseDictionary(dictionaryText) {
    return this.currentAdapter ? this.currentAdapter.parseDictionary(dictionaryText) : {};
  }

  /**
   * Get pronunciation for word using current language
   * @param {string} word - Word to get pronunciation for
   * @param {Array} entries - Dictionary entries
   * @returns {string|null} - Pronunciation or null
   */
  getPronunciation(word, entries) {
    return this.currentAdapter ? this.currentAdapter.getPronunciation(word, entries) : null;
  }

  /**
   * Get sentence boundary regex for current language
   * @returns {RegExp|null} - Sentence boundary regex or null
   */
  getSentenceBoundary() {
    return this.currentAdapter ? this.currentAdapter.getSentenceBoundary() : null;
  }


  /**
   * Check if text contains current language characters
   * @param {string} text - Text to check
   * @returns {boolean} - True if text contains target language characters
   */
  containsTargetLanguage(text) {
    return this.currentAdapter ? this.currentAdapter.containsTargetLanguage(text) : false;
  }

  

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Initialize default language adapters
   */
  initializeDefaultAdapters() {
    // Register Chinese adapter
    if (typeof ChineseLanguageAdapter !== 'undefined') {
      this.register('zh', new ChineseLanguageAdapter());
    }

    // Register English adapter
    if (typeof EnglishLanguageAdapter !== 'undefined') {
      this.register('en', new EnglishLanguageAdapter());
    }

    // Register Spanish adapter
    if (typeof SpanishLanguageAdapter !== 'undefined') {
      this.register('es', new SpanishLanguageAdapter());
    }

    // Register French adapter
    if (typeof FrenchLanguageAdapter !== 'undefined') {
      this.register('fr', new FrenchLanguageAdapter());
    }

    console.log(`Initialized ${this.adapters.size} language adapters`);
  }

  /**
   * Get language display names for UI
   * @returns {Array<Object>} - Array of {code, name, displayName} objects
   */
  getLanguageOptions() {
    const options = [];
    for (const [code, adapter] of this.adapters) {
      const config = adapter.getConfig();
      options.push({
        code,
        name: config.name,
        displayName: config.displayName || config.name
      });
    }
    return options.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Validate language code
   * @param {string} languageCode - Language code to validate
   * @returns {boolean} - True if valid language code
   */
  isValidLanguageCode(languageCode) {
    return typeof languageCode === 'string' && 
           languageCode.length === 2 && 
           this.adapters.has(languageCode);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LanguageRegistry;
} else {
  window.LanguageRegistry = LanguageRegistry;
}
