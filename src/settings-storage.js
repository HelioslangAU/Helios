// Helios Settings Storage Manager
// Handles all storage operations and settings persistence

class HeliosSettingsStorage {
  constructor(manager) {
    this.manager = manager;
  }

  async loadAllSettings() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(null);
        this.manager.settings = { ...this.manager.defaultSettings, ...result };
      } else {
        this.manager.settings = { ...this.manager.defaultSettings };
      }
      console.log("Settings loaded:", this.manager.settings);
    } catch (error) {
      console.error("Error loading settings:", error);
      this.manager.settings = { ...this.manager.defaultSettings };
    }
  }

  async saveSettings() {
    try {
      // Collect all form values from all loaded tabs
      const formData = this.collectFormData();
      this.manager.settings = { ...this.manager.settings, ...formData };

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set(this.manager.settings);
        console.log("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  collectFormData() {
    const formData = {};

    // Collect from all loaded tabs
    this.manager.loadedTabs.forEach((tabName) => {
      const tabElement = document.getElementById(tabName);
      if (tabElement) {
        this.collectTabFormData(tabElement, formData);
      }
    });

    return formData;
  }

  collectTabFormData(tabElement, formData) {
    // Collect all form inputs from the tab
    tabElement
      .querySelectorAll("input, select, textarea")
      .forEach((element) => {
        const id = element.id;
        if (!id) return;

        if (element.type === "checkbox") {
          formData[this.getSettingKey(id)] = element.checked;
        } else if (element.type === "number") {
          formData[this.getSettingKey(id)] = parseInt(element.value) || 0;
        } else if (id === "disabled-sites-textarea") {
          formData.disabledSites = element.value
            .split("\n")
            .filter((site) => site.trim())
            .map((site) => site.trim());
        } else {
          formData[this.getSettingKey(id)] = element.value;
        }
      });
  }

  getSettingKey(elementId) {
    // Convert element IDs to setting keys
    const keyMap = {
      "extension-enabled": "extensionEnabled",
      "activation-key": "activationKey",
      "auto-highlight": "autoHighlight",
      "scan-delay": "scanDelay",
      "max-word-length": "maxWordLength",
      "prefer-traditional": "preferTraditional",
      "popup-theme": "popupTheme",
      "popup-font-size": "popupFontSize",
      "show-frequency": "showFrequency",
      "show-variants": "showVariants",
      "persistent-popup": "persistentPopup",
      "auto-close-delay": "autoCloseDelay",
      "highlight-style": "highlightStyle",
      "highlight-color": "highlightColor",
      "highlight-intensity": "highlightIntensity",
      "hide-known-sites": "hideKnownSites",
      "anki-deck-select": "ankiDeck",
      "anki-note-type-select": "ankiNoteType",
      "anki-check-duplicates": "ankiCheckDuplicates",
      "anki-include-sentence": "ankiIncludeSentence",
      "processing-mode": "processingMode",
      "cache-dictionary": "cacheDictionary",
      "max-elements": "maxElements",
      "background-processing": "backgroundProcessing",
      "auto-detect-chinese": "autoDetectChinese",
      "work-incognito": "workIncognito",
      "debug-mode": "debugMode",
      "show-metrics": "showMetrics",
    };

    return keyMap[elementId] || elementId;
  }

  async getStatistics() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          "knownWords",
          "chineseExtensionVocabList",
          "totalLookups",
          "todayLookupCount",
          "ankiCardsCreated",
          "lastResetDate",
        ]);

        const today = new Date().toDateString();
        const lastReset = result.lastResetDate || "";
        let todayLookups = result.todayLookupCount || 0;

        if (lastReset !== today) {
          todayLookups = 0;
          chrome.storage.local.set({
            todayLookupCount: 0,
            lastResetDate: today,
          });
        }

        return {
          knownWords:
            result.knownWords?.length ||
            result.chineseExtensionVocabList?.length ||
            0,
          totalLookups: result.totalLookups || 0,
          todayLookups: todayLookups,
          ankiCards: result.ankiCardsCreated || 0,
        };
      }
    } catch (error) {
      console.error("Error getting statistics:", error);
    }

    return {
      knownWords: 0,
      totalLookups: 0,
      todayLookups: 0,
      ankiCards: 0,
    };
  }

  async updateKnownWords(knownWords) {
    try {
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ knownWords });
      }
    } catch (error) {
      console.error("Error updating known words:", error);
      throw error;
    }
  }

  async updateVocabularyList(vocabularyList) {
    try {
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          chineseExtensionVocabList: vocabularyList,
        });
      }
    } catch (error) {
      console.error("Error updating vocabulary list:", error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.clear();
      }
    } catch (error) {
      console.error("Error clearing all data:", error);
      throw error;
    }
  }

  async clearCache() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(null);
        const keysToKeep = [
          "knownWords",
          "chineseExtensionVocabList",
          "extensionEnabled",
          "activationKey",
          "ankiDeck",
          "ankiNoteType",
          "ankiFieldMappings",
        ];

        const dataToKeep = {};
        keysToKeep.forEach((key) => {
          if (result[key] !== undefined) {
            dataToKeep[key] = result[key];
          }
        });

        await chrome.storage.local.clear();
        await chrome.storage.local.set(dataToKeep);
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
      throw error;
    }
  }
}

window.HeliosSettingsStorage = HeliosSettingsStorage;
