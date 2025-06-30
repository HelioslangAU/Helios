class EnhancedAnkiManager {
  constructor() {
    this.ankiConnectUrl = "http://127.0.0.1:8765";
    this.defaultDeck = "Chinese::Helios";
    this.defaultNoteType = "Basic";
    this.isAnkiAvailable = null;
  }

  // Enhanced sentence extraction with intelligent boundaries
  extractSmartContext(character) {
    try {
      console.log("Extracting smart context for:", character);

      // Get the highlighted element
      const highlight = document.querySelector(".lookup-highlight");
      if (!highlight) {
        console.warn("No highlight found, using fallback context extraction");
        return this.extractFallbackContext(character);
      }

      // Find the text container
      let contextNode = highlight.parentNode;
      let attempts = 0;

      while (contextNode && attempts < 8) {
        const text = contextNode.textContent || "";

        // Try different sentence boundary patterns for Chinese text
        const sentences = this.splitIntoSentences(text);

        for (const sentence of sentences) {
          if (
            sentence.includes(character) &&
            sentence.trim().length > character.length
          ) {
            const cleanSentence = sentence.trim();
            console.log("Found context sentence:", cleanSentence);

            return {
              sentence: cleanSentence,
              highlightedSentence: this.highlightWordInSentence(
                cleanSentence,
                character
              ),
              source: "smart_extraction",
              confidence: "high",
            };
          }
        }

        contextNode = contextNode.parentNode;
        attempts++;
      }

      // Fallback to simpler extraction
      return this.extractFallbackContext(character);
    } catch (error) {
      console.error("Error in smart context extraction:", error);
      return this.extractFallbackContext(character);
    }
  }

  // Split text into sentences using Chinese punctuation
  splitIntoSentences(text) {
    if (!text) return [];

    // Chinese sentence endings: 。！？；
    // Also handle English punctuation: . ! ?
    const sentencePattern = /[^。！？；.!?]*[。！？；.!?]/g;
    const sentences = text.match(sentencePattern) || [];

    // If no sentences found with punctuation, try splitting by common breaks
    if (sentences.length === 0) {
      // Split by line breaks or double spaces
      return text.split(/\n|\r\n|  +/).filter((s) => s.trim().length > 0);
    }

    return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  // Highlight the target word within the sentence
  highlightWordInSentence(sentence, word) {
    if (!sentence || !word) return sentence;

    // Create highlighted version
    const highlighted = sentence.replace(
      new RegExp(`(${this.escapeRegex(word)})`, "g"),
      '<mark style="background: linear-gradient(135deg, #ff6b35, #ff8c42); color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;">$1</mark>'
    );

    return highlighted;
  }

  // Escape special regex characters
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Fallback context extraction
  extractFallbackContext(character) {
    try {
      const highlight = document.querySelector(".lookup-highlight");
      if (!highlight || !highlight.parentNode) {
        return {
          sentence: "",
          highlightedSentence: "",
          source: "fallback",
          confidence: "low",
        };
      }

      const parentText = highlight.parentNode.textContent || "";
      const charIndex = parentText.indexOf(character);

      if (charIndex !== -1) {
        // Extract surrounding context (50 chars before and after)
        const start = Math.max(0, charIndex - 50);
        const end = Math.min(parentText.length, charIndex + 50);
        const context = parentText.substring(start, end).trim();

        return {
          sentence: context,
          highlightedSentence: this.highlightWordInSentence(context, character),
          source: "fallback",
          confidence: "medium",
        };
      }

      return {
        sentence: "",
        highlightedSentence: "",
        source: "fallback",
        confidence: "low",
      };
    } catch (error) {
      console.error("Error in fallback context extraction:", error);
      return {
        sentence: "",
        highlightedSentence: "",
        source: "fallback",
        confidence: "low",
      };
    }
  }

  // Translate sentence to English (using a translation service)
  async translateSentence(chineseSentence) {
    try {
      // For now, we'll use a simple translation API or service
      // You could integrate with Google Translate, DeepL, or other services

      // Placeholder implementation - you can integrate with translation APIs
      console.log("Translating sentence:", chineseSentence);

      // Basic translation patterns for common phrases
      const quickTranslations = {
        嘉宾朋友们: "Dear guests and friends",
        这个答案是对的: "This answer is correct",
        我们一起学习: "We study together",
        今天天气很好: "The weather is very good today",
      };

      // Check for quick translations
      for (const [chinese, english] of Object.entries(quickTranslations)) {
        if (chineseSentence.includes(chinese)) {
          return english;
        }
      }

      // For now, return a placeholder
      // TODO: Integrate with real translation service
      return `[Translation of: ${chineseSentence}]`;
    } catch (error) {
      console.error("Translation error:", error);
      return "[Translation unavailable]";
    }
  }

  // Create enhanced card with context and translation
  async createEnhancedCard(character, dictionaryManager, options = {}) {
    try {
      console.log("Creating enhanced card for:", character);

      // Get word data from dictionary
      const matches = dictionaryManager.dictionary[character] || [];
      if (matches.length === 0) {
        throw new Error("Word not found in dictionary");
      }

      const wordMatch = matches[0];

      // Extract smart context
      const contextData = this.extractSmartContext(character);
      console.log("Context data:", contextData);

      // Translate the sentence
      const translation = await this.translateSentence(contextData.sentence);

      // Get frequency data if available
      let frequency = "";
      if (window.frequencyManager) {
        frequency = window.frequencyManager.getFrequency(character) || "";
      }

      // Prepare enhanced card data
      const enhancedCardData = {
        // Core word data
        character: character,
        traditional: wordMatch.traditional,
        simplified: wordMatch.simplified,
        pinyin: wordMatch.pinyin,
        definition: wordMatch.definition,

        // Enhanced context data
        sentence: contextData.sentence,
        highlightedSentence: contextData.highlightedSentence,
        sentenceTranslation: translation,

        // Metadata
        url: window.location.href,
        frequency: frequency,
        extractionSource: contextData.source,
        extractionConfidence: contextData.confidence,
        timestamp: new Date().toISOString(),
      };

      console.log("Enhanced card data:", enhancedCardData);

      // Send to background script for card creation
      return await this.sendMessage("CREATE_ENHANCED_ANKI_CARD", {
        cardData: enhancedCardData,
        options: options,
      });
    } catch (error) {
      console.error("Error creating enhanced card:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Send message to background script
  async sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (
        !window.chrome ||
        !window.chrome.runtime ||
        !window.chrome.runtime.sendMessage
      ) {
        reject(new Error("Chrome extension context not available"));
        return;
      }

      try {
        chrome.runtime.sendMessage({ type, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || "Unknown error"));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
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

  // Get card creation settings
  async getSettings() {
    try {
      const response = await this.sendMessage("GET_ANKI_SETTINGS");
      return response.settings;
    } catch (error) {
      console.error("Error getting Anki settings:", error);
      return {
        deck: this.defaultDeck,
        noteType: this.defaultNoteType,
        fieldMappings: {
          expression: "Front",
          reading: "Back",
          meaning: "Back",
          sentence: "",
          translation: "",
        },
        checkDuplicates: true,
        allowDuplicates: false,
        tags: ["helios", "context"],
      };
    }
  }

  // Test connection
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
