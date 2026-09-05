import { SRTParser } from '@/content/video/parsers/srt-parser';
import { VTTParser } from '@/content/video/parsers/vtt-parser';
import type { SubtitleEntry } from '@/content/video/models/subtitle-entry';

/**
 * Main subtitle parser that detects format and delegates to specific parsers
 */
export class SubtitleParser {
  /**
   * Parse subtitle content automatically detecting format
   * @param content - Subtitle file content
   * @param filename - Optional filename for format detection
   */
  static parse(content: string, filename: string = ''): SubtitleEntry[] {
    const format = this.detectFormat(content, filename);
    const entries = this._parseAs(content, format);

    // A filename extension can lie (a .srt that actually holds WEBVTT). If the
    // chosen parser found nothing, retry with the format the content itself
    // suggests rather than handing back an empty track.
    if (entries.length === 0) {
      const contentFormat = this.detectFormatFromContent(content);
      if (contentFormat !== format) {
        return this._parseAs(content, contentFormat);
      }
    }

    return entries;
  }

  /**
   * Run the parser for a known format identifier
   * @param content - Subtitle content
   * @param format - Format identifier
   */
  static _parseAs(content: string, format: string): SubtitleEntry[] {
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
   * @param content - Subtitle content
   * @param filename - Filename
   * @returns Format identifier
   */
  static detectFormat(content: string, filename: string = ''): string {
    // Check filename extension
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'srt') return 'srt';
    if (ext === 'vtt') return 'vtt';

    return this.detectFormatFromContent(content);
  }

  /**
   * Detect subtitle format from the content alone
   * @param content - Subtitle content
   * @returns Format identifier
   */
  static detectFormatFromContent(content: string): string {
    // The WEBVTT signature is definitive
    if (content.trim().startsWith('WEBVTT')) {
      return 'vtt';
    }

    // Otherwise decide on the decimal separator of the actual cue-timing lines
    // (VTT uses '.', SRT uses ','). Punctuation elsewhere in the file — a comma
    // in dialogue, say — must not get a vote, or a headerless VTT would be
    // routed to the SRT parser and come back empty.
    for (const line of content.split(/\r?\n/)) {
      if (!line.includes('-->')) continue;
      if (/\d{2}:\d{2}\.\d{3}/.test(line)) return 'vtt';
      if (/\d{2}:\d{2},\d{3}/.test(line)) return 'srt';
    }

    // Default to SRT
    return 'srt';
  }

  /**
   * Parse subtitle file from File object
   * @param file - Subtitle file
   */
  static async parseFile(file: File): Promise<SubtitleEntry[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target!.result as string;
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
