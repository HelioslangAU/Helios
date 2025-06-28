function updateKnownWordsCounter() {
  const counter = document.getElementById('vocab-count');
  if (!counter) return;
  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['chineseExtensionKnownWords'], result => {
      const arr = result.chineseExtensionKnownWords || [];
      counter.textContent = Array.isArray(arr) ? arr.length : 0;
    });
  } else {
    counter.textContent = 0;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('Extension tab loaded');
  updateKnownWordsCounter();
  const updateBtn = document.getElementById('update-known-words-btn');
  const input = document.getElementById('known-words-input');

  if (updateBtn && input) { 
    updateBtn.addEventListener('click', async () => {
      const raw = input.value;
      if (!raw.trim()) return;
      const words = raw.split(/[^\u4e00-\u9fff]+/).map(w => w.trim()).filter(Boolean);
      if (words.length) {
        // Get current known words from storage
        chrome.storage.local.get(['chineseExtensionKnownWords'], result => {
          const current = new Set(result.chineseExtensionKnownWords || []);
          words.forEach(w => current.add(w));
          chrome.storage.local.set({ chineseExtensionKnownWords: Array.from(current) }, () => {
            alert(`Added ${words.length} words to known words.`);
            input.value = '';
            updateKnownWordsCounter();
          });
        });
      } else {
        alert('No valid words found.');
      }
    });
  }
});