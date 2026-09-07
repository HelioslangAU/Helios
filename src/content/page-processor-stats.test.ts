import { describe, it, expect } from 'vitest';
import { PageProcessor } from '@/content/page-processor';

/**
 * The numbers the comprehension side tab reports all come out of
 * `_calculateCoreStatsFromWords`. These pin the arithmetic against inputs
 * whose answers can be worked out by hand.
 *
 * A word counts as understood when it is known *or* ignored — ignoring a name
 * you will never study should not hold your comprehension down.
 */

type Vocab = { known?: string[]; ignored?: string[] };

/** A processor with nothing but the vocabulary the stats consult. */
function processorWith({ known = [], ignored = [] }: Vocab): PageProcessor {
  const p = Object.create(PageProcessor.prototype) as PageProcessor;
  (p as unknown as { vocabManager: unknown }).vocabManager = {
    isWordKnown: (w: string) => known.includes(w),
    isWordIgnored: (w: string) => ignored.includes(w),
  };
  return p;
}

/** Words laid out over `text`, so sentence ranges can find them. */
function wordsIn(text: string, words: string[]) {
  let cursor = 0;
  return words.map((word) => {
    const start = text.indexOf(word, cursor);
    cursor = start + word.length;
    return { word, start, end: start + word.length };
  });
}

const adapter = { getSentenceBoundary: () => /(?<=[.!?。！？\n])/ } as never;

describe('comprehension arithmetic', () => {
  it('counts every occurrence, so a repeated unknown word costs every time', () => {
    const words = [{ word: 'a' }, { word: 'b' }, { word: 'b' }, { word: 'b' }] as never;
    const s = processorWith({ known: ['a'] })._calculateCoreStatsFromWords(words);

    expect(s.totalTokens).toBe(4);
    expect(s.knownTokens).toBe(1);
    expect(Math.round((s.knownTokens / s.totalTokens) * 100)).toBe(25);
  });

  it('counts each distinct word once for unique comprehension', () => {
    const words = [{ word: 'a' }, { word: 'b' }, { word: 'b' }, { word: 'b' }] as never;
    const s = processorWith({ known: ['a'] })._calculateCoreStatsFromWords(words);

    // One known of two distinct words: 50%, against 25% by occurrence.
    expect(s.uniqueTotal).toBe(2);
    expect(s.uniqueKnown).toBe(1);
    expect(Math.round((s.uniqueKnown / s.uniqueTotal) * 100)).toBe(50);
  });

  it('treats an ignored word as understood', () => {
    const words = [{ word: '学习' }, { word: '北京' }] as never;
    const s = processorWith({ known: ['学习'], ignored: ['北京'] })
      ._calculateCoreStatsFromWords(words);

    expect(s.knownTokens).toBe(2);
    expect(s.uniqueKnown).toBe(2);
  });

  it('folds case together so "The" and "the" are one word', () => {
    const words = [{ word: 'The' }, { word: 'the' }] as never;
    const s = processorWith({})._calculateCoreStatsFromWords(words);

    expect(s.totalTokens).toBe(2);
    expect(s.uniqueTotal).toBe(1);
  });

  it('skips empty entries rather than counting them as words', () => {
    const words = [{ word: 'a' }, { word: '' }, { word: 'b' }] as never;
    const s = processorWith({ known: ['a'] })._calculateCoreStatsFromWords(words);

    expect(s.totalTokens).toBe(2);
  });

  it('reports nothing for an empty page instead of dividing by zero', () => {
    const s = processorWith({})._calculateCoreStatsFromWords([] as never);

    expect(s.totalTokens).toBe(0);
    expect(s.uniqueTotal).toBe(0);
    expect(s.sentencesWithWords).toBe(0);
  });
});

describe('sentence breakdown', () => {
  // Three sentences: all known, one unknown, two unknown.
  const text = '我 学习 中文。我 学习 日文。我 看 法文 书。';
  const words = wordsIn(text, ['我', '学习', '中文', '我', '学习', '日文', '我', '看', '法文', '书']);
  const known = ['我', '学习', '中文', '看'];

  it('counts T0, T1 and T2 against sentences that contain words', () => {
    const s = processorWith({ known })._calculateCoreStatsFromWords(
      words as never,
      text,
      adapter,
    );

    expect(s.sentencesWithWords).toBe(3);
    expect(s.t0Sentences).toBe(1); // 我 学习 中文 — all known
    expect(s.t1Sentences).toBe(1); // 我 学习 日文 — one unknown
    expect(s.t2Sentences).toBe(1); // 我 看 法文 书 — two unknown
  });

  it('the headline breakdown is T0 + T1 + T2 over sentences with words', () => {
    const s = processorWith({ known })._calculateCoreStatsFromWords(
      words as never,
      text,
      adapter,
    );
    const breakdown = Math.round(
      ((s.t0Sentences + s.t1Sentences + s.t2Sentences) / s.sentencesWithWords) * 100,
    );
    expect(breakdown).toBe(100);
  });

  it('ignores sentences with no target-language words in them', () => {
    const t = 'Hello there. 我 学习 中文。';
    const w = wordsIn(t, ['我', '学习', '中文']);
    const s = processorWith({ known: ['我', '学习', '中文'] })._calculateCoreStatsFromWords(
      w as never,
      t,
      adapter,
    );

    expect(s.sentencesWithWords).toBe(1);
    expect(s.t0Sentences).toBe(1);
  });

  it('reports no sentences when there is no text to split', () => {
    const s = processorWith({ known: ['a'] })._calculateCoreStatsFromWords(
      [{ word: 'a' }] as never,
    );

    expect(s.sentencesWithWords).toBe(0);
    expect(s.t0Sentences).toBe(0);
  });
});
