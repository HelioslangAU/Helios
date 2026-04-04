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

    // Determine vertical position - prefer below, but position above if it goes off-screen
    let posY = highlightRect.bottom;
    const spaceBelow = window.innerHeight - highlightRect.bottom;
    const spaceAbove = highlightRect.top;

    // If popup would go off bottom of screen and there's more space above
    if (posY + popupRect.height > window.innerHeight && spaceAbove > spaceBelow) {
      // Position above the word
      posY = highlightRect.top - popupRect.height;
      popup.style.top = `${Math.max(10, posY)}px`;
      popup.style.bottom = 'auto';
    } else {
      // Position below the word (default)
      popup.style.top = `${posY}px`;
      popup.style.bottom = 'auto';

      // If still goes off screen, clamp to viewport
      if (posY + popupRect.height > window.innerHeight) {
        popup.style.top = `${window.innerHeight - popupRect.height - 10}px`;
      }
    }

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

  static createPopupElement(fontSize = 'medium') {
    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup creating";
    popup.style.position = "fixed";
    popup.style.zIndex = "2147483647";
    popup.style.visibility = "hidden";

    // Apply size class immediately to prevent resizing after DOM insertion
    popup.classList.add(`size-${fontSize}`);

    return popup;
  }
}