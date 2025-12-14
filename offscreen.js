/**
 * Offscreen Dictionary Manager
 * Runs DictionaryManager in a persistent offscreen document
 * Handles dictionary loading and lookups for all content scripts
 */

/**
 * IndexedDB utilities for storing and retrieving dictionaries
 */
class DictionaryStorage {
  constructor() {
    this.dbName = 'HeliosDictionaryDB';
    this.dbVersion = 1;
    this.storeName = 'dictionaries';
    this.db = null;
  }

  /**
   * Open IndexedDB database
   */
  async openDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'languageCode' });
        }
      };
    });
  }

  /**
   * Store dictionary in IndexedDB
   */
  async storeDictionary(languageCode, dictionary) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.put({
          languageCode: languageCode,
          dictionary: dictionary,
          timestamp: Date.now()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error storing dictionary:', error);
      throw error;
    }
  }

  /**
   * Get dictionary from IndexedDB
   */
  async getDictionary(languageCode) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(languageCode);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.dictionary);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting dictionary:', error);
      return null;
    }
  }

  /**
   * Check if dictionary exists in IndexedDB
   */
  async hasDictionary(languageCode) {
    const dict = await this.getDictionary(languageCode);
    return dict !== null && Object.keys(dict).length > 0;
  }
}

class OffscreenDictionaryService {
  constructor() {
    this.languageRegistry = new LanguageRegistry();
    // Don't initialize all adapters - will initialize target language when needed
    this.dictionaryManager = new DictionaryManager(this.languageRegistry);
    this.storage = new DictionaryStorage();
    this.currentLanguage = null;
    this.isLoading = false;
    this.loadPromise = null;
    
    this.setupMessageListener();
    this.loadInitialDictionary();
    console.log('📚 Offscreen Dictionary Service initialized');
  }

