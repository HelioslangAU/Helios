class LookupController {
  constructor({ pageProcessor, highlightManager, popup, activation }) {
    this.pageProcessor = pageProcessor;
    this.highlightManager = highlightManager;
    this.popup = popup;
    this.activation = activation;

    this.hoverTimeout = null;
    this.hideTimeout = null;
    this.currentWord = null;
    this.lastPointerEvent = null;
    this.isCurrentWordSubtitle = false; // Track if current word is from subtitle
  }

  onPointerMove = async (event) => {
    // Video subtitle words (data-subtitle-word="true") don't require shift key
    // Check the target AND walk up the DOM tree to find subtitle word spans
    let isSubtitleWord = false;
    let checkElement = event.target;

    // Walk up the DOM tree (max 5 levels) to find data-subtitle-word attribute
    for (let i = 0; i < 5 && checkElement; i++) {
      if (checkElement.getAttribute?.('data-subtitle-word') === 'true') {
        isSubtitleWord = true;
        break;
      }
      checkElement = checkElement.parentElement;
    }

    // Skip if mouse is over popup
    if (this.popup?.isMouseOverPopup) return;

    // Remember last pointer event even before activation so we can trigger later
    this.lastPointerEvent = event;

    // Skip if not activated and not on a subtitle word
    if (!isSubtitleWord && !this.activation.isActive()) return;

    const characterInfo = this.pageProcessor.getCharacterAtPosition(event);

    if (characterInfo?.word) {
      // Skip if already showing this exact word (prevent unnecessary re-renders)
      if (this.currentWord === characterInfo.word &&
          this.highlightManager.currentHighlight?.textContent === characterInfo.word) {
        return;
      }

      // Cancel any pending operations immediately
      clearTimeout(this.hoverTimeout);
      clearTimeout(this.hideTimeout);

      // Remove old highlight
      this.highlightManager.removeLookupHighlight();

      // Re-check position after removing old highlight (DOM might have changed)
      const newCharacterInfo = this.pageProcessor.getCharacterAtPosition(event);
      if (!newCharacterInfo) {
        this.popup.scheduleHidePopup?.();
        this.currentWord = null;
        this.isCurrentWordSubtitle = false;
        return;
      }

      // Get context
      const sentence = this.pageProcessor.getSentenceContextFromNode(
        newCharacterInfo.textNode,
        newCharacterInfo.word
      );

      // Create highlight
      this.highlightManager.highlightLookupText(
        newCharacterInfo.textNode,
        newCharacterInfo.start,
        newCharacterInfo.end
      );

      // Show popup only if highlight was successfully created
      if (this.highlightManager.currentHighlight) {
        const rect = this.highlightManager.currentHighlight.getBoundingClientRect();
        await this.popup.showDictionaryPopup(rect.left, rect.bottom, newCharacterInfo.word, sentence);
        // Set subtitle word flag AFTER showing popup (showDictionaryPopup resets it)
        this.popup.isSubtitleWordPopup = isSubtitleWord;
      }

      this.currentWord = newCharacterInfo.word;
      this.isCurrentWordSubtitle = isSubtitleWord; // Track subtitle word status
    } else {
      // Mouse moved off word - schedule hide
      // Subtitle words will always hide regardless of persistence setting
      if (this.currentWord !== null) {
        this.popup.scheduleHidePopup?.();
      }
      this.currentWord = null;
      this.isCurrentWordSubtitle = false;
    }
  };

  onDeactivate = () => {
    clearTimeout(this.hoverTimeout);
    if (this.popup && this.popup.settingsManager && !this.popup.settingsManager.shouldPreventKeyUpHide()) {
      this.popup.hidePopup?.();
      this.highlightManager.removeLookupHighlight();
    }
  };

  onClick = (event) => {
    this.popup.hidePopup?.(event);
    this.highlightManager.removeLookupHighlight();
  };
}


