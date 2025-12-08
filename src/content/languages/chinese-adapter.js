/**
 * Chinese Language Adapter
 * 
 * Implements Chinese-specific text processing, word segmentation,
 * CEDICT dictionary parsing, and pinyin pronunciation handling.
 */
class ChineseLanguageAdapter extends BaseLanguageAdapter {
  constructor(config) {
    super();
    const baseConfig = {
      code: 'zh',
      name: 'Chinese',
      displayName: 'Chinese (中文)',
      maxWordLength: 5,
      hasSpaces: false,
      script: 'han',
      direction: 'ltr',
      scanResolution: 'char',
      caseSensitive: false,
      characterRanges: [
        { start: 0x4E00, end: 0x9FFF },
        { start: 0x3400, end: 0x4DBF },
        { start: 0x20000, end: 0x2A6DF },
      ],
      wordBoundaryRegex: /()/,
      sentenceBoundaryRegex: /(?<=[.!?。！？\n])/,
      ...config
    };
    this.setConfig(baseConfig);
    
    // Initialize jieba for Chinese word segmentation
    this.jieba = null;
    this.jiebaInitialized = false;
    this._initJieba();
  }

  /**
   * Initialize jieba word segmentation library
   * @private
   */
  async _initJieba() {
    try {
      if (typeof Jieba !== 'undefined') {
        this.jieba = new Jieba();
        await this.jieba.init();
        // Verify jieba is actually ready - check cache exists and trie is populated
        if (this.jieba.initialized && 
            this.jieba._cache_ && 
            this.jieba._cache_.trie && 
            Object.keys(this.jieba._cache_.trie).length > 0) {
          this.jiebaInitialized = true;
          console.log('Jieba initialized successfully');
          // Test jieba after successful initialization
        } else {
          console.warn('Jieba instance created but not fully initialized. Cache:', this.jieba._cache_);
        }
      } else {
        console.warn('Jieba class not found. Make sure lib/jieba/jieba.js is loaded.');
      }
    } catch (error) {
      console.error('Failed to initialize jieba:', error);
    }
  }