  /**
   * Load dictionary for the current language on startup
   */
  async loadInitialDictionary() {
    try {
      // Get current language from storage
      const result = await chrome.storage.local.get(['targetLanguage']);
      
      // Don't load dictionary if no language is selected yet (e.g., during onboarding)
      if (!result.targetLanguage) {
        console.log('📚 No target language set yet, skipping initial dictionary load');
        return;
      }
      
      const targetLanguage = result.targetLanguage;
      // Initialize only the target language adapter
      this.languageRegistry.initializeLanguageAdapter(targetLanguage);
      console.log(`📚 Loading initial dictionary for language: ${targetLanguage}`);
      await this.handleLoadDictionary(targetLanguage);
    } catch (error) {
      console.error('📚 Error loading initial dictionary:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      
      // Only handle dictionary messages (ignore responses)
      if (message.action && message.action.startsWith('DICT_') && !message.action.startsWith('RESPONSE_')) {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep channel open for async responses
      }
      return false;
    });
    
    console.log('📚 Offscreen message listener set up');
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      let response;
      
      switch (message.action) {
        case 'DICT_LOAD':
          response = await this.handleLoadDictionary(message.languageCode, message.nativeLanguageCode);
          break;
        
        case 'DICT_GET_DEFINITION':
          response = await this.handleGetDefinition(message.word);
          break;
        
        case 'DICT_HAS_WORD':
          response = await this.handleHasWord(message.word);
          break;
        
        case 'DICT_GET_ENTRIES':
          response = await this.handleGetEntries(message.words);
          break;
        
        case 'DICT_GET_SIZE':
          response = await this.handleGetSize();
          break;
        
        default:
          response = { success: false, error: 'Unknown action' };
      }
      
      // Send response back via message (since sendResponse may not work across contexts)
      if (message.requestId) {
        chrome.runtime.sendMessage({
          action: `RESPONSE_${message.action}`,
          requestId: message.requestId,
          data: response
        });
      } else {
        // Fallback: use sendResponse if available
        if (sendResponse) {
          sendResponse(response);
        }
      }
    } catch (error) {
      console.error('Error handling dictionary message:', error);
      const errorResponse = { success: false, error: error.message };
      
      if (message.requestId) {
        chrome.runtime.sendMessage({
          action: `RESPONSE_${message.action}`,
          requestId: message.requestId,
          data: errorResponse
        });
      } else if (sendResponse) {
        sendResponse(errorResponse);
      }
    }
  }

  async handleLoadDictionary(languageCode, nativeLanguageCode = null) {
    try {
      // If already loading the same language, wait for existing promise
      if (this.isLoading && this.currentLanguage === languageCode && this.loadPromise) {
        console.log(`📚 Dictionary already loading for ${languageCode}, waiting for existing load...`);
        await this.loadPromise;
        return { 
          success: true, 
          size: Object.keys(this.dictionaryManager.dictionary).length,
          language: languageCode
        };
      }

      // If already loaded for THIS EXACT language, return immediately
      if (this.currentLanguage === languageCode && !this.isLoading) {
        const size = Object.keys(this.dictionaryManager.dictionary).length;
        if (size > 0) {
          console.log(`📚 Dictionary already loaded for ${languageCode} (${size} entries), skipping reload`);
          return { 
            success: true, 
            size: size,
            language: languageCode
          };
        }
      }

      // If dictionary has entries but for a DIFFERENT language, we need to reload
      // The dictionary is language-specific, so we must load the new language's dictionary
      const currentSize = Object.keys(this.dictionaryManager.dictionary).length;
      if (currentSize > 0 && this.currentLanguage !== languageCode && !this.isLoading) {
        console.log(`📚 Switching dictionary from ${this.currentLanguage} to ${languageCode}, loading new dictionary...`);
        // Clear existing dictionary before loading new one
        this.dictionaryManager.dictionary = {};
      }

      // Set loading state and language BEFORE any async operations
      // This ensures concurrent requests will see the loading state immediately
      this.isLoading = true;
      this.currentLanguage = languageCode;
      this.languageRegistry.setLanguage(languageCode);
      
      // Create the loading promise BEFORE checking IndexedDB
      // This ensures concurrent requests will wait for the same promise
      if (!this.loadPromise) {
        this.loadPromise = (async () => {
          try {
            // Check IndexedDB first
            const storedDictionary = await this.storage.getDictionary(languageCode);
            if (storedDictionary && Object.keys(storedDictionary).length > 0) {
              console.log(`📚 Loading dictionary from IndexedDB for ${languageCode}`);
              this.dictionaryManager.dictionary = storedDictionary;
              const size = Object.keys(this.dictionaryManager.dictionary).length;
              console.log(`✅ Dictionary loaded from IndexedDB for ${languageCode}: ${size} entries`);
              return { 
                success: true, 
                size: size,
                language: languageCode
              };
            }

            // If not in IndexedDB, download and process
            console.log(`📚 Dictionary not found in IndexedDB for ${languageCode}, downloading...`);
            await this.downloadAndProcessDictionary(languageCode, nativeLanguageCode);
            const size = Object.keys(this.dictionaryManager.dictionary).length;
            console.log(`✅ Dictionary loaded for ${languageCode}: ${size} entries`);
            return { 
              success: true, 
              size: size,
              language: languageCode
            };
          } finally {
            // Reset loading state when done
            this.isLoading = false;
            this.loadPromise = null;
          }
        })();
      }
      
      // Wait for the loading promise (will be the same for concurrent requests)
      const result = await this.loadPromise;
      return result;
    } catch (error) {
      this.isLoading = false;
      this.loadPromise = null;
      console.error('Error loading dictionary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download dictionary zip file, unzip, and process it
   */
  async downloadAndProcessDictionary(languageCode, nativeLanguageCode = null) {
    try {
      const adapter = this.languageRegistry.getAdapter();
      if (!adapter) {
        throw new Error('No language adapter available');
      }

      // Get native language code from parameter or storage
      if (!nativeLanguageCode) {
        try {
          const result = await chrome.storage.local.get(['nativeLanguage']);
          nativeLanguageCode = result.nativeLanguage || 'en';
        } catch (error) {
          console.warn('Could not get native language from storage, defaulting to English:', error);
          nativeLanguageCode = 'en';
        }
      }

      // Get download URL from adapter (may be async, pass native language)
      const downloadUrl = typeof adapter.getDictionaryDownloadUrl === 'function' 
        ? await adapter.getDictionaryDownloadUrl(nativeLanguageCode) 
        : adapter.getDictionaryDownloadUrl();
      console.log(`📥 Downloading dictionary from: ${downloadUrl}`);

      // Download the zip file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download dictionary: ${response.status} ${response.statusText}`);
      }

      let zipData = await response.arrayBuffer();
      let zipBytes = new Uint8Array(zipData);

      console.log(`📦 Downloaded zip file (${zipBytes.length} bytes), extracting...`);

      // Check if fflate is available
      if (typeof fflate === 'undefined' || typeof fflate.unzipSync !== 'function') {
        throw new Error('fflate library not available. Make sure lib/fflate.js is loaded.');
      }

      // Unzip using fflate
      let unzipped = fflate.unzipSync(zipBytes);
      
      if (!unzipped || Object.keys(unzipped).length === 0) {
        throw new Error('Failed to unzip dictionary file');
      }

      console.log(`📂 Unzipped ${Object.keys(unzipped).length} files from dictionary zip`);

      // Process the unzipped files based on dictionary type
      // Check if this is a multi-file dictionary (has term_bank files)
      const unzippedFileNames = Object.keys(unzipped);
      const hasTermBanks = unzippedFileNames.some(name => name.includes('term_bank'));
      let dictionary = {};

      if (hasTermBanks) {
        // Multi-file dictionary (e.g., French with term banks)
        // Find all term_bank files in the zip (they may be numbered)
        const termBankFiles = [];
        for (const [path, data] of Object.entries(unzipped)) {
          if (path.includes('term_bank') && path.endsWith('.json')) {
            // Extract the number from filename like "term_bank_1.json" or "term_bank_10.json"
            const match = path.match(/term_bank[_-]?(\d+)\.json$/i);
            const number = match ? parseInt(match[1], 10) : 0;
            termBankFiles.push({ path, data, number });
          }
        }
        
        // Sort by number to process in order
        termBankFiles.sort((a, b) => a.number - b.number);
        
        console.log(`📚 Found ${termBankFiles.length} term bank files in zip`);
        
        // Process each term bank file
        for (const { path, data } of termBankFiles) {
          try {
            // Convert Uint8Array to text and parse JSON
            const text = new TextDecoder('utf-8').decode(data);
            const bankContent = JSON.parse(text);
            
            // Process term bank using adapter's method
            if (typeof adapter.processTermBank === 'function') {
              adapter.processTermBank(bankContent, dictionary);
              console.log(`📚 Processed term bank: ${path}`);
            } else {
              // Fallback: merge directly if adapter doesn't have processTermBank
              Object.assign(dictionary, bankContent);
              console.log(`📚 Merged term bank: ${path}`);
            }
            
            // Clear processed data to help GC (data will be GC'd after loop iteration)
            // bankContent and text will be GC'd after processing
          } catch (error) {
            console.warn(`⚠️ Error processing term bank ${path}:`, error);
          }
        }
        
        // Clear term bank files array after processing to help GC
        termBankFiles.length = 0;
      } else {
        // Single-file dictionary
        // Try to find the dictionary file (could be .json, .csv, .txt, etc.)
        // Try common dictionary file patterns
        const possibleNames = [
          `${languageCode}-dict.json`,
          `term_bank_1.json`,
          `index.json`,
          `cedict_ts.u8`
        ];

        let fileData = null;
        for (const [path, data] of Object.entries(unzipped)) {
          for (const name of possibleNames) {
            if (path.endsWith(name) || path.includes(name)) {
              fileData = data;
              break;
            }
          }
          if (fileData) break;
        }

        // If not found, try the first non-metadata file (skip index.json, styles.css, etc.)
        if (!fileData) {
          for (const [path, data] of Object.entries(unzipped)) {
            if (!path.includes('index.json') && 
                !path.includes('styles.css') && 
                !path.includes('tag_bank') &&
                (path.endsWith('.json') || path.endsWith('.csv') || path.endsWith('.txt'))) {
              fileData = data;
              console.log(`📄 Using file from zip: ${path}`);
              break;
            }
          }
        }

        if (!fileData) {
          // Try any JSON file
          for (const [path, data] of Object.entries(unzipped)) {
            if (path.endsWith('.json')) {
              fileData = data;
              console.log(`📄 Using JSON file from zip: ${path}`);
              break;
            }
          }
        }

        if (fileData) {
          // Convert Uint8Array to text
          const text = new TextDecoder('utf-8').decode(fileData);
          
          // Parse using adapter's parseDictionary method
          dictionary = adapter.parseDictionary(text);
        } else {
          throw new Error('Could not find dictionary file in zip archive');
        }
      }

      // Store in IndexedDB for future use
      if (Object.keys(dictionary).length > 0) {
        await this.storage.storeDictionary(languageCode, dictionary);
        console.log(`💾 Stored dictionary in IndexedDB for ${languageCode}`);
      }

      // Load into dictionary manager
      this.dictionaryManager.dictionary = dictionary;

      // Explicitly clear large temporary objects to help garbage collection
      // Free up memory from zip file and extracted files immediately
      // Note: These are function-scoped variables, so clearing them helps GC
      zipData = null;
      zipBytes = null;
      unzipped = null;
      
      // Clear intermediate variables
      // Note: termBankFiles and fileData are block-scoped, so they'll be GC'd when blocks exit

      return dictionary;
    } catch (error) {
      console.error('Error downloading and processing dictionary:', error);
      throw error;
    }
  }

  async handleGetDefinition(word) {
    console.log(`📚 Handling get definition for word: ${word}`);
    try {
      const lowercaseWord = word.toLowerCase();

      console.log(`📚 Found entries:`, this.dictionaryManager.dictionary[lowercaseWord] ? this.dictionaryManager.dictionary[lowercaseWord].length : 0);
      
      const entries = this.dictionaryManager.dictionary[lowercaseWord] || null;
      //console.log(`📚 Found entries:`, entries ? entries.length : 0);
      return { success: true, entries };
    } catch (error) {
      console.error('📚 Error in handleGetDefinition:', error);
      return { success: false, error: error.message };
    }
  }

  async handleHasWord(word) {
    try {
      const lowercaseWord = word.toLowerCase();
      const hasWord = !!this.dictionaryManager.dictionary[lowercaseWord];
      return { success: true, hasWord };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleGetEntries(words) {
    try {
      const entries = {};
      for (const word of words) {
        const lowercaseWord = word.toLowerCase();
        const wordEntries = this.dictionaryManager.dictionary[lowercaseWord];
        if (wordEntries) {
          entries[lowercaseWord] = wordEntries;
        }
      }
      return { success: true, entries };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleGetSize() {
    try {
      const size = Object.keys(this.dictionaryManager.dictionary).length;
      return { success: true, size };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Initialize service when offscreen document loads
const offscreenService = new OffscreenDictionaryService();

