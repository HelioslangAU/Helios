export interface HotkeyConfig {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

/**
 * Format hotkey for display
 */
export function formatHotkeyDisplay(hotkey: HotkeyConfig): string {
  const parts: string[] = [];
  if (hotkey.ctrl) parts.push('Ctrl');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.alt) parts.push('Alt');

  const keyDisplay = hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1);
  parts.push(keyDisplay);

  return parts.join('+');
}
