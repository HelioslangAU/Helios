import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VTTParser } from '@/content/video/parsers/vtt-parser';

/**
 * Tests for the WebVTT parser.
 *
 * These lock in CURRENT behavior. Where the implementation does something
 * surprising, the assertion is kept but flagged with a `// BUG:` comment.
 */

// VTTParser.parse logs a summary on every call; silence it so test output stays readable.
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const STANDARD_VTT = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:03.500',
  '你好，世界。',
  '',
  '00:00:04.000 --> 00:00:06.250',
  '我们去公园吧。',
  '',
  '00:00:07.000 --> 00:00:09.000',
  '好的，我马上来。'
].join('\n');

describe('VTTParser.parse — standard cues', () => {
  it('parses every cue in a well-formed file', () => {
    expect(VTTParser.parse(STANDARD_VTT)).toHaveLength(3);
  });

  it('converts HH:MM:SS.mmm timestamps to milliseconds', () => {
    const entries = VTTParser.parse(STANDARD_VTT);
    expect(entries[0].start).toBe(1000);
    expect(entries[0].end).toBe(3500);
    expect(entries[1].start).toBe(4000);
    expect(entries[1].end).toBe(6250);
  });

  it('numbers entries sequentially from zero, ignoring any file numbering', () => {
    expect(VTTParser.parse(STANDARD_VTT).map(e => e.index)).toEqual([0, 1, 2]);
  });

  it('keeps cue text verbatim when it contains no markup', () => {
    expect(VTTParser.parse(STANDARD_VTT)[2].text).toBe('好的，我马上来。');
  });

  it('sets originalText to the parsed text', () => {
    expect(VTTParser.parse(STANDARD_VTT)[0].originalText).toBe('你好，世界。');
  });
});

describe('VTTParser.parse — WEBVTT header', () => {
  it('skips the bare WEBVTT signature', () => {
    expect(VTTParser.parse(STANDARD_VTT)[0].text).toBe('你好，世界。');
  });

  it('skips a WEBVTT signature with a trailing description', () => {
    const vtt = ['WEBVTT - This file has a title', '', '00:00:01.000 --> 00:00:02.000', 'Hi'].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['Hi']);
  });

  it('skips header metadata blocks such as Kind and Language', () => {
    const vtt = [
      'WEBVTT',
      'Kind: captions',
      'Language: zh-Hans',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '开始了'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['开始了']);
  });

  it('skips an X-TIMESTAMP-MAP header line (HLS/Netflix style)', () => {
    const vtt = [
      'WEBVTT',
      'X-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'segment text'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['segment text']);
  });

  it('parses cues even when the WEBVTT signature is missing', () => {
    const vtt = ['00:00:01.000 --> 00:00:02.000', 'no header'].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['no header']);
  });

  it('parses a file whose signature is preceded by a UTF-8 BOM', () => {
    expect(VTTParser.parse('﻿' + STANDARD_VTT)).toHaveLength(3);
  });
});

describe('VTTParser.parse — cue identifiers', () => {
  it('ignores a numeric cue identifier line', () => {
    const vtt = [
      'WEBVTT',
      '',
      '1',
      '00:00:01.000 --> 00:00:02.000',
      'first',
      '',
      '2',
      '00:00:03.000 --> 00:00:04.000',
      'second'
    ].join('\n');
    const entries = VTTParser.parse(vtt);
    expect(entries.map(e => e.text)).toEqual(['first', 'second']);
    expect(entries.map(e => e.index)).toEqual([0, 1]);
  });

  it('ignores a named cue identifier line', () => {
    const vtt = [
      'WEBVTT',
      '',
      'intro-line',
      '00:00:01.000 --> 00:00:02.000',
      'Bonjour'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['Bonjour']);
  });

  it('does not leak the identifier into the previous cue text', () => {
    const vtt = [
      'WEBVTT',
      '',
      'cue-1',
      '00:00:01.000 --> 00:00:02.000',
      'first',
      '',
      'cue-2',
      '00:00:03.000 --> 00:00:04.000',
      'second'
    ].join('\n');
    expect(VTTParser.parse(vtt)[0].text).toBe('first');
  });
});

