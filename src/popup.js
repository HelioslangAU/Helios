var pinyin = "";

class PopupManager {
  constructor({
    highlightManager,
    dictionaryManager,
    vocabManager,
    frequencyManager,
  }) {
    this.highlightManager = highlightManager;
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.frequencyManager = frequencyManager;
    this.popup = null;
    this.isMouseOverPopup = false;
    this.isMouseOverHighlight = false;
    this.hideTimeout = null;

    // Initialize Anki Manager with new system
    this.ankiManager = new AnkiManager();
    this.ankiManager.initialize(this.dictionaryManager);

    // Initialize Pronunciation Manager
    this.pronunciationManager = new PronunciationManager();
  }

  async showDictionaryPopup(x, y, character) {
    this.hidePopup();

    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup";
    popup.innerHTML = await this.createPopupContent(character);

    // Default position (fallback)
    let posX = x,
      posY = y;

    // If there is a highlight, position popup exactly below it
    if (this.highlightManager.currentHighlight) {
      const rect =
        this.highlightManager.currentHighlight.getBoundingClientRect();
      posX = rect.left;
      posY = rect.bottom + 5; // Small gap below highlight
    }

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;
    popup.style.position = "fixed";
    popup.style.zIndex = "2147483647";

    document.body.appendChild(popup);

    // Check if popup goes offscreen and reposition if needed
    const popupRect = popup.getBoundingClientRect();

    // Adjust horizontal position if going off right edge
    if (popupRect.right > window.innerWidth) {
      const newX = window.innerWidth - popupRect.width - 10;
      popup.style.left = `${Math.max(10, newX)}px`;
    }

    // Adjust vertical position if going off bottom edge
    if (popupRect.bottom > window.innerHeight) {
      let newY = posY;
      if (this.highlightManager.currentHighlight) {
        const rect =
          this.highlightManager.currentHighlight.getBoundingClientRect();
        newY = rect.top - popupRect.height - 5; // Above highlight
      } else {
        newY = posY - popupRect.height - 10;
      }
      // Prevent going off the top
      newY = Math.max(10, newY);
      popup.style.top = `${newY}px`;
    }

    this.popup = popup;
    this.setupPopupEventListeners(character);
  }

