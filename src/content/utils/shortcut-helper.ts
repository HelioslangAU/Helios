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
  markUnknown: ShortcutConfig;
  markIgnored: ShortcutConfig;
  markKnown: ShortcutConfig;
  ankiAdd: ShortcutConfig;
}

/**
 * Popup bindings are stored either as a bare key string (legacy) or as a full
 * binding object (written by the settings page). Normalize to the object form.
 */
function toShortcutConfig(
  stored: string | ShortcutConfig | undefined,
  fallbackKey: string,
): ShortcutConfig {
  if (stored && typeof stored === 'object') return stored;
  return { key: stored || fallbackKey, ctrl: false, shift: false, alt: false, meta: false };
}

/** Build a fresh copy of the video shortcut defaults (fresh so callers can mutate safely). */
function videoShortcutDefaults(): Record<string, ShortcutConfig> {
  return {
    loadSubtitles: { key: "L", ctrl: true, shift: true, alt: false, meta: false },
    togglePanel: { key: "S", ctrl: true, shift: true, alt: false, meta: false },
    loadYouTube: { key: "Y", ctrl: true, shift: true, alt: false, meta: false }
  };
}

export class ShortcutHelper {
  /**
   * Check if a keyboard event matches a video shortcut configuration.
   *
   * `ctrl` and `meta` are treated as one cross-platform "command" modifier: a
   * config asking for either is satisfied by Ctrl *or* Cmd, matching
   * SubtitleOverlay._matchesShortcut. Every other modifier must match exactly.
   *
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

    // Check modifiers. Ctrl/Cmd are interchangeable (cross-platform).
    const ctrlMatch = (shortcutConfig.ctrl || shortcutConfig.meta)
      ? (event.ctrlKey || event.metaKey)
      : (!event.ctrlKey && !event.metaKey);
    const shiftMatch = shortcutConfig.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = shortcutConfig.alt ? event.altKey : !event.altKey;

    return ctrlMatch && shiftMatch && altMatch;
  }

  /**
   * Parse hotkey display string to configuration object
   * Modifier names are matched case-insensitively, and the usual aliases
   * (Control, Cmd/Command for Meta) are accepted.
   *
   * @param displayString - Display string like "Ctrl+Shift+L"
   * @returns Hotkey configuration object
   */
  static parseHotkeyDisplay(displayString: string): ShortcutConfig | null {
    if (!displayString || typeof displayString !== 'string') return null;

    const parts = displayString.split("+").map(p => p.trim());
    const key = parts[parts.length - 1].toLowerCase();
    const lowered = parts.map(p => p.toLowerCase());
    const ctrl = lowered.includes("ctrl") || lowered.includes("control");
    const shift = lowered.includes("shift");
    const alt = lowered.includes("alt");
    const meta = lowered.includes("meta") || lowered.includes("cmd") || lowered.includes("command");

    return { key, ctrl, shift, alt, meta };
  }

  /**
   * Get video shortcuts from settings.
   * Merges per action (like getVideoNavigationShortcuts) so a partially
   * populated stored `video` section cannot unbind the actions it omits.
   * @returns Video shortcuts configuration
   */
  static async getVideoShortcuts(): Promise<Record<string, ShortcutConfig>> {
    const defaults = videoShortcutDefaults();

    try {
      const result = await storage.get(['shortcuts']);
      const shortcuts = result.shortcuts || {};

      const stored: Record<string, ShortcutConfig | undefined> = shortcuts.video || {};

      const merged: Record<string, ShortcutConfig> = {};
      Object.keys(defaults).forEach(key => {
        merged[key] = stored[key] || defaults[key];
      });

      return merged;
    } catch (error) {
      console.error('[ShortcutHelper] Error loading shortcuts:', error);
      // Return defaults
      return defaults;
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
   * Check if a keyboard event matches a navigation shortcut.
   *
   * Named "single key" because the navigation defaults are modifier-free, but
   * it honours whatever modifiers the config declares — a config with every
   * modifier false still requires that no modifier is held, and a config that
   * asks for e.g. Shift now requires Shift instead of forbidding it.
   *
   * @param event - The keyboard event
   * @param shortcutConfig - Shortcut configuration { key, ctrl, shift, alt, meta }
   * @returns True if the event matches the shortcut
   */
  static matchesSingleKeyShortcut(event: KeyboardEvent, shortcutConfig: ShortcutConfig | null | undefined): boolean {
    return this.matchesVideoShortcut(event, shortcutConfig);
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

      // `||` (not `??`) is deliberate: "" is not an "unbound" state here.
      // SettingsStorage.collectShortcutsData rebuilds `shortcuts.popup` from
      // scratch and only writes an action when the input has a value, so a
      // cleared binding arrives as a *missing* key. The legacy top-level
      // `hotkey*` keys, by contrast, can be written as "" (`parsed.key || ""`),
      // and that empty string must fall through to the default rather than win.
      return {
        markUnknown: toShortcutConfig(popupShortcuts.markUnknown || legacyResult.hotkeyMarkUnknown, "1"),
        markIgnored: toShortcutConfig(popupShortcuts.markIgnored || legacyResult.hotkeyMarkIgnored, "2"),
        markKnown: toShortcutConfig(popupShortcuts.markKnown || legacyResult.hotkeyMarkKnown, "3"),
        ankiAdd: toShortcutConfig(popupShortcuts.ankiAdd || legacyResult.hotkeyAnkiAdd, "q")
      };
    } catch (error) {
      console.error('[ShortcutHelper] Error loading popup shortcuts:', error);
      return {
        markUnknown: toShortcutConfig(undefined, "1"),
        markIgnored: toShortcutConfig(undefined, "2"),
        markKnown: toShortcutConfig(undefined, "3"),
        ankiAdd: toShortcutConfig(undefined, "q")
      };
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ShortcutHelper = ShortcutHelper;
}
