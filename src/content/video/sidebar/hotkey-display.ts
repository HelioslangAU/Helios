/**
 * The hotkey value object shared by the video sidebars, and its display format.
 */

export interface HotkeyConfig {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

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
