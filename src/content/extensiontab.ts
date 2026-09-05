// Helios Extension Tab TypeScript - with Sunset/Sunrise Effect

import { storage, type VocabEntry } from '@/config/storage';

/** A saved vocabulary entry as stored in chrome.storage.local. */
interface VocabItem extends VocabEntry {
  word: string;
  character?: string;
  definition?: any;
  pinyin?: string;
  dateAdded?: string;
  reviewCount?: number;
}

/** Per-language recent lookups live under a runtime key: `recentVocab_<lang>`. */
type RecentVocabStorage = Record<string, VocabItem[] | undefined>;

// Apply extension state styling
export function applyExtensionState(isEnabled: boolean): void {
  const body = document.body;

  if (isEnabled) {
    // Sunrise mode - extension is ON
    body.classList.remove("extension-disabled");
    console.log("🌅 Sunrise mode - Extension enabled");
  } else {
    // Sunset mode - extension is OFF
    body.classList.add("extension-disabled");
    console.log("🌆 Sunset mode - Extension disabled");
  }
}

// Extension toggle functionality with sunset/sunrise effect
export function initializeExtensionToggle(): void {
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

        // Apply sunset/sunrise effect
        applyExtensionState(newState);

        // Send message to background script
        if (window.chrome && chrome.runtime) {
          const response = await chrome.runtime.sendMessage({
            action: "toggleExtension",
            enabled: newState,
          });

          if (response && response.success) {
            console.log("Extension", newState ? "enabled" : "disabled");
            // Also update storage directly for consistency
            await storage.set({ extensionEnabled: newState });
          } else {
            // Revert UI if background script failed
            if (newState) {
              extensionToggle.classList.remove("active");
            } else {
              extensionToggle.classList.add("active");
            }
            // Revert visual state
            applyExtensionState(!newState);
            console.error("Failed to toggle extension:", response?.error);
          }
        } else {
          // Fallback for testing - just update storage
          if (chrome.storage) {
            await storage.set({ extensionEnabled: newState });
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
        // Revert visual state
        applyExtensionState(!newState);
        console.error("Error toggling extension:", error);
      }
    });

    // Load extension state on startup and apply visual state
    if (window.chrome && chrome.storage) {
      storage.get(["extensionEnabled"]).then((result) => {
        const isEnabled = result.extensionEnabled !== false; // Default to true
        if (isEnabled) {
          extensionToggle.classList.add("active");
        } else {
          extensionToggle.classList.remove("active");
        }

        // Apply the appropriate visual state
        applyExtensionState(isEnabled);

        console.log("Loaded extension state:", isEnabled);
      });
    } else {
      // Default to enabled state if no storage available
      applyExtensionState(true);
    }
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      openHeliosSettings();
    });
  }
}

export function updateKnownWordsCounter(): void {
  const counter = document.getElementById("vocab-count");
  if (!counter) return;

  if (window.chrome && chrome.storage && chrome.storage.local) {
    storage.get(["knownWordsByLanguage", "targetLanguage"]).then((result) => {
      const currentLanguage = result.targetLanguage || 'en';
      const knownWordsByLanguage = result.knownWordsByLanguage || {};
      const knownWords = knownWordsByLanguage[currentLanguage] || [];
      counter.textContent = String(Array.isArray(knownWords) ? knownWords.length : 0);
      console.log(`Known words count for ${currentLanguage}:`, knownWords.length);
    });
  } else {
    // Fallback for testing
    counter.textContent = counter.textContent || "4";
  }
}

