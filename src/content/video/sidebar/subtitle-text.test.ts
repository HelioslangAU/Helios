import { describe, it, expect, afterEach } from 'vitest';
import { clearServices, provideServices } from '@/content/services';
import type { LanguageRegistry } from '@/content/languages/language-registry';
import { extractPotentialWords } from '@/content/video/sidebar/subtitle-text';

function useLanguage(code: string): void {
  provideServices({
    languageRegistry: { getCurrentLanguage: () => code } as unknown as LanguageRegistry
  });
}

afterEach(() => {
  clearServices();
});

describe('extractPotentialWords — space-less languages', () => {
  it('emits every character, then every substring up to 10 long', () => {
    useLanguage('zh');
    expect(extractPotentialWords('你好吗')).toEqual([
      '你', '好', '吗',
      '你好', '好吗',
      '你好吗'
    ]);
  });

  it('deduplicates repeated characters and substrings', () => {
    useLanguage('ja');
    expect(extractPotentialWords('々々')).toEqual(['々', '々々']);
  });

  it('skips whitespace-only candidates but keeps ones containing text', () => {
    useLanguage('ko');
    const words = extractPotentialWords('가 나');
    expect(words).toContain('가');
    expect(words).toContain('나');
    expect(words).not.toContain(' ');
    expect(words).toContain('가 나');
  });

  it('caps candidate length at 10 characters', () => {
    useLanguage('zh');
    const words = extractPotentialWords('一二三四五六七八九十百');
    expect(words).toContain('一二三四五六七八九十');
    expect(words.some(w => w.length > 10)).toBe(false);
  });

  it('returns nothing for an empty string', () => {
    useLanguage('zh');
    expect(extractPotentialWords('')).toEqual([]);
  });
});

describe('extractPotentialWords — space-separated languages', () => {
  it('lowercases whole words and drops punctuation', () => {
    useLanguage('en');
    expect(extractPotentialWords('Hello, World!')).toEqual(['hello', 'world']);
  });

  it('keeps apostrophes and hyphens inside words', () => {
    useLanguage('en');
    expect(extractPotentialWords("Don't be well-known")).toEqual(["don't", 'be', 'well-known']);
  });

  it('deduplicates case-insensitively', () => {
    useLanguage('fr');
    expect(extractPotentialWords('Le le LE')).toEqual(['le']);
  });

  it('falls back to the word-based split when no language registry is present', () => {
    expect(extractPotentialWords('two words')).toEqual(['two', 'words']);
  });

  it('returns nothing when there are no letters', () => {
    useLanguage('en');
    expect(extractPotentialWords('123 !!!')).toEqual([]);
  });
});
