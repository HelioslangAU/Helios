// Helios Extension Tab TypeScript - with Sunset/Sunrise Effect

import { browser } from 'wxt/browser';

import { items, recentVocabItem, storage, type VocabEntry } from '@/config/storage';
import { flagSvg } from '@/content/components/language-selector/flags';

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
  document.body.classList.toggle("extension-disabled", !isEnabled);

  // The row says in words what the switch beside it says in position, so the
  // state is legible without having to know which way the knob means on.
  const title = document.getElementById("state-title");
  const note = document.getElementById("state-note");
  if (title) title.textContent = isEnabled ? "Helios is on" : "Helios is off";
  if (note) {
    note.textContent = isEnabled
      ? "Reading the pages you visit"
      : "Nothing is being read or changed";
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

  // The language row is a way into the one setting the popup names.
  document.getElementById("language-row")?.addEventListener("click", () => {
    openHeliosSettings();
  });
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


/**
 * Fill the language row: the flag, the name, and the fact that this is what
 * Helios is currently reading for.
 */
export function renderTargetLanguage(): void {
  const name = document.getElementById('current-language');
  const flag = document.getElementById('current-flag');
  if (!name && !flag) return;

  items.targetLanguage.getValue().then((targetLanguage) => {
    const code = targetLanguage || 'en';
    if (name) name.textContent = languageLabel(code);
    // flagSvg returns our own constant markup, never page text.
    if (flag) flag.innerHTML = flagSvg(code);
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
      console.log(`Removed ${word} from vocabulary list`);
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
  renderTargetLanguage();

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
