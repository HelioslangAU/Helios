class VocabManager {
  constructor() {
    // Support per-language known words
    // Format: { 'zh': Set(), 'en': Set(), 'fr': Set(), 'es': Set() }
    this.knownWordsByLanguage = {
      'zh': new Set(),
      'en': new Set(),
      'fr': new Set(),
      'es': new Set()
    };
    this.ignoredWordsByLanguage = {
      'zh': new Set(),
      'en': new Set(),
      'fr': new Set(),
      'es': new Set()
    };

    // Deprecated: Keep for backward compatibility during migration
    this.knownWords = new Set();
    this.ignoredWords = new Set();

    // Current language for operations
    this.currentLanguage = 'zh';
  }

  setCurrentLanguage(languageCode) {
    this.currentLanguage = languageCode || 'zh';
    console.log('VocabManager: Current language set to', this.currentLanguage);
  }

  getCurrentLanguageKnownWords() {
    return this.knownWordsByLanguage[this.currentLanguage] || new Set();
  }

  getCurrentLanguageIgnoredWords() {
    return this.ignoredWordsByLanguage[this.currentLanguage] || new Set();
  }

  async loadKnownWords() {
    try {
      console.log(`VocabManager: Loading known words for language: ${this.currentLanguage}`);

      // Load new per-language format
      const newResult = await chrome.storage.local.get([
        'knownWordsByLanguage',
        'ignoredWordsByLanguage'
      ]);

      // Load old format for migration
      const oldResult = await chrome.storage.local.get([
        'chineseExtensionKnownWords',
        'chineseExtensionIgnoredWords'
      ]);

      // Load new format if available
      if (newResult.knownWordsByLanguage) {
        Object.keys(newResult.knownWordsByLanguage).forEach(lang => {
          this.knownWordsByLanguage[lang] = new Set(newResult.knownWordsByLanguage[lang]);
        });
        console.log('Known words loaded (per-language format):', this.knownWordsByLanguage);
      }

      if (newResult.ignoredWordsByLanguage) {
        Object.keys(newResult.ignoredWordsByLanguage).forEach(lang => {
          this.ignoredWordsByLanguage[lang] = new Set(newResult.ignoredWordsByLanguage[lang]);
        });
        console.log('Ignored words loaded (per-language format):', this.ignoredWordsByLanguage);
      }

      // Migrate old format if exists and new format doesn't exist
      // Migrate to CURRENT language (not hardcoded to 'zh')
      if (oldResult.chineseExtensionKnownWords && !newResult.knownWordsByLanguage) {
        console.log(`Migrating old known words to ${this.currentLanguage} language...`);
        this.knownWordsByLanguage[this.currentLanguage] = new Set(oldResult.chineseExtensionKnownWords);
        this.knownWords = new Set(oldResult.chineseExtensionKnownWords); // Keep for compatibility
        await this.saveKnownWords(); // Save in new format
      }

      if (oldResult.chineseExtensionIgnoredWords && !newResult.ignoredWordsByLanguage) {
        console.log(`Migrating old ignored words to ${this.currentLanguage} language...`);
        this.ignoredWordsByLanguage[this.currentLanguage] = new Set(oldResult.chineseExtensionIgnoredWords);
        this.ignoredWords = new Set(oldResult.chineseExtensionIgnoredWords); // Keep for compatibility
        await this.saveKnownWords(); // Save in new format
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

      await chrome.storage.local.set({
        knownWordsByLanguage: knownWordsObj,
        ignoredWordsByLanguage: ignoredWordsObj,
        // Keep old format for backward compatibility
        // Save current language words to old format (or Chinese if current is Chinese)
        chineseExtensionKnownWords: [...(this.knownWordsByLanguage[this.currentLanguage] || this.knownWordsByLanguage.zh || [])],
        chineseExtensionIgnoredWords: [...(this.ignoredWordsByLanguage[this.currentLanguage] || this.ignoredWordsByLanguage.zh || [])]
      });
      console.log(`Known words saved to extension storage (per-language). Current language: ${this.currentLanguage}`);
    } catch (error) {
      console.warn('Could not save known words:', error);
    }
  }

  async clearKnownWords() {
    this.knownWords.clear();
    try {
      await chrome.storage.local.set({ chineseExtensionKnownWords: [], chineseExtensionIgnoredWords: [] });
      console.log('Known words cleared in extension storage');
    } catch (error) {
      console.warn('Could not clear known words:', error);
    }
  }

  exportKnownWordsToFile() {
    const data = {
      knownWords: [...this.knownWords],
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chinese-known-words.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Export known words as a JSON string (for programmatic use)
  exportKnownWordsAsJson() {
    const data = {
      knownWords: [...this.knownWords],
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  async importKnownWordsFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.knownWords && Array.isArray(data.knownWords)) {
        this.knownWords = new Set(data.knownWords);
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
        this.knownWords = new Set([...this.knownWords, ...data.knownWords]);
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
    this.getCurrentLanguageKnownWords().add(word);
    this.knownWords.add(word); // Keep for backward compatibility
    await this.saveKnownWords();
    console.log(`Marked word as known (${this.currentLanguage}):`, word);
    this.notifySidebarUpdate();
  }

  async markWordAsUnknown(word) {
    this.getCurrentLanguageKnownWords().delete(word);
    this.knownWords.delete(word); // Keep for backward compatibility
    await this.saveKnownWords();
    console.log(`Marked word as unknown (${this.currentLanguage}):`, word);
    this.notifySidebarUpdate();
  }

  async markWordAsIgnored(word) {
    this.getCurrentLanguageIgnoredWords().add(word);
    this.ignoredWords.add(word); // Keep for backward compatibility
    await this.saveKnownWords();
    console.log(`Marked word as ignored (${this.currentLanguage}):`, word);
  }

  async markWordAsUnignored(word) {
    this.getCurrentLanguageIgnoredWords().delete(word);
    this.ignoredWords.delete(word); // Keep for backward compatibility
    await this.saveKnownWords();
    console.log(`Marked word as unignored (${this.currentLanguage}):`, word);
  }

  isWordKnown(word) {
    return this.getCurrentLanguageKnownWords().has(word);
  }

  isWordIgnored(word) {
    return this.getCurrentLanguageIgnoredWords().has(word);
  }

  // Batch operations for better performance
  async markMultipleWordsAsKnown(words) {
    const currentSet = this.getCurrentLanguageKnownWords();
    words.forEach(word => {
      currentSet.add(word);
      this.knownWords.add(word); // Keep for backward compatibility
    });
    await this.saveKnownWords();
    console.log(`Marked multiple words as known (${this.currentLanguage}):`, words);
    this.notifySidebarUpdate();
  }

  async markMultipleWordsAsUnknown(words) {
    const currentSet = this.getCurrentLanguageKnownWords();
    words.forEach(word => {
      currentSet.delete(word);
      this.knownWords.delete(word); // Keep for backward compatibility
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
    this.knownWords.clear(); // Keep for backward compatibility
    this.ignoredWords.clear(); // Keep for backward compatibility
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

    // Non-blocking: don't await, just fire and forget
    const storageKey = `recentVocab_${this.currentLanguage}`;

    chrome.storage.local.get([storageKey], (result) => {
      let recentWords = result[storageKey] || [];

      // Remove if already exists (to move to front)
      recentWords = recentWords.filter(item => item.word !== word);

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

      // Add to front
      recentWords.unshift({
        word: word,
        definition: definitionText,
        timestamp: Date.now(),
        language: this.currentLanguage
      });

      // Keep only last 20 words
      recentWords = recentWords.slice(0, 20);

      chrome.storage.local.set({ [storageKey]: recentWords }, () => {
        console.log(`✅ Tracked word lookup: ${word} (${this.currentLanguage}) - Def: "${definitionText}" - Total: ${recentWords.length}`);
      });
    });
  }
}