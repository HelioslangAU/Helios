import { describe, expect, it } from 'vitest';

import { SubtitleEntry } from '@/content/video/models/subtitle-entry';
import {
  deduplicateEntries,
  findActiveSubtitle,
  findMatchingSubtitle,
  findSubtitleAtOrBefore,
  formatTime
} from './subtitle-timing';

function entry(start: number, end: number, text = `${start}-${end}`, index = 0): SubtitleEntry {
  return new SubtitleEntry({ index, start, end, text });
}

describe('formatTime', () => {
  it('formats milliseconds as M:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5000)).toBe('0:05');
    expect(formatTime(65000)).toBe('1:05');
    expect(formatTime(3_600_000)).toBe('60:00');
  });

  it('truncates sub-second remainders', () => {
    expect(formatTime(5999)).toBe('0:05');
  });
});

describe('findActiveSubtitle', () => {
  const entries = [entry(0, 1000), entry(2000, 3000)];

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
  const entries = [entry(0, 1000), entry(2000, 3000), entry(4000, 5000)];

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
    const primary = entry(1000, 2000);
    const secondaries = [entry(0, 1200), entry(1100, 1900), entry(1950, 3000)];

    expect(findMatchingSubtitle(primary, secondaries)).toBe(secondaries[1]);
  });

  it('returns null when the best overlap is under 50ms', () => {
    const primary = entry(1000, 2000);
    expect(findMatchingSubtitle(primary, [entry(1980, 3000)])).toBeNull();
  });

  it('accepts an overlap of exactly 50ms', () => {
    const primary = entry(1000, 2000);
    const secondaries = [entry(1950, 3000)];
    expect(findMatchingSubtitle(primary, secondaries)).toBe(secondaries[0]);
  });

  it('returns null when there are no secondaries', () => {
    expect(findMatchingSubtitle(entry(0, 1000), [])).toBeNull();
  });
});

describe('deduplicateEntries', () => {
  it('returns an empty array for empty input', () => {
    expect(deduplicateEntries([])).toEqual([]);
  });

  it('keeps distinct texts untouched and sorts them by start time', () => {
    const late = entry(2000, 3000, 'second');
    const early = entry(0, 1000, 'first');

    expect(deduplicateEntries([late, early])).toEqual([early, late]);
  });

  it('keeps repeats of the same text when their ranges do not overlap', () => {
    const a = entry(0, 1000, 'same');
    const b = entry(2000, 3000, 'same');

    expect(deduplicateEntries([a, b])).toEqual([a, b]);
  });

  it('collapses overlapping duplicates, keeping the longest', () => {
    const short = entry(0, 500, 'same');
    const long = entry(100, 2000, 'same');

    expect(deduplicateEntries([short, long])).toEqual([long]);
  });

  it('keeps the earlier duplicate when the overlapping one is not longer', () => {
    const first = entry(0, 2000, 'same');
    const second = entry(100, 600, 'same');

    expect(deduplicateEntries([first, second])).toEqual([first]);
  });

  it('treats text differing only by surrounding whitespace as the same', () => {
    const a = entry(0, 1000, '  hello  ');
    const b = entry(100, 2000, 'hello');

    expect(deduplicateEntries([a, b])).toEqual([b]);
  });

  it('treats abutting ranges as non-overlapping', () => {
    const a = entry(0, 1000, 'same');
    const b = entry(1000, 2000, 'same');

    expect(deduplicateEntries([a, b])).toEqual([a, b]);
  });

  it('does not mutate the input array order', () => {
    const late = entry(2000, 3000, 'second');
    const early = entry(0, 1000, 'first');
    const input = [late, early];

    deduplicateEntries(input);

    expect(input).toEqual([late, early]);
  });
});
