/**
 * Represents a single subtitle entry with timing information
 */
class SubtitleEntry {
  constructor({ index, start, end, text, originalText = null }) {
    this.index = index;
    this.start = start; // milliseconds
    this.end = end; // milliseconds
    this.text = text;
    this.originalText = originalText || text;
  }

  /**
   * Check if this subtitle should be shown at given time
   * @param {number} currentTime - Current video time in milliseconds
   * @returns {boolean}
   */
  isActiveAt(currentTime) {
    return currentTime >= this.start && currentTime <= this.end;
  }

  /**
   * Get duration of this subtitle in milliseconds
   * @returns {number}
   */
  getDuration() {
    return this.end - this.start;
  }

  /**
   * Clone this subtitle entry
   * @returns {SubtitleEntry}
   */
  clone() {
    return new SubtitleEntry({
      index: this.index,
      start: this.start,
      end: this.end,
      text: this.text,
      originalText: this.originalText
    });
  }
}