export function loadVocabularyList(): void {
  const vocabList = document.getElementById("vocab-list");
  const vocabCount =
    document.getElementById("vocab-count-badge") ||
    document.querySelector(".vocab-count");

  if (!vocabList) return;

  if (window.chrome && chrome.storage && chrome.storage.local) {
    storage.get(["targetLanguage"]).then((result) => {
      const currentLanguage = result.targetLanguage || 'en';
      const recentVocabKey = `recentVocab_${currentLanguage}`;

      // Load recent vocabulary for current language
      chrome.storage.local.get<RecentVocabStorage>([recentVocabKey], (vocabResult) => {
        let vocabItems: VocabItem[] = vocabResult[recentVocabKey] || [];

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

        // Show recent items (limit to 10 for compact design)
        const maxItems = document.body.offsetWidth < 400 ? 5 : 10;
        const recentItems = vocabItems.slice(0, maxItems);

        recentItems.forEach((item) => {
          const vocabItem = document.createElement("div");
          vocabItem.className = "vocab-item";

          // Format definition
          let definition = "No definition available";
          if (item.definition && item.definition.english) {
            definition = item.definition.english;
          } else if (item.definition && typeof item.definition === 'string') {
            definition = item.definition;
          }

          // Built with textContent, not innerHTML: words and definitions come from
          // arbitrary page text and must never be parsed as markup.
          const vocabContent = document.createElement("div");
          vocabContent.className = "vocab-content";

          const wordEl = document.createElement("div");
          wordEl.className = "vocab-word";
          wordEl.textContent = String(item.word ?? "");

          const definitionEl = document.createElement("div");
          definitionEl.className = "vocab-definition";
          definitionEl.textContent = String(definition);

          vocabContent.appendChild(wordEl);
          vocabContent.appendChild(definitionEl);

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-btn";
          deleteBtn.setAttribute("data-word", String(item.word ?? ""));
          deleteBtn.textContent = "×";

          vocabItem.appendChild(vocabContent);
          vocabItem.appendChild(deleteBtn);
          vocabList.appendChild(vocabItem);
        });

        // Add delete functionality
        vocabList.querySelectorAll(".delete-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const word = (e.target as HTMLElement).getAttribute("data-word");
            removeRecentVocabItem(word, currentLanguage);
          });
        });
      });
    });
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
        (e.target as HTMLElement).closest(".vocab-item")!.remove();
      });
    });
  }
}

export function addToVocabList(character: string, definition: any = null, pinyin: string | null = null): void {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  storage.get(["chineseExtensionVocabList"]).then((result) => {
    const vocabItems = (result.chineseExtensionVocabList || []) as VocabItem[];

    // Check if word already exists
    const exists = vocabItems.some(
      (item) => (item.character || item.word) === character
    );

    if (!exists) {
      const newItem: VocabItem = {
        character: character,
        word: character,
        definition: definition || "Definition will be loaded when available",
        pinyin: pinyin || "",
        dateAdded: new Date().toISOString(),
        reviewCount: 0,
      };

      vocabItems.push(newItem);

      storage.set({ chineseExtensionVocabList: vocabItems }).then(() => {
        console.log(`Added ${character} to vocabulary list`);
        // Update the UI if we're on the extension tab
        if (document.getElementById("vocab-list")) {
          loadVocabularyList();
        }
      });
    }
  });
}

export function removeVocabItem(word: string): void {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  storage.get(["chineseExtensionVocabList"]).then((result) => {
    const vocabItems = (result.chineseExtensionVocabList || []) as VocabItem[];
    const filteredItems = vocabItems.filter(
      (item) => (item.character || item.word) !== word
    );

    storage.set({ chineseExtensionVocabList: filteredItems }).then(() => {
      loadVocabularyList();
      console.log(`Removed ${word} from vocabulary list`);
    });
  });
}

export function removeRecentVocabItem(word: string | null, language: string): void {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  const recentVocabKey = `recentVocab_${language}`;
  chrome.storage.local.get<RecentVocabStorage>([recentVocabKey], (result) => {
    const vocabItems: VocabItem[] = result[recentVocabKey] || [];
    const filteredItems = vocabItems.filter((item) => item.word !== word);

    storage.setRaw({ [recentVocabKey]: filteredItems }).then(() => {
      loadVocabularyList();
      console.log(`Removed ${word} from recent vocabulary`);
    });
  });
}

// Open Helios Settings
export function openHeliosSettings(): void {
  try {
    // Settings now live on the WXT options page
    chrome.runtime.openOptionsPage();
    console.log("Opening Helios Settings page ⚙️");
  } catch (error) {
    console.error("Error opening Helios settings:", error);
    alert(
      "Could not open settings. Please right-click the extension icon and select 'Options'."
    );
  }
}

// Legacy functions for compatibility
export function updateSessionCounter(): void {
  console.log("Session counter removed from streamlined UI");
}

