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

      const cardId = `${displayCharacter}-${newCard.pinyin}`;
      const isKnown = this.popupManager.vocabManager.isWordKnown(cardId);
      const frequency = this.popupManager.frequencyManager?.getFrequency(displayCharacter);

      // Clear old content and add new content
      popupContent.innerHTML = PopupContentBuilder.createCardContentInner(
        displayCharacter,
        newCard,
        isKnown,
        frequency,
        this.popupManager.settingsManager.settings
      );

      popupContent.classList.remove("sliding-out");
      popupContent.classList.add("sliding-in");

      // Setup event listeners for the NEW content (only on the new popupContent)
      this.setupCardContentEvents(popupContent, newCard);
      this.updateNavigationDots();

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

  setupCardContentEvents(popupContent, currentCard) {
    // Mark known/unknown buttons - special multi-card handling
    const markKnownBtn = popupContent.querySelector(".mark-known-btn");
    const markUnknownBtn = popupContent.querySelector(".mark-unknown-btn");

    if (markKnownBtn) {
      markKnownBtn.addEventListener("click", async () => {
        await this.popupManager.markAllCardsAsKnown();
        this.popupManager.hidePopup();
      });
    }

    if (markUnknownBtn) {
      markUnknownBtn.addEventListener("click", async () => {
        await this.popupManager.markAllCardsAsUnknown();
        this.popupManager.hidePopup();
      });
    }

    // Anki button
    const ankiBtn = popupContent.querySelector(".anki-btn");
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        const displayCharacter = currentCard.isCharacterCard
          ? currentCard.character
          : this.popupManager.originalCharacter;

        const wordData = {
          character: displayCharacter,
          pinyin: currentCard.pinyin,
          definition: currentCard.entries.map(e => e.definition).join('; '),
          sentence: this.popupManager.capturedSentence,
          traditional: currentCard.entries[0].traditional,
          simplified: currentCard.entries[0].simplified,
        };

        await this.popupManager.ankiManager.createCardFromPopup(
          wordData,
          ankiBtn,
          this.popupManager.frequencyManager
        );
      });
    }

    // Pronunciation buttons
    const pronunciationBtns = popupContent.querySelectorAll(".pronunciation-btn");
    pronunciationBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = btn.getAttribute("data-word");
        const pinyin = btn.getAttribute("data-pinyin");
        await PopupEventHandler.handlePronunciation(btn, word, pinyin, this.popupManager.pronunciationManager);
      });
    });
  }
}