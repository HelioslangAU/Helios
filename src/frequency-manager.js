class FrequencyManager {
  constructor() {
    this.freqMap = {};
  }

  async loadFrequencyList() {
    // Load all files in [ZH Freq] BLCUcoll/ that start with term_meta_bank
    const folder = 'BLCUcoll/';
    const fileNames = [
      'term_meta_bank_1.json',
      'term_meta_bank_2.json',
      'term_meta_bank_3.json',
      'term_meta_bank_4.json',
      'term_meta_bank_5.json',
      'term_meta_bank_6.json',
      'term_meta_bank_7.json',
      'term_meta_bank_8.json',
      'term_meta_bank_9.json',
      'term_meta_bank_10.json',
      'term_meta_bank_11.json',
      'term_meta_bank_12.json'
    ];
    this.freqMap = {};
    for (const file of fileNames) {
      try {
        const response = await fetch(chrome.runtime.getURL(folder + file));
        if (!response.ok) continue;
        const freqArr = await response.json();
        for (const entry of freqArr) {
          if (entry.length === 3 && typeof entry[0] === 'string' && typeof entry[2] === 'number') {
            this.freqMap[entry[0]] = entry[2];
          }
        }
      } catch (e) {
        // Ignore errors for missing files
      }
    }
  }

  getFrequency(word) {
    return this.freqMap[word] || null;
  }
}

// Make available globally if needed
window.FrequencyManager = FrequencyManager;
