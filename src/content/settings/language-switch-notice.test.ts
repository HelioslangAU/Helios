import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  describeSwitch,
  languageName,
  showLanguageSwitchNotice,
  hideLanguageSwitchNotice,
} from '@/content/settings/language-switch-notice';

const notice = () => document.getElementById('language-switch-notice')!;

describe('language switch notice', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<p class="switch-notice" id="language-switch-notice" hidden></p>';
  });

  it('names both languages, so the hidden lists are accounted for', () => {
    expect(describeSwitch('zh', 'es')).toBe(
      'Now reading Spanish. Your Chinese word lists are kept.',
    );
  });

  it('falls back to the code for a language it does not know', () => {
    expect(languageName('xx')).toBe('XX');
  });

  it('shows the sentence and an undo naming where it goes back to', () => {
    showLanguageSwitchNotice('zh', 'fr', { onUndo: vi.fn() });

    expect(notice().hidden).toBe(false);
    expect(notice().textContent).toContain('Now reading French');
    expect(notice().querySelector('button')!.textContent).toBe('Switch back to Chinese');
  });

  it('hands the previous language back on undo, and clears itself', () => {
    const onUndo = vi.fn();
    showLanguageSwitchNotice('ja', 'ko', { onUndo });

    notice().querySelector('button')!.click();

    expect(onUndo).toHaveBeenCalledWith('ja');
    expect(notice().hidden).toBe(true);
    expect(notice().textContent).toBe('');
  });

  it('replaces a previous notice rather than stacking a second', () => {
    showLanguageSwitchNotice('zh', 'es', { onUndo: vi.fn() });
    showLanguageSwitchNotice('es', 'fr', { onUndo: vi.fn() });

    expect(notice().querySelectorAll('button')).toHaveLength(1);
    expect(notice().textContent).toContain('Now reading French');
  });

  it('says nothing when the language did not actually change', () => {
    showLanguageSwitchNotice('zh', 'zh', { onUndo: vi.fn() });
    expect(notice().hidden).toBe(true);
  });

  it('is a no-op when the section has no notice element', () => {
    document.body.innerHTML = '';
    expect(() => showLanguageSwitchNotice('zh', 'es', { onUndo: vi.fn() })).not.toThrow();
    expect(() => hideLanguageSwitchNotice()).not.toThrow();
  });
});
