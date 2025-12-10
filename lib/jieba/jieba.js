/**
 * Jieba Chinese Word Segmentation Library
 * Browser-compatible version for Chrome Extension
 */

// Utility function to find max value in array
function max_of_array(arr) {
  return Math.max.apply(null, arr);
}

// Normalize line endings
function crlf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Load dictionary from text content
 * Format: word frequency pos
 */
function loadDictFromText(text) {
  const lines = text.split('\n');
  const dictionary = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const word = parts[0];
      const freq = parseFloat(parts[1]) || 0;
      dictionary.push([word, freq]);
    }
  }
  
  return dictionary;
}

/**
 * Build Trie data structure from dictionary
 */
function buildFromDict(dictionary) {
  const trie = {};
  const FREQ = {};
  let total = 0.0;
  
  for (const [word, freq] of dictionary) {
    if (!word || word.length === 0) continue;
    
    total += freq;
    FREQ[word] = freq;
    
    // Build trie
    let p = trie;
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      if (!(c in p)) {
        p[c] = {};
      }
      p = p[c];
    }
    p[''] = true; // Mark end of word
  }
  
  return [trie, FREQ, total];
}

class Jieba {
  constructor(options = {}) {
    this.options = options;
    this._cache_ = {
      trie: {},
      min_freq: 0.0,
      dict_file: [],
    };
    this.dictionary = [];
    this.initialized = false;
    this._waiting = null;
    
    // Set default dictionary path
    let dictPath = options.dictPath;
    if (!dictPath && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      dictPath = chrome.runtime.getURL('lib/jieba/dict.txt.big');
    } else if (!dictPath) {
      dictPath = 'lib/jieba/dict.txt.big';
    }
    this.useDict(dictPath);
  }

  static get DEFAULT_DICT_PATH() {
    return 'lib/jieba/dict.txt.big';
  }

  useDict(dict) {
    if (typeof dict === 'string') {
      this._cache_.dict_file.push(dict);
    } else if (Array.isArray(dict)) {
      this.dictionary = this.dictionary.concat(dict);
    } else if (typeof dict === 'function') {
      let ret = dict.call(this, this.dictionary, this);
      if (ret instanceof Promise) {
        ret.then((ret) => {
          if (ret) {
            this.useDict(ret);
          }
        });
      } else if (ret) {
        this.useDict(ret);
      }
    } else {
      throw new Error('Invalid dictionary format: ' + typeof dict);
    }
    return this;
  }

  async cut(sentence, cb) {
    await this.init();
    let ret = this._cut(sentence);
    if (cb) {
      cb(ret);
    }
    return ret;
  }

  cutSync(sentence, cb) {
    this.initSync();
    let ret = this._cut(sentence);
    if (cb) {
      cb(ret);
    }
    return ret;
  }

  get trieTree() {
    return this._cache_.trie;
  }

  async init() {
    if (!this._waiting) {
      this._waiting = this._setup();
    }
    await this._waiting;
    return this;
  }

  initSync() {
    this._setupSync();
    return this;
  }

