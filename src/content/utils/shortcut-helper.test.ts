import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ShortcutHelper, type ShortcutConfig } from '@/content/utils/shortcut-helper';

/** Build a real KeyboardEvent; happy-dom honours the modifier init fields. */
function key(k: string, mods: Omit<KeyboardEventInit, 'key'> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, ...mods });
}

const VIDEO_DEFAULTS: Record<string, ShortcutConfig> = {
  loadSubtitles: { key: 'L', ctrl: true, shift: true, alt: false, meta: false },
  togglePanel: { key: 'S', ctrl: true, shift: true, alt: false, meta: false },
  loadYouTube: { key: 'Y', ctrl: true, shift: true, alt: false, meta: false },
};

const NAV_DEFAULTS: Record<string, ShortcutConfig> = {
  previous: { key: 'A', ctrl: false, shift: false, alt: false, meta: false },
  next: { key: 'D', ctrl: false, shift: false, alt: false, meta: false },
  restart: { key: 'S', ctrl: false, shift: false, alt: false, meta: false },
  toggle: { key: 'W', ctrl: false, shift: false, alt: false, meta: false },
  increaseSize: { key: 'Equal', ctrl: false, shift: true, alt: false, meta: false },
  decreaseSize: { key: 'Minus', ctrl: false, shift: true, alt: false, meta: false },
};

describe('ShortcutHelper.matchesVideoShortcut', () => {
  describe('bare key configs (no modifiers requested)', () => {
    const plain: ShortcutConfig = { key: 'A' };

    it('matches the same key with no modifiers held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a'), plain)).toBe(true);
    });

    it('is case-insensitive about the key on both sides', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('A'), { key: 'a' })).toBe(true);
    });

    it('rejects a different key', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('b'), plain)).toBe(false);
    });

    it('rejects the right key when Ctrl is held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a', { ctrlKey: true }), plain)).toBe(false);
    });

    it('rejects the right key when Meta is held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a', { metaKey: true }), plain)).toBe(false);
    });

    it('rejects the right key when Shift is held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a', { shiftKey: true }), plain)).toBe(false);
    });

    it('rejects the right key when Alt is held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a', { altKey: true }), plain)).toBe(false);
    });
  });

  describe('ctrl configs', () => {
    const ctrlShiftL: ShortcutConfig = { key: 'L', ctrl: true, shift: true, alt: false, meta: false };

    it('matches Ctrl+Shift+L', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('L', { ctrlKey: true, shiftKey: true }), ctrlShiftL)
      ).toBe(true);
    });

    it('treats Cmd (metaKey) as satisfying a ctrl requirement, for macOS parity', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('l', { metaKey: true, shiftKey: true }), ctrlShiftL)
      ).toBe(true);
    });

    it('rejects when no ctrl or meta is held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('l', { shiftKey: true }), ctrlShiftL)).toBe(false);
    });

    it('rejects when the required Shift is missing', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('l', { ctrlKey: true }), ctrlShiftL)).toBe(false);
    });

    it('rejects when an unrequested Alt is also held', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(
          key('l', { ctrlKey: true, shiftKey: true, altKey: true }),
          ctrlShiftL
        )
      ).toBe(false);
    });

    it('matches Ctrl-only configs with just Ctrl held', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('p', { ctrlKey: true }), { key: 'P', ctrl: true })
      ).toBe(true);
    });

    it('treats ctrl and meta as one modifier, so setting both is not stricter', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('p', { ctrlKey: true }), {
          key: 'P',
          ctrl: true,
          meta: true,
        })
      ).toBe(true);
    });
  });

  describe('shift and alt configs', () => {
    it('matches a Shift-only config', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('=', { shiftKey: true }), { key: '=', shift: true })
      ).toBe(true);
    });

    it('rejects a Shift-only config when Shift is not held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('='), { key: '=', shift: true })).toBe(false);
    });

    it('matches an Alt-only config', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('w', { altKey: true }), { key: 'W', alt: true })
      ).toBe(true);
    });

    it('rejects an Alt-only config when Alt is not held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('w'), { key: 'W', alt: true })).toBe(false);
    });

    it('matches a combined Shift+Alt config', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('w', { shiftKey: true, altKey: true }), {
          key: 'W',
          shift: true,
          alt: true,
        })
      ).toBe(true);
    });
  });

  describe('meta-only configs', () => {
    const metaL: ShortcutConfig = { key: 'L', ctrl: false, meta: true };

    it('matches a meta-only config when Cmd is held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('l', { metaKey: true }), metaL)).toBe(true);
    });

    it('also accepts Ctrl for a meta-only config, mirroring the ctrl/meta parity', () => {
      // ctrl and meta are one cross-platform modifier here (same rule as
      // SubtitleOverlay._matchesShortcut), so a Cmd binding fires on Ctrl too.
      expect(ShortcutHelper.matchesVideoShortcut(key('l', { ctrlKey: true }), metaL)).toBe(true);
    });

    it('rejects a meta-only config with no modifiers held', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('l'), metaL)).toBe(false);
    });

    it('still enforces the other modifiers on a meta config', () => {
      expect(
        ShortcutHelper.matchesVideoShortcut(key('l', { metaKey: true, shiftKey: true }), metaL)
      ).toBe(false);
      expect(
        ShortcutHelper.matchesVideoShortcut(key('l', { metaKey: true, shiftKey: true }), {
          ...metaL,
          shift: true,
        })
      ).toBe(true);
    });
  });

  describe('missing configuration', () => {
    it('returns false for a null config', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a'), null)).toBe(false);
    });

    it('returns false for an undefined config', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a'), undefined)).toBe(false);
    });

    it('returns false for a config with an empty key', () => {
      expect(ShortcutHelper.matchesVideoShortcut(key('a'), { key: '' })).toBe(false);
    });
  });
});

