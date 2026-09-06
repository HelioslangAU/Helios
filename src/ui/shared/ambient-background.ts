/**
 * Drifting language glyphs for the ambient background.
 *
 * Pairs with `@/styles/ambient.css`, which owns the layers, the colour and the
 * drift. This module only decides which glyphs appear and where.
 */

/** One glyph from each language the extension reads, plus stylised Latin. */
const GLYPHS = [
  // Chinese
  '学', '习', '你', '好', '世', '界', '爱', '人', '中', '国',
  // Spanish
  'á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡',
  // French
  'à', 'è', 'é', 'ê', 'ç', 'œ',
  // English, stylised
  'A', 'B', 'C', 'D', 'E', 'F',
] as const;

/**
 * The outer margins only, the way the marketing site's hero places them.
 * Scattering glyphs across the whole viewport puts them behind the reading
 * column, where they stop being atmosphere and become noise.
 */
const PLACEMENTS = [
  { top: '12%', left: '4%' },
  { top: '30%', left: '90%' },
  { top: '52%', left: '6%' },
  { top: '68%', left: '92%' },
  { top: '84%', left: '10%' },
  { top: '18%', left: '84%' },
  { top: '44%', left: '95%' },
  { top: '76%', left: '2%' },
] as const;

/**
 * Fill `container` with drifting glyphs. Safe to call when the container is
 * absent — a surface that has not opted into the background simply gets none.
 *
 * Existing children are cleared first so a second call cannot stack a second
 * set of glyphs on top of the first.
 */
export function mountAmbientBackground(
  container: HTMLElement | null = document.getElementById('floating-bg'),
): void {
  if (!container) return;

  container.replaceChildren();

  for (const [i, spot] of PLACEMENTS.entries()) {
    const glyph = document.createElement('div');
    glyph.className = 'floating-char';
    glyph.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
    glyph.style.top = spot.top;
    glyph.style.left = spot.left;
    // Three sizes cycling, so the field reads as depth rather than as a row of
    // identical marks.
    glyph.style.fontSize = `${44 + (i % 3) * 14}px`;
    glyph.style.animationDuration = `${22 + i * 2}s`;
    glyph.style.animationDelay = `${i * 1.4}s`;
    container.appendChild(glyph);
  }
}
