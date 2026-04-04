class FrequencyManager {
  constructor() {
    this.freqMap = {};
    this.currentLanguage = 'zh'; // default; call setLanguage() before loadFrequencyList()
  }

  /**
   * Set the active language so loadFrequencyList() fetches the correct corpus.
   * @param {string} code - ISO 639-1 language code (e.g. 'zh', 'ja')
   */
  setLanguage(code) {
    this.currentLanguage = code;
  }

  async loadFrequencyList() {
    // Resolve folder and file list based on current language
    const folderMap = {
      'zh': window.PATHS ? window.PATHS.FREQ_DICT    : 'freq-dict/',
      'ja': window.PATHS ? window.PATHS.FREQ_DICT_JA : 'freq-dict-ja/',
    };
    const filesMap = {
      'zh': window.PATHS ? window.PATHS.FREQUENCY_FILES    : _defaultZhFiles(),
      'ja': window.PATHS ? window.PATHS.FREQUENCY_FILES_JA : _defaultJaFiles(),
    };

    const folder    = folderMap[this.currentLanguage] || folderMap['zh'];
    const fileNames = filesMap[this.currentLanguage]  || filesMap['zh'];

    this.freqMap = {};
    for (const file of fileNames) {
      try {
        const response = await fetch(chrome.runtime.getURL(folder + file));
        if (!response.ok) continue;
        const freqArr = await response.json();
        for (const entry of freqArr) {
          if (!Array.isArray(entry) || entry.length < 3 || typeof entry[0] !== 'string') continue;

          const word = entry[0];
          const data = entry[2];

          // Handle both formats:
          //   Chinese BLCU:  [word, "freq", rankNumber]          → data is a plain number
          //   Japanese BCCWJ: [word, "freq", {reading, frequency}] → data is an object
          let rank = null;
          if (typeof data === 'number') {
            rank = data;
          } else if (data && typeof data === 'object' && typeof data.frequency === 'number') {
            rank = data.frequency;
          }

          if (rank !== null) {
            this.freqMap[word] = rank;
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

function _defaultZhFiles() {
  return [
    'term_meta_bank_1.json',  'term_meta_bank_2.json',  'term_meta_bank_3.json',
    'term_meta_bank_4.json',  'term_meta_bank_5.json',  'term_meta_bank_6.json',
    'term_meta_bank_7.json',  'term_meta_bank_8.json',  'term_meta_bank_9.json',
    'term_meta_bank_10.json', 'term_meta_bank_11.json', 'term_meta_bank_12.json'
  ];
}

function _defaultJaFiles() {
  return [
    'term_meta_bank_1.json',  'term_meta_bank_2.json',  'term_meta_bank_3.json',
    'term_meta_bank_4.json',  'term_meta_bank_5.json',  'term_meta_bank_6.json',
    'term_meta_bank_7.json',  'term_meta_bank_8.json',  'term_meta_bank_9.json',
    'term_meta_bank_10.json', 'term_meta_bank_11.json', 'term_meta_bank_12.json',
    'term_meta_bank_13.json', 'term_meta_bank_14.json', 'term_meta_bank_15.json',
    'term_meta_bank_16.json', 'term_meta_bank_17.json', 'term_meta_bank_18.json'
  ];
}

// Make available globally
window.FrequencyManager = FrequencyManager;