export function updateProgress(): void {
  console.log("Progress section removed from streamlined UI");
}

export function exportData(): void {
  console.log("Export feature removed from streamlined UI");
}

export function openReview(): void {
  console.log("Review feature removed from streamlined UI");
}

// Function to increment session counter when words are looked up
export function incrementSessionCounter(): void {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;

  storage.get(["todayLookupCount", "lastResetDate"]).then((result) => {
    const today = new Date().toDateString();
    const lastReset = result.lastResetDate || "";
    let lookupCount = result.todayLookupCount || 0;

    if (lastReset !== today) {
      lookupCount = 0;
    }

    lookupCount++;

    storage.set({
      todayLookupCount: lookupCount,
      lastResetDate: today,
    }).then(() => {
      console.log(`Today's lookup count: ${lookupCount}`);
    });
  });
}

// Initialize everything when DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
  console.log("Helios Extension tab loaded ☀️");

  // Initialize toggle functionality with sunset/sunrise effect
  initializeExtensionToggle();

  // Update core data
  updateKnownWordsCounter();
  loadVocabularyList();

  // Handle old UI elements if they still exist (backwards compatibility)
  const oldUpdateBtn = document.getElementById("update-known-words-btn");
  const oldInput = document.getElementById("known-words-input") as HTMLInputElement | null;

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

      storage.get(["chineseExtensionKnownWords"]).then((result) => {
        const current = new Set<string>(result.chineseExtensionKnownWords || []);
        const newWords = words.filter((w) => !current.has(w));

        words.forEach((w) => current.add(w));

        storage.set({ chineseExtensionKnownWords: Array.from(current) }).then(() => {
          alert(
            `✅ Added ${newWords.length} new words! Total: ${current.size} words known.`
          );
          oldInput.value = "";
          updateKnownWordsCounter();
        });
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
        // Update for both old and new storage formats
        if (changes.chineseExtensionKnownWords || changes.knownWordsByLanguage) {
          updateKnownWordsCounter();
        }
        // Update vocab list for old format or any recent vocab change
        if (changes.chineseExtensionVocabList ||
            Object.keys(changes).some(key => key.startsWith('recentVocab_'))) {
          loadVocabularyList();
        }
        if (changes.extensionEnabled) {
          // Update toggle state and visual appearance if changed from elsewhere
          const toggle = document.getElementById("extension-toggle");
          if (toggle) {
            const newState = changes.extensionEnabled.newValue as boolean;
            if (newState) {
              toggle.classList.add("active");
            } else {
              toggle.classList.remove("active");
            }
            // Apply sunset/sunrise effect
            applyExtensionState(newState);
          }
        }
      }
    });
  }
});

// Debug function to check storage state
export function debugStorageState(): void {
  if (window.chrome && chrome.storage && chrome.storage.local) {
    storage.get(['chineseExtensionKnownWords', 'chineseExtensionIgnoredWords', 'knownWordsByLanguage', 'ignoredWordsByLanguage', 'targetLanguage']).then((result) => {
      console.log('🔍 Storage Debug:');
      console.log('Current Language:', result.targetLanguage);
      console.log('---OLD FORMAT---');
      console.log('Known words (old):', result.chineseExtensionKnownWords || []);
      console.log('Ignored words (old):', result.chineseExtensionIgnoredWords || []);
      console.log('---NEW FORMAT---');
      console.log('Known words by language:', result.knownWordsByLanguage || {});
      console.log('Ignored words by language:', result.ignoredWordsByLanguage || {});
      const currentLang = result.targetLanguage || 'en';
      const knownByLang = result.knownWordsByLanguage || {};
      console.log(`Current language (${currentLang}) known words:`, knownByLang[currentLang] || []);
    });
  }
}

// Make functions globally available for debugging and external use
window.heliosExtension = {
  updateKnownWordsCounter,
  loadVocabularyList,
  addToVocabList,
  incrementSessionCounter,
  openHeliosSettings,
  removeVocabItem,
  initializeExtensionToggle,
  applyExtensionState, // New function for sunset/sunrise
  updateSessionCounter,
  updateProgress,
  exportData,
  openReview,
  debugStorageState, // New debug function
};
