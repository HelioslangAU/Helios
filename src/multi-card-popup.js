class MultiCardPopupManager extends PopupManager {
  constructor(options) {
    super(options);
    this.currentCards = [];
    this.currentCardIndex = 0;
    this.originalCharacter = null;

    // EXTENSIBLE FILTERING SYSTEM
    this.definitionFilters = {
      // Patterns to deprioritize (show last)
      deprioritize: [
        /^old variant of/i,
        /^variant of/i,
        /^archaic variant of/i,
        /^ancient variant of/i,
        /^obsolete variant of/i,
        /^classical variant of/i,
        // Add more patterns here as needed:
        // /^surname/i,  // uncomment to deprioritize surnames
        // /^given name/i,  // uncomment to deprioritize given names
        // /^place name/i,  // uncomment to deprioritize place names
      ],

      // Patterns to completely hide (optional - currently empty)
      hide: [
        // /^see also/i,  // uncomment to hide "see also" entries
        // /^same as/i,   // uncomment to hide "same as" entries
      ],

      // Patterns to prioritize (show first) - currently empty but extensible
      prioritize: [
        // /^to /i,       // uncomment to prioritize verbs
        // /^(a|an|the) /i,  // uncomment to prioritize nouns with articles
      ],
    };
  }

  showDictionaryPopup(x, y, character, sentence) {
    this.originalCharacter = character;
    this.capturedSentence = sentence; // Store the sentence

    const allEntries = this.dictionaryManager.dictionary[character] || [];
    const pronunciations = this.groupByPronunciation(allEntries);

    if (pronunciations.length <= 1) {
      // Also pass the sentence to the parent method
      return super.showDictionaryPopup(x, y, character, sentence);
    }

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

    // Start with the main word pronunciations
    const mainWordCards = Object.entries(groups).map(([pinyin, entries]) => ({
      pinyin,
      entries: this.filterAndSortDefinitions(entries),
      isMainWord: true,
    }));

    // Add individual character cards for multi-character words
    const characterCards = this.createCharacterCards();

    return [...mainWordCards, ...characterCards];
  }

  createCharacterCards() {
    const word = this.originalCharacter;
    const characterCards = [];

    // Only create character cards for multi-character words
    if (!word || word.length < 2) {
      return characterCards;
    }

    // Create cards for all characters EXCEPT the last one (users can hover over last char separately)
    for (let i = 0; i < word.length - 1; i++) {
      const character = word[i];
      const charEntries = this.dictionaryManager.dictionary[character];

      if (charEntries && charEntries.length > 0) {
        // Group character entries by pronunciation
        const charGroups = {};
        charEntries.forEach((entry) => {
          if (!charGroups[entry.pinyin]) {
            charGroups[entry.pinyin] = [];
          }
          charGroups[entry.pinyin].push(entry);
        });

        // Add cards for each pronunciation of this character
        Object.entries(charGroups).forEach(([pinyin, entries]) => {
          characterCards.push({
            pinyin,
            entries: this.filterAndSortDefinitions(entries),
            isCharacterCard: true,
            character: character,
          });
        });
      }
    }

    return characterCards;
  }

  // EXTENSIBLE FILTERING SYSTEM
  filterAndSortDefinitions(entries) {
    // First, filter out entries we want to hide completely
    const visibleEntries = entries.filter((entry) => {
      return !this.definitionFilters.hide.some((pattern) =>
        pattern.test(entry.definition)
      );
    });

    // Then sort entries by priority
    return visibleEntries.sort((a, b) => {
      const aScore = this.getDefinitionPriority(a.definition);
      const bScore = this.getDefinitionPriority(b.definition);
      return bScore - aScore; // Higher score = higher priority (shown first)
    });
  }

  getDefinitionPriority(definition) {
    // Check for prioritize patterns (highest priority)
    if (
      this.definitionFilters.prioritize.some((pattern) =>
        pattern.test(definition)
      )
    ) {
      return 100;
    }

    // Check for deprioritize patterns (lowest priority)
    if (
      this.definitionFilters.deprioritize.some((pattern) =>
        pattern.test(definition)
      )
    ) {
      return -100;
    }

    // Default priority (normal definitions)
    return 0;
  }

  // Method to easily add new filter patterns at runtime
  addFilter(type, pattern) {
    if (this.definitionFilters[type]) {
      this.definitionFilters[type].push(new RegExp(pattern, "i"));
      console.log(`🔧 Added ${type} filter: ${pattern}`);
    } else {
      console.warn(
        `🔧 Unknown filter type: ${type}. Use 'prioritize', 'deprioritize', or 'hide'`
      );
    }
  }

  // Method to remove filter patterns
  removeFilter(type, patternString) {
    if (this.definitionFilters[type]) {
      const index = this.definitionFilters[type].findIndex(
        (pattern) => pattern.source === new RegExp(patternString, "i").source
      );
      if (index > -1) {
        this.definitionFilters[type].splice(index, 1);
        console.log(`🔧 Removed ${type} filter: ${patternString}`);
      }
    }
  }

  // Method to view current filters
  getFilters() {
    const filters = {};
    Object.keys(this.definitionFilters).forEach((type) => {
      filters[type] = this.definitionFilters[type].map(
        (pattern) => pattern.source
      );
    });
    return filters;
  }

  showCard(x, y, character, cardIndex) {
    this.hidePopup();

    const card = this.currentCards[cardIndex];
    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup";
    popup.innerHTML = this.createCardContent(this.originalCharacter, card);

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

    this.addNavigationDots();
    this.setupCardEventListeners(this.originalCharacter, card);
    this.setupScrolling();

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
    const { pinyin, entries, isCharacterCard, character: cardCharacter } = card;

    // For character cards, use the individual character; for main word, use original
    const displayCharacter = isCharacterCard
      ? cardCharacter
      : this.originalCharacter || character;
    const cardId = `${displayCharacter}-${pinyin}`;
    const isKnown = this.vocabManager.isWordKnown(cardId);
    const frequency = this.frequencyManager
      ? this.frequencyManager.getFrequency(displayCharacter)
      : null;

    // Create definitions with improved filtering
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
        const definitionsScroll = e.target.closest(".definitions-scroll");
        if (definitionsScroll) {
          const scrollTop = definitionsScroll.scrollTop;
          const scrollHeight = definitionsScroll.scrollHeight;
          const clientHeight = definitionsScroll.clientHeight;
          const isScrolledToTop = scrollTop <= 2;
          const isScrolledToBottom =
            Math.abs(scrollHeight - clientHeight - scrollTop) <= 2;

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
      },
      { passive: false }
    );
  }

  goToCard(index) {
    if (index < 0 || index >= this.currentCards.length) return;

    const oldIndex = this.currentCardIndex;
    this.currentCardIndex = index;
    const character = this.originalCharacter;
    const newCard = this.currentCards[index];

    const popupContent = this.popup.querySelector(".popup-content");
    popupContent.classList.add("sliding-out");

    setTimeout(() => {
      popupContent.innerHTML = this.createCardContentInner(character, newCard);
      popupContent.classList.remove("sliding-out");
      popupContent.classList.add("sliding-in");
      this.setupCardEventListeners(character, newCard);
      this.updateNavigationDots();

      setTimeout(() => {
        popupContent.classList.remove("sliding-in");
      }, 200);
    }, 100);
  }

  createCardContentInner(character, card) {
    const { pinyin, entries, isCharacterCard, character: cardCharacter } = card;

    // For character cards, use the individual character; for main word, use original
    const displayCharacter = isCharacterCard
      ? cardCharacter
      : this.originalCharacter || character;
    const cardId = `${displayCharacter}-${pinyin}`;
    const isKnown = this.vocabManager.isWordKnown(cardId);

    let frequency = null;
    if (this.frequencyManager) {
      frequency =
        this.frequencyManager.getFrequency(cardId) ||
        this.frequencyManager.getFrequency(displayCharacter);
    }

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
    this.popup.addEventListener("mouseenter", () => {
      this.isMouseOverPopup = true;
    });

    this.popup.addEventListener("mouseleave", () => {
      this.isMouseOverPopup = false;
    });

    const markKnownBtn = this.popup.querySelector(".mark-known-btn");
    const markUnknownBtn = this.popup.querySelector(".mark-unknown-btn");
    const ankiBtn = this.popup.querySelector(".anki-btn");
    const pronunciationBtns = this.popup.querySelectorAll(".pronunciation-btn");

    if (markKnownBtn) {
      markKnownBtn.addEventListener("click", async () => {
        await this.markAllCardsAsKnown();
        this.hidePopup();
      });
    }

    if (markUnknownBtn) {
      markUnknownBtn.addEventListener("click", async () => {
        await this.markAllCardsAsUnknown();
        this.hidePopup();
      });
    }

    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        // Get the data from the currently displayed card
        const currentCard = this.currentCards[this.currentCardIndex];
        const displayCharacter = currentCard.isCharacterCard
          ? currentCard.character
          : this.originalCharacter;

        // Construct the word data object to pass to the Anki manager
        const wordData = {
          character: displayCharacter,
          pinyin: currentCard.pinyin,
          definition: currentCard.entries.map(e => e.definition).join('; '),
          sentence: this.capturedSentence, // Use the stored sentence
          traditional: currentCard.entries[0].traditional,
          simplified: currentCard.entries[0].simplified,
        };

        await this.ankiManager.createCardFromPopup(
          wordData, // Pass the whole object
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

    this.popup.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-dot")) {
        const index = parseInt(e.target.getAttribute("data-index"));
        this.goToCard(index);
      }
    });
  }

  async markAllCardsAsKnown() {
    console.log(
      "🎯 Marking all cards as known for character:",
      this.originalCharacter
    );

    await this.vocabManager.markWordAsKnown(this.originalCharacter);

    for (const card of this.currentCards) {
      const cardId = `${this.originalCharacter}-${card.pinyin}`;
      await this.vocabManager.markWordAsKnown(cardId);
      console.log("🎯 Marked as known:", cardId);
    }

    const firstCard = this.currentCards[0];
    this.saveToVocabList(
      this.originalCharacter,
      firstCard.pinyin,
      firstCard.entries[0].definition
    );

    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(this.originalCharacter, true);
    }
  }

  async markAllCardsAsUnknown() {
    console.log(
      "🎯 Marking all cards as unknown for character:",
      this.originalCharacter
    );

    await this.vocabManager.markWordAsUnknown(this.originalCharacter);

    for (const card of this.currentCards) {
      const cardId = `${this.originalCharacter}-${card.pinyin}`;
      await this.vocabManager.markWordAsUnknown(cardId);
      console.log("🎯 Marked as unknown:", cardId);
    }

    const firstCard = this.currentCards[0];
    this.saveToVocabList(
      this.originalCharacter,
      firstCard.pinyin,
      firstCard.entries[0].definition
    );

    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(this.originalCharacter, false);
    }

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
