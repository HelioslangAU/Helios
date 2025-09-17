/**
 * MultiCardPopupManager - Advanced popup orchestrator
 * Coordinates all components for multi-card popups with navigation
 */
class MultiCardPopupManager extends PopupManager {
  constructor(options) {
    super(options);
    this.originalCharacter = null;
    this.cardNavigator = new CardNavigator(this);
    this.definitionFilter = new DefinitionFilter();
    this.cardManager = new CardManager(this.dictionaryManager, this.definitionFilter);
  }

  showDictionaryPopup(x, y, character, sentence) {
    this.originalCharacter = character;
    this.capturedSentence = sentence;

    const allEntries = this.dictionaryManager.dictionary[character] || [];
    const cards = this.cardManager.groupByPronunciation(allEntries, character);

    // If only one card, use basic popup
    if (cards.length <= 1) {
      return super.showDictionaryPopup(x, y, character, sentence);
    }

    // Setup multi-card popup
    this.cardNavigator.setCards(cards);
    this.showCard(x, y, character, 0);
  }

  showCard(x, y, character, cardIndex) {
    this.hidePopup();

    const card = this.cardNavigator.currentCards[cardIndex];
    const popup = PopupPositioner.createPopupElement();

    // Determine display character and get data
    const displayCharacter = card.isCharacterCard
      ? card.character
      : this.originalCharacter || character;

    const cardId = `${displayCharacter}-${card.pinyin}`;
    const isKnown = this.vocabManager.isWordKnown(cardId);
    const frequency = this.frequencyManager?.getFrequency(displayCharacter);

    // Build content
    popup.innerHTML = PopupContentBuilder.createCardContent(
      displayCharacter,
      card,
      isKnown,
      frequency,
      this.settingsManager.settings
    );

    // Add to DOM and position
    document.body.appendChild(popup);
    const positioned = PopupPositioner.positionPopup(popup, this.highlightManager);

    if (!positioned) {
      return;
    }

    this.popup = popup;

    // Apply settings to the popup
    this.settingsManager.onPopupCreated(popup);

    // Add navigation if multiple cards
    this.cardNavigator.addNavigationDots(popup);

    // Setup basic popup events (mouse enter/leave) and navigation dots click
    popup.addEventListener("mouseenter", () => {
      this.isMouseOverPopup = true;
    });

    popup.addEventListener("mouseleave", () => {
      this.isMouseOverPopup = false;
    });

    // Navigation dots
    popup.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-dot")) {
        const index = parseInt(e.target.getAttribute("data-index"));
        this.cardNavigator.goToCard(index);
      }
    });

    // Setup events for the initial card content
    const popupContent = popup.querySelector(".popup-content");
    this.cardNavigator.setupCardContentEvents(popupContent, card);
    this.cardNavigator.setupScrolling(popup);
  }

  // Multi-card specific vocab management
  async markAllCardsAsKnown() {
    await this.vocabManager.markWordAsKnown(this.originalCharacter);

    for (const card of this.cardNavigator.currentCards) {
      const cardId = `${this.originalCharacter}-${card.pinyin}`;
      await this.vocabManager.markWordAsKnown(cardId);
    }

    const firstCard = this.cardNavigator.currentCards[0];
    this.saveToVocabList(this.originalCharacter, firstCard.pinyin, firstCard.entries[0].definition);

    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(this.originalCharacter, true);
    }
  }

  async markAllCardsAsUnknown() {
    await this.vocabManager.markWordAsUnknown(this.originalCharacter);

    for (const card of this.cardNavigator.currentCards) {
      const cardId = `${this.originalCharacter}-${card.pinyin}`;
      await this.vocabManager.markWordAsUnknown(cardId);
    }

    const firstCard = this.cardNavigator.currentCards[0];
    this.saveToVocabList(this.originalCharacter, firstCard.pinyin, firstCard.entries[0].definition);

    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(this.originalCharacter, false);
    }

    // Removed problematic highlight code that was affecting popup button styling
  }

  saveToVocabList(character, pinyin, definition) {
    const displayCharacter = this.originalCharacter || character;

    try {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
          const vocabItems = result.chineseExtensionVocabList || [];
          const cardId = `${displayCharacter}-${pinyin}`;

          const exists = vocabItems.some(item => (item.character || item.word) === cardId);
          if (!exists) {
            const newItem = {
              character: cardId,
              word: cardId,
              definition: definition.length > 100 ? definition.substring(0, 97) + "..." : definition,
              pinyin: pinyin,
              dateAdded: new Date().toISOString(),
              reviewCount: 0,
            };
            vocabItems.push(newItem);
            chrome.storage.local.set({ chineseExtensionVocabList: vocabItems });
          }
        });
      }
      this.incrementSessionCounter();
    } catch (error) {
      console.warn("Could not save to vocab list:", error);
    }
  }

  // Expose filter management methods
  addFilter(type, pattern) {
    this.definitionFilter.addFilter(type, pattern);
  }

  removeFilter(type, patternString) {
    this.definitionFilter.removeFilter(type, patternString);
  }

  getFilters() {
    return this.definitionFilter.getFilters();
  }
}