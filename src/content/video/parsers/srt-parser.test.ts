import { describe, it, expect } from 'vitest';
import { SRTParser } from '@/content/video/parsers/srt-parser';

/**
 * Tests for the SRT (SubRip) parser.
 *
 * These lock in CURRENT behavior. Where the implementation does something
 * surprising, the assertion is kept but flagged with a `// BUG:` comment.
 */

const STANDARD_SRT = [
  '1',
  '00:00:01,000 --> 00:00:03,500',
  '你好，世界。',
  '',
  '2',
  '00:00:04,000 --> 00:00:06,250',
  '我们去公园吧。',
  '',
  '3',
  '00:00:07,000 --> 00:00:09,000',
  '好的，我马上来。'
].join('\n');

describe('SRTParser.parse — standard cues', () => {
  it('parses every cue in a well-formed file', () => {
    const entries = SRTParser.parse(STANDARD_SRT);
    expect(entries).toHaveLength(3);
  });

  it('keeps the file\'s own index numbers rather than renumbering', () => {
    const entries = SRTParser.parse(STANDARD_SRT);
    expect(entries.map(e => e.index)).toEqual([1, 2, 3]);
  });

  it('converts HH:MM:SS,mmm timestamps to milliseconds', () => {
    const entries = SRTParser.parse(STANDARD_SRT);
    expect(entries[0].start).toBe(1000);
    expect(entries[0].end).toBe(3500);
    expect(entries[1].start).toBe(4000);
    expect(entries[1].end).toBe(6250);
  });

  it('preserves the cue text verbatim when it contains no markup', () => {
    const entries = SRTParser.parse(STANDARD_SRT);
    expect(entries[0].text).toBe('你好，世界。');
    expect(entries[2].text).toBe('好的，我马上来。');
  });

  it('carries hours, minutes, seconds and millis into the total', () => {
    const srt = '1\n02:03:04,567 --> 02:03:05,000\nDeep in the film\n';
    const [entry] = SRTParser.parse(srt);
    // 2h + 3m + 4s + 567ms
    expect(entry.start).toBe(2 * 3600000 + 3 * 60000 + 4 * 1000 + 567);
    expect(entry.end).toBe(2 * 3600000 + 3 * 60000 + 5 * 1000);
  });

  it('sets originalText to the parsed text', () => {
    const [entry] = SRTParser.parse(STANDARD_SRT);
    expect(entry.originalText).toBe('你好，世界。');
  });

  it('tolerates a trailing newline and trailing blank block', () => {
    const entries = SRTParser.parse(STANDARD_SRT + '\n\n\n');
    expect(entries).toHaveLength(3);
  });

  it('tolerates leading blank lines before the first cue', () => {
    const entries = SRTParser.parse('\n\n' + STANDARD_SRT);
    expect(entries).toHaveLength(3);
  });
});

describe('SRTParser.parse — decimal separator', () => {
  it('accepts the comma separator used by real SRT files', () => {
    const [entry] = SRTParser.parse('1\n00:00:01,250 --> 00:00:02,750\nHola\n');
    expect(entry.start).toBe(1250);
    expect(entry.end).toBe(2750);
  });

  it('drops cues that use a period separator (VTT style) instead of a comma', () => {
    const entries = SRTParser.parse('1\n00:00:01.250 --> 00:00:02.750\nHola\n');
    // The timestamp regex requires `,` — a period-separated cue matches nothing
    // and the whole cue is silently discarded.
    expect(entries).toEqual([]);
  });

  it('drops only the period-separated cue and keeps comma-separated neighbours', () => {
    const mixed = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      'Comma cue',
      '',
      '2',
      '00:00:03.000 --> 00:00:04.000',
      'Period cue',
      '',
      '3',
      '00:00:05,000 --> 00:00:06,000',
      'Another comma cue'
    ].join('\n');
    const entries = SRTParser.parse(mixed);
    expect(entries.map(e => e.text)).toEqual(['Comma cue', 'Another comma cue']);
  });
});

describe('SRTParser.parse — multi-line cue text', () => {
  it('joins the remaining lines of a cue with a newline', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      '- Où est la gare ?',
      '- Juste après le pont.'
    ].join('\n');
    const [entry] = SRTParser.parse(srt);
    expect(entry.text).toBe('- Où est la gare ?\n- Juste après le pont.');
  });

  it('keeps three or more text lines', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      '第一行',
      '第二行',
      '第三行'
    ].join('\n');
    const [entry] = SRTParser.parse(srt);
    expect(entry.text).toBe('第一行\n第二行\n第三行');
  });
});

