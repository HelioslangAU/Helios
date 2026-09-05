import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Jieba,
  buildFromDict,
  crlf,
  loadDictFromText,
  max_of_array,
  type JiebaDictEntry,
} from '@/lib/jieba';

/**
 * A miniature slice of jieba's `dict.txt.big`, in the real `word freq pos`
 * format. Frequencies are chosen so that the *frequency-based* route beats the
 * *greedy-longest* route on 中国人民: taking 中国 + 人民 scores higher than
 * 中国人 + 民 even though 中国人 is the longer first match.
 *
 * 爱 is deliberately absent so we can assert the single-character fallback.
 */
const MINI_DICT = [
  '中国 300 ns',
  '中国人 100 n',
  '人民 200 n',
  '中 1000 n',
  '国 800 n',
  '人 900 n',
  '民 500 n',
  '我 2000 r',
  '是 1500 v',
].join('\n');

/**
 * Build a Jieba instance from an in-memory dictionary instead of fetching the
 * 2.3 MB `dict.txt.big`. The constructor queues a dictionary *file* to fetch, so
 * we clear that queue and hand it parsed entries via `useDict` before `init()`.
 */
async function jiebaFrom(dictText: string): Promise<Jieba> {
  const jieba = new Jieba({ dictPath: 'unused-in-tests' });
  jieba._cache_.dict_file = [];
  jieba.useDict(loadDictFromText(dictText));
  await jieba.init();
  return jieba;
}