  _cut(sentence) {
    // Safety check: ensure jieba is initialized
    if (!this.initialized || !this._cache_ || !this._cache_.trie) {
      console.warn('Jieba not initialized yet. Returning sentence as single word.');
      return [sentence];
    }

    sentence = crlf(sentence);
    let cut_all = false;
    let HMM = false;
    let yieldValues = [];

    let re_han = /([\u4E00-\u9FA5a-zA-Z0-9+#&\._]+)/;
    let re_skip = /(\r\n|\s)/;

    let blocks = sentence.split(re_han);
    let cut_block = this._get_cut_block(HMM);

    for (let b in blocks) {
      let blk = blocks[b];
      if (blk.length == 0) {
        continue;
      }

      if (blk.match(re_han)) {
        let cutted = cut_block(blk);
        for (let w in cutted) {
          let word = cutted[w];
          yieldValues.push(word);
        }
      } else {
        let tmp = blk.split(re_skip);
        for (let i = 0; i < tmp.length; i++) {
          let x = tmp[i];
          if (x.match(re_skip)) {
            yieldValues.push(x);
          } else if (!cut_all) {
            for (let xi in x) {
              yieldValues.push(x[xi]);
            }
          } else {
            yieldValues.push(x);
          }
        }
      }
    }

    return yieldValues;
  }

  _get_cut_block(HMM) {
    // Bind the method to preserve 'this' context
    return (HMM ? this.__cut_DAG.bind(this) : this.__cut_DAG_NO_HMM.bind(this));
  }

  async _setup() {
    if (this.initialized) {
      return this;
    }
    this.initialized = true;

    // Load dictionary files
    for (let file of this._cache_.dict_file) {
      try {
        const response = await fetch(file);
        if (!response.ok) {
          console.warn(`Failed to load dictionary file: ${file}`, response.statusText);
          continue;
        }
        const text = await response.text();
        const dict = loadDictFromText(text);
        this.dictionary = (this.dictionary || []).concat(dict);
      } catch (error) {
        console.error(`Error loading dictionary file: ${file}`, error);
      }
    }

    this._build_trie();
    return this;
  }

  _setupSync() {
    if (this.initialized) {
      return this;
    }
    this.initialized = true;

    // For sync version, we can't use fetch, so we'll need to have the dict pre-loaded
    // This is a limitation - sync init requires dictionary to be already loaded
    console.warn('initSync() called but async loading is required. Use init() instead.');
    this._build_trie();
    return this;
  }

  _build_trie() {
    // Ensure _cache_ exists
    if (!this._cache_) {
      this._cache_ = {
        trie: {},
        min_freq: 0.0,
        dict_file: [],
      };
    }

    let [trie, FREQ, total] = buildFromDict(this.dictionary);

    // Only build trie if dictionary has entries
    if (this.dictionary.length === 0) {
      console.warn('Jieba: Dictionary is empty. Cannot build trie.');
      return;
    }

    this._cache_.min_freq = Infinity;
    for (let k in FREQ) {
      let v = FREQ[k];
      FREQ[k] = Math.log(v / total);
      if (FREQ[k] < this._cache_.min_freq) {
        this._cache_.min_freq = FREQ[k];
      }
    }

    Object.assign(this._cache_, {
      trie,
      FREQ,
      total,
    });
  }

  _get_DAG(sentence) {
    if (!this._cache_ || !this._cache_.trie) {
      throw new Error('Jieba not initialized. Call init() first.');
    }
    const trie = this._cache_.trie;
    let N = sentence.length;
    let i = 0;
    let j = 0;
    let p = trie;
    let DAG = {};

    while (i < N) {
      let c = sentence[j];
      if (c in p) {
        p = p[c];
        if ('' in p) {
          if (!(i in DAG)) {
            DAG[i] = [];
          }
          DAG[i].push(j);
        }
        j += 1;
        if (j >= N) {
          i += 1;
          j = i;
          p = trie;
        }
      } else {
        p = trie;
        i += 1;
        j = i;
      }
    }
    
    for (i = 0; i < sentence.length; i++) {
      if (!(i in DAG)) {
        DAG[i] = [i];
      }
    }
    return DAG;
  }

  _calc(sentence, DAG, idx, route) {
    if (!this._cache_ || !this._cache_.FREQ) {
      throw new Error('Jieba not initialized. Call init() first.');
    }
    let N = sentence.length;
    route[N] = [0.0, ''];
    for (idx = N - 1; idx > -1; idx--) {
      let candidates = [];
      let candidates_x = [];
      for (let xi in DAG[idx]) {
        let x = DAG[idx][xi];
        let f = ((sentence.substring(idx, x + 1) in this._cache_.FREQ)
          ? this._cache_.FREQ[sentence.substring(idx, x + 1)]
          : this._cache_.min_freq);
        candidates.push(f + route[x + 1][0]);
        candidates_x.push(x);
      }
      let m = max_of_array(candidates);
      route[idx] = [m, candidates_x[candidates.indexOf(m)]];
    }
  }

  __cut_DAG_NO_HMM(sentence) {
    // Safety check before proceeding - ensure this context and cache exist
    if (!this || !this._cache_ || !this._cache_.trie || Object.keys(this._cache_.trie).length === 0) {
      console.warn('Jieba trie not ready. Returning sentence as single word.', {
        hasThis: !!this,
        hasCache: !!(this && this._cache_),
        hasTrie: !!(this && this._cache_ && this._cache_.trie)
      });
      return [sentence];
    }

    let re_eng = /[a-zA-Z0-9]/;
    let route = {};
    let yieldValues = [];

    let DAG = this._get_DAG(sentence);
    this._calc(sentence, DAG, 0, route);

    let x = 0;
    let buf = '';
    let N = sentence.length;

    while (x < N) {
      let y = route[x][1] + 1;
      let l_word = sentence.substring(x, y);
      if (l_word.match(re_eng) && l_word.length == 1) {
        buf += l_word;
        x = y;
      } else {
        if (buf.length > 0) {
          yieldValues.push(buf);
          buf = '';
        }
        yieldValues.push(l_word);
        x = y;
      }
    }
    if (buf.length > 0) {
      yieldValues.push(buf);
    }
    return yieldValues;
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.Jieba = Jieba;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Jieba;
}

// Export as default for ES6 modules
if (typeof exports !== 'undefined') {
  exports.default = Jieba;
  exports.Jieba = Jieba;
}
