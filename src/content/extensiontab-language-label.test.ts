import { describe, it, expect } from 'vitest';
import { languageLabel } from '@/content/extensiontab';

/**
 * The badge beside "Recent vocabulary" used to read "N total" for a list that
 * vocab-manager caps at 20, so past twenty lookups it said "20 total" forever.
 * It names the language instead — a fact about the list that stays true.
 */
describe('languageLabel', () => {
  it('names each supported language the way a reader of it would', () => {
    expect(languageLabel('zh')).toBe('中文');
    expect(languageLabel('ja')).toBe('日本語');
    expect(languageLabel('ko')).toBe('한국어');
    expect(languageLabel('vi')).toBe('Tiếng Việt');
    expect(languageLabel('es')).toBe('Español');
    expect(languageLabel('fr')).toBe('Français');
    expect(languageLabel('de')).toBe('Deutsch');
    expect(languageLabel('en')).toBe('English');
  });

  it('falls back to the code for a language it has no name for', () => {
    expect(languageLabel('pt')).toBe('PT');
  });
});
