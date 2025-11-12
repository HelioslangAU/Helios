class VocabManager {
  constructor() {
    // Support per-language known words - dynamically created as needed
    // Format: { 'zh': Set(), 'en': Set(), 'fr': Set(), ... }
    this.knownWordsByLanguage = {};
    this.ignoredWordsByLanguage = {};

    // Deprecated sets removed - using per-language structure only

    // Current language for operations
    this.currentLanguage = 'zh';
  }

  setCurrentLanguage(languageCode) {
    this.currentLanguage = languageCode || 'zh';
    console.log('VocabManager: Current language set to', this.currentLanguage);
  }

  getCurrentLanguageKnownWords() {
    // Create set for current language if it doesn't exist (lazy initialization)
    if (!this.knownWordsByLanguage[this.currentLanguage]) {
      this.knownWordsByLanguage[this.currentLanguage] = new Set();
    }
    return this.knownWordsByLanguage[this.currentLanguage];
  }

  getCurrentLanguageIgnoredWords() {
    // Create set for current language if it doesn't exist (lazy initialization)
    if (!this.ignoredWordsByLanguage[this.currentLanguage]) {
      this.ignoredWordsByLanguage[this.currentLanguage] = new Set();
    }
    return this.ignoredWordsByLanguage[this.currentLanguage];
  }

  /**
   * Normalize word to lowercase for consistent storage and lookup
   * @param {string} word - Word to normalize
   * @returns {string} Normalized word in lowercase
   */
  normalizeWord(word) {
    if (!word || typeof word !== 'string') {
      return word;
    }
    return word.toLowerCase();
  }

  async loadKnownWords() {
    try {
      console.log(`VocabManager: Loading known words for language: ${this.currentLanguage}`);

      // Load new per-language format
      const newResult = await chrome.storage.local.get([
        'knownWordsByLanguage',
        'ignoredWordsByLanguage'
      ]);

      // Load new format if available - MERGE instead of replace to preserve in-memory changes
      if (newResult.knownWordsByLanguage) {
        Object.keys(newResult.knownWordsByLanguage).forEach(lang => {
          // Normalize words when loading to ensure consistency
          const normalizedWords = newResult.knownWordsByLanguage[lang]
            .map(word => this.normalizeWord(word))
            .filter(word => word); // Filter out invalid words
          
          // Merge with existing Set instead of replacing to preserve in-memory additions
          if (!this.knownWordsByLanguage[lang]) {
            this.knownWordsByLanguage[lang] = new Set(normalizedWords);
          } else {
            // Add words from storage to existing Set (preserves any in-memory additions)
            normalizedWords.forEach(word => {
              this.knownWordsByLanguage[lang].add(word);
            });
          }
        });
        console.log('Known words loaded (per-language format):', this.knownWordsByLanguage);
      }

      if (newResult.ignoredWordsByLanguage) {
        Object.keys(newResult.ignoredWordsByLanguage).forEach(lang => {
          // Normalize words when loading to ensure consistency
          const normalizedWords = newResult.ignoredWordsByLanguage[lang]
            .map(word => this.normalizeWord(word))
            .filter(word => word); // Filter out invalid words
          
          // Merge with existing Set instead of replacing to preserve in-memory additions
          if (!this.ignoredWordsByLanguage[lang]) {
            this.ignoredWordsByLanguage[lang] = new Set(normalizedWords);
          } else {
            // Add words from storage to existing Set (preserves any in-memory additions)
            normalizedWords.forEach(word => {
              this.ignoredWordsByLanguage[lang].add(word);
            });
          }
        });
        console.log('Ignored words loaded (per-language format):', this.ignoredWordsByLanguage);
      }

      console.log(`Vocab loaded successfully. Current language: ${this.currentLanguage}, Known words:`, this.getCurrentLanguageKnownWords().size);
    } catch (err) {
      console.warn('Failed to load known words from extension storage.', err);
    }
  }

  async saveKnownWords() {
    try {
      // Convert Sets to Arrays for storage
      const knownWordsObj = {};
      const ignoredWordsObj = {};

      Object.keys(this.knownWordsByLanguage).forEach(lang => {
        knownWordsObj[lang] = [...this.knownWordsByLanguage[lang]];
      });

      Object.keys(this.ignoredWordsByLanguage).forEach(lang => {
        ignoredWordsObj[lang] = [...this.ignoredWordsByLanguage[lang]];
      });

      // Get current language words for backward compatibility (fallback to 'zh' if current language doesn't exist)
      const currentKnownWords = this.knownWordsByLanguage[this.currentLanguage] || this.knownWordsByLanguage['zh'] || new Set();
      const currentIgnoredWords = this.ignoredWordsByLanguage[this.currentLanguage] || this.ignoredWordsByLanguage['zh'] || new Set();

      await chrome.storage.local.set({
        knownWordsByLanguage: knownWordsObj,
        ignoredWordsByLanguage: ignoredWordsObj,

      });
      console.log(`Known words saved to extension storage (per-language). Current language: ${this.currentLanguage}`);
    } catch (error) {
      console.warn('Could not save known words:', error);
    }
  }

  async clearKnownWords() {
    // Clear current language words
    this.getCurrentLanguageKnownWords().clear();
    this.getCurrentLanguageIgnoredWords().clear();
    try {
      await chrome.storage.local.set({ chineseExtensionKnownWords: [], chineseExtensionIgnoredWords: [] });
      await this.saveKnownWords(); // Save the cleared state
      console.log('Known words cleared in extension storage');
    } catch (error) {
      console.warn('Could not clear known words:', error);
    }
  }

  exportKnownWordsToFile() {
    const data = {
      knownWords: [...this.getCurrentLanguageKnownWords()],
      exportDate: new Date().toISOString(),
      language: this.currentLanguage
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `known-words-${this.currentLanguage}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Export known words as a JSON string (for programmatic use)
  exportKnownWordsAsJson() {
    const data = {
      knownWords: [...this.getCurrentLanguageKnownWords()],
      exportDate: new Date().toISOString(),
      language: this.currentLanguage
    };
    return JSON.stringify(data, null, 2);
  }

  async importKnownWordsFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.knownWords && Array.isArray(data.knownWords)) {
        // Normalize words when importing
        const normalizedWords = data.knownWords
          .map(word => this.normalizeWord(word))
          .filter(word => word); // Filter out invalid words
        // Add to current language
        const currentSet = this.getCurrentLanguageKnownWords();
        normalizedWords.forEach(word => {
          currentSet.add(word);
        });
        await this.saveKnownWords();
        console.log('Known words imported successfully');
        return true;
      } else {
        throw new Error('Invalid file format');
      }
    } catch (error) {
      console.error('Failed to import known words:', error);
      return false;
    }
  }

  // Import known words from a JSON string. Merges with existing known words.
  async importKnownWordsFromJson(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.knownWords && Array.isArray(data.knownWords)) {
        // Normalize words when importing
        const normalizedWords = data.knownWords
          .map(word => this.normalizeWord(word))
          .filter(word => word); // Filter out invalid words
        // Merge with existing words
        const currentSet = this.getCurrentLanguageKnownWords();
        normalizedWords.forEach(word => {
          currentSet.add(word);
        });
        await this.saveKnownWords();
        console.log('Known words imported from JSON');
        return true;
      }
      throw new Error('Invalid JSON format: missing knownWords array');
    } catch (error) {
      console.error('Failed to import known words from JSON:', error);
      return false;
    }
  }

  async markWordAsKnown(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    this.getCurrentLanguageKnownWords().add(normalizedWord);
    await this.saveKnownWords();
    console.log(`Marked word as known (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate();
  }

  async markWordAsUnknown(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    this.getCurrentLanguageKnownWords().delete(normalizedWord);
    await this.saveKnownWords();
    console.log(`Marked word as unknown (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate();
  }

  async markWordAsIgnored(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    this.getCurrentLanguageIgnoredWords().add(normalizedWord);
    await this.saveKnownWords();
    console.log(`Marked word as ignored (${this.currentLanguage}):`, normalizedWord);
  }

  async markWordAsUnignored(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    this.getCurrentLanguageIgnoredWords().delete(normalizedWord);
    await this.saveKnownWords();
    console.log(`Marked word as unignored (${this.currentLanguage}):`, normalizedWord);
  }

  isWordKnown(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return false;
    return this.getCurrentLanguageKnownWords().has(normalizedWord);
  }

  isWordIgnored(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return false;
    return this.getCurrentLanguageIgnoredWords().has(normalizedWord);
  }

  // Batch operations for better performance
  async markMultipleWordsAsKnown(words) {
    //console.log('Marking multiple words as known:', words);
    // Only load if we don't have data for the current language yet
    // This prevents overwriting in-memory changes from previous operations
    if (!this.knownWordsByLanguage[this.currentLanguage]) {
      await this.loadKnownWords();
    }
    
    // Get language adapter and dictionary for validation
    // Note: In settings page context, languageRegistry may not be available
    // Get adapter for the vocab manager's current language (not the registry's current language)
    const languageRegistry = window.languageRegistry;
    const adapter = languageRegistry?.adapters?.get(this.currentLanguage) || languageRegistry?.getAdapter();
    const dictionary = window.dictionaryManager?.dictionary || {};
    
    // Only validate if both adapter and dictionary are available
    // In settings page context, validation will be skipped gracefully
    const canValidate = adapter && typeof adapter.isValidWord === 'function' && dictionary && Object.keys(dictionary).length > 0;
    
    const currentSet = this.getCurrentLanguageKnownWords();
    const initialSize = currentSet.size;
    let processedWordsCount = 0;
    let skippedWordsCount = 0;
    
    words.forEach(word => {
      const normalizedWord = this.normalizeWord(word);
      if (normalizedWord) {
        // Check if word exists in dictionary before adding (only if validation is available)
        if (canValidate) {
          if (!adapter.isValidWord(normalizedWord, dictionary)) {
            skippedWordsCount++;
            return; // Skip this word if it's not in the dictionary
          }
        }
        processedWordsCount++;
        // Set.add() adds the word (returns true if new, false if duplicate)
        currentSet.add(normalizedWord);
      }
    });
    
    const finalSize = currentSet.size;
    const newWordsCount = finalSize - initialSize;
    
    await this.saveKnownWords();
    console.log(`Marked multiple words as known (${this.currentLanguage}):`, words);
    if (canValidate) {
      console.log(`Initial size: ${initialSize}, Final size: ${finalSize}, New words: ${newWordsCount}, Processed: ${processedWordsCount}, Skipped: ${skippedWordsCount}`);
    } else {
      console.log(`Initial size: ${initialSize}, Final size: ${finalSize}, New words: ${newWordsCount}, Processed: ${processedWordsCount} (validation skipped - adapter/dictionary not available)`);
    }
    this.notifySidebarUpdate();
    return { newWordsCount, processedWordsCount };
  }

  async markMultipleWordsAsUnknown(words) {
    const currentSet = this.getCurrentLanguageKnownWords();
    words.forEach(word => {
      const normalizedWord = this.normalizeWord(word);
      if (normalizedWord) {
        currentSet.delete(normalizedWord);
      }
    });
    await this.saveKnownWords();
    console.log(`Marked multiple words as unknown (${this.currentLanguage}):`, words);
    this.notifySidebarUpdate();
  }

  notifySidebarUpdate() {
    // Notify sidebar manager of vocabulary changes
    if (window.sidebarManager && window.sidebarManager.onVocabUpdate) {
      // Use a small delay to ensure processing is complete
      setTimeout(() => {
        window.sidebarManager.onVocabUpdate();
      }, 100);
    }

    // Also trigger page reprocess to update highlighting instantly
    if (window.pageProcessor && window.pageProcessor.reprocessPage) {
      // Use requestAnimationFrame for instant visual update
      requestAnimationFrame(() => {
        window.pageProcessor.reprocessPage();
      });
    }

    // Dispatch custom event for video subtitle underlining updates
    document.dispatchEvent(new CustomEvent('helios-vocab-updated'));
  }

  getKnownWordsCount() {
    return this.getCurrentLanguageKnownWords().size;
  }

  getAllKnownWords() {
    return [...this.getCurrentLanguageKnownWords()];
  }

  async clearAllKnownWords() {
    this.getCurrentLanguageKnownWords().clear();
    this.getCurrentLanguageIgnoredWords().clear();
    await this.saveKnownWords();
    console.log(`All known words cleared for language: ${this.currentLanguage}`);
  }

  // Get all known words across all languages
  getAllKnownWordsAllLanguages() {
    const allWords = {};
    Object.keys(this.knownWordsByLanguage).forEach(lang => {
      allWords[lang] = [...this.knownWordsByLanguage[lang]];
    });
    return allWords;
  }

  /**
   * Track a word lookup for the recent vocabulary list
   * @param {string} word - Word that was looked up
   * @param {object} definition - Definition data
   */
  trackWordLookup(word, definition = null) {
    if (!word) return;

    // Normalize word for consistent tracking
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;

    // Non-blocking: don't await, just fire and forget
    const storageKey = `recentVocab_${this.currentLanguage}`;

    chrome.storage.local.get([storageKey], (result) => {
      let recentWords = result[storageKey] || [];

      // Remove if already exists (to move to front) - compare normalized
      recentWords = recentWords.filter(item => this.normalizeWord(item.word) !== normalizedWord);

      // Extract definition from various dictionary formats
      let definitionText = null;
      if (definition) {
        if (typeof definition === 'string') {
          // Already a string
          definitionText = definition;
        } else if (definition.english) {
          // Chinese dictionary format
          definitionText = definition.english;
        } else if (definition.definition) {
          // French/Spanish/English format - definition field
          definitionText = definition.definition;
        } else if (definition.translation) {
          // Fallback to translation field
          definitionText = definition.translation;
        }

        // Truncate long definitions for cleaner display
        if (definitionText) {
          // Split by semicolon or comma and take first part
          const firstPart = definitionText.split(/[;,]/)[0].trim();

          // If still too long, truncate at 70 characters
          if (firstPart.length > 70) {
            definitionText = firstPart.substring(0, 70).trim() + '...';
          } else {
            definitionText = firstPart;
          }
        }
      }

      // Add to front (store normalized word)
      recentWords.unshift({
        word: normalizedWord,
        definition: definitionText,
        timestamp: Date.now(),
        language: this.currentLanguage
      });

      // Keep only last 20 words
      recentWords = recentWords.slice(0, 20);

      chrome.storage.local.set({ [storageKey]: recentWords }, () => {
        console.log(`✅ Tracked word lookup: ${normalizedWord} (${this.currentLanguage}) - Def: "${definitionText}" - Total: ${recentWords.length}`);
      });
    });
  }
}