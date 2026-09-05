/**
 * Represents a single subtitle entry with timing information
 */

export interface SubtitleEntryInit {
  index: number;
  /** milliseconds */
  start: number;
  /** milliseconds */
  end: number;
  text: string;
  originalText?: string | null;
}

export class SubtitleEntry {
  index: number;
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
  originalText: string;

  constructor({ index, start, end, text, originalText = null }: SubtitleEntryInit) {
    this.index = index;
    this.start = start; // milliseconds
    this.end = end; // milliseconds
    this.text = text;
    this.originalText = originalText || text;
  }

  /**
   * Check if this subtitle should be shown at given time
   * @param currentTime - Current video time in milliseconds
   */
  isActiveAt(currentTime: number): boolean {
    return currentTime >= this.start && currentTime <= this.end;
  }

  /**
   * Get duration of this subtitle in milliseconds
   */
  getDuration(): number {
    return this.end - this.start;
  }

  /**
   * Clone this subtitle entry
   */
  clone(): SubtitleEntry {
    return new SubtitleEntry({
      index: this.index,
      start: this.start,
      end: this.end,
      text: this.text,
      originalText: this.originalText
    });
  }
}
