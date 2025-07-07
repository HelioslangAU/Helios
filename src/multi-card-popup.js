class MultiCardPopupManager extends PopupManager {
  constructor(options) {
    super(options);
    this.currentCards = [];
    this.currentCardIndex = 0;
    this.originalCharacter = null; // FIX 1: Store original character to prevent switching
  }

  showDictionaryPopup(x, y, character) {
    // FIX 1: Store the original character from the website
    this.originalCharacter = character;

    // Check if character has multiple pronunciations
    const allEntries = this.dictionaryManager.dictionary[character] || [];
    const pronunciations = this.groupByPronunciation(allEntries);

    if (pronunciations.length <= 1) {
      // Use original popup for single pronunciations
      return super.showDictionaryPopup(x, y, character);
    }

    // Multi-card: Show first card with navigation
    this.currentCards = pronunciations;
    this.currentCardIndex = 0;
    this.showCard(x, y, character, 0);
  }

  groupByPronunciation(entries) {
    const groups = {};
    entries.forEach((entry) => {
      if (!groups[entry.pinyin]) {
        groups[entry.pinyin] = [];
      }
      groups[entry.pinyin].push(entry);
    });
    return Object.entries(groups).map(([pinyin, entries]) => ({
      pinyin,
      entries,
    }));
  }

  showCard(x, y, character, cardIndex) {
    this.hidePopup();

    const card = this.currentCards[cardIndex];

    // Create popup using EXACT same method as original
    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup";

    // FIX 1: Use originalCharacter consistently throughout
    popup.innerHTML = this.createCardContent(this.originalCharacter, card);

    // Position exactly like original
    let posX = x,
      posY = y;
    if (this.highlightManager.currentHighlight) {
      const rect =
        this.highlightManager.currentHighlight.getBoundingClientRect();
      posX = rect.left;
      posY = rect.bottom + 5;
    }

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;
    popup.style.position = "fixed";
    popup.style.zIndex = "2147483647";

    document.body.appendChild(popup);
    this.popup = popup;

    // Add dots for navigation
    this.addNavigationDots();

    // Set up events exactly like original
    this.setupCardEventListeners(this.originalCharacter, card);
    this.setupScrolling();

    // Position adjustment exactly like original
    setTimeout(() => {
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.right > window.innerWidth) {
        const newX = window.innerWidth - popupRect.width - 10;
        popup.style.left = `${Math.max(10, newX)}px`;
      }
      if (popupRect.bottom > window.innerHeight) {
        let newY = posY;
        if (this.highlightManager.currentHighlight) {
          const rect =
            this.highlightManager.currentHighlight.getBoundingClientRect();
          newY = rect.top - popupRect.height - 5;
        } else {
          newY = posY - popupRect.height - 10;
        }
        newY = Math.max(10, newY);
        popup.style.top = `${newY}px`;
      }
    }, 0);
  }

  createCardContent(character, card) {
    const { pinyin, entries } = card;
    const cardId = `${character}-${pinyin}`;
    const isKnown = this.vocabManager.isWordKnown(cardId);

    // FIX 1: Always use the original character from the website, not from dictionary entries
    const displayCharacter = this.originalCharacter || character;

    const frequency = this.frequencyManager
      ? this.frequencyManager.getFrequency(displayCharacter)
      : null;

    // Create definitions exactly like original
    const definitionsHtml = entries
      .map((entry) => {
        const defs = entry.definition
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean);
        const bullets =
          defs.length > 1
            ? `<ul class="definition-list">${defs
                .map((d) => `<li>${d}</li>`)
                .join("")}</ul>`
            : `<div class="definition">${defs[0]}</div>`;
        return `<div class="definition-block">${bullets}</div>`;
      })
      .join("");

    // Pronunciation button exactly like original
    const pronunciationBtn = `
      <button 
        class="pronunciation-btn" 
        title="Play pronunciation"
        data-word="${displayCharacter}"
        data-pinyin="${pinyin}"
      >
        <span class="icon">🔊</span>
      </button>
    `;

    // EXACT same content structure as original
    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight"><ruby>${displayCharacter}<rt>${pinyin}</rt></ruby></div>
          ${pronunciationBtn}
          ${
            frequency
              ? `<div class="frequency">Frequency: ${frequency}</div>`
              : ""
          }
        </div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="${
            isKnown ? "mark-unknown-btn" : "mark-known-btn"
          }" data-card-id="${cardId}">
            ${isKnown ? "Mark Unknown" : "Mark Known"}
          </button>
        </div>
        ${this.createAnkiButton()}
      </div>
    `;
  }

  addNavigationDots() {
    if (this.currentCards.length <= 1) return;

    const dots = this.currentCards
      .map(
        (_, i) =>
          `<span class="nav-dot ${
            i === this.currentCardIndex ? "active" : ""
          }" data-index="${i}"></span>`
      )
      .join("");

    const dotsContainer = document.createElement("div");
    dotsContainer.className = "navigation-dots";
    dotsContainer.innerHTML = `
      ${dots}
      <span class="card-counter">${this.currentCardIndex + 1} of ${
      this.currentCards.length
    }</span>
    `;

    this.popup.appendChild(dotsContainer);
  }

  setupScrolling() {
    if (this.currentCards.length <= 1) return;

    this.popup.addEventListener(
      "wheel",
      (e) => {
        // Check if scrolling is happening inside the definitions area
        const definitionsScroll = e.target.closest(".definitions-scroll");
        if (definitionsScroll) {
          const scrollTop = definitionsScroll.scrollTop;
          const scrollHeight = definitionsScroll.scrollHeight;
          const clientHeight = definitionsScroll.clientHeight;

          const isScrolledToTop = scrollTop <= 2;
          const isScrolledToBottom =
            Math.abs(scrollHeight - clientHeight - scrollTop) <= 2;

          console.log("Scroll debug:", {
            scrollTop,
            scrollHeight,
            clientHeight,
            isScrolledToBottom,
            delta: e.deltaY,
          });

          // Only handle card switching if at the very top/bottom
          if (e.deltaY > 0 && isScrolledToBottom) {
            // Scrolling down at bottom - go to next card
            console.log("At bottom, going to next card");
            e.preventDefault();
            if (this.currentCardIndex < this.currentCards.length - 1) {
              this.goToCard(this.currentCardIndex + 1);
            }
            return;
          } else if (e.deltaY < 0 && isScrolledToTop) {
            // Scrolling up at top - go to previous card
            console.log("At top, going to previous card");
            e.preventDefault();
            if (this.currentCardIndex > 0) {
              this.goToCard(this.currentCardIndex - 1);
            }
            return;
          }

          // Otherwise let normal scrolling happen
          return;
        }

        // If not in definitions area, handle card navigation
        e.preventDefault();
        const delta = e.deltaY;
        if (Math.abs(delta) < 20) return; // Require meaningful scroll

        if (delta > 0 && this.currentCardIndex < this.currentCards.length - 1) {
          this.goToCard(this.currentCardIndex + 1);
        } else if (delta < 0 && this.currentCardIndex > 0) {
          this.goToCard(this.currentCardIndex - 1);
        }
      },
      { passive: false }
    );
  }

  goToCard(index) {
    if (index < 0 || index >= this.currentCards.length) return;

    const oldIndex = this.currentCardIndex;
    this.currentCardIndex = index;

    // FIX 1: Always use originalCharacter instead of getting from entries
    const character = this.originalCharacter;
    const newCard = this.currentCards[index];

    // Clean slide transition - just update content with smooth animation
    const popupContent = this.popup.querySelector(".popup-content");

    // Add slide-out class
    popupContent.classList.add("sliding-out");

    setTimeout(() => {
      // Update content
      popupContent.innerHTML = this.createCardContentInner(character, newCard);

      // Remove slide-out, add slide-in
      popupContent.classList.remove("sliding-out");
      popupContent.classList.add("sliding-in");

      // Re-setup events and update dots
      this.setupCardEventListeners(character, newCard);
      this.updateNavigationDots();

      // Clean up classes
      setTimeout(() => {
        popupContent.classList.remove("sliding-in");
      }, 200);
    }, 100);
  }

  createCardContentInner(character, card) {
    const { pinyin, entries } = card;
    const cardId = `${character}-${pinyin}`;
    const isKnown = this.vocabManager.isWordKnown(cardId);

    // FIX 1: Always use the original character from the website
    const displayCharacter = this.originalCharacter || character;

    // Try to get frequency for the specific pronunciation first, then fallback to character
    let frequency = null;
    if (this.frequencyManager) {
      // Try pronunciation-specific frequency first (like "长-cháng")
      frequency =
        this.frequencyManager.getFrequency(cardId) ||
        this.frequencyManager.getFrequency(displayCharacter);
    }

    // Create definitions exactly like original
    const definitionsHtml = entries
      .map((entry) => {
        const defs = entry.definition
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean);
        const bullets =
          defs.length > 1
            ? `<ul class="definition-list">${defs
                .map((d) => `<li>${d}</li>`)
                .join("")}</ul>`
            : `<div class="definition">${defs[0]}</div>`;
        return `<div class="definition-block">${bullets}</div>`;
      })
      .join("");

    // Pronunciation button with specific pinyin for TTS
    const pronunciationBtn = `
      <button 
        class="pronunciation-btn" 
        title="Play pronunciation (${pinyin})"
        data-word="${displayCharacter}"
        data-pinyin="${pinyin}"
        data-tts-text="${pinyin}"
      >
        <span class="icon">🔊</span>
      </button>
    `;

    // Return just the inner content
    return `
      <div class="character-container">
        <div class="character highlight"><ruby>${displayCharacter}<rt>${pinyin}</rt></ruby></div>
        ${pronunciationBtn}
        ${
          frequency
            ? `<div class="frequency">Frequency: ${frequency}</div>`
            : ""
        }
      </div>
      <div class="definitions-scroll">${definitionsHtml}</div>
      <div class="popup-buttons">
        <button class="${
          isKnown ? "mark-unknown-btn" : "mark-known-btn"
        }" data-card-id="${cardId}">
          ${isKnown ? "Mark Unknown" : "Mark Known"}
        </button>
      </div>
      ${this.createAnkiButton()}
    `;
  }

  async handlePronunciation(button, word, pinyin) {
    try {
      button.classList.add("loading");
      button.disabled = true;
      button.title = "Loading audio...";

      console.log(`🔊 Playing pronunciation for: ${word} (${pinyin})`);

      // Use pinyin for TTS instead of character for better pronunciation
      const ttsText = button.getAttribute("data-tts-text") || pinyin;
      const success = await this.pronunciationManager.playPronunciation(
        ttsText
      );

      if (success) {
        button.classList.remove("loading");
        button.classList.add("playing");
        button.title = "Playing...";

        setTimeout(() => {
          button.classList.remove("playing");
          button.disabled = false;
          button.title = `Play pronunciation (${pinyin})`;
        }, 2000);
      } else {
        button.classList.remove("loading");
        button.classList.add("error");
        button.title = "Audio not available";

        setTimeout(() => {
          button.classList.remove("error");
          button.disabled = false;
          button.title = `Play pronunciation (${pinyin})`;
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
        button.title = `Play pronunciation (${pinyin})`;
      }, 1500);
    }
  }

  updateNavigationDots() {
    const dots = this.popup.querySelectorAll(".nav-dot");
    const counter = this.popup.querySelector(".card-counter");

    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === this.currentCardIndex);
    });

    if (counter) {
      counter.textContent = `${this.currentCardIndex + 1} of ${
        this.currentCards.length
      }`;
    }
  }

  setupCardEventListeners(character, card) {
    // Mouse events exactly like original
    this.popup.addEventListener("mouseenter", () => {
      this.isMouseOverPopup = true;
    });

    this.popup.addEventListener("mouseleave", () => {
      this.isMouseOverPopup = false;
    });

    // All button events exactly like original
    const markKnownBtn = this.popup.querySelector(".mark-known-btn");
    const markUnknownBtn = this.popup.querySelector(".mark-unknown-btn");
    const ankiBtn = this.popup.querySelector(".anki-btn");
    const pronunciationBtns = this.popup.querySelectorAll(".pronunciation-btn");

    if (markKnownBtn) {
      markKnownBtn.addEventListener("click", async () => {
        // FIX 2: Mark ALL cards as known when clicking "Mark Known"
        await this.markAllCardsAsKnown();
        this.hidePopup();
      });
    }

    if (markUnknownBtn) {
      markUnknownBtn.addEventListener("click", async () => {
        // FIX 2: Mark ALL cards as unknown when clicking "Mark Unknown"
        await this.markAllCardsAsUnknown();
        this.hidePopup();
      });
    }

    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        await this.ankiManager.createCardFromPopup(
          `${this.originalCharacter}-${card.pinyin}`,
          ankiBtn,
          this.frequencyManager
        );
      });
    }

    pronunciationBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = btn.getAttribute("data-word");
        const pinyin = btn.getAttribute("data-pinyin");
        await this.handlePronunciation(btn, word, pinyin);
      });
    });

    // Dot navigation
    this.popup.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-dot")) {
        const index = parseInt(e.target.getAttribute("data-index"));
        this.goToCard(index);
      }
    });
  }

  // FIX 2: New method to mark all cards as known
  async markAllCardsAsKnown() {
    console.log(
      "🎯 Marking all cards as known for character:",
      this.originalCharacter
    );

    // Mark the base character as known
    await this.vocabManager.markWordAsKnown(this.originalCharacter);

    // Mark each pronunciation variant as known
    for (const card of this.currentCards) {
      const cardId = `${this.originalCharacter}-${card.pinyin}`;
      await this.vocabManager.markWordAsKnown(cardId);
      console.log("🎯 Marked as known:", cardId);
    }

    // Save to vocab list using the first pronunciation for display
    const firstCard = this.currentCards[0];
    this.saveToVocabList(
      this.originalCharacter,
      firstCard.pinyin,
      firstCard.entries[0].definition
    );

    // Update page styling
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(this.originalCharacter, true);
    }
  }

  // FIX 2: New method to mark all cards as unknown
  async markAllCardsAsUnknown() {
    console.log(
      "🎯 Marking all cards as unknown for character:",
      this.originalCharacter
    );

    // Mark the base character as unknown
    await this.vocabManager.markWordAsUnknown(this.originalCharacter);

    // Mark each pronunciation variant as unknown
    for (const card of this.currentCards) {
      const cardId = `${this.originalCharacter}-${card.pinyin}`;
      await this.vocabManager.markWordAsUnknown(cardId);
      console.log("🎯 Marked as unknown:", cardId);
    }

    // Save to vocab list using the first pronunciation for display
    const firstCard = this.currentCards[0];
    this.saveToVocabList(
      this.originalCharacter,
      firstCard.pinyin,
      firstCard.entries[0].definition
    );

    // Update page styling
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(this.originalCharacter, false);
    }

    // Re-highlight the word if possible
    if (window.highlightManager) {
      const el = document.querySelector(
        `span[data-word="${this.originalCharacter}"]`
      );
      if (el) {
        window.highlightManager.removeLookupHighlight();
        el.classList.add("lookup-highlight");
        window.highlightManager.currentHighlight = el;
      }
    }
  }

  saveToVocabList(character, pinyin, definition) {
    // FIX 1: Use originalCharacter consistently
    const displayCharacter = this.originalCharacter || character;

    try {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
          const vocabItems = result.chineseExtensionVocabList || [];
          const cardId = `${displayCharacter}-${pinyin}`;

          const exists = vocabItems.some(
            (item) => (item.character || item.word) === cardId
          );
          if (!exists) {
            const newItem = {
              character: cardId,
              word: cardId,
              definition:
                definition.length > 100
                  ? definition.substring(0, 97) + "..."
                  : definition,
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
}
