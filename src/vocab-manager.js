class VocabManager {
  constructor() {
    this.knownWords = new Set();
  }

  async loadKnownWords() {
    try {
      const stored = localStorage.getItem('chineseExtensionKnownWords');
      if (stored) {
        this.knownWords = new Set(JSON.parse(stored));
        console.log('Known words loaded from localStorage');
      } else {
        this.knownWords = new Set();
        console.log('No known words found in localStorage, starting fresh');
      }
    } catch (err) {
      console.warn('Failed to load known words from localStorage.', err);
      this.knownWords = new Set();
    }
  }

  async saveKnownWords() {
    try {
      localStorage.setItem('chineseExtensionKnownWords', JSON.stringify([...this.knownWords]));
    } catch (error) {
      console.warn('Could not save known words:', error);
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

  markWordAsKnown(word) {
    this.knownWords.add(word);
    this.saveKnownWords();
    console.log('Marked word as known:', word);
  }

  markWordAsUnknown(word) {
    this.knownWords.delete(word);
    this.saveKnownWords();
    console.log('Marked word as unknown:', word);
  }

  isWordKnown(word) {
    return this.knownWords.has(word);
  }
}