describe('SRTParser.parse — line endings and BOM', () => {
  it('parses a CRLF file', () => {
    const crlf = STANDARD_SRT.replace(/\n/g, '\r\n');
    const entries = SRTParser.parse(crlf);
    expect(entries).toHaveLength(3);
    expect(entries[0].start).toBe(1000);
    expect(entries[0].end).toBe(3500);
  });

  it('does not leave a stray CR on single-line CRLF cue text', () => {
    const crlf = STANDARD_SRT.replace(/\n/g, '\r\n');
    const entries = SRTParser.parse(crlf);
    expect(entries[0].text).toBe('你好，世界。');
  });

  it('does not leave an embedded CR inside multi-line CRLF cue text', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:04,000', 'First line', 'Second line'].join('\r\n');
    const [entry] = SRTParser.parse(srt);
    // Previously the parser split blocks on blank lines but lines on '\n' only,
    // so the CR that terminated each inner text line survived into the cue text.
    expect(entry.text).toBe('First line\nSecond line');
  });

  it('does not leave an embedded CR in a three-line CRLF cue', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:04,000', '第一行', '第二行', '第三行'].join('\r\n');
    expect(SRTParser.parse(srt)[0].text).toBe('第一行\n第二行\n第三行');
  });

  it('normalizes lone-CR (classic Mac) line endings', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:04,000', 'First line', 'Second line'].join('\r');
    const [entry] = SRTParser.parse(srt);
    expect([entry.start, entry.end, entry.text]).toEqual([1000, 4000, 'First line\nSecond line']);
  });

  it('parses a file that starts with a UTF-8 BOM', () => {
    const entries = SRTParser.parse('﻿' + STANDARD_SRT);
    expect(entries).toHaveLength(3);
    expect(entries[0].index).toBe(1);
  });

  it('parses a BOM + CRLF file (the common Windows export)', () => {
    const entries = SRTParser.parse('﻿' + STANDARD_SRT.replace(/\n/g, '\r\n'));
    expect(entries).toHaveLength(3);
    expect(entries[2].text).toBe('好的，我马上来。');
  });
});

describe('SRTParser.parse — index numbers', () => {
  it('drops a cue whose index line is missing entirely', () => {
    const srt = ['00:00:01,000 --> 00:00:03,000', 'No index above me', 'second line'].join('\n');
    // The timestamp line is read as the index, parseInt('00:00:01,000') === 0,
    // then line 2 ('No index above me') fails the timestamp match.
    expect(SRTParser.parse(srt)).toEqual([]);
  });

  it('drops a cue whose index line is blank', () => {
    const srt = ['', '00:00:01,000 --> 00:00:03,000', 'Text here'].join('\n');
    expect(SRTParser.parse(srt)).toEqual([]);
  });

  it('drops a cue whose index is non-numeric', () => {
    const srt = ['cue-one', '00:00:01,000 --> 00:00:03,000', 'Text here'].join('\n');
    expect(SRTParser.parse(srt)).toEqual([]);
  });

  it('accepts an index with surrounding whitespace', () => {
    const srt = ['  7  ', '00:00:01,000 --> 00:00:03,000', 'Text here'].join('\n');
    const [entry] = SRTParser.parse(srt);
    expect(entry.index).toBe(7);
  });

  it('accepts a numeric-prefixed index via parseInt leniency', () => {
    const srt = ['12abc', '00:00:01,000 --> 00:00:03,000', 'Text here'].join('\n');
    const [entry] = SRTParser.parse(srt);
    // BUG: parseInt('12abc') === 12, so a malformed index line is silently accepted.
    expect(entry.index).toBe(12);
  });

  it('does not renumber duplicate or non-monotonic indexes', () => {
    const srt = [
      '5',
      '00:00:01,000 --> 00:00:02,000',
      'first',
      '',
      '5',
      '00:00:03,000 --> 00:00:04,000',
      'second'
    ].join('\n');
    expect(SRTParser.parse(srt).map(e => e.index)).toEqual([5, 5]);
  });
});

describe('SRTParser.parse — cue shape', () => {
  it('drops a cue with no text line (only index + timestamps)', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000'].join('\n');
    // Fewer than 3 lines in the block, so the cue never reaches the parser.
    expect(SRTParser.parse(srt)).toEqual([]);
  });

  it('keeps a cue whose text is a single line', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', 'Solo'].join('\n');
    expect(SRTParser.parse(srt).map(e => e.text)).toEqual(['Solo']);
  });

  it('tolerates extra whitespace around the --> arrow', () => {
    const srt = ['1', '00:00:01,000    -->    00:00:03,000', 'Spaced'].join('\n');
    const [entry] = SRTParser.parse(srt);
    expect([entry.start, entry.end]).toEqual([1000, 3000]);
  });

  it('ignores trailing positioning data after the timestamps', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000 X1:100 X2:400 Y1:50 Y2:90', 'Positioned'].join('\n');
    const [entry] = SRTParser.parse(srt);
    expect([entry.start, entry.end, entry.text]).toEqual([1000, 3000, 'Positioned']);
  });

  it('skips a block whose second line is not a timestamp', () => {
    const srt = ['1', 'this is not a timestamp', 'some text'].join('\n');
    expect(SRTParser.parse(srt)).toEqual([]);
  });
});

