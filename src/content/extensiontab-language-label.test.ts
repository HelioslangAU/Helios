import { describe, it, expect } from 'vitest';
import { languageLabel, languageEnglishName } from '@/content/extensiontab';

/**
 * The popup names the target language twice: in its own script, and in English
 * beneath for a script the reader cannot read yet.
 */
describe('language names', () => {
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

  it('gives the English gloss for a script that needs one', () => {
    expect(languageEnglishName('zh')).toBe('Chinese');
    expect(languageEnglishName('ko')).toBe('Korean');
    expect(languageEnglishName('es')).toBe('Spanish');
  });

  it('says nothing when the two names would be the same word', () => {
    // "English" under "English", or "Deutsch" under a gloss that repeats it.
    expect(languageEnglishName('en')).toBe('');
  });

  it('says nothing for a language it has no gloss for', () => {
    expect(languageEnglishName('pt')).toBe('');
  });
});
