import { describe, it, expect } from 'vitest';
import { SubtitleEntry } from '@/content/video/models/subtitle-entry';
import {
  binarySearchSubtitle,
  deduplicateEntries,
  findActiveSubtitle,
  findMatchingSubtitle,
  findSubtitleAtOrBefore,
  formatTime
} from '@/content/video/sidebar/subtitle-timing';

function entry(index: number, start: number, end: number, text = `line ${index}`): SubtitleEntry {
  return new SubtitleEntry({ index, start, end, text });
}

function span(start: number, end: number, text = `${start}-${end}`, index = 0): SubtitleEntry {
  return new SubtitleEntry({ index, start, end, text });
}

const TIMELINE = [
  entry(0, 0, 1000),
  entry(1, 2000, 3000),
  entry(2, 4000, 5000),
  entry(3, 6000, 7000)
];

describe('formatTime', () => {
  it('formats milliseconds as M:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5000)).toBe('0:05');
    expect(formatTime(65000)).toBe('1:05');
    expect(formatTime(3_600_000)).toBe('60:00');
  });

  it('truncates sub-second remainders', () => {
    expect(formatTime(9999)).toBe('0:09');
    expect(formatTime(5999)).toBe('0:05');
  });
});

describe('binarySearchSubtitle', () => {
  it('returns the index of the entry active at the given time', () => {
    expect(binarySearchSubtitle(TIMELINE, 2500)).toBe(1);
    expect(binarySearchSubtitle(TIMELINE, 6500)).toBe(3);
  });

  it('treats both ends of an entry as active', () => {
    expect(binarySearchSubtitle(TIMELINE, 2000)).toBe(1);
    expect(binarySearchSubtitle(TIMELINE, 3000)).toBe(1);
  });

  it('returns -1 in the gap between entries', () => {
    expect(binarySearchSubtitle(TIMELINE, 1500)).toBe(-1);
  });

  it('returns -1 before the first and after the last entry', () => {
    expect(binarySearchSubtitle(TIMELINE, -1)).toBe(-1);
    expect(binarySearchSubtitle(TIMELINE, 99999)).toBe(-1);
  });

  it('returns -1 for an empty list', () => {
    expect(binarySearchSubtitle([], 0)).toBe(-1);
  });
});

describe('findActiveSubtitle', () => {
  const entries = [span(0, 1000), span(2000, 3000)];

  it('returns the entry containing the time', () => {
    expect(findActiveSubtitle(entries, 500)).toBe(entries[0]);
    expect(findActiveSubtitle(entries, 2500)).toBe(entries[1]);
  });

  it('is inclusive at both ends', () => {
    expect(findActiveSubtitle(entries, 0)).toBe(entries[0]);
    expect(findActiveSubtitle(entries, 1000)).toBe(entries[0]);
  });

  it('returns undefined inside a gap', () => {
    expect(findActiveSubtitle(entries, 1500)).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(findActiveSubtitle([], 100)).toBeUndefined();
  });
});

describe('findSubtitleAtOrBefore', () => {
  const entries = [span(0, 1000), span(2000, 3000), span(4000, 5000)];

  it('prefers the active entry', () => {
    expect(findSubtitleAtOrBefore(entries, 2500)).toBe(entries[1]);
  });

  it('falls back to the last finished entry when in a gap', () => {
    expect(findSubtitleAtOrBefore(entries, 3500)).toBe(entries[1]);
  });

  it('returns undefined before the first entry', () => {
    expect(findSubtitleAtOrBefore(entries, -1)).toBeUndefined();
  });

  it('returns the final entry once the video is past it', () => {
    expect(findSubtitleAtOrBefore(entries, 9999)).toBe(entries[2]);
  });
});

describe('findMatchingSubtitle', () => {
  it('picks the secondary entry with the largest overlap', () => {
    const primary = entry(0, 1000, 2000);
    const slight = entry(0, 1900, 3000);
    const best = entry(1, 900, 1800);

    expect(findMatchingSubtitle(primary, [slight, best])).toBe(best);
  });

  it('ignores secondaries that only clip the ends of the primary', () => {
    const primary = span(1000, 2000);
    const secondaries = [span(0, 1200), span(1100, 1900), span(1950, 3000)];

    expect(findMatchingSubtitle(primary, secondaries)).toBe(secondaries[1]);
  });

  it('returns null when the best overlap is under 50ms', () => {
    const primary = entry(0, 1000, 2000);
    expect(findMatchingSubtitle(primary, [entry(0, 1970, 3000)])).toBeNull();
    expect(findMatchingSubtitle(primary, [entry(0, 1980, 3000)])).toBeNull();
  });

  it('accepts an overlap of exactly 50ms', () => {
    const primary = entry(0, 1000, 2000);
    const secondary = entry(0, 1950, 3000);
    expect(findMatchingSubtitle(primary, [secondary])).toBe(secondary);
  });

  it('returns null when nothing overlaps', () => {
    expect(findMatchingSubtitle(entry(0, 1000, 2000), [entry(0, 5000, 6000)])).toBeNull();
  });

  it('returns null when there are no secondaries', () => {
    expect(findMatchingSubtitle(entry(0, 1000, 2000), [])).toBeNull();
    expect(findMatchingSubtitle(span(0, 1000), [])).toBeNull();
  });

  it('keeps the first of two equally overlapping candidates', () => {
    const primary = entry(0, 1000, 2000);
    const first = entry(0, 1000, 2000);
    const second = entry(1, 1000, 2000);
    expect(findMatchingSubtitle(primary, [first, second])).toBe(first);
  });
});

describe('deduplicateEntries', () => {
  it('returns an empty array for empty input', () => {
    expect(deduplicateEntries([])).toEqual([]);
  });

  it('keeps distinct texts untouched and sorts them by start time', () => {
    const late = span(2000, 3000, 'second');
    const early = span(0, 1000, 'first');

    expect(deduplicateEntries([late, early])).toEqual([early, late]);
  });

  it('keeps repeats of the same text when their ranges do not overlap', () => {
    const a = span(0, 1000, 'same');
    const b = span(2000, 3000, 'same');

    expect(deduplicateEntries([a, b])).toEqual([a, b]);
  });

  it('collapses overlapping duplicates, keeping the longest', () => {
    const short = span(0, 500, 'same');
    const long = span(100, 2000, 'same');

    expect(deduplicateEntries([short, long])).toEqual([long]);
  });

  it('keeps the earlier duplicate when the overlapping one is not longer', () => {
    const first = span(0, 2000, 'same');
    const second = span(100, 600, 'same');

    expect(deduplicateEntries([first, second])).toEqual([first]);
  });

  it('treats text differing only by surrounding whitespace as the same', () => {
    const a = span(0, 1000, '  hello  ');
    const b = span(100, 2000, 'hello');

    expect(deduplicateEntries([a, b])).toEqual([b]);
  });

  it('treats abutting ranges as non-overlapping', () => {
    const a = span(0, 1000, 'same');
    const b = span(1000, 2000, 'same');

    expect(deduplicateEntries([a, b])).toEqual([a, b]);
  });

  it('does not mutate the input array order', () => {
    const late = span(2000, 3000, 'second');
    const early = span(0, 1000, 'first');
    const input = [late, early];

    deduplicateEntries(input);

    expect(input).toEqual([late, early]);
  });
});
