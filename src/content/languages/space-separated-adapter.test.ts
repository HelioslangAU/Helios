import { describe, expect, it } from 'vitest';
import type { ExtractedWord } from '@/content/languages/base-language-adapter';
import {
  EnglishLanguageAdapter,
  FrenchLanguageAdapter,
  SpaceSeparatedLanguageAdapter,
  SpanishLanguageAdapter,
} from '@/content/languages/space-separated-adapter';

const en = new EnglishLanguageAdapter();
const es = new SpanishLanguageAdapter();
const fr = new FrenchLanguageAdapter();

/** U+2019 RIGHT SINGLE QUOTATION MARK — the typographic apostrophe used by most real subtitles. */
const CURLY = '’';
/** U+0027 APOSTROPHE — the ASCII one. */
const STRAIGHT = "'";

/** Re-join the extracted chunks; every adapter is supposed to tile the input exactly. */
function reassemble(words: ExtractedWord[]): string {
  return words.map(w => w.word).join('');
}

/** Assert the chunks are contiguous, start at 0, and end at text.length. */
function expectContiguousSpans(words: ExtractedWord[], text: string): void {
  let cursor = 0;
  for (const w of words) {
    expect(w.start).toBe(cursor);
    expect(w.end).toBe(w.start + w.word.length);
    expect(text.slice(w.start, w.end)).toBe(w.word);
    cursor = w.end;
  }
  expect(cursor).toBe(text.length);
}

describe('EnglishLanguageAdapter — configuration', () => {
  it('exposes the expected language metadata', () => {
    const config = en.getConfig();
    expect(config.code).toBe('en');
    expect(config.name).toBe('English');
    expect(config.displayName).toBe('English');
    expect(config.maxWordLength).toBe(45);
    expect(config.hasSpaces).toBe(true);
    expect(config.script).toBe('latin');
    expect(config.direction).toBe('ltr');
    expect(config.scanResolution).toBe('word');
  });

  it('is case sensitive per config even though lookups lowercase everything', () => {
    // BUG: caseSensitive is true for en/es/fr, yet normalizeWord/findDictionaryForm/extractWords
    // all lowercase the word before looking it up, so the flag has no effect on word matching.
    expect(en.getCaseSensitive()).toBe(true);
    expect(es.getCaseSensitive()).toBe(true);
    expect(fr.getCaseSensitive()).toBe(true);
    expect(en.normalizeWord('English')).toBe('english');
  });

  it('points at the bundled ECDICT CSV', () => {
    expect(en.getDictionaryPath()).toBe('dictionaries/English/ecdict.csv');
  });

  it('builds the onboarding vocab path by capitalising the language code', () => {
    expect(en.getOnboardingVocabPath('A1')).toBe('OnboardingVocab/En5k.csv');
    expect(es.getOnboardingVocabPath('B2')).toBe('OnboardingVocab/Es5k.csv');
    expect(fr.getOnboardingVocabPath('A2')).toBe('OnboardingVocab/Fr5k.csv');
  });

  it('exposes CEFR level definitions for all three languages', () => {
    for (const adapter of [en, es, fr]) {
      expect(adapter.getLevelDefinitions().map(l => l.level)).toEqual(['A1', 'A2', 'B1', 'B2']);
    }
  });

  it('has no dictionary path for Spanish and French', () => {
    expect(es.getDictionaryPath()).toBeUndefined();
    expect(fr.getDictionaryPath()).toBeUndefined();
  });

  it('records how many term banks Spanish and French ship with', () => {
    expect(es.getConfig().numOfDicts).toBe(60);
    expect(fr.getConfig().numOfDicts).toBe(27);
    expect(en.getConfig().numOfDicts).toBeUndefined();
  });
});

