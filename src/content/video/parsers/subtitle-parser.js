/**
 * Main subtitle parser that detects format and delegates to specific parsers
 */
class SubtitleParser {
  /**
   * Parse subtitle content automatically detecting format
   * @param {string} content - Subtitle file content
   * @param {string} filename - Optional filename for format detection
   * @returns {SubtitleEntry[]}
   */
  static parse(content, filename = '') {
    const format = this.detectFormat(content, filename);

    switch (format) {
      case 'srt':
        return SRTParser.parse(content);
      case 'vtt':
        return VTTParser.parse(content);
      default:
        console.warn('Unknown subtitle format, trying SRT parser');
        return SRTParser.parse(content);
    }
  }

  /**
   * Detect subtitle format from content or filename
   * @param {string} content - Subtitle content
   * @param {string} filename - Filename
   * @returns {string} Format identifier
   */
  static detectFormat(content, filename = '') {
    // Check filename extension
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'srt') return 'srt';
    if (ext === 'vtt') return 'vtt';

    // Check content
    if (content.trim().startsWith('WEBVTT')) {
      return 'vtt';
    }

    // Check for SRT timestamp format (uses comma)
    if (content.includes('-->') && content.includes(',')) {
      return 'srt';
    }

    // Check for VTT timestamp format (uses period)
    if (content.includes('-->') && /\d{2}:\d{2}:\d{2}\.\d{3}/.test(content)) {
      return 'vtt';
    }

    // Default to SRT
    return 'srt';
  }

  /**
   * Parse subtitle file from File object
   * @param {File} file - Subtitle file
   * @returns {Promise<SubtitleEntry[]>}
   */
  static async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const entries = this.parse(content, file.name);
          resolve(entries);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}
