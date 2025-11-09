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
    this.cardManager = new CardManager(this.dictionaryManager, this.definitionFilter, this.languageRegistry);
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
    // CRITICAL: Remove ALL existing popups immediately (synchronously)
    this.hidePopup();
    this.removeAllPopupsFromPage();

    const card = this.cardNavigator.currentCards[cardIndex];
    const popup = PopupPositioner.createPopupElement(this.settingsManager.settings.popupFontSize);

    // Determine display character and get data
    const displayCharacter = card.isCharacterCard
      ? card.character
      : this.originalCharacter || character;

    const isKnown = this.vocabManager.isWordKnown(displayCharacter);
    const isIgnored = this.vocabManager.isWordIgnored(displayCharacter);
    const frequency = this.frequencyManager?.getFrequency(displayCharacter);


    // Build content
    const currentLanguage = this.languageRegistry.getCurrentLanguage();
    popup.innerHTML = PopupContentBuilder.createCardContent(
      displayCharacter,
      card,
      isKnown,
      isIgnored,
      frequency,
      this.settingsManager.settings,
      currentLanguage
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

    // Remove creating class to enable transitions after initial setup
    popup.classList.remove('creating');

    // Track word lookup for recent vocabulary
    if (card && card.entries && card.entries.length > 0) {
      this.vocabManager.trackWordLookup(displayCharacter, card.entries[0]);
    }

    // Add navigation if multiple cards
    this.cardNavigator.addNavigationDots(popup);

    // Setup all popup events using unified event handler
    const managers = {
      vocabManager: this.vocabManager,
      ankiManager: this.ankiManager,
      pronunciationManager: this.pronunciationManager,
      frequencyManager: this.frequencyManager,
      dictionaryManager: this.dictionaryManager,
      popupManager: this,
      settingsManager: this.settingsManager
    };

    PopupEventHandler.setupEvents(popup, character, managers, {
      isMultiCard: true,  // Enable multi-card mode for proper handling
      currentCard: card, 
      cardNavigator: this.cardNavigator 
    });

    // Setup events for the initial card content
    this.cardNavigator.setupScrolling(popup);
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