describe('SpaceSeparatedLanguageAdapter.isTargetCharacter', () => {
  it.each(['a', 'z', 'A', 'Z'])('accepts the basic Latin letter %j', char => {
    expect(en.isTargetCharacter(char)).toBe(true);
  });

  it.each(['é', 'ñ', 'ü', 'ç', 'à', 'ÿ'])('accepts the Latin-1 accented letter %j', char => {
    expect(en.isTargetCharacter(char)).toBe(true);
    expect(es.isTargetCharacter(char)).toBe(true);
    expect(fr.isTargetCharacter(char)).toBe(true);
  });

  it.each(['1', ' ', '-', STRAIGHT, CURLY, '.', '中', '😀', ''])('rejects the non-letter %j', char => {
    expect(en.isTargetCharacter(char)).toBe(false);
  });

  it('accepts Latin Extended-A for every space-separated language', () => {
    expect(en.isTargetCharacter('ā')).toBe(true); // U+0101
    expect(es.isTargetCharacter('ā')).toBe(true);
    expect(fr.isTargetCharacter('ā')).toBe(true);
  });

  it('accepts Latin Extended-B only for English', () => {
    // English declares 0x0180-0x024F; Spanish and French stop at Latin Extended-A.
    expect(en.isTargetCharacter('ƀ')).toBe(true); // U+0180, first char of Latin Extended-B
    expect(en.isTargetCharacter('ɏ')).toBe(true); // U+024F, last char of Latin Extended-B
    expect(es.isTargetCharacter('ƀ')).toBe(false);
    expect(fr.isTargetCharacter('ɏ')).toBe(false);
  });

  it('rejects the character just past the last configured range', () => {
    expect(en.isTargetCharacter('ɐ')).toBe(false); // U+0250, one past 0x024F
  });

  it('only inspects the first character of a multi-character string', () => {
    expect(en.isTargetCharacter('a中')).toBe(true);
    expect(en.isTargetCharacter('中a')).toBe(false);
  });

  it('containsTargetLanguage finds a letter anywhere in the text', () => {
    expect(en.containsTargetLanguage('123 abc')).toBe(true);
    expect(en.containsTargetLanguage('123 !!')).toBe(false);
    expect(en.containsTargetLanguage('')).toBe(false);
  });
});

