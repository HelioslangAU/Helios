// Helios Extension Tab JavaScript - Complete Functionality with Helios Settings

function updateKnownWordsCounter() {
  const counter = document.getElementById("vocab-count");
  if (!counter) return;
  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["chineseExtensionKnownWords"], (result) => {
      const arr = result.chineseExtensionKnownWords || [];
      counter.textContent = Array.isArray(arr) ? arr.length : 0;
    });
  } else {
    counter.textContent = 0;
  }
}

function updateSessionCounter() {
  const counter = document.getElementById("session-count");
  if (!counter) return;
  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["todayLookupCount"], (result) => {
      const count = result.todayLookupCount || 0;
      counter.textContent = count;
    });
  } else {
    counter.textContent = 0;
  }
}

function updateProgress() {
  const progressFill = document.querySelector(".progress-fill");
  const progressText = document.querySelector(".progress-text");

  if (!progressFill || !progressText) return;

  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["dailyGoal", "todayLookupCount"], (result) => {
      const goal = result.dailyGoal || 50; // Default goal of 50 lookups per day
      const current = result.todayLookupCount || 0;
      const percentage = Math.min(100, Math.round((current / goal) * 100));

      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${percentage}%`;
    });
  } else {
    progressFill.style.width = "0%";
    progressText.textContent = "0%";
  }
}

function loadVocabularyList() {
  const vocabList = document.getElementById("vocab-list");
  const vocabCount = document.querySelector(".vocab-count");

  if (!vocabList) return;

  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      ["chineseExtensionVocabList", "chineseExtensionKnownWords"],
      (result) => {
        let vocabItems = result.chineseExtensionVocabList || [];
        const knownWords = result.chineseExtensionKnownWords || [];

        // If no vocab list exists, create one from known words for demo purposes
        if (vocabItems.length === 0 && knownWords.length > 0) {
          vocabItems = knownWords.slice(0, 10).map((word) => ({
            character: word,
            word: word,
            definition: "Definition will be loaded when available",
            dateAdded: new Date().toISOString(),
          }));

          // Save this demo list
          chrome.storage.local.set({ chineseExtensionVocabList: vocabItems });
        }

        // Update count
        if (vocabCount) {
          vocabCount.textContent = `${vocabItems.length} total`;
        }

        // Clear existing items
        vocabList.innerHTML = "";

        if (vocabItems.length === 0) {
          vocabList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            Start looking up words to build your vocabulary!
          </div>
        `;
          return;
        }

        // Show recent items (last 10)
        const recentItems = vocabItems.slice(-10).reverse();

        recentItems.forEach((item, index) => {
          const vocabItem = document.createElement("div");
          vocabItem.className = "vocab-item";
          vocabItem.innerHTML = `
          <div class="vocab-content">
            <div class="vocab-word">${item.character || item.word}</div>
            <div class="vocab-definition">${
              item.definition || "Definition will be loaded when available"
            }</div>
          </div>
          <button class="delete-btn" data-word="${
            item.character || item.word
          }">×</button>
        `;
          vocabList.appendChild(vocabItem);
        });

        // Add delete functionality
        vocabList.querySelectorAll(".delete-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const word = e.target.getAttribute("data-word");
            removeVocabItem(word);
          });
        });
      }
    );
  } else {
    // Fallback for testing without chrome extension API
    vocabList.innerHTML = `
      <div class="vocab-item">
        <div class="vocab-content">
          <div class="vocab-word">好</div>
          <div class="vocab-definition">good; appropriate; proper; all right!; (before a verb) easy to; (before a verb) good to; (before...</div>
        </div>
        <button class="delete-btn">×</button>
      </div>
      <div class="vocab-item">
        <div class="vocab-content">
          <div class="vocab-word">结巴</div>
          <div class="vocab-definition">to stutter</div>
        </div>
        <button class="delete-btn">×</button>
      </div>
    `;

    if (vocabCount) {
      vocabCount.textContent = "2 total";
    }
  }
}

function addToVocabList(character, definition = null, pinyin = null) {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
    const vocabItems = result.chineseExtensionVocabList || [];

    // Check if word already exists
    const exists = vocabItems.some(
      (item) => (item.character || item.word) === character
    );

    if (!exists) {
      const newItem = {
        character: character,
        word: character,
        definition: definition || "Definition will be loaded when available",
        pinyin: pinyin || "",
        dateAdded: new Date().toISOString(),
        reviewCount: 0,
      };

      vocabItems.push(newItem);

      chrome.storage.local.set(
        { chineseExtensionVocabList: vocabItems },
        () => {
          console.log(`Added ${character} to vocabulary list`);
          // Update the UI if we're on the extension tab
          if (document.getElementById("vocab-list")) {
            loadVocabularyList();
          }
        }
      );
    }
  });
}

// Function to increment session counter when words are looked up
function incrementSessionCounter() {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(["todayLookupCount", "lastResetDate"], (result) => {
    const today = new Date().toDateString();
    const lastReset = result.lastResetDate || "";
    let lookupCount = result.todayLookupCount || 0;

    // Reset counter if it's a new day
    if (lastReset !== today) {
      lookupCount = 0;
    }

    lookupCount++;

    chrome.storage.local.set(
      {
        todayLookupCount: lookupCount,
        lastResetDate: today,
      },
      () => {
        console.log(`Today's lookup count: ${lookupCount}`);
      }
    );
  });
}

