/**
 * Japanese Language Adapter
 *
 * Implements Japanese-specific text processing for Hiragana, Katakana, and Kanji.
 * Uses a bundled Kuromoji tokenizer backed by IPADIC dictionary assets, with
 * a greedy longest-match fallback while the tokenizer loads.
 */
class JapaneseLanguageAdapter extends BaseLanguageAdapter {
  constructor(config) {
    super();
    const baseConfig = {
      code: 'ja',
      name: 'Japanese',
      displayName: 'Japanese (日本語)',
      maxWordLength: 20,
      hasSpaces: false,
      script: 'han',
      direction: 'ltr',
      scanResolution: 'char',
      caseSensitive: false,
      characterRanges: [
        { start: 0x3040, end: 0x309F }, // Hiragana
        { start: 0x30A0, end: 0x30FF }, // Katakana
        { start: 0x4E00, end: 0x9FFF }, // CJK Unified Ideographs (Kanji)
        { start: 0x3400, end: 0x4DBF }, // CJK Extension A
        { start: 0xFF65, end: 0xFF9F }, // Half-width Katakana
      ],
      wordBoundaryRegex: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g,
      sentenceBoundaryRegex: /(?<=[.!?。！？\n])/,
      ...config
    };
    this.setConfig(baseConfig);

    // Bundled Kuromoji tokenizer for Japanese morphological analysis
    this.tokenizer = null;
    this.tokenizerInitialized = false;

    // Cache tokenization results to avoid re-processing identical chunks
    this.tokenizerCache = new Map();
    this.tokenizerCacheMaxSize = 1000;

    this._initTokenizer();
  }

  /**
   * Asynchronously initialise the Japanese tokenizer. Called from the constructor — runs in
   * the background so the adapter is immediately usable via the fallback path.
   * @private
   */
  async _initTokenizer() {
    try {
      if (typeof kuromoji !== 'undefined' && typeof kuromoji.builder === 'function') {
        const dicPath = chrome.runtime.getURL('lib/kuromoji/dict/');
        this.tokenizer = await new Promise((resolve, reject) => {
          kuromoji.builder({ dicPath }).build((error, tokenizer) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(tokenizer);
          });
        });
        this.tokenizerInitialized = !!this.tokenizer;
        if (this.tokenizerInitialized) {
          console.log('Kuromoji tokenizer initialized successfully');
        }
      } else {
        console.warn('Kuromoji not found. Make sure lib/kuromoji/kuromoji.js is loaded.');
      }
    } catch (error) {
      console.error('Failed to initialize Kuromoji tokenizer:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BaseLanguageAdapter interface
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if character is a Japanese character (Hiragana, Katakana, or Kanji)
   * @param {string} char
   * @returns {boolean}
   */
  isTargetCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x3040 && code <= 0x309F) || // Hiragana
           (code >= 0x30A0 && code <= 0x30FF) || // Katakana
           (code >= 0x4E00 && code <= 0x9FFF) || // Kanji (CJK)
           (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
           (code >= 0xFF65 && code <= 0xFF9F);   // Half-width Katakana
  }

  /**
   * Extract Japanese words from text with positions.
   *
   * Primary path  — Kuromoji morphological tokenization.
   * Fallback path — greedy longest-match against dictionary (used while the tokenizer
   *                 is still loading or if it fails to initialise).
   *
   * @param {string} text
   * @param {Object} dictionary
   * @returns {Promise<Array<{word, start, end, isTargetLang}>>}
   */
  async extractWords(text, dictionary) {
    const words = [];

    // ── Kuromoji tokenizer path ────────────────────────────────────────────────
    if (this.tokenizer && this.tokenizerInitialized) {
      try {
        // Split text into consecutive Japanese / non-Japanese chunks while
        // preserving their original positions (mirrors chinese-adapter.js).
        const chunks = [];
        let i = 0;
        while (i < text.length) {
          if (this.isTargetCharacter(text[i])) {
            const start = i;
            let targetText = '';
            while (i < text.length && this.isTargetCharacter(text[i])) {
              targetText += text[i++];
            }
            chunks.push({ text: targetText, start, isTargetLang: true });
          } else {
            const start = i;
            let nonTargetText = '';
            while (i < text.length && !this.isTargetCharacter(text[i])) {
              nonTargetText += text[i++];
            }
            chunks.push({ text: nonTargetText, start, isTargetLang: false });
          }
        }

        for (const chunk of chunks) {
          if (!chunk.isTargetLang || chunk.text.length === 0) {
            if (chunk.text.length > 0) {
              words.push({ word: chunk.text, start: chunk.start, end: chunk.start + chunk.text.length, isTargetLang: false });
            }
            continue;
          }

          // Check cache first
          let segments;
          if (this.tokenizerCache.has(chunk.text)) {
           segments = this.tokenizerCache.get(chunk.text);
          } else {
            const tokens = this.tokenizer.tokenize(chunk.text);
            segments = tokens
              .map(token => {
                if (!token || !token.surface_form) return null;
                const basicForm = token.basic_form && token.basic_form !== '*' ? token.basic_form.trim().normalize('NFC') : null;
                // 
                const pos = token.pos || '';
                const isGrammatical = (
                  pos === '助詞' ||
                  pos === '助動詞' ||
                  pos === '記号'
                );
                return {
                  surface: token.surface_form,
                  dictionaryForm: basicForm && basicForm.length > 0 ? basicForm : null,
                  isGrammatical,
                };
              })
              .filter(Boolean);

            // FIFO eviction when cache is full
            if (this.tokenizerCache.size >= this.tokenizerCacheMaxSize) {
              const firstKey = this.tokenizerCache.keys().next().value;
              this.tokenizerCache.delete(firstKey);
            }
            this.tokenizerCache.set(chunk.text, segments);
          }

          let chunkPos = 0;
          for (const segment of segments) {
            const start = chunk.start + chunkPos;
            words.push({
              word: segment.surface,
              start,
              end: start + segment.surface.length,
              dictionaryForm: segment.dictionaryForm,
              // Grammatical morphemes are still Japanese characters but should not
              // be treated as vocabulary — flag them as non-target so the renderer
              // (and stats) skip them. (Bug #4)
              isTargetLang: !segment.isGrammatical
            });
            chunkPos += segment.surface.length;
          }
        }

        return words;
      } catch (error) {
        console.error('Kuromoji tokenization error — falling back to longest-match:', error);
        // fall through to fallback below
        words.length = 0;
      }
    }

    // ── Fallback: greedy longest-match ─────────────────────────────────────────
    let i = 0;
    while (i < text.length) {
      if (this.isTargetCharacter(text[i])) {
        let longestWord = null;
        let longestLength = 0;

        for (let len = Math.min(this.config.maxWordLength, text.length - i); len >= 1; len--) {
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
          words.push({ word: longestWord, start: i, end: i + longestLength, isTargetLang: true });
          i += longestLength;
        } else {
          // Single-character fallback
          words.push({ word: text[i], start: i, end: i + 1, isTargetLang: true });
          i++;
        }
      } else {
        const start = i;
        while (i < text.length && !this.isTargetCharacter(text[i])) i++;
        words.push({ word: text.substring(start, i), start, end: i, isTargetLang: false });
      }
    }

    return words;
  }

  findDictionaryForm(word, dictionary) {
    if (!word || !dictionary) return null;

    const normalizedWord = word.toLowerCase().trim().normalize('NFC');
    if (dictionary[normalizedWord] && dictionary[normalizedWord].length > 0) {
      return normalizedWord;
    }

    if (this.tokenizer && this.tokenizerInitialized) {
      try {
        const tokens = this.tokenizer.tokenize(word);
        if (tokens.length === 1) {
          const basicForm = tokens[0].basic_form;
          if (basicForm && basicForm !== '*') {
            const normalizedBase = basicForm.toLowerCase().trim().normalize('NFC');
            if (dictionary[normalizedBase] && dictionary[normalizedBase].length > 0) {
              return normalizedBase;
            }
          }
        }
      } catch (error) {
        console.warn('Kuromoji dictionary form resolution failed:', error);
      }
    }

    return null;
  }

  /**
   * Look up dictionary entries for a word.
   *
   *
   * @param {string} word
   * @param {Object} dictionary - sync proxy or plain dict
   * @param {Function} [getDefinitionAsync] - optional async loader
   *        (word) => Promise<Array|null>
   * @returns {Promise<Array|null>}
   */
  async getDictionaryEntries(word, dictionary, getDefinitionAsync = null) {
    if (!word || !dictionary) return null;

    const normalizedWord = word.toLowerCase().trim().normalize('NFC');

    // 1. Direct hit on the surface form.
    let entries = dictionary[normalizedWord];
    if (entries && entries.length > 0) {
      return entries;
    }

    // 2. Resolve via kuromoji's basic_form and try again.
    if (this.tokenizer && this.tokenizerInitialized) {
      try {
        const tokens = this.tokenizer.tokenize(word);
        if (tokens.length === 1) {
          const basicForm = tokens[0].basic_form;
          if (basicForm && basicForm !== '*') {
            const normalizedBase = basicForm.toLowerCase().trim().normalize('NFC');
            if (normalizedBase && normalizedBase !== normalizedWord) {
              // Sync first (might already be in proxy cache from preloadWords).
              entries = dictionary[normalizedBase];
              if (entries && entries.length > 0) return entries;

              // Otherwise fall through to the async loader.
              if (getDefinitionAsync) {
                try {
                  entries = await getDefinitionAsync(normalizedBase);
                  if (entries && entries.length > 0) return entries;
                } catch (err) {
                  console.warn('Async base-form lookup failed:', err);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Kuromoji base-form resolution failed:', error);
      }
    }

    // 3. Last-ditch async lookup of the surface form (in case the proxy just
    //    hadn't cached it yet).
    if (getDefinitionAsync) {
      try {
        entries = await getDefinitionAsync(normalizedWord);
        if (entries && entries.length > 0) return entries;
      } catch (err) {
        console.warn('Async surface lookup failed:', err);
      }
    }

    return null;
  }

  /**
   * Parse JMdict/EDICT-style JSON dictionary or Yomichan term-bank format.
   *
   * Supports:
   *  - Named-property objects: { word, reading, definition }
   *  - Yomichan term-bank arrays: [word, reading, def_tags, rules, score, [defs], seq, term_tags]
   *
   * @param {string} dictionaryText - Raw JSON text
   * @returns {Object} Unified dictionary: { word: [{ word, pronunciation, definition }] }
   */
  parseDictionary(dictionaryText) {
    const dictionary = {};
    try {
      const entries = JSON.parse(dictionaryText);
      for (const entry of entries) {
        const word       = entry.word  || entry[0];
        const reading    = entry.reading || entry[1] || '';
        const rawDefs    = entry.definition !== undefined
          ? entry.definition
          : entry[5];
        const definition = this._normalizeDefinition(rawDefs);

        if (!word) continue;
        this._indexEntry(dictionary, word, reading, definition);
      }
    } catch (e) {
      console.error('JapaneseLanguageAdapter: failed to parse dictionary', e);
    }
    return dictionary;
  }

  /**
   * Process a Yomichan term-bank array into the shared dictionary object.
   * Called by offscreen.js when extracting term_bank_*.json files from a ZIP.
   *
   * Term-bank entry format (8 fields):
   *   [word, reading, definition_tags, rules, score, [definitions], sequence, term_tags]
   *
   * @param {Array} bankContent - Parsed JSON array from one term_bank_*.json file
   * @param {Object} dictionary - Shared dictionary object to merge into
   */
  processTermBank(bankContent, dictionary) {
    if (!Array.isArray(bankContent)) return;
    for (const entry of bankContent) {
      if (!Array.isArray(entry) || entry.length < 6) continue;
      const word    = entry[0];
      const reading = entry[1] || '';
      const definition = this._normalizeDefinition(entry[5]);

      if (!word) continue;
      this._indexEntry(dictionary, word, reading, definition);
    }
  }

  /**
   * Insert an entry into the dictionary under both its headword and (when
   * appropriate) its kana reading.
   *
   *
   * @private
   */
  _indexEntry(dictionary, word, reading, definition) {
    const record = { word, pronunciation: reading, definition };
    if (!dictionary[word]) dictionary[word] = [];
    dictionary[word].push(record);

    if (
      reading &&
      reading !== word &&
      this._containsKanji(word) &&
      this._isPureKana(reading)
    ) {
      if (!dictionary[reading]) dictionary[reading] = [];
      dictionary[reading].push(record);
    }
  }

  /** @private */
  _containsKanji(text) {
    if (!text) return false;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
        (code >= 0x3400 && code <= 0x4DBF)    // CJK Extension A
      ) {
        return true;
      }
    }
    return false;
  }

  /** @private */
  _isPureKana(text) {
    if (!text) return false;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const isHiragana = code >= 0x3040 && code <= 0x309F;
      const isKatakana = code >= 0x30A0 && code <= 0x30FF;
      const isHalfKatakana = code >= 0xFF65 && code <= 0xFF9F;
      const isProlong = code === 0x30FC; // ー
      if (!isHiragana && !isKatakana && !isHalfKatakana && !isProlong) {
        return false;
      }
    }
    return true;
  }

  /**
   * Dictionary is downloaded at runtime (too large to bundle).
   * Returning undefined lets the base class use getDictionaryDownloadUrl() instead.
   */
  getDictionaryPath() {
    return undefined;
  }

  /**
   * Public JMdict Yomitan release — updated daily by yomidevs/jmdict-yomitan.
   * Contains term_bank_*.json files in the standard 8-field Yomichan format,
   * processed by processTermBank() in offscreen.js.
   * @returns {string}
   */
  getDictionaryDownloadUrl() {
    return 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip';
  }

  /**
   * Get pronunciation (furigana/reading in hiragana/katakana) for a word.
   * @param {string} word
   * @param {Array} entries
   * @returns {string|null}
   */
  getPronunciation(word, entries) {
    if (entries && entries.length > 0 && entries[0].pronunciation) {
      return entries[0].pronunciation;
    }
    return null;
  }

  /**
   * Sentence boundary regex for Japanese (handles Japanese punctuation).
   * @returns {RegExp}
   */
  getSentenceBoundary() {
    return /(?<=[.!?。！？\n])/;
  }

  /**
   * JLPT proficiency levels used for onboarding word counts.
   * @returns {Array<Object>}
   */
  getLevelDefinitions() {
    return [
      { level: 'N5', name: 'JLPT N5 (Beginner)',           wordCount: 800   },
      { level: 'N4', name: 'JLPT N4 (Elementary)',         wordCount: 1800  },
      { level: 'N3', name: 'JLPT N3 (Intermediate)',       wordCount: 4000  },
      { level: 'N2', name: 'JLPT N2 (Upper Intermediate)', wordCount: 8000  },
      { level: 'N1', name: 'JLPT N1 (Advanced)',           wordCount: 12000 },
    ];
  }

  /**
   * Path to the onboarding vocabulary CSV for Japanese.
   * @returns {string}
   */
  getOnboardingVocabPath(level) {
    return 'OnboardingVocab/ja5k.csv';
  }

  _normalizeDefinition(rawDefs) {
    const parts = this._collectDefinitionParts(rawDefs);
    return parts.join('; ');
  }

  _collectDefinitionParts(value) {
    const parts = [];

    const visit = (node) => {
      if (node == null) return;
      if (typeof node === 'string') {
        const text = node.replace(/\s+/g, ' ').trim();
        if (text) parts.push(text);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node === 'object') {
        if ('content' in node) {
          visit(node.content);
        }
        if ('href' in node && typeof node.href === 'string' && parts.length > 0 && parts[parts.length - 1] === 'see:') {
          return;
        }
        return;
      }
      const text = String(node).trim();
      if (text) parts.push(text);
    };

    visit(value);

    const normalized = [];
    for (const part of parts) {
      const prev = normalized[normalized.length - 1];
      if (!part || part === prev) continue;

      if (normalized.length > 0 && /[:：]$/.test(prev)) {
        normalized[normalized.length - 1] = `${prev} ${part}`.trim();
        continue;
      }

      normalized.push(part);
    }

    return normalized;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JapaneseLanguageAdapter;
} else {
  window.JapaneseLanguageAdapter = JapaneseLanguageAdapter;
}