describe('EnglishLanguageAdapter.extractWords', () => {
  it('splits a plain sentence into words and the punctuation between them', () => {
    const text = 'The quick brown fox.';
    const result = en.extractWords(text, {});
    expect(result).toEqual([
      { word: 'The', start: 0, end: 3, isTargetLang: false },
      { word: ' ', start: 3, end: 4, isTargetLang: false },
      { word: 'quick', start: 4, end: 9, isTargetLang: false },
      { word: ' ', start: 9, end: 10, isTargetLang: false },
      { word: 'brown', start: 10, end: 15, isTargetLang: false },
      { word: ' ', start: 15, end: 16, isTargetLang: false },
      { word: 'fox', start: 16, end: 19, isTargetLang: false },
      { word: '.', start: 19, end: 20, isTargetLang: false },
    ]);
    expectContiguousSpans(result, text);
  });

  it('marks only dictionary words as target-language, matched case-insensitively', () => {
    const result = en.extractWords('The cat sat', { the: [{}], cat: [{}] });
    expect(result.filter(w => w.isTargetLang).map(w => w.word)).toEqual(['The', 'cat']);
    expect(result.find(w => w.word === 'sat')?.isTargetLang).toBe(false);
  });

  it("keeps an ASCII apostrophe inside a contraction (don't)", () => {
    const text = `don${STRAIGHT}t stop`;
    const result = en.extractWords(text, {});
    expect(result[0]).toEqual({ word: `don${STRAIGHT}t`, start: 0, end: 5, isTargetLang: false });
    expectContiguousSpans(result, text);
  });

  it('splits a contraction written with a typographic apostrophe', () => {
    // BUG: the in-word character class is ['][']-] — two copies of U+0027 plus a hyphen.
    // U+2019 (the apostrophe real subtitles and web text actually use) is NOT in it, so
    // "don’t" becomes three chunks. Expected: same result as the ASCII apostrophe.
    const text = `don${CURLY}t stop`;
    const result = en.extractWords(text, {});
    expect(result.map(w => w.word)).toEqual(['don', CURLY, 't', ' ', 'stop']);
    expectContiguousSpans(result, text);
  });

  it('keeps a hyphenated compound as one word', () => {
    const text = 'well-known author';
    const result = en.extractWords(text, {});
    expect(result[0]).toEqual({ word: 'well-known', start: 0, end: 10, isTargetLang: false });
    expectContiguousSpans(result, text);
  });

  it('treats a dangling hyphen as non-word content', () => {
    const text = 'well- known';
    expect(en.extractWords(text, {}).map(w => w.word)).toEqual(['well', '- ', 'known']);
  });

  it('groups numbers and punctuation into non-word chunks', () => {
    const text = 'Hello, world! 123 times.';
    const result = en.extractWords(text, {});
    expect(result).toEqual([
      { word: 'Hello', start: 0, end: 5, isTargetLang: false },
      { word: ', ', start: 5, end: 7, isTargetLang: false },
      { word: 'world', start: 7, end: 12, isTargetLang: false },
      { word: '! 123 ', start: 12, end: 18, isTargetLang: false },
      { word: 'times', start: 18, end: 23, isTargetLang: false },
      { word: '.', start: 23, end: 24, isTargetLang: false },
    ]);
    expectContiguousSpans(result, text);
  });

  it('returns an empty array for empty text', () => {
    expect(en.extractWords('', {})).toEqual([]);
  });

  it('returns whitespace-only text as a single non-word chunk', () => {
    expect(en.extractWords('   ', {})).toEqual([
      { word: '   ', start: 0, end: 3, isTargetLang: false },
    ]);
  });

  it('keeps accents that sit between ASCII letters', () => {
    const text = 'niño español très garçon';
    const result = en.extractWords(text, {});
    expect(result.filter((_, i) => i % 2 === 0).map(w => w.word)).toEqual([
      'niño',
      'español',
      'très',
      'garçon',
    ]);
    expectContiguousSpans(result, text);
  });

  it('cuts an accented letter off the end of a word', () => {
    // BUG: the English regex is anchored with ASCII \b, which does not treat é as a word
    // character. "café" is split into "caf" plus a non-word chunk "é ". Spanish and French
    // use lookaround instead and get this right. Expected: one word "café" (0-4).
    const text = 'café au lait';
    const result = en.extractWords(text, {});
    expect(result.map(w => w.word)).toEqual(['caf', 'é ', 'au', ' ', 'lait']);
    expect(result[0]).toEqual({ word: 'caf', start: 0, end: 3, isTargetLang: false });
    expectContiguousSpans(result, text);
  });

  it('cuts an accented letter off the start of a word', () => {
    // BUG: same ASCII \b problem at the leading edge — "über" becomes "ü" + "ber", and the
    // stray "ü" is even emitted as a word rather than as non-word content.
    const text = 'über';
    expect(en.extractWords(text, {})).toEqual([
      { word: 'ü', start: 0, end: 1, isTargetLang: false },
      { word: 'ber', start: 1, end: 4, isTargetLang: false },
    ]);
  });

  it('leaves a leading apostrophe outside the word', () => {
    const text = `${STRAIGHT}tis the season`;
    const result = en.extractWords(text, {});
    expect(result[0]).toEqual({ word: STRAIGHT, start: 0, end: 1, isTargetLang: false });
    expect(result[1]).toEqual({ word: 'tis', start: 1, end: 4, isTargetLang: false });
    expectContiguousSpans(result, text);
  });

  it('treats a newline as non-word content', () => {
    const text = 'a\nb';
    expect(en.extractWords(text, {}).map(w => w.word)).toEqual(['a', '\n', 'b']);
  });

  it('round-trips the original text', () => {
    const text = `Well, "don${STRAIGHT}t" — she said, 42 times over.`;
    expect(reassemble(en.extractWords(text, {}))).toBe(text);
  });
});

describe('SpanishLanguageAdapter.extractWords', () => {
  it('splits a plain sentence and records the dictionary form of each word', () => {
    const text = 'El niño come';
    const result = es.extractWords(text, { el: [{}], 'niño': [{}] });
    expect(result).toEqual([
      { word: 'El', start: 0, end: 2, dictionaryForm: 'el', isTargetLang: true },
      { word: ' ', start: 2, end: 3, isTargetLang: false },
      { word: 'niño', start: 3, end: 7, dictionaryForm: 'niño', isTargetLang: true },
      { word: ' ', start: 7, end: 8, isTargetLang: false },
      { word: 'come', start: 8, end: 12, dictionaryForm: null, isTargetLang: false },
    ]);
    expectContiguousSpans(result, text);
  });

  it('keeps accented characters attached to the word (unlike the English regex)', () => {
    const text = 'café español';
    const result = es.extractWords(text, {});
    expect(result.map(w => w.word)).toEqual(['café', ' ', 'español']);
    expect(result[0]?.start).toBe(0);
    expect(result[0]?.end).toBe(4);
  });

  it('keeps ¡ and ! outside the words', () => {
    const text = '¡Hola, señor!';
    const result = es.extractWords(text, {});
    expect(result).toEqual([
      { word: '¡', start: 0, end: 1, isTargetLang: false },
      { word: 'Hola', start: 1, end: 5, dictionaryForm: null, isTargetLang: false },
      { word: ', ', start: 5, end: 7, isTargetLang: false },
      { word: 'señor', start: 7, end: 12, dictionaryForm: null, isTargetLang: false },
      { word: '!', start: 12, end: 13, isTargetLang: false },
    ]);
    expectContiguousSpans(result, text);
  });

  it('keeps ASCII apostrophes and hyphens inside words', () => {
    expect(es.extractWords(`don${STRAIGHT}t`, {})[0]?.word).toBe(`don${STRAIGHT}t`);
    expect(es.extractWords('well-known', {})[0]?.word).toBe('well-known');
  });

  it('splits on a typographic apostrophe', () => {
    // BUG: same missing U+2019 as English — the class holds two copies of U+0027 instead.
    expect(es.extractWords(`don${CURLY}t`, {}).map(w => w.word)).toEqual(['don', CURLY, 't']);
  });

  it('returns an empty array for empty text', () => {
    expect(es.extractWords('', {})).toEqual([]);
  });

  it('round-trips the original text', () => {
    const text = '¿Qué hora es? Son las 3, más o menos… ¡vámonos!';
    expect(reassemble(es.extractWords(text, {}))).toBe(text);
  });
});

