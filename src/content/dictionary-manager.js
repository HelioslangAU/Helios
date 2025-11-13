class DictionaryManager {
  constructor(languageRegistry) {
    this.dictionary = {};
    this.languageRegistry = languageRegistry;
  }

  async loadDictionary() {
    try {
      const adapter = this.languageRegistry.getAdapter();
      if (!adapter) {
        console.warn('No language adapter available for dictionary loading');
        return;
      }

      // Get dictionary path from adapter
      const dictionaryPath = adapter.getDictionaryPath();
      
      if (dictionaryPath.endsWith('/')) {
        // Handle French dictionary with multiple term bank files
        const baseUrl = chrome.runtime.getURL(dictionaryPath);
        const dictionary = {};
        
        // Load and process each term bank file
        for (let i = 1; i <= adapter.getConfig().numOfDicts; i++) {
          const fileName = `term_bank_${i}.json`;
          const response = await fetch(`${baseUrl}${fileName}`);
          const bankContent = await response.json();
          
          // Merge entries from this bank into main dictionary
          Object.assign(dictionary, adapter.processTermBank(bankContent, dictionary));
          console.log(`Loaded term bank ${i} of ${adapter.getConfig().numOfDicts}`);
        }
        
        this.dictionary = dictionary;
      } else {
        // Handle other languages with single dictionary file
        const dictionaryUrl = chrome.runtime.getURL(dictionaryPath);
        const response = await fetch(dictionaryUrl);
        const text = await response.text();
        this.dictionary = adapter.parseDictionary(text);
      }

      console.log(`Dictionary loaded with ${Object.keys(this.dictionary).length} entries for ${adapter.getDisplayName()}`);
    } catch (error) {
      console.warn('Could not load dictionary file:', error);
    }
  }

  // Legacy method - now handled by language adapters
  parseCEDICT(cedictText) {
    console.warn('parseCEDICT is deprecated. Use language adapters instead.');
    return {};
  }

  // Legacy function - now handled by ChineseLanguageAdapter
  // This function is kept for backward compatibility but should not be used
  static decode_pinyin_syllable(syllable) {
    console.warn('decode_pinyin_syllable is deprecated. Use ChineseLanguageAdapter instead.');
    return syllable;
  }
}