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

        // Migrate old ytSidebarSettings to new unified videoPlayer settings
        if (result.ytSidebarSettings && !result.videoPlayer) {
          console.log("🔍 Migrating ytSidebarSettings to videoPlayer...");
          const oldSettings = result.ytSidebarSettings;

          result.videoPlayer = {
            hotkeysEnabled: oldSettings.hotkeysEnabled !== undefined ? oldSettings.hotkeysEnabled : true,
            dualSubtitlesEnabled: oldSettings.dualSubtitlesEnabled !== undefined ? oldSettings.dualSubtitlesEnabled : false,
            secondarySubtitleLanguage: oldSettings.secondarySubtitleLanguage || null,
            pauseOnHover: oldSettings.pauseOnHover !== undefined ? oldSettings.pauseOnHover : true,
            pauseAtEnd: oldSettings.pauseAtEnd !== undefined ? oldSettings.pauseAtEnd : false,
            autoPlayAfterNav: oldSettings.autoPlayAfterNav !== undefined ? oldSettings.autoPlayAfterNav : false,
            hotkeys: oldSettings.hotkeys || {
              previous: { key: "a", shift: false, ctrl: false, alt: false },
              next: { key: "d", shift: false, ctrl: false, alt: false },
              restart: { key: "s", shift: false, ctrl: false, alt: false },
              toggle: { key: "w", shift: false, ctrl: false, alt: false }
            }
          };

          // Save migrated settings
          await chrome.storage.local.set({ videoPlayer: result.videoPlayer });
          console.log("🔍 Migration complete:", result.videoPlayer);
        }

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
    // Special handling for shortcuts tab
    if (tabElement.id === "shortcuts") {
      this.collectShortcutsData(tabElement, formData);
      return;
    }

    // Special handling for video-player tab
    if (tabElement.id === "video-player") {
      this.collectVideoPlayerData(tabElement, formData);
      return;
    }

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

  /**
   * Collect shortcuts data in unified structure
   */
  collectShortcutsData(tabElement, formData) {
    // Initialize shortcuts structure
    formData.shortcuts = {
      popup: {},
      video: {}
    };

    // Collect popup shortcuts (now use click-to-record format)
    const popupShortcuts = {
      "hotkey-mark-unknown": "markUnknown",
      "hotkey-mark-ignored": "markIgnored",
      "hotkey-mark-known": "markKnown",
      "hotkey-mark-learning": "markLearning",
      "hotkey-anki-add": "ankiAdd"
    };

    Object.entries(popupShortcuts).forEach(([elementId, shortcutKey]) => {
      const element = tabElement.querySelector(`#${elementId}`);
      if (element && element.value) {
        const parsed = this.parseHotkeyFromDisplay(element.value);
        if (parsed) {
          formData.shortcuts.popup[shortcutKey] = parsed;
          // Also save legacy format for backward compatibility (just the key)
          formData[`hotkey${shortcutKey.charAt(0).toUpperCase() + shortcutKey.slice(1)}`] = parsed.key || "";
        }
      }
    });

    // Collect video shortcuts (all use click-to-record format)
    const videoShortcutMap = {
      "video-load": "loadSubtitles",
      "video-panel": "togglePanel",
      "video-youtube": "loadYouTube"
    };

    Object.entries(videoShortcutMap).forEach(([elementId, shortcutKey]) => {
      const element = tabElement.querySelector(`#${elementId}`);
      if (element && element.value) {
        const parsed = this.parseHotkeyFromDisplay(element.value);
        if (parsed) {
          formData.shortcuts.video[shortcutKey] = parsed;
        }
      }
    });

    console.log("🔍 Collected shortcuts data:", formData.shortcuts);
  }

  /**
   * Collect video player settings data
   */
  collectVideoPlayerData(tabElement, formData) {
    formData.videoPlayer = {
      hotkeysEnabled: true,
      dualSubtitlesEnabled: false,
      secondarySubtitleLanguage: null,
      pauseOnHover: true,
      pauseAtEnd: false,
      autoPlayAfterNav: false,
      hotkeys: {
        previous: { key: "a", shift: false, ctrl: false, alt: false },
        next: { key: "d", shift: false, ctrl: false, alt: false },
        restart: { key: "s", shift: false, ctrl: false, alt: false },
        toggle: { key: "w", shift: false, ctrl: false, alt: false }
      }
    };

    // Collect checkboxes
    const hotkeysEnabled = tabElement.querySelector("#video-hotkeys-enabled");
    if (hotkeysEnabled) {
      formData.videoPlayer.hotkeysEnabled = hotkeysEnabled.checked;
    }

    const pauseOnHover = tabElement.querySelector("#video-pause-on-hover");
    if (pauseOnHover) {
      formData.videoPlayer.pauseOnHover = pauseOnHover.checked;
    }

    const pauseAtEnd = tabElement.querySelector("#video-pause-at-end");
    if (pauseAtEnd) {
      formData.videoPlayer.pauseAtEnd = pauseAtEnd.checked;
    }

    const autoPlayAfterNav = tabElement.querySelector("#video-auto-play-after-nav");
    if (autoPlayAfterNav) {
      formData.videoPlayer.autoPlayAfterNav = autoPlayAfterNav.checked;
    }

    // Collect hotkeys
    const hotkeyMap = {
      "video-hotkey-prev": "previous",
      "video-hotkey-next": "next",
      "video-hotkey-restart": "restart",
      "video-hotkey-toggle": "toggle"
    };

    Object.entries(hotkeyMap).forEach(([elementId, hotkeyKey]) => {
      const element = tabElement.querySelector(`#${elementId}`);
      if (element && element.value) {
        const parsed = this.parseHotkeyFromDisplay(element.value);
        if (parsed) {
          formData.videoPlayer.hotkeys[hotkeyKey] = parsed;
        }
      }
    });

    // Also save to ytSidebarSettings for backward compatibility
    formData.ytSidebarSettings = { ...formData.videoPlayer };

    // Sync video player hotkeys to shortcuts.videoNavigation for consistency
    // Preserve existing shortcuts, only update videoNavigation
    const existingShortcuts = this.manager.settings.shortcuts || this.manager.defaultSettings.shortcuts;
    formData.shortcuts = {
      ...existingShortcuts,
      videoNavigation: { ...formData.videoPlayer.hotkeys }
    };

    console.log("🔍 Collected video player data:", formData.videoPlayer);
    console.log("🔍 Synced to shortcuts.videoNavigation:", formData.shortcuts.videoNavigation);
  }

  /**
   * Parse hotkey display string to configuration object
   * @param {string} displayString - Display string like "Ctrl+Shift+L"
   * @returns {Object|null} - Hotkey configuration object
   */
  parseHotkeyFromDisplay(displayString) {
    if (!displayString) return null;

    const parts = displayString.split("+").map(p => p.trim());
    const key = parts[parts.length - 1].toLowerCase();
    const ctrl = parts.includes("Ctrl");
    const shift = parts.includes("Shift");
    const alt = parts.includes("Alt");

    return { key, ctrl, shift, alt, meta: false };
  }

  getSettingKey(elementId) {
    // Convert element IDs to setting keys
    const keyMap = {
      "extension-enabled": "extensionEnabled",
      "activation-key": "activationKey",
      "target-language": "targetLanguage",
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
      "hotkey-mark-unknown": "hotkeyMarkUnknown",
      "hotkey-mark-ignored": "hotkeyMarkIgnored",
      "hotkey-mark-known": "hotkeyMarkKnown",
      "hotkey-mark-learning": "hotkeyMarkLearning",
      "hotkey-anki-add": "hotkeyAnkiAdd",
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
