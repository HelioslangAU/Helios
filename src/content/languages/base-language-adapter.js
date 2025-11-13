/**
 * Base Language Adapter - Abstract interface for language-specific implementations
 * 
 * All language adapters must extend this class and implement its abstract methods.
 * This provides a unified interface for character detection, word segmentation,
 * dictionary parsing, and pronunciation handling across different languages.
 */
class BaseLanguageAdapter {
  static requiredConfig = {
    code: 'string',         // ISO 639-1 language code
    name: 'string',         // Language name
    displayName: 'string',  // Display name for UI
    maxWordLength: 'number',
    hasSpaces: 'boolean',
    script: 'string',       // writing system (e.g., 'latin', 'han', 'cyrillic')
    direction: 'string',    // text direction ('ltr' or 'rtl')
    scanResolution: 'string', // 'word' or 'character'
    caseSensitive: 'boolean',
    characterRanges: 'array', // Array of {start, end} Unicode ranges
    wordBoundaryRegex: 'regexp',
    sentenceBoundaryRegex: 'regexp'
  };

  constructor() {
    if (this.constructor === BaseLanguageAdapter) {
      throw new Error('BaseLanguageAdapter is abstract and cannot be instantiated directly');
    }

    // Initialize base properties
    this.config = {};
  }

  /**
   * Validate configuration object against required properties
   * @param {Object} config - Configuration object to validate
   * @throws {Error} If required properties are missing or of wrong type
   */
  validateConfig(config) {
    for (const [key, type] of Object.entries(BaseLanguageAdapter.requiredConfig)) {
      if (!(key in config)) {
        throw new Error(`Missing required config property: ${key}`);
      }

      const value = config[key];
      switch (type) {
        case 'string':
          if (typeof value !== 'string') {
            throw new Error(`${key} must be a string`);
          }
          break;
        case 'number':
          if (typeof value !== 'number') {
            throw new Error(`${key} must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            throw new Error(`${key} must be a boolean`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            throw new Error(`${key} must be an array`);
          }
          break;
        case 'regexp':
          if (!(value instanceof RegExp)) {
            throw new Error(`${key} must be a RegExp`);
          }
          break;
      }
    }
  }

  /**
   * Check if a character belongs to this language
   * @param {string} char - The character to check
   * @returns {boolean} - True if character belongs to this language
   */
  isTargetCharacter(char) {
    throw new Error('isTargetCharacter() must be implemented by language adapter');
  }

  /**
   * Extract words from text with their positions
   * @param {string} text - The text to process
   * @param {Object} dictionary - The dictionary to validate against
   * @returns {Array} - Array of {word, start, end} objects
   */
  extractWords(text, dictionary) {
    throw new Error('extractWords() must be implemented by language adapter');
  }

  /**
   * Parse language-specific dictionary format to unified structure
   * @param {string} dictionaryText - Raw dictionary text
   * @returns {Object} - Unified dictionary format: {word: [{definition, pronunciation, ...}]}
   */
  parseDictionary(dictionaryText) {
    throw new Error('parseDictionary() must be implemented by language adapter');
  }

  /**
   * Get pronunciation for a word from dictionary entries
   * @param {string} word - The word to get pronunciation for
   * @param {Array} entries - Dictionary entries for the word
   * @returns {string|null} - Pronunciation string or null if not found
   */
  getPronunciation(word, entries) {
    throw new Error('getPronunciation() must be implemented by language adapter');
  }

  /**
   * Get regex pattern for sentence boundary detection
   * @returns {RegExp} - Regex for splitting sentences
   */
  getSentenceBoundary() {
    throw new Error('getSentenceBoundary() must be implemented by language adapter');
  }

  /**
   * Get language configuration metadata
   * @returns {Object} - Language config: {code, name, maxWordLength, hasSpaces, etc.}
   */
  /**
   * Set the language configuration
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    this.validateConfig(config);
    this.config = { ...config };
  }

  /**
   * Get the language configuration
   * @returns {Object} Language configuration
   */
  getConfig() {
    if (!this.config || Object.keys(this.config).length === 0) {
      throw new Error('Configuration not set. Call setConfig in your language adapter constructor.');
    }
    return this.config;
  }

  /**
   * Get scan resolution (word or character level)
   * @returns {string} Scan resolution
   */
  getScanResolution() {
    return this.getConfig().scanResolution;
  }

  /**
   * Get case sensitivity setting
   * @returns {boolean} Whether the language is case sensitive
   */
  getCaseSensitive() {
    return this.getConfig().caseSensitive;
  }

  /**
   * Check if text contains characters from this language
   * @param {string} text - Text to check
   * @returns {boolean} - True if text contains target language characters
   */
  containsTargetLanguage(text) {
    if (!text) return false;
    for (let i = 0; i < text.length; i++) {
      if (this.isTargetCharacter(text[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get dictionary file path for this language
   * @returns {string} - Path to dictionary file
   */
  getDictionaryPath() {
    const config = this.getConfig();
    return `dictionaries/${config.code}-dict.json`;
  }

  /**
   * Validate word against dictionary
   * @param {string} word - Word to validate
   * @param {Object} dictionary - Dictionary to check against
   * @returns {boolean} - True if word exists in dictionary
   */
  isValidWord(word, dictionary) {
    return dictionary && dictionary[word] && dictionary[word].length > 0;
  }

  /**
   * Get display name for this language
   * @returns {string} - Human-readable language name
   */
  getDisplayName() {
    return this.getConfig().name;
  }

  /**
   * Get language code (ISO 639-1)
   * @returns {string} - Two-letter language code
   */
  getLanguageCode() {
    return this.getConfig().code;
  }


}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseLanguageAdapter;
} else {
  window.BaseLanguageAdapter = BaseLanguageAdapter;
}