describe('VTTParser.parse — cue settings after the timestamp', () => {
  it('ignores alignment and line settings', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000 align:middle line:90%',
      'Positioned line'
    ].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect([entry.start, entry.end, entry.text]).toEqual([1000, 3000, 'Positioned line']);
  });

  it('ignores a full settings string with position, size and region', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000 position:50% size:80% align:start region:fred',
      'Settings galore'
    ].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect([entry.start, entry.end]).toEqual([1000, 3000]);
  });

  it('ignores settings on an hour-less timestamp line', () => {
    const vtt = ['WEBVTT', '', '00:01.000 --> 00:03.000 align:middle line:90%', 'Netflix style'].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect([entry.start, entry.end]).toEqual([1000, 3000]);
  });
});

describe('VTTParser.parse — hour-less timestamps', () => {
  it('treats MM:SS.mmm as zero hours', () => {
    const vtt = ['WEBVTT', '', '00:05.500 --> 00:08.250', 'Short form'].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect(entry.start).toBe(5500);
    expect(entry.end).toBe(8250);
  });

  it('handles minutes above zero in the short form', () => {
    const vtt = ['WEBVTT', '', '12:34.567 --> 12:35.000', 'Twelve minutes in'].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect(entry.start).toBe(12 * 60000 + 34 * 1000 + 567);
    expect(entry.end).toBe(12 * 60000 + 35 * 1000);
  });

  it('handles a mix of short-form start and long-form end', () => {
    const vtt = ['WEBVTT', '', '00:59.000 --> 00:01:02.000', 'Crossing the minute'].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect(entry.start).toBe(59000);
    expect(entry.end).toBe(62000);
  });

  it('handles a single-digit hour field', () => {
    const vtt = ['WEBVTT', '', '1:00:00.000 --> 1:00:02.000', 'One hour in'].join('\n');
    const [entry] = VTTParser.parse(vtt);
    expect(entry.start).toBe(3600000);
    expect(entry.end).toBe(3602000);
  });

  it('parses a cue with a three-digit hour field', () => {
    const vtt = ['WEBVTT', '', '100:00:00.000 --> 100:00:02.000', 'Very long film'].join('\n');
    // The hour group used to be `(\d{1,2}:)?`, so '100:' matched nothing and the
    // whole cue was silently dropped. WebVTT allows hours of any length.
    const [entry] = VTTParser.parse(vtt);
    expect([entry.start, entry.end, entry.text]).toEqual([
      100 * 3600000,
      100 * 3600000 + 2000,
      'Very long film'
    ]);
  });

  it('parses a long-hour cue alongside ordinary ones without losing either', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'normal',
      '',
      '999:59:59.999 --> 1000:00:00.000',
      'absurdly late'
    ].join('\n');
    const entries = VTTParser.parse(vtt);
    expect(entries.map(e => e.text)).toEqual(['normal', 'absurdly late']);
    expect(entries[1].start).toBe(999 * 3600000 + 59 * 60000 + 59 * 1000 + 999);
  });
});

