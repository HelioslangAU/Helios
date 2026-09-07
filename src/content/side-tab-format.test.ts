import { describe, it, expect } from 'vitest';
import { HeliosSideTab } from '@/content/side-tab';

/**
 * A page with no target-language words on it has no comprehension figure.
 * The three cards used to default independently — comprehension fell through
 * to its last value, which is 0 on a fresh page, while unique words and
 * sentence breakdown both hard-coded 100 — so the panel answered one question
 * three different ways at once.
 */
const fmt = (v: number | null | undefined) =>
  HeliosSideTab.prototype.formatPercentage.call({}, v);

describe('reporting a percentage that may not exist', () => {
  it('rounds a real measurement', () => {
    expect(fmt(0)).toBe('0%');
    expect(fmt(87)).toBe('87%');
    expect(fmt(86.4)).toBe('86%');
    expect(fmt(86.5)).toBe('87%');
    expect(fmt(100)).toBe('100%');
  });

  it('says nothing rather than guessing when there was nothing to measure', () => {
    expect(fmt(null)).toBe('n/a');
    expect(fmt(undefined)).toBe('n/a');
  });

  it('does not print NaN or Infinity at the user', () => {
    expect(fmt(NaN)).toBe('n/a');
    expect(fmt(Infinity)).toBe('n/a');
    expect(fmt(-Infinity)).toBe('n/a');
  });
});
