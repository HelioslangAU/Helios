/**
 * CardNavigator - Handles multi-card navigation and transitions
 * Manages card switching, scrolling, and navigation dots
 */
class CardNavigator {
  constructor(popupManager) {
    this.popupManager = popupManager;
    this.currentCards = [];
    this.currentCardIndex = 0;
  }

  setCards(cards) {
    this.currentCards = cards;
    this.currentCardIndex = 0;
  }

  setupScrolling(popup) {
    if (this.currentCards.length <= 1) return;

    popup.addEventListener("wheel", (e) => {
      const definitionsScroll = e.target.closest(".definitions-scroll");
      if (definitionsScroll) {
        const scrollTop = definitionsScroll.scrollTop;
        const scrollHeight = definitionsScroll.scrollHeight;
        const clientHeight = definitionsScroll.clientHeight;
        const isScrolledToTop = scrollTop <= 2;
        const isScrolledToBottom = Math.abs(scrollHeight - clientHeight - scrollTop) <= 2;

        if (e.deltaY > 0 && isScrolledToBottom) {
          e.preventDefault();
          if (this.currentCardIndex < this.currentCards.length - 1) {
            this.goToCard(this.currentCardIndex + 1);
          }
          return;
        } else if (e.deltaY < 0 && isScrolledToTop) {
          e.preventDefault();
          if (this.currentCardIndex > 0) {
            this.goToCard(this.currentCardIndex - 1);
          }
          return;
        }
        return;
      }

      e.preventDefault();
      const delta = e.deltaY;
      if (Math.abs(delta) < 20) return;

      if (delta > 0 && this.currentCardIndex < this.currentCards.length - 1) {
        this.goToCard(this.currentCardIndex + 1);
      } else if (delta < 0 && this.currentCardIndex > 0) {
        this.goToCard(this.currentCardIndex - 1);
      }
    }, { passive: false });
  }

  goToCard(index) {
    if (index < 0 || index >= this.currentCards.length) return;

    this.currentCardIndex = index;
    const newCard = this.currentCards[index];
    const popup = this.popupManager.popup;

    const popupContent = popup.querySelector(".popup-content");
    popupContent.classList.add("sliding-out");

    setTimeout(() => {
      // Get the display character for this card
      const displayCharacter = newCard.isCharacterCard
        ? newCard.character
        : this.popupManager.originalCharacter;

      // Update currentCharacter in popup manager for hotkey support
      this.popupManager.currentCharacter = displayCharacter;

      const isKnown = this.popupManager.vocabManager.isWordKnown(displayCharacter);
      const isIgnored = this.popupManager.vocabManager.isWordIgnored(displayCharacter);
      const frequency = this.popupManager.frequencyManager?.getFrequency(displayCharacter);

      // Clear old content and add new content
      const currentLanguage = this.popupManager.languageRegistry.getCurrentLanguage();
      popupContent.innerHTML = PopupContentBuilder.createCardContentInner(
        displayCharacter,
        newCard,
        isKnown,
        isIgnored,
        frequency,
        this.popupManager.settingsManager.settings,
        currentLanguage
      );

      popupContent.classList.remove("sliding-out");
      popupContent.classList.add("sliding-in");

      // Setup event listeners for the NEW content (only on the new popupContent)
      this.updateNavigationDots();

      // Re-setup event listeners for the new content
      this.setupCardEvents(popup, newCard);

      setTimeout(() => {
        popupContent.classList.remove("sliding-in");
      }, 200);
    }, 100);
  }

  updateNavigationDots() {
    const popup = this.popupManager.popup;
    const dots = popup.querySelectorAll(".nav-dot");
    const counter = popup.querySelector(".card-counter");

    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === this.currentCardIndex);
    });

    if (counter) {
      counter.textContent = `${this.currentCardIndex + 1} of ${this.currentCards.length}`;
    }
  }

  addNavigationDots(popup) {
    if (this.currentCards.length <= 1) return;

    const dotsHtml = PopupContentBuilder.createNavigationDots(this.currentCards, this.currentCardIndex);
    if (dotsHtml) {
      popup.insertAdjacentHTML('beforeend', dotsHtml);
    }
  }

  setupCardEvents(popup, currentCard) {
    const displayCharacter = currentCard.isCharacterCard
      ? currentCard.character
      : this.popupManager.originalCharacter;

    const managers = {
      vocabManager: this.popupManager.vocabManager,
      ankiManager: this.popupManager.ankiManager,
      pronunciationManager: this.popupManager.pronunciationManager,
      frequencyManager: this.popupManager.frequencyManager,
      dictionaryManager: this.popupManager.dictionaryManager,
      popupManager: this.popupManager,
      settingsManager: this.popupManager.settingsManager
    };

    // Setup events for the current card content
    PopupEventHandler.setupEvents(popup, displayCharacter, managers, { 
      isMultiCard: true,  // Enable multi-card mode for proper handling
      currentCard: currentCard, 
      cardNavigator: this 
    });
  }

}