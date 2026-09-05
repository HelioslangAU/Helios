import { describe, it, expect } from 'vitest';
import { formatHotkeyDisplay } from '@/content/video/sidebar/hotkey-display';

const base = { key: 'a', shift: false, ctrl: false, alt: false };

describe('formatHotkeyDisplay', () => {
  it('capitalizes a bare key', () => {
    expect(formatHotkeyDisplay(base)).toBe('A');
  });

  it('orders modifiers Ctrl, Shift, Alt before the key', () => {
    expect(formatHotkeyDisplay({ ...base, ctrl: true, shift: true, alt: true })).toBe('Ctrl+Shift+Alt+A');
    expect(formatHotkeyDisplay({ ...base, alt: true, shift: true })).toBe('Shift+Alt+A');
  });

  it('leaves multi-character key names readable', () => {
    expect(formatHotkeyDisplay({ ...base, key: 'ArrowLeft' })).toBe('ArrowLeft');
    expect(formatHotkeyDisplay({ ...base, key: 'space', ctrl: true })).toBe('Ctrl+Space');
  });

  it('tolerates an empty key', () => {
    expect(formatHotkeyDisplay({ ...base, key: '' })).toBe('');
  });
});
