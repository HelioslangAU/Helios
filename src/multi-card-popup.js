class MultiCardPopupManager extends PopupManager {
  constructor(options) {
    super(options);
    this.currentCards = [];
    this.currentCardIndex = 0;
  }

  async showDictionaryPopup(x, y, character) {
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
    await this.showCard(x, y, character, 0);
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

  sortDefinitions(defs) {
    // Sort definitions to put ancient/archaic ones at the end
    const ancientKeywords = ['ancient', 'archaic', 'old', 'classical', 'historical', 'obsolete', 'thou', 'thy', 'thee', 'hast', 'hath', 'doth', 'shalt', 'ye olde'];
    
    return defs.sort((a, b) => {
      const aIsAncient = ancientKeywords.some(keyword => a.toLowerCase().includes(keyword));
      const bIsAncient = ancientKeywords.some(keyword => b.toLowerCase().includes(keyword));
      
      if (aIsAncient && !bIsAncient) return 1;
      if (!aIsAncient && bIsAncient) return -1;
      return 0;
    });
  }

  createWordStatusButton(cardId, status) {
    switch(status) {
      case 'known':
        return `<button class="mark-ignore-btn" data-card-id="${cardId}">Mark Ignore</button>`;
      case 'ignored':
        return `<button class="mark-unknown-btn" data-card-id="${cardId}">Mark Unknown</button>`;
      case 'unknown':
      default:
        return `<button class="mark-known-btn" data-card-id="${cardId}">Mark Known</button>`;
    }
  }

  async showCard(x, y, character, cardIndex) {
    this.hidePopup();

    const card = this.currentCards[cardIndex];

    // Create popup using EXACT same method as original
    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup";
    popup.innerHTML = await this.createCardContent(character, card);

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
    this.setupCardEventListeners(character, card);
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

  async createCardContent(character, card) {
    const { pinyin, entries } = card;
    const cardId = `${character}-${pinyin}`;
    const wordStatus = this.vocabManager.getWordStatus(cardId);
    const frequency = this.frequencyManager
      ? this.frequencyManager.getFrequency(character)
      : null;

    // Create definitions exactly like original
    const definitionsHtml = entries
      .map((entry) => {
        const defs = entry.definition
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean);
        
        // Sort definitions to put ancient ones at the end
        const sortedDefs = this.sortDefinitions(defs);
        
        const bullets =
          sortedDefs.length > 1
            ? `<ul class="definition-list">${sortedDefs
                .map((d) => `<li>${d}</li>`)
                .join("")}</ul>`
            : `<div class="definition">${sortedDefs[0]}</div>`;
        return `<div class="definition-block">${bullets}</div>`;
      })
      .join("");

    // Pronunciation button exactly like original
    const pronunciationBtn = `
      <button 
        class="pronunciation-btn" 
        title="Play pronunciation"
        data-word="${character}"
        data-pinyin="${pinyin}"
      >
        <span class="icon">🔊</span>
      </button>
    `;

    // EXACT same content structure as original
    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight"><ruby>${character}<rt>${pinyin}</rt></ruby></div>
          ${pronunciationBtn}
          ${
            frequency
              ? `<div class="frequency">Frequency: ${frequency}</div>`
              : ""
          }
        </div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          ${this.createWordStatusButton(cardId, wordStatus)}
        </div>
        ${await this.createAnkiButton()}
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

    this.currentCardIndex = index;
    const character =
      this.currentCards[index].entries[0].simplified ||
      this.currentCards[index].entries[0].traditional;
    const newCard = this.currentCards[index];

    // Clean slide transition - just update content with smooth animation
    const popupContent = this.popup.querySelector(".popup-content");

    // Add slide-out class
    popupContent.classList.add("sliding-out");

    setTimeout(async () => {
      // Update content
      popupContent.innerHTML = await this.createCardContentInner(character, newCard);

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

  async createCardContentInner(character, card) {
    const { pinyin, entries } = card;
    const cardId = `${character}-${pinyin}`;
    const wordStatus = this.vocabManager.getWordStatus(cardId);

    // Try to get frequency for the specific pronunciation first, then fallback to character
    let frequency = null;
    if (this.frequencyManager) {
      // Try pronunciation-specific frequency first (like "长-cháng")
      frequency =
        this.frequencyManager.getFrequency(cardId) ||
        this.frequencyManager.getFrequency(character);
    }

    // Create definitions exactly like original
    const definitionsHtml = entries
      .map((entry) => {
        const defs = entry.definition
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean);
        
        // Sort definitions to put ancient ones at the end
        const sortedDefs = this.sortDefinitions(defs);
        
        const bullets =
          sortedDefs.length > 1
            ? `<ul class="definition-list">${sortedDefs
                .map((d) => `<li>${d}</li>`)
                .join("")}</ul>`
            : `<div class="definition">${sortedDefs[0]}</div>`;
        return `<div class="definition-block">${bullets}</div>`;
      })
      .join("");

    // Pronunciation button with specific pinyin for TTS
    const pronunciationBtn = `
      <button 
        class="pronunciation-btn" 
        title="Play pronunciation (${pinyin})"
        data-word="${character}"
        data-pinyin="${pinyin}"
        data-tts-text="${pinyin}"
      >
        <span class="icon">🔊</span>
      </button>
    `;

    // Return just the inner content
    return `
      <div class="character-container">
        <div class="character highlight"><ruby>${character}<rt>${pinyin}</rt></ruby></div>
        ${pronunciationBtn}
        ${
          frequency
            ? `<div class="frequency">Frequency: ${frequency}</div>`
            : ""
        }
      </div>
      <div class="definitions-scroll">${definitionsHtml}</div>
      <div class="popup-buttons">
        ${this.createWordStatusButton(cardId, wordStatus)}
      </div>
      ${await this.createAnkiButton()}
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
    const markIgnoreBtn = this.popup.querySelector(".mark-ignore-btn");
    const ankiBtn = this.popup.querySelector(".anki-btn");
    const pronunciationBtns = this.popup.querySelectorAll(".pronunciation-btn");

    if (markKnownBtn) {
      markKnownBtn.addEventListener("click", async () => {
        const cardId = markKnownBtn.getAttribute("data-card-id");
        await this.vocabManager.markWordAsKnown(cardId);
        
        // Mark all pronunciations of this character as known
        await this.markAllCardsAsKnown(character, true);
        
        this.saveToVocabList(
          character,
          card.pinyin,
          card.entries[0].definition
        );
        if (window.pageProcessor) {
          window.pageProcessor.updateWordStyling(character, true);
        }

        // Refresh current card
        await this.refreshCurrentCard(character);
      });
    }

    if (markUnknownBtn) {
      markUnknownBtn.addEventListener("click", async () => {
        const cardId = markUnknownBtn.getAttribute("data-card-id");
        await this.vocabManager.markWordAsUnknown(cardId);
        
        // Mark all pronunciations of this character as unknown
        await this.markAllCardsAsKnown(character, false);
        
        this.saveToVocabList(
          character,
          card.pinyin,
          card.entries[0].definition
        );
        if (window.pageProcessor) {
          window.pageProcessor.updateWordStyling(character, false);
        }
        if (window.highlightManager) {
          const el = document.querySelector(`span[data-word="${character}"]`);
          if (el) {
            window.highlightManager.removeLookupHighlight();
            el.classList.add("lookup-highlight");
            window.highlightManager.currentHighlight = el;
          }
        }

        // Refresh current card
        await this.refreshCurrentCard(character);
      });
    }

    if (markIgnoreBtn) {
      markIgnoreBtn.addEventListener("click", async () => {
        const cardId = markIgnoreBtn.getAttribute("data-card-id");
        await this.vocabManager.markWordAsIgnored(cardId);
        
        // Mark all pronunciations of this character as ignored
        await this.markAllCardsAsIgnored(character);
        
        if (window.pageProcessor) {
          window.pageProcessor.updateWordStyling(character, false);
        }

        // Refresh current card
        await this.refreshCurrentCard(character);
      });
    }

    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        await this.ankiManager.createCardFromPopup(
          `${character}-${card.pinyin}`,
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

  async markAllCardsAsKnown(character, isKnown) {
    // Mark all pronunciations of this character as known/unknown
    try {
      for (const card of this.currentCards) {
        const cardId = `${character}-${card.pinyin}`;
        if (isKnown) {
          await this.vocabManager.markWordAsKnown(cardId);
        } else {
          await this.vocabManager.markWordAsUnknown(cardId);
        }
      }
    } catch (error) {
      console.warn("Could not mark all cards:", error);
    }
  }

  async markAllCardsAsIgnored(character) {
    // Mark all pronunciations of this character as ignored
    try {
      for (const card of this.currentCards) {
        const cardId = `${character}-${card.pinyin}`;
        await this.vocabManager.markWordAsIgnored(cardId);
      }
    } catch (error) {
      console.warn("Could not mark all cards as ignored:", error);
    }
  }

  async refreshCurrentCard(character) {
    if (!this.popup || this.currentCards.length === 0) return;
    
    const currentCard = this.currentCards[this.currentCardIndex];
    const popupContent = this.popup.querySelector(".popup-content");
    
    if (popupContent && currentCard) {
      // Update the popup content
      popupContent.innerHTML = await this.createCardContentInner(character, currentCard);
      
      // Re-setup event listeners
      this.setupCardEventListeners(character, currentCard);
      
      // Update navigation dots
      this.updateNavigationDots();
    }
  }

  saveToVocabList(character, pinyin, definition) {
    // Same as before
    try {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
          const vocabItems = result.chineseExtensionVocabList || [];
          const cardId = `${character}-${pinyin}`;

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
