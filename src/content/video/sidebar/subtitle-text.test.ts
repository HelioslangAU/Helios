import { describe, expect, it, vi } from 'vitest';

import { extractPotentialWords } from '@/content/video/sidebar/subtitle-text';

const never = () => {
  throw new Error('maxWordLength must not be read for space-separated languages');
};

describe('extractPotentialWords', () => {
  describe('CJK languages', () => {
    it('emits every character and every substring up to maxWordLength', () => {
      expect(extractPotentialWords('你好吗', 'zh', () => 2))
        .toEqual(['你', '好', '吗', '你好', '好吗']);
    });

    it('expands the whole string when maxWordLength exceeds its length', () => {
      expect(extractPotentialWords('你好吗', 'zh', () => 10)).toEqual([
        '你', '好', '吗',
        '你好', '好吗',
        '你好吗'
      ]);
    });

    it('caps candidate length at maxWordLength', () => {
      const words = extractPotentialWords('一二三四五六七八九十百', 'zh', () => 10);
      expect(words).toContain('一二三四五六七八九十');
      expect(words.some(w => w.length > 10)).toBe(false);
    });

    it('deduplicates repeated characters and sequences', () => {
      expect(extractPotentialWords('好好', 'zh', () => 2)).toEqual(['好', '好好']);
      expect(extractPotentialWords('々々', 'ja', () => 10)).toEqual(['々', '々々']);
    });

    it('skips whitespace-only characters and sequences', () => {
      expect(extractPotentialWords('你 好', 'zh', () => 2))
        .toEqual(['你', '好', '你 ', ' 好']);
    });

    it('keeps sequences that span an internal space', () => {
      const words = extractPotentialWords('가 나', 'ko', () => 10);
      expect(words).toContain('가');
      expect(words).toContain('나');
      expect(words).not.toContain(' ');
      expect(words).toContain('가 나');
    });

    it('applies to Japanese and Korean too', () => {
      expect(extractPotentialWords('ねこ', 'ja', () => 2)).toEqual(['ね', 'こ', 'ねこ']);
      expect(extractPotentialWords('고양', 'ko', () => 2)).toEqual(['고', '양', '고양']);
    });

    it('returns nothing for an empty string', () => {
      expect(extractPotentialWords('', 'zh', () => 10)).toEqual([]);
    });

    it('reads maxWordLength only once', () => {
      const getMaxWordLength = vi.fn(() => 2);
      extractPotentialWords('你好', 'zh', getMaxWordLength);
      expect(getMaxWordLength).toHaveBeenCalledTimes(1);
    });
  });

  describe('space-separated languages', () => {
    it('lowercases words and drops punctuation', () => {
      expect(extractPotentialWords('Hello, World!', 'en', never)).toEqual(['hello', 'world']);
    });

    it('keeps apostrophes and hyphens inside words', () => {
      expect(extractPotentialWords("don't well-known", 'en', never))
        .toEqual(["don't", 'well-known']);
      expect(extractPotentialWords("Don't be well-known", 'en', never))
        .toEqual(["don't", 'be', 'well-known']);
    });

    it('deduplicates case-insensitively', () => {
      expect(extractPotentialWords('The the THE', 'en', never)).toEqual(['the']);
      expect(extractPotentialWords('Le le LE', 'fr', never)).toEqual(['le']);
    });

    it('returns an empty array when there are no letters', () => {
      expect(extractPotentialWords('123 !!!', 'en', never)).toEqual([]);
    });

    it('never touches maxWordLength', () => {
      expect(() => extractPotentialWords('hello', 'fr', never)).not.toThrow();
    });
  });

  it('falls back to the space-separated path when no language is set', () => {
    expect(extractPotentialWords('Bonjour', null, never)).toEqual(['bonjour']);
    expect(extractPotentialWords('Bonjour', undefined, never)).toEqual(['bonjour']);
    expect(extractPotentialWords('two words', undefined, never)).toEqual(['two', 'words']);
  });
});
