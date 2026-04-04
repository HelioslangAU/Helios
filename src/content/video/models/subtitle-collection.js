/**
 * Manages a collection of subtitle entries with efficient lookup
 */
class SubtitleCollection {
  constructor(entries = []) {
    this.entries = entries.sort((a, b) => a.start - b.start);
    this.currentIndex = -1;
  }

  /**
   * Get all subtitles that should be shown at given time
   * Deduplicates entries with identical text that overlap in time
   * @param {number} currentTime - Current video time in milliseconds
   * @returns {SubtitleEntry[]}
   */
  getSubtitlesAt(currentTime) {
    const activeEntries = this.entries.filter(entry => entry.isActiveAt(currentTime));

    // If only one or no active entries, return as-is
    if (activeEntries.length <= 1) {
      return activeEntries;
    }

    // Deduplicate by text: if multiple entries have the same text,
    // keep only the one with the longest duration
    const textMap = new Map();

    for (const entry of activeEntries) {
      const normalizedText = entry.text.trim();

      if (!textMap.has(normalizedText)) {
        textMap.set(normalizedText, entry);
      } else {
        // If we already have this text, keep the entry with longer duration
        const existing = textMap.get(normalizedText);
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
   * @param {number} currentTime - Current video time in milliseconds
   * @returns {SubtitleEntry|null}
   */
  getNextSubtitle(currentTime) {
    return this.entries.find(entry => entry.start > currentTime) || null;
  }

  /**
   * Get the previous subtitle before given time
   * @param {number} currentTime - Current video time in milliseconds
   * @returns {SubtitleEntry|null}
   */
  getPreviousSubtitle(currentTime) {
    const filtered = this.entries.filter(entry => entry.end < currentTime);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  /**
   * Get subtitle by index
   * @param {number} index
   * @returns {SubtitleEntry|null}
   */
  getByIndex(index) {
    return this.entries.find(entry => entry.index === index) || null;
  }

  /**
   * Get all subtitle entries
   * @returns {SubtitleEntry[]}
   */
  getAll() {
    return this.entries;
  }

  /**
   * Get total number of subtitles
   * @returns {number}
   */
  getCount() {
    return this.entries.length;
  }

  /**
   * Check if collection is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.entries.length === 0;
  }

  /**
   * Apply time offset to all subtitles
   * @param {number} offsetMs - Offset in milliseconds (can be negative)
   */
  applyOffset(offsetMs) {
    this.entries.forEach(entry => {
      entry.start += offsetMs;
      entry.end += offsetMs;
    });
  }
}
