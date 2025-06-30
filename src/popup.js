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

    // Initialize Anki Manager
    this.ankiManager = new AnkiManager(); // FIXED: Was EnhancedAnkiManager
    this.isAnkiAvailable = null;

    // Check Anki availability on startup
    this.checkAnkiStatus();
  }

  async checkAnkiStatus() {
    try {
      this.isAnkiAvailable = await this.ankiManager.checkAnkiConnect();
      console.log(
        "Anki status:",
        this.isAnkiAvailable ? "Available" : "Not available"
      );
    } catch (error) {
      this.isAnkiAvailable = false;
      console.warn("Could not check Anki status:", error);
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
      posX = rect.left; // No scrollX for fixed
      posY = rect.bottom; // No scrollY for fixed
    }

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;
    popup.style.position = "fixed";
    popup.style.zIndex = "2147483647";

    document.body.appendChild(popup);
    // --- Check if popup goes offscreen, and reposition if needed ---
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.bottom > window.innerHeight) {
      // Place above the highlight instead
      let newY = posY;
      if (this.highlightManager.currentHighlight) {
        const rect =
          this.highlightManager.currentHighlight.getBoundingClientRect();
        newY = rect.top - popupRect.height;
      } else {
        newY = posY - popupRect.height;
      }
      // Prevent going off the top
      if (newY < 0) newY = 0;
      popup.style.top = `${newY}px`;
    }

    this.popup = popup;
    this.setupPopupEventListeners(character);
    //this.setupPopupMouseEvents();
  }

  // setupPopupMouseEvents() {
  //   if (!this.popup) return;

  //   this.popup.addEventListener("mouseenter", () => {
  //     this.isMouseOverPopup = true;
  //     clearTimeout(this.hideTimeout);
  //   });

  //   this.popup.addEventListener("mouseleave", () => {
  //     this.isMouseOverPopup = false;
  //     this.scheduleHidePopup();
  //   });
  // }

  scheduleHidePopup() {
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isMouseOverPopup && !this.isMouseOverHighlight) {
        this.hidePopup();
        this.highlightManager.removeLookupHighlight();
      }
    }, 50); // 50ms grace period
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
          <div class="character highlight">${character}</div>
          <div class="definition">Character not found in dictionary</div>
          <div class="popup-buttons">
            <button class="close-btn">Close</button>
          </div>
        </div>
      `;
    }

    const definitionsHtml = matches
      .map((def, idx) => {
        const toneClass = `tone-${def.tone || 0}`;
        const variants =
          def.traditional !== def.simplified
            ? `<div class="variants">Traditional: ${def.traditional} | Simplified: ${def.simplified}</div>`
            : "";

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
          <div class="pinyin">
            <span class="pinyin-text">${def.pinyin}</span>
            <span class="tone-indicator ${toneClass}">${def.tone || "?"}</span>
          </div>
          ${variants}
          ${bullets}
        </div>
      `;
      })
      .join("");

    // Create Anki button with status
    const ankiButton = this.createAnkiButton();

    return `
      <div class="popup-content">
        <div class="character highlight">${character}</div>
        ${
          frequency
            ? `<div class="frequency">Frequency: ${frequency}</div>`
            : ""
        }
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="${isKnown ? "mark-unknown-btn" : "mark-known-btn"}">
            ${isKnown ? "Mark Unknown" : "Mark Known"}
          </button>
          ${ankiButton}
          <button class="close-btn">Close</button>
        </div>
      </div>
    `;
  }

  createAnkiButton() {
    if (this.isAnkiAvailable === null) {
      return `<button class="anki-btn anki-checking" disabled>Checking Anki...</button>`;
    } else if (this.isAnkiAvailable === false) {
      return `<button class="anki-btn anki-unavailable" disabled title="Anki not available. Make sure Anki is running with AnkiConnect add-on.">Anki Offline</button>`;
    } else {
      return `<button class="anki-btn anki-available">Add to Anki</button>`;
    }
  }

  setupPopupEventListeners(character) {
    const addVocabBtn = this.popup.querySelector(
      ".add-vocab-btn:not([disabled])"
    );
    const markKnownBtn = this.popup.querySelector(".mark-known-btn");
    const markUnknownBtn = this.popup.querySelector(".mark-unknown-btn");
    const closeBtn = this.popup.querySelector(".close-btn");
    const ankiBtn = this.popup.querySelector(".anki-btn");

    addVocabBtn?.addEventListener("click", () => this.addToVocab(character));

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

        this.hidePopup();
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

        this.hidePopup();
      });
    }

    // Anki button event listener
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        await this.handleAnkiCardCreation(character, ankiBtn);
      });
    }

    closeBtn?.addEventListener("click", () => this.hidePopup());
  }

  // Handle Anki card creation
  async handleAnkiCardCreation(character, button) {
    try {
      // Update button to show loading state
      const originalText = button.textContent;
      button.textContent = "Creating...";
      button.disabled = true;

      // Get frequency data if available
      let frequency = "";
      if (this.frequencyManager) {
        frequency = this.frequencyManager.getFrequency(character) || "";
      }

      // Create card using the correct method name
      const result = await this.ankiManager.createCardFromPopup(
        character,
        this.dictionaryManager,
        { frequency: frequency }
      ); // FIXED: Was createEnhancedCard

      if (result.success) {
        // Success feedback
        button.textContent = "✓ Added!";
        button.className = "anki-btn anki-success";

        // Show success message briefly
        setTimeout(() => {
          this.hidePopup();
        }, 1000);

        console.log(`✅ Successfully created Anki card for: ${character}`);

        // Optional: Save to vocabulary list as well
        this.saveToVocabList(character);
      } else {
        // Error feedback
        if (result.error === "Card already exists") {
          button.textContent = "Already exists";
          button.className = "anki-btn anki-duplicate";
        } else {
          button.textContent = "Error";
          button.className = "anki-btn anki-error";
          console.error("Anki card creation failed:", result.error);
        }

        // Reset button after 2 seconds
        setTimeout(() => {
          button.textContent = originalText;
          button.className = "anki-btn anki-available";
          button.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error("Error in Anki card creation:", error);

      // Error feedback
      button.textContent = "Error";
      button.className = "anki-btn anki-error";

      // Reset button after 2 seconds
      setTimeout(() => {
        button.textContent = "Add to Anki";
        button.className = "anki-btn anki-available";
        button.disabled = false;
      }, 2000);
    }
  }

  // Save word to vocabulary list when looked up
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

  // Increment daily session counter
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
