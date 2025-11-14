/**
 * Dictionary Bridge
 * Provides a proxy interface to the offscreen dictionary manager
 * Allows content scripts to access dictionary without loading it locally
 */
class DictionaryBridge {
  constructor() {
    this.cache = new Map(); // Cache for dictionary entries
    this.cacheSize = 10000; // Max cache size
    this.offscreenReady = false;
    this.ensureOffscreenDocument();
  }

  /**
   * Ensure offscreen document is created
   */
  async ensureOffscreenDocument() {
    try {
      // Request background script to create offscreen document
      // Content scripts can't directly check for offscreen documents
      await chrome.runtime.sendMessage({
        action: 'CREATE_OFFSCREEN'
      });
      
      this.offscreenReady = true;
    } catch (error) {
      console.warn('Could not ensure offscreen document:', error);
      // Mark as ready anyway - will retry on first message
      this.offscreenReady = true;
    }
  }

  /**
   * Send message to offscreen document
   */
  async sendToOffscreen(message) {
    // Ensure offscreen is ready
    if (!this.offscreenReady) {
      await this.ensureOffscreenDocument();
    }


    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('🌉 Bridge error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response) {
          // Response from background is the data object directly
          if (response.success !== false) {
            resolve(response);
          } else {
            console.error('🌉 Bridge error response:', response);
            reject(new Error(response.error || 'Unknown error'));
          }
        } else {
          console.error('🌉 Bridge no response received');
          reject(new Error('No response received'));
        }
      });
    });
  }

  /**
   * Load dictionary for a language
   * Only loads if not already loaded for this specific language
   */
  async loadDictionary(languageCode) {
    try {
      // Always send DICT_LOAD - the offscreen document will check if it's already loaded
      // for this specific language and skip if needed, or load if it's a different language
      const response = await this.sendToOffscreen({
        action: 'DICT_LOAD',
        languageCode: languageCode
      });
      
      // Clear cache when loading a new dictionary (offscreen handles checking if reload is needed)
      // We clear cache to ensure we get fresh entries for the new language
      if (response.success && response.language === languageCode) {
        this.cache.clear();
      }
      
      return response;
    } catch (error) {
      console.error('Error loading dictionary:', error);
      throw error;
    }
  }

  /**
   * Get definition for a word
   */
  async getDefinition(word) {
    const lowercaseWord = word.toLowerCase();
    
    // Check cache first
    if (this.cache.has(lowercaseWord)) {
      return this.cache.get(lowercaseWord);
    }

    try {
      const response = await this.sendToOffscreen({
        action: 'DICT_GET_DEFINITION',
        word: lowercaseWord
      });
      
      
      // Response structure: {success: true, entries: [...]}
      const entries = response.entries;
      
      // Cache the result
      this.cacheEntry(lowercaseWord, entries);
      
      return entries;
    } catch (error) {
      console.error('🌉 Error getting definition:', error);
      return null;
    }
  }

  /**
   * Check if word exists in dictionary
   */
  async hasWord(word) {
    const lowercaseWord = word.toLowerCase();
    
    // Check cache first
    if (this.cache.has(lowercaseWord)) {
      return this.cache.get(lowercaseWord) !== null;
    }

    try {
      const response = await this.sendToOffscreen({
        action: 'DICT_HAS_WORD',
        word: lowercaseWord
      });
      
      return response.hasWord;
    } catch (error) {
      console.error('Error checking word:', error);
      return false;
    }
  }

  /**
   * Get multiple entries at once (batch lookup)
   */
  async getEntries(words) {
    const lowercaseWords = words.map(w => w.toLowerCase());
    const uncachedWords = [];
    const results = {};

    // Check cache first
    for (const word of lowercaseWords) {
      if (this.cache.has(word)) {
        results[word] = this.cache.get(word);
      } else {
        uncachedWords.push(word);
      }
    }

    // Fetch uncached words
    if (uncachedWords.length > 0) {
      try {
        const response = await this.sendToOffscreen({
          action: 'DICT_GET_ENTRIES',
          words: uncachedWords
        });
        
        // Merge results and cache
        for (const [word, entries] of Object.entries(response.entries)) {
          results[word] = entries;
          this.cacheEntry(word, entries);
        }
        
        // Cache null for words not found
        for (const word of uncachedWords) {
          if (!(word in results)) {
            this.cacheEntry(word, null);
            results[word] = null;
          }
        }
      } catch (error) {
        console.error('Error getting entries:', error);
        // Return cached results only
      }
    }

    return results;
  }

  /**
   * Cache an entry
   */
  cacheEntry(word, entries) {
    // Simple LRU: remove oldest if cache is full
    if (this.cache.size >= this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(word, entries);
  }

  /**
   * Get dictionary size
   */
  async getSize() {
    try {
      const response = await this.sendToOffscreen({
        action: 'DICT_GET_SIZE'
      });
      return response.size || 0;
    } catch (error) {
      console.error('Error getting dictionary size:', error);
      return 0;
    }
  }

  /**
   * Check if dictionary is loaded
   */
  async isDictionaryLoaded() {
    const size = await this.getSize();
    return size > 0;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Dictionary Proxy
 * Provides a dictionary-like interface that works with adapters
 * Intercepts property access and makes async calls to offscreen
 */
class DictionaryProxy {
  constructor(bridge) {
    this.bridge = bridge;
    this.cache = new Map();
    this.pendingLookups = new Map();
  }

  /**
   * Get dictionary entry (async property access)
   */
  async get(word) {
    const lowercaseWord = word.toLowerCase();
    
    // Check cache
    if (this.cache.has(lowercaseWord)) {
      return this.cache.get(lowercaseWord);
    }

    // Check if lookup is already pending
    if (this.pendingLookups.has(lowercaseWord)) {
      return await this.pendingLookups.get(lowercaseWord);
    }

    // Start new lookup
    const promise = this.bridge.getDefinition(word).then(entries => {
      this.cache.set(lowercaseWord, entries);
      this.pendingLookups.delete(lowercaseWord);
      return entries;
    });

    this.pendingLookups.set(lowercaseWord, promise);
    return await promise;
  }

  /**
   * Synchronous getter (returns cached value or null)
   * For use with adapters that need sync access
   */
  getSync(word) {
    const lowercaseWord = word.toLowerCase();
    return this.cache.get(lowercaseWord) || null;
  }

  /**
   * Preload words into cache (for extractWords)
   */
  async preloadWords(words) {
    const uncachedWords = words.filter(w => !this.cache.has(w.toLowerCase()));
    if (uncachedWords.length > 0) {
      const entries = await this.bridge.getEntries(uncachedWords);
      for (const [word, entry] of Object.entries(entries)) {
        this.cache.set(word, entry);
      }
    }
  }

  /**
   * Create a sync dictionary object for adapters
   * This creates a proxy that intercepts property access
   * Triggers background lookups for uncached words
   */
  createSyncDictionary() {
    const self = this;
    return new Proxy({}, {
      get(target, prop) {
        if (typeof prop === 'string') {
          const cached = self.getSync(prop);
          
          // If not cached, trigger background lookup
          if (cached === undefined && !self.pendingLookups.has(prop)) {
            // Start async lookup in background
            self.bridge.getDefinition(prop).then(entries => {
              self.cache.set(prop, entries);
              self.pendingLookups.delete(prop);
            }).catch(() => {
              self.cache.set(prop, null);
              self.pendingLookups.delete(prop);
            });
            self.pendingLookups.set(prop, Promise.resolve());
          }
          
          return cached;
        }
        return target[prop];
      },
      has(target, prop) {
        if (typeof prop === 'string') {
          const cached = self.getSync(prop);
          
          // Trigger background lookup if not cached
          if (cached === undefined && !self.pendingLookups.has(prop)) {
            self.bridge.getDefinition(prop).then(entries => {
              self.cache.set(prop, entries);
              self.pendingLookups.delete(prop);
            }).catch(() => {
              self.cache.set(prop, null);
              self.pendingLookups.delete(prop);
            });
            self.pendingLookups.set(prop, Promise.resolve());
          }
          
          return cached !== null && cached !== undefined;
        }
        return prop in target;
      },
      ownKeys(target) {
        // Return empty array - we don't know all keys
        return [];
      },
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string') {
          const cached = self.getSync(prop);
          
          // Trigger background lookup if not cached
          if (cached === undefined && !self.pendingLookups.has(prop)) {
            self.bridge.getDefinition(prop).then(entries => {
              self.cache.set(prop, entries);
              self.pendingLookups.delete(prop);
            }).catch(() => {
              self.cache.set(prop, null);
              self.pendingLookups.delete(prop);
            });
            self.pendingLookups.set(prop, Promise.resolve());
          }
          
          if (cached !== null && cached !== undefined) {
            return {
              enumerable: true,
              configurable: true,
              value: cached
            };
          }
        }
        return undefined;
      }
    });
  }
}

