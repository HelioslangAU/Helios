import { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Parser for WebVTT subtitle format
 * Handles both standard VTT and Netflix VTT formats
 */
export class VTTParser {
  /**
   * Parse VTT content into subtitle entries
   * @param content - VTT file content
   */
  static parse(content: string): SubtitleEntry[] {
    const entries: SubtitleEntry[] = [];
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
        // WebVTT allows an hour field of any length (100:00:00.000 is legal),
        // so the hour group is \d+ rather than \d{1,2}.
        const timestampMatch = line.match(
          /(\d+:)?(\d{2}:\d{2}\.\d{3})\s*-->\s*(\d+:)?(\d{2}:\d{2}\.\d{3})/
        );

        if (timestampMatch) {
          // Reconstruct full timestamps with hours if missing
          const startTime = (timestampMatch[1] || '00:') + timestampMatch[2];
          const endTime = (timestampMatch[3] || '00:') + timestampMatch[4];

          const start = this._parseTimestamp(startTime);
          const end = this._parseTimestamp(endTime);

          // Collect text lines
          const textLines: string[] = [];
          let inNote = false;
          i++;
          while (i < lines.length && lines[i].trim() !== '') {
            const textLine = lines[i].trim();
            // A VTT NOTE block starts with 'NOTE' (alone or followed by
            // whitespace) and runs until the next blank line, so every
            // continuation line belongs to the comment too.
            if (/^NOTE(\s|$)/.test(textLine)) {
              inNote = true;
            }
            if (textLine && !inNote) {
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
    const deduplicated: SubtitleEntry[] = [];

    for (const entry of entries) {
      if (deduplicated.length === 0 || !this._isSame(entry, deduplicated[deduplicated.length - 1])) {
        deduplicated.push(entry);
      }
    }

    // Renumber after deduplication so index always matches list position
    // (numbering before dedup left gaps wherever a duplicate was dropped).
    deduplicated.forEach((entry, position) => {
      entry.index = position;
    });

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
   * @param text - Raw VTT text
   * @returns Cleaned text
   */
  static _cleanVttText(text: string): string {
    // Remove VTT class tags (e.g., <c>, <c.classname>, </c>)
    text = text.replace(/<(\/)?c(\.[^>]*)?>/g, '');

    // Remove other VTT tags like <v>, <i>, <b>, <u> but keep their content
    text = text.replace(/<\/?[vVbBuUiI][^>]*>/g, '');

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
   * @param a - First entry
   * @param b - Second entry
   */
  static _isSame(a: SubtitleEntry, b: SubtitleEntry): boolean {
    return a.start === b.start && a.end === b.end && a.text === b.text;
  }

  /**
   * Parse VTT timestamp to milliseconds
   * @param timestamp - Format: HH:MM:SS.mmm
   * @returns Milliseconds
   */
  static _parseTimestamp(timestamp: string): number {
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
   * @param ms - Milliseconds
   * @returns Format: HH:MM:SS.mmm
   */
  static formatTimestamp(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
}
