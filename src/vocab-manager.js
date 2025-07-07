class VocabManager {
  constructor() {
    this.knownWords = new Set();
    this.ignoredWords = new Set();
  }

  async loadKnownWords() {
    try {
      const result = await chrome.storage.local.get(['chineseExtensionKnownWords', 'chineseExtensionIgnoredWords']);
      if (result.chineseExtensionKnownWords) {
        this.knownWords = new Set(result.chineseExtensionKnownWords);
        console.log('Known words loaded from extension storage');
        console.log(this.knownWords);
      } else {
        this.knownWords = new Set();
        console.log('No known words found in extension storage, starting fresh');
      }
      
      if (result.chineseExtensionIgnoredWords) {
        this.ignoredWords = new Set(result.chineseExtensionIgnoredWords);
        console.log('Ignored words loaded from extension storage');
        console.log(this.ignoredWords);
      } else {
        this.ignoredWords = new Set();
        console.log('No ignored words found in extension storage, starting fresh');
      }
    } catch (err) {
      console.warn('Failed to load known words from extension storage.', err);
      this.knownWords = new Set();
      this.ignoredWords = new Set();
    }
  }

  async saveKnownWords() {
    try {
      await chrome.storage.local.set({
        chineseExtensionKnownWords: [...this.knownWords],
        chineseExtensionIgnoredWords: [...this.ignoredWords]
      });
      console.log('Known and ignored words saved to extension storage');
    } catch (error) {
      console.warn('Could not save known words:', error);
    }
  }

  async clearKnownWords() {
    this.knownWords.clear();
    this.ignoredWords.clear();
    try {
      await chrome.storage.local.set({ 
        chineseExtensionKnownWords: [],
        chineseExtensionIgnoredWords: []
      });
      console.log('Known and ignored words cleared in extension storage');
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

  async markWordAsKnown(word) {
    this.knownWords.add(word);
    await this.saveKnownWords();
    console.log('Marked word as known:', word);
  }

  async markWordAsUnknown(word) {
    this.knownWords.delete(word);
    this.ignoredWords.delete(word);
    await this.saveKnownWords();
    console.log('Marked word as unknown:', word);
  }

  async markWordAsIgnored(word) {
    this.knownWords.delete(word);
    this.ignoredWords.add(word);
    await this.saveKnownWords();
    console.log('Marked word as ignored:', word);
  }

  isWordKnown(word) {
    return this.knownWords.has(word);
  }

  isWordIgnored(word) {
    return this.ignoredWords.has(word);
  }

  getWordStatus(word) {
    if (this.knownWords.has(word)) return 'known';
    if (this.ignoredWords.has(word)) return 'ignored';
    return 'unknown';
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