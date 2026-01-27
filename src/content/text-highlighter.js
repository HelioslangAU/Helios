class HighlightManager {
  constructor() {
    this.currentHighlight = null;
    this.isMouseOverHighlight = false;
  }

  highlightLookupText(node, start, end) {
    // Remove old highlight and reset state immediately
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

    // Use DocumentFragment for smoother DOM updates
    const fragment = document.createDocumentFragment();
    fragment.appendChild(beforeNode);
    fragment.appendChild(highlightSpan);
    fragment.appendChild(afterNode);

    parent.insertBefore(fragment, node);
    parent.removeChild(node);

    this.currentHighlight = highlightSpan;
    this.isMouseOverHighlight = true; // Set immediately when creating highlight

    // Add mouse events to the highlight
    highlightSpan.addEventListener('mouseenter', () => {
      this.isMouseOverHighlight = true;
      // Cancel any pending hide when mouse enters highlight
      if (window.popupManager && window.popupManager.hideTimeout) {
        clearTimeout(window.popupManager.hideTimeout);
        window.popupManager.hideTimeout = null;
      }
    });

    highlightSpan.addEventListener('mouseleave', () => {
      this.isMouseOverHighlight = false;
      // Trigger hide check when leaving highlighted word
      // The global mouse tracker will also detect this for redundancy
      if (window.popupManager) {
        window.popupManager.scheduleHidePopup();
      }
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
    // Reset the mouse tracking flag when highlight is removed
    this.isMouseOverHighlight = false;
  }
}