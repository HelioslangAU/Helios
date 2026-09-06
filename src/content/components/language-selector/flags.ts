/**
 * Flag artwork for the languages the extension offers.
 *
 * These replace the regional-indicator emoji pairs that used to stand in for
 * flags. Emoji flags are not a reliable icon system: Windows ships no flag
 * glyphs at all, so a pair like U+1F1E8 U+1F1F3 renders as the bare letters
 * "CN", and several Linux font stacks do the same. Drawing them ourselves is
 * the only way every user sees the same mark.
 *
 * The markup is returned as a string rather than shipped as files under
 * public/ so it works identically in the onboarding page, the options page and
 * content-script contexts, with no web-accessible resources and no extra
 * requests.
 *
 * All eight share one frame: a 24x16 viewBox (3:2), no strokes that depend on
 * an external stylesheet, no images, no fonts, no filters. Geometry follows the
 * official construction sheets, reduced to what survives at 24x16.
 */

interface FlagArtwork {
  /** Country name, used as the SVG's accessible name. */
  country: string;
  /** Shapes drawn inside the shared 24x16 frame. */
  shapes: string;
}

const FLAGS: Record<string, FlagArtwork> = {
  // Three equal vertical bands.
  fr: {
    country: 'France',
    shapes:
      '<path fill="#ce1126" d="M0 0h24v16H0z"/>' +
      '<path fill="#fff" d="M0 0h16v16H0z"/>' +
      '<path fill="#002654" d="M0 0h8v16H0z"/>'
  },

  // Three equal horizontal bands: black, red, gold.
  de: {
    country: 'Germany',
    shapes:
      '<path fill="#000" d="M0 0h24v16H0z"/>' +
      '<path fill="#d00" d="M0 5.33h24v10.67H0z"/>' +
      '<path fill="#ffce00" d="M0 10.67h24v5.33H0z"/>'
  },

  // Red-yellow-red at 1:2:1. The coat of arms sits a quarter of the way in
  // from the hoist on the real flag; at 24x16 it would be four pixels of mud,
  // so it is left off.
  es: {
    country: 'Spain',
    shapes:
      '<path fill="#ad1519" d="M0 0h24v16H0z"/>' +
      '<path fill="#fabd00" d="M0 4h24v8H0z"/>'
  },

  // Centred disc, diameter three fifths of the height.
  ja: {
    country: 'Japan',
    shapes:
      '<path fill="#fff" d="M0 0h24v16H0z"/>' +
      '<path fill="#bc002d" d="M12 3.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 1 0 0-9.6z"/>'
  },

  // Centred five-pointed star, circumscribed radius three tenths of the
  // height. Drawn as a pentagram; the non-zero fill rule makes it solid.
  vi: {
    country: 'Vietnam',
    shapes:
      '<path fill="#da251d" d="M0 0h24v16H0z"/>' +
      '<path fill="#ff0" d="M12 3.2 9.18 11.88 16.57 6.52H7.43l7.39 5.36z"/>'
  },

  // The canton is the upper-hoist quarter on a 15x10 grid. The large star is
  // centred five units in and five down with a circumscribed radius of three;
  // the four small stars have radius one and sit at (10,2), (12,4), (12,7),
  // (10,9), each turned so one point aims at the large star's centre.
  zh: {
    country: 'China',
    shapes:
      '<path fill="#ee1c25" d="M0 0h24v16H0z"/>' +
      '<path fill="#ff0" d="M4 1.6 5.41 5.94 1.72 3.26h4.56L2.59 5.94z' +
      'M8.31.86 8.18 2.38 7.4 1.07 8.8 1.67 7.31 2.01z' +
      'M10.17 2.64 9.46 3.99 9.25 2.48 10.31 3.57 8.81 3.31z' +
      'M10.35 5.33 9.15 6.26 9.57 4.8 10.09 6.23 8.83 5.38z' +
      'M8.28 6.45 8.21 7.97 7.38 6.7 8.8 7.24 7.33 7.64z"/>'
  },

  // A Union Flag, counterchanged. The white saltire runs corner to corner; the
  // red saltire is a half-width band laid against one edge of it, and which
  // edge flips between arms -- broad white uppermost at the hoist. A
  // symmetrical red X is the common mistake and is not this.
  en: {
    country: 'United Kingdom',
    shapes:
      '<path fill="#012169" d="M0 0h24v16H0z"/>' +
      '<path stroke="#fff" stroke-width="3.2" fill="none" d="M-2.4-1.6 26.4 17.6M26.4-1.6-2.4 17.6"/>' +
      '<path stroke="#c8102e" stroke-width="1.07" fill="none" d="M11.7 8.44-2.79-1.22M12.3 7.56 26.79 17.22M11.7 7.56 26.2-2.11M12.3 8.44-2.2 18.11"/>' +
      '<path stroke="#fff" stroke-width="5.33" fill="none" d="M12 0v16M0 8h24"/>' +
      '<path stroke="#c8102e" stroke-width="3.2" fill="none" d="M12 0v16M0 8h24"/>'
  },

  // Taegeuk of radius one quarter the width, its axis turned 33.69deg so it
  // runs parallel to the geon-gon diagonal, plus the four trigrams: geon at
  // the upper hoist, gon at the lower fly, li at the lower hoist, gam at the
  // upper fly. Authored on the official 144x96 grid, then scaled into frame.
  ko: {
    country: 'South Korea',
    shapes:
      '<path fill="#fff" d="M0 0h24v16H0z"/>' +
      '<g transform="translate(12 8) scale(.16667)">' +
      '<g fill="none" stroke="#000" stroke-width="4">' +
      '<path transform="rotate(33.69)" d="M-50-12v24m6 0v-24m6 0v24m76 0V1m0-2v-11m6 0v11m0 2v11m6 0V1m0-2v-11"/>' +
      '<path transform="rotate(-33.69)" d="M-50-12v24m6 0V1m0-2v-11m6 0v24m76 0V1m0-2v-11m6 0v24m6 0V1m0-2v-11"/>' +
      '</g><g transform="rotate(33.69)">' +
      '<path fill="#cd2e3a" d="M12 0a18 18 0 1 1-36 0 24 24 0 1 1 48 0"/>' +
      '<path fill="#0047a0" d="M-24 0a24 24 0 1 0 48 0A12 12 0 1 0 0 0a12 12 0 1 1-24 0"/>' +
      '</g></g>'
  }
};

/**
 * Whether flag artwork exists for a language code.
 */
export function hasFlag(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(FLAGS, code);
}

/**
 * Inline SVG markup for a language's flag, sized 24x16.
 *
 * Returns an empty string for a code we have not drawn, so callers can insert
 * the result unconditionally and get nothing rather than a broken mark.
 */
export function flagSvg(code: string): string {
  const artwork = FLAGS[code];
  if (!artwork) return '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" class="flag-svg" viewBox="0 0 24 16"' +
    ' width="24" height="16" role="img">' +
    `<title>${artwork.country}</title>${artwork.shapes}</svg>`
  );
}
