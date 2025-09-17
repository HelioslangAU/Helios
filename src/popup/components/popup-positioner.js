/**
 * PopupPositioner - Handles popup positioning logic
 * Responsible for calculating optimal popup placement on screen
 */
class PopupPositioner {
  static positionPopup(popup, highlightManager) {
    const popupRect = popup.getBoundingClientRect();
    const highlight = highlightManager.currentHighlight;

    if (!highlight) {
      popup.remove();
      return false;
    }

    const highlightRect = highlight.getBoundingClientRect();

    // Always position popup below the highlighted text
    popup.style.top = `${highlightRect.bottom}px`;
    popup.style.bottom = 'auto';

    // Determine horizontal position
    let posX = highlightRect.left;

    // Adjust if it goes off-screen horizontally
    if (posX + popupRect.width > window.innerWidth) {
      posX = window.innerWidth - popupRect.width - 10;
    }
    if (posX < 0) {
      posX = 10;
    }

    popup.style.left = `${posX}px`;
    popup.style.visibility = "visible";

    return true;
  }

  static createPopupElement() {
    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup";
    popup.style.position = "fixed";
    popup.style.zIndex = "2147483647";
    popup.style.visibility = "hidden";
    return popup;
  }
}