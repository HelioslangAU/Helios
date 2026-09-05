import { describe, it, expect } from 'vitest';
import { SubtitleCollection } from '@/content/video/models/subtitle-collection';
import { SubtitleEntry } from '@/content/video/models/subtitle-entry';

const entry = (index: number, start: number, end: number, text: string) =>
  new SubtitleEntry({ index, start, end, text });

/** Three non-overlapping cues: [1000,3000] [4000,6000] [7000,9000]. */
const threeCues = () => [
  entry(1, 1000, 3000, '你好，世界。'),
  entry(2, 4000, 6000, '我们去公园吧。'),
  entry(3, 7000, 9000, '好的，我马上来。')
];

describe('SubtitleCollection — construction', () => {
  it('starts empty when no entries are given', () => {
    const collection = new SubtitleCollection();
    expect(collection.getCount()).toBe(0);
    expect(collection.isEmpty()).toBe(true);
    expect(collection.getAll()).toEqual([]);
  });

  it('starts with currentIndex at -1', () => {
    expect(new SubtitleCollection(threeCues()).currentIndex).toBe(-1);
  });

  it('reports the entry count', () => {
    expect(new SubtitleCollection(threeCues()).getCount()).toBe(3);
  });

  it('is not empty when it has entries', () => {
    expect(new SubtitleCollection(threeCues()).isEmpty()).toBe(false);
  });

  it('gives each SubtitleCollection its own default array', () => {
    const a = new SubtitleCollection();
    const b = new SubtitleCollection();
    a.entries.push(entry(1, 0, 1000, 'only in a'));
    expect(b.getCount()).toBe(0);
  });
});

describe('SubtitleCollection — sorting', () => {
  it('orders entries by start time', () => {
    const collection = new SubtitleCollection([
      entry(3, 7000, 9000, 'third'),
      entry(1, 1000, 3000, 'first'),
      entry(2, 4000, 6000, 'second')
    ]);
    expect(collection.getAll().map(e => e.text)).toEqual(['first', 'second', 'third']);
  });

  it('copies the caller\'s array instead of sorting it in place', () => {
    const input = [entry(2, 5000, 6000, 'later'), entry(1, 1000, 2000, 'earlier')];
    const collection = new SubtitleCollection(input);
    // Previously Array.prototype.sort reordered the caller's array behind its
    // back and the collection stayed aliased to it.
    expect(input.map(e => e.text)).toEqual(['later', 'earlier']);
    expect(collection.entries).not.toBe(input);
    expect(collection.getAll().map(e => e.text)).toEqual(['earlier', 'later']);
  });

  it('is not aliased to the caller\'s array, so later pushes do not leak in', () => {
    const input = threeCues();
    const collection = new SubtitleCollection(input);
    input.push(entry(4, 10000, 11000, 'appended later'));
    expect(collection.getCount()).toBe(3);
  });

  it('ignores a cue appended to the caller\'s array after construction', () => {
    const input = threeCues();
    const collection = new SubtitleCollection(input);
    input.push(entry(0, 0, 500, 'appended early cue'));
    // Previously the appended cue leaked in unsorted, leaving starts out of order.
    expect(collection.getAll().map(e => e.start)).toEqual([1000, 4000, 7000]);
  });

  it('shares the SubtitleEntry objects with the caller (shallow copy)', () => {
    const input = threeCues();
    const collection = new SubtitleCollection(input);
    expect(collection.getAll()[0]).toBe(input[0]);
  });

  it('sorts by start only, leaving equal-start cues in insertion order', () => {
    const collection = new SubtitleCollection([
      entry(1, 2000, 9000, 'long one'),
      entry(2, 2000, 3000, 'short one')
    ]);
    expect(collection.getAll().map(e => e.text)).toEqual(['long one', 'short one']);
  });

  it('sorts by start, not by index — a mis-indexed file is still time-ordered', () => {
    const collection = new SubtitleCollection([
      entry(99, 1000, 2000, 'early but high index'),
      entry(1, 5000, 6000, 'late but low index')
    ]);
    expect(collection.getAll().map(e => e.index)).toEqual([99, 1]);
  });

  it('places negative start times first', () => {
    const collection = new SubtitleCollection([
      entry(2, 1000, 2000, 'positive'),
      entry(1, -500, 500, 'negative')
    ]);
    expect(collection.getAll().map(e => e.text)).toEqual(['negative', 'positive']);
  });
});

