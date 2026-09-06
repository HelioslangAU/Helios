import { describe, it, expect, beforeEach } from 'vitest';
import { shouldCollapseOnClick } from '@/content/side-tab-collapse';

const pick = (sel: string) => document.querySelector(sel);

describe('collapsing the expanded side tab on click', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="full">
        <h2 id="heading">Vocabulary</h2>
        <span id="count">412</span>
        <button id="settings"><span id="glyph">gear</span></button>
        <label id="toggle"><span id="toggle-text">Pinyin</span><input id="switch" type="checkbox"></label>
        <a id="link" href="#">docs</a>
        <select id="menu"><option>a</option></select>
      </div>`;
  });

  it('collapses on the panel background', () => {
    expect(shouldCollapseOnClick({ target: pick('#full') })).toBe(true);
  });

  it('collapses on a heading or a figure, which are not controls', () => {
    expect(shouldCollapseOnClick({ target: pick('#heading') })).toBe(true);
    expect(shouldCollapseOnClick({ target: pick('#count') })).toBe(true);
  });

  it('does not collapse on a button, or on something inside one', () => {
    expect(shouldCollapseOnClick({ target: pick('#settings') })).toBe(false);
    expect(shouldCollapseOnClick({ target: pick('#glyph') })).toBe(false);
  });

  it('does not collapse on a toggle, its input, or the text inside its label', () => {
    expect(shouldCollapseOnClick({ target: pick('#toggle') })).toBe(false);
    expect(shouldCollapseOnClick({ target: pick('#switch') })).toBe(false);
    expect(shouldCollapseOnClick({ target: pick('#toggle-text') })).toBe(false);
  });

  it('does not collapse on a link or a select', () => {
    expect(shouldCollapseOnClick({ target: pick('#link') })).toBe(false);
    expect(shouldCollapseOnClick({ target: pick('#menu') })).toBe(false);
  });

  it('does not collapse when the click ended a text selection', () => {
    expect(shouldCollapseOnClick({ target: pick('#count'), selection: '412' })).toBe(false);
  });

  it('ignores a selection that is only whitespace', () => {
    expect(shouldCollapseOnClick({ target: pick('#count'), selection: '  \n ' })).toBe(true);
  });

  it('is safe when the click had no target', () => {
    expect(shouldCollapseOnClick({ target: null })).toBe(false);
  });
});
