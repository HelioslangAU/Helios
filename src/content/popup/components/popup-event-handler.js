/**
 * PopupEventHandler - Manages all popup event listeners
 * Centralizes event handling for clean separation of concerns
 */
class PopupEventHandler {
  static setupBasicEvents(popup, character, managers) {
    const { vocabManager, ankiManager, pronunciationManager, frequencyManager } = managers;

    // Mouse events for hiding logic
    popup.addEventListener("mouseenter", () => {
      managers.popupManager.isMouseOverPopup = true;
    });

    popup.addEventListener("mouseleave", () => {
      managers.popupManager.isMouseOverPopup = false;
    });

    // Mark known/unknown buttons - unified toggle approach
    const markButton = popup.querySelector(".mark-known-btn, .mark-unknown-btn");

    if (markButton) {
      markButton.addEventListener("click", async () => {
        const isCurrentlyKnown = markButton.classList.contains("mark-unknown-btn");

        if (isCurrentlyKnown) {
          // Currently known, mark as unknown
          await this.handleMarkUnknown(character, vocabManager, managers);
          this.updateMarkButton(markButton, false); // Now unknown, so show "Mark Known"
        } else {
          // Currently unknown, mark as known
          await this.handleMarkKnown(character, vocabManager, managers);
          this.updateMarkButton(markButton, true); // Now known, so show "Mark Unknown"
        }

        // Only hide popup if not in persistent mode
        if (managers.settingsManager && !managers.settingsManager.shouldPreventAutoHide()) {
          managers.popupManager.hidePopup();
        }
      });
    }

    // Anki button
    const ankiBtn = popup.querySelector(".anki-btn");
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        await this.handleAnkiAdd(character, managers);
      });
    }

    // Pronunciation buttons
    const pronunciationBtns = popup.querySelectorAll(".pronunciation-btn");
    pronunciationBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = btn.getAttribute("data-word");
        const pinyin = btn.getAttribute("data-pinyin");
        await this.handlePronunciation(btn, word, pinyin, pronunciationManager);
      });
    });
  }

  static setupCardEvents(popup, originalCharacter, currentCard, managers) {
    // Mouse events for hiding logic
    popup.addEventListener("mouseenter", () => {
      managers.popupManager.isMouseOverPopup = true;
    });

    popup.addEventListener("mouseleave", () => {
      managers.popupManager.isMouseOverPopup = false;
    });

    // Mark known/unknown buttons - unified toggle approach for multi-card
    const markButton = popup.querySelector(".mark-known-btn, .mark-unknown-btn");

    if (markButton) {
      markButton.addEventListener("click", async () => {
        const isCurrentlyKnown = markButton.classList.contains("mark-unknown-btn");

        if (isCurrentlyKnown) {
          // Currently known, mark as unknown
          await managers.popupManager.markAllCardsAsUnknown();
          this.updateMarkButton(markButton, false); // Now unknown, so show "Mark Known"
        } else {
          // Currently unknown, mark as known
          await managers.popupManager.markAllCardsAsKnown();
          this.updateMarkButton(markButton, true); // Now known, so show "Mark Unknown"
        }

        // Only hide popup if not in persistent mode
        if (managers.settingsManager && !managers.settingsManager.shouldPreventAutoHide()) {
          managers.popupManager.hidePopup();
        }
      });
    }

    // Anki button
    const ankiBtn = popup.querySelector(".anki-btn");
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        await this.handleMultiCardAnkiAdd(currentCard, managers);
      });
    }

    // Pronunciation buttons
    const { pronunciationManager } = managers;
    const pronunciationBtns = popup.querySelectorAll(".pronunciation-btn");
    pronunciationBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = btn.getAttribute("data-word");
        const pinyin = btn.getAttribute("data-pinyin");
        await this.handlePronunciation(btn, word, pinyin, pronunciationManager);
      });
    });

    // Navigation dots
    popup.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-dot")) {
        const index = parseInt(e.target.getAttribute("data-index"));
        managers.cardNavigator.goToCard(index);
      }
    });
  }

  static async handleMarkKnown(character, vocabManager, managers) {
    if (typeof updateKnownWordsCounter === "function") {
      updateKnownWordsCounter();
    }
    await vocabManager.markWordAsKnown(character);
    managers.popupManager.saveToVocabList(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, true);
    }
  }

  static async handleMarkUnknown(character, vocabManager, managers) {
    if (typeof updateKnownWordsCounter === "function") {
      updateKnownWordsCounter();
    }
    await vocabManager.markWordAsUnknown(character);
    managers.popupManager.saveToVocabList(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, false);
    }
    // Removed problematic highlight code that was affecting popup button styling
  }

  static async handleAnkiAdd(character, managers) {
    const { dictionaryManager, ankiManager, frequencyManager } = managers;
    const matches = dictionaryManager.dictionary[character] || [];
    const wordData = {
      character: character,
      pinyin: matches.length > 0 ? matches[0].pinyin : '',
      definition: matches.length > 0 ? matches[0].definition : 'No definition',
      sentence: managers.popupManager.capturedSentence,
      traditional: matches.length > 0 ? matches[0].traditional : character,
      simplified: matches.length > 0 ? matches[0].simplified : character,
    };

    const ankiBtn = managers.popupManager.popup.querySelector(".anki-btn");
    await ankiManager.createCardFromPopup(wordData, ankiBtn, frequencyManager);
  }

  static async handleMultiCardAnkiAdd(currentCard, managers) {
    const { ankiManager, frequencyManager } = managers;
    const displayCharacter = currentCard.isCharacterCard
      ? currentCard.character
      : managers.popupManager.originalCharacter;

    const wordData = {
      character: displayCharacter,
      pinyin: currentCard.pinyin,
      definition: currentCard.entries.map(e => e.definition).join('; '),
      sentence: managers.popupManager.capturedSentence,
      traditional: currentCard.entries[0].traditional,
      simplified: currentCard.entries[0].simplified,
    };

    const ankiBtn = managers.popupManager.popup.querySelector(".anki-btn");
    await ankiManager.createCardFromPopup(wordData, ankiBtn, frequencyManager);
  }

  static async handlePronunciation(button, word, pinyin, pronunciationManager) {
    try {
      button.classList.add("loading");
      button.disabled = true;
      button.title = "Loading audio...";

      const ttsText = button.getAttribute("data-tts-text") || word;
      const success = await pronunciationManager.playPronunciation(ttsText);

      if (success) {
        button.classList.remove("loading");
        button.classList.add("playing");
        button.title = "Playing...";
        setTimeout(() => {
          button.classList.remove("playing");
          button.disabled = false;
          button.title = "Play pronunciation";
        }, 2000);
      } else {
        button.classList.remove("loading");
        button.classList.add("error");
        button.title = "Audio not available";
        setTimeout(() => {
          button.classList.remove("error");
          button.disabled = false;
          button.title = "Play pronunciation";
        }, 1500);
      }
    } catch (error) {
      console.error("🔊 Error in pronunciation handler:", error);
      button.classList.remove("loading");
      button.classList.add("error");
      button.title = "Error playing audio";
      setTimeout(() => {
        button.classList.remove("error");
        button.disabled = false;
        button.title = "Play pronunciation";
      }, 1500);
    }
  }

  static updateMarkButton(button, isNowKnown) {
    if (isNowKnown) {
      // Word is now known, so show "Mark Unknown" button
      button.textContent = "Mark Unknown";
      button.className = "mark-unknown-btn";
    } else {
      // Word is now unknown, so show "Mark Known" button
      button.textContent = "Mark Known";
      button.className = "mark-known-btn";
    }
  }
}