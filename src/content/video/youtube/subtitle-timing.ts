/**
 * Pure time/search operations over subtitle entry lists, used by the YouTube
 * sidebar for highlighting, seeking and dual-subtitle pairing.
 */
import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Format time in MM:SS format
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * The entry whose range contains `currentTime`. Inclusive at both ends.
 */
export function findActiveSubtitle(entries: SubtitleEntry[], currentTime: number): SubtitleEntry | undefined {
  return entries.find(entry => currentTime >= entry.start && currentTime <= entry.end);
}

/**
 * The active entry, or — when `currentTime` falls in a gap — the last entry
 * that has already finished.
 */
export function findSubtitleAtOrBefore(entries: SubtitleEntry[], currentTime: number): SubtitleEntry | undefined {
  const active = findActiveSubtitle(entries, currentTime);
  if (active) return active;

  const previousSubs = entries.filter(entry => entry.end < currentTime);
  if (previousSubs.length > 0) {
    return previousSubs[previousSubs.length - 1];
  }
  return undefined;
}

/**
 * Find matching secondary subtitle based on time overlap
 */
export function findMatchingSubtitle(
  primaryEntry: SubtitleEntry,
  secondarySubtitles: SubtitleEntry[]
): SubtitleEntry | null {
  let bestMatch: SubtitleEntry | null = null;
  let maxOverlap = 0;

  for (const secondary of secondarySubtitles) {
    // Calculate overlap duration
    const overlapStart = Math.max(primaryEntry.start, secondary.start);
    const overlapEnd = Math.min(primaryEntry.end, secondary.end);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = secondary;
    }
  }

  // Only return match if there's significant overlap (at least 50ms)
  return maxOverlap >= 50 ? bestMatch : null;
}

/**
 * Deduplicate subtitle entries to prevent duplicate subtitles in sidebar
 * Removes entries with identical text and overlapping time ranges
 */
export function deduplicateEntries(entries: SubtitleEntry[]): SubtitleEntry[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  // CRITICAL: Sort FIRST by start time before deduplication
  // This ensures we process entries in chronological order
  const sortedEntries = [...entries].sort((a, b) => a.start - b.start);

  const textGroups = new Map<string, SubtitleEntry[]>(); // Group entries by text

  // Group all entries by their text content
  for (const entry of sortedEntries) {
    const normalizedText = entry.text.trim();
    if (!textGroups.has(normalizedText)) {
      textGroups.set(normalizedText, []);
    }
    textGroups.get(normalizedText)!.push(entry);
  }

  const deduplicated: SubtitleEntry[] = [];

  // Process each text group
  for (const groupEntries of textGroups.values()) {
    if (groupEntries.length === 1) {
      // Only one entry with this text - keep it
      deduplicated.push(groupEntries[0]);
    } else {
      // Multiple entries with same text - need to deduplicate by time overlap
      const kept: SubtitleEntry[] = [];

      for (const entry of groupEntries) {
        // Check if this entry overlaps with any already kept entry
        const overlapsWithKept = kept.some(keptEntry => {
          // Two entries overlap if one starts before the other ends
          return !(entry.end <= keptEntry.start || entry.start >= keptEntry.end);
        });

        if (!overlapsWithKept) {
          // No overlap with any kept entry - keep this one
          kept.push(entry);
        } else {
          // Overlaps with at least one kept entry
          // Replace the overlapping entry if this one has longer duration
          const overlappingIndex = kept.findIndex(keptEntry => {
            return !(entry.end <= keptEntry.start || entry.start >= keptEntry.end);
          });

          if (overlappingIndex !== -1) {
            const overlapping = kept[overlappingIndex];
            if (entry.getDuration() > overlapping.getDuration()) {
              kept[overlappingIndex] = entry;
            }
          }
        }
      }

      deduplicated.push(...kept);
    }
  }

  // Final sort by start time to ensure chronological order
  deduplicated.sort((a, b) => a.start - b.start);

  return deduplicated;
}
