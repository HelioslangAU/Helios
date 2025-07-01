// Helios Extension Tab JavaScript - Streamlined for New Design

// Extension toggle functionality
function initializeExtensionToggle() {
  const extensionToggle = document.getElementById("extension-toggle");
  const settingsBtn = document.getElementById("settings-btn");

  if (extensionToggle) {
    extensionToggle.addEventListener("click", async () => {
      const isCurrentlyActive = extensionToggle.classList.contains("active");
      const newState = !isCurrentlyActive;

      try {
        // Update UI immediately for responsiveness
        if (newState) {
          extensionToggle.classList.add("active");
        } else {
          extensionToggle.classList.remove("active");
        }

        // Send message to background script (same as settings page)
        if (window.chrome && chrome.runtime) {
          const response = await chrome.runtime.sendMessage({
            action: "toggleExtension",
            enabled: newState,
          });

          if (response && response.success) {
            console.log("Extension", newState ? "enabled" : "disabled");

            // Also update storage directly for consistency
            await chrome.storage.local.set({ extensionEnabled: newState });
          } else {
            // Revert UI if background script failed
            if (newState) {
              extensionToggle.classList.remove("active");
            } else {
              extensionToggle.classList.add("active");
            }
            console.error("Failed to toggle extension:", response?.error);
          }
        } else {
          // Fallback for testing - just update storage
          if (chrome.storage) {
            await chrome.storage.local.set({ extensionEnabled: newState });
          }
          console.log(
            "Extension",
            newState ? "enabled" : "disabled",
            "(fallback mode)"
          );
        }
      } catch (error) {
        // Revert UI on error
        if (newState) {
          extensionToggle.classList.remove("active");
        } else {
          extensionToggle.classList.add("active");
        }
        console.error("Error toggling extension:", error);
      }
    });

    // Load extension state on startup
    if (window.chrome && chrome.storage) {
      chrome.storage.local.get(["extensionEnabled"], (result) => {
        const isEnabled = result.extensionEnabled !== false; // Default to true
        if (isEnabled) {
          extensionToggle.classList.add("active");
        } else {
          extensionToggle.classList.remove("active");
        }
        console.log("Loaded extension state:", isEnabled);
      });
    }
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      openHeliosSettings();
    });
  }
}

function updateKnownWordsCounter() {
  const counter = document.getElementById("vocab-count");
  if (!counter) return;

  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["chineseExtensionKnownWords"], (result) => {
      const arr = result.chineseExtensionKnownWords || [];
      counter.textContent = Array.isArray(arr) ? arr.length : 0;
    });
  } else {
    // Fallback for testing
    counter.textContent = counter.textContent || "4";
  }
}

function loadVocabularyList() {
  const vocabList = document.getElementById("vocab-list");
  const vocabCount =
    document.getElementById("vocab-count-badge") ||
    document.querySelector(".vocab-count");

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

        // Show recent items (limit to 5 for compact design)
        const maxItems = document.body.offsetWidth < 400 ? 5 : 10;
        const recentItems = vocabItems.slice(-maxItems).reverse();

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
    if (vocabList.children.length === 0) {
      vocabList.innerHTML = `
        <div class="vocab-item">
          <div class="vocab-content">
            <div class="vocab-word">模式</div>
            <div class="vocab-definition">mode; pattern; model</div>
          </div>
          <button class="delete-btn" data-word="模式">×</button>
        </div>
        <div class="vocab-item">
          <div class="vocab-content">
            <div class="vocab-word">有</div>
            <div class="vocab-definition">to have; there is; (bound form) having; with; -ful; -ed; -al (as in 有意 [you3yi4] intentional)</div>
          </div>
          <button class="delete-btn" data-word="有">×</button>
        </div>
      `;
    }

    if (vocabCount) {
      vocabCount.textContent = "2 total";
    }

    // Add delete functionality for fallback
    vocabList.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.target.closest(".vocab-item").remove();
      });
    });
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

// Open Helios Settings (updated from Anki Settings)
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

// Legacy functions for compatibility (these are removed from UI but kept for backwards compatibility)
function updateSessionCounter() {
  // Removed from UI but kept for compatibility
  console.log("Session counter removed from streamlined UI");
}

function updateProgress() {
  // Removed from UI but kept for compatibility
  console.log("Progress section removed from streamlined UI");
}

function exportData() {
  // Removed from UI but kept for compatibility
  console.log("Export feature removed from streamlined UI");
}

function openReview() {
  // Removed from UI but kept for compatibility
  console.log("Review feature removed from streamlined UI");
}

// Function to increment session counter when words are looked up (still used internally)
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

// Initialize everything when DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
  console.log("Helios Extension tab loaded ☀️");

  // Initialize new toggle functionality
  initializeExtensionToggle();

  // Update core data
  updateKnownWordsCounter();
  loadVocabularyList();

  // Handle old UI elements if they still exist (for backwards compatibility)
  const oldUpdateBtn = document.getElementById("update-known-words-btn");
  const oldInput = document.getElementById("known-words-input");

  if (oldUpdateBtn && oldInput) {
    oldUpdateBtn.addEventListener("click", async () => {
      const raw = oldInput.value;
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
            oldInput.value = "";
            updateKnownWordsCounter();
          }
        );
      });
    });
  }

  // Handle other old buttons if they exist
  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportData);
  }

  const reviewBtn = document.getElementById("review-btn");
  if (reviewBtn) {
    reviewBtn.addEventListener("click", openReview);
  }

  // Handle old Anki settings button (for backwards compatibility)
  const ankiSettingsBtn = document.getElementById("anki-settings-btn");
  if (ankiSettingsBtn) {
    ankiSettingsBtn.addEventListener("click", openHeliosSettings);
  }

  // Set up periodic updates (every 30 seconds)
  setInterval(() => {
    updateKnownWordsCounter();
  }, 30000);

  // Listen for storage changes to update UI in real-time
  if (window.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        if (changes.chineseExtensionKnownWords) {
          updateKnownWordsCounter();
        }
        if (changes.chineseExtensionVocabList) {
          loadVocabularyList();
        }
        if (changes.extensionEnabled) {
          // Update toggle state if changed from elsewhere
          const toggle = document.getElementById("extension-toggle");
          if (toggle) {
            if (changes.extensionEnabled.newValue) {
              toggle.classList.add("active");
            } else {
              toggle.classList.remove("active");
            }
          }
        }
      }
    });
  }
});

// Make functions globally available for debugging and external use
window.heliosExtension = {
  updateKnownWordsCounter,
  loadVocabularyList,
  addToVocabList,
  incrementSessionCounter,
  openHeliosSettings,
  removeVocabItem,
  initializeExtensionToggle,
  // Legacy functions (removed from UI but kept for compatibility)
  updateSessionCounter,
  updateProgress,
  exportData,
  openReview,
};
