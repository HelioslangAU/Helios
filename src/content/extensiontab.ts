// Helios Extension Tab TypeScript - with Sunset/Sunrise Effect

import { browser } from 'wxt/browser';

import { items, recentVocabItem, storage, type VocabEntry } from '@/config/storage';

/** A saved vocabulary entry as stored in local storage. */
interface VocabItem extends VocabEntry {
  word: string;
  character?: string;
  definition?: any;
  pinyin?: string;
  dateAdded?: string;
  reviewCount?: number;
}

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
        const response = await browser.runtime.sendMessage({
          action: "toggleExtension",
          enabled: newState,
        });

        if (response && response.success) {
          console.log("Extension", newState ? "enabled" : "disabled");
          // Also update storage directly for consistency
          await items.extensionEnabled.setValue(newState);
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
    items.extensionEnabled.getValue().then((isEnabled) => {
      if (isEnabled) {
        extensionToggle.classList.add("active");
      } else {
        extensionToggle.classList.remove("active");
      }

      // Apply the appropriate visual state
      applyExtensionState(isEnabled);

      console.log("Loaded extension state:", isEnabled);
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      openHeliosSettings();
    });
  }
}


/** Short display names for the recent-lookups badge. */
const LANGUAGE_LABELS: Record<string, string> = {
  zh: '\u4e2d\u6587',
  en: 'English',
  es: 'Espa\u00f1ol',
  fr: 'Fran\u00e7ais',
  vi: 'Ti\u1ebfng Vi\u1ec7t',
  ko: '\ud55c\uad6d\uc5b4',
  ja: '\u65e5\u672c\u8a9e',
  de: 'Deutsch',
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

export function loadVocabularyList(): void {
  const vocabList = document.getElementById("vocab-list");
  const languageName = document.getElementById("current-language");

  if (!vocabList) return;

  items.targetLanguage.getValue().then(async (targetLanguage) => {
    const currentLanguage = targetLanguage || 'en';

    // Load recent vocabulary for current language
    const vocabItems = (await recentVocabItem(currentLanguage).getValue()) as VocabItem[];

    if (languageName) {
      languageName.textContent = languageLabel(currentLanguage);
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
}

export function addToVocabList(character: string, definition: any = null, pinyin: string | null = null): void {
  items.chineseExtensionVocabList.getValue().then((stored) => {
    const vocabItems = stored as VocabItem[];

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

      items.chineseExtensionVocabList.setValue(vocabItems).then(() => {
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
  items.chineseExtensionVocabList.getValue().then((stored) => {
    const filteredItems = (stored as VocabItem[]).filter(
      (item) => (item.character || item.word) !== word
    );

    items.chineseExtensionVocabList.setValue(filteredItems).then(() => {
      loadVocabularyList();
      console.log(`Removed ${word} from vocabulary list`);
    });
  });
}

export function removeRecentVocabItem(word: string | null, language: string): void {
  const recentVocab = recentVocabItem(language);

  recentVocab.getValue().then((stored) => {
    const filteredItems = (stored as VocabItem[]).filter((item) => item.word !== word);

    recentVocab.setValue(filteredItems).then(() => {
      loadVocabularyList();
      console.log(`Removed ${word} from recent vocabulary`);
    });
  });
}

// Open Helios Settings
export function openHeliosSettings(): void {
  try {
    // Settings now live on the WXT options page
    browser.runtime.openOptionsPage();
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
  storage
    .getItems([items.todayLookupCount, items.lastResetDate])
    .then(([{ value: todayLookupCount }, { value: lastResetDate }]) => {
      const today = new Date().toDateString();
      const lastReset = lastResetDate || "";
      let lookupCount: number = todayLookupCount;

      if (lastReset !== today) {
        lookupCount = 0;
      }

      lookupCount++;

      storage.setItems([
        { item: items.todayLookupCount, value: lookupCount },
        { item: items.lastResetDate, value: today },
      ]).then(() => {
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
          "No valid Chinese characters found. Please enter Chinese words!"
        );
        return;
      }

      items.chineseExtensionKnownWords.getValue().then((stored) => {
        const current = new Set<string>(stored);
        const newWords = words.filter((w) => !current.has(w));

        words.forEach((w) => current.add(w));

        items.chineseExtensionKnownWords.setValue(Array.from(current)).then(() => {
          alert(
            `✅ Added ${newWords.length} new words! Total: ${current.size} words known.`
          );
          oldInput.value = "";
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


  // Listen for storage changes to update UI in real-time.
  // Raw `onChanged` rather than per-item watches: the recent-vocab keys are
  // per-language, so this has to scan the changed key names by prefix.
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
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
});

// Debug function to check storage state
export function debugStorageState(): void {
  storage.getItems([
    items.chineseExtensionKnownWords,
    items.chineseExtensionIgnoredWords,
    items.knownWordsByLanguage,
    items.ignoredWordsByLanguage,
    items.targetLanguage,
  ]).then(([
    { value: chineseExtensionKnownWords },
    { value: chineseExtensionIgnoredWords },
    { value: knownWordsByLanguage },
    { value: ignoredWordsByLanguage },
    { value: targetLanguage },
  ]) => {
    console.log('🔍 Storage Debug:');
    console.log('Current Language:', targetLanguage);
    console.log('---OLD FORMAT---');
    console.log('Known words (old):', chineseExtensionKnownWords);
    console.log('Ignored words (old):', chineseExtensionIgnoredWords);
    console.log('---NEW FORMAT---');
    console.log('Known words by language:', knownWordsByLanguage);
    console.log('Ignored words by language:', ignoredWordsByLanguage);
    const currentLang = targetLanguage || 'en';
    console.log(`Current language (${currentLang}) known words:`, knownWordsByLanguage[currentLang] || []);
  });
}