describe('ShortcutHelper.matchesSingleKeyShortcut', () => {
  const previous: ShortcutConfig = { key: 'A', ctrl: false, shift: false, alt: false, meta: false };

  it('matches the bare key', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a'), previous)).toBe(true);
  });

  it('is case-insensitive about the key', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('A'), { key: 'a' })).toBe(true);
  });

  it('rejects a different key', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('d'), previous)).toBe(false);
  });

  it('rejects when Ctrl is held', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a', { ctrlKey: true }), previous)).toBe(false);
  });

  it('rejects when Meta is held', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a', { metaKey: true }), previous)).toBe(false);
  });

  it('rejects when Shift is held', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a', { shiftKey: true }), previous)).toBe(false);
  });

  it('rejects when Alt is held', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a', { altKey: true }), previous)).toBe(false);
  });

  it('honours the modifier flags on the config itself', () => {
    // The increaseSize/decreaseSize navigation defaults declare shift: true, so
    // they must fire *with* Shift, matching what the settings UI displays and
    // what SubtitleOverlay._matchesShortcut does with the same config bag.
    expect(
      ShortcutHelper.matchesSingleKeyShortcut(key('Equal', { shiftKey: true }), NAV_DEFAULTS.increaseSize)
    ).toBe(true);
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('Equal'), NAV_DEFAULTS.increaseSize)).toBe(false);
  });

  it('still requires a bare press for the modifier-free navigation defaults', () => {
    // previous/next/restart/toggle are the only actions youtube-sidebar.ts
    // routes here, and all four declare every modifier false.
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('w'), NAV_DEFAULTS.toggle)).toBe(true);
    expect(
      ShortcutHelper.matchesSingleKeyShortcut(key('w', { shiftKey: true }), NAV_DEFAULTS.toggle)
    ).toBe(false);
  });

  it('accepts a modifier-bearing binding recorded through the settings UI', () => {
    const shiftA: ShortcutConfig = { key: 'A', ctrl: false, shift: true, alt: false, meta: false };
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a', { shiftKey: true }), shiftA)).toBe(true);
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a'), shiftA)).toBe(false);
  });

  it('returns false for a null config', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a'), null)).toBe(false);
  });

  it('returns false for a config with an empty key', () => {
    expect(ShortcutHelper.matchesSingleKeyShortcut(key('a'), { key: '' })).toBe(false);
  });
});

