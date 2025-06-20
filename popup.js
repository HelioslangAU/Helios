// Extension Popup Logic
class ExtensionPopup {
    constructor() {
      this.vocabList = [];
      this.sessionCount = 0;
      this.init();
    }
  
    async init() {
      await this.loadData();
      this.updateDisplay();
      this.setupEventListeners();
    }
  
    async loadData() {
      try {
        const result = await chrome.storage.local.get(['vocabList', 'sessionCount']);
        this.vocabList = result.vocabList || [];
        this.sessionCount = result.sessionCount || 0;
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }
  
    updateDisplay() {
      // Update stats
      document.getElementById('vocab-count').textContent = this.vocabList.length;
      document.getElementById('session-count').textContent = this.sessionCount;
  
      // Update vocabulary list
      const vocabListElement = document.getElementById('vocab-list');
      
      if (this.vocabList.length === 0) {
        vocabListElement.innerHTML = `
          <div class="empty-state">
            Start selecting words on web pages to build your vocabulary!
          </div>
        `;
        return;
      }
  
      // Show recent 10 words
      const recentWords = this.vocabList.slice(-10).reverse();
      vocabListElement.innerHTML = recentWords.map(item => `
        <div class="vocab-item">
          <div>
            <div class="vocab-word">${item.word}</div>
            <div class="vocab-definition">${item.definition}</div>
          </div>
          <button class="delete-btn" data-word="${item.word}">×</button>
        </div>
      `).join('');
  
      // Add delete button listeners
      vocabListElement.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const word = e.target.dataset.word;
          this.deleteWord(word);
        });
      });
    }
  
    async deleteWord(word) {
      this.vocabList = this.vocabList.filter(item => item.word !== word);
      await chrome.storage.local.set({ vocabList: this.vocabList });
      this.updateDisplay();
    }
  
    setupEventListeners() {
      // Export vocabulary
      document.getElementById('export-btn').addEventListener('click', () => {
        this.exportVocabulary();
      });
  
      // Review mode (placeholder for future implementation)
      document.getElementById('review-btn').addEventListener('click', () => {
        this.startReview();
      });
    }
  
    exportVocabulary() {
      if (this.vocabList.length === 0) {
        alert('No vocabulary to export!');
        return;
      }
  
      const csvContent = 'Word,Definition,Pronunciation,Date Added,Review Count\n' +
        this.vocabList.map(item => 
          `"${item.word}","${item.definition}","${item.pronunciation || ''}","${item.dateAdded}","${item.reviewCount}"`
        ).join('\n');
  
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocabulary_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      window.URL.revokeObjectURL(url);
    }
  
    startReview() {
      // This would open a review interface
      // For now, just show an alert
      if (this.vocabList.length === 0) {
        alert('No vocabulary to review!');
        return;
      }
      
      alert(`Ready to review ${this.vocabList.length} words! (Review interface coming soon)`);
    }
  }
  
  // Initialize popup when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    new ExtensionPopup();
  });