describe('FrenchLanguageAdapter.extractWords', () => {
  it('keeps elisions as single words and resolves them to their base form', () => {
    const text = `L${STRAIGHT}eau, c${STRAIGHT}est bon`;
    const result = fr.extractWords(text, { eau: [{}], est: [{}], bon: [{}] });
    expect(result).toEqual([
      { word: `L${STRAIGHT}eau`, start: 0, end: 5, dictionaryForm: 'eau', isTargetLang: true },
      { word: ', ', start: 5, end: 7, isTargetLang: false },
      { word: `c${STRAIGHT}est`, start: 7, end: 12, dictionaryForm: 'est', isTargetLang: true },
      { word: ' ', start: 12, end: 13, isTargetLang: false },
      { word: 'bon', start: 13, end: 16, dictionaryForm: 'bon', isTargetLang: true },
    ]);
    expectContiguousSpans(result, text);
  });

  it("resolves d'accord to accord", () => {
    const result = fr.extractWords(`d${STRAIGHT}accord`, { accord: [{}] });
    expect(result).toEqual([
      { word: `d${STRAIGHT}accord`, start: 0, end: 8, dictionaryForm: 'accord', isTargetLang: true },
    ]);
  });

  it("leaves qu'il unresolved", () => {
    // BUG: the contraction pattern is /^([a-z])'(...)$/ — exactly ONE letter before the
    // apostrophe — so the two-letter elision "qu'" is never split. "qu'il" is reported as a
    // single unknown word even though "il" is in the dictionary.
    const text = `qu${STRAIGHT}il pleut`;
    const result = fr.extractWords(text, { il: [{}], pleut: [{}] });
    expect(result[0]).toEqual({
      word: `qu${STRAIGHT}il`,
      start: 0,
      end: 5,
      dictionaryForm: null,
      isTargetLang: false,
    });
    expectContiguousSpans(result, text);
  });

  it('splits a hyphenated word into parts when the whole word is not in the dictionary', () => {
    const text = 'Est-ce que';
    const result = fr.extractWords(text, { ce: [{}], que: [{}] });
    expect(result).toEqual([
      { word: 'Est', start: 0, end: 3, dictionaryForm: null, isTargetLang: false },
      { word: '-', start: 3, end: 4, isTargetLang: false },
      { word: 'ce', start: 4, end: 6, dictionaryForm: 'ce', isTargetLang: true },
      { word: ' ', start: 6, end: 7, isTargetLang: false },
      { word: 'que', start: 7, end: 10, dictionaryForm: 'que', isTargetLang: true },
    ]);
    expectContiguousSpans(result, text);
  });

  it('keeps a hyphenated word whole when the dictionary knows it', () => {
    expect(fr.extractWords('est-ce', { 'est-ce': [{}] })).toEqual([
      { word: 'est-ce', start: 0, end: 6, dictionaryForm: 'est-ce', isTargetLang: true },
    ]);
  });

  it('splits a multi-hyphen compound into every part with correct offsets', () => {
    const text = 'arc-en-ciel';
    const result = fr.extractWords(text, { arc: [{}], en: [{}], ciel: [{}] });
    expect(result).toEqual([
      { word: 'arc', start: 0, end: 3, dictionaryForm: 'arc', isTargetLang: true },
      { word: '-', start: 3, end: 4, isTargetLang: false },
      { word: 'en', start: 4, end: 6, dictionaryForm: 'en', isTargetLang: true },
      { word: '-', start: 6, end: 7, isTargetLang: false },
      { word: 'ciel', start: 7, end: 11, dictionaryForm: 'ciel', isTargetLang: true },
    ]);
    expectContiguousSpans(result, text);
  });

  it('keeps accented words whole', () => {
    const text = 'Ça va très bien, garçon?';
    const result = fr.extractWords(text, {});
    expect(result.map(w => w.word)).toEqual([
      'Ça',
      ' ',
      'va',
      ' ',
      'très',
      ' ',
      'bien',
      ', ',
      'garçon',
      '?',
    ]);
    expectContiguousSpans(result, text);
  });

  it('returns an empty array for empty text', () => {
    expect(fr.extractWords('', {})).toEqual([]);
  });

  it('round-trips the original text', () => {
    const text = `Il m${STRAIGHT}a dit : « arc-en-ciel », 3 fois.`;
    expect(reassemble(fr.extractWords(text, {}))).toBe(text);
  });
});

