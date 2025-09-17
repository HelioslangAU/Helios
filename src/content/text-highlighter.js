class HighlightManager {
  constructor() {
    this.currentHighlight = null;
    this.isMouseOverHighlight = false;
  }

  highlightLookupText(node, start, end) {
    this.removeLookupHighlight();

    if (!node || start === end || !node.parentNode) return;

    const text = node.textContent;
    const before = text.slice(0, start);
    const target = text.slice(start, end);
    const after = text.slice(end);

    const beforeNode = document.createTextNode(before);
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'lookup-highlight';
    highlightSpan.textContent = target;
    const afterNode = document.createTextNode(after);

    const parent = node.parentNode;
    parent.insertBefore(beforeNode, node);
    parent.insertBefore(highlightSpan, node);
    parent.insertBefore(afterNode, node);
    parent.removeChild(node);

    this.currentHighlight = highlightSpan;

    // Add mouse events to the highlight
    highlightSpan.addEventListener('mouseenter', () => {
      this.isMouseOverHighlight = true;
    });

    highlightSpan.addEventListener('mouseleave', () => {
      this.isMouseOverHighlight = false;
    });
  }

  removeLookupHighlight() {
    if (this.currentHighlight && this.currentHighlight.parentNode) {
      const parent = this.currentHighlight.parentNode;
      const text = this.currentHighlight.textContent;
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, this.currentHighlight);
      parent.normalize();
      this.currentHighlight = null;
    }
  }
}