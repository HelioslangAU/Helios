/**
 * Space-Separated Language Adapter
 * 
 * Generic adapter for languages that use spaces to separate words
 * (English, Spanish, French, German, etc.)
 */
class SpaceSeparatedLanguageAdapter extends BaseLanguageAdapter {
  constructor(config) {
    super();
    this.config = config;
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
    

    // Use configured regex to find word boundaries and extract complete words
    const wordRegex = new RegExp(`${this.config.wordBoundaryRegex.source}[\\p{L}\\p{M}]+${this.config.wordBoundaryRegex.source}`, 'gu');
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

    /**
   * Check if word exists in dictionary, handling gender variations
   * @param {string} word - Word to check
   * @param {Object} dictionary - Dictionary object
   * @returns {string|null} - Found dictionary form or null
   */
  findDictionaryForm(word, dictionary) {
      const normalizedWord = word.toLowerCase().trim();
      
      // First check if the word exists as is
      if (dictionary[normalizedWord] && dictionary[normalizedWord].length > 0) {
        return normalizedWord;
      }

      // Check if this is a form mapping to another word
      if (dictionary[normalizedWord] && dictionary[normalizedWord][0] && 
          Array.isArray(dictionary[normalizedWord][0][5])) {
        // Get the base form from the mapping array
        for (const mapping of dictionary[normalizedWord][0][5]) {
          if (Array.isArray(mapping) && mapping.length > 0) {
            const baseForm = mapping[0];
            if (dictionary[baseForm]) {
              return baseForm;
            }
          }
        }
      }

      return null;
  }

    /**
   * Process a single term bank file's content
   * @param {Array} entries - Array of dictionary entries from a term bank
   * @param {Object} dictionary - The dictionary object to add entries to
   * @returns {number} - Number of entries processed
   */
  processTermBank(bankContent, dictionary) {
    let processedEntries = 0;
    
    if (!Array.isArray(bankContent)) return processedEntries;

    for (const entry of bankContent) {
      if (!Array.isArray(entry) || entry.length < 6) continue;

      const [word, , grammarInfo, pos, , contentArray] = entry;
      
      if (!word) continue;

      const normalizedWord = word.toLowerCase().trim();
      if (!dictionary[normalizedWord]) {
        dictionary[normalizedWord] = [];
      }

      // Process structured content to extract definitions and other info
      const definitions = [];
      let morphology = '';
      let grammar = '';

      if (contentArray && contentArray.length > 0) {
        for (const content of contentArray) {
          if (content.type === 'structured-content') {
            for (const section of content.content) {
              // Extract grammar information
              // if (section.content && Array.isArray(section.content)) {
              //   for (const item of section.content) {
              //     if (item.data?.content === 'details-entry-Grammar') {
              //       const grammarContent = item.content.find(c => c.data?.content === 'Grammar-content');
              //       if (grammarContent) {
              //         grammar = grammarContent.content || '';
              //       }
              //     }
              //     // if (item.data?.content === 'details-entry-Morphemes') {
              //     //   const morphContent = item.content.find(c => c.data?.content === 'Morphemes-content');
              //     //   if (morphContent) {
              //     //     morphology = morphContent.content || '';
              //     //   }
              //     // }
              //   }
              // }
                      // Extract definitions from glosses
              if (section.data?.content === 'glosses' && Array.isArray(section.content)) {
                for (const li of section.content) {
                  if (li.content && Array.isArray(li.content) && li.content[0]) {
                    const def = li.content[0].content;
                    if (Array.isArray(def)) {
                      // Handle array of definition parts
                      const joinedDef = def
                        .map(part => {
                          if (typeof part === 'string') return part.trim();
                          return '';
                        })
                        .filter(Boolean)
                        .join(' ')
                        .trim();
                      if (joinedDef) definitions.push(joinedDef);
                    } else if (typeof def === 'string') {
                      // Handle simple string definition
                      const strDef = def.trim();
                      if (strDef) definitions.push(strDef);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Only add entry if we have at least a word and some content
      if (word) {
        const newEntry = {
          word: word,
          partOfSpeech: pos || '',
          grammar: grammar || grammarInfo || '',
          morphology: morphology || '',
          definition: definitions.filter(Boolean).join('; '),
          translation: definitions.find(def => def && def.trim()) || '',
          variations: [] // Will store word variations
        };

        // If this is a non-lemma entry (variation of another word)
        if (grammarInfo === 'non-lemma' && Array.isArray(entry[5])) {
          // Add base forms to variations so we can find their definitions
          for (const mapping of entry[5]) {
            if (Array.isArray(mapping) && mapping.length > 0) {
              const baseForm = mapping[0];
              if (baseForm && !newEntry.variations.includes(baseForm)) {
                newEntry.variations.push(baseForm);
              }
            }
          }
        }

        // Check for duplicates before adding
        const isDuplicate = dictionary[normalizedWord].some(existingEntry => 
          existingEntry.definition === newEntry.definition &&
          existingEntry.partOfSpeech === newEntry.partOfSpeech &&
          existingEntry.grammar === newEntry.grammar
        );

        if (!isDuplicate) {
          dictionary[normalizedWord].push(newEntry);
          processedEntries++;
        }
      }
    }

    return processedEntries;
  }
}



/**
 * English Language Adapter
 */
class EnglishLanguageAdapter extends SpaceSeparatedLanguageAdapter {
  constructor() {
    super();
    const baseConfig = {
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
      
    };
    this.setConfig(baseConfig);
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

  getDictionaryPath() {
    return 'dictionaries/English/ecdict.csv';
  }
}

/**
 * Spanish Language Adapter
 */
class SpanishLanguageAdapter extends SpaceSeparatedLanguageAdapter {
  constructor() {
    super();
    const baseConfig = {
      code: 'es',
      name: 'Spanish',
      displayName: 'Spanish (Español)',
      maxWordLength: 25,
      hasSpaces: true,
      script: 'latin',
      direction: 'ltr',
      scanResolution: 'word',
      caseSensitive: true,
      characterRanges: [
        { start: 0x0041, end: 0x005A }, // A-Z
        { start: 0x0061, end: 0x007A }, // a-z
        { start: 0x00C0, end: 0x00FF }, // Latin-1 Supplement (includes ñ, á, é, etc.)
        { start: 0x0100, end: 0x017F }, // Latin Extended-A
      ],
      wordBoundaryRegex: /\b/,
      sentenceBoundaryRegex: /(?<=[.!?])\s+/,
      numOfDicts: 60,
    };
    this.setConfig(baseConfig);
  }
  extractWords(text, dictionary) {
    const words = [];
    const wordRegex = new RegExp(`${this.config.wordBoundaryRegex.source}[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+${this.config.wordBoundaryRegex.source}`, 'g');
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0]; 
      const start = match.index;
      const end = start + word.length;
      
      const dictionaryForm = this.findDictionaryForm(word, dictionary);
      if (dictionaryForm) {
        words.push({
          word: word,
          start: start,
          end: end,
          dictionaryForm: dictionaryForm // Store the base form for dictionary lookup
        });
      }
    }
    return words;
  }
  

  /**
   * Parse JSON dictionary format from multiple term bank files
   * @param {string} dictionaryText - Raw directory listing content
   * @returns {Object} - Unified dictionary format
   */
  parseDictionary(dictionaryText) {
    try {
      const dictionary = {};
      let processedEntries = 0;
      let totalBanks = 0;

      // Check if input is a directory listing
      if (dictionaryText.includes('term_bank_')) {
        // Split directory listing into lines
        const files = dictionaryText.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('term_bank_'));
        
        // Process each term bank
        for (const file of files) {
          try {
            const filePath = `${this.getDictionaryPath()}${file}`;
            const bankContent = require(filePath);
            
            const entriesProcessed = this.processTermBank(bankContent, dictionary);
            if (entriesProcessed > 0) {
              processedEntries += entriesProcessed;
              totalBanks++;
            }
          } catch (bankError) {
            console.error(`Error processing term bank ${file}:`, bankError);
          }
        }

        console.log(`Successfully processed ${totalBanks} term banks with ${processedEntries} total entries`);
      } else {
        console.error('Invalid dictionary format: Expected directory listing of term bank files');
      }
      
      return dictionary;
    } catch (error) {
      console.error('Error parsing dictionary:', error);
      return {};
    }
  }

  getDictionaryPath() {
    return 'dictionaries/Spanish/';
  }
}

/**
 * French Language Adapter
 */
class FrenchLanguageAdapter extends SpaceSeparatedLanguageAdapter {
  constructor() {
    super();
    const baseConfig = {
      code: 'fr',
      name: 'French',
      displayName: 'French (Français)',
      maxWordLength: 25,
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
      ],
      wordBoundaryRegex: /\b/,
      sentenceBoundaryRegex: /(?<=[.!?])\s+/,
      numOfDicts: 27,
    };
    this.setConfig(baseConfig);
    
    // Common French feminine form patterns
    this.femininePatterns = [
      { masc: /(.+)eux$/, fem: '$1euse' },   // heureux -> heureuse
      { masc: /(.+)er$/, fem: '$1ère' },     // premier -> première
      { masc: /(.+)f$/, fem: '$1ve' },       // actif -> active
      { masc: /(.+)eur$/, fem: '$1euse' },   // danseur -> danseuse
      { masc: /(.+)teur$/, fem: '$1trice' }, // acteur -> actrice
      { masc: /(.+)en$/, fem: '$1enne' },    // ancien -> ancienne
      { masc: /(.+)on$/, fem: '$1onne' },    // bon -> bonne
      { masc: /(.+)et$/, fem: '$1ète' },     // complet -> complète
      { masc: /(.+)e$/, fem: '$1e' },        // simple -> simple (same)
      { masc: /(.+)$/, fem: '$1e' }          // petit -> petite (default)
    ];
  }

  getDictionaryPath() {
    return 'dictionaries/French/';
  }

  /**
   * Override normalizeWord to handle French word variations
   * @param {string} word - Word to normalize
   * @returns {string} - Normalized word
   */
  normalizeWord(word) {
    const normalizedWord = word.toLowerCase().trim();
    
    // First try the word as is
    return normalizedWord;
  }

  /**
   * Override isValidWord to handle French word variations
   * @param {string} word - Word to validate
   * @param {Object} dictionary - Dictionary object
   * @returns {boolean} - True if word is valid
   */
  isValidWord(word, dictionary) {
    return this.findDictionaryForm(word, dictionary) !== null;
  }

  /**
   * Override extractWords to handle French word variations
   * @param {string} text - Text to process
   * @param {Object} dictionary - Dictionary to validate against
   * @returns {Array} - Array of {word, start, end} objects
   */
  extractWords(text, dictionary) {
    const words = [];
    const wordRegex = new RegExp(`${this.config.wordBoundaryRegex.source}[\\p{L}\\p{M}]+${this.config.wordBoundaryRegex.source}`, 'gu');
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;
      
      const dictionaryForm = this.findDictionaryForm(word, dictionary);
      if (dictionaryForm) {
        words.push({
          word: word,
          start: start,
          end: end,
          dictionaryForm: dictionaryForm // Store the base form for dictionary lookup
        });
      }
    }
    return words;
  }

  /**
   * Parse JSON dictionary format from multiple term bank files
   * @param {string} dictionaryText - Raw directory listing content
   * @returns {Object} - Unified dictionary format
   */
  parseDictionary(dictionaryText) {
    try {
      const dictionary = {};
      let processedEntries = 0;
      let totalBanks = 0;

      // Check if input is a directory listing
      if (dictionaryText.includes('term_bank_')) {
        // Split directory listing into lines
        const files = dictionaryText.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('term_bank_'));
        
        // Process each term bank
        for (const file of files) {
          try {
            const filePath = `${this.getDictionaryPath()}${file}`;
            const bankContent = require(filePath);
            
            const entriesProcessed = this.processTermBank(bankContent, dictionary);
            if (entriesProcessed > 0) {
              processedEntries += entriesProcessed;
              totalBanks++;
            }
          } catch (bankError) {
            console.error(`Error processing term bank ${file}:`, bankError);
          }
        }

        console.log(`Successfully processed ${totalBanks} term banks with ${processedEntries} total entries`);
      } else {
        console.error('Invalid dictionary format: Expected directory listing of term bank files');
      }
      
      return dictionary;
    } catch (error) {
      console.error('Error parsing dictionary:', error);
      return {};
    }
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
