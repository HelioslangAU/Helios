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

      // Split the pinyin by spaces to get individual syllables
      const syllables = pinyin.split(' ')
    
      // Convert each syllable to accented pinyin
      const accentedSyllables = syllables.map(syllable => decode_pinyin_syllable(syllable))
    
      // Join them back together
      const newpinyin = accentedSyllables.join('')

      const entryData = {
        traditional: traditional.trim(),
        simplified: simplified.trim(),
        pinyin: newpinyin.trim(),
        definition: definitions.split('/').filter(def => def.trim()).join('; '),
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

}

function decode_pinyin_syllable(syllable) {
      const replacements = {
          'a': ['ā', 'á', 'ǎ', 'à'],
          'e': ['ē', 'é', 'ě', 'è'],
          'u': ['ū', 'ú', 'ǔ', 'ù'],
          'i': ['ī', 'í', 'ǐ', 'ì'],
          'o': ['ō', 'ó', 'ǒ', 'ò'],
          'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
      }

      const medials = ['i', 'u', 'ü']

      if (syllable.length < 1) {
          return syllable
      }

      const tone_idx = parseInt(syllable[syllable.length - 1])

      if (isNaN(tone_idx) || tone_idx < 1 || tone_idx > 5) {
          return syllable
      }

      const ret = syllable.replace(/u:/g, 'ü').replace(/v/g, 'ü')

      if (tone_idx == 5) {
          return ret.slice(0, -1)
      }

      for (let i = 0; i < ret.length; i++) {
          const c1 = ret[i]
          const c2 = ret[i + 1]

          if (medials.includes(c1) && replacements[c2]) {
              return ret.slice(0, i + 1) + replacements[c2][tone_idx - 1] + ret.slice(i + 2, -1)
          }
          if (replacements[c1]) {
              return ret.slice(0, i) + replacements[c1][tone_idx - 1] + ret.slice(i + 1, -1)
          }
      }

      return syllable
  }
