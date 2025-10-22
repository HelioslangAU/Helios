/**
 * Space-Separated Language Adapter
 * 
 * Generic adapter for languages that use spaces to separate words
 * (English, Spanish, French, German, etc.)
 */
class SpaceSeparatedLanguageAdapter extends BaseLanguageAdapter {
  constructor(config) {
    super();
    this.config = {
      code: 'en',
      name: 'English',
      displayName: 'English',
      maxWordLength: 45,
      hasSpaces: true,
      script: 'latin',
      direction: 'ltr',
      scanResolution: 'word',
      caseSensitive: true,
      characterRanges: [
        { start: 0x0041, end: 0x005A }, // A-Z
        { start: 0x0061, end: 0x007A }, // a-z
        { start: 0x00C0, end: 0x00FF }, // Latin-1 Supplement
        { start: 0x0100, end: 0x017F }, // Latin Extended-A
        { start: 0x0180, end: 0x024F }, // Latin Extended-B
      ],
      wordBoundaryRegex: /\b/,
      sentenceBoundaryRegex: /(?<=[.!?])\s+/,
      ...config
    };
  }

  /**
   * Check if character belongs to this language
   * @param {string} char - Character to check
   * @returns {boolean} - True if character belongs to this language
   */
  isTargetCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    
    // Check against configured character ranges
    return this.config.characterRanges.some(range => 
      code >= range.start && code <= range.end
    );
  }

  /**
   * Extract words from text with positions
   * @param {string} text - Text to process
   * @param {Object} dictionary - Dictionary to validate against
   * @returns {Array} - Array of {word, start, end} objects
   */
  extractWords(text, dictionary) {
    const words = [];
    //text = text.toLowerCase();
    

    // Use regex to find word boundaries and extract complete words
    const wordRegex = /\b[a-zA-Z]+\b/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;
      
      // Check if word exists in dictionary (case-insensitive)
      const normalizedWord = word.toLowerCase();
      if (dictionary && dictionary[normalizedWord]) {
        words.push({
          word: word,
          start: start,
          end: end
        });
      }
    }
    
    return words;
  }

  /**
   * Parse CSV dictionary format (ECDICT)
   * @param {string} dictionaryText - Raw dictionary CSV text
   * @returns {Object} - Unified dictionary format
   */
  parseDictionary(dictionaryText) {
    try {
      const lines = dictionaryText.split('\n');
      const dictionary = {};
      let processedEntries = 0;

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line - handle quoted fields with commas
        const fields = this.parseCSVLine(line);
        if (fields.length < 4) continue;

        const [word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio] = fields;

        if (!word) continue;

        const normalizedWord = word.toLowerCase().replace(/^'|'$/g, ''); // Remove leading/trailing quotes
        if (!dictionary[normalizedWord]) {
          dictionary[normalizedWord] = [];
        }

        // Ensure it's an array before pushing
        if (!Array.isArray(dictionary[normalizedWord])) {
          dictionary[normalizedWord] = [dictionary[normalizedWord]];
        }

        // Clean up the definition/translation by removing part of speech markers and newlines
        const cleanDefinition = (def) => {
          return def
            .replace(/\\n/g, ', ') // Replace \n with comma and space
            .replace(/([a-z]\.|[a-z]{1,5}\.) /g, '') // Remove part of speech markers
            .split(/,\s*/) // Split by commas
            .filter(Boolean) // Remove empty items
            .join(', ') // Join back with proper comma spacing
            .trim();
        };

        dictionary[normalizedWord].push({
          definition: cleanDefinition(translation || ''),
          pronunciation: phonetic || '',
          translation: cleanDefinition(definition || ''),
          partOfSpeech: pos || '',
          collins: collins || '',
          oxford: oxford || '',
          tag: tag || '',
          bnc: bnc || '',
          frq: frq || '',
          exchange: exchange || '',
          detail: detail || '',
          audio: audio || ''
        });

        processedEntries++;
      }
      
      console.log(`Successfully parsed ${processedEntries} dictionary entries`);
      return dictionary;
    } catch (error) {
      console.error('Error parsing dictionary CSV:', error);
      return {};
    }
  }

  /**
   * Parse a CSV line handling quoted fields with commas
   * @param {string} line - CSV line to parse
   * @returns {Array} - Array of field values
   */
  parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current.trim());
    return fields;
  }

  /**
   * Get pronunciation for a word
   * @param {string} word - Word to get pronunciation for
   * @param {Array} entries - Dictionary entries for the word
   * @returns {string|null} - Pronunciation or null
   */
  getPronunciation(word, entries) {
    if (entries && entries.length > 0) {
      // Look for IPA pronunciation first, then any pronunciation field
      const entry = entries[0];
      return entry.pronunciation || entry.ipa || entry.phonetic || null;
    }
    return null;
  }

  /**
   * Get sentence boundary regex
   * @returns {RegExp} - Regex for splitting sentences
   */
  getSentenceBoundary() {
    return this.config.sentenceBoundaryRegex;
  }

  /**
   * Get language configuration
   * @returns {Object} - Language config
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get dictionary file path
   * @returns {string} - Path to dictionary file
   */
  getDictionaryPath() {
    return 'ecdict.csv';
  }

  /**
   * Check if text contains target language characters
   * @param {string} text - Text to check
   * @returns {boolean} - True if text contains target language characters
   */
  containsTargetLanguage(text) {
    if (!text) return false;
    
    // Check if text contains any characters from our ranges
    for (let i = 0; i < text.length; i++) {
      if (this.isTargetCharacter(text[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Normalize word for dictionary lookup
   * @param {string} word - Word to normalize
   * @returns {string} - Normalized word
   */
  normalizeWord(word) {
    return word.toLowerCase().trim();
  }

  /**
   * Check if word is valid for this language
   * @param {string} word - Word to validate
   * @returns {boolean} - True if word is valid
   */
  isValidWord(word, dictionary) {
    if (!word || !dictionary) return false;
    
    const normalized = this.normalizeWord(word);
    return dictionary[normalized] && dictionary[normalized].length > 0;
  }
}

/**
 * English Language Adapter
 */
class EnglishLanguageAdapter extends SpaceSeparatedLanguageAdapter {
  constructor() {
    super({
      code: 'en',
      name: 'English',
      displayName: 'English',
      maxWordLength: 20,
      hasSpaces: true,
      script: 'latin',
      direction: 'ltr'
    });
  }
}

/**
 * Spanish Language Adapter
 */
class SpanishLanguageAdapter extends SpaceSeparatedLanguageAdapter {
  constructor() {
    super({
      code: 'es',
      name: 'Spanish',
      displayName: 'Spanish (Español)',
      maxWordLength: 25,
      hasSpaces: true,
      script: 'latin',
      direction: 'ltr',
      characterRanges: [
        { start: 0x0041, end: 0x005A }, // A-Z
        { start: 0x0061, end: 0x007A }, // a-z
        { start: 0x00C0, end: 0x00FF }, // Latin-1 Supplement (includes ñ, á, é, etc.)
        { start: 0x0100, end: 0x017F }, // Latin Extended-A
      ]
    });
  }
}

/**
 * French Language Adapter
 */
class FrenchLanguageAdapter extends SpaceSeparatedLanguageAdapter {
  constructor() {
    super({
      code: 'fr',
      name: 'French',
      displayName: 'French (Français)',
      maxWordLength: 25,
      hasSpaces: true,
      script: 'latin',
      direction: 'ltr',
      characterRanges: [
        { start: 0x0041, end: 0x005A }, // A-Z
        { start: 0x0061, end: 0x007A }, // a-z
        { start: 0x00C0, end: 0x00FF }, // Latin-1 Supplement
        { start: 0x0100, end: 0x017F }, // Latin Extended-A
      ]
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SpaceSeparatedLanguageAdapter,
    EnglishLanguageAdapter,
    SpanishLanguageAdapter,
    FrenchLanguageAdapter
  };
} else {
  window.SpaceSeparatedLanguageAdapter = SpaceSeparatedLanguageAdapter;
  window.EnglishLanguageAdapter = EnglishLanguageAdapter;
  window.SpanishLanguageAdapter = SpanishLanguageAdapter;
  window.FrenchLanguageAdapter = FrenchLanguageAdapter;
}
