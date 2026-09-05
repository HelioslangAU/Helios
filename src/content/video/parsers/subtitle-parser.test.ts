import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubtitleParser } from '@/content/video/parsers/subtitle-parser';

/**
 * Tests for the format-detection / dispatch layer.
 *
 * SubtitleParser.parseFile is not covered: it is a thin FileReader wrapper with
 * no logic of its own beyond delegating to parse().
 */

beforeEach(() => {
  // VTTParser.parse logs a summary on every call.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const SRT_CONTENT = ['1', '00:00:01,000 --> 00:00:03,000', '你好，世界。'].join('\n');

const VTT_CONTENT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', '你好，世界。'].join('\n');

describe('SubtitleParser.detectFormat — by filename', () => {
  it('detects .srt', () => {
    expect(SubtitleParser.detectFormat('', 'movie.srt')).toBe('srt');
  });

  it('detects .vtt', () => {
    expect(SubtitleParser.detectFormat('', 'movie.vtt')).toBe('vtt');
  });

  it('is case-insensitive about the extension', () => {
    expect(SubtitleParser.detectFormat('', 'MOVIE.SRT')).toBe('srt');
    expect(SubtitleParser.detectFormat('', 'MOVIE.VTT')).toBe('vtt');
  });

  it('uses the last extension of a multi-dotted name', () => {
    expect(SubtitleParser.detectFormat('', '让子弹飞.2010.zh-Hans.vtt')).toBe('vtt');
  });

  it('lets the filename override contradicting content, but still parses the file', () => {
    // The extension still wins the format vote...
    expect(SubtitleParser.detectFormat(VTT_CONTENT, 'mislabelled.srt')).toBe('srt');
    // ...yet parse() now falls back to content detection when the chosen parser
    // comes back empty, so a mislabelled file is no longer silently dropped.
    const entries = SubtitleParser.parse(VTT_CONTENT, 'mislabelled.srt');
    expect(entries).toHaveLength(1);
    expect([entries[0].start, entries[0].text]).toEqual([1000, '你好，世界。']);
  });

  it('falls back the other way for VTT-named content that is really SRT', () => {
    const entries = SubtitleParser.parse(SRT_CONTENT, 'mislabelled.vtt');
    expect(entries).toHaveLength(1);
    expect([entries[0].start, entries[0].text]).toEqual([1000, '你好，世界。']);
  });

  it('falls back to content sniffing for an unrelated extension', () => {
    expect(SubtitleParser.detectFormat(VTT_CONTENT, 'subs.ass')).toBe('vtt');
    expect(SubtitleParser.detectFormat(SRT_CONTENT, 'subs.ass')).toBe('srt');
  });

  it('falls back to content sniffing for a name with no extension', () => {
    expect(SubtitleParser.detectFormat(VTT_CONTENT, 'subtitles')).toBe('vtt');
  });

  it('ignores query strings that make the extension unrecognisable', () => {
    // A URL-derived name keeps the query string, so '.vtt?t=1' is not matched.
    expect(SubtitleParser.detectFormat(VTT_CONTENT, 'subs.vtt?token=abc')).toBe('vtt');
    expect(SubtitleParser.detectFormat(SRT_CONTENT, 'subs.srt?token=abc')).toBe('srt');
  });
});

describe('SubtitleParser.detectFormat — by content', () => {
  it('detects a WEBVTT signature', () => {
    expect(SubtitleParser.detectFormat(VTT_CONTENT)).toBe('vtt');
  });

  it('detects a WEBVTT signature preceded by whitespace', () => {
    expect(SubtitleParser.detectFormat('\n\n' + VTT_CONTENT)).toBe('vtt');
  });

  it('detects SRT from comma-separated timestamps with no signature', () => {
    expect(SubtitleParser.detectFormat(SRT_CONTENT)).toBe('srt');
  });

  it('detects VTT from period-separated timestamps with no signature', () => {
    const headerless = ['00:00:01.000 --> 00:00:03.000', 'Bonjour'].join('\n');
    expect(SubtitleParser.detectFormat(headerless)).toBe('vtt');
  });

  it('detects a headerless VTT file whose dialogue contains a comma', () => {
    const headerless = ['00:00:01.000 --> 00:00:03.000', 'Hello, world'].join('\n');
    // The SRT check used to be `content.includes('-->') && content.includes(',')`,
    // so a comma anywhere — including inside dialogue — outranked the
    // period-timestamp VTT check. Only the cue-timing lines get a vote now.
    expect(SubtitleParser.detectFormat(headerless)).toBe('vtt');
    expect(SubtitleParser.parse(headerless).map(e => e.text)).toEqual(['Hello, world']);
  });

  it('detects SRT from comma timestamps even when the dialogue contains a period', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', 'Hello. World.'].join('\n');
    expect(SubtitleParser.detectFormat(srt)).toBe('srt');
    expect(SubtitleParser.parse(srt).map(e => e.text)).toEqual(['Hello. World.']);
  });

  it('detects a headerless HLS-segment VTT with hour-less timestamps and a comma', () => {
    const segment = ['00:01.000 --> 00:03.000 align:middle', 'Well, hello there'].join('\n');
    expect(SubtitleParser.detectFormat(segment)).toBe('vtt');
    expect(SubtitleParser.parse(segment).map(e => e.text)).toEqual(['Well, hello there']);
  });

  it('still detects VTT when a comma appears but a WEBVTT signature is present', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Hello, world'].join('\n');
    expect(SubtitleParser.detectFormat(vtt)).toBe('vtt');
  });

  it('defaults to srt for an empty string', () => {
    expect(SubtitleParser.detectFormat('')).toBe('srt');
  });

  it('defaults to srt for content with no cues at all', () => {
    expect(SubtitleParser.detectFormat('just some prose, with a comma')).toBe('srt');
  });

  it('defaults to srt for HTML served instead of a subtitle file', () => {
    expect(SubtitleParser.detectFormat('<html><body>404</body></html>')).toBe('srt');
  });

  it('treats an empty filename argument as absent', () => {
    expect(SubtitleParser.detectFormat(VTT_CONTENT, '')).toBe('vtt');
  });
});

