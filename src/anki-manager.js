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

  // Send message to background script
  async sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error("Chrome runtime not available"));
        return;
      }

      chrome.runtime.sendMessage({ type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || "Unknown error"));
        }
      });
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
      // Note: This would need a separate message type if needed
      return ["Basic", "Basic (and reversed card)", "Cloze"];
    } catch (error) {
      console.error("Error getting note types:", error);
      return [];
    }
  }

  // Create basic Chinese learning card (via background script)
  async createCard(wordData, options = {}) {
    try {
      const response = await this.sendMessage("CREATE_ANKI_CARD", {
        wordData,
        options,
      });

      return {
        success: true,
        noteId: response.noteId,
        message: response.message,
      };
    } catch (error) {
      console.error("Error creating Anki card:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Prepare card fields from word data
  prepareCardFields(wordData, options = {}) {
    const {
      character,
      traditional,
      simplified,
      pinyin,
      definition,
      sentence,
      url,
      frequency,
    } = wordData;

    // Basic field mapping for most common note types
    const fields = {
      // Primary fields
      Expression: character || simplified || traditional,
      Reading: pinyin || "",
      Meaning: definition || "",

      // Additional fields (will be ignored if note type doesn't have them)
      Sentence: sentence || "",
      Traditional: traditional || character,
      Simplified: simplified || character,
      Source: url || window.location.href,
      Frequency: frequency || "",

      // Alternative field names for compatibility
      Front: character || simplified || traditional,
      Back: `${pinyin || ""}<br>${definition || ""}`,
      Chinese: character || simplified || traditional,
      Pinyin: pinyin || "",
      English: definition || "",
      Context: sentence || "",
      URL: url || window.location.href,
    };

    return fields;
  }

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

  // Get card creation settings from storage (via background script)
  async getSettings() {
    try {
      const response = await this.sendMessage("GET_ANKI_SETTINGS");
      return response.settings;
    } catch (error) {
      console.error("Error getting Anki settings:", error);
      return {
        deck: this.defaultDeck,
        noteType: this.defaultNoteType,
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

  // Create card from popup context
  async createCardFromPopup(character, dictionaryManager, options = {}) {
    try {
      // Get word data from dictionary
      const matches = dictionaryManager.dictionary[character] || [];
      if (matches.length === 0) {
        throw new Error("Word not found in dictionary");
      }

      // Use first match (most common)
      const wordMatch = matches[0];

      // Get sentence context (try to find the highlighted text in context)
      let sentence = "";
      try {
        sentence = this.extractSentenceContext(character);
      } catch (error) {
        console.warn("Could not extract sentence context:", error);
      }

      // Prepare word data
      const wordData = {
        character: character,
        traditional: wordMatch.traditional,
        simplified: wordMatch.simplified,
        pinyin: wordMatch.pinyin,
        definition: wordMatch.definition,
        sentence: sentence,
        url: window.location.href,
        frequency: options.frequency || "",
      };

      // Get user settings
      const settings = await this.getSettings();

      // Create the card
      return await this.createCard(wordData, {
        deck: options.deck || settings.deck,
        noteType: options.noteType || settings.noteType,
        checkDuplicates: settings.checkDuplicates,
        allowDuplicates: settings.allowDuplicates,
        tags: options.tags || settings.tags,
      });
    } catch (error) {
      console.error("Error creating card from popup:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Extract sentence context around the character
  extractSentenceContext(character) {
    try {
      // Try to get the sentence containing the highlighted character
      const highlight = document.querySelector(".lookup-highlight");
      if (!highlight) return "";

      let contextNode = highlight.parentNode;
      let attempts = 0;

      // Walk up the DOM to find a good context container
      while (contextNode && attempts < 5) {
        const text = contextNode.textContent || "";

        // Look for sentence boundaries
        const sentences = text.split(/[.!?。！？]/).filter((s) => s.trim());
        for (const sentence of sentences) {
          if (
            sentence.includes(character) &&
            sentence.trim().length > character.length
          ) {
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
          const start = Math.max(0, charIndex - 50);
          const end = Math.min(parentText.length, charIndex + 50);
          return parentText.substring(start, end).trim();
        }
      }

      return "";
    } catch (error) {
      console.warn("Error extracting sentence context:", error);
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
}