describe('ShortcutHelper.parseHotkeyDisplay', () => {
  it('parses a full "Ctrl+Shift+L" display string, lower-casing the key', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('Ctrl+Shift+L')).toEqual({
      key: 'l',
      ctrl: true,
      shift: true,
      alt: false,
      meta: false,
    });
  });

  it('parses a bare key with every modifier false', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('A')).toEqual({
      key: 'a',
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    });
  });

  it('tolerates spaces around the + separators', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('Alt + Shift + Equal')).toEqual({
      key: 'equal',
      ctrl: false,
      shift: true,
      alt: true,
      meta: false,
    });
  });

  it('parses a Meta modifier', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('Meta+L')).toEqual({
      key: 'l',
      ctrl: false,
      shift: false,
      alt: false,
      meta: true,
    });
  });

  it('accepts Cmd/Command as aliases for Meta and Control for Ctrl', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('Cmd+K')?.meta).toBe(true);
    expect(ShortcutHelper.parseHotkeyDisplay('Command+K')?.meta).toBe(true);
    expect(ShortcutHelper.parseHotkeyDisplay('Control+K')?.ctrl).toBe(true);
  });

  it('recognizes modifier names case-insensitively', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('ctrl+l')).toEqual({
      key: 'l',
      ctrl: true,
      shift: false,
      alt: false,
      meta: false,
    });
    expect(ShortcutHelper.parseHotkeyDisplay('ALT + shift + Equal')).toEqual({
      key: 'equal',
      ctrl: false,
      shift: true,
      alt: true,
      meta: false,
    });
  });

  it('round-trips a Meta binding into a config that matches a Cmd press', () => {
    const parsed = ShortcutHelper.parseHotkeyDisplay('Meta+Shift+L')!;
    expect(
      ShortcutHelper.matchesVideoShortcut(key('L', { metaKey: true, shiftKey: true }), parsed)
    ).toBe(true);
    expect(ShortcutHelper.matchesVideoShortcut(key('L', { shiftKey: true }), parsed)).toBe(false);
  });

  it('produces an empty key for a lone "+" separator', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('+')).toEqual({
      key: '',
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    });
  });

  it('returns null for an empty string', () => {
    expect(ShortcutHelper.parseHotkeyDisplay('')).toBeNull();
  });

  it('returns null for a non-string input', () => {
    expect(ShortcutHelper.parseHotkeyDisplay(null as never)).toBeNull();
  });

  it('round-trips into a config that matchesVideoShortcut accepts', () => {
    const parsed = ShortcutHelper.parseHotkeyDisplay('Ctrl+Shift+L')!;
    expect(
      ShortcutHelper.matchesVideoShortcut(key('L', { ctrlKey: true, shiftKey: true }), parsed)
    ).toBe(true);
  });
});

describe('ShortcutHelper.getVideoShortcuts', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns the built-in defaults when nothing is stored', async () => {
    expect(await ShortcutHelper.getVideoShortcuts()).toEqual(VIDEO_DEFAULTS);
  });

  it('returns the defaults when `shortcuts` exists but has no `video` section', async () => {
    await chrome.storage.local.set({ shortcuts: { popup: { markUnknown: '7' } } });
    expect(await ShortcutHelper.getVideoShortcuts()).toEqual(VIDEO_DEFAULTS);
  });

  it('returns the stored video section verbatim', async () => {
    const video = {
      loadSubtitles: { key: 'O', ctrl: true, shift: false, alt: false, meta: false },
      togglePanel: { key: 'S', ctrl: true, shift: true, alt: false, meta: false },
      loadYouTube: { key: 'Y', ctrl: true, shift: true, alt: false, meta: false },
    };
    await chrome.storage.local.set({ shortcuts: { video } });
    expect(await ShortcutHelper.getVideoShortcuts()).toEqual(video);
  });

  it('merges per action, keeping defaults for the ones not stored', async () => {
    const togglePanel = { key: 'P', ctrl: true, shift: false, alt: false, meta: false };
    await chrome.storage.local.set({ shortcuts: { video: { togglePanel } } });
    const result = await ShortcutHelper.getVideoShortcuts();
    expect(result).toEqual({ ...VIDEO_DEFAULTS, togglePanel });
  });

  it('ignores stored keys that are not known video actions', async () => {
    await chrome.storage.local.set({
      shortcuts: { video: { bogusAction: { key: 'X', ctrl: true } } },
    });
    const result = await ShortcutHelper.getVideoShortcuts();
    expect(Object.keys(result).sort()).toEqual(Object.keys(VIDEO_DEFAULTS).sort());
  });

  it('returns the defaults for an empty stored video section', async () => {
    await chrome.storage.local.set({ shortcuts: { video: {} } });
    expect(await ShortcutHelper.getVideoShortcuts()).toEqual(VIDEO_DEFAULTS);
  });
});

