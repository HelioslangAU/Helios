// Helios Settings Storage Manager
// Handles all storage operations and settings persistence

class HeliosSettingsStorage {
  constructor(manager) {
    this.manager = manager;
  }

  async loadAllSettings() {
    try {
      console.log("🔍 Loading settings from storage...");

      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(null);
        this.manager.settings = { ...this.manager.defaultSettings, ...result };
        console.log(
          "🔍 Settings loaded from Chrome storage:",
          this.manager.settings
        );
      } else {
        console.log("🔍 Chrome storage not available, using defaults");
        this.manager.settings = { ...this.manager.defaultSettings };
      }
    } catch (error) {
      console.error("🔍 Error loading settings:", error);
      this.manager.settings = { ...this.manager.defaultSettings };
    }
  }

  async saveSettings() {
    try {
      console.log("🔍 Saving settings...");

      // Collect all form values from all loaded tabs
      const formData = this.collectFormData();
      console.log("🔍 Collected form data:", formData);

      // Merge with existing settings
      this.manager.settings = { ...this.manager.settings, ...formData };
      console.log("🔍 Final settings to save:", this.manager.settings);

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set(this.manager.settings);
        console.log("🔍 Settings saved successfully to Chrome storage");

        // Notify other parts of the extension about settings changes
        this.broadcastSettingsChange(formData);
      } else {
        console.log("🔍 Chrome storage not available, settings not persisted");
      }
    } catch (error) {
      console.error("🔍 Error saving settings:", error);
    }
  }

  broadcastSettingsChange(changedSettings) {
    // Send message to background script
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime
        .sendMessage({
          action: "settingsChanged",
          settings: changedSettings,
        })
        .catch(() => {
          // Background script might not be ready, ignore
        });
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

        const settingKey = this.getSettingKey(id);

        if (element.type === "checkbox") {
          formData[settingKey] = element.checked;
          console.log(`🔍 Collected checkbox ${id}: ${element.checked}`);
        } else if (element.type === "number") {
          formData[settingKey] = parseInt(element.value) || 0;
          console.log(`🔍 Collected number ${id}: ${element.value}`);
        } else if (id === "disabled-sites-textarea") {
          formData.disabledSites = element.value
            .split("\n")
            .filter((site) => site.trim())
            .map((site) => site.trim());
          console.log(`🔍 Collected disabled sites: ${formData.disabledSites}`);
        } else {
          formData[settingKey] = element.value;
          console.log(`🔍 Collected ${id}: ${element.value}`);
        }
      });
  }

  getSettingKey(elementId) {
    // Convert element IDs to setting keys
    const keyMap = {
      "extension-enabled": "extensionEnabled",
      "activation-key": "activationKey",
      "auto-highlight": "autoHighlight",
      "popup-theme": "popupTheme",
      "scan-delay": "scanDelay", // Keep for backward compatibility
      "max-word-length": "maxWordLength",
      "prefer-traditional": "preferTraditional",
      "popup-font-size": "popupFontSize",
      "show-frequency": "showFrequency",
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

    const settingKey = keyMap[elementId] || elementId;
    console.log(
      `🔍 Mapped element ID "${elementId}" to setting key "${settingKey}"`
    );
    return settingKey;
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
          "popupTheme",
          "autoHighlight",
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
