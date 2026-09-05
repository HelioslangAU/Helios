export const DEFAULT_ACTIVATION_KEY = "Shift";
export const HOVER_DELAY_MS = 10;
export const ASBPLAYER_POLL_MS = 2000;
export const ASBPLAYER_TOTAL_MS = 60000;

// Searchable-scan / PDF.js overlays. Their CSS often uses
// `.text-layer span { position: absolute }`. Helios stitches per-glyph
// boxes into lines for multi-character words, and forces nested word
// wraps back to inline flow (see page-processor).
export const OCR_PDF_TEXT_LAYER_SELECTOR = '.text-layer, .textLayer';

export function isInsideOcrPdfTextLayer(element: Element | null | undefined): boolean {
  return Boolean(element?.closest?.(OCR_PDF_TEXT_LAYER_SELECTOR));
}
