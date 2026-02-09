class VocabManager {
  constructor() {
    // Support per-language known words - dynamically created as needed
    // Format: { 'zh': Set(), 'en': Set(), 'fr': Set(), ... }
    this.knownWordsByLanguage = {};
    this.ignoredWordsByLanguage = {};
    this.learningWordsByLanguage = {};

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

  getCurrentLanguageLearningWords() {
    // Create set for current language if it doesn't exist (lazy initialization)
    if (!this.learningWordsByLanguage[this.currentLanguage]) {
      this.learningWordsByLanguage[this.currentLanguage] = new Set();
    }
    return this.learningWordsByLanguage[this.currentLanguage];
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
        'ignoredWordsByLanguage',
        'learningWordsByLanguage'
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

      if (newResult.learningWordsByLanguage) {
        Object.keys(newResult.learningWordsByLanguage).forEach(lang => {
          // Normalize words when loading to ensure consistency
          const normalizedWords = newResult.learningWordsByLanguage[lang]
            .map(word => this.normalizeWord(word))
            .filter(word => word); // Filter out invalid words
          
          // Merge with existing Set instead of replacing to preserve in-memory additions
          if (!this.learningWordsByLanguage[lang]) {
            this.learningWordsByLanguage[lang] = new Set(normalizedWords);
          } else {
            // Add words from storage to existing Set (preserves any in-memory additions)
            normalizedWords.forEach(word => {
              this.learningWordsByLanguage[lang].add(word);
            });
          }
        });
        console.log('Learning words loaded (per-language format):', this.learningWordsByLanguage);
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
      const learningWordsObj = {};

      Object.keys(this.knownWordsByLanguage).forEach(lang => {
        knownWordsObj[lang] = [...this.knownWordsByLanguage[lang]];
      });

      Object.keys(this.ignoredWordsByLanguage).forEach(lang => {
        ignoredWordsObj[lang] = [...this.ignoredWordsByLanguage[lang]];
      });

      // Save learning words - include all languages, even if Sets are empty
      Object.keys(this.learningWordsByLanguage).forEach(lang => {
        learningWordsObj[lang] = [...this.learningWordsByLanguage[lang]];
      });
      // Also ensure current language is saved even if Set is empty (to persist deletions)
      if (this.learningWordsByLanguage[this.currentLanguage]) {
        learningWordsObj[this.currentLanguage] = [...this.learningWordsByLanguage[this.currentLanguage]];
      }

      // Get current language words for backward compatibility (fallback to 'zh' if current language doesn't exist)
      const currentKnownWords = this.knownWordsByLanguage[this.currentLanguage] || this.knownWordsByLanguage['zh'] || new Set();
      const currentIgnoredWords = this.ignoredWordsByLanguage[this.currentLanguage] || this.ignoredWordsByLanguage['zh'] || new Set();

      await chrome.storage.local.set({
        knownWordsByLanguage: knownWordsObj,
        ignoredWordsByLanguage: ignoredWordsObj,
        learningWordsByLanguage: learningWordsObj,

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
    this.getCurrentLanguageLearningWords().clear();
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
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    
    // Check if this is a non-lemma word (grammar field will say "non-lemma")
    const dictionary = window.dictionaryManager?.dictionary || {};
    const wordEntries = dictionary[normalizedWord];
    
    if (wordEntries && Array.isArray(wordEntries) && wordEntries.length > 0) {
      // Check if any entry has grammar field set to "non-lemma"
      const nonLemmaEntry = wordEntries.find(entry => 
        entry.grammar === 'non-lemma'
      );
      
      if (nonLemmaEntry) {
        // This is a non-lemma word - get base form from variations
        if (nonLemmaEntry.variations && Array.isArray(nonLemmaEntry.variations) && nonLemmaEntry.variations.length > 0) {
          const baseForm = nonLemmaEntry.variations[0];
          const normalizedBaseForm = this.normalizeWord(baseForm);
          
          if (normalizedBaseForm) {
            // Remove non-lemma word from known words if it's there (shouldn't be, but to be safe)
            this.getCurrentLanguageKnownWords().delete(normalizedWord);
            
            // Check if base form is already known
            const isBaseFormKnown = this.isWordKnown(normalizedBaseForm);
            
            if (!isBaseFormKnown) {
              // Add base form to known words
              this.getCurrentLanguageKnownWords().add(normalizedBaseForm);
              console.log(`Marked base form as known (${this.currentLanguage}):`, normalizedBaseForm);
            } else {
              console.log(`Base form already known (${this.currentLanguage}):`, normalizedBaseForm);
            }
            
            // Always add the non-lemma word to ignored words
            this.getCurrentLanguageIgnoredWords().add(normalizedWord);
            console.log(`Marked non-lemma word as ignored (${this.currentLanguage}):`, normalizedWord);
            
            const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
            await this.saveKnownWords();
            const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
            console.log('[Helios VocabManager] saveKnownWords (non-lemma) took', (saveT1 - saveT0).toFixed(1), 'ms');
            this.notifySidebarUpdate(normalizedBaseForm, true);
            const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
            console.log('[Helios VocabManager] markWordAsKnown (non-lemma)', normalizedWord, '->', normalizedBaseForm, 'total', (t1 - t0).toFixed(1), 'ms');
            return;
          }
        }
      }
    }
    
    // If not a non-lemma word, proceed with normal marking
    // Remove from learning and ignored when marking as known
    this.getCurrentLanguageLearningWords().delete(normalizedWord);
    this.getCurrentLanguageIgnoredWords().delete(normalizedWord);
    this.getCurrentLanguageKnownWords().add(normalizedWord);
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (known)', normalizedWord, 'took', (saveT1 - saveT0).toFixed(1), 'ms');
    console.log(`Marked word as known (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate(normalizedWord, true);
    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] markWordAsKnown total for', normalizedWord, 'took', (t1 - t0).toFixed(1), 'ms');
  }

  async markWordAsUnknown(word) {
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    // Remove from all other states when marking as unknown
    this.getCurrentLanguageKnownWords().delete(normalizedWord);
    this.getCurrentLanguageLearningWords().delete(normalizedWord);
    this.getCurrentLanguageIgnoredWords().delete(normalizedWord);
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (unknown)', normalizedWord, 'took', (saveT1 - saveT0).toFixed(1), 'ms');
    console.log(`Marked word as unknown (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate(normalizedWord, false);
    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] markWordAsUnknown total for', normalizedWord, 'took', (t1 - t0).toFixed(1), 'ms');
  }

  async markWordAsIgnored(word) {
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    // Remove from known and learning when marking as ignored
    this.getCurrentLanguageKnownWords().delete(normalizedWord);
    this.getCurrentLanguageLearningWords().delete(normalizedWord);
    this.getCurrentLanguageIgnoredWords().add(normalizedWord);
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (ignored)', normalizedWord, 'took', (saveT1 - saveT0).toFixed(1), 'ms');
    console.log(`Marked word as ignored (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate(normalizedWord, true);
    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] markWordAsIgnored total for', normalizedWord, 'took', (t1 - t0).toFixed(1), 'ms');
  }

  async markWordAsUnignored(word) {
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    this.getCurrentLanguageIgnoredWords().delete(normalizedWord);
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (unignored)', normalizedWord, 'took', (saveT1 - saveT0).toFixed(1), 'ms');
    console.log(`Marked word as unignored (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate(normalizedWord, false);
    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] markWordAsUnignored total for', normalizedWord, 'took', (t1 - t0).toFixed(1), 'ms');
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

  async markWordAsLearning(word) {
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    // Remove from known and ignored when marking as learning
    this.getCurrentLanguageKnownWords().delete(normalizedWord);
    this.getCurrentLanguageIgnoredWords().delete(normalizedWord);
    this.getCurrentLanguageLearningWords().add(normalizedWord);
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (learning)', normalizedWord, 'took', (saveT1 - saveT0).toFixed(1), 'ms');
    console.log(`Marked word as learning (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate(normalizedWord, true);
    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] markWordAsLearning total for', normalizedWord, 'took', (t1 - t0).toFixed(1), 'ms');
  }

  async markWordAsUnlearning(word) {
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return;
    this.getCurrentLanguageLearningWords().delete(normalizedWord);
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (unlearning)', normalizedWord, 'took', (saveT1 - saveT0).toFixed(1), 'ms');
    console.log(`Marked word as unlearning (${this.currentLanguage}):`, normalizedWord);
    this.notifySidebarUpdate(normalizedWord, false);
    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] markWordAsUnlearning total for', normalizedWord, 'took', (t1 - t0).toFixed(1), 'ms');
  }

  isWordLearning(word) {
    const normalizedWord = this.normalizeWord(word);
    if (!normalizedWord) return false;
    return this.getCurrentLanguageLearningWords().has(normalizedWord);
  }

  // Batch operations for better performance
  async markMultipleWordsAsKnown(words) {
    //console.log('Marking multiple words as known:', words);
    // Load all vocabulary data to ensure we have the latest state
    // This prevents overwriting in-memory changes from previous operations
    if (!this.knownWordsByLanguage[this.currentLanguage] || 
        !this.learningWordsByLanguage[this.currentLanguage] ||
        !this.ignoredWordsByLanguage[this.currentLanguage]) {
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
    const currentLearningSet = this.getCurrentLanguageLearningWords();
    const currentIgnoredSet = this.getCurrentLanguageIgnoredWords();
    const initialSize = currentSet.size;
    const initialLearningSize = currentLearningSet.size;
    let processedWordsCount = 0;
    let skippedWordsCount = 0;
    const changedWords = [];
    let removedFromLearning = 0;
    
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
        // Remove from learning and ignored sets when marking as known
        const wasLearning = currentLearningSet.has(normalizedWord);
        const wasIgnored = currentIgnoredSet.has(normalizedWord);
        if (wasLearning) {
          currentLearningSet.delete(normalizedWord);
          removedFromLearning++;
        }
        if (wasIgnored) {
          currentIgnoredSet.delete(normalizedWord);
        }
        // Set.add() adds the word (returns true if new, false if duplicate)
        const wasNew = !currentSet.has(normalizedWord);
        currentSet.add(normalizedWord);
        // Track word if it was new OR if it changed status (was learning/ignored, now known)
        if (wasNew || wasLearning || wasIgnored) {
          changedWords.push(normalizedWord);
        }
      }
    });
    
    const finalSize = currentSet.size;
    const newWordsCount = finalSize - initialSize;
    
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    const finalLearningSize = currentLearningSet.size;
    console.log('[Helios VocabManager] saveKnownWords (multi-known) took', (saveT1 - saveT0).toFixed(1), 'ms', 'for', processedWordsCount, 'processed words');
    console.log(`Marked multiple words as known (${this.currentLanguage}):`, words);
    if (canValidate) {
      console.log(`Known: Initial ${initialSize}, Final ${finalSize}, New ${newWordsCount}, Processed ${processedWordsCount}, Skipped ${skippedWordsCount}`);
      console.log(`Learning: Initial ${initialLearningSize}, Final ${finalLearningSize}, Removed ${removedFromLearning}`);
    } else {
      console.log(`Known: Initial ${initialSize}, Final ${finalSize}, New ${newWordsCount}, Processed ${processedWordsCount} (validation skipped)`);
      console.log(`Learning: Initial ${initialLearningSize}, Final ${finalLearningSize}, Removed ${removedFromLearning}`);
    }
    // Pass changed words to notifySidebarUpdate so it can update styling
    this.notifySidebarUpdate(changedWords.length > 0 ? changedWords : null, true);
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
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (multi-unknown) took', (saveT1 - saveT0).toFixed(1), 'ms', 'for', words.length, 'words');
    console.log(`Marked multiple words as unknown (${this.currentLanguage}):`, words);
    this.notifySidebarUpdate(words, false);
  }

  async markMultipleWordsAsLearning(words) {
    // Only load if we don't have data for the current language yet
    if (!this.learningWordsByLanguage[this.currentLanguage]) {
      await this.loadKnownWords();
    }
    
    // Get language adapter and dictionary for validation
    const languageRegistry = window.languageRegistry;
    const adapter = languageRegistry?.adapters?.get(this.currentLanguage) || languageRegistry?.getAdapter();
    const dictionary = window.dictionaryManager?.dictionary || {};
    
    // Only validate if both adapter and dictionary are available
    const canValidate = adapter && typeof adapter.isValidWord === 'function' && dictionary && Object.keys(dictionary).length > 0;
    
    const currentLearningSet = this.getCurrentLanguageLearningWords();
    const currentKnownSet = this.getCurrentLanguageKnownWords();
    const currentIgnoredSet = this.getCurrentLanguageIgnoredWords();
    const initialSize = currentLearningSet.size;
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
        // Remove from known and ignored when marking as learning
        currentKnownSet.delete(normalizedWord);
        currentIgnoredSet.delete(normalizedWord);
        // Add to learning set
        currentLearningSet.add(normalizedWord);
      }
    });
    
    const finalSize = currentLearningSet.size;
    const newWordsCount = finalSize - initialSize;
    
    const saveT0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    await this.saveKnownWords();
    const saveT1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] saveKnownWords (multi-learning) took', (saveT1 - saveT0).toFixed(1), 'ms', 'for', processedWordsCount, 'processed words');
    console.log(`Marked multiple words as learning (${this.currentLanguage}):`, words);
    if (canValidate) {
      console.log(`Initial size: ${initialSize}, Final size: ${finalSize}, New words: ${newWordsCount}, Processed: ${processedWordsCount}, Skipped: ${skippedWordsCount}`);
    } else {
      console.log(`Initial size: ${initialSize}, Final size: ${finalSize}, New words: ${newWordsCount}, Processed: ${processedWordsCount} (validation skipped - adapter/dictionary not available)`);
    }
    this.notifySidebarUpdate();
    return { newWordsCount, processedWordsCount };
  }

  notifySidebarUpdate(changedWords = null, isKnownOrIgnored = true) {
    const t0 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    // Normalize changedWords to a deduplicated array (or null) so listeners can use it efficiently
    let wordsArray = null;
    if (Array.isArray(changedWords)) {
      if (changedWords.length > 0) {
        // Deduplicate while preserving order
        const seen = new Set();
        wordsArray = changedWords.filter(word => {
          if (!word) return false;
          if (seen.has(word)) return false;
          seen.add(word);
          return true;
        });
      }
    } else if (changedWords) {
      wordsArray = [changedWords];
    }

    const totalChanged = wordsArray ? wordsArray.length : 0;
    if (totalChanged > 0) {
      console.log('[Helios VocabManager] notifySidebarUpdate for', totalChanged, 'words:', wordsArray);
    } else {
      console.log('[Helios VocabManager] notifySidebarUpdate with full-page fallback (no specific changedWords)');
    }

    // Notify sidebar manager of vocabulary changes
    if (window.sidebarManager && window.sidebarManager.onVocabUpdate) {
      // Use a small delay to ensure processing is complete
      setTimeout(() => {
        window.sidebarManager.onVocabUpdate();
      }, 100);
    }

    // Also trigger page highlight update, but avoid full reprocess when we know the words
    if (wordsArray && window.pageProcessor && window.pageProcessor.updateWordStyling) {
      wordsArray.forEach(word => window.pageProcessor.updateWordStyling(word, isKnownOrIgnored));
    } else if (!wordsArray && window.pageProcessor && window.pageProcessor.reprocessPage) {
      // Fallback: full reprocess when we don't know which words changed
      console.warn('[Helios VocabManager] Triggering full pageProcessor.reprocessPage() due to missing changedWords');
      requestAnimationFrame(() => {
        window.pageProcessor.reprocessPage();
      });
    }

    // Dispatch custom event for video subtitle underlining updates, including detail payload
    document.dispatchEvent(new CustomEvent('helios-vocab-updated', {
      detail: {
        words: wordsArray,
        isKnownOrIgnored
      }
    }));

    const t1 = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
    console.log('[Helios VocabManager] notifySidebarUpdate total took', (t1 - t0).toFixed(1), 'ms');
  }

  getKnownWordsCount() {
    return this.getCurrentLanguageKnownWords().size;
  }

  getIgnoredWordsCount() {
    return this.getCurrentLanguageIgnoredWords().size;
  }

  getLearningWordsCount() {
    return this.getCurrentLanguageLearningWords().size;
  }

  getAllKnownWords() {
    return [...this.getCurrentLanguageKnownWords()];
  }

  async clearAllKnownWords() {
    this.getCurrentLanguageKnownWords().clear();
    this.getCurrentLanguageIgnoredWords().clear();
    this.getCurrentLanguageLearningWords().clear();
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
        //console.log(`✅ Tracked word lookup: ${normalizedWord} (${this.currentLanguage}) - Def: "${definitionText}" - Total: ${recentWords.length}`);
      });
    });
  }
}