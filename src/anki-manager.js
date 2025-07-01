class AnkiManager {
  constructor() {
    this.ankiConnectUrl = "http://127.0.0.1:8765";
    this.defaultDeck = "Chinese::Helios";
    this.defaultNoteType = "Basic";
    this.isAnkiAvailable = null;
  }

  // Check if AnkiConnect is available (via background script)
  async checkAnkiConnect() {
    try {
      const response = await this.sendMessage("CHECK_ANKI_CONNECT");
      this.isAnkiAvailable = response.isAvailable;
      return this.isAnkiAvailable;
    } catch (error) {
      console.warn("AnkiConnect not available:", error);
      this.isAnkiAvailable = false;
      return false;
    }
  }

  // FIXED: Send message to background script with better error handling
  async sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      // Check if we're in a chrome extension context
      if (
        !window.chrome ||
        !window.chrome.runtime ||
        !window.chrome.runtime.sendMessage
      ) {
        reject(new Error("Chrome extension context not available"));
        return;
      }

      try {
        const messageData = { type, ...data };
        console.log("🃏 Sending message to background:", messageData);

        chrome.runtime.sendMessage(messageData, (response) => {
          if (chrome.runtime.lastError) {
            console.error("🃏 Chrome runtime error:", chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            console.log("🃏 Background response success:", response);
            resolve(response);
          } else {
            console.error("🃏 Background response error:", response);
            reject(new Error(response?.error || "Unknown error"));
          }
        });
      } catch (error) {
        console.error("🃏 Error sending message:", error);
        reject(error);
      }
    });
  }

  // Create deck if it doesn't exist (via background script)
  async ensureDeckExists(deckName = this.defaultDeck) {
    // This is now handled by the background script
    return true;
  }

  // Get available note types (via background script)
  async getNoteTypes() {
    try {
      const response = await this.sendMessage("GET_ANKI_NOTE_TYPES");
      return response.noteTypes || [];
    } catch (error) {
      console.error("Error getting note types:", error);
      return ["Basic", "Basic (and reversed card)", "Cloze"];
    }
  }

  // FIXED: Create basic Chinese learning card (via background script)
  async createCard(wordData, options = {}) {
    try {
      console.log(
        "🃏 Creating card with word data:",
        wordData,
        "options:",
        options
      );

      // Validate input data
      if (!wordData) {
        throw new Error("No word data provided");
      }

      // Ensure we have at least some character data
      if (
        !wordData.character &&
        !wordData.simplified &&
        !wordData.traditional
      ) {
        throw new Error("No character data provided in word data");
      }

      const response = await this.sendMessage("CREATE_ANKI_CARD", {
        wordData,
        options,
      });

      console.log("🃏 Card creation response:", response);

      return {
        success: true,
        noteId: response.noteId,
        message: response.message,
      };
    } catch (error) {
      console.error("🃏 Error creating Anki card:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // REMOVED: prepareCardFields - This is now handled in the background script

  // Find duplicate cards (via background script)
  async findDuplicates(expression) {
    try {
      // This is now handled by the background script during card creation
      return [];
    } catch (error) {
      console.error("Error finding duplicates:", error);
      return [];
    }
  }

  // FIXED: Get card creation settings from storage (via background script)
  async getSettings() {
    try {
      const response = await this.sendMessage("GET_ANKI_SETTINGS");
      console.log("🃏 Retrieved Anki settings:", response.settings);
      return response.settings;
    } catch (error) {
      console.error("Error getting Anki settings:", error);
      // Return sensible defaults
      return {
        ankiDeck: this.defaultDeck,
        deck: this.defaultDeck, // compatibility
        ankiNoteType: this.defaultNoteType,
        noteType: this.defaultNoteType, // compatibility
        ankiFieldMappings: {},
        fieldMappings: {}, // compatibility
        checkDuplicates: true,
        allowDuplicates: false,
        includeSentence: true,
        includeUrl: true,
        tags: ["helios"],
      };
    }
  }

  // Save card creation settings (via background script)
  async saveSettings(settings) {
    try {
      await this.sendMessage("SAVE_ANKI_SETTINGS", { settings });
      return true;
    } catch (error) {
      console.error("Error saving Anki settings:", error);
      return false;
    }
  }

  // FIXED: Create card from popup context with better data preparation
  async createCardFromPopup(character, dictionaryManager, options = {}) {
    try {
      console.log("🃏 Creating card from popup for character:", character);

      // Validate inputs
      if (!character) {
        throw new Error("No character provided");
      }

      if (!dictionaryManager || !dictionaryManager.dictionary) {
        throw new Error("Dictionary manager not available");
      }

      // Get word data from dictionary
      const matches = dictionaryManager.dictionary[character] || [];
      if (matches.length === 0) {
        throw new Error(`Word "${character}" not found in dictionary`);
      }

      // Use first match (most common)
      const wordMatch = matches[0];
      console.log("🃏 Dictionary match found:", wordMatch);

      // Get sentence context (try to find the highlighted text in context)
      let sentence = "";
      try {
        sentence = this.extractSentenceContext(character);
        console.log("🃏 Extracted sentence context:", sentence);
      } catch (error) {
        console.warn("Could not extract sentence context:", error);
      }

      // FIXED: Prepare word data with consistent field names
      const wordData = {
        character: character,
        traditional: wordMatch.traditional || character,
        simplified: wordMatch.simplified || character,
        pinyin: wordMatch.pinyin || wordMatch.reading || "",
        definition: wordMatch.definition || wordMatch.meaning || "",
        sentence: sentence,
        url: window.location.href,
        frequency: options.frequency || wordMatch.frequency || "",
      };

      console.log("🃏 Prepared word data:", wordData);

      // Get user settings
      const settings = await this.getSettings();
      console.log("🃏 Retrieved settings:", settings);

      // FIXED: Prepare final options with proper key names
      const finalOptions = {
        deck:
          options.deck ||
          settings.ankiDeck ||
          settings.deck ||
          this.defaultDeck,
        noteType:
          options.noteType ||
          settings.ankiNoteType ||
          settings.noteType ||
          this.defaultNoteType,
        fieldMappings:
          options.fieldMappings ||
          settings.ankiFieldMappings ||
          settings.fieldMappings ||
          {},
        checkDuplicates:
          options.checkDuplicates !== undefined
            ? options.checkDuplicates
            : settings.checkDuplicates !== undefined
            ? settings.checkDuplicates
            : true,
        allowDuplicates:
          options.allowDuplicates !== undefined
            ? options.allowDuplicates
            : settings.allowDuplicates !== undefined
            ? settings.allowDuplicates
            : false,
        tags: options.tags || settings.tags || ["helios"],
        includeSentence:
          options.includeSentence !== undefined
            ? options.includeSentence
            : settings.includeSentence !== undefined
            ? settings.includeSentence
            : true,
      };

      console.log("🃏 Final options for card creation:", finalOptions);

      // Create the card
      return await this.createCard(wordData, finalOptions);
    } catch (error) {
      console.error("🃏 Error creating card from popup:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // IMPROVED: Extract sentence context around the character
  extractSentenceContext(character) {
    try {
      console.log("🃏 Extracting sentence context for:", character);

      // Try to get the sentence containing the highlighted character
      const highlight = document.querySelector(
        ".lookup-highlight, .helios-highlight, [data-helios-highlight]"
      );
      if (!highlight) {
        console.log("🃏 No highlight element found, trying selection");

        // Try to get selected text context
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          if (container.nodeType === Node.TEXT_NODE) {
            return this.extractContextFromTextNode(container, character);
          }
        }

        return "";
      }

      let contextNode = highlight.parentNode;
      let attempts = 0;

      // Walk up the DOM to find a good context container
      while (contextNode && attempts < 5) {
        const text = contextNode.textContent || "";

        // Look for sentence boundaries
        const sentences = text.split(/[.!?。！？\n]/).filter((s) => s.trim());
        for (const sentence of sentences) {
          if (
            sentence.includes(character) &&
            sentence.trim().length > character.length &&
            sentence.trim().length < 200 // Reasonable sentence length
          ) {
            console.log("🃏 Found sentence context:", sentence.trim());
            return sentence.trim();
          }
        }

        contextNode = contextNode.parentNode;
        attempts++;
      }

      // Fallback: try to get some surrounding text
      if (highlight.parentNode) {
        const parentText = highlight.parentNode.textContent || "";
        const charIndex = parentText.indexOf(character);
        if (charIndex !== -1) {
          const start = Math.max(0, charIndex - 30);
          const end = Math.min(parentText.length, charIndex + 30);
          const context = parentText.substring(start, end).trim();
          console.log("🃏 Fallback context:", context);
          return context;
        }
      }

      return "";
    } catch (error) {
      console.warn("🃏 Error extracting sentence context:", error);
      return "";
    }
  }

  // Helper method to extract context from text node
  extractContextFromTextNode(textNode, character) {
    try {
      const text = textNode.textContent || "";
      const charIndex = text.indexOf(character);
      if (charIndex === -1) return "";

      // Try to find sentence boundaries around the character
      let start = charIndex;
      let end = charIndex;

      // Look backwards for sentence start
      while (
        start > 0 &&
        ![".", "!", "?", "。", "！", "？", "\n"].includes(text[start - 1])
      ) {
        start--;
      }

      // Look forwards for sentence end
      while (
        end < text.length - 1 &&
        ![".", "!", "?", "。", "！", "？", "\n"].includes(text[end + 1])
      ) {
        end++;
      }

      const sentence = text.substring(start, end + 1).trim();
      return sentence.length > character.length ? sentence : "";
    } catch (error) {
      console.warn("Error extracting context from text node:", error);
      return "";
    }
  }

  // Test connection and show status (via background script)
  async testConnection() {
    try {
      const response = await this.sendMessage("TEST_ANKI_CONNECTION");
      return {
        success: true,
        message: response.message,
        version: response.version,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Get available decks from Anki (via background script)
  async getDecks() {
    try {
      const response = await this.sendMessage("GET_ANKI_DECKS");
      return response.decks || [];
    } catch (error) {
      console.error("Error getting decks:", error);
      return [];
    }
  }

  // Get fields for a specific note type (via background script)
  async getNoteTypeFields(noteType) {
    try {
      const response = await this.sendMessage("GET_ANKI_NOTE_TYPE_FIELDS", {
        noteType,
      });
      return response.fields || [];
    } catch (error) {
      console.error("Error getting note type fields:", error);
      return [];
    }
  }

  // IMPROVED: Validate current settings
  validateSettings(settings) {
    const errors = [];

    if (!settings.ankiDeck && !settings.deck) {
      errors.push("Please select a deck");
    }

    if (!settings.ankiNoteType && !settings.noteType) {
      errors.push("Please select a note type");
    }

    // Check if at least one field is mapped (either key structure)
    const fieldMappings =
      settings.ankiFieldMappings || settings.fieldMappings || {};
    const hasMappings = Object.values(fieldMappings).some(
      (value) => value && value.trim()
    );

    if (!hasMappings) {
      // This is just a warning, not an error - auto-mapping will handle it
      console.warn("No field mappings found - will use auto-mapping");
    }

    return errors;
  }

  // Get current settings for export
  exportSettings(settings) {
    return JSON.stringify(settings, null, 2);
  }

  // Import settings from JSON
  async importSettings(jsonString) {
    try {
      const importedSettings = JSON.parse(jsonString);

      // Validate imported settings
      const errors = this.validateSettings(importedSettings);
      if (errors.length > 0) {
        throw new Error(`Invalid settings: ${errors.join(", ")}`);
      }

      // Save imported settings
      const success = await this.saveSettings(importedSettings);
      return success;
    } catch (error) {
      console.error("Error importing settings:", error);
      return false;
    }
  }

  // Check if Anki is available and ready
  async isReady() {
    try {
      return await this.checkAnkiConnect();
    } catch (error) {
      return false;
    }
  }

  // IMPROVED: Get comprehensive status information
  async getStatus() {
    try {
      const isConnected = await this.checkAnkiConnect();

      if (!isConnected) {
        return {
          connected: false,
          message: "AnkiConnect not available",
          ready: false,
        };
      }

      const settings = await this.getSettings();
      const errors = this.validateSettings(settings);

      return {
        connected: true,
        message: "Connected to AnkiConnect",
        ready: errors.length === 0,
        settings: settings,
        errors: errors,
      };
    } catch (error) {
      return {
        connected: false,
        message: error.message,
        ready: false,
        error: error,
      };
    }
  }

  // Create multiple cards in batch
  async createCardsBatch(wordDataArray, options = {}) {
    const results = [];

    for (const wordData of wordDataArray) {
      try {
        const result = await this.createCard(wordData, options);
        results.push({
          word:
            wordData.character || wordData.simplified || wordData.traditional,
          success: result.success,
          noteId: result.noteId,
          error: result.error,
        });
      } catch (error) {
        results.push({
          word:
            wordData.character || wordData.simplified || wordData.traditional,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  // FIXED: Helper method to create card with automatic field mapping
  async createCardSmart(character, dictionaryManager, userSettings = {}) {
    try {
      console.log(
        "🃏 Smart card creation for:",
        character,
        "with settings:",
        userSettings
      );

      // Get current settings
      const settings = await this.getSettings();
      const finalSettings = { ...settings, ...userSettings };

      console.log("🃏 Final settings for smart creation:", finalSettings);

      // Validate settings before creating card
      const errors = this.validateSettings(finalSettings);
      if (errors.length > 0) {
        console.warn("🃏 Settings validation warnings:", errors);
        // Don't throw error - let background script handle with auto-mapping
      }

      // Create card with validated settings
      return await this.createCardFromPopup(
        character,
        dictionaryManager,
        finalSettings
      );
    } catch (error) {
      console.error("🃏 Error in smart card creation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ADDED: Quick method for popup usage - simplified interface
  async quickCreateCard(character, dictionaryManager) {
    try {
      console.log("🃏 Quick card creation for:", character);

      // Use default settings
      return await this.createCardFromPopup(character, dictionaryManager, {});
    } catch (error) {
      console.error("🃏 Error in quick card creation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ADDED: Get simplified status for popup display
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
}
