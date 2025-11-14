/**
 * Offscreen Dictionary Manager
 * Runs DictionaryManager in a persistent offscreen document
 * Handles dictionary loading and lookups for all content scripts
 */

class OffscreenDictionaryService {
  constructor() {
    this.languageRegistry = new LanguageRegistry();
    this.languageRegistry.initializeDefaultAdapters();
    this.dictionaryManager = new DictionaryManager(this.languageRegistry);
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
      const targetLanguage = result.targetLanguage || 'zh'; // Default to Chinese
      
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
          response = await this.handleLoadDictionary(message.languageCode);
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

  async handleLoadDictionary(languageCode) {
    try {
      // If already loading the same language, wait for existing promise
      if (this.isLoading && this.currentLanguage === languageCode && this.loadPromise) {
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

      // Load dictionary for new language
      this.isLoading = true;
      this.currentLanguage = languageCode;
      this.languageRegistry.setLanguage(languageCode);
      
      this.loadPromise = this.dictionaryManager.loadDictionary();
      await this.loadPromise;
      
      this.isLoading = false;
      const size = Object.keys(this.dictionaryManager.dictionary).length;
      
      console.log(`✅ Dictionary loaded for ${languageCode}: ${size} entries`);
      
      return { 
        success: true, 
        size: size,
        language: languageCode
      };
    } catch (error) {
      this.isLoading = false;
      console.error('Error loading dictionary:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGetDefinition(word) {
    try {
      const lowercaseWord = word.toLowerCase();

      
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