describe('normalizeWord', () => {
  const COMPOSED = 'caf\u00e9';
  const DECOMPOSED = 'cafe\u0301';

  it('lowercases, trims, and NFC-normalises', () => {
    expect(en.normalizeWord('  CAF\u00c9 ')).toBe(COMPOSED);
    expect(en.normalizeWord('Caf\u00e9')).toBe(COMPOSED);
  });

  it('collapses a decomposed accent onto the composed form', () => {
    expect(DECOMPOSED).not.toBe(COMPOSED);
    expect(DECOMPOSED).toHaveLength(5);
    expect(en.normalizeWord(DECOMPOSED)).toBe(COMPOSED);
    expect(en.normalizeWord(DECOMPOSED)).toHaveLength(4);
  });

  it('returns an empty string for falsy input', () => {
    expect(en.normalizeWord('')).toBe('');
    expect(en.normalizeWord(null as any)).toBe('');
    expect(en.normalizeWord(undefined as any)).toBe('');
  });

  it('behaves identically on the French override', () => {
    expect(fr.normalizeWord(`  L${STRAIGHT}EAU `)).toBe(`l${STRAIGHT}eau`);
    expect(fr.normalizeWord('CAFE\u0301')).toBe(COMPOSED);
    expect(fr.normalizeWord('')).toBe('');
    expect(fr.normalizeWord(null as any)).toBe('');
  });
});

describe('SpaceSeparatedLanguageAdapter.isValidWord / findDictionaryForm / getDictionaryEntries', () => {
  it('isValidWord normalises before looking up', () => {
    expect(en.isValidWord('Hello', { hello: [{}] })).toBe(true);
    expect(en.isValidWord('  HELLO  ', { hello: [{}] })).toBe(true);
    expect(en.isValidWord('hello', { hello: [] })).toBe(false);
  });

  it('isValidWord returns false for empty word or missing dictionary', () => {
    expect(en.isValidWord('', { '': [{}] })).toBe(false);
    expect(en.isValidWord('hello', null)).toBe(false);
  });

  it('isValidWord returns a falsy non-boolean for an unknown word', () => {
    // BUG: declared `boolean`, but `dictionary[normalized] && ...` yields undefined here.
    expect(en.isValidWord('nope', { hello: [{}] })).toBeUndefined();
  });

  it('findDictionaryForm returns the normalised word when it is a dictionary key', () => {
    expect(es.findDictionaryForm('Gato', { gato: [{}] })).toBe('gato');
    expect(es.findDictionaryForm('  GATO ', { gato: [{}] })).toBe('gato');
  });

  it('findDictionaryForm returns null for an unknown word', () => {
    expect(es.findDictionaryForm('perro', { gato: [{}] })).toBeNull();
    expect(es.findDictionaryForm('gato', { gato: [] })).toBeNull();
  });

  it('never reaches its non-lemma mapping branch', () => {
    // BUG: the mapping branch requires dictionary[word] to exist AND dictionary[word][0] to be
    // truthy, but that combination already returned from the first `if`. So a non-lemma entry
    // resolves to itself instead of to its lemma. Expected: 'gato'.
    const dictionary = {
      gato: [{ definition: 'cat' }],
      gatos: [[0, 0, 0, 0, 0, [['gato', ['plural']]]]],
    };
    expect(es.findDictionaryForm('gatos', dictionary)).toBe('gatos');
    expect(fr.findDictionaryForm('gatos', dictionary)).toBe('gatos');
  });

  it('getDictionaryEntries returns the entries for a direct hit', () => {
    expect(en.getDictionaryEntries('Hello', { hello: [{ definition: 'hi' }] })).toEqual([
      { definition: 'hi' },
    ]);
  });

  it('getDictionaryEntries falls back to findDictionaryForm for a decomposed accent', () => {
    // getDictionaryEntries does not NFC-normalise, but findDictionaryForm does, so the
    // decomposed spelling still resolves via the fallback path.
    const decomposed = 'Café';
    expect(en.getDictionaryEntries(decomposed, { 'café': [{ definition: 'coffee' }] })).toEqual([
      { definition: 'coffee' },
    ]);
  });

  it('getDictionaryEntries returns null for misses and falsy inputs', () => {
    expect(en.getDictionaryEntries('nope', { hello: [{}] })).toBeNull();
    expect(en.getDictionaryEntries('', {})).toBeNull();
    expect(en.getDictionaryEntries('hello', null)).toBeNull();
  });
});

