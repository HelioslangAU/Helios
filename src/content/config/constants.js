const DEFAULT_ACTIVATION_KEY = "Shift";
const HOVER_DELAY_MS = 10;
const ASBPLAYER_POLL_MS = 2000;
const ASBPLAYER_TOTAL_MS = 60000;

// Searchable-scan / PDF.js overlays. Their CSS often uses
// `.text-layer span { position: absolute }`. Helios stitches per-glyph
// boxes into lines for multi-character words, and forces nested word
// wraps back to inline flow (see page-processor).
const OCR_PDF_TEXT_LAYER_SELECTOR = '.text-layer, .textLayer';

function isInsideOcrPdfTextLayer(element) {
  return Boolean(element?.closest?.(OCR_PDF_TEXT_LAYER_SELECTOR));
}


