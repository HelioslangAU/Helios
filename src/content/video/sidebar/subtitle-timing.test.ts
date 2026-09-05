import { describe, it, expect } from 'vitest';
import { SubtitleEntry } from '@/content/video/models/subtitle-entry';
import {
  binarySearchSubtitle,
  findMatchingSubtitle,
  formatTime
} from '@/content/video/sidebar/subtitle-timing';

function entry(index: number, start: number, end: number, text = `line ${index}`): SubtitleEntry {
  return new SubtitleEntry({ index, start, end, text });
}

const TIMELINE = [
  entry(0, 0, 1000),
  entry(1, 2000, 3000),
  entry(2, 4000, 5000),
  entry(3, 6000, 7000)
];

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

describe('findMatchingSubtitle', () => {
  it('picks the secondary entry with the largest overlap', () => {
    const primary = entry(0, 1000, 2000);
    const slight = entry(0, 1900, 3000);
    const best = entry(1, 900, 1800);

    expect(findMatchingSubtitle(primary, [slight, best])).toBe(best);
  });

  it('returns null when the best overlap is under 50ms', () => {
    const primary = entry(0, 1000, 2000);
    expect(findMatchingSubtitle(primary, [entry(0, 1970, 3000)])).toBeNull();
  });

  it('accepts an overlap of exactly 50ms', () => {
    const primary = entry(0, 1000, 2000);
    const secondary = entry(0, 1950, 3000);
    expect(findMatchingSubtitle(primary, [secondary])).toBe(secondary);
  });

  it('returns null when nothing overlaps', () => {
    expect(findMatchingSubtitle(entry(0, 1000, 2000), [entry(0, 5000, 6000)])).toBeNull();
    expect(findMatchingSubtitle(entry(0, 1000, 2000), [])).toBeNull();
  });

  it('keeps the first of two equally overlapping candidates', () => {
    const primary = entry(0, 1000, 2000);
    const first = entry(0, 1000, 2000);
    const second = entry(1, 1000, 2000);
    expect(findMatchingSubtitle(primary, [first, second])).toBe(first);
  });
});

describe('formatTime', () => {
  it('formats milliseconds as M:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5000)).toBe('0:05');
    expect(formatTime(65000)).toBe('1:05');
    expect(formatTime(3600000)).toBe('60:00');
  });

  it('truncates sub-second remainders', () => {
    expect(formatTime(9999)).toBe('0:09');
  });
});
