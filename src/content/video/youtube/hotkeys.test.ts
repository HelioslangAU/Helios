import { describe, expect, it } from 'vitest';

import type { HotkeyConfig } from '@/content/video/sidebar/hotkey-display';
import {
  conflictsWithYouTubeControls,
  findConflictingHotkey,
  hotkeyFromEvent,
  isTypingTarget,
  shouldBlockTheaterModeToggle
} from './hotkeys';

function hotkey(partial: Partial<HotkeyConfig> & { key: string }): HotkeyConfig {
  return { shift: false, ctrl: false, alt: false, ...partial };
}

function keydown(init: KeyboardEventInit & { key: string }, target?: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent('keydown', init);
  if (target) {
    Object.defineProperty(event, 'target', { value: target });
  }
  return event;
}

describe('hotkeyFromEvent', () => {
  it('returns null for a bare modifier press', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta']) {
      expect(hotkeyFromEvent(keydown({ key }))).toBeNull();
    }
  });

  it('lowercases the key and records modifiers', () => {
    expect(hotkeyFromEvent(keydown({ key: 'L', shiftKey: true })))
      .toEqual({ key: 'l', shift: true, ctrl: false, alt: false });
  });

  it('strips the Arrow prefix', () => {
    expect(hotkeyFromEvent(keydown({ key: 'ArrowLeft' })!)!.key).toBe('left');
  });

  it('treats Meta as Ctrl', () => {
    expect(hotkeyFromEvent(keydown({ key: 'k', metaKey: true })!)!.ctrl).toBe(true);
  });
});

describe('conflictsWithYouTubeControls', () => {
  it('flags unmodified keys YouTube already uses', () => {
    expect(conflictsWithYouTubeControls(hotkey({ key: 'k' }))).toBe(true);
    expect(conflictsWithYouTubeControls(hotkey({ key: ' ' }))).toBe(true);
    expect(conflictsWithYouTubeControls(hotkey({ key: '5' }))).toBe(true);
  });

  it('allows the same key once a modifier is added', () => {
    expect(conflictsWithYouTubeControls(hotkey({ key: 'k', shift: true }))).toBe(false);
    expect(conflictsWithYouTubeControls(hotkey({ key: 'k', ctrl: true }))).toBe(false);
    expect(conflictsWithYouTubeControls(hotkey({ key: 'k', alt: true }))).toBe(false);
  });

  it('allows keys YouTube does not claim', () => {
    expect(conflictsWithYouTubeControls(hotkey({ key: 'q' }))).toBe(false);
  });
});

describe('findConflictingHotkey', () => {
  const hotkeys = {
    previous: hotkey({ key: 'a' }),
    next: hotkey({ key: 'd' }),
    restart: hotkey({ key: 's', shift: true })
  };

  it('finds another binding using the same combination', () => {
    expect(findConflictingHotkey(hotkeys, 'next', hotkey({ key: 'a' })))
      .toEqual(['previous', hotkeys.previous]);
  });

  it('ignores the binding currently being edited', () => {
    expect(findConflictingHotkey(hotkeys, 'previous', hotkey({ key: 'a' }))).toBeUndefined();
  });

  it('treats differing modifiers as no conflict', () => {
    expect(findConflictingHotkey(hotkeys, 'next', hotkey({ key: 's' }))).toBeUndefined();
  });
});

describe('isTypingTarget', () => {
  it('is true for inputs and textareas', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
  });

  it('is true for contenteditable elements', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    expect(isTypingTarget(div)).toBe(true);
  });

  it('is false for ordinary elements', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
  });
});

describe('shouldBlockTheaterModeToggle', () => {
  const plainTarget = () => document.createElement('div');

  it("blocks a bare 't' while the sidebar is visible", () => {
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't' }, plainTarget()), true)).toBe(true);
    expect(shouldBlockTheaterModeToggle(keydown({ key: 'T' }, plainTarget()), true)).toBe(true);
  });

  it('does nothing while the sidebar is hidden', () => {
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't' }, plainTarget()), false)).toBe(false);
  });

  it('lets modified presses through', () => {
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't', shiftKey: true }, plainTarget()), true)).toBe(false);
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't', ctrlKey: true }, plainTarget()), true)).toBe(false);
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't', altKey: true }, plainTarget()), true)).toBe(false);
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't', metaKey: true }, plainTarget()), true)).toBe(false);
  });

  it('lets other keys through', () => {
    expect(shouldBlockTheaterModeToggle(keydown({ key: 'f' }, plainTarget()), true)).toBe(false);
  });

  it("does not block 't' typed into a text field", () => {
    const input = document.createElement('input');
    expect(shouldBlockTheaterModeToggle(keydown({ key: 't' }, input), true)).toBe(false);
  });
});
