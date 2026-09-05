/**
 * Pure keyboard helpers for the YouTube sidebar: hotkey value objects, the
 * conflict rules the settings panel enforces, and the guards that decide when a
 * key press belongs to us rather than to YouTube or to a text field.
 */

export interface HotkeyConfig {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

/** YouTube's native controls that should be blocked when no modifiers are used */
export const YOUTUBE_CONTROL_KEYS = [
  'k', // Play/Pause
  ' ', // Space - Play/Pause
  'j', // Rewind 10s
  'l', // Forward 10s
  'left', // Rewind 5s
  'right', // Forward 5s
  'up', // Volume up
  'down', // Volume down
  'm', // Mute
  'f', // Fullscreen
  't', // Theater mode
  'i', // Miniplayer
  'c', // Captions
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', // Seek to %
  'home', // Start
  'end', // End
  '<', '>', // Playback speed
  '/', // Search
  'escape' // Exit fullscreen
];

/**
 * Format hotkey object for display (e.g., "Ctrl+Shift+L")
 */
export function formatHotkeyDisplay(hotkey: HotkeyConfig): string {
  const parts: string[] = [];
  if (hotkey.ctrl) parts.push('Ctrl');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.alt) parts.push('Alt');

  // Capitalize first letter of key for display
  const keyDisplay = hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1);
  parts.push(keyDisplay);

  return parts.join('+');
}

/**
 * Build a hotkey from a keydown event, or null when the press is a modifier
 * key on its own and so cannot be a hotkey.
 */
export function hotkeyFromEvent(e: KeyboardEvent): HotkeyConfig | null {
  // Ignore modifier keys alone
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    return null;
  }

  // Normalize key names for special keys
  let keyName = e.key;
  if (keyName.startsWith('Arrow')) {
    keyName = keyName.substring(5); // "ArrowLeft" -> "Left"
  }

  return {
    key: keyName.toLowerCase(),
    shift: e.shiftKey,
    ctrl: e.ctrlKey || e.metaKey, // Meta (Cmd) treated as Ctrl
    alt: e.altKey
  };
}

/**
 * Whether the combination would be swallowed by YouTube's own shortcuts.
 * Only unmodified keys can conflict.
 */
export function conflictsWithYouTubeControls(hotkey: HotkeyConfig): boolean {
  const hasModifiers = hotkey.shift || hotkey.ctrl || hotkey.alt;
  return !hasModifiers && YOUTUBE_CONTROL_KEYS.includes(hotkey.key);
}

/**
 * The [name, hotkey] entry already bound to the same combination, ignoring the
 * binding currently being edited.
 */
export function findConflictingHotkey(
  hotkeys: Record<string, HotkeyConfig>,
  editingName: string,
  candidate: HotkeyConfig
): [string, HotkeyConfig] | undefined {
  return Object.entries(hotkeys).find(
    ([name, hotkey]) => name !== editingName &&
                        hotkey.key === candidate.key &&
                        hotkey.shift === candidate.shift &&
                        hotkey.ctrl === candidate.ctrl &&
                        hotkey.alt === candidate.alt
  );
}

/**
 * True when the event target is a text-entry surface, where our shortcuts must
 * stand down.
 */
export function isTypingTarget(target: HTMLElement): boolean {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Block 't' from toggling theater mode when the sidebar is visible, which would
 * otherwise break the sidebar layout.
 */
export function shouldBlockTheaterModeToggle(e: KeyboardEvent, sidebarVisible: boolean): boolean {
  const target = e.target as HTMLElement;
  return sidebarVisible &&
    e.key.toLowerCase() === 't' &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    !isTypingTarget(target);
}
