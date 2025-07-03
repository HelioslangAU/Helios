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
    this.ankiStatus = { available: false, ready: false };

    // Initialize Pronunciation Manager
    this.pronunciationManager = new PronunciationManager();

    // Check Anki availability on startup
    this.checkAnkiStatus();
  }

  async checkAnkiStatus() {
    try {
      this.ankiStatus = await this.ankiManager.getQuickStatus();
      console.log("🃏 Anki status:", this.ankiStatus);
    } catch (error) {
      this.ankiStatus = { available: false, ready: false };
      console.warn("🃏 Could not check Anki status:", error);
    }
  }

  showDictionaryPopup(x, y, character) {
    this.hidePopup();

    const popup = document.createElement("div");
    popup.className = "chinese-lang-extension-popup";
    popup.innerHTML = this.createPopupContent(character);

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
    this.setupPopupPersistence();
  }

  scheduleHidePopup() {
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isMouseOverPopup && !this.isMouseOverHighlight) {
        this.hidePopup();
        this.highlightManager.removeLookupHighlight();
      }
    }, 50);
  }

  createPopupContent(character) {
    const matches = this.dictionaryManager.dictionary[character] || [];
    const isKnown = this.vocabManager.isWordKnown(character);
    let frequency = null;
    if (this.frequencyManager) {
      frequency = this.frequencyManager.getFrequency(character);
    }

    if (matches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character-container">
            <div class="character highlight">${character}</div>
          </div>
          <div class="definition">Character not found in dictionary</div>
          ${this.createAnkiButton(character)}
        </div>
      `;
    }

    // Get pinyin from first match for ruby text and pronunciation
    pinyin = matches[0].pinyin;

    // Split pinyin and character for proper spacing
    const pinyinSyllables = pinyin.split(" ");
    const characters = character.split("");

    // Create ruby text with proper spacing
    let rubyText = "";
    if (characters.length === pinyinSyllables.length) {
      rubyText = characters
        .map(
          (char, i) =>
            `<ruby>${char}<rt>${pinyinSyllables[i] || ""}</rt></ruby>`
        )
        .join("");
    } else {
      rubyText = `<ruby>${character}<rt>${pinyin}</rt></ruby>`;
    }

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
          <div class="character highlight">${rubyText}</div>
          ${pronunciationBtn}
          ${
            frequency
              ? `<div class="frequency">Frequency: ${frequency}</div>`
              : ""
          }
        </div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="${isKnown ? "mark-unknown-btn" : "mark-known-btn"}">
            ${isKnown ? "Mark Unknown" : "Mark Known"}
          </button>
        </div>
        ${this.createAnkiButton(character)}
      </div>
    `;
  }

  createAnkiButton(character) {
    if (!this.ankiStatus.available) {
      return `
        <button 
          class="anki-btn anki-unavailable" 
          disabled 
          title="Anki not available. Make sure Anki is running with AnkiConnect add-on."
        >
          A
        </button>
      `;
    }

    return `
      <button 
        class="anki-btn anki-available" 
        title="Add to Anki"
        data-character="${character}"
      >
        A
      </button>
    `;
  }

  setupPopupEventListeners(character) {
    const markKnownBtn = this.popup.querySelector(".mark-known-btn");
    const markUnknownBtn = this.popup.querySelector(".mark-unknown-btn");
    const ankiBtn = this.popup.querySelector(".anki-btn");
    const pronunciationBtns = this.popup.querySelectorAll(".pronunciation-btn");

    if (markKnownBtn) {
      markKnownBtn.addEventListener("click", async () => {
        await this.handleMarkKnown(character);
      });
    }

    if (markUnknownBtn) {
      markUnknownBtn.addEventListener("click", async () => {
        await this.handleMarkUnknown(character);
      });
    }

    // Anki button event listener
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        await this.handleAnkiCardCreation(character, ankiBtn);
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

  async handleMarkKnown(character) {
    try {
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

      this.hidePopup();
    } catch (error) {
      console.error("Error marking word as known:", error);
    }
  }

  async handleMarkUnknown(character) {
    try {
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

      this.hidePopup();
    } catch (error) {
      console.error("Error marking word as unknown:", error);
    }
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

  async handleAnkiCardCreation(character, button) {
    try {
      console.log(`🃏 Creating Anki card for: ${character}`);

      // Update button to loading state
      button.textContent = "⏳";
      button.disabled = true;
      button.title = "Creating Anki card...";

      // Validate character
      if (!character || character.trim() === "") {
        throw new Error("No character provided");
      }

      // Check if dictionary is available
      if (!this.dictionaryManager?.dictionary) {
        throw new Error("Dictionary not available");
      }

      // Check if character exists in dictionary
      const matches = this.dictionaryManager.dictionary[character] || [];
      if (matches.length === 0) {
        throw new Error(`Character "${character}" not found in dictionary`);
      }

      // Get frequency if available
      let frequency = "";
      if (this.frequencyManager) {
        const freqData = this.frequencyManager.getFrequency(character);
        frequency = freqData ? freqData.toString() : "";
      }

      // Create card using new AnkiManager
      const result = await this.ankiManager.createCard(character, {
        frequency,
      });

      if (result.success) {
        // Success state
        button.textContent = "✓";
        button.className = "anki-btn anki-success";
        button.title = "Successfully added to Anki!";

        // Update statistics
        this.updateAnkiStatistics(true);

        // Save to vocab list
        this.saveToVocabList(character);

        // Hide popup after delay
        setTimeout(() => {
          this.hidePopup();
        }, 1500);

        console.log(`✅ Successfully created Anki card for: ${character}`);
      } else {
        // Handle different error types
        this.handleAnkiError(button, result.error);
        this.updateAnkiStatistics(false);
      }
    } catch (error) {
      console.error("🃏 Error in Anki card creation:", error);
      this.handleAnkiError(button, error.message);
      this.updateAnkiStatistics(false);
    }
  }

  handleAnkiError(button, errorMessage) {
    let buttonText = "✗";
    let buttonClass = "anki-btn anki-error";
    let buttonTitle = `Error: ${errorMessage}`;

    if (errorMessage.includes("already exists")) {
      buttonText = "!";
      buttonClass = "anki-btn anki-duplicate";
      buttonTitle = "Card already exists in Anki";
    } else if (
      errorMessage.includes("not available") ||
      errorMessage.includes("connection")
    ) {
      buttonText = "⚠";
      buttonClass = "anki-btn anki-unavailable";
      buttonTitle = "Anki connection lost";
      this.ankiStatus.available = false;
    } else if (
      errorMessage.includes("Settings") ||
      errorMessage.includes("deck") ||
      errorMessage.includes("note type")
    ) {
      buttonText = "⚙";
      buttonClass = "anki-btn anki-settings-error";
      buttonTitle = "Settings incomplete - check Anki settings";
    }

    button.textContent = buttonText;
    button.className = buttonClass;
    button.title = buttonTitle;

    // Reset button after showing error
    setTimeout(() => {
      button.textContent = "A";
      button.className = "anki-btn anki-available";
      button.disabled = false;
      button.title = "Add to Anki";
    }, 3000);
  }

  updateAnkiStatistics(success) {
    try {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          [
            "ankiCardsCreated",
            "ankiCardsToday",
            "ankiSuccessCount",
            "ankiTotalAttempts",
            "lastAnkiResetDate",
          ],
          (result) => {
            const today = new Date().toDateString();
            const lastReset = result.lastAnkiResetDate || "";

            let cardsCreated = result.ankiCardsCreated || 0;
            let cardsToday = result.ankiCardsToday || 0;
            let successCount = result.ankiSuccessCount || 0;
            let totalAttempts = result.ankiTotalAttempts || 0;

            // Reset daily counters if it's a new day
            if (lastReset !== today) {
              cardsToday = 0;
            }

            // Update counters
            totalAttempts++;
            if (success) {
              cardsCreated++;
              cardsToday++;
              successCount++;
            }

            // Calculate success rate
            const successRate =
              totalAttempts > 0
                ? Math.round((successCount / totalAttempts) * 100)
                : 100;

            // Save updated statistics
            chrome.storage.local.set(
              {
                ankiCardsCreated: cardsCreated,
                ankiCardsToday: cardsToday,
                ankiSuccessCount: successCount,
                ankiTotalAttempts: totalAttempts,
                ankiSuccessRate: successRate,
                lastAnkiResetDate: today,
              },
              () => {
                console.log(
                  `📊 Anki stats updated: ${cardsCreated} total, ${cardsToday} today, ${successRate}% success rate`
                );
              }
            );
          }
        );
      }
    } catch (error) {
      console.warn("Could not update Anki statistics:", error);
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

  // Setup mouse event listeners for popup persistence
  setupPopupPersistence() {
    if (this.popup) {
      this.popup.addEventListener("mouseenter", () => {
        this.isMouseOverPopup = true;
        clearTimeout(this.hideTimeout);
      });

      this.popup.addEventListener("mouseleave", () => {
        this.isMouseOverPopup = false;
        this.scheduleHidePopup();
      });
    }

    if (this.highlightManager?.currentHighlight) {
      this.highlightManager.currentHighlight.addEventListener(
        "mouseenter",
        () => {
          this.isMouseOverHighlight = true;
          clearTimeout(this.hideTimeout);
        }
      );

      this.highlightManager.currentHighlight.addEventListener(
        "mouseleave",
        () => {
          this.isMouseOverHighlight = false;
          this.scheduleHidePopup();
        }
      );
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

  // Additional helper methods
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

  // Cleanup method
  cleanup() {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.isMouseOverPopup = false;
    this.isMouseOverHighlight = false;
  }
}