  /**
   * Check if character is a Chinese character
   * @param {string} char - Character to check
   * @returns {boolean} - True if character is Chinese
   */
  isTargetCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x20000 && code <= 0x2A6DF);
  }

  /**
   * Extract Chinese words from text with positions
   * @param {string} text - Text to process
   * @param {Object} dictionary - Dictionary to validate against
   * @returns {Promise<Array>} - Array of {word, start, end, isTargetLang} objects
   */
  async extractWords(text, dictionary) {
    const words = [];
    
    // Use jieba for word segmentation if available
    if (this.jieba && this.jiebaInitialized) {
      try {
        // First, split text into chunks of target characters and non-target characters
        // while preserving their original positions
        const chunks = [];
        let i = 0;
        
        while (i < text.length) {
          if (this.isTargetCharacter(text[i])) {
            // Collect consecutive target characters
            const start = i;
            let targetText = '';
            while (i < text.length && this.isTargetCharacter(text[i])) {
              targetText += text[i];
              i++;
            }
            chunks.push({
              text: targetText,
              start: start,
              isTargetLang: true
            });
          } else {
            // Collect consecutive non-target characters
            const start = i;
            let nonTargetText = '';
            while (i < text.length && !this.isTargetCharacter(text[i])) {
              nonTargetText += text[i];
              i++;
            }
            chunks.push({
              text: nonTargetText,
              start: start,
              isTargetLang: false
            });
          }
        }
        
        // Process each chunk
        for (const chunk of chunks) {
          if (chunk.isTargetLang && chunk.text.length > 0) {
            // Use jieba.cut only on target character chunks
            const segments = await this.jieba.cut(chunk.text);
            let chunkPos = 0;
            
            for (const segment of segments) {
              const start = chunk.start + chunkPos;
              const end = start + segment.length;
              
              words.push({
                word: segment,
                start: start,
                end: end,
                isTargetLang: true
              });
              
              chunkPos += segment.length;
            }
          } 
        }
        // if (words.length != 0) {
        //   console.log('Jieba words:', words);
        // }
        return words;
      
      } catch (error) {
        console.error('Error using jieba.cut:', error);
        // Fall through to fallback implementation
      }
    }
    
    // Fallback: original implementation if jieba is not available
    let i = 0;
    while (i < text.length) {
      if (this.isTargetCharacter(text[i])) {
        let longestWord = null;
        let longestLength = 0;

        // Try to find the longest word (1-5 characters)
        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);
          if ([...candidate].every(c => this.isTargetCharacter(c)) &&
              dictionary && dictionary[candidate]) {
            if (len > longestLength) {
              longestWord = candidate;
              longestLength = len;
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
   * Parse CEDICT dictionary format
   * @param {string} cedictText - Raw CEDICT text
   * @returns {Object} - Unified dictionary format
   */
  parseDictionary(cedictText) {
    const dictionary = {};
    const lines = cedictText.split('\n');
    let processedEntries = 0;

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      const match = line.match(/^(.+?)\s+(.+?)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
      if (!match) continue;

      const [, traditional, simplified, pinyin, definitions] = match;

      // Convert pinyin to accented format
      const syllables = pinyin.split(' ');
      const accentedSyllables = syllables.map(syllable => this.decodePinyinSyllable(syllable));
      const newPinyin = accentedSyllables.join('');

      const entryData = {
        traditional: traditional.trim(),
        simplified: simplified.trim(),
        pinyin: newPinyin.trim(),
        definition: definitions.split('/').filter(def => def.trim()).join('; '),
      };

      const tradKey = traditional.trim();
      const simpKey = simplified.trim();

      if (tradKey === simpKey) {
        if (!dictionary[tradKey]) dictionary[tradKey] = [];
        dictionary[tradKey].push({ ...entryData, character: tradKey });
      } else {
        [tradKey, simpKey].forEach(key => {
          if (!dictionary[key]) dictionary[key] = [];
          dictionary[key].push({ ...entryData, character: key });
        });
      }

      processedEntries++;
    }

    console.log(`Successfully processed ${processedEntries} CEDICT entries`);
    return dictionary;
  }

  /**
   * Get pinyin pronunciation for a word
   * @param {string} word - Word to get pronunciation for
   * @param {Array} entries - Dictionary entries for the word
   * @returns {string|null} - Pinyin pronunciation or null
   */
  getPronunciation(word, entries) {
    if (entries && entries.length > 0) {
      return entries[0].pinyin;
    }
    return null;
  }


  /**
   * Get sentence boundary regex for Chinese
   * @returns {RegExp} - Regex for splitting Chinese sentences
   */
  getSentenceBoundary() {
    return /(?<=[.!?。！？\n])/;
  }

  /**
   * Decode pinyin syllable with tone marks
   * @param {string} syllable - Pinyin syllable with tone number
   * @returns {string} - Pinyin with tone marks
   */
  decodePinyinSyllable(syllable) {
    const replacements = {
      'a': ['ā', 'á', 'ǎ', 'à'],
      'e': ['ē', 'é', 'ě', 'è'],
      'u': ['ū', 'ú', 'ǔ', 'ù'],
      'i': ['ī', 'í', 'ǐ', 'ì'],
      'o': ['ō', 'ó', 'ǒ', 'ò'],
      'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
    };

    const medials = ['i', 'u', 'ü'];

    if (syllable.length < 1) {
      return syllable;
    }

    const tone_idx = parseInt(syllable[syllable.length - 1]);

    if (isNaN(tone_idx) || tone_idx < 1 || tone_idx > 5) {
      return syllable;
    }

    const ret = syllable.replace(/u:/g, 'ü').replace(/v/g, 'ü');

    if (tone_idx == 5) {
      return ret.slice(0, -1);
    }

    for (let i = 0; i < ret.length; i++) {
      const c1 = ret[i];
      const c2 = ret[i + 1];

      if (medials.includes(c1) && replacements[c2]) {
        return ret.slice(0, i + 1) + replacements[c2][tone_idx - 1] + ret.slice(i + 2, -1);
      }
      if (replacements[c1]) {
        return ret.slice(0, i) + replacements[c1][tone_idx - 1] + ret.slice(i + 1, -1);
      }
    }

    return syllable;
  }

  /**
   * Get dictionary file path for Chinese
   * @returns {string} - Path to CEDICT file
   */
  getDictionaryPath() {
    return;
  }

  getDictionaryDownloadUrl() {
    const config = this.getConfig();
    const languageCode = config.code;
    return `https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip`;
  }

  /**
   * Get proficiency level definitions for Chinese (HSK levels)
   * @returns {Array<Object>} - Array of level definitions
   */
  getLevelDefinitions() {
    return [
      { level: 'HSK1', name: 'HSK 1', wordCount: 150 },
      { level: 'HSK2', name: 'HSK 2', wordCount: 300 },
      { level: 'HSK3', name: 'HSK 3', wordCount: 600 },
      { level: 'HSK4', name: 'HSK 4', wordCount: 1200 },
      { level: 'HSK5', name: 'HSK 5', wordCount: 2500 },
      { level: 'HSK6', name: 'HSK 6', wordCount: 5000 }
    ];
  }

  /**
   * Get the vocabulary file path for onboarding word lists
   * @param {string} level - Proficiency level (e.g., 'HSK1', 'HSK2')
   * @returns {string|null} - Path to vocabulary file or null if not available
   */
  getOnboardingVocabPath(level) {
    // For Chinese, we might have separate files per HSK level
    // For now, return a general path - can be customized later
    return `OnboardingVocab/zh5k.csv`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChineseLanguageAdapter;
} else {
  window.ChineseLanguageAdapter = ChineseLanguageAdapter;
}
