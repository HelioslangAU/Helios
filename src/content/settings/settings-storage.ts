// Helios Settings Storage Manager
// Handles all storage operations and settings persistence

import { browser } from 'wxt/browser';

import { items, storage, type VideoPlayerSettings } from '@/config/storage';
import type { HeliosSettingsManager } from '@/content/settings/helios-settings';
import { ShortcutHelper } from '@/content/utils/shortcut-helper';

interface HotkeyConfig {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta?: boolean;
}

export class HeliosSettingsStorage {
  manager: HeliosSettingsManager;

  constructor(manager: HeliosSettingsManager) {
    this.manager = manager;
  }

  async loadAllSettings(): Promise<void> {
    try {
      console.log("🔍 Loading settings from storage...");

      // The settings page merges every persisted key into one bag, including
      // keys the settings form invents at runtime and that no item declares,
      // so this call site reads the whole area rather than named items.
      const result = await browser.storage.local.get(null);

      // Migrate old ytSidebarSettings to new unified videoPlayer settings
      if (result.ytSidebarSettings && !result.videoPlayer) {
        console.log("🔍 Migrating ytSidebarSettings to videoPlayer...");
        const oldSettings = result.ytSidebarSettings as Record<string, any>;

        const migrated: VideoPlayerSettings = {
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
        result.videoPlayer = migrated;

        // Save migrated settings
        await items.videoPlayer.setValue(migrated);
        console.log("🔍 Migration complete:", result.videoPlayer);
      }

      this.manager.settings = { ...this.manager.defaultSettings, ...result };
      console.log(
        "🔍 Settings loaded from Chrome storage:",
        this.manager.settings
      );
    } catch (error) {
      console.error("🔍 Error loading settings:", error);
      this.manager.settings = { ...this.manager.defaultSettings };
    }
  }

  async saveSettings(): Promise<void> {
    try {
      console.log("🔍 Saving settings...");

      // Collect all form values from all loaded tabs
      const formData = this.collectFormData();
      console.log("🔍 Collected form data:", formData);

      // Merge with existing settings
      this.manager.settings = { ...this.manager.settings, ...formData };
      console.log("🔍 Final settings to save:", this.manager.settings);

      // The bag is keyed by whatever the loaded tabs collected, so there is no
      // fixed set of items to route it through — it goes to the area directly.
      await browser.storage.local.set(this.manager.settings);
      console.log("🔍 Settings saved successfully to Chrome storage");

      // Notify other parts of the extension about settings changes
      this.broadcastSettingsChange(formData);
    } catch (error) {
      console.error("🔍 Error saving settings:", error);
    }
  }

  broadcastSettingsChange(changedSettings: Record<string, any>): void {
    // Send message to background script
    browser.runtime
      .sendMessage({
        action: "settingsChanged",
        settings: changedSettings,
      })
      .catch(() => {
        // Background script might not be ready, ignore
      });
  }

  collectFormData(): Record<string, any> {
    const formData: Record<string, any> = {};

    // Collect from all loaded tabs
    this.manager.loadedTabs.forEach((tabName) => {
      const tabElement = document.getElementById(tabName);
      if (tabElement) {
        this.collectTabFormData(tabElement, formData);
      }
    });

    return formData;
  }

  collectTabFormData(tabElement: HTMLElement, formData: Record<string, any>): void {
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
      .querySelectorAll<HTMLInputElement>("input, select, textarea")
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
  collectShortcutsData(tabElement: HTMLElement, formData: Record<string, any>): void {
    // Initialize shortcuts structure
    formData.shortcuts = {
      popup: {},
      video: {}
    };

    // Collect popup shortcuts (now use click-to-record format)
    const popupShortcuts: Record<string, string> = {
      "hotkey-mark-unknown": "markUnknown",
      "hotkey-mark-ignored": "markIgnored",
      "hotkey-mark-known": "markKnown",
      "hotkey-mark-learning": "markLearning",
      "hotkey-anki-add": "ankiAdd"
    };

    Object.entries(popupShortcuts).forEach(([elementId, shortcutKey]) => {
      const element = tabElement.querySelector<HTMLInputElement>(`#${elementId}`);
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
    const videoShortcutMap: Record<string, string> = {
      "video-load": "loadSubtitles",
      "video-panel": "togglePanel",
      "video-youtube": "loadYouTube"
    };

    Object.entries(videoShortcutMap).forEach(([elementId, shortcutKey]) => {
      const element = tabElement.querySelector<HTMLInputElement>(`#${elementId}`);
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
  collectVideoPlayerData(tabElement: HTMLElement, formData: Record<string, any>): void {
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
    const hotkeysEnabled = tabElement.querySelector<HTMLInputElement>("#video-hotkeys-enabled");
    if (hotkeysEnabled) {
      formData.videoPlayer.hotkeysEnabled = hotkeysEnabled.checked;
    }

    const pauseOnHover = tabElement.querySelector<HTMLInputElement>("#video-pause-on-hover");
    if (pauseOnHover) {
      formData.videoPlayer.pauseOnHover = pauseOnHover.checked;
    }

    const pauseAtEnd = tabElement.querySelector<HTMLInputElement>("#video-pause-at-end");
    if (pauseAtEnd) {
      formData.videoPlayer.pauseAtEnd = pauseAtEnd.checked;
    }

    const autoPlayAfterNav = tabElement.querySelector<HTMLInputElement>("#video-auto-play-after-nav");
    if (autoPlayAfterNav) {
      formData.videoPlayer.autoPlayAfterNav = autoPlayAfterNav.checked;
    }

    // Collect hotkeys
    const hotkeyMap: Record<string, string> = {
      "video-hotkey-prev": "previous",
      "video-hotkey-next": "next",
      "video-hotkey-restart": "restart",
      "video-hotkey-toggle": "toggle"
    };

    Object.entries(hotkeyMap).forEach(([elementId, hotkeyKey]) => {
      const element = tabElement.querySelector<HTMLInputElement>(`#${elementId}`);
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
   * Parse hotkey display string to configuration object.
   *
   * Thin wrapper over ShortcutHelper.parseHotkeyDisplay — this is the parse
   * that runs on the *save* path, so it must agree with the matcher the
   * content scripts use (Meta/Cmd recognised, modifiers case-insensitive).
   * The only local work is widening the helper's optional modifier flags into
   * the required booleans HotkeyConfig declares.
   *
   * @param displayString - Display string like "Ctrl+Shift+L"
   * @returns Hotkey configuration object
   */
  parseHotkeyFromDisplay(displayString: string): HotkeyConfig | null {
    const parsed = ShortcutHelper.parseHotkeyDisplay(displayString);
    if (!parsed) return null;

    return {
      key: parsed.key,
      ctrl: !!parsed.ctrl,
      shift: !!parsed.shift,
      alt: !!parsed.alt,
      meta: !!parsed.meta
    };
  }

  getSettingKey(elementId: string): string {
    // Convert element IDs to setting keys
    const keyMap: Record<string, string> = {
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

  async getStatistics(): Promise<{ knownWords: number; totalLookups: number; todayLookups: number; ankiCards: number }> {
    try {
      const [
        { value: knownWords },
        { value: chineseExtensionVocabList },
        { value: totalLookups },
        { value: todayLookupCount },
        { value: ankiCardsCreated },
        { value: lastResetDate },
      ] = await storage.getItems([
        items.knownWords,
        items.chineseExtensionVocabList,
        items.totalLookups,
        items.todayLookupCount,
        items.ankiCardsCreated,
        items.lastResetDate,
      ]);

      const today = new Date().toDateString();
      const lastReset = lastResetDate || "";
      let todayLookups: number = todayLookupCount;

      if (lastReset !== today) {
        todayLookups = 0;
        storage.setItems([
          { item: items.todayLookupCount, value: 0 },
          { item: items.lastResetDate, value: today },
        ]);
      }

      return {
        knownWords: knownWords.length || chineseExtensionVocabList.length || 0,
        totalLookups: totalLookups,
        todayLookups: todayLookups,
        ankiCards: ankiCardsCreated,
      };
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

  async updateKnownWords(knownWords: string[]): Promise<void> {
    try {
      await items.knownWords.setValue(knownWords);
    } catch (error) {
      console.error("Error updating known words:", error);
      throw error;
    }
  }

  async updateVocabularyList(vocabularyList: any[]): Promise<void> {
    try {
      await items.chineseExtensionVocabList.setValue(vocabularyList);
    } catch (error) {
      console.error("Error updating vocabulary list:", error);
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await browser.storage.local.clear();
    } catch (error) {
      console.error("Error clearing all data:", error);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    try {
      // Everything not listed below is cache and is dropped, so the surviving
      // values have to be read out of the whole area before it is cleared —
      // there is no item API for "read everything".
      const result = await browser.storage.local.get(null);

      const itemsToKeep = {
        knownWords: items.knownWords,
        chineseExtensionVocabList: items.chineseExtensionVocabList,
        extensionEnabled: items.extensionEnabled,
        activationKey: items.activationKey,
        popupTheme: items.popupTheme,
        autoHighlight: items.autoHighlight,
      };
      // Written by the settings form under raw names; no item declares them.
      const rawKeysToKeep = ["ankiDeck", "ankiNoteType", "ankiFieldMappings"];

      // Only keys that were actually set are restored: writing an unset key
      // back would persist an item's fallback where nothing was stored before.
      const itemsToRestore = Object.entries(itemsToKeep)
        .filter(([key]) => result[key] !== undefined)
        .map(([key, item]) => ({ item, value: result[key] }));

      const rawToRestore: Record<string, any> = {};
      rawKeysToKeep.forEach((key) => {
        if (result[key] !== undefined) {
          rawToRestore[key] = result[key];
        }
      });

      await browser.storage.local.clear();
      await storage.setItems(itemsToRestore);
      await browser.storage.local.set(rawToRestore);
    } catch (error) {
      console.error("Error clearing cache:", error);
      throw error;
    }
  }
}
