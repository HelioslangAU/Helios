// Enhanced AnkiManager - Handles all Anki logic including popup integration
class AnkiManager {
  constructor() {
    this.isInitialized = false;
    this.dictionaryManager = null;
    this.status = {
      connected: false,
      ready: false,
      error: null,
    };
  }

  // Initialize with dictionary manager
  initialize(dictionaryManager) {
    this.dictionaryManager = dictionaryManager;
    this.isInitialized = true;
    console.log("🃏 AnkiManager initialized with dictionary");
  }

  // Send message to background script
  async sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.sendMessage) {
        reject(new Error("Chrome extension context not available"));
        return;
      }

      const message = { action, ...data };
      const timeout = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, 10000);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || "Unknown error"));
        }
      });
    });
  }

  // Test connection to Anki
  async checkAnkiConnect() {
    try {
      const response = await this.sendMessage("ANKI_TEST_CONNECTION");
      this.status.connected = response.success;
      this.status.error = response.error;
      return response.success;
    } catch (error) {
      this.status.connected = false;
      this.status.error = error.message;
      return false;
    }
  }

  // Get current status
  async getStatus() {
    await this.checkAnkiConnect();
    return this.status;
  }

  // Get quick status for popup
  async getQuickStatus() {
    try {
      const isConnected = await this.checkAnkiConnect();
      return {
        available: isConnected,
        message: isConnected ? "Anki Ready" : "Anki Not Available",
      };
    } catch (error) {
      return {
        available: false,
        message: "Connection Error",
      };
    }
  }

  // Extract word data from character and context
  extractWordData(character) {
    const wordData = {
      character: character,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Get dictionary data
    if (this.dictionaryManager?.dictionary) {
      const matches = this.dictionaryManager.dictionary[character];
      if (matches && matches.length > 0) {
        const match = matches[0];
        wordData.traditional = match.traditional || character;
        wordData.simplified = match.simplified || character;
        wordData.pinyin = match.pinyin || match.reading || "";
        wordData.definition = match.definition || match.meaning || "";
        wordData.frequency = match.frequency;
      }
    }

    // Extract sentence context
    wordData.sentence = this.extractSentenceContext(character);

    return wordData;
  }

  // Extract sentence context from the page
  extractSentenceContext(character) {
    try {
      // Method 1: Find highlighted element and start from its parent
      const highlight = document.querySelector(
        ".lookup-highlight, .helios-highlight"
      );
      if (highlight && highlight.parentElement) {
        const context = this.getContextFromElement(highlight.parentElement, character);
        if (context) return context;
      }

      // Method 2: Search in visible text elements
      const textElements = document.querySelectorAll("p, div, span, td, li");
      for (const element of textElements) {
        const text = element.textContent || "";
        if (
          text.includes(character) &&
          text.length > character.length &&
          text.length <= 200
        ) {
          return text.trim();
        }
      }

      return "";
    } catch (error) {
      console.warn("Could not extract sentence context:", error);
      return "";
    }
  }

  // Get context from specific element
  getContextFromElement(element, character) {
    let current = element;

    // Walk up DOM tree to find good context
    for (let i = 0; i < 5; i++) {
      if (!current) break;

      const text = current.textContent || "";
      if (text.includes(character)) {
        // Try to find sentence boundaries
        const sentences = text.split(/[.!?。！？\n]+/);
        for (const sentence of sentences) {
          if (sentence.includes(character) && sentence.trim().length <= 200) {
            return sentence.trim();
          }
        }

        // Fallback: get surrounding text
        const charIndex = text.indexOf(character);
        if (charIndex !== -1) {
          const start = Math.max(0, charIndex - 50);
          const end = Math.min(text.length, charIndex + 50);
          return text.substring(start, end).trim();
        }
      }

      current = current.parentNode;
    }

    return "";
  }

  // Create card from character or word data object
  async createCard(data, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error("AnkiManager not initialized");
      }

      if (!data) {
        throw new Error("Character or word data is required");
      }

      let wordData;
      if (typeof data === 'string') {
        // If we just got a character string, extract everything.
        wordData = this.extractWordData(data);
      } else {
        // If we got an object from the multi-card popup, it has the correct
        // pinyin/definition but is missing page context. We'll add it here.
        const character = data.character;
        if (!character) {
          throw new Error("Character is missing from word data object");
        }
        
        // Combine the specific data from the popup with page context.
        wordData = {
          ...data, // Use pinyin, definition, etc. from the popup card.
          timestamp: new Date().toISOString(),
          url: window.location.href,
          sentence: this.extractSentenceContext(character),
        };
      }

      // Create card via background script
      const response = await this.sendMessage("ANKI_CREATE_CARD", {
        wordData,
        options,
      });

      if (response.success) {
        console.log("🃏 Card created successfully:", response.noteId);

        // Update statistics
        this.updateAnkiStatistics(true);

        return {
          success: true,
          noteId: response.noteId,
          message: response.message,
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("🃏 Card creation failed:", error);

      // Update statistics
      this.updateAnkiStatistics(false);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Handle popup card creation with button management
  async createCardFromPopup(wordData, button, frequencyManager = null) {
    try {
      const character = (typeof wordData === 'string') ? wordData : wordData.character;
      console.log(`🃏 Creating Anki card from popup for: ${character}`);

      // Update button to loading state
      this.updateButtonState(button, "loading");

      // Validate inputs
      if (!character || character.trim() === "") {
        throw new Error("No character provided");
      }

      if (!this.dictionaryManager?.dictionary) {
        throw new Error("Dictionary not available");
      }

      // Get frequency if available
      let frequency = "";
      if (frequencyManager) {
        const freqData = frequencyManager.getFrequency(character);
        frequency = freqData ? freqData.toString() : "";
      }

      // Create card
      const result = await this.createCard(wordData, { frequency });

      if (result.success) {
        // Success state
        this.updateButtonState(button, "success");
        console.log(`✅ Successfully created Anki card for: ${character}`);
        return result;
      } else {
        // Error state
        this.updateButtonState(button, "error", result.error);
        return result;
      }
    } catch (error) {
      console.error("🃏 Error in popup card creation:", error);
      this.updateButtonState(button, "error", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Update button state with different visual states
  updateButtonState(button, state, errorMessage = "") {
    if (!button) return;

    switch (state) {
      case "loading":
        button.textContent = "⏳";
        button.disabled = true;
        button.title = "Creating Anki card...";
        button.className = "anki-btn anki-loading";
        break;

      case "success":
        button.textContent = "✓";
        button.disabled = true;
        button.title = "Successfully added to Anki!";
        button.className = "anki-btn anki-success";
        break;

      case "error":
        const errorType = this.categorizeError(errorMessage);
        button.textContent = errorType.icon;
        button.disabled = true;
        button.title = errorType.message;
        button.className = `anki-btn ${errorType.class}`;

        // Reset button after 3 seconds
        setTimeout(() => {
          this.updateButtonState(button, "default");
        }, 3000);
        break;

      case "default":
        button.textContent = "A";
        button.disabled = false;
        button.title = "Add to Anki";
        button.className = "anki-btn anki-available";
        break;

      case "unavailable":
        button.textContent = "A";
        button.disabled = true;
        button.title = "Anki not available";
        button.className = "anki-btn anki-unavailable";
        break;
    }
  }

  // Categorize errors for better user feedback
  categorizeError(errorMessage) {
    if (errorMessage.includes("already exists")) {
      return {
        icon: "!",
        message: "Card already exists in Anki",
        class: "anki-duplicate",
      };
    } else if (
      errorMessage.includes("not available") ||
      errorMessage.includes("connection")
    ) {
      return {
        icon: "⚠",
        message: "Anki connection lost",
        class: "anki-unavailable",
      };
    } else if (
      errorMessage.includes("deck") ||
      errorMessage.includes("note type") ||
      errorMessage.includes("Settings")
    ) {
      return {
        icon: "⚙",
        message: "Settings incomplete - check Anki settings",
        class: "anki-settings-error",
      };
    } else {
      return {
        icon: "✗",
        message: `Error: ${errorMessage}`,
        class: "anki-error",
      };
    }
  }

  // Update Anki statistics
  updateAnkiStatistics(success) {
    try {
      if (chrome.storage?.local) {
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

            // Reset daily counters if new day
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

            const successRate =
              totalAttempts > 0
                ? Math.round((successCount / totalAttempts) * 100)
                : 100;

            chrome.storage.local.set({
              ankiCardsCreated: cardsCreated,
              ankiCardsToday: cardsToday,
              ankiSuccessCount: successCount,
              ankiTotalAttempts: totalAttempts,
              ankiSuccessRate: successRate,
              lastAnkiResetDate: today,
            });

            console.log(
              `📊 Anki stats: ${cardsCreated} total, ${cardsToday} today, ${successRate}% success`
            );
          }
        );
      }
    } catch (error) {
      console.warn("Could not update Anki statistics:", error);
    }
  }

  // Get available decks
  async getDecks() {
    try {
      const response = await this.sendMessage("ANKI_GET_DECKS");
      return response.decks || [];
    } catch (error) {
      console.error("Error getting decks:", error);
      return [];
    }
  }

  // Get available note types
  async getNoteTypes() {
    try {
      const response = await this.sendMessage("ANKI_GET_NOTE_TYPES");
      return response.noteTypes || [];
    } catch (error) {
      console.error("Error getting note types:", error);
      return ["Basic"];
    }
  }

  // Get fields for a note type
  async getNoteTypeFields(noteType) {
    try {
      const response = await this.sendMessage("ANKI_GET_NOTE_TYPE_FIELDS", {
        noteType,
      });
      return response.fields || [];
    } catch (error) {
      console.error("Error getting note type fields:", error);
      return [];
    }
  }

  // Get current settings
  async getSettings() {
    try {
      const response = await this.sendMessage("ANKI_LOAD_SETTINGS");
      return response.settings || {};
    } catch (error) {
      console.error("Error getting settings:", error);
      return {};
    }
  }

  // Save settings
  async saveSettings(settings) {
    try {
      const response = await this.sendMessage("ANKI_SAVE_SETTINGS", {
        settings,
      });
      return response.success;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.sendMessage("ANKI_TEST_CONNECTION");
      return {
        success: response.success,
        message: response.success
          ? `Connected to AnkiConnect (version ${response.version})`
          : response.error,
        version: response.version,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Check if ready to create cards
  async isReady() {
    try {
      const status = await this.getStatus();
      const settings = await this.getSettings();

      return status.connected && settings.deck && settings.noteType;
    } catch (error) {
      return false;
    }
  }
}

// Export for use in other scripts
if (typeof window !== "undefined") {
  window.AnkiManager = AnkiManager;
}
