import { services } from '@/content/services';

export class HighlightManager {
  currentHighlight: HTMLElement | null;
  currentHighlightGroup: HTMLElement[];
  highlightMode: 'wrap' | 'class' | null;
  isMouseOverHighlight: boolean;

  constructor() {
    this.currentHighlight = null;
    this.currentHighlightGroup = [];
    this.highlightMode = null; // 'wrap' | 'class'
    this.isMouseOverHighlight = false;
  }

  highlightLookupText(
    node: Text | null,
    start: number,
    end: number,
    extraElements: Array<HTMLElement | null | undefined> = []
  ): void {
    // Remove old highlight and reset state immediately
    this.removeLookupHighlight();

    const glyphGroup = (extraElements || []).filter(Boolean) as HTMLElement[];
    if (glyphGroup.length > 0) {
      this._highlightElements(glyphGroup);
      return;
    }

    if (!node || start === end || !node.parentNode) return;

    const text = node.textContent!;
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

    this.highlightMode = 'wrap';
    this.currentHighlight = highlightSpan;
    this.currentHighlightGroup = [highlightSpan];
    this.isMouseOverHighlight = true; // Set immediately when creating highlight
    this._bindHighlightHover(highlightSpan);
  }

  _highlightElements(elements: HTMLElement[]): void {
    this.highlightMode = 'class';
    this.currentHighlightGroup = [];
    for (const el of elements) {
      el.classList.add('lookup-highlight');
      this.currentHighlightGroup.push(el);
      this._bindHighlightHover(el);
    }
    this.currentHighlight = this.currentHighlightGroup[0] || null;
    this.isMouseOverHighlight = true;
  }

  _bindHighlightHover(el: HTMLElement): void {
    el.addEventListener('mouseenter', this._onHighlightEnter);
    el.addEventListener('mouseleave', this._onHighlightLeave);
  }

  _onHighlightEnter = (): void => {
    this.isMouseOverHighlight = true;
    if (services.popupManager?.hideTimeout) {
      clearTimeout(services.popupManager.hideTimeout);
      services.popupManager.hideTimeout = null;
    }
  };

  _onHighlightLeave = (): void => {
    this.isMouseOverHighlight = false;
    services.popupManager?.scheduleHidePopup();
  };

  getHighlightText(): string {
    if (this.currentHighlightGroup.length > 0) {
      return this.currentHighlightGroup.map((el) => el.textContent).join('');
    }
    return this.currentHighlight?.textContent || '';
  }

  getHighlightRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } | null {
    const elements = this.currentHighlightGroup.length
      ? this.currentHighlightGroup
      : this.currentHighlight
        ? [this.currentHighlight]
        : [];
    if (elements.length === 0) return null;

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  removeLookupHighlight(): void {
    if (this.highlightMode === 'class') {
      for (const el of this.currentHighlightGroup) {
        el.removeEventListener('mouseenter', this._onHighlightEnter);
        el.removeEventListener('mouseleave', this._onHighlightLeave);
        el.classList.remove('lookup-highlight');
      }
    } else if (this.currentHighlight?.parentNode) {
      const parent = this.currentHighlight.parentNode;
      const textNode = document.createTextNode(this.currentHighlight.textContent!);
      parent.replaceChild(textNode, this.currentHighlight);
      parent.normalize();
    }

    this.currentHighlight = null;
    this.currentHighlightGroup = [];
    this.highlightMode = null;
    this.isMouseOverHighlight = false;
  }
}
