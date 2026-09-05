import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Timing helpers for the platform video sidebar. All pure: they take the
 * entries they work on and return an index, an entry, or a string.
 */

/**
 * Find the index of the subtitle active at `currentTime` (milliseconds), or -1.
 * Assumes `subtitles` is sorted by start time.
 */
export function binarySearchSubtitle(subtitles: SubtitleEntry[], currentTime: number): number {
  let left = 0;
  let right = subtitles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const entry = subtitles[mid];

    if (currentTime >= entry.start && currentTime <= entry.end) {
      return mid; // Found active subtitle
    }

    if (currentTime < entry.start) {
      right = mid - 1; // Search left half
    } else {
      left = mid + 1; // Search right half
    }
  }

  return -1; // No active subtitle
}

/**
 * Find matching secondary subtitle — the one overlapping the primary entry the
 * most, provided the overlap is at least 50ms.
 */
export function findMatchingSubtitle(
  primaryEntry: SubtitleEntry,
  secondarySubtitles: SubtitleEntry[]
): SubtitleEntry | null {
  let bestMatch: SubtitleEntry | null = null;
  let maxOverlap = 0;

  for (const secondary of secondarySubtitles) {
    const overlapStart = Math.max(primaryEntry.start, secondary.start);
    const overlapEnd = Math.min(primaryEntry.end, secondary.end);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = secondary;
    }
  }

  return maxOverlap >= 50 ? bestMatch : null;
}

/**
 * Format time in MM:SS
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
