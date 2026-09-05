/**
 * Chinese adapter tests.
 *
 * NOTE: ChineseLanguageAdapter kicks off an async jieba load in its constructor
 * (chrome.runtime.getURL + fetch of the jieba dict). That never completes under test, so
 * `jiebaInitialized` stays false and extractWords always takes its non-jieba fallback path.
 * These tests deliberately pin `jieba = null` before calling extractWords so the fallback is
 * exercised deterministically. Jieba segmentation itself is NOT covered here.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ChineseLanguageAdapter } from '@/content/languages/chinese-adapter';

const zh = new ChineseLanguageAdapter();

describe('ChineseLanguageAdapter — configuration', () => {
  it('exposes the expected language metadata', () => {
    const config = zh.getConfig();
    expect(config.code).toBe('zh');
    expect(config.name).toBe('Chinese');
    expect(config.displayName).toBe('Chinese (中文)');
    expect(config.maxWordLength).toBe(10);
    expect(config.hasSpaces).toBe(false);
    expect(config.script).toBe('han');
    expect(config.direction).toBe('ltr');
  });

  it('scans at character resolution and is not case sensitive', () => {
    expect(zh.getScanResolution()).toBe('char');
    expect(zh.getCaseSensitive()).toBe(false);
  });

  it('lets the caller override individual config fields', () => {
    const custom = new ChineseLanguageAdapter({ maxWordLength: 4, displayName: 'Mandarin' });
    expect(custom.getConfig().maxWordLength).toBe(4);
    expect(custom.getConfig().displayName).toBe('Mandarin');
    expect(custom.getConfig().code).toBe('zh');
  });

  it('has no local dictionary path and downloads CC-CEDICT from MDBG', () => {
    expect(zh.getDictionaryPath()).toBeUndefined();
    expect(zh.getDictionaryDownloadUrl()).toBe(
      'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip'
    );
  });

  it('exposes the six HSK levels with their word counts', () => {
    expect(zh.getLevelDefinitions()).toEqual([
      { level: 'HSK1', name: 'HSK 1', wordCount: 150 },
      { level: 'HSK2', name: 'HSK 2', wordCount: 300 },
      { level: 'HSK3', name: 'HSK 3', wordCount: 600 },
      { level: 'HSK4', name: 'HSK 4', wordCount: 1200 },
      { level: 'HSK5', name: 'HSK 5', wordCount: 2500 },
      { level: 'HSK6', name: 'HSK 6', wordCount: 5000 },
    ]);
  });

  it('returns the same onboarding vocab file for every HSK level', () => {
    expect(zh.getOnboardingVocabPath('HSK1')).toBe('OnboardingVocab/zh5k.csv');
    expect(zh.getOnboardingVocabPath('HSK6')).toBe('OnboardingVocab/zh5k.csv');
  });
});

describe('ChineseLanguageAdapter.isTargetCharacter', () => {
  it.each(['中', '文', '你', '好', '我', '龘'])('accepts the common CJK character %j', char => {
    expect(zh.isTargetCharacter(char)).toBe(true);
  });

  it('accepts both ends of the CJK Unified Ideographs block (U+4E00-U+9FFF)', () => {
    expect(zh.isTargetCharacter('一')).toBe(true);
    expect(zh.isTargetCharacter('鿿')).toBe(true);
  });

  it('rejects the characters just outside CJK Unified Ideographs', () => {
    expect(zh.isTargetCharacter('䷿')).toBe(false);
    expect(zh.isTargetCharacter('ꀀ')).toBe(false);
  });

  it('accepts both ends of CJK Extension A (U+3400-U+4DBF)', () => {
    expect(zh.isTargetCharacter('㐀')).toBe(true);
    expect(zh.isTargetCharacter('䶿')).toBe(true);
  });

  it('rejects the characters just outside CJK Extension A', () => {
    expect(zh.isTargetCharacter('㏿')).toBe(false);
    expect(zh.isTargetCharacter('䷀')).toBe(false); // Yijing hexagram symbols
  });

  it('accepts a supplementary-plane ideograph from the configured U+20000 range', () => {
    // codePointAt reads the whole astral code point; charCodeAt used to return the leading
    // surrogate (0xD840), which made the CJK Extension B range unreachable.
    expect('\u{20000}'.codePointAt(0)).toBe(0x20000);
    expect(zh.isTargetCharacter('\u{20000}')).toBe(true);
    expect(zh.isTargetCharacter('\u{2A6DF}')).toBe(true); // last char of CJK Extension B
  });

  it('rejects a supplementary-plane character past CJK Extension B', () => {
    expect(zh.isTargetCharacter('\u{2A700}')).toBe(false); // CJK Extension C
    expect(zh.isTargetCharacter('\u{1F600}')).toBe(false); // emoji
  });

  it('still rejects a lone surrogate half', () => {
    // extractWords walks the string one UTF-16 code unit at a time, so each half of an
    // astral character is inspected on its own and remains non-target.
    expect(zh.isTargetCharacter('\u{20000}'[0])).toBe(false);
    expect(zh.isTargetCharacter('\u{20000}'[1])).toBe(false);
  });

  it.each(['a', 'Z', '1', ' ', '\n', '.', '-'])('rejects the ASCII character %j', char => {
    expect(zh.isTargetCharacter(char)).toBe(false);
  });

  it.each(['，', '。', '！', '？', '、', '“'])('rejects the CJK punctuation mark %j', char => {
    expect(zh.isTargetCharacter(char)).toBe(false);
  });

  it('rejects full-width digits and letters', () => {
    expect(zh.isTargetCharacter('１')).toBe(false);
    expect(zh.isTargetCharacter('Ａ')).toBe(false);
  });

  it('rejects emoji, kana and hangul', () => {
    expect(zh.isTargetCharacter('😀')).toBe(false);
    expect(zh.isTargetCharacter('あ')).toBe(false);
    expect(zh.isTargetCharacter('ア')).toBe(false);
    expect(zh.isTargetCharacter('한')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(zh.isTargetCharacter('')).toBe(false);
    expect(zh.isTargetCharacter(null as any)).toBe(false);
    expect(zh.isTargetCharacter(undefined as any)).toBe(false);
  });

  it('only inspects the first character of a longer string', () => {
    expect(zh.isTargetCharacter('中a')).toBe(true);
    expect(zh.isTargetCharacter('a中')).toBe(false);
  });
});

describe('ChineseLanguageAdapter.containsTargetLanguage', () => {
  it('finds Chinese anywhere in mixed text', () => {
    expect(zh.containsTargetLanguage('Hello 中文 world')).toBe(true);
    expect(zh.containsTargetLanguage('中')).toBe(true);
  });

  it('returns false for Latin-only text, punctuation-only text and empty text', () => {
    expect(zh.containsTargetLanguage('Hello world')).toBe(false);
    expect(zh.containsTargetLanguage('，。！')).toBe(false);
    expect(zh.containsTargetLanguage('')).toBe(false);
  });
});

describe('ChineseLanguageAdapter.decodePinyinSyllable', () => {
  it.each([
    ['ni3', 'nǐ'],
    ['hao3', 'hǎo'],
    ['zhong1', 'zhōng'],
    ['guo2', 'guó'],
    ['e4', 'è'],
    ['a1', 'ā'],
  ])('places the tone mark for %j', (input, expected) => {
    expect(zh.decodePinyinSyllable(input)).toBe(expected);
  });

  it.each([
    ['liu2', 'liú'],
    ['huai2', 'huái'],
    ['jiu3', 'jiǔ'],
    ['xue2', 'xué'],
  ])('marks the vowel after a medial for %j', (input, expected) => {
    expect(zh.decodePinyinSyllable(input)).toBe(expected);
  });

  it('drops the tone digit for neutral tone 5', () => {
    expect(zh.decodePinyinSyllable('ma5')).toBe('ma');
    expect(zh.decodePinyinSyllable('r5')).toBe('r');
  });

  it.each([
    ['nu:3', 'nǚ'],
    ['lu:4', 'lǜ'],
    ['nv3', 'nǚ'],
    ['lv4', 'lǜ'],
  ])('converts the u-umlaut spellings in %j', (input, expected) => {
    expect(zh.decodePinyinSyllable(input)).toBe(expected);
  });

  it('returns the syllable unchanged when there is no tone digit', () => {
    expect(zh.decodePinyinSyllable('abc')).toBe('abc');
    expect(zh.decodePinyinSyllable('x')).toBe('x');
    expect(zh.decodePinyinSyllable('')).toBe('');
  });

  it('returns the syllable unchanged for out-of-range tone digits', () => {
    expect(zh.decodePinyinSyllable('ni6')).toBe('ni6');
    expect(zh.decodePinyinSyllable('ni0')).toBe('ni0');
  });

  it('returns the syllable unchanged when it has a tone digit but no vowel', () => {
    expect(zh.decodePinyinSyllable('n2')).toBe('n2');
  });
});

describe('ChineseLanguageAdapter.parseDictionary — CC-CEDICT', () => {
  const cedict = [
    '# CC-CEDICT',
    '#! version=1',
    '',
    '中國 中国 [Zhong1 guo2] /China/Middle Kingdom/',
    '你好 你好 [ni3 hao3] /hello/hi/how are you?/',
    '女 女 [nu:3] /female/woman/daughter/',
    'this line is not a CEDICT entry',
    '一 一 [yi1] /one/1/single/',
  ].join('\n');

  it('indexes an entry under both the traditional and simplified forms', () => {
    const dictionary = zh.parseDictionary(cedict);
    expect(dictionary['中國']).toBeDefined();
    expect(dictionary['中国']).toBeDefined();
    expect(dictionary['中國']?.[0]?.character).toBe('中國');
    expect(dictionary['中国']?.[0]?.character).toBe('中国');
  });

  it('indexes an entry once when traditional and simplified are identical', () => {
    const dictionary = zh.parseDictionary(cedict);
    expect(dictionary['你好']).toHaveLength(1);
    expect(dictionary['你好']?.[0]).toEqual({
      traditional: '你好',
      simplified: '你好',
      pinyin: 'nǐ hǎo',
      definition: 'hello; hi; how are you?',
      character: '你好',
    });
  });

  it('converts numbered pinyin to tone marks, preserving syllable spacing', () => {
    const dictionary = zh.parseDictionary(cedict);
    expect(dictionary['中国']?.[0]?.pinyin).toBe('Zhōng guó');
    expect(dictionary['女']?.[0]?.pinyin).toBe('nǚ');
  });

  it('joins the slash-delimited senses with semicolons', () => {
    const dictionary = zh.parseDictionary(cedict);
    expect(dictionary['一']?.[0]?.definition).toBe('one; 1; single');
    expect(dictionary['女']?.[0]?.definition).toBe('female; woman; daughter');
  });

  it('skips comments, blank lines and unparseable lines', () => {
    const dictionary = zh.parseDictionary(cedict);
    expect(Object.keys(dictionary).sort()).toEqual(['一', '中国', '中國', '你好', '女'].sort());
  });

  it('accumulates multiple senses of the same headword', () => {
    const dictionary = zh.parseDictionary(
      ['行 行 [xing2] /to walk/to go/', '行 行 [hang2] /row/line/profession/'].join('\n')
    );
    expect(dictionary['行']).toHaveLength(2);
    expect(dictionary['行']?.map(e => e.pinyin)).toEqual(['xíng', 'háng']);
  });

  it('returns an empty dictionary for empty or comment-only input', () => {
    expect(zh.parseDictionary('')).toEqual({});
    expect(zh.parseDictionary('# only a comment\n')).toEqual({});
  });
});

describe('ChineseLanguageAdapter — pronunciation, boundaries and lookups', () => {
  it('getPronunciation returns the pinyin of the first entry', () => {
    expect(zh.getPronunciation('你好', [{ pinyin: 'nǐ hǎo' }, { pinyin: 'other' }])).toBe('nǐ hǎo');
  });

  it('getPronunciation returns null for an empty or nullish entry list', () => {
    expect(zh.getPronunciation('你好', [])).toBeNull();
    expect(zh.getPronunciation('你好', null as any)).toBeNull();
  });

  it('getSentenceBoundary splits after Latin and CJK terminators', () => {
    expect('他走了。我留下！为什么？好'.split(zh.getSentenceBoundary())).toEqual([
      '他走了。',
      '我留下！',
      '为什么？',
      '好',
    ]);
  });

  it('getSentenceBoundary splits after a newline', () => {
    expect('第一行\n第二行'.split(zh.getSentenceBoundary())).toEqual(['第一行\n', '第二行']);
  });

  it('getDictionaryEntries looks the word up verbatim', () => {
    const dictionary = { '中国': [{ definition: 'China' }] };
    expect(zh.getDictionaryEntries('中国', dictionary)).toEqual([{ definition: 'China' }]);
    expect(zh.getDictionaryEntries('中國', dictionary)).toBeNull();
  });

  it('getDictionaryEntries returns null for empty entry lists and falsy inputs', () => {
    expect(zh.getDictionaryEntries('中国', { '中国': [] })).toBeNull();
    expect(zh.getDictionaryEntries('', {})).toBeNull();
    expect(zh.getDictionaryEntries('中国', null)).toBeNull();
  });
});

describe('ChineseLanguageAdapter.extractWords — non-jieba fallback', () => {
  let adapter: ChineseLanguageAdapter;

  beforeEach(() => {
    adapter = new ChineseLanguageAdapter();
    // Force the fallback path: jieba never finishes loading under test anyway.
    adapter.jieba = null;
    adapter.jiebaInitialized = false;
  });

  it('greedily matches the longest dictionary word', async () => {
    const dictionary = { '我': [{}], '喜欢': [{}], '中国': [{}], '中国菜': [{}] };
    await expect(adapter.extractWords('我喜欢中国菜', dictionary)).resolves.toEqual([
      { word: '我', start: 0, end: 1, isTargetLang: true },
      { word: '喜欢', start: 1, end: 3, isTargetLang: true },
      { word: '中国菜', start: 3, end: 6, isTargetLang: true },
    ]);
  });

  it('falls back to single characters when nothing is in the dictionary', async () => {
    await expect(adapter.extractWords('中文', {})).resolves.toEqual([
      { word: '中', start: 0, end: 1, isTargetLang: true },
      { word: '文', start: 1, end: 2, isTargetLang: true },
    ]);
  });

  it('tolerates a null dictionary', async () => {
    await expect(adapter.extractWords('中文', null)).resolves.toEqual([
      { word: '中', start: 0, end: 1, isTargetLang: true },
      { word: '文', start: 1, end: 2, isTargetLang: true },
    ]);
  });

  it('groups consecutive non-Chinese characters into one non-target chunk', async () => {
    await expect(adapter.extractWords('Hello 世界 123', { '世界': [{}] })).resolves.toEqual([
      { word: 'Hello ', start: 0, end: 6, isTargetLang: false },
      { word: '世界', start: 6, end: 8, isTargetLang: true },
      { word: ' 123', start: 8, end: 12, isTargetLang: false },
    ]);
  });

  it('treats CJK punctuation as non-target content', async () => {
    await expect(adapter.extractWords('你好，世界。', { '你好': [{}], '世界': [{}] })).resolves.toEqual([
      { word: '你好', start: 0, end: 2, isTargetLang: true },
      { word: '，', start: 2, end: 3, isTargetLang: false },
      { word: '世界', start: 3, end: 5, isTargetLang: true },
      { word: '。', start: 5, end: 6, isTargetLang: false },
    ]);
  });

  it('never matches a candidate longer than five characters', async () => {
    const dictionary = { '中华人民共和国': [{}], '中华人民共': [{}] };
    const result = await adapter.extractWords('中华人民共和国', dictionary);
    expect(result[0]).toEqual({ word: '中华人民共', start: 0, end: 5, isTargetLang: true });
  });

  it('returns an empty array for empty text', async () => {
    await expect(adapter.extractWords('', {})).resolves.toEqual([]);
  });

  it('returns Latin-only text as a single non-target chunk', async () => {
    await expect(adapter.extractWords('hello world', {})).resolves.toEqual([
      { word: 'hello world', start: 0, end: 11, isTargetLang: false },
    ]);
  });

  it('produces contiguous spans that reassemble the original text', async () => {
    const text = '我喜欢中国菜! Very 好吃。';
    const result = await adapter.extractWords(text, { '我': [{}], '喜欢': [{}], '中国菜': [{}], '好吃': [{}] });
    let cursor = 0;
    for (const word of result) {
      expect(word.start).toBe(cursor);
      expect(word.end).toBe(word.start + word.word.length);
      cursor = word.end;
    }
    expect(cursor).toBe(text.length);
    expect(result.map(w => w.word).join('')).toBe(text);
  });
});