  scheduleHidePopup() {
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isMouseOverPopup && !this.isMouseOverHighlight) {
        this.highlightManager.removeLookupHighlight();
      }
    }, 50);
  }

  async createPopupContent(character) {
    const matches = this.dictionaryManager.dictionary[character] || [];
    const wordStatus = this.vocabManager.getWordStatus(character);
    let frequency = null;
    if (this.frequencyManager) {
      frequency = this.frequencyManager.getFrequency(character);
    }

    const ankiButton = await this.createAnkiButton();

    if (matches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character-container">
            <div class="character highlight">${character}</div>
          </div>
          <div class="definition">Character not found in dictionary</div>
          ${ankiButton}
        </div>
      `;
    }

    // Get pinyin from first match for pronunciation
    pinyin = matches[0].pinyin;

    const definitionsHtml = matches
      .map((def, idx) => {
        const defs = def.definition
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean);

        const bullets =
          defs.length > 1
            ? `<ul class="definition-list">${defs
                .map((d) => `<li>${d}</li>`)
                .join("")}</ul>`
            : `<div class="definition">${defs[0]}</div>`;

        return `
          <div class="definition-block">
            ${bullets}
          </div>
        `;
      })
      .join("");

    // Create pronunciation button
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
          ${this.createWordStatusButton(character, wordStatus)}
        </div>
        ${ankiButton}
      </div>
    `;
  }

  createWordStatusButton(character, status) {
    switch(status) {
      case 'known':
        return `<button class="mark-ignore-btn" data-word="${character}">Mark Ignore</button>`;
      case 'ignored':
        return `<button class="mark-unknown-btn" data-word="${character}">Mark Unknown</button>`;
      case 'unknown':
      default:
        return `<button class="mark-known-btn" data-word="${character}">Mark Known</button>`;
    }
  }

  async createAnkiButton() {
    // Check Anki connection status
    const status = await this.ankiManager.getQuickStatus();
    
    if (status.available) {
      return `<button class="anki-btn anki-available" title="Add to Anki">A</button>`;
    } else {
      return `<button class="anki-btn anki-unavailable" title="Anki not connected" disabled>A</button>`;
    }
  }

  async refreshPopupContent(character) {
    if (!this.popup) return;
    
    // Update the popup content while maintaining position
    this.popup.innerHTML = await this.createPopupContent(character);
    
    // Re-setup event listeners
    this.setupPopupEventListeners(character);
  }

  setupPopupEventListeners(character) {
    const markKnownBtn = this.popup.querySelector(".mark-known-btn");
    const markUnknownBtn = this.popup.querySelector(".mark-unknown-btn");
    const markIgnoreBtn = this.popup.querySelector(".mark-ignore-btn");
    const ankiBtn = this.popup.querySelector(".anki-btn");
    const pronunciationBtns = this.popup.querySelectorAll(".pronunciation-btn");

    if (markKnownBtn) {
      markKnownBtn.addEventListener("click", async () => {
        // Update known words counter
        if (typeof updateKnownWordsCounter === "function") {
          updateKnownWordsCounter();
        }

        // Mark word as known
        await this.vocabManager.markWordAsKnown(character);

        // Save to vocabulary list and increment session counter
        this.saveToVocabList(character);

        // Update page styling
        if (window.pageProcessor) {
          window.pageProcessor.updateWordStyling(character, true);
        }

        // Refresh popup content
        this.refreshPopupContent(character);
      });
    }

    if (markUnknownBtn) {
      markUnknownBtn.addEventListener("click", async () => {
        // Update known words counter
        if (typeof updateKnownWordsCounter === "function") {
          updateKnownWordsCounter();
        }

        // Mark word as unknown
        await this.vocabManager.markWordAsUnknown(character);

        // Save to vocabulary list and increment session counter
        this.saveToVocabList(character);

        // Update page styling
        if (window.pageProcessor) {
          window.pageProcessor.updateWordStyling(character, false);
        }

        // Re-highlight the word if possible
        if (window.highlightManager) {
          const el = document.querySelector(`span[data-word="${character}"]`);
          if (el) {
            window.highlightManager.removeLookupHighlight();
            el.classList.add("lookup-highlight");
            window.highlightManager.currentHighlight = el;
          }
        }

        // Refresh popup content
        this.refreshPopupContent(character);
      });
    }

    if (markIgnoreBtn) {
      markIgnoreBtn.addEventListener("click", async () => {
        // Mark word as ignored
        await this.vocabManager.markWordAsIgnored(character);

        // Update page styling (ignored words might have special styling)
        if (window.pageProcessor) {
          window.pageProcessor.updateWordStyling(character, false);
        }

        // Refresh popup content
        this.refreshPopupContent(character);
      });
    }

    // NEW: Simple Anki button event listener
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        // AnkiManager handles everything - just pass the button and character
        await this.ankiManager.createCardFromPopup(
          character,
          ankiBtn,
          this.frequencyManager
        );
      });
    }

    // Pronunciation button event listeners
    pronunciationBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const word = btn.getAttribute("data-word");
        const pinyin = btn.getAttribute("data-pinyin");

        await this.handlePronunciation(btn, word, pinyin);
      });
    });
  }

  async handlePronunciation(button, word, pinyin) {
    try {
      // Update button state to loading
      button.classList.add("loading");
      button.disabled = true;
      button.title = "Loading audio...";

      console.log(`🔊 Playing pronunciation for: ${word} (${pinyin})`);

      // Try to play pronunciation
      const success = await this.pronunciationManager.playPronunciation(word);

      if (success) {
        // Success state
        button.classList.remove("loading");
        button.classList.add("playing");
        button.title = "Playing...";

        // Reset button state after audio finishes
        setTimeout(() => {
          button.classList.remove("playing");
          button.disabled = false;
          button.title = "Play pronunciation";
        }, 2000);
      } else {
        // Error state
        button.classList.remove("loading");
        button.classList.add("error");
        button.title = "Audio not available";

        // Reset button state after showing error
        setTimeout(() => {
          button.classList.remove("error");
          button.disabled = false;
          button.title = "Play pronunciation";
        }, 1500);
      }
    } catch (error) {
      console.error("🔊 Error in pronunciation handler:", error);

      // Error state
      button.classList.remove("loading");
      button.classList.add("error");
      button.title = "Error playing audio";

      // Reset button state
      setTimeout(() => {
        button.classList.remove("error");
        button.disabled = false;
        button.title = "Play pronunciation";
      }, 1500);
    }
  }

  saveToVocabList(character) {
    try {
      const matches = this.dictionaryManager.dictionary[character] || [];
      const definition =
        matches.length > 0 ? matches[0].definition : "No definition available";
      const pinyin = matches.length > 0 ? matches[0].pinyin : "";

      // Save to vocabulary list using chrome storage
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["chineseExtensionVocabList"], (result) => {
          const vocabItems = result.chineseExtensionVocabList || [];

          // Check if word already exists
          const exists = vocabItems.some(
            (item) => (item.character || item.word) === character
          );

          if (!exists) {
            const newItem = {
              character: character,
              word: character,
              definition:
                definition.length > 100
                  ? definition.substring(0, 97) + "..."
                  : definition,
              pinyin: pinyin,
              dateAdded: new Date().toISOString(),
              reviewCount: 0,
            };

            vocabItems.push(newItem);

            chrome.storage.local.set(
              { chineseExtensionVocabList: vocabItems },
              () => {
                console.log(`✅ Added ${character} to vocabulary list`);
              }
            );
          }
        });
      }

      // Increment session counter
      this.incrementSessionCounter();
    } catch (error) {
      console.warn("Could not save to vocab list:", error);
    }
  }

  incrementSessionCounter() {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ["todayLookupCount", "lastResetDate"],
        (result) => {
          const today = new Date().toDateString();
          const lastReset = result.lastResetDate || "";
          let lookupCount = result.todayLookupCount || 0;

          // Reset counter if it's a new day
          if (lastReset !== today) {
            lookupCount = 0;
          }

          lookupCount++;

          chrome.storage.local.set(
            {
              todayLookupCount: lookupCount,
              lastResetDate: today,
            },
            () => {
              console.log(`📊 Today's lookup count: ${lookupCount}`);
            }
          );
        }
      );
    }
  }

  async saveVocabList() {
    try {
      localStorage.setItem(
        "chineseExtensionVocabList",
        JSON.stringify(this.vocabList)
      );
    } catch (error) {
      console.warn("Could not save vocab list:", error);
    }
  }

  async loadVocabList() {
    try {
      const stored = localStorage.getItem("chineseExtensionVocabList");
      if (stored) {
        this.vocabList = JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Could not load vocab list:", error);
    }
  }

  updatePopupButton(text, disabled) {
    const addBtn = this.popup?.querySelector(".add-vocab-btn");
    if (addBtn) {
      addBtn.textContent = text;
      addBtn.disabled = disabled;
    }
  }

  hidePopup(event) {
    if (this.popup && event && this.popup.contains(event.target)) {
      return;
    }
    if (this.popup && (!event || !this.popup.contains(event.target))) {
      this.popup.remove();
      this.popup = null;
      this.isMouseOverPopup = false;
    }
  }
}