/**
 * DictionaryManagerProxy
 * Wraps DictionaryBridge to provide DictionaryManager-like interface
 * Maintains backward compatibility with existing code
 */
class DictionaryManagerProxy {
  constructor(languageRegistry) {
    this.languageRegistry = languageRegistry;
    this.bridge = new DictionaryBridge();
    this.proxy = new DictionaryProxy(this.bridge);
    this._dictionary = this.proxy.createSyncDictionary();
    this.isLoading = false;
  }

  /**
   * Load dictionary for current language
   */
  async loadDictionary() {
    if (this.isLoading) {
      return;
    }

    try {
      this.isLoading = true;
      const currentLang = this.languageRegistry.getCurrentLanguage();
      if (!currentLang) {
        console.warn('No language set in registry');
        return;
      }

      await this.bridge.loadDictionary(currentLang);
      console.log(`✅ Dictionary loaded via offscreen for ${currentLang}`);
    } catch (error) {
      console.error('Error loading dictionary:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get dictionary object (proxy that intercepts access)
   */
  get dictionary() {
    return this._dictionary;
  }

  /**
   * Preload words into cache (for extractWords)
   * Call this before using extractWords to ensure words are cached
   */
  async preloadWords(words) {
    if (words.length === 0) return;
    
    // Get unique words
    const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
    
    // Batch load words and update cache
    const entries = await this.bridge.getEntries(uniqueWords);
    
    // Update proxy cache with loaded entries
    for (const [word, wordEntries] of Object.entries(entries)) {
      this.proxy.cache.set(word, wordEntries);
    }
    
    // Also cache null for words not found
    for (const word of uniqueWords) {
      if (!(word in entries)) {
        this.proxy.cache.set(word, null);
      }
    }
  }

  /**
   * Get definition for a word (async)
   * Also updates the sync dictionary cache so it's available immediately
   */
  async getDefinition(word) {
    const lowercaseWord = word.toLowerCase();
    const entries = await this.bridge.getDefinition(word);
    
    // Update the proxy cache so sync dictionary access works
    if (entries !== null && entries !== undefined) {
      this.proxy.cache.set(lowercaseWord, entries);
    } else {
      this.proxy.cache.set(lowercaseWord, null);
    }
    
    return entries;
  }

  /**
   * Check if word exists (async)
   */
  async hasWord(word) {
    return await this.bridge.hasWord(word);
  }
}

// Export singleton instance
if (typeof window !== 'undefined') {
  window.DictionaryBridge = DictionaryBridge;
  window.DictionaryProxy = DictionaryProxy;
  window.DictionaryManagerProxy = DictionaryManagerProxy;
}

