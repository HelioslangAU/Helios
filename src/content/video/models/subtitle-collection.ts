import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Manages a collection of subtitle entries with efficient lookup
 */
export class SubtitleCollection {
  entries: SubtitleEntry[];
  currentIndex: number;

  constructor(entries: SubtitleEntry[] = []) {
    // Copy before sorting: sorting in place would reorder the caller's array
    // behind its back, and staying aliased to it would let later external
    // pushes leak in unsorted. The SubtitleEntry objects are still shared.
    this.entries = [...entries].sort((a, b) => a.start - b.start);
    this.currentIndex = -1;
  }

  /**
   * Get all subtitles that should be shown at given time
   * Deduplicates entries with identical text that overlap in time
   * @param currentTime - Current video time in milliseconds
   */
  getSubtitlesAt(currentTime: number): SubtitleEntry[] {
    const activeEntries = this.entries.filter(entry => entry.isActiveAt(currentTime));

    // If only one or no active entries, return as-is
    if (activeEntries.length <= 1) {
      return activeEntries;
    }

    // Deduplicate by text: if multiple entries have the same text,
    // keep only the one with the longest duration
    const textMap = new Map<string, SubtitleEntry>();

    for (const entry of activeEntries) {
      const normalizedText = entry.text.trim();

      if (!textMap.has(normalizedText)) {
        textMap.set(normalizedText, entry);
      } else {
        // If we already have this text, keep the entry with longer duration
        const existing = textMap.get(normalizedText)!;
        if (entry.getDuration() > existing.getDuration()) {
          textMap.set(normalizedText, entry);
        }
      }
    }

    // Return deduplicated entries, preserving original time-based order
    const deduplicatedEntries = Array.from(textMap.values());
    deduplicatedEntries.sort((a, b) => a.start - b.start);

    return deduplicatedEntries;
  }

  /**
   * Get the next subtitle after given time
   * @param currentTime - Current video time in milliseconds
   */
  getNextSubtitle(currentTime: number): SubtitleEntry | null {
    return this.entries.find(entry => entry.start > currentTime) || null;
  }

  /**
   * Get the previous subtitle before given time
   * @param currentTime - Current video time in milliseconds
   */
  getPreviousSubtitle(currentTime: number): SubtitleEntry | null {
    const filtered = this.entries.filter(entry => entry.end < currentTime);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  /**
   * Get subtitle by index
   */
  getByIndex(index: number): SubtitleEntry | null {
    return this.entries.find(entry => entry.index === index) || null;
  }

  /**
   * Get all subtitle entries (a copy — callers cannot reorder or resize the
   * collection through the returned array)
   */
  getAll(): SubtitleEntry[] {
    return [...this.entries];
  }

  /**
   * Get total number of subtitles
   */
  getCount(): number {
    return this.entries.length;
  }

  /**
   * Check if collection is empty
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Apply time offset to all subtitles
   * @param offsetMs - Offset in milliseconds (can be negative)
   */
  applyOffset(offsetMs: number): void {
    this.entries.forEach(entry => {
      entry.start += offsetMs;
      entry.end += offsetMs;
    });
  }
}
