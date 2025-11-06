/**
 * Parser for WebVTT subtitle format
 */
class VTTParser {
  /**
   * Parse VTT content into subtitle entries
   * @param {string} content - VTT file content
   * @returns {SubtitleEntry[]}
   */
  static parse(content) {
    const entries = [];
    const lines = content.split('\n');

    let index = 0;
    let i = 0;

    // Skip header
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i].trim();

      // Look for timestamp line
      if (line.includes('-->')) {
        const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
        if (timestampMatch) {
          const start = this._parseTimestamp(timestampMatch[1]);
          const end = this._parseTimestamp(timestampMatch[2]);

          // Collect text lines
          const textLines = [];
          i++;
          while (i < lines.length && lines[i].trim() !== '') {
            textLines.push(lines[i]);
            i++;
          }

          const text = textLines.join('\n').trim();
          if (text) {
            entries.push(new SubtitleEntry({ index: index++, start, end, text }));
          }
        }
      }
      i++;
    }

    return entries;
  }

  /**
   * Parse VTT timestamp to milliseconds
   * @param {string} timestamp - Format: HH:MM:SS.mmm
   * @returns {number} Milliseconds
   */
  static _parseTimestamp(timestamp) {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);

    return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
  }

  /**
   * Convert milliseconds to VTT timestamp format
   * @param {number} ms - Milliseconds
   * @returns {string} Format: HH:MM:SS.mmm
   */
  static formatTimestamp(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
}
