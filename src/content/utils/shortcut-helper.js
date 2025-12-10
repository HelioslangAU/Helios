/**
 * Shortcut Helper Utility
 * Provides functions to check if keyboard events match configured shortcuts
 */

class ShortcutHelper {
  /**
   * Check if a keyboard event matches a video shortcut configuration
   * @param {KeyboardEvent} event - The keyboard event
   * @param {Object} shortcutConfig - Shortcut configuration { key, ctrl, shift, alt, meta }
   * @returns {boolean} - True if the event matches the shortcut
   */
  static matchesVideoShortcut(event, shortcutConfig) {
    if (!shortcutConfig || !shortcutConfig.key) return false;

    const eventKey = event.key.toUpperCase();
    const configKey = shortcutConfig.key.toUpperCase();

    // Check if the key matches
    if (eventKey !== configKey) return false;

    // Check modifiers
    const ctrlMatch = shortcutConfig.ctrl ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey);
    const shiftMatch = shortcutConfig.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = shortcutConfig.alt ? event.altKey : !event.altKey;
    const metaMatch = shortcutConfig.meta ? (event.metaKey || event.ctrlKey) : (!event.metaKey && !event.ctrlKey);

    // For Ctrl/Cmd, we allow either ctrl or meta to match (cross-platform)
    if (shortcutConfig.ctrl) {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      return ctrlOrMeta && shiftMatch && altMatch;
    }

    return ctrlMatch && shiftMatch && altMatch && metaMatch;
  }

  /**
   * Parse hotkey display string to configuration object
   * @param {string} displayString - Display string like "Ctrl+Shift+L"
   * @returns {Object|null} - Hotkey configuration object
   */
  static parseHotkeyDisplay(displayString) {
    if (!displayString || typeof displayString !== 'string') return null;

    const parts = displayString.split("+").map(p => p.trim());
    const key = parts[parts.length - 1].toLowerCase();
    const ctrl = parts.includes("Ctrl");
    const shift = parts.includes("Shift");
    const alt = parts.includes("Alt");

    return { key, ctrl, shift, alt, meta: false };
  }

  /**
   * Get video shortcuts from settings
   * @returns {Promise<Object>} - Video shortcuts configuration
   */
  static async getVideoShortcuts() {
    try {
      const result = await chrome.storage.local.get(['shortcuts']);
      const shortcuts = result.shortcuts || {};
      
      // Return video shortcuts with defaults
      return shortcuts.video || {
        loadSubtitles: { key: "L", ctrl: true, shift: true, alt: false, meta: false },
        togglePanel: { key: "S", ctrl: true, shift: true, alt: false, meta: false },
        loadYouTube: { key: "Y", ctrl: true, shift: true, alt: false, meta: false }
      };
    } catch (error) {
      console.error('[ShortcutHelper] Error loading shortcuts:', error);
      // Return defaults
      return {
        loadSubtitles: { key: "L", ctrl: true, shift: true, alt: false, meta: false },
        togglePanel: { key: "S", ctrl: true, shift: true, alt: false, meta: false },
        loadYouTube: { key: "Y", ctrl: true, shift: true, alt: false, meta: false }
      };
    }
  }

  /**
   * Get video navigation shortcuts from settings
   * @returns {Promise<Object>} - Video navigation shortcuts configuration
   */
  static async getVideoNavigationShortcuts() {
    try {
      const result = await chrome.storage.local.get(['shortcuts']);
      const shortcuts = result.shortcuts || {};
      
      // Return video navigation shortcuts with defaults
      // Handle both object format and display string format
      const navShortcuts = shortcuts.videoNavigation || {};
      const defaults = {
        previous: { key: "A", ctrl: false, shift: false, alt: false, meta: false },
        next: { key: "D", ctrl: false, shift: false, alt: false, meta: false },
        restart: { key: "S", ctrl: false, shift: false, alt: false, meta: false },
        toggle: { key: "W", ctrl: false, shift: false, alt: false, meta: false }
      };

      // If shortcuts are stored as display strings, parse them
      const parsed = {};
      Object.keys(defaults).forEach(key => {
        if (navShortcuts[key]) {
          if (typeof navShortcuts[key] === 'string') {
            parsed[key] = this.parseHotkeyDisplay(navShortcuts[key]) || defaults[key];
          } else {
            parsed[key] = navShortcuts[key];
          }
        } else {
          parsed[key] = defaults[key];
        }
      });

      return parsed;
    } catch (error) {
      console.error('[ShortcutHelper] Error loading video navigation shortcuts:', error);
      // Return defaults
      return {
        previous: { key: "A", ctrl: false, shift: false, alt: false, meta: false },
        next: { key: "D", ctrl: false, shift: false, alt: false, meta: false },
        restart: { key: "S", ctrl: false, shift: false, alt: false, meta: false },
        toggle: { key: "W", ctrl: false, shift: false, alt: false, meta: false }
      };
    }
  }

  /**
   * Check if a keyboard event matches a single-character shortcut (no modifiers)
   * @param {KeyboardEvent} event - The keyboard event
   * @param {Object} shortcutConfig - Shortcut configuration { key }
   * @returns {boolean} - True if the event matches the shortcut
   */
  static matchesSingleKeyShortcut(event, shortcutConfig) {
    if (!shortcutConfig || !shortcutConfig.key) return false;

    const eventKey = event.key.toUpperCase();
    const configKey = shortcutConfig.key.toUpperCase();

    // Check if the key matches
    if (eventKey !== configKey) return false;

    // For single-key shortcuts, no modifiers should be pressed
    return !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  }

  /**
   * Get popup shortcuts from settings
   * @returns {Promise<Object>} - Popup shortcuts configuration
   */
  static async getPopupShortcuts() {
    try {
      const result = await chrome.storage.local.get(['shortcuts']);
      const shortcuts = result.shortcuts || {};
      
      // Return popup shortcuts with defaults, also check legacy format
      const popupShortcuts = shortcuts.popup || {};
      const legacyResult = await chrome.storage.local.get([
        'hotkeyMarkUnknown',
        'hotkeyMarkIgnored',
        'hotkeyMarkKnown',
        'hotkeyAnkiAdd'
      ]);
      
      return {
        markUnknown: popupShortcuts.markUnknown || legacyResult.hotkeyMarkUnknown || "1",
        markIgnored: popupShortcuts.markIgnored || legacyResult.hotkeyMarkIgnored || "2",
        markKnown: popupShortcuts.markKnown || legacyResult.hotkeyMarkKnown || "3",
        ankiAdd: popupShortcuts.ankiAdd || legacyResult.hotkeyAnkiAdd || "q"
      };
    } catch (error) {
      console.error('[ShortcutHelper] Error loading popup shortcuts:', error);
      return {
        markUnknown: "1",
        markIgnored: "2",
        markKnown: "3",
        ankiAdd: "q"
      };
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ShortcutHelper = ShortcutHelper;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShortcutHelper;
}

