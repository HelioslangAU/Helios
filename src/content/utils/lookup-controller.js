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
  }

  onPointerMove = (event) => {
    if (!this.activation.isActive()) return;

    this.lastPointerEvent = event;

    if (this.popup && this.popup.isMouseOverPopup) return;

    const characterInfo = this.pageProcessor.getCharacterAtPosition(event);
    if (characterInfo && characterInfo.word) {
      clearTimeout(this.hideTimeout);

      if (
        this.currentWord === characterInfo.word &&
        this.highlightManager.currentHighlight &&
        this.highlightManager.currentHighlight.textContent === characterInfo.word
      ) {
        return;
      }

      this.highlightManager.removeLookupHighlight();

      const newCharacterInfo = this.pageProcessor.getCharacterAtPosition(event);
      if (!newCharacterInfo) {
        this.popup.scheduleHidePopup?.();
        return;
      }

      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        const sentence = this.pageProcessor.getSentenceContextFromNode(
          newCharacterInfo.textNode,
          newCharacterInfo.word
        );

        this.highlightManager.highlightLookupText(
          newCharacterInfo.textNode,
          newCharacterInfo.start,
          newCharacterInfo.end
        );

        this.popup.showDictionaryPopup(
          this.highlightManager.currentHighlight.getBoundingClientRect().left,
          this.highlightManager.currentHighlight.getBoundingClientRect().bottom,
          newCharacterInfo.word,
          sentence
        );
      }, 10);

      this.currentWord = newCharacterInfo.word;
    } else {
      this.popup.scheduleHidePopup?.();
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


