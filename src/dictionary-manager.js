class DictionaryManager {
  constructor() {
    this.dictionary = {};
  }

  async loadDictionary() {
    try {
      const dictionaryUrl = chrome.runtime.getURL('cedict_ts.u8');
      const response = await fetch(dictionaryUrl);
      const text = await response.text();
      this.parseCEDICT(text);
      console.log('CC-CEDICT loaded with', Object.keys(this.dictionary).length, 'entries');
    } catch (error) {
      console.warn('Could not load CC-CEDICT file:', error);
    }
  }

  parseCEDICT(cedictText) {
    const lines = cedictText.split('\n');
    let processedEntries = 0;

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      const match = line.match(/^(.+?)\s+(.+?)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
      if (!match) continue;

      const [, traditional, simplified, pinyin, definitions] = match;
      const entryData = {
        traditional: traditional.trim(),
        simplified: simplified.trim(),
        pinyin: pinyin.trim(),
        definition: definitions.split('/').filter(def => def.trim()).join('; '),
        tone: this.extractToneFromPinyin(pinyin.trim())
      };

      const tradKey = traditional.trim();
      const simpKey = simplified.trim();

      if (tradKey === simpKey) {
        if (!this.dictionary[tradKey]) this.dictionary[tradKey] = [];
        this.dictionary[tradKey].push({ ...entryData, character: tradKey });
      } else {
        [tradKey, simpKey].forEach(key => {
          if (!this.dictionary[key]) this.dictionary[key] = [];
          this.dictionary[key].push({ ...entryData, character: key });
        });
      }

      processedEntries++;
    }
    console.log(`Successfully processed ${processedEntries} CC-CEDICT entries`);
  }

  extractToneFromPinyin(pinyin) {
    const toneMarks = {
      'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
      'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
      'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4
    };
    for (const char of pinyin) {
      if (toneMarks[char] > 0) return toneMarks[char];
    }
    const toneMatch = pinyin.match(/[1-4]/);
    return toneMatch ? parseInt(toneMatch[0]) : 0;
  }
}