describe('SubtitleCollection.getSubtitlesAt — lookup', () => {
  it('returns the cue covering the given time', () => {
    const collection = new SubtitleCollection(threeCues());
    expect(collection.getSubtitlesAt(5000).map(e => e.text)).toEqual(['我们去公园吧。']);
  });

  it('returns nothing before the first cue', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(0)).toEqual([]);
  });

  it('returns nothing in the gap between two cues', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(3500)).toEqual([]);
  });

  it('returns nothing after the last cue', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(999999)).toEqual([]);
  });

  it('returns nothing for a negative time', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(-1)).toEqual([]);
  });

  it('returns nothing from an empty collection', () => {
    expect(new SubtitleCollection().getSubtitlesAt(1000)).toEqual([]);
  });

  it('includes a cue exactly on its start boundary', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(1000).map(e => e.index)).toEqual([1]);
  });

  it('includes a cue exactly on its end boundary', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(3000).map(e => e.index)).toEqual([1]);
  });

  it('excludes a cue one millisecond past its end', () => {
    expect(new SubtitleCollection(threeCues()).getSubtitlesAt(3001)).toEqual([]);
  });

  it('returns both cues on a shared boundary millisecond of back-to-back cues', () => {
    const collection = new SubtitleCollection([
      entry(1, 0, 2000, 'first'),
      entry(2, 2000, 4000, 'second')
    ]);
    // BUG(ish): isActiveAt is inclusive at both ends, so back-to-back cues from
    // a normal SRT file both show for one millisecond.
    expect(collection.getSubtitlesAt(2000).map(e => e.text)).toEqual(['first', 'second']);
  });

  it('returns all genuinely overlapping cues', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 5000, 'speaker A'),
      entry(2, 3000, 7000, 'speaker B')
    ]);
    expect(collection.getSubtitlesAt(4000).map(e => e.text)).toEqual(['speaker A', 'speaker B']);
  });

  it('returns overlapping cues ordered by start time', () => {
    const collection = new SubtitleCollection([
      entry(2, 3000, 7000, 'later start'),
      entry(1, 1000, 5000, 'earlier start')
    ]);
    expect(collection.getSubtitlesAt(4000).map(e => e.text)).toEqual(['earlier start', 'later start']);
  });
});

describe('SubtitleCollection.getSubtitlesAt — duplicate-text deduplication', () => {
  it('collapses overlapping cues that share the same text', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 5000, '同じ台詞'),
      entry(2, 2000, 3000, '同じ台詞')
    ]);
    expect(collection.getSubtitlesAt(2500)).toHaveLength(1);
  });

  it('keeps the longer-duration cue when text is duplicated', () => {
    const collection = new SubtitleCollection([
      entry(1, 2000, 3000, '同じ台詞'),
      entry(2, 1000, 5000, '同じ台詞')
    ]);
    const [kept] = collection.getSubtitlesAt(2500);
    expect(kept.index).toBe(2);
    expect(kept.getDuration()).toBe(4000);
  });

  it('keeps the first cue when duplicated texts have equal durations', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 3000, 'tie'),
      entry(2, 1500, 3500, 'tie')
    ]);
    // Strict `>` comparison, so the earlier-seen entry wins a tie.
    expect(collection.getSubtitlesAt(2000).map(e => e.index)).toEqual([1]);
  });

  it('deduplicates on trimmed text, so whitespace-only differences collapse', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 5000, '  同じ台詞  '),
      entry(2, 2000, 3000, '同じ台詞')
    ]);
    expect(collection.getSubtitlesAt(2500)).toHaveLength(1);
  });

  it('returns the untrimmed text of the winning entry', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 5000, '  同じ台詞  '),
      entry(2, 2000, 3000, '同じ台詞')
    ]);
    expect(collection.getSubtitlesAt(2500)[0].text).toBe('  同じ台詞  ');
  });

  it('does not deduplicate different texts', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 5000, '台詞A'),
      entry(2, 2000, 3000, '台詞B')
    ]);
    expect(collection.getSubtitlesAt(2500)).toHaveLength(2);
  });

  it('skips deduplication entirely when only one cue is active', () => {
    const collection = new SubtitleCollection([entry(1, 1000, 5000, '  padded  ')]);
    expect(collection.getSubtitlesAt(2000).map(e => e.text)).toEqual(['  padded  ']);
  });

  it('collapses a dual-language track that repeats the same line', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 4000, '我们走吧'),
      entry(2, 1000, 4000, "Let's go"),
      entry(3, 1000, 4000, '我们走吧')
    ]);
    expect(collection.getSubtitlesAt(2000).map(e => e.text)).toEqual(['我们走吧', "Let's go"]);
  });
});