describe('VTTParser.parse — NOTE blocks', () => {
  it('ignores a NOTE block that appears before the first cue', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE This translation was auto-generated',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Real text'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['Real text']);
  });

  it('ignores a NOTE block between two cues', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'first',
      '',
      'NOTE reviewed by a human',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'second'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['first', 'second']);
  });

  it('strips a NOTE line that sits directly under a timestamp, and the rest of its block', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'NOTE this should not be shown',
      'visible text'
    ].join('\n');
    // A NOTE block runs to the next blank line, so everything after the NOTE
    // line is comment too and the cue is left with no text.
    expect(VTTParser.parse(vtt)).toEqual([]);
  });

  it('keeps the text lines that precede a NOTE line in the same block', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'real dialogue',
      'NOTE translator comment',
      'still comment'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['real dialogue']);
  });

  it('starts a NOTE block on a bare NOTE line', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'NOTE',
      'comment body'
    ].join('\n');
    expect(VTTParser.parse(vtt)).toEqual([]);
  });

  it('ends the NOTE block at the blank line, so the next cue is unaffected', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'NOTE comment starts',
      'comment continues',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'second cue'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['second cue']);
  });

  it('keeps a text line that merely starts with the word NOTE followed by punctuation', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', 'NOTE: buy milk'].join('\n');
    // The skip regex is /^NOTE\s/, so 'NOTE:' is treated as ordinary dialogue.
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['NOTE: buy milk']);
  });

  it('drops a cue whose only content is a NOTE line', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', 'NOTE nothing else here'].join('\n');
    // Text ends up empty, and empty-text cues are never pushed.
    expect(VTTParser.parse(vtt)).toEqual([]);
  });

  it('drops the continuation lines of a multi-line NOTE block that has no blank separator', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'NOTE first note line',
      'second note line'
    ].join('\n');
    // Previously only lines matching /^NOTE\s/ were skipped, so a multi-line
    // NOTE's continuation lines were shown as subtitle text.
    expect(VTTParser.parse(vtt)).toEqual([]);
  });
});

describe('VTTParser.parse — multi-line cue text', () => {
  it('joins cue text lines with a newline', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      '- Où est la gare ?',
      '- Juste après le pont.'
    ].join('\n');
    expect(VTTParser.parse(vtt)[0].text).toBe('- Où est la gare ?\n- Juste après le pont.');
  });

  it('trims trailing whitespace from each text line', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:04.000', '  padded  ', '   line 2'].join('\n');
    expect(VTTParser.parse(vtt)[0].text).toBe('padded\nline 2');
  });
});

describe('VTTParser.parse — line endings', () => {
  it('parses a CRLF file with no stray carriage returns in the text', () => {
    const crlf = STANDARD_VTT.replace(/\n/g, '\r\n');
    const entries = VTTParser.parse(crlf);
    expect(entries).toHaveLength(3);
    expect(entries[0].text).toBe('你好，世界。');
    expect(entries[0].start).toBe(1000);
  });

  it('keeps multi-line CRLF text clean (unlike the SRT parser)', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:04.000', 'First line', 'Second line'].join('\r\n');
    expect(VTTParser.parse(vtt)[0].text).toBe('First line\nSecond line');
  });
});