describe('ShortcutHelper.getVideoNavigationShortcuts', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns the built-in defaults when nothing is stored', async () => {
    expect(await ShortcutHelper.getVideoNavigationShortcuts()).toEqual(NAV_DEFAULTS);
  });

  it('passes through shortcuts stored in the object format', async () => {
    const next = { key: 'N', ctrl: false, shift: false, alt: false, meta: false };
    await chrome.storage.local.set({ shortcuts: { videoNavigation: { next } } });
    const result = await ShortcutHelper.getVideoNavigationShortcuts();
    expect(result.next).toEqual(next);
  });

  it('parses shortcuts stored in the legacy display-string format', async () => {
    await chrome.storage.local.set({
      shortcuts: { videoNavigation: { previous: 'Ctrl+Shift+Z' } },
    });
    const result = await ShortcutHelper.getVideoNavigationShortcuts();
    expect(result.previous).toEqual({ key: 'z', ctrl: true, shift: true, alt: false, meta: false });
  });

  it('merges per action, keeping defaults for the ones not stored', async () => {
    await chrome.storage.local.set({ shortcuts: { videoNavigation: { previous: 'Z' } } });
    const result = await ShortcutHelper.getVideoNavigationShortcuts();
    expect(result.previous).toEqual({ key: 'z', ctrl: false, shift: false, alt: false, meta: false });
    expect(result.next).toEqual(NAV_DEFAULTS.next);
    expect(result.decreaseSize).toEqual(NAV_DEFAULTS.decreaseSize);
  });

  it('ignores stored keys that are not known navigation actions', async () => {
    await chrome.storage.local.set({
      shortcuts: { videoNavigation: { previous: 'Z', bogusAction: 'X' } },
    });
    const result = await ShortcutHelper.getVideoNavigationShortcuts();
    expect(Object.keys(result).sort()).toEqual(Object.keys(NAV_DEFAULTS).sort());
  });

  it('lower-cases the key of a parsed display string, unlike the object format', () => {
    // Worth pinning: the same binding reaches callers as "w" when it was stored
    // as a display string but as "W" when stored as an object. Both matchers
    // upper-case before comparing, so this is currently harmless.
    expect(ShortcutHelper.parseHotkeyDisplay('W')?.key).toBe('w');
    expect(NAV_DEFAULTS.toggle.key).toBe('W');
  });

  it('treats an empty-string binding as unset and restores the default', async () => {
    await chrome.storage.local.set({ shortcuts: { videoNavigation: { restart: '' } } });
    const result = await ShortcutHelper.getVideoNavigationShortcuts();
    expect(result.restart).toEqual(NAV_DEFAULTS.restart);
  });
});

describe('ShortcutHelper.getPopupShortcuts', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns the numeric defaults when nothing is stored', async () => {
    expect(await ShortcutHelper.getPopupShortcuts()).toEqual({
      markUnknown: '1',
      markIgnored: '2',
      markKnown: '3',
      ankiAdd: 'q',
    });
  });

  it('prefers the unified shortcuts.popup section', async () => {
    await chrome.storage.local.set({
      shortcuts: { popup: { markUnknown: '7', markIgnored: '8', markKnown: '9', ankiAdd: 'z' } },
    });
    expect(await ShortcutHelper.getPopupShortcuts()).toEqual({
      markUnknown: '7',
      markIgnored: '8',
      markKnown: '9',
      ankiAdd: 'z',
    });
  });

  it('falls back to the legacy top-level hotkey* keys per action', async () => {
    await chrome.storage.local.set({
      hotkeyMarkUnknown: 'a',
      hotkeyMarkIgnored: 'b',
      hotkeyMarkKnown: 'c',
      hotkeyAnkiAdd: 'd',
    });
    expect(await ShortcutHelper.getPopupShortcuts()).toEqual({
      markUnknown: 'a',
      markIgnored: 'b',
      markKnown: 'c',
      ankiAdd: 'd',
    });
  });

  it('mixes unified, legacy and default values action by action', async () => {
    await chrome.storage.local.set({
      shortcuts: { popup: { markUnknown: '7' } },
      hotkeyMarkIgnored: '8',
    });
    expect(await ShortcutHelper.getPopupShortcuts()).toEqual({
      markUnknown: '7', // unified
      markIgnored: '8', // legacy
      markKnown: '3', // default
      ankiAdd: 'q', // default
    });
  });

  it('falls through an empty-string binding to the default (intentional)', async () => {
    // "" is not an "unbound" state for popup hotkeys, so `||` is correct here:
    // SettingsStorage.collectShortcutsData rebuilds `shortcuts.popup` from
    // scratch and only writes an action whose input has a value, so a cleared
    // binding arrives as a missing key, never as "".
    await chrome.storage.local.set({ shortcuts: { popup: { markUnknown: '' } } });
    expect((await ShortcutHelper.getPopupShortcuts()).markUnknown).toBe('1');
  });

  it('falls through an empty legacy hotkey* value to the default', async () => {
    // The legacy keys *can* legitimately be written as "" (settings-storage
    // saves `parsed.key || ""`), so that empty string must not win.
    await chrome.storage.local.set({ hotkeyMarkKnown: '' });
    expect((await ShortcutHelper.getPopupShortcuts()).markKnown).toBe('3');
  });
});
