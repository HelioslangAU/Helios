/**
 * Parser for WebVTT subtitle format
 * Handles both standard VTT and Netflix VTT formats
 */
class VTTParser {
  /**
   * Parse VTT content into subtitle entries
   * @param {string} content - VTT file content
   * @returns {SubtitleEntry[]}
   */
  static parse(content) {
    const entries = [];
    const lines = content.split(/\r?\n/); // Handle both \n and \r\n line endings

    let index = 0;
    let i = 0;

    // Skip header and WEBVTT declaration
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i].trim();

      // Look for timestamp line - support multiple VTT timestamp formats
      if (line.includes('-->')) {
        // Match timestamps with or without hours, with settings/metadata after
        // Examples:
        // 00:00:00.000 --> 00:00:02.000
        // 00:00.000 --> 00:02.000 align:middle line:90%
        const timestampMatch = line.match(
          /(\d{1,2}:)?(\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}:\d{2}\.\d{3})/
        );

        if (timestampMatch) {
          // Reconstruct full timestamps with hours if missing
          const startTime = (timestampMatch[1] || '00:') + timestampMatch[2];
          const endTime = (timestampMatch[3] || '00:') + timestampMatch[4];

          const start = this._parseTimestamp(startTime);
          const end = this._parseTimestamp(endTime);

          // Collect text lines
          const textLines = [];
          i++;
          while (i < lines.length && lines[i].trim() !== '') {
            const textLine = lines[i].trim();
            if (textLine && !textLine.match(/^NOTE\s/)) { // Skip VTT NOTE lines
              textLines.push(textLine);
            }
            i++;
          }

          let text = textLines.join('\n');

          // Clean VTT formatting (asbplayer approach)
          text = this._cleanVttText(text);

          if (text) {
            entries.push(new SubtitleEntry({ index: index++, start, end, text }));
          }
        }
      }
      i++;
    }

    // Remove only consecutive duplicate entries (matching asbplayer's conservative approach)
    // Only removes entries where start, end, AND text are ALL identical to the previous entry
    const deduplicated = [];

    for (const entry of entries) {
      if (deduplicated.length === 0 || !this._isSame(entry, deduplicated[deduplicated.length - 1])) {
        deduplicated.push(entry);
      }
    }

    console.log('[VTTParser] Parsed entries:', {
      total: entries.length,
      afterDedup: deduplicated.length,
      firstEntry: deduplicated[0] ? {
        start: deduplicated[0].start,
        end: deduplicated[0].end,
        text: deduplicated[0].text.substring(0, 50)
      } : null
    });

    return deduplicated;
  }

  /**
   * Clean VTT text formatting and tags
   * @param {string} text - Raw VTT text
   * @returns {string} Cleaned text
   */
  static _cleanVttText(text) {
    // Remove VTT class tags (e.g., <c>, <c.classname>, </c>)
    text = text.replace(/<(\/)?c(\.[^>]*)?>/g, '');

    // Remove other VTT tags like <v>, <i>, <b>, <u> but keep their content
    text = text.replace(/<\/?[vVibBuU][^>]*>/g, '');

    // Handle Netflix RTL markers (asbplayer approach)
    // Convert &lrm; to Unicode left-to-right mark
    text = text.replace(/&lrm;/g, '\u202a');
    // Convert &rlm; to Unicode right-to-left mark
    text = text.replace(/&rlm;/g, '\u202b');

    // Decode common HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');

    return text.trim();
  }

  /**
   * Check if two subtitle entries are identical (same start, end, and text)
   * @param {SubtitleEntry} a - First entry
   * @param {SubtitleEntry} b - Second entry
   * @returns {boolean}
   */
  static _isSame(a, b) {
    return a.start === b.start && a.end === b.end && a.text === b.text;
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
