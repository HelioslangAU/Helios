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