describe('SubtitleCollection.getNextSubtitle', () => {
  it('returns the first cue when the time precedes everything', () => {
    expect(new SubtitleCollection(threeCues()).getNextSubtitle(0)!.index).toBe(1);
  });

  it('returns the following cue from inside a cue', () => {
    expect(new SubtitleCollection(threeCues()).getNextSubtitle(2000)!.index).toBe(2);
  });

  it('returns the following cue from a gap', () => {
    expect(new SubtitleCollection(threeCues()).getNextSubtitle(3500)!.index).toBe(2);
  });

  it('is strictly greater than, so a time exactly on a start skips to the cue after', () => {
    expect(new SubtitleCollection(threeCues()).getNextSubtitle(4000)!.index).toBe(3);
  });

  it('returns null past the last cue', () => {
    expect(new SubtitleCollection(threeCues()).getNextSubtitle(999999)).toBeNull();
  });

  it('returns null on an empty collection', () => {
    expect(new SubtitleCollection().getNextSubtitle(0)).toBeNull();
  });

  it('returns the earliest-starting candidate because entries are sorted', () => {
    const collection = new SubtitleCollection([
      entry(2, 8000, 9000, 'far'),
      entry(1, 5000, 6000, 'near')
    ]);
    expect(collection.getNextSubtitle(1000)!.text).toBe('near');
  });
});

describe('SubtitleCollection.getPreviousSubtitle', () => {
  it('returns null before the first cue', () => {
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(500)).toBeNull();
  });

  it('returns null while inside the first cue', () => {
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(2000)).toBeNull();
  });

  it('returns the preceding cue from a gap', () => {
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(3500)!.index).toBe(1);
  });

  it('returns the preceding cue from inside a later cue', () => {
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(5000)!.index).toBe(1);
  });

  it('returns the last cue past the end of the file', () => {
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(999999)!.index).toBe(3);
  });

  it('is strictly less than, so a time exactly on a cue end excludes that cue', () => {
    // At 3000ms cue 1 is still active (end is inclusive there), so the
    // "previous" cue is null rather than cue 1.
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(3000)).toBeNull();
  });

  it('includes a cue that ended one millisecond ago', () => {
    expect(new SubtitleCollection(threeCues()).getPreviousSubtitle(3001)!.index).toBe(1);
  });

  it('returns null on an empty collection', () => {
    expect(new SubtitleCollection().getPreviousSubtitle(5000)).toBeNull();
  });

  it('picks the latest-starting of several finished cues', () => {
    const collection = new SubtitleCollection(threeCues());
    expect(collection.getPreviousSubtitle(6500)!.index).toBe(2);
  });

  it('can pick a cue that ends earlier but starts later than another finished cue', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 9000, 'long cue'),
      entry(2, 2000, 3000, 'short cue')
    ]);
    // BUG(ish): the filtered list keeps start order, so "previous" is the
    // last-starting finished cue, not the last-ending one — at 9500ms the
    // short cue wins even though the long cue ended later.
    expect(collection.getPreviousSubtitle(9500)!.text).toBe('short cue');
  });
});

