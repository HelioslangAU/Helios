import { describe, expect, it } from 'vitest';

import {
  buildLanguageMap,
  getLanguageDisplayName,
  sortLanguagesByName
} from './language-display';

describe('getLanguageDisplayName', () => {
  it("keeps YouTube's own name when it looks descriptive", () => {
    expect(getLanguageDisplayName('Chinese (Simplified)', 'zh-Hans')).toBe('Chinese (Simplified)');
    expect(getLanguageDisplayName('Portuguese', 'pt')).toBe('Portuguese');
  });

  it('falls back to the table for short names', () => {
    expect(getLanguageDisplayName('en', 'en')).toBe('English');
    expect(getLanguageDisplayName('ja', 'ja')).toBe('Japanese');
  });

  it('falls back to the table for hyphenated YouTube names', () => {
    // A hyphen means the name is really a code, so the table wins.
    expect(getLanguageDisplayName('pt-BR', 'pt-BR')).toBe('Portuguese');
  });

  it('resolves the table against the base code', () => {
    expect(getLanguageDisplayName('de', 'de-AT')).toBe('German');
  });

  it('falls back to the YouTube name, then the code, for unknown languages', () => {
    expect(getLanguageDisplayName('xx', 'xx')).toBe('xx');
    expect(getLanguageDisplayName('', 'qq-ZZ')).toBe('qq-ZZ');
  });
});

describe('buildLanguageMap', () => {
  it('keys non-Chinese languages by base code and keeps the first one seen', () => {
    const map = buildLanguageMap([
      { language: 'en-US', languageName: 'English (United States)' },
      { language: 'en-GB', languageName: 'English (United Kingdom)' }
    ]);

    expect([...map.entries()]).toEqual([['en', 'English (United States)']]);
  });

  it('keeps Chinese variants separate under their full codes', () => {
    const map = buildLanguageMap([
      { language: 'zh-Hans', languageName: '中文（简体）' },
      { language: 'zh-Hant', languageName: '中文（繁體）' }
    ]);

    expect([...map.keys()]).toEqual(['zh-Hans', 'zh-Hant']);
    expect(map.get('zh-Hans')).toBe('中文（简体）');
  });

  it('falls back to the language code when the track has no name', () => {
    const map = buildLanguageMap([{ language: 'ko' }]);
    expect(map.get('ko')).toBe('Korean');
  });

  it('ignores tracks without a language code', () => {
    expect(buildLanguageMap([{ languageName: 'Mystery' }]).size).toBe(0);
  });

  it('returns an empty map for an empty track list', () => {
    expect(buildLanguageMap([]).size).toBe(0);
  });
});

describe('sortLanguagesByName', () => {
  it('sorts entries alphabetically by display name', () => {
    const map = new Map([
      ['ja', 'Japanese'],
      ['de', 'German'],
      ['en', 'English']
    ]);

    expect(sortLanguagesByName(map)).toEqual([
      ['en', 'English'],
      ['de', 'German'],
      ['ja', 'Japanese']
    ]);
  });
});
