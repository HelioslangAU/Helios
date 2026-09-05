import { describe, it, expect } from 'vitest';
import { SubtitleEntry } from '@/content/video/models/subtitle-entry';

const make = (start: number, end: number, text = '你好', index = 0) =>
  new SubtitleEntry({ index, start, end, text });

describe('SubtitleEntry — construction', () => {
  it('stores index, start, end and text as given', () => {
    const entry = new SubtitleEntry({ index: 3, start: 1500, end: 4200, text: '我们走吧' });
    expect(entry.index).toBe(3);
    expect(entry.start).toBe(1500);
    expect(entry.end).toBe(4200);
    expect(entry.text).toBe('我们走吧');
  });

  it('defaults originalText to text when omitted', () => {
    const entry = make(0, 1000, 'Café au lait');
    expect(entry.originalText).toBe('Café au lait');
  });

  it('keeps an explicitly supplied originalText distinct from text', () => {
    const entry = new SubtitleEntry({
      index: 0,
      start: 0,
      end: 1000,
      text: '漢字を読む',
      originalText: '<ruby>漢字<rt>かんじ</rt></ruby>を読む'
    });
    expect(entry.text).toBe('漢字を読む');
    expect(entry.originalText).toBe('<ruby>漢字<rt>かんじ</rt></ruby>を読む');
  });

  it('treats an explicit null originalText as absent', () => {
    const entry = new SubtitleEntry({ index: 0, start: 0, end: 1, text: 'hi', originalText: null });
    expect(entry.originalText).toBe('hi');
  });

  it('falls back to text when originalText is an empty string', () => {
    const entry = new SubtitleEntry({ index: 0, start: 0, end: 1, text: 'hi', originalText: '' });
    // BUG(ish): the `originalText || text` fallback cannot represent a
    // deliberately empty original.
    expect(entry.originalText).toBe('hi');
  });

  it('keeps empty text as an empty string', () => {
    const entry = make(0, 1000, '');
    expect(entry.text).toBe('');
    expect(entry.originalText).toBe('');
  });
});

describe('SubtitleEntry.getDuration', () => {
  it('returns end minus start in milliseconds', () => {
    expect(make(1000, 3500).getDuration()).toBe(2500);
  });

  it('returns 0 for a zero-length cue', () => {
    expect(make(4200, 4200).getDuration()).toBe(0);
  });

  it('returns a negative duration for a reversed cue rather than clamping', () => {
    // BUG(ish): malformed cues (end before start) produce a negative duration,
    // which silently loses the "longest duration wins" dedup comparison in
    // SubtitleCollection.getSubtitlesAt.
    expect(make(9000, 2000).getDuration()).toBe(-7000);
  });

  it('handles hour-scale timings without precision loss', () => {
    expect(make(2 * 3600000 + 500, 2 * 3600000 + 3500).getDuration()).toBe(3000);
  });
});

describe('SubtitleEntry.isActiveAt', () => {
  const entry = make(1000, 3000);

  it('is active strictly inside the window', () => {
    expect(entry.isActiveAt(2000)).toBe(true);
  });

  it('is active exactly on the start boundary', () => {
    expect(entry.isActiveAt(1000)).toBe(true);
  });

  it('is active exactly on the end boundary', () => {
    // Inclusive on both ends, so back-to-back cues both match on the shared ms.
    expect(entry.isActiveAt(3000)).toBe(true);
  });

  it('is inactive one millisecond before the start', () => {
    expect(entry.isActiveAt(999)).toBe(false);
  });

  it('is inactive one millisecond after the end', () => {
    expect(entry.isActiveAt(3001)).toBe(false);
  });

  it('is inactive at time zero for a later cue', () => {
    expect(entry.isActiveAt(0)).toBe(false);
  });

  it('is inactive for a negative time', () => {
    expect(entry.isActiveAt(-500)).toBe(false);
  });

  it('is active at the single instant of a zero-length cue', () => {
    const instant = make(2000, 2000);
    expect(instant.isActiveAt(2000)).toBe(true);
    expect(instant.isActiveAt(1999)).toBe(false);
    expect(instant.isActiveAt(2001)).toBe(false);
  });

  it('is never active for a reversed cue', () => {
    const reversed = make(9000, 2000);
    expect(reversed.isActiveAt(2000)).toBe(false);
    expect(reversed.isActiveAt(5000)).toBe(false);
    expect(reversed.isActiveAt(9000)).toBe(false);
  });

  it('both of two adjacent cues report active on the shared boundary millisecond', () => {
    const first = make(0, 2000, 'first');
    const second = make(2000, 4000, 'second');
    expect(first.isActiveAt(2000)).toBe(true);
    expect(second.isActiveAt(2000)).toBe(true);
  });
});

describe('SubtitleEntry.clone', () => {
  it('copies every field', () => {
    const entry = new SubtitleEntry({
      index: 7,
      start: 1000,
      end: 2000,
      text: 'plain',
      originalText: '<i>plain</i>'
    });
    const copy = entry.clone();
    expect(copy.index).toBe(7);
    expect(copy.start).toBe(1000);
    expect(copy.end).toBe(2000);
    expect(copy.text).toBe('plain');
    expect(copy.originalText).toBe('<i>plain</i>');
  });

  it('returns a different object', () => {
    const entry = make(0, 1000);
    expect(entry.clone()).not.toBe(entry);
  });

  it('produces an independent copy — mutating the clone does not affect the source', () => {
    const entry = make(1000, 2000);
    const copy = entry.clone();
    copy.start += 5000;
    copy.text = 'changed';
    expect(entry.start).toBe(1000);
    expect(entry.text).toBe('你好');
  });

  it('yields a clone that is still a SubtitleEntry with working methods', () => {
    const copy = make(1000, 2500).clone();
    expect(copy).toBeInstanceOf(SubtitleEntry);
    expect(copy.getDuration()).toBe(1500);
    expect(copy.isActiveAt(1500)).toBe(true);
  });

  it('preserves originalText through a clone even when it equals text', () => {
    const copy = make(0, 1000, 'same').clone();
    expect(copy.originalText).toBe('same');
  });
});
