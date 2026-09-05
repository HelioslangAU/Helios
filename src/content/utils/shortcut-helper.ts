/**
 * Shortcut Helper Utility
 * Provides functions to check if keyboard events match configured shortcuts
 */

import { storage } from '@/config/storage';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/** Pre-unification popup hotkey keys, still read as a fallback. */
interface LegacyPopupHotkeys {
  hotkeyMarkUnknown?: string;
  hotkeyMarkIgnored?: string;
  hotkeyMarkKnown?: string;
  hotkeyAnkiAdd?: string;
}

export interface PopupShortcuts {
  markUnknown: string;
  markIgnored: string;
  markKnown: string;
  ankiAdd: string;
}

export class ShortcutHelper {
  /**
   * Check if a keyboard event matches a video shortcut configuration
   * @param event - The keyboard event
   * @param shortcutConfig - Shortcut configuration { key, ctrl, shift, alt, meta }
   * @returns True if the event matches the shortcut
   */
  static matchesVideoShortcut(event: KeyboardEvent, shortcutConfig: ShortcutConfig | null | undefined): boolean {
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
   * @param displayString - Display string like "Ctrl+Shift+L"
   * @returns Hotkey configuration object
   */
  static parseHotkeyDisplay(displayString: string): ShortcutConfig | null {
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
   * @returns Video shortcuts configuration
   */
  static async getVideoShortcuts(): Promise<Record<string, ShortcutConfig>> {
    try {
      const result = await storage.get(['shortcuts']);
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
   * @returns Video navigation shortcuts configuration
   */
  static async getVideoNavigationShortcuts(): Promise<Record<string, ShortcutConfig>> {
    try {
      const result = await storage.get(['shortcuts']);
      const shortcuts = result.shortcuts || {};

      // Return video navigation shortcuts with defaults
      // Handle both object format and display string format
      const navShortcuts: Record<string, ShortcutConfig | string | undefined> =
        shortcuts.videoNavigation || {};
      const defaults: Record<string, ShortcutConfig> = {
        previous: { key: "A", ctrl: false, shift: false, alt: false, meta: false },
        next: { key: "D", ctrl: false, shift: false, alt: false, meta: false },
        restart: { key: "S", ctrl: false, shift: false, alt: false, meta: false },
        toggle: { key: "W", ctrl: false, shift: false, alt: false, meta: false },
        increaseSize: { key: "Equal", ctrl: false, shift: true, alt: false, meta: false },
        decreaseSize: { key: "Minus", ctrl: false, shift: true, alt: false, meta: false }
      };

      // If shortcuts are stored as display strings, parse them
      const parsed: Record<string, ShortcutConfig> = {};
      Object.keys(defaults).forEach(key => {
        const stored = navShortcuts[key];
        if (stored) {
          if (typeof stored === 'string') {
            parsed[key] = this.parseHotkeyDisplay(stored) || defaults[key];
          } else {
            parsed[key] = stored;
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
        toggle: { key: "W", ctrl: false, shift: false, alt: false, meta: false },
        increaseSize: { key: "Equal", ctrl: false, shift: true, alt: false, meta: false },
        decreaseSize: { key: "Minus", ctrl: false, shift: true, alt: false, meta: false }
      };
    }
  }

  /**
   * Check if a keyboard event matches a single-character shortcut (no modifiers)
   * @param event - The keyboard event
   * @param shortcutConfig - Shortcut configuration { key }
   * @returns True if the event matches the shortcut
   */
  static matchesSingleKeyShortcut(event: KeyboardEvent, shortcutConfig: ShortcutConfig | null | undefined): boolean {
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
   * @returns Popup shortcuts configuration
   */
  static async getPopupShortcuts(): Promise<PopupShortcuts> {
    try {
      const result = await storage.get(['shortcuts']);
      const shortcuts = result.shortcuts || {};

      // Return popup shortcuts with defaults, also check legacy format
      const popupShortcuts = shortcuts.popup || {};
      // Legacy `hotkey*` keys are not declared in HeliosStorage, so this read stays raw.
      const legacyResult = await chrome.storage.local.get<LegacyPopupHotkeys>([
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