describe('FrenchLanguageAdapter.findDictionaryForm — contractions', () => {
  it.each([
    [`l${STRAIGHT}eau`, 'eau'],
    [`d${STRAIGHT}accord`, 'accord'],
    [`c${STRAIGHT}est`, 'est'],
    [`j${STRAIGHT}aime`, 'aime'],
    [`n${STRAIGHT}est`, 'est'],
    [`s${STRAIGHT}appelle`, 'appelle'],
    [`t${STRAIGHT}aime`, 'aime'],
    [`m${STRAIGHT}appelle`, 'appelle'],
  ])('strips the elided article from %j', (word, base) => {
    expect(fr.findDictionaryForm(word, { [base]: [{}] })).toBe(base);
  });

  it('strips the article regardless of the leading capital', () => {
    expect(fr.findDictionaryForm(`L${STRAIGHT}eau`, { eau: [{}] })).toBe('eau');
  });

  it('handles accented base words', () => {
    expect(fr.findDictionaryForm(`l${STRAIGHT}été`, { 'été': [{}] })).toBe('été');
  });

  it('falls back to a capitalised base form when the word started with a capital', () => {
    expect(fr.findDictionaryForm(`L${STRAIGHT}Eau`, { Eau: [{}] })).toBe('Eau');
  });

  it('returns the whole contraction when the dictionary contains it verbatim', () => {
    expect(fr.findDictionaryForm(`d${STRAIGHT}accord`, { [`d${STRAIGHT}accord`]: [{}] })).toBe(
      `d${STRAIGHT}accord`
    );
  });

  it('returns null when neither the contraction nor the base word is known', () => {
    expect(fr.findDictionaryForm(`z${STRAIGHT}xyz`, {})).toBeNull();
  });

  it('does not handle two-letter elisions', () => {
    // BUG: only a single letter is allowed before the apostrophe, so qu' / jusqu' / lorsqu'
    // never resolve. Expected: 'il'.
    expect(fr.findDictionaryForm(`qu${STRAIGHT}il`, { il: [{}] })).toBeNull();
  });

  it('does not handle typographic apostrophes in contractions', () => {
    // BUG: contractionPattern hardcodes the ASCII U+0027; text using U+2019 never matches.
    expect(fr.findDictionaryForm(`d${CURLY}accord`, { accord: [{}] })).toBeNull();
  });

  it('rejects base words with characters outside the French accent set', () => {
    // The pattern's base-word class is [a-zàâäéèêëïîôùûüÿç]; ñ is not in it.
    expect(fr.findDictionaryForm(`l${STRAIGHT}añejo`, { 'añejo': [{}] })).toBeNull();
  });

  it('isValidWord delegates to findDictionaryForm', () => {
    expect(fr.isValidWord(`l${STRAIGHT}eau`, { eau: [{}] })).toBe(true);
    expect(fr.isValidWord('xyz', {})).toBe(false);
  });

  it('getDictionaryEntries returns the base word entries unchanged for a contraction', () => {
    // The article-prefixing enhancement is commented out in the source, so entries pass through.
    const entries = [{ definition: 'water', translation: 'water' }];
    expect(fr.getDictionaryEntries(`l${STRAIGHT}eau`, { eau: entries })).toEqual(entries);
  });

  it('getDictionaryEntries prefers a verbatim dictionary hit', () => {
    expect(fr.getDictionaryEntries(`d${STRAIGHT}accord`, { [`d${STRAIGHT}accord`]: [{ definition: 'ok' }] })).toEqual([
      { definition: 'ok' },
    ]);
  });
});

describe('SpaceSeparatedLanguageAdapter.getPronunciation', () => {
  it('prefers pronunciation, then ipa, then phonetic', () => {
    expect(en.getPronunciation('x', [{ pronunciation: 'p', ipa: 'i', phonetic: 'f' }])).toBe('p');
    expect(en.getPronunciation('x', [{ ipa: 'i', phonetic: 'f' }])).toBe('i');
    expect(en.getPronunciation('x', [{ phonetic: 'f' }])).toBe('f');
  });

  it('only looks at the first entry', () => {
    expect(en.getPronunciation('x', [{}, { pronunciation: 'p' }])).toBeNull();
  });

  it('returns null when there is nothing to report', () => {
    expect(en.getPronunciation('x', [])).toBeNull();
    expect(en.getPronunciation('x', null as any)).toBeNull();
  });
});

describe('EnglishLanguageAdapter — sentence boundary', () => {
  it('splits after . ! and ? followed by whitespace', () => {
    expect('The cat sat. It ran! Why? Yes'.split(en.getSentenceBoundary())).toEqual([
      'The cat sat.',
      'It ran!',
      'Why?',
      'Yes',
    ]);
  });

  it('does not split when the terminator is not followed by whitespace', () => {
    expect('e.g.hello'.split(en.getSentenceBoundary())).toEqual(['e.g.hello']);
  });
});

describe('EnglishLanguageAdapter.parseCSVLine', () => {
  it('splits on commas and trims each field', () => {
    expect(en.parseCSVLine('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('ignores commas inside double quotes and strips the quotes', () => {
    expect(en.parseCSVLine('word,"pho, netic",def')).toEqual(['word', 'pho, netic', 'def']);
  });

  it('returns one empty field for an empty line', () => {
    expect(en.parseCSVLine('')).toEqual(['']);
  });

  it('preserves empty fields', () => {
    expect(en.parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

describe('EnglishLanguageAdapter.parseDictionary — ECDICT CSV', () => {
  const csv = [
    'word,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio',
    'hello,həˈləʊ,"int. used as a greeting",int. 喂\\n int. 哈罗,int/1,3,1,zk gk,1234,567,,,',
    'cat,kæt,n. a small animal,n. 猫,n/1,5,1,zk,10,20,s:cats,,',
  ].join('\n');

  it('skips the header row and keys entries by the lowercased word', () => {
    const dictionary = en.parseDictionary(csv);
    expect(Object.keys(dictionary).sort()).toEqual(['cat', 'hello']);
  });

  it('maps the translation column onto definition and the definition column onto translation', () => {
    const dictionary = en.parseDictionary(csv);
    expect(dictionary['cat']?.[0]).toMatchObject({
      definition: '猫',
      translation: 'a small animal',
      pronunciation: 'kæt',
      partOfSpeech: 'n/1',
      collins: '5',
      oxford: '1',
      tag: 'zk',
      bnc: '10',
      frq: '20',
      exchange: 's:cats',
    });
  });

  it('strips part-of-speech markers and turns literal \\n into a comma', () => {
    const dictionary = en.parseDictionary(csv);
    expect(dictionary['hello']?.[0]?.definition).toBe('喂, 哈罗');
    expect(dictionary['hello']?.[0]?.translation).toBe('used as a greeting');
  });

  it('skips blank lines, short rows, and rows with no word', () => {
    const dictionary = en.parseDictionary(
      ['header', '', 'too,few', ',,,,', 'cat,kæt,n. a small animal,n. 猫'].join('\n')
    );
    expect(Object.keys(dictionary)).toEqual(['cat']);
  });

  it('groups multiple rows for the same word under one key', () => {
    const dictionary = en.parseDictionary(
      ['header', 'bank,bæŋk,n. money place,n. 银行', 'bank,bæŋk,n. river edge,n. 河岸'].join('\n')
    );
    expect(dictionary['bank']).toHaveLength(2);
  });

  it('returns an empty dictionary for empty input', () => {
    expect(en.parseDictionary('')).toEqual({});
  });
});

describe('Spanish/French parseDictionary — term bank listings', () => {
  it('returns an empty dictionary when the input is not a term bank listing', () => {
    expect(es.parseDictionary('not a listing')).toEqual({});
    expect(fr.parseDictionary('')).toEqual({});
  });

  it('returns an empty dictionary when the term banks cannot be required in the browser', () => {
    // `require` does not exist at runtime; each bank throws and is swallowed per-file.
    expect(es.parseDictionary('term_bank_1.json\nterm_bank_2.json')).toEqual({});
    expect(fr.parseDictionary('term_bank_1.json')).toEqual({});
  });
});

describe('SpaceSeparatedLanguageAdapter.processTermBank', () => {
  const lemmaEntry = [
    'hablar',
    'hablar',
    'lemma',
    'v',
    100,
    [
      {
        type: 'structured-content',
        content: [
          {
            content: [
              {
                data: { content: 'details-entry-Grammar' },
                content: [{ data: { content: 'Grammar-content' }, content: 'verb, first conjugation' }],
              },
              {
                data: { content: 'details-entry-Morphemes' },
                content: [{ data: { content: 'Morphemes-content' }, content: 'habl- + -ar' }],
              },
            ],
          },
          {
            data: { content: 'glosses' },
            content: [
              { content: [{ content: ['to speak', ' ', 'to talk'] }] },
              { content: [{ content: 'to say' }] },
            ],
          },
        ],
      },
    ],
  ];

  const nonLemmaEntry = ['hablo', 'hablo', 'non-lemma', 'v', 10, [['hablar', ['first-person singular present']]]];

  function freshAdapter() {
    return new SpaceSeparatedLanguageAdapter({} as any);
  }

  it('extracts word, part of speech, grammar, morphology and glosses from a lemma entry', () => {
    const adapter = freshAdapter();
    const dictionary: Record<string, any[]> = {};
    expect(adapter.processTermBank([lemmaEntry], dictionary)).toBe(1);
    expect(dictionary['hablar']).toEqual([
      {
        word: 'hablar',
        partOfSpeech: 'v',
        grammar: 'verb, first conjugation',
        morphology: 'habl- + -ar',
        definition: 'to speak to talk; to say',
        translation: 'to speak to talk',
        variations: [],
      },
    ]);
  });

  it('links a non-lemma entry to its lemma in both directions', () => {
    const adapter = freshAdapter();
    const dictionary: Record<string, any[]> = {};
    adapter.processTermBank([lemmaEntry], dictionary);
    expect(adapter.processTermBank([nonLemmaEntry], dictionary)).toBe(1);

    expect(dictionary['hablo']?.[0]).toMatchObject({
      word: 'hablo',
      grammar: 'non-lemma',
      morphology: 'first-person singular present',
      variations: ['hablar'],
      baseFormDefinitions: [
        {
          definition: 'to speak to talk; to say',
          translation: 'to speak to talk',
          partOfSpeech: 'v',
          grammar: 'verb, first conjugation',
        },
      ],
    });
    expect(dictionary['hablar']?.[0]?.variations).toEqual(['hablo']);
  });

  it('does not add a duplicate entry twice', () => {
    const adapter = freshAdapter();
    const dictionary: Record<string, any[]> = {};
    expect(adapter.processTermBank([lemmaEntry], dictionary)).toBe(1);
    expect(adapter.processTermBank([lemmaEntry], dictionary)).toBe(0);
    expect(dictionary['hablar']).toHaveLength(1);
  });

  it('normalises the dictionary key to lowercase NFC', () => {
    const adapter = freshAdapter();
    const dictionary: Record<string, any[]> = {};
    adapter.processTermBank([['Café', '', 'lemma', 'n', 1, []]], dictionary);
    expect(Object.keys(dictionary)).toEqual(['café']);
    expect(dictionary['café']?.[0]?.word).toBe('Café');
  });

  it('ignores non-array input and malformed rows', () => {
    const adapter = freshAdapter();
    expect(adapter.processTermBank('not an array' as any, {})).toBe(0);
    expect(adapter.processTermBank([['too', 'short']], {})).toBe(0);
    expect(adapter.processTermBank([[null, 1, 2, 3, 4, 5]], {})).toBe(0);
  });

  it('falls back to the grammar-info column when no Grammar section is present', () => {
    const adapter = freshAdapter();
    const dictionary: Record<string, any[]> = {};
    adapter.processTermBank([['gato', '', 'noun-m', 'n', 1, []]], dictionary);
    expect(dictionary['gato']?.[0]?.grammar).toBe('noun-m');
    expect(dictionary['gato']?.[0]?.definition).toBe('');
  });
});
