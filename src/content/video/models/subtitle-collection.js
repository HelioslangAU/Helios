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
   * Returns ALL active subtitles without text-based filtering (matches asbplayer's approach)
   * @param {number} currentTime - Current video time in milliseconds
   * @returns {SubtitleEntry[]}
   */
  getSubtitlesAt(currentTime) {
    // Return all active entries without any text-based deduplication
    // This matches asbplayer's approach - they return all subtitles active at the timestamp
    return this.entries.filter(entry => entry.isActiveAt(currentTime));
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
