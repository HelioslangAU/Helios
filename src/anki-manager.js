// Updated Content Script AnkiManager - Simplified and Clean
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
      return ["Front", "Back"];
    }
  }

  // Create card from character
  async createCard(character, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error("AnkiManager not initialized");
      }

      if (!character) {
        throw new Error("Character is required");
      }

      // Extract word data
      const wordData = this.extractWordData(character);

      // Create card via background script
      const response = await this.sendMessage("ANKI_CREATE_CARD", {
        wordData,
        options,
      });

      if (response.success) {
        console.log("🃏 Card created successfully:", response.noteId);
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
      return {
        success: false,
        error: error.message,
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
      // Method 1: Find highlighted element
      const highlight = document.querySelector(
        ".lookup-highlight, .helios-highlight"
      );
      if (highlight) {
        const context = this.getContextFromElement(highlight, character);
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

  // Quick create card (for popup usage)
  async quickCreateCard(character, dictionaryManager) {
    if (!this.isInitialized) {
      this.initialize(dictionaryManager);
    }

    return await this.createCard(character);
  }

  // Create card from popup context
  async createCardFromPopup(character, dictionaryManager, options = {}) {
    if (!this.isInitialized) {
      this.initialize(dictionaryManager);
    }

    return await this.createCard(character, options);
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

  // Validate settings
  validateSettings(settings) {
    const errors = [];

    if (!settings.deck) {
      errors.push("Please select a deck");
    }

    if (!settings.noteType) {
      errors.push("Please select a note type");
    }

    return errors;
  }

  // Create multiple cards in batch
  async createCardsBatch(characters, dictionaryManager) {
    if (!this.isInitialized) {
      this.initialize(dictionaryManager);
    }

    const results = [];

    for (const character of characters) {
      try {
        const result = await this.createCard(character);
        results.push({
          character: character,
          success: result.success,
          noteId: result.noteId,
          error: result.error,
        });
      } catch (error) {
        results.push({
          character: character,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Smart card creation with auto-retry
  async createCardSmart(character, dictionaryManager, userSettings = {}) {
    if (!this.isInitialized) {
      this.initialize(dictionaryManager);
    }

    // First check if we're ready
    const ready = await this.isReady();
    if (!ready) {
      const status = await this.getStatus();
      if (!status.connected) {
        throw new Error(
          "Anki is not connected. Please ensure Anki is running with AnkiConnect installed."
        );
      }

      const settings = await this.getSettings();
      const errors = this.validateSettings(settings);
      if (errors.length > 0) {
        throw new Error(`Settings incomplete: ${errors.join(", ")}`);
      }
    }

    // Create card with user settings
    return await this.createCard(character, userSettings);
  }
}

// Export for use in other scripts
if (typeof window !== "undefined") {
  window.AnkiManager = AnkiManager;
}