describe('SRTParser.parse — markup in cue text', () => {
  it('strips italic tags but keeps their content', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '<i>Whispered line</i>'].join('\n');
    expect(SRTParser.parse(srt)[0].text).toBe('Whispered line');
  });

  it('strips font colour tags', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '<font color="#ffff00">黄色字幕</font>'].join('\n');
    expect(SRTParser.parse(srt)[0].text).toBe('黄色字幕');
  });

  it('strips nested bold/italic tags across two text lines', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '<b><i>Line one</i></b>', '<u>Line two</u>'].join('\n');
    expect(SRTParser.parse(srt)[0].text).toBe('Line one\nLine two');
  });

  it('drops <rt> ruby annotations while keeping the base text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      '<ruby>漢字<rt>かんじ</rt></ruby>を読む'
    ].join('\n');
    expect(SRTParser.parse(srt)[0].text).toBe('漢字を読む');
  });

  it('decodes HTML entities as a side effect of the tag stripper', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', 'Tom &amp; Jerry &quot;again&quot;'].join('\n');
    expect(SRTParser.parse(srt)[0].text).toBe('Tom & Jerry "again"');
  });

  it('discards the content of an unknown pseudo-tag that looks like markup', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '<不明>text</不明>'].join('\n');
    const text = SRTParser.parse(srt)[0].text;
    expect(text).toBe('text');
  });
});

describe('SRTParser.parse — bidirectional text markers', () => {
  it('leaves literal U+202A / U+202B embedding marks in the text', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '‫مرحبا بالعالم‪'].join('\n');
    const text = SRTParser.parse(srt)[0].text;
    // BUG(ish): the SRT path has no RTL-marker handling at all (unlike the VTT
    // parser, which *inserts* U+202A/U+202B for &lrm;/&rlm;). The marks survive
    // into the rendered subtitle text.
    expect(text).toContain('‫');
    expect(text).toContain('‪');
    expect(text).toBe('‫مرحبا بالعالم‪');
  });

  it('does not convert &lrm; / &rlm; entities to embedding marks the way the VTT parser does', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '&lrm;Hello&rlm;'].join('\n');
    const text = SRTParser.parse(srt)[0].text;
    // The HTML stripper decodes the named entities to U+200E / U+200F
    // (LEFT/RIGHT-TO-LEFT MARK), not to the U+202A / U+202B the VTT path uses.
    expect(text).toBe('‎Hello‏');
  });

  it('does not strip the marks when they are the whole cue text', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '‪‫'].join('\n');
    expect(SRTParser.parse(srt)[0].text).toBe('‪‫');
  });
});

describe('SRTParser.parse — ordering and overlap', () => {
  it('preserves file order for out-of-order cues rather than sorting them', () => {
    const srt = [
      '1',
      '00:00:10,000 --> 00:00:12,000',
      'later cue',
      '',
      '2',
      '00:00:01,000 --> 00:00:03,000',
      'earlier cue'
    ].join('\n');
    const entries = SRTParser.parse(srt);
    expect(entries.map(e => e.start)).toEqual([10000, 1000]);
  });

  it('keeps overlapping cues as separate entries', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'speaker A',
      '',
      '2',
      '00:00:03,000 --> 00:00:07,000',
      'speaker B'
    ].join('\n');
    const entries = SRTParser.parse(srt);
    expect(entries).toHaveLength(2);
    expect(entries[1].start).toBeLessThan(entries[0].end);
  });

  it('keeps a cue whose end precedes its start', () => {
    const srt = ['1', '00:00:09,000 --> 00:00:02,000', 'reversed'].join('\n');
    const [entry] = SRTParser.parse(srt);
    expect(entry.start).toBe(9000);
    expect(entry.end).toBe(2000);
    expect(entry.getDuration()).toBe(-7000);
  });
});

