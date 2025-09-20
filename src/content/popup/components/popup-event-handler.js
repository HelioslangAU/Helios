/**
 * PopupEventHandler - Manages all popup event listeners
 * Centralizes event handling for clean separation of concerns
 */
class PopupEventHandler {
  static setupEvents(popup, character, managers, options = {}) {
    const { isMultiCard = false, currentCard = null, cardNavigator = null } = options;

    // Common mouse events for hiding logic
    this.setupMouseEvents(popup, managers);

    // Mark known/ignore/unknown buttons - unified three-state cycling approach
    this.setupMarkButtonEvents(popup, character, managers, isMultiCard, currentCard);

    // Anki button
    this.setupAnkiEvents(popup, character, managers, isMultiCard, currentCard);

    // Pronunciation buttons
    this.setupPronunciationEvents(popup, managers);

    // Multi-card specific events
    if (isMultiCard && cardNavigator) {
      this.setupNavigationEvents(popup, cardNavigator);
    }
  }

  static setupMouseEvents(popup, managers) {
    popup.addEventListener("mouseenter", () => {
      managers.popupManager.isMouseOverPopup = true;
    });

    popup.addEventListener("mouseleave", () => {
      managers.popupManager.isMouseOverPopup = false;
    });
  }

  static setupMarkButtonEvents(popup, character, managers, isMultiCard, currentCard = null) {
    const markButton = popup.querySelector(".mark-known-btn, .mark-ignore-btn, .mark-unknown-btn");

    if (markButton) {
      markButton.addEventListener("click", async () => {
        const currentState = this.getCurrentMarkState(markButton);
        const nextState = this.getNextMarkState(currentState);

        // Execute the appropriate action based on current state
        await this.executeMarkAction(character, managers, nextState, isMultiCard, currentCard);
        
        // Update button appearance
        this.updateMarkButton(markButton, nextState);

        // Only hide popup if not in persistent mode
        if (managers.settingsManager && !managers.settingsManager.shouldPreventAutoHide()) {
          managers.popupManager.hidePopup();
        }
      });
    }
  }

  static setupAnkiEvents(popup, character, managers, isMultiCard, currentCard) {
    const ankiBtn = popup.querySelector(".anki-btn");
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        if (isMultiCard && currentCard) {
          await this.handleMultiCardAnkiAdd(currentCard, managers);
        } else {
          await this.handleAnkiAdd(character, managers);
        }
      });
    }
  }

  static setupPronunciationEvents(popup, managers) {
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
  }

  static setupNavigationEvents(popup, cardNavigator) {
    popup.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-dot")) {
        const index = parseInt(e.target.getAttribute("data-index"));
        cardNavigator.goToCard(index);
      }
    });
  }

  static getCurrentMarkState(button) {
    if (button.classList.contains("mark-ignore-btn")) return "known";
    if (button.classList.contains("mark-unknown-btn")) return "ignored";
    if (button.classList.contains("mark-known-btn")) return "unknown";
    return "unknown";
  }

  static getNextMarkState(currentState) {
    const stateCycle = { unknown: "known", known: "ignored", ignored: "unknown" };
    return stateCycle[currentState] || "unknown";
  }

  static async executeMarkAction(character, managers, targetState, isMultiCard, currentCard = null) {
    let targetCharacter;
    
    if (isMultiCard && currentCard) {
      // For multi-card mode, use the card-specific character
      targetCharacter = currentCard.isCharacterCard 
        ? currentCard.character 
        : managers.popupManager.originalCharacter;
    } else {
      // For single card mode, use the original character
      targetCharacter = managers.popupManager.originalCharacter || character;
    }
    
    switch (targetState) {
      case "known":
        await this.handleMarkKnown(targetCharacter);
        break;
      case "ignored":
        await this.handleMarkIgnored(targetCharacter);
        break;
      case "unknown":
        await this.handleMarkUnknown(targetCharacter);
        break;
      
    }
  }

  static async handleMarkKnown(character) {
    if (typeof updateKnownWordsCounter === "function") {
      updateKnownWordsCounter();
    }
    await window.vocabManager.markWordAsUnignored(character);
    await window.vocabManager.markWordAsKnown(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, true);
    }
  }

  static async handleMarkUnknown(character) {
    if (typeof updateKnownWordsCounter === "function") {
      updateKnownWordsCounter();
    }
    await window.vocabManager.markWordAsUnignored(character);
    await window.vocabManager.markWordAsUnknown(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, false);
    }
  }

  static async handleMarkIgnored(character) {
    if (typeof updateKnownWordsCounter === "function") {
      updateKnownWordsCounter();
    }
    await window.vocabManager.markWordAsUnknown(character);
    await window.vocabManager.markWordAsIgnored(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, true);
    }
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

  static updateMarkButton(button, state) {
    // Clear all state classes
    button.classList.remove("mark-known-btn", "mark-ignore-btn", "mark-unknown-btn");
    
    switch (state) {
      case "known":
        button.textContent = "Mark Ignore";
        button.className = "mark-ignore-btn";
        break;
      case "ignored":
        button.textContent = "Mark Unknown";
        button.className = "mark-unknown-btn";
        break;
      case "unknown":
      default:
        button.textContent = "Mark Known";
        button.className = "mark-known-btn";
        break;
    }
  }
}