describe('SubtitleCollection.getByIndex', () => {
  it('finds an entry by its subtitle index', () => {
    expect(new SubtitleCollection(threeCues()).getByIndex(2)!.text).toBe('我们去公园吧。');
  });

  it('returns null for an unknown index', () => {
    expect(new SubtitleCollection(threeCues()).getByIndex(42)).toBeNull();
  });

  it('returns null on an empty collection', () => {
    expect(new SubtitleCollection().getByIndex(0)).toBeNull();
  });

  it('matches the subtitle index, not the array position', () => {
    const collection = new SubtitleCollection([
      entry(10, 1000, 2000, 'first in time'),
      entry(20, 3000, 4000, 'second in time')
    ]);
    expect(collection.getByIndex(0)).toBeNull();
    expect(collection.getByIndex(10)!.text).toBe('first in time');
  });

  it('returns the first match when indexes are duplicated', () => {
    const collection = new SubtitleCollection([
      entry(1, 1000, 2000, 'earlier'),
      entry(1, 3000, 4000, 'later')
    ]);
    expect(collection.getByIndex(1)!.text).toBe('earlier');
  });
});

describe('SubtitleCollection.applyOffset', () => {
  it('shifts every cue forwards', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(500);
    expect(collection.getAll().map(e => [e.start, e.end])).toEqual([
      [1500, 3500],
      [4500, 6500],
      [7500, 9500]
    ]);
  });

  it('shifts every cue backwards for a negative offset', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(-1000);
    expect(collection.getAll().map(e => e.start)).toEqual([0, 3000, 6000]);
  });

  it('is a no-op for an offset of zero', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(0);
    expect(collection.getAll().map(e => e.start)).toEqual([1000, 4000, 7000]);
  });

  it('accumulates across repeated calls', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(1000);
    collection.applyOffset(-250);
    expect(collection.getAll()[0].start).toBe(1750);
  });

  it('preserves each cue\'s duration', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(-4321);
    expect(collection.getAll().map(e => e.getDuration())).toEqual([2000, 2000, 2000]);
  });

  it('allows times to go negative rather than clamping at zero', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(-5000);
    // BUG(ish): a large negative offset pushes early cues before t=0, where
    // they can never become active again.
    expect(collection.getAll()[0].start).toBe(-4000);
    expect(collection.getAll()[0].end).toBe(-2000);
  });

  it('moves the active window so lookups follow the offset', () => {
    const collection = new SubtitleCollection(threeCues());
    expect(collection.getSubtitlesAt(1000)).toHaveLength(1);
    collection.applyOffset(2000);
    expect(collection.getSubtitlesAt(1000)).toEqual([]);
    expect(collection.getSubtitlesAt(3000).map(e => e.index)).toEqual([1]);
  });

  it('mutates the caller\'s SubtitleEntry objects in place', () => {
    const cues = threeCues();
    const first = cues[0];
    new SubtitleCollection(cues).applyOffset(750);
    // Entries are shared, not cloned — anything else holding a reference sees
    // the shift too.
    expect(first.start).toBe(1750);
  });

  it('is a no-op on an empty collection', () => {
    const collection = new SubtitleCollection();
    expect(() => collection.applyOffset(1000)).not.toThrow();
    expect(collection.getCount()).toBe(0);
  });

  it('keeps the entries in sorted order after a uniform shift', () => {
    const collection = new SubtitleCollection(threeCues());
    collection.applyOffset(-2500);
    const starts = collection.getAll().map(e => e.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe('SubtitleCollection.getAll', () => {
  it('returns a defensive copy, not the live internal array', () => {
    const collection = new SubtitleCollection(threeCues());
    // Callers used to be able to reorder or resize the collection through the
    // array handed back by getAll().
    expect(collection.getAll()).not.toBe(collection.entries);
    expect(collection.getAll()).toEqual(collection.entries);
  });

  it('is unaffected by mutation of the returned array', () => {
    const collection = new SubtitleCollection(threeCues());
    const all = collection.getAll();
    all.push(entry(4, 10000, 11000, 'pushed through getAll'));
    all.reverse();
    expect(collection.getCount()).toBe(3);
    expect(collection.getAll().map(e => e.start)).toEqual([1000, 4000, 7000]);
  });
});
