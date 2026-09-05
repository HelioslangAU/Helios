import { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Parser for SRT (SubRip) subtitle format
 */
export class SRTParser {
  /**
   * Parse SRT content into subtitle entries
   * @param content - SRT file content
   */
  static parse(content: string): SubtitleEntry[] {
    const entries: SubtitleEntry[] = [];
    // Normalize line endings first: blocks are split on blank lines but lines
    // are split on '\n', so a CRLF file would otherwise leave a stray '\r' at
    // the end of every text line except the last (which .trim() cleans up).
    const normalized = content.replace(/\r\n?/g, '\n');
    const blocks = normalized.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      // First line: index
      const index = parseInt(lines[0].trim());
      if (isNaN(index)) continue;

      // Second line: timestamps
      const timestampMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timestampMatch) continue;

      const start = this._parseTimestamp(timestampMatch[1]);
      const end = this._parseTimestamp(timestampMatch[2]);

      // Remaining lines: text
      let text = lines.slice(2).join('\n').trim();

      // Clean any HTML tags that might be present in SRT files
      text = this._cleanHTMLTags(text);

      entries.push(new SubtitleEntry({ index, start, end, text }));
    }

    // Remove only consecutive duplicate entries (matching asbplayer's conservative approach)
    const deduplicated: SubtitleEntry[] = [];
    for (const entry of entries) {
      if (deduplicated.length === 0 || !this._isSame(entry, deduplicated[deduplicated.length - 1])) {
        deduplicated.push(entry);
      }
    }

    return deduplicated;
  }

  /**
   * Check if two subtitle entries are identical (same start, end, and text)
   * @param a - First entry
   * @param b - Second entry
   */
  static _isSame(a: SubtitleEntry, b: SubtitleEntry): boolean {
    return a.start === b.start && a.end === b.end && a.text === b.text;
  }

  /**
   * Clean HTML tags from subtitle text (matches asbplayer's approach)
   */
  static _cleanHTMLTags(text: string): string {
    const helperElement = document.createElement('div');
    helperElement.innerHTML = text;

    // Remove <rt> element content (ruby text for furigana)
    const rubyTextElements = [...helperElement.getElementsByTagName('rt')];
    for (const rubyTextElement of rubyTextElements) {
      rubyTextElement.remove();
    }

    // Extract clean text content, removing all HTML tags
    return helperElement.textContent || helperElement.innerText || text;
  }

  /**
   * Parse SRT timestamp to milliseconds
   * @param timestamp - Format: HH:MM:SS,mmm
   * @returns Milliseconds
   */
  static _parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split(',');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);

    return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
  }

  /**
   * Convert milliseconds to SRT timestamp format
   * @param ms - Milliseconds
   * @returns Format: HH:MM:SS,mmm
   */
  static formatTimestamp(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }
}
