// Minimal DOMTextScanner for CJK word scanning
class DOMTextScanner {
  constructor(node, offset) {
    this._node = node;
    this._offset = offset;
    this._content = '';
    this._remainder = 0;
  }

  // Scans forward for a given length (number of characters)
  seek(length) {
    if (length === 0) return this;
    let node = this._node;
    let offset = this._offset;
    let remaining = length;
    let content = '';

    while (node && remaining > 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        while (offset < text.length && remaining > 0) {
          content += text[offset];
          offset++;
          remaining--;
        }
        if (remaining === 0) break;
        // Move to next node
        node = node.nextSibling;
        offset = 0;
      } else {
        node = node.firstChild || node.nextSibling;
        offset = 0;
      }
    }
    this._content = content;
    this._remainder = remaining;
    return this;
  }

  get content() {
    return this._content;
  }
}