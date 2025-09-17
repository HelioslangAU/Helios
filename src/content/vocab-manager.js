class VocabManager {
  constructor() {
    this.knownWords = new Set();
  }

  async loadKnownWords() {
    try {
      const result = await chrome.storage.local.get(['chineseExtensionKnownWords']);
      if (result.chineseExtensionKnownWords) {
        this.knownWords = new Set(result.chineseExtensionKnownWords);
        console.log('Known words loaded from extension storage');
        console.log(this.knownWords);
      } else {
        this.knownWords = new Set();
        console.log('No known words found in extension storage, starting fresh');
      }
    } catch (err) {
      console.warn('Failed to load known words from extension storage.', err);
      this.knownWords = new Set();
    }
  }

  async saveKnownWords() {
    try {
      await chrome.storage.local.set({
        chineseExtensionKnownWords: [...this.knownWords]
      });
      console.log('Known words saved to extension storage');
    } catch (error) {
      console.warn('Could not save known words:', error);
    }
  }

  async clearKnownWords() {
    this.knownWords.clear();
    try {
      await chrome.storage.local.set({ chineseExtensionKnownWords: [] });
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
    this.knownWords.add(word);
    await this.saveKnownWords();
    console.log('Marked word as known:', word);
  }

  async markWordAsUnknown(word) {
    this.knownWords.delete(word);
    await this.saveKnownWords();
    console.log('Marked word as unknown:', word);
  }

  isWordKnown(word) {
    return this.knownWords.has(word);
  }

  // Batch operations for better performance
  async markMultipleWordsAsKnown(words) {
    words.forEach(word => this.knownWords.add(word));
    await this.saveKnownWords();
    console.log('Marked multiple words as known:', words);
  }

  async markMultipleWordsAsUnknown(words) {
    words.forEach(word => this.knownWords.delete(word));
    await this.saveKnownWords();
    console.log('Marked multiple words as unknown:', words);
  }

  getKnownWordsCount() {
    return this.knownWords.size;
  }

  getAllKnownWords() {
    return [...this.knownWords];
  }

  async clearAllKnownWords() {
    this.knownWords.clear();
    await this.saveKnownWords();
    console.log('All known words cleared');
  }
}