describe('VTTParser._cleanVttText — tags and entities', () => {
  it('removes <c> class tags but keeps their content', () => {
    expect(VTTParser._cleanVttText('<c.yellow>Highlighted</c> plain')).toBe('Highlighted plain');
  });

  it('removes voice spans while keeping the spoken text', () => {
    expect(VTTParser._cleanVttText('<v Roger Bingham>Welcome back</v>')).toBe('Welcome back');
  });

  it('removes italic, bold and underline tags', () => {
    expect(VTTParser._cleanVttText('<i>a</i> <b>b</b> <u>c</u>')).toBe('a b c');
  });

  it('removes uppercase <B> and <U> tags', () => {
    expect(VTTParser._cleanVttText('<B>bold</B> <U>under</U>')).toBe('bold under');
  });

  it('removes an uppercase <I> italic tag', () => {
    // The tag character class used to be [vVibBuU] — it had 'i' but not 'I', so
    // an uppercase italic tag survived while <B>/<U> were stripped.
    expect(VTTParser._cleanVttText('<I>italic</I>')).toBe('italic');
  });

  it('removes a mixed-case <I>/<b> pair through parse()', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', '<I>a</I> <b>b</b>'].join('\n');
    expect(VTTParser.parse(vtt)[0].text).toBe('a b');
  });

  it('leaves an inline karaoke timestamp tag in the text', () => {
    const cleaned = VTTParser._cleanVttText('Word<00:00:01.500>by word');
    // BUG: VTT inline timestamp tags are not stripped, so they render as text.
    expect(cleaned).toBe('Word<00:00:01.500>by word');
  });

  it('leaves a <ruby>/<rt> pair in the text (the SRT path strips <rt>)', () => {
    const cleaned = VTTParser._cleanVttText('<ruby>漢字<rt>かんじ</rt></ruby>');
    // BUG: no ruby handling on the VTT path, so furigana markup shows verbatim.
    expect(cleaned).toBe('<ruby>漢字<rt>かんじ</rt></ruby>');
  });

  it('converts &lrm; to U+202A (LEFT-TO-RIGHT EMBEDDING)', () => {
    expect(VTTParser._cleanVttText('&lrm;left')).toBe('‪left');
  });

  it('converts &rlm; to U+202B (RIGHT-TO-LEFT EMBEDDING)', () => {
    expect(VTTParser._cleanVttText('&rlm;مرحبا')).toBe('‫مرحبا');
  });

  it('does not strip literal U+202A / U+202B characters already present', () => {
    expect(VTTParser._cleanVttText('‪wrapped‫')).toBe('‪wrapped‫');
  });

  it('decodes the common named HTML entities', () => {
    expect(VTTParser._cleanVttText('&amp; &lt; &gt; &quot; &#39; a&nbsp;b')).toBe('& < > " \' a b');
  });

  it('decodes &amp; before the other entities, so &amp;lt; becomes a literal <', () => {
    // BUG: the ampersand is decoded first, so a doubly-escaped entity is
    // decoded twice. '&amp;lt;' should render as the text '&lt;'.
    expect(VTTParser._cleanVttText('&amp;lt;')).toBe('<');
  });

  it('leaves unknown entities untouched', () => {
    expect(VTTParser._cleanVttText('caf&eacute;')).toBe('caf&eacute;');
  });

  it('trims the result', () => {
    expect(VTTParser._cleanVttText('  <i>padded</i>  ')).toBe('padded');
  });

  it('applies tag stripping end-to-end through parse()', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '<v Speaker><c.yellow>Tom &amp; Jerry</c></v>'
    ].join('\n');
    expect(VTTParser.parse(vtt)[0].text).toBe('Tom & Jerry');
  });
});

describe('VTTParser.parse — malformed input', () => {
  it('returns an empty array for an empty string', () => {
    expect(VTTParser.parse('')).toEqual([]);
  });

  it('returns an empty array for a header with no cues', () => {
    expect(VTTParser.parse('WEBVTT\n\n')).toEqual([]);
  });

  it('returns an empty array for whitespace only', () => {
    expect(VTTParser.parse('   \n\n \t \n')).toEqual([]);
  });

  it('returns an empty array for prose that is not a subtitle file', () => {
    expect(VTTParser.parse('This file is not a subtitle file at all.')).toEqual([]);
  });

  it('returns an empty array for HTML served instead of a subtitle file', () => {
    const html = '<!DOCTYPE html>\n<html>\n<body>\n<h1>404 Not Found</h1>\n</body>\n</html>';
    expect(VTTParser.parse(html)).toEqual([]);
  });

  it('drops a cue that uses SRT comma separators', () => {
    const vtt = ['WEBVTT', '', '00:00:01,000 --> 00:00:03,000', 'Comma timing'].join('\n');
    expect(VTTParser.parse(vtt)).toEqual([]);
  });

  it('drops a cue with a truncated timestamp', () => {
    const vtt = ['WEBVTT', '', '00:00:01 --> 00:00:03', 'No millis'].join('\n');
    expect(VTTParser.parse(vtt)).toEqual([]);
  });

  it('drops a cue with an empty text body', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'has text'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['has text']);
  });

  it('renumbers around dropped empty cues, leaving no index gaps', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'has text'
    ].join('\n');
    expect(VTTParser.parse(vtt)[0].index).toBe(0);
  });

  it('recovers cues that follow a malformed timestamp line', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:0X.000 --> 00:00:03.000',
      'broken',
      '',
      '00:00:04.000 --> 00:00:06.000',
      'good'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['good']);
  });

  it('keeps a stray --> inside dialogue as ordinary text', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'he said --> that way',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'next'
    ].join('\n');
    // The text-collection loop consumes the line before the outer loop can
    // mistake it for a timestamp line.
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['he said --> that way', 'next']);
  });
});

describe('VTTParser.parse — ordering, overlap and deduplication', () => {
  it('preserves file order for out-of-order cues', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:10.000 --> 00:00:12.000',
      'later cue',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'earlier cue'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.start)).toEqual([10000, 1000]);
  });

  it('keeps overlapping cues as separate entries', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:05.000',
      'speaker A',
      '',
      '00:00:03.000 --> 00:00:07.000',
      'speaker B'
    ].join('\n');
    expect(VTTParser.parse(vtt)).toHaveLength(2);
  });

  it('collapses consecutive identical cues (the HLS segment-overlap case)', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '重复的字幕',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '重复的字幕'
    ].join('\n');
    expect(VTTParser.parse(vtt)).toHaveLength(1);
  });

  it('keeps non-adjacent duplicates', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'repeat',
      '',
      '00:00:04.000 --> 00:00:05.000',
      'different',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'repeat'
    ].join('\n');
    expect(VTTParser.parse(vtt).map(e => e.text)).toEqual(['repeat', 'different', 'repeat']);
  });

  it('leaves no index gap when a duplicate is removed', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'dup',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'dup',
      '',
      '00:00:04.000 --> 00:00:05.000',
      'next'
    ].join('\n');
    // Indexes used to be assigned before deduplication, leaving the survivors
    // numbered 0 and 2; they are now renumbered to match list position.
    const entries = VTTParser.parse(vtt);
    expect(entries.map(e => e.text)).toEqual(['dup', 'next']);
    expect(entries.map(e => e.index)).toEqual([0, 1]);
  });

  it('numbers entries contiguously when several duplicates are dropped', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'a',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'a',
      '',
      '00:00:04.000 --> 00:00:05.000',
      'b',
      '',
      '00:00:04.000 --> 00:00:05.000',
      'b',
      '',
      '00:00:06.000 --> 00:00:07.000',
      'c'
    ].join('\n');
    const entries = VTTParser.parse(vtt);
    expect(entries.map(e => e.text)).toEqual(['a', 'b', 'c']);
    expect(entries.map(e => e.index)).toEqual([0, 1, 2]);
  });
});

describe('VTTParser._parseTimestamp', () => {
  it('converts the zero timestamp to 0', () => {
    expect(VTTParser._parseTimestamp('00:00:00.000')).toBe(0);
  });

  it('converts a full timestamp', () => {
    expect(VTTParser._parseTimestamp('12:34:56.789')).toBe(45296789);
  });

  it('converts an hour-scale timestamp', () => {
    expect(VTTParser._parseTimestamp('01:00:00.000')).toBe(3600000);
  });
});

describe('VTTParser.formatTimestamp', () => {
  it('formats zero with a period separator', () => {
    expect(VTTParser.formatTimestamp(0)).toBe('00:00:00.000');
  });

  it('pads every field', () => {
    expect(VTTParser.formatTimestamp(61001)).toBe('00:01:01.001');
  });

  it('round-trips with _parseTimestamp', () => {
    const ms = 45296789;
    expect(VTTParser._parseTimestamp(VTTParser.formatTimestamp(ms))).toBe(ms);
  });
});

describe('VTTParser._isSame', () => {
  it('ignores the index when comparing', () => {
    const [a] = VTTParser.parse('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nsame');
    const [b] = VTTParser.parse('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nsame');
    b.index = 99;
    expect(VTTParser._isSame(a, b)).toBe(true);
  });

  it('is false when the text differs', () => {
    const [a] = VTTParser.parse('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA');
    const [b] = VTTParser.parse('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nB');
    expect(VTTParser._isSame(a, b)).toBe(false);
  });
});
