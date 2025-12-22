/**
 * Japanese Language Adapter
 * 
 * Implements Japanese-specific text processing, word segmentation using Intl.Segmenter,
 * term bank dictionary parsing, and reading (furigana) pronunciation handling.
 */
class JapaneseLanguageAdapter extends BaseLanguageAdapter {
  constructor(config) {
    super();
    const baseConfig = {
      code: 'ja',
      name: 'Japanese',
      displayName: 'Japanese (日本語)',
      maxWordLength: 10,
      hasSpaces: false,
      script: 'han',
      direction: 'ltr',
      scanResolution: 'char',
      caseSensitive: false,
      characterRanges: [
        { start: 0x3040, end: 0x309F }, // Hiragana
        { start: 0x30A0, end: 0x30FF }, // Katakana
        { start: 0x4E00, end: 0x9FFF }, // Kanji (CJK Unified Ideographs)
        { start: 0x3400, end: 0x4DBF }, // CJK Extension A
      ],
      wordBoundaryRegex: /()/,
      sentenceBoundaryRegex: /(?<=[。！？\n])/,
      numOfDicts: 213, // Number of term bank files (Jitendex has ~88 term banks)
      ...config
    };
    this.setConfig(baseConfig);
  }

  /**
   * Check if character is a Japanese character (Hiragana, Katakana, or Kanji)
   * @param {string} char - Character to check
   * @returns {boolean} - True if character is Japanese
   */
  isTargetCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x3040 && code <= 0x309F) || // Hiragana
           (code >= 0x30A0 && code <= 0x30FF) || // Katakana
           (code >= 0x4E00 && code <= 0x9FFF) || // Kanji
           (code >= 0x3400 && code <= 0x4DBF);   // CJK Extension A
  }

  /**
   * Extract Japanese words from text with positions using longest-match dictionary lookup
   * @param {string} text - Text to process
   * @param {Object} dictionary - Dictionary to validate against
   * @returns {Promise<Array>} - Array of {word, start, end, isTargetLang} objects
   */
  async extractWords(text, dictionary) {
    const words = [];
    const maxWordLength = this.getConfig().maxWordLength || 10;
    
    // Use longest-match dictionary lookup for segmentation
    let i = 0;
    while (i < text.length) {
      if (this.isTargetCharacter(text[i])) {
        let longestWord = null;
        let longestLength = 0;

        // Try to find the longest word matching dictionary entries
        // Search from maxWordLength down to 1 character
        const searchLimit = Math.min(maxWordLength, text.length - i);
        for (let len = searchLimit; len >= 1; len--) {
          const candidate = text.substring(i, i + len);
          // Check if all characters in candidate are target characters
          if ([...candidate].every(c => this.isTargetCharacter(c))) {
            // Normalize candidate for dictionary lookup (trim only, no lowercasing for Japanese)
            const normalizedCandidate = candidate.trim();
            // Check if word exists in dictionary
            if (dictionary && dictionary[normalizedCandidate]) {
              if (len > longestLength) {
                longestWord = candidate;
                longestLength = len;
              }
            }
          }
        }

        if (longestWord) {
          words.push({
            word: longestWord,
            start: i,
            end: i + longestLength,
            isTargetLang: true
          });
          i += longestLength;
        } else {
          // Single character fallback - include even if not in dictionary
          words.push({
            word: text[i],
            start: i,
            end: i + 1,
            isTargetLang: true
          });
          i++;
        }
      } else {
        // Non-target language character (e.g., English, numbers, punctuation)
        // Collect consecutive non-target characters
        const start = i;
        while (i < text.length && !this.isTargetCharacter(text[i])) {
          i++;
        }
        const nonTargetText = text.substring(start, i);

        // Add as a single segment
        words.push({
          word: nonTargetText,
          start: start,
          end: i,
          isTargetLang: false
        });
      }
    }

    return words;
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

      // Entry structure: [word, reading, pos1, pos2, number, structuredContentArray]
      const [word, reading, grammarInfo, pos, , contentArray] = entry;
      
      if (!word) continue;

      // Japanese dictionary keys should not be lowercased (case-sensitive for some entries)
      const normalizedWord = word.trim();
      if (!dictionary[normalizedWord]) {
        dictionary[normalizedWord] = [];
      }

      // Process structured content to extract definitions and other info
      const definitions = [];
      let morphology = '';
      let grammar = '';

      if (contentArray && contentArray.length > 0) {
        for (const content of contentArray) {
          if (content.type === 'structured-content' && Array.isArray(content.content)) {
            // Helper function to extract text from nested content structures
            // Recursively extracts strings, skipping tag/metadata elements
            const extractText = (obj) => {
              if (typeof obj === 'string') {
                return obj.trim();
              }
              if (Array.isArray(obj)) {
                return obj
                  .map(item => extractText(item))
                  .filter(Boolean)
                  .join(' ')
                  .trim();
              }
              if (obj && typeof obj === 'object') {
                // Skip tag elements (they're metadata, not definition text)
                if (obj.tag === 'span' && (obj.data?.content === 'tag' || obj.data?.content === 'part-of-speech-info')) {
                  return '';
                }
                if (obj.tag === 'div' && obj.data?.content === 'tags') {
                  return '';
                }
                // Skip extra-info labels and other metadata
                if (obj.data?.content === 'extra-label' || obj.data?.content === 'reference-label') {
                  return '';
                }
                // For ruby tags, extract base text but skip rt (reading) tags
                if (obj.tag === 'ruby' && Array.isArray(obj.content)) {
                  const baseText = obj.content
                    .filter(item => !item || typeof item !== 'object' || item.tag !== 'rt')
                    .map(item => extractText(item))
                    .filter(Boolean)
                    .join('')
                    .trim();
                  return baseText;
                }
                // Skip rt (reading) tags in ruby annotations
                if (obj.tag === 'rt') {
                  return '';
                }
                // Extract from content property
                if (obj.content !== undefined) {
                  return extractText(obj.content);
                }
              }
              return '';
            };
            
            // Recursive function to find and extract definitions from nested structures
            const extractDefinitions = (obj) => {
              if (!obj || typeof obj !== 'object') return;
              
              // Extract definitions from glossary (ul with data.content === "glossary")
              // Content can be a single object or an array
              if (obj.tag === 'ul' && obj.data?.content === 'glossary') {
                const glossaryContent = obj.content;
                if (glossaryContent) {
                  // Handle both single object and array cases
                  const items = Array.isArray(glossaryContent) ? glossaryContent : [glossaryContent];
                  for (const li of items) {
                    if (li && li.tag === 'li' && li.content !== undefined) {
                      const defText = extractText(li.content);
                      if (defText) {
                        definitions.push(defText);
                      }
                    }
                  }
                }
              }
              
              // Extract definitions from glosses (legacy format)
              if (obj.data?.content === 'glosses' && Array.isArray(obj.content)) {
                for (const li of obj.content) {
                  if (li.content !== undefined) {
                    const defText = extractText(li.content);
                    if (defText) {
                      definitions.push(defText);
                    }
                  }
                }
              }
              
              // Extract definitions from info-gloss-content (explanation/extra info)
              if (obj.data?.content === 'info-gloss-content') {
                const defText = extractText(obj.content);
                if (defText) {
                  definitions.push(defText);
                }
              }
              
              // Extract from xref-glossary (cross-reference definitions)
              if (obj.data?.content === 'xref-glossary') {
                const defText = extractText(obj.content);
                if (defText) {
                  definitions.push(defText);
                }
              }
              
              // Recursively search nested content
              if (obj.content !== undefined) {
                if (Array.isArray(obj.content)) {
                  for (const item of obj.content) {
                    extractDefinitions(item);
                  }
                } else if (typeof obj.content === 'object') {
                  extractDefinitions(obj.content);
                }
              }
            };
            
            // Extract grammar information from sections
            for (const section of content.content) {
              if (section.content && Array.isArray(section.content)) {
                for (const item of section.content) {
                  if (item.data?.content === 'details-entry-Grammar') {
                    const grammarContent = item.content && Array.isArray(item.content) 
                      ? item.content.find(c => c.data?.content === 'Grammar-content')
                      : null;
                    if (grammarContent) {
                      grammar = grammarContent.content || '';
                    }
                  }
                  if (item.data?.content === 'details-entry-Morphemes') {
                    const morphContent = item.content && Array.isArray(item.content)
                      ? item.content.find(c => c.data?.content === 'Morphemes-content')
                      : null;
                    if (morphContent) {
                      morphology = morphContent.content || '';
                    }
                  }
                }
              }
              
              // Extract definitions recursively from each section
              extractDefinitions(section);
            }
          }
        }
      }

      // Only add entry if we have at least a word and some content
      if (word) {
        const newEntry = {
          word: word,
          pinyin: reading || '', // Store reading in "pinyin" field for ruby text logic
          partOfSpeech: pos || '',
          grammar: grammar || grammarInfo || '',
          morphology: morphology || '',
          definition: definitions.filter(Boolean).join('; '),
          translation: definitions.find(def => def && def.trim()) || '',
          variations: [] // Will store word variations
        };

        // If this is a non-lemma entry (variation of another word)
        if (grammarInfo === 'non-lemma' && Array.isArray(entry[5])) {
          const morphologyParts = [];
          
          // Extract base forms and morphology from mappings
          for (const mapping of entry[5]) {
            if (Array.isArray(mapping) && mapping.length > 0) {
              const baseForm = mapping[0];
              if (baseForm && !newEntry.variations.includes(baseForm)) {
                newEntry.variations.push(baseForm);
              }
              
              // Extract morphology from the second element (array of morphology strings)
              if (mapping.length > 1 && Array.isArray(mapping[1])) {
                for (const morphString of mapping[1]) {
                  if (typeof morphString === 'string' && morphString.trim()) {
                    morphologyParts.push(morphString.trim());
                  }
                }
              }
            }
          }
          
          // Set morphology if we found any morphology information
          if (morphologyParts.length > 0) {
            newEntry.morphology = morphologyParts.join('; ');
          }
          
          // Look up and store base form (lemma) definitions to avoid lookups on hover
          if (newEntry.variations.length > 0) {
            const baseForm = newEntry.variations[0];
            const foundBaseEntries = dictionary[baseForm];
            
            if (foundBaseEntries && Array.isArray(foundBaseEntries) && foundBaseEntries.length > 0) {
              // Store the base form definitions in the entry
              newEntry.baseFormDefinitions = foundBaseEntries.map(baseEntry => ({
                definition: baseEntry.definition || '',
                translation: baseEntry.translation || '',
                partOfSpeech: baseEntry.partOfSpeech || '',
                grammar: baseEntry.grammar || ''
              }));
              
              // Add this non-lemma word to the base/lemma entry's variations list
              for (const baseEntry of foundBaseEntries) {
                // Initialize variations array if it doesn't exist
                if (!baseEntry.variations) {
                  baseEntry.variations = [];
                }
                // Add the non-lemma word if it's not already in the variations list
                if (!baseEntry.variations.includes(word)) {
                  baseEntry.variations.push(word);
                }
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

  /**
   * Get reading (pronunciation) for a word from dictionary entries
   * @param {string} word - Word to get pronunciation for
   * @param {Array} entries - Dictionary entries for the word
   * @returns {string|null} - Reading (furigana) or null
   */
  getPronunciation(word, entries) {
    if (entries && entries.length > 0) {
      return entries[0].pinyin || null;
    }
    return null;
  }

  /**
   * Get sentence boundary regex for Japanese
   * @returns {RegExp} - Regex for splitting Japanese sentences
   */
  getSentenceBoundary() {
    return /(?<=[。！？\n])/;
  }

  /**
   * Get dictionary file path for Japanese
   * @returns {string} - Path to term bank directory (must end with /)
   */
  getDictionaryPath() {
    return 'dictionaries/ja/';
  }

  /**
   * Get dictionary download URL for Japanese
   * Uses Jitendex dictionary from stephenmk/jitendex-yomitan project
   * @param {string|null} nativeLanguageCode - Native language code (optional, defaults to 'en')
   * @returns {string} - URL to download the dictionary zip file
   */
  getDictionaryDownloadUrl(nativeLanguageCode = 'en') {
    // Jitendex dictionary - comprehensive Japanese dictionary with forms and xref support
    return `https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip`;
  }

  /**
   * Get proficiency level definitions for Japanese (JLPT levels)
   * @returns {Array<Object>} - Array of level definitions
   */
  getLevelDefinitions() {
    return [
      { level: 'N5', name: 'JLPT N5', wordCount: 800 },
      { level: 'N4', name: 'JLPT N4', wordCount: 1500 },
      { level: 'N3', name: 'JLPT N3', wordCount: 3750 },
      { level: 'N2', name: 'JLPT N2', wordCount: 6000 },
      { level: 'N1', name: 'JLPT N1', wordCount: 10000 }
    ];
  }

  /**
   * Get the vocabulary file path for onboarding word lists
   * @param {string} level - Proficiency level (e.g., 'N5', 'N4')
   * @returns {string|null} - Path to vocabulary file or null if not available
   */
  getOnboardingVocabPath(level) {
    // For Japanese, we might have separate files per JLPT level
    // For now, return a general path - can be customized later
    return `OnboardingVocab/ja5k.csv`;
  }

  /**
   * Normalize word for dictionary lookup
   * @param {string} word - Word to normalize
   * @returns {string} - Normalized word (trimmed, no lowercasing for Japanese)
   */
  normalizeWord(word) {
    return word ? word.trim() : '';
  }

  /**
   * Get dictionary entries for a word
   * @param {string} word - Word to look up
   * @param {Object} dictionary - Dictionary object
   * @returns {Array|null} - Dictionary entries or null if not found
   */
  getDictionaryEntries(word, dictionary) {
    if (!word || !dictionary) return null;

    // Normalize word for lookup
    const normalizedWord = this.normalizeWord(word);
    const entries = dictionary[normalizedWord];
    return (entries && entries.length > 0) ? entries : null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JapaneseLanguageAdapter;
} else {
  window.JapaneseLanguageAdapter = JapaneseLanguageAdapter;
}