describe('crlf', () => {
  it('converts Windows CRLF line endings to LF', () => {
    expect(crlf('中国\r\n人民')).toBe('中国\n人民');
  });

  it('converts bare CR (classic Mac) line endings to LF', () => {
    expect(crlf('中国\r人民')).toBe('中国\n人民');
  });

  it('normalizes a mix of CRLF, CR and LF in one pass', () => {
    expect(crlf('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('leaves text without carriage returns untouched', () => {
    expect(crlf('我是中国人')).toBe('我是中国人');
  });

  it('returns an empty string for an empty string', () => {
    expect(crlf('')).toBe('');
  });
});

describe('max_of_array', () => {
  it('returns the largest value', () => {
    expect(max_of_array([-3.19, -4.29, -1.98])).toBe(-1.98);
  });

  it('returns the single element for a one-element array', () => {
    expect(max_of_array([-2.5])).toBe(-2.5);
  });

  it('handles duplicated maxima', () => {
    expect(max_of_array([1, 5, 5, 2])).toBe(5);
  });

  it('returns -Infinity for an empty array', () => {
    // Math.max.apply(null, []) === -Infinity. _calc never hits this because
    // _get_DAG guarantees at least one candidate per index.
    expect(max_of_array([])).toBe(-Infinity);
  });
});

describe('loadDictFromText', () => {
  it('parses `word freq pos` lines into [word, freq] pairs', () => {
    expect(loadDictFromText('中国 300 ns\n人民 200 n')).toEqual([
      ['中国', 300],
      ['人民', 200],
    ]);
  });

  it('skips blank lines and # comments', () => {
    expect(loadDictFromText('# jieba dict\n\n中国 300 ns\n\n   \n人民 200 n\n')).toEqual([
      ['中国', 300],
      ['人民', 200],
    ]);
  });

  it('skips lines with fewer than two whitespace-separated fields', () => {
    expect(loadDictFromText('中国 300 ns\nlonelyword\n人民 200 n')).toEqual([
      ['中国', 300],
      ['人民', 200],
    ]);
  });

  it('accepts a two-field line with no part-of-speech tag', () => {
    expect(loadDictFromText('中国 300')).toEqual([['中国', 300]]);
  });

  it('tolerates leading/trailing whitespace and multi-space separators', () => {
    expect(loadDictFromText('   中国    300   ns   ')).toEqual([['中国', 300]]);
  });

  it('parses fractional frequencies', () => {
    expect(loadDictFromText('中国 300.5 ns')).toEqual([['中国', 300.5]]);
  });

  it('coerces a non-numeric frequency to 0', () => {
    // BUG: `parseFloat(parts[1]) || 0` silently turns a malformed frequency into
    // 0, and _build_trie then stores Math.log(0 / total) === -Infinity for that
    // word, which drags `_cache_.min_freq` down to -Infinity for the whole
    // dictionary (see the "corrupt frequency" test below). A malformed line
    // would be safer skipped, or given the minimum positive frequency.
    expect(loadDictFromText('人 not-a-number n')).toEqual([['人', 0]]);
  });

  it('returns an empty dictionary for empty text', () => {
    expect(loadDictFromText('')).toEqual([]);
  });
});

describe('buildFromDict', () => {
  it('builds a trie where every word ends in a "" sentinel', () => {
    const [trie] = buildFromDict([['中国', 300]]);
    expect(trie).toEqual({ 中: { 国: { '': true } } });
  });

  it('shares prefixes and marks both a word and its longer form', () => {
    const [trie] = buildFromDict([
      ['中国', 300],
      ['中国人', 100],
      ['中', 1000],
    ]);
    expect(trie).toEqual({
      中: {
        '': true,
        国: { '': true, 人: { '': true } },
      },
    });
  });

  it('returns raw (not yet log-scaled) frequencies keyed by word', () => {
    const [, FREQ] = buildFromDict([
      ['中国', 300],
      ['人民', 200],
    ]);
    expect(FREQ).toEqual({ 中国: 300, 人民: 200 });
  });

  it('sums the total frequency across all entries', () => {
    const [, , total] = buildFromDict([
      ['中国', 300],
      ['人民', 200],
    ]);
    expect(total).toBe(500);
  });

  it('skips empty words without counting them toward the total', () => {
    const [trie, FREQ, total] = buildFromDict([
      ['', 5],
      ['中', 3],
    ]);
    expect(trie).toEqual({ 中: { '': true } });
    expect(FREQ).toEqual({ 中: 3 });
    expect(total).toBe(3);
  });

  it('returns an empty trie and zero total for an empty dictionary', () => {
    expect(buildFromDict([])).toEqual([{}, {}, 0]);
  });

  it('lets a later duplicate entry overwrite the earlier frequency but still doubles the total', () => {
    // BUG: a duplicated word is counted twice in `total` while FREQ keeps only
    // the last value, so the normalized probabilities no longer sum to 1. The
    // shipped dict has no duplicates, so this is latent.
    const [, FREQ, total] = buildFromDict([
      ['中国', 300],
      ['中国', 50],
    ]);
    expect(FREQ['中国']).toBe(50);
    expect(total).toBe(350);
  });
});

describe('Jieba construction', () => {
  it('exposes the default dictionary path', () => {
    expect(Jieba.DEFAULT_DICT_PATH).toBe('lib/jieba/dict.txt.big');
  });

  it('resolves the default dictionary through chrome.runtime.getURL when no path is given', () => {
    const jieba = new Jieba();
    expect(jieba._cache_.dict_file).toHaveLength(1);
    expect(jieba._cache_.dict_file[0]).toContain('lib/jieba/dict.txt.big');
  });

  it('queues an explicitly supplied dictPath instead', () => {
    const jieba = new Jieba({ dictPath: 'custom/dict.txt' });
    expect(jieba._cache_.dict_file).toEqual(['custom/dict.txt']);
  });

  it('starts uninitialized with an empty trie', () => {
    const jieba = new Jieba({ dictPath: 'custom/dict.txt' });
    expect(jieba.initialized).toBe(false);
    expect(jieba.trieTree).toEqual({});
  });

  it('appends array dictionaries passed to useDict', () => {
    const jieba = new Jieba({ dictPath: 'custom/dict.txt' });
    const entries: JiebaDictEntry[] = [['中国', 300]];
    jieba.useDict(entries);
    jieba.useDict([['人民', 200]]);
    expect(jieba.dictionary).toEqual([
      ['中国', 300],
      ['人民', 200],
    ]);
  });

  it('applies the return value of a function dictionary source', () => {
    const jieba = new Jieba({ dictPath: 'custom/dict.txt' });
    jieba.useDict(function () {
      return [['中国', 300]] as JiebaDictEntry[];
    });
    expect(jieba.dictionary).toEqual([['中国', 300]]);
  });

  it('throws on a dictionary that is neither string, array nor function', () => {
    const jieba = new Jieba({ dictPath: 'custom/dict.txt' });
    expect(() => jieba.useDict(42 as never)).toThrow('Invalid dictionary format: number');
  });
});

describe('Jieba initialization', () => {
  it('log-normalizes frequencies and records the minimum after init', async () => {
    const jieba = await jiebaFrom(MINI_DICT);
    const total = 300 + 100 + 200 + 1000 + 800 + 900 + 500 + 2000 + 1500;

    expect(jieba.initialized).toBe(true);
    expect(jieba._cache_.total).toBe(total);
    expect(jieba._cache_.FREQ?.['中国']).toBeCloseTo(Math.log(300 / total), 10);
    // 中国人 is the rarest entry, so it sets min_freq.
    expect(jieba._cache_.min_freq).toBeCloseTo(Math.log(100 / total), 10);
  });

  it('builds the trie from every dictionary entry', async () => {
    const jieba = await jiebaFrom(MINI_DICT);
    expect(jieba.trieTree['中']).toEqual({
      '': true,
      国: { '': true, 人: { '': true } },
    });
  });

  it('leaves the trie empty and warns when the dictionary is empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const jieba = await jiebaFrom('');
    expect(jieba.trieTree).toEqual({});
    expect(warn).toHaveBeenCalledWith('Jieba: Dictionary is empty. Cannot build trie.');
  });

  it('ignores dictionary entries added after init until re-created', async () => {
    // BUG: init() memoizes its promise and _setup() short-circuits on
    // `initialized`, so useDict() after init() silently has no effect. Callers
    // that expect to extend the dictionary at runtime get stale segmentation.
    const jieba = await jiebaFrom('中国 300 ns\n人 900 n\n民 500 n');
    jieba.useDict([['人民', 200]]);
    await jieba.init();
    expect(await jieba.cut('中国人民')).toEqual(['中国', '人', '民']);
  });

  it('lets cutSync run once the instance has been initialized asynchronously', async () => {
    const jieba = await jiebaFrom(MINI_DICT);
    expect(jieba.cutSync('我是中国人民')).toEqual(['我', '是', '中国', '人民']);
  });
});

describe('Jieba._get_DAG', () => {
  it('lists every dictionary word starting at each index as end offsets', async () => {
    const jieba = await jiebaFrom(MINI_DICT);
    // index 0 -> 中 (0), 中国 (1), 中国人 (2); index 2 -> 人 (2), 人民 (3)
    expect(jieba._get_DAG('中国人民')).toEqual({
      0: [0, 1, 2],
      1: [1],
      2: [2, 3],
      3: [3],
    });
  });

  it('falls back to a single-character span for indices with no dictionary match', async () => {
    const jieba = await jiebaFrom('中国 300 ns');
    // Only 中国 is known, so index 0 gets [1] from the trie walk and indices
    // 1 and 2 get their single-character fallback.
    expect(jieba._get_DAG('中国人')).toEqual({ 0: [1], 1: [1], 2: [2] });
  });

  it('gives every character a single-character span when nothing matches', async () => {
    const jieba = await jiebaFrom('中国 300 ns');
    expect(jieba._get_DAG('你好')).toEqual({ 0: [0], 1: [1] });
  });

  it('returns an empty DAG for an empty sentence', async () => {
    const jieba = await jiebaFrom(MINI_DICT);
    expect(jieba._get_DAG('')).toEqual({});
  });
});

describe('Jieba.cut — segmentation', () => {
  let jieba: Jieba;

  beforeEach(async () => {
    jieba = await jiebaFrom(MINI_DICT);
  });

  it('segments a sentence into the highest-scoring dictionary words', async () => {
    expect(await jieba.cut('我是中国人民')).toEqual(['我', '是', '中国', '人民']);
  });

  it('prefers the frequency-optimal split over the greedy longest first match', async () => {
    // Greedy-longest would take 中国人 + 民; the route search picks 中国 + 人民
    // because log(300) + log(200) beats log(100) + log(500) after normalization.
    expect(await jieba.cut('中国人民')).toEqual(['中国', '人民']);
  });

  it('does take the longest match when nothing follows to outscore it', async () => {
    expect(await jieba.cut('中国人')).toEqual(['中国人']);
  });

  it('flips to the greedy split when the longer word is made far more frequent', async () => {
    const greedy = await jiebaFrom(
      ['中国 300 ns', '中国人 900000 n', '人民 200 n', '中 1000 n', '国 800 n', '人 900 n', '民 500 n'].join('\n')
    );
    expect(await greedy.cut('中国人民')).toEqual(['中国人', '民']);
  });

  it('emits characters absent from the dictionary as single tokens', async () => {
    // 爱 is not in MINI_DICT.
    expect(await jieba.cut('我爱中国')).toEqual(['我', '爱', '中国']);
  });

  it('splits an entirely unknown phrase into individual characters', async () => {
    expect(await jieba.cut('你好世界')).toEqual(['你', '好', '世', '界']);
  });

  it('returns an empty array for an empty sentence', async () => {
    expect(await jieba.cut('')).toEqual([]);
  });

  it('passes the result to an optional callback as well as returning it', async () => {
    const seen: string[][] = [];
    const ret = await jieba.cut('中国人民', (r) => seen.push(r));
    expect(seen).toEqual([['中国', '人民']]);
    expect(seen[0]).toBe(ret);
  });
});

describe('Jieba.cut — Latin, digits and punctuation', () => {
  let jieba: Jieba;

  beforeEach(async () => {
    jieba = await jiebaFrom(MINI_DICT);
  });

  it('buffers a run of ASCII letters embedded in Chinese into one token', async () => {
    expect(await jieba.cut('中国abc人民')).toEqual(['中国', 'abc', '人民']);
  });

  it('keeps a leading Latin run as one token', async () => {
    expect(await jieba.cut('abc中国')).toEqual(['abc', '中国']);
  });

  it('keeps a run of digits together', async () => {
    expect(await jieba.cut('我是2024年')).toEqual(['我', '是', '2024', '年']);
  });

  it('keeps letters and digits in the same buffered token', async () => {
    expect(await jieba.cut('中国HSK6级')).toEqual(['中国', 'HSK6', '级']);
  });

  it('preserves an inter-word space as its own token', async () => {
    expect(await jieba.cut('我是 中国人')).toEqual(['我', '是', ' ', '中国人']);
  });

  it('preserves a tab as its own token', async () => {
    expect(await jieba.cut('中国\t人民')).toEqual(['中国', '\t', '人民']);
  });

  it('normalizes CRLF to a single LF token', async () => {
    expect(await jieba.cut('中国\r\n人民')).toEqual(['中国', '\n', '人民']);
  });

  it('emits full-width CJK punctuation as separate single-character tokens', async () => {
    expect(await jieba.cut('我是中国人，你呢？')).toEqual([
      '我',
      '是',
      '中国人',
      '，',
      '你',
      '呢',
      '？',
    ]);
  });

  it('breaks a Latin run apart on the ASCII separators re_han admits', async () => {
    // BUG: re_han (/[一-龥a-zA-Z0-9+#&\._]+/) pulls `. _ + # &` into the
    // same block as the surrounding letters, but the buffering branch only
    // accepts [a-zA-Z0-9], so those characters flush the buffer. A decimal like
    // "3.14" or a domain like "a.b" is therefore torn into pieces.
    expect(await jieba.cut('中国 a.b')).toEqual(['中国', ' ', 'a', '.', 'b']);
    expect(await jieba.cut('中国3.14')).toEqual(['中国', '3', '.', '14']);
  });
});

describe('Jieba.cut — degraded states', () => {
  it('returns the whole sentence as one token when never initialized', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const jieba = new Jieba({ dictPath: 'unused-in-tests' });
    jieba._cache_.dict_file = [];
    expect(jieba.cutSync('我是中国人')).toEqual(['我是中国人']);
    expect(warn).toHaveBeenCalled();
  });

  it('returns the whole sentence as one token when the dictionary was empty', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const jieba = await jiebaFrom('');
    expect(await jieba.cut('我是中国人')).toEqual(['我是中国人']);
  });

  it('still segments known words when a corrupt frequency poisons min_freq', async () => {
    // BUG: a 0 / non-numeric frequency makes Math.log(0) === -Infinity, so
    // min_freq becomes -Infinity and every out-of-dictionary substring scores
    // -Infinity. Segmentation only survives because max_of_array picks the first
    // -Infinity candidate, i.e. the shortest span; the scoring is effectively
    // disabled for unknown text.
    const jieba = await jiebaFrom('中国 0 ns\n人民 200 n');
    expect(jieba._cache_.min_freq).toBe(-Infinity);
    expect(await jieba.cut('中国人民')).toEqual(['中国', '人民']);
    expect(await jieba.cut('你好')).toEqual(['你', '好']);
  });
});