function exportData() {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) {
    alert("Export feature not available in this environment");
    return;
  }

  chrome.storage.local.get(
    ["chineseExtensionKnownWords", "chineseExtensionVocabList"],
    (result) => {
      const data = {
        knownWords: result.chineseExtensionKnownWords || [],
        vocabList: result.chineseExtensionVocabList || [],
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `helios-language-data-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("Data exported successfully");
    }
  );
}

function openReview() {
  // This would typically open a review page or quiz interface
  alert("Review feature coming soon! 📚✨");

  // You could implement this to:
  // - Open a new tab with review exercises
  // - Show a modal with vocabulary quiz
  // - Navigate to a spaced repetition system

  console.log("Review functionality triggered");
}

// UPDATED: Open Helios Settings (was openAnkiSettings)
function openHeliosSettings() {
  try {
    if (window.chrome && chrome.tabs) {
      // Open Helios settings in a new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL("helios-settings.html"),
        active: true,
      });
    } else if (window.chrome && chrome.runtime) {
      // Fallback: try to open using runtime URL
      const settingsUrl = chrome.runtime.getURL("helios-settings.html");
      window.open(
        settingsUrl,
        "_blank",
        "width=1200,height=800,scrollbars=yes,resizable=yes"
      );
    } else {
      // Final fallback - try to navigate in current tab
      window.location.href = chrome.runtime.getURL("helios-settings.html");
    }
    console.log("Opening Helios Settings page ⚙️");
  } catch (error) {
    console.error("Error opening Helios settings:", error);

    // Ultra fallback - try opening Chrome's options page
    try {
      if (chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        alert(
          "Could not open settings. Please right-click the extension icon and select 'Options'."
        );
      }
    } catch (optionsError) {
      console.error("Options page fallback failed:", optionsError);
      alert(
        "Could not open settings. Please check if the extension is properly installed."
      );
    }
  }
}

// Initialize everything when DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
  console.log("Helios Extension tab loaded ☀️");

  // Update all counters and data
  updateKnownWordsCounter();
  updateSessionCounter();
  updateProgress();
  loadVocabularyList();

  // Bulk word update functionality
  const updateBtn = document.getElementById("update-known-words-btn");
  const input = document.getElementById("known-words-input");

  if (updateBtn && input) {
    updateBtn.addEventListener("click", async () => {
      const raw = input.value;
      if (!raw.trim()) {
        alert("Please enter some words first! 📝");
        return;
      }

      const words = raw
        .split(/[^\u4e00-\u9fff]+/)
        .map((w) => w.trim())
        .filter(Boolean);

      if (words.length === 0) {
        alert(
          "No valid Chinese characters found. Please enter Chinese words! 🇨🇳"
        );
        return;
      }

      // Get current known words from storage
      chrome.storage.local.get(["chineseExtensionKnownWords"], (result) => {
        const current = new Set(result.chineseExtensionKnownWords || []);
        const newWords = words.filter((w) => !current.has(w));

        words.forEach((w) => current.add(w));

        chrome.storage.local.set(
          { chineseExtensionKnownWords: Array.from(current) },
          () => {
            alert(
              `✅ Added ${newWords.length} new words! Total: ${current.size} words known.`
            );
            input.value = "";
            updateKnownWordsCounter();
            updateProgress();
          }
        );
      });
    });
  }

  // Export button functionality
  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportData);
  }

  // Review button functionality
  const reviewBtn = document.getElementById("review-btn");
  if (reviewBtn) {
    reviewBtn.addEventListener("click", openReview);
  }

  // UPDATED: Helios Settings button functionality (was anki-settings-btn)
  const settingsBtn = document.getElementById("anki-settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", openHeliosSettings);
  }

  // Set up periodic updates (every 30 seconds)
  setInterval(() => {
    updateKnownWordsCounter();
    updateSessionCounter();
    updateProgress();
  }, 30000);

  // Listen for storage changes to update UI in real-time
  if (window.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        if (changes.chineseExtensionKnownWords) {
          updateKnownWordsCounter();
        }
        if (changes.todayLookupCount) {
          updateSessionCounter();
          updateProgress();
        }
        if (changes.chineseExtensionVocabList) {
          loadVocabularyList();
        }
      }
    });
  }
});

function removeVocabItem(word) {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
    const vocabItems = result.chineseExtensionVocabList || [];
    const filteredItems = vocabItems.filter(
      (item) => (item.character || item.word) !== word
    );

    chrome.storage.local.set(
      { chineseExtensionVocabList: filteredItems },
      () => {
        loadVocabularyList();
        console.log(`Removed ${word} from vocabulary list`);
      }
    );
  });
}

// Make functions globally available for debugging
window.heliosExtension = {
  updateKnownWordsCounter,
  updateSessionCounter,
  updateProgress,
  loadVocabularyList,
  addToVocabList,
  incrementSessionCounter,
  exportData,
  openReview,
  openHeliosSettings, // UPDATED: renamed from openAnkiSettings
};
