/**
 * Parser for SRT (SubRip) subtitle format
 */
class SRTParser {
  /**
   * Parse SRT content into subtitle entries
   * @param {string} content - SRT file content
   * @returns {SubtitleEntry[]}
   */
  static parse(content) {
    const entries = [];
    const blocks = content.trim().split(/\n\s*\n/);

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
      const text = lines.slice(2).join('\n').trim();

      entries.push(new SubtitleEntry({ index, start, end, text }));
    }

    return entries;
  }

  /**
   * Parse SRT timestamp to milliseconds
   * @param {string} timestamp - Format: HH:MM:SS,mmm
   * @returns {number} Milliseconds
   */
  static _parseTimestamp(timestamp) {
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
   * @param {number} ms - Milliseconds
   * @returns {string} Format: HH:MM:SS,mmm
   */
  static formatTimestamp(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }
}
