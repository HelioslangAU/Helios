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

  /**
   * Detect if a definition is a variant pattern (e.g., "erhua variant of", "non standard spelling")
   * @param {string} definition - Definition text to check
   * @returns {Object|null} - Object with {pattern, baseWords} or null if not a variant
   */
  detectVariantPattern(definition) {
    if (!definition || typeof definition !== 'string') {
      return null;
    }

    // Common variant patterns across languages
    const variantPatterns = [
      // Chinese variants - handle format "erhua variant of 等一會|等一会[deng3 yi1 hui4]"
      /erhua\s+variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      // General variants
      /(?:non\s*)?standard\s*(?:spelling|variant)\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /old\s+variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /archaic\s+variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /ancient\s+variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /obsolete\s+variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /classical\s+variant\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      // Alternative spellings
      /alternative\s+spelling\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      /alternate\s+spelling\s+of\s+(.+?)(?:\s*\[|;|$)/i,
      // Other common patterns
      /see\s+also\s*[:：]?\s*(.+?)(?:\s*\[|;|$)/i,
    ];

    for (const pattern of variantPatterns) {
      const match = definition.match(pattern);
      if (match && match[1]) {
        // Extract base word(s) - could be multiple forms separated by |
        const baseWordsText = match[1].trim();
        
        // For Chinese, handle format like "等一會|等一会"
        // For other languages, just extract the word(s)
        const baseWords = this.extractBaseWords(baseWordsText);
        
        if (baseWords.length > 0) {
          return {
            pattern: pattern.source,
            baseWords: baseWords,
            fullMatch: match[0]
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract base words from variant definition text
   * Handles formats like "等一會|等一会" (Chinese) or simple words
   * @param {string} baseWordsText - Text containing base word(s)
   * @returns {Array<string>} - Array of base words
   */
  extractBaseWords(baseWordsText) {
    if (!baseWordsText) return [];

    // For Chinese: handle format "等一會|等一会[deng3 yi1 hui4]" or "等一會|等一会"
    // Extract the simplified form (second one if pipe exists) or the whole thing
    if (baseWordsText.includes('|')) {
      const parts = baseWordsText.split('|');
      // Try simplified form first (usually second), then traditional
      const words = [];
      for (const part of parts) {
        // Remove pinyin in brackets [deng3 yi1 hui4]
        const cleanPart = part.replace(/\s*\[.*?\]/g, '').trim();
        if (cleanPart) {
          words.push(cleanPart);
        }
      }
      return words.length > 0 ? words : [];
    }

    // For other languages or simple format, remove pinyin/pronunciation and clean
    // Remove anything in brackets like [pronunciation] or [pinyin]
    const cleaned = baseWordsText.replace(/\s*\[.*?\]/g, '').trim();
    
    if (cleaned) {
      return [cleaned];
    }

    return [];
  }

  /**
   * Enhance variant definition by appending base variant's definition
   * @param {string} definition - Original variant definition
   * @param {Object} dictionary - Dictionary object to look up base variant
   * @param {Function} getDefinitionAsync - Async function to get definition if not in dictionary
   * @returns {Promise<string>} - Enhanced definition with base variant's definition appended
   */
  async enhanceVariantDefinition(definition, dictionary, getDefinitionAsync = null) {
    if (!definition) return definition;

    const variantInfo = this.detectVariantPattern(definition);
    if (!variantInfo || variantInfo.baseWords.length === 0) {
      return definition;
    }

    // Try each base word until we find a definition
    for (const baseWord of variantInfo.baseWords) {
      let baseEntries = null;

      // Check dictionary directly - try both normalized and original forms
      const normalizedBaseWord = this.getCaseSensitive() ? baseWord : baseWord.toLowerCase();
      
      // Try normalized form first
      if (dictionary && dictionary[normalizedBaseWord]) {
        baseEntries = dictionary[normalizedBaseWord];
      }
      
      // If not found, try original form (for case-sensitive languages)
      if (!baseEntries && dictionary && dictionary[baseWord]) {
        baseEntries = dictionary[baseWord];
      }

      // If not found and async lookup is available, try that
      if (!baseEntries && getDefinitionAsync) {
        try {
          baseEntries = await getDefinitionAsync(baseWord);
          // Cache it in dictionary if we got a result
          if (baseEntries && dictionary) {
            // Cache under both forms for easier lookup
            dictionary[normalizedBaseWord] = baseEntries;
            if (baseWord !== normalizedBaseWord) {
              dictionary[baseWord] = baseEntries;
            }
          }
        } catch (error) {
          console.warn(`Failed to look up base variant "${baseWord}":`, error);
        }
      }

      if (baseEntries && Array.isArray(baseEntries) && baseEntries.length > 0) {
        // Get the first meaningful definition from base variant
        const baseDefinition = this.extractBaseDefinition(baseEntries);
        if (baseDefinition) {
          // Append base definition to variant definition
          return `${definition}\n;${baseDefinition}`;
        }
      }
    }

    // If no base definition found, return original
    return definition;
  }

  /**
   * Extract all definitions from base variant entries
   * @param {Array} entries - Dictionary entries for base variant
   * @returns {string|null} - All definitions joined together or null
   */
  extractBaseDefinition(entries) {
    if (!entries || entries.length === 0) return null;

    // Filter out variant patterns and other low-priority definitions
    const meaningfulEntries = entries.filter(entry => {
      if (!entry.definition) return false;
      // Skip if it's also a variant pattern
      return !this.detectVariantPattern(entry.definition);
    });

    // If no meaningful entries, fall back to all entries
    const entriesToUse = meaningfulEntries.length > 0 ? meaningfulEntries : entries;
    
    // Collect all definitions from all entries
    const allDefinitions = [];
    for (const entry of entriesToUse) {
      if (entry && entry.definition) {
        // Split by semicolons and add all definitions
        const defs = entry.definition.split(';').map(d => d.trim()).filter(Boolean);
        allDefinitions.push(...defs);
      }
    }

    // Remove duplicates while preserving order
    const uniqueDefinitions = Array.from(new Set(allDefinitions));
    
    return uniqueDefinitions.length > 0 ? uniqueDefinitions.join('; ') : null;
  }

  /**
   * Get proficiency level definitions for this language
   * Returns an array of {level, name, wordCount} objects
   * Override this method in language-specific adapters
   * @returns {Array<Object>} - Array of level definitions
   */
  getLevelDefinitions() {
    // Default: no levels defined
    return [];
  }

  /**
   * Get the vocabulary file path for onboarding word lists
   * @param {string} level - Proficiency level (e.g., 'A1', 'HSK1')
   * @returns {string|null} - Path to vocabulary file or null if not available
   */
  getOnboardingVocabPath(level) {
    // Default implementation - override in language adapters when available
    return null;
  }

}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseLanguageAdapter;
} else {
  window.BaseLanguageAdapter = BaseLanguageAdapter;
}