describe('SubtitleParser.parse — dispatch', () => {
  it('routes SRT content to the SRT parser', () => {
    const entries = SubtitleParser.parse(SRT_CONTENT, 'movie.srt');
    expect(entries).toHaveLength(1);
    expect(entries[0].start).toBe(1000);
    expect(entries[0].text).toBe('你好，世界。');
  });

  it('routes VTT content to the VTT parser', () => {
    const entries = SubtitleParser.parse(VTT_CONTENT, 'movie.vtt');
    expect(entries).toHaveLength(1);
    expect(entries[0].start).toBe(1000);
    expect(entries[0].text).toBe('你好，世界。');
  });

  it('numbers SRT entries from the file and VTT entries from zero', () => {
    // A visible difference between the two parsers that survives dispatch.
    expect(SubtitleParser.parse(SRT_CONTENT, 'a.srt')[0].index).toBe(1);
    expect(SubtitleParser.parse(VTT_CONTENT, 'a.vtt')[0].index).toBe(0);
  });

  it('parses content correctly with no filename supplied', () => {
    expect(SubtitleParser.parse(VTT_CONTENT)).toHaveLength(1);
    expect(SubtitleParser.parse(SRT_CONTENT)).toHaveLength(1);
  });

  it('returns an empty array for empty input', () => {
    expect(SubtitleParser.parse('')).toEqual([]);
  });

  it('returns an empty array for garbage input', () => {
    expect(SubtitleParser.parse('not a subtitle file')).toEqual([]);
  });

  it('never reaches the "unknown format" warning branch', () => {
    // detectFormat only ever returns 'srt' or 'vtt', so the default case in
    // parse()'s switch is dead code.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    SubtitleParser.parse('completely unrecognisable content');
    expect(warn).not.toHaveBeenCalled();
  });

  it('handles a Netflix-style hour-less VTT end to end', () => {
    const netflix = [
      'WEBVTT',
      '',
      '00:01.000 --> 00:03.000 align:middle line:90%',
      '<c.yellow>お元気ですか</c>'
    ].join('\n');
    const entries = SubtitleParser.parse(netflix, 'netflix-track.vtt');
    expect(entries).toHaveLength(1);
    expect([entries[0].start, entries[0].end, entries[0].text]).toEqual([1000, 3000, 'お元気ですか']);
  });
});