describe('SRTParser.parse — deduplication', () => {
  it('collapses consecutive cues that match on start, end and text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      '重复的字幕',
      '',
      '2',
      '00:00:01,000 --> 00:00:03,000',
      '重复的字幕'
    ].join('\n');
    expect(SRTParser.parse(srt)).toHaveLength(1);
  });

  it('keeps duplicates that are not adjacent', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'repeat',
      '',
      '2',
      '00:00:04,000 --> 00:00:05,000',
      'different',
      '',
      '3',
      '00:00:01,000 --> 00:00:03,000',
      'repeat'
    ].join('\n');
    expect(SRTParser.parse(srt).map(e => e.text)).toEqual(['repeat', 'different', 'repeat']);
  });

  it('keeps adjacent cues with the same text but different timings', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'same text',
      '',
      '2',
      '00:00:03,000 --> 00:00:05,000',
      'same text'
    ].join('\n');
    expect(SRTParser.parse(srt)).toHaveLength(2);
  });
});

describe('SRTParser.parse — empty and garbage input', () => {
  it('returns an empty array for an empty string', () => {
    expect(SRTParser.parse('')).toEqual([]);
  });

  it('returns an empty array for whitespace only', () => {
    expect(SRTParser.parse('   \n\n \t \n')).toEqual([]);
  });

  it('returns an empty array for prose that is not a subtitle file', () => {
    expect(SRTParser.parse('This file is not a subtitle file at all.')).toEqual([]);
  });

  it('returns an empty array for HTML served instead of a subtitle file', () => {
    const html = '<!DOCTYPE html>\n<html>\n<body>\n<h1>404 Not Found</h1>\n</body>\n</html>';
    expect(SRTParser.parse(html)).toEqual([]);
  });

  it('returns an empty array for binary-ish garbage', () => {
    expect(SRTParser.parse(' garbageÿ')).toEqual([]);
  });

  it('recovers usable cues from a file with a corrupt leading block', () => {
    const srt = [
      '???',
      'not a timestamp',
      'junk',
      '',
      '2',
      '00:00:04,000 --> 00:00:06,000',
      'good cue'
    ].join('\n');
    expect(SRTParser.parse(srt).map(e => e.text)).toEqual(['good cue']);
  });
});

describe('SRTParser._parseTimestamp', () => {
  it('converts the zero timestamp to 0', () => {
    expect(SRTParser._parseTimestamp('00:00:00,000')).toBe(0);
  });

  it('converts a millisecond-only timestamp', () => {
    expect(SRTParser._parseTimestamp('00:00:00,001')).toBe(1);
  });

  it('converts an hour-scale timestamp', () => {
    expect(SRTParser._parseTimestamp('01:00:00,000')).toBe(3600000);
  });

  it('converts a full timestamp', () => {
    expect(SRTParser._parseTimestamp('12:34:56,789')).toBe(45296789);
  });

  it('drops leading zeros in the millisecond field without rescaling', () => {
    // '050' parses as 50 ms, which is the intended reading.
    expect(SRTParser._parseTimestamp('00:00:00,050')).toBe(50);
  });
});

describe('SRTParser.formatTimestamp', () => {
  it('formats zero', () => {
    expect(SRTParser.formatTimestamp(0)).toBe('00:00:00,000');
  });

  it('pads every field', () => {
    expect(SRTParser.formatTimestamp(1)).toBe('00:00:00,001');
    expect(SRTParser.formatTimestamp(61000)).toBe('00:01:01,000');
  });

  it('formats past the hour boundary', () => {
    expect(SRTParser.formatTimestamp(3661001)).toBe('01:01:01,001');
  });

  it('does not wrap hours at 24', () => {
    expect(SRTParser.formatTimestamp(25 * 3600000)).toBe('25:00:00,000');
  });

  it('round-trips with _parseTimestamp', () => {
    const ms = 45296789;
    expect(SRTParser._parseTimestamp(SRTParser.formatTimestamp(ms))).toBe(ms);
  });
});

describe('SRTParser._isSame', () => {
  it('is true for entries matching on start, end and text', () => {
    const [a] = SRTParser.parse('1\n00:00:01,000 --> 00:00:02,000\nsame');
    const [b] = SRTParser.parse('9\n00:00:01,000 --> 00:00:02,000\nsame');
    // Index is deliberately not compared.
    expect(SRTParser._isSame(a, b)).toBe(true);
  });

  it('is false when the text differs', () => {
    const [a] = SRTParser.parse('1\n00:00:01,000 --> 00:00:02,000\nA');
    const [b] = SRTParser.parse('1\n00:00:01,000 --> 00:00:02,000\nB');
    expect(SRTParser._isSame(a, b)).toBe(false);
  });

  it('is false when the timing differs', () => {
    const [a] = SRTParser.parse('1\n00:00:01,000 --> 00:00:02,000\nA');
    const [b] = SRTParser.parse('1\n00:00:01,000 --> 00:00:03,000\nA');
    expect(SRTParser._isSame(a, b)).toBe(false);
  });
});
