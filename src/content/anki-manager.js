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
  async extractWordData(character, options = {}) {
    // Get current language from registry
    const currentLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

    const wordData = {
      character: character,
      language: currentLanguage, // Add language to wordData
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Get dictionary data
    if (this.dictionaryManager?.dictionary) {
      const matches = this.dictionaryManager.dictionary[character];
      if (matches && matches.length > 0) {
        const match = matches[0];
        // Traditional/simplified only exist for Chinese
        wordData.traditional = match.traditional || character;
        wordData.simplified = match.simplified || character;
        // Use pinyin for Chinese, pronunciation for other languages
        wordData.pinyin = match.pinyin || match.pronunciation || match.reading || "";
        wordData.definition = match.definition || match.meaning || "";
        wordData.frequency = match.frequency || match.frq || "";
      }
    }

    // Extract sentence context
    wordData.sentence = this.extractSentenceContext(character);

    // Capture media if requested and available
    if (options.captureMedia !== false) {
      await this.captureMediaForCard(wordData);
    }

    return wordData;
  }

  // Capture screenshot and audio for Anki card
  async captureMediaForCard(wordData) {
    try {
      // Check if we need to capture media (based on settings)
      const needsMedia = await this.checkIfNeedsMedia();
      if (!needsMedia) {
        return;
      }

      // Capture screenshot if on video platform or if screenshot field is mapped
      if (window.HeliosScreenshotCapturer) {
        console.log('[Helios Anki] Capturing screenshot...');
        const screenshot = await window.HeliosScreenshotCapturer.captureIntelligent();
        if (screenshot) {
          wordData.screenshotDataUrl = screenshot;
          console.log('[Helios Anki] Screenshot captured');
        }
      }

      // Capture audio if on video platform with subtitles
      if (window.HeliosAudioRecorder && this.isOnVideoPage()) {
        const audioData = await this.captureAudioForSentence(wordData.sentence);
        if (audioData) {
          wordData.sentenceAudioDataUrl = audioData;
          console.log('[Helios Anki] Audio captured');
        }
      }

    } catch (error) {
      console.warn('[Helios Anki] Error capturing media:', error);
      // Non-critical, continue without media
    }
  }

  // Check if media capture is needed based on field mappings
  async checkIfNeedsMedia() {
    try {
      const response = await this.sendMessage("ANKI_CHECK_MEDIA_NEEDED");
      return response.needsScreenshot || response.needsAudio;
    } catch (error) {
      // If we can't check, assume we need it
      return true;
    }
  }

  // Check if we're on a video page
  isOnVideoPage() {
    // Check if platform detector exists and identifies a video platform
    if (window.PlatformDetector) {
      const platform = window.PlatformDetector.detectPlatform();
      return platform !== 'unknown';
    }

    // Fallback: check for video elements
    const videos = document.querySelectorAll('video');
    return videos.length > 0;
  }

  // Capture audio for sentence with subtitle timing (like asbplayer)
  async captureAudioForSentence(sentence, character) {
    try {
      if (!sentence || !window.HeliosAudioRecorder) {
        return null;
      }

      // Try to get subtitle timing - pass character to find the actual subtitle line
      const timing = this.getSubtitleTimingForCharacter(character || sentence);

      // Find video element
      const videoElement = window.HeliosScreenshotCapturer?.findVideoElement();
      if (!videoElement) {
        console.warn('[Helios Anki] No video element found for audio capture');
        return null;
      }

      const paddingBefore = 250; // milliseconds (0.25 seconds)
      const paddingAfter = 250; // milliseconds (0.25 seconds)

      if (!timing) {
        console.warn('[Helios Anki] No subtitle timing found, cannot record audio');
        return null;
      }

      // Like asbplayer's approach:
      // 1. Calculate seek position: subtitle.start - paddingBefore
      // 2. Calculate record duration: (subtitle.end - subtitle.start) + paddingAfter
      // 3. Seek and play
      // 4. Start recording

      const subtitleStart = timing.start; // ms
      const subtitleEnd = timing.end; // ms

      // Seek to position (with padding before)
      const seekToTimeMs = Math.max(0, subtitleStart - paddingBefore);
      const seekToTimeSec = seekToTimeMs / 1000;

      // Duration to record
      const recordDurationMs = (subtitleEnd - subtitleStart) + paddingAfter;

      console.log('[Helios Anki] Recording audio for subtitle:', {
        text: timing.text,
        subtitleStart: subtitleStart + 'ms',
        subtitleEnd: subtitleEnd + 'ms',
        seekTo: seekToTimeSec + 's',
        recordDuration: recordDurationMs + 'ms'
      });

      // Record audio using asbplayer's approach
      const audioDataUrl = await window.HeliosAudioRecorder.recordFromVideo(
        videoElement,
        seekToTimeSec,
        recordDurationMs
      );

      return audioDataUrl;

    } catch (error) {
      console.error('[Helios Anki] Error capturing audio:', error);
      return null;
    }
  }

  // Get subtitle timing for a character/word - finds the full subtitle line containing the word
  getSubtitleTimingForCharacter(character) {
    try {
      // Try to access video feature manager for subtitle data
      if (window.videoFeatureManager?.subtitleCollection) {
        const subtitles = window.videoFeatureManager.subtitleCollection.subtitles;

        // Find subtitle entry containing this character/word
        for (const subtitle of subtitles) {
          if (subtitle.text && subtitle.text.includes(character)) {
            console.log('[Helios Anki] Found subtitle line for character "' + character + '":', subtitle.text);
            return {
              start: subtitle.start,
              end: subtitle.end,
              text: subtitle.text  // Return full subtitle text for logging
            };
          }
        }

        console.warn('[Helios Anki] No subtitle found containing character:', character);
      }

      return null;
    } catch (error) {
      console.warn('[Helios Anki] Could not get subtitle timing:', error);
      return null;
    }
  }

  // Extract sentence context from the page
  extractSentenceContext(character) {
    try {
      // Method 1: Find highlighted element and start from it
      const highlight = document.querySelector(
        ".lookup-highlight, .helios-highlight"
      );
      if (highlight) {
        // Start the search from the highlight element itself and walk up.
        const context = this.getContextFromElement(highlight, character);
        if (context) return context;
      }

      // Method 2: Fallback search in visible text elements
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
    let bestSentence = '';

    // Walk up DOM tree to find good context
    for (let i = 0; i < 5 && current; i++) {
      const text = current.textContent || "";
      // This is the key change: ensure we are looking at a container,
      // not just the word itself.
      if (text.includes(character) && text.trim().length > character.length) {
        const sentences = text.split(/[.!?。！？\n]+/);
        for (const sentence of sentences) {
          if (sentence.includes(character)) {
            const trimmedSentence = sentence.trim();
            if (trimmedSentence.length > bestSentence.length && trimmedSentence.length <= 200) {
                bestSentence = trimmedSentence;
            }
          }
        }
      }
      if (bestSentence) break; // Found a good candidate
      current = current.parentNode;
    }
    
    // If no sentence is found after walking up, return the highlight's text content as a last resort.
    if (!bestSentence && element.textContent) {
        bestSentence = element.textContent.trim();
    }

    return bestSentence;
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
        // If we just got a character string, extract everything (including media).
        wordData = await this.extractWordData(data, options);
      } else {
        // If we got an object, it should already have everything, including the pre-captured sentence.
        // We just ensure the timestamp and URL are present.
        wordData = {
          ...data,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        };
        // If sentence is somehow missing, extract it as a fallback.
        if (!wordData.sentence) {
            wordData.sentence = this.extractSentenceContext(data.character);
        }

        // Capture media if not already present
        if (!wordData.screenshotDataUrl && !wordData.sentenceAudioDataUrl) {
          await this.captureMediaForCard(wordData);
        }
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
  // Note: ankiCardsCreated is updated by the background script to avoid double counting
  updateAnkiStatistics(success) {
    try {
      if (chrome.storage?.local) {
        chrome.storage.local.get(
          [
            "ankiCardsCreated", // Read current value but don't increment (background script handles this)
            "ankiCardsToday",
            "ankiSuccessCount",
            "ankiTotalAttempts",
            "lastAnkiResetDate",
          ],
          (result) => {
            const today = new Date().toDateString();
            const lastReset = result.lastAnkiResetDate || "";

            // Don't modify ankiCardsCreated - background script handles this
            let cardsCreated = result.ankiCardsCreated || 0;
            let cardsToday = result.ankiCardsToday || 0;
            let successCount = result.ankiSuccessCount || 0;
            let totalAttempts = result.ankiTotalAttempts || 0;

            // Reset daily counters if new day
            if (lastReset !== today) {
              cardsToday = 0;
            }

            // Update counters (except ankiCardsCreated which is handled by background script)
            totalAttempts++;
            if (success) {
              // Don't increment cardsCreated here - background script already did
              cardsToday++;
              successCount++;
            }

            const successRate =
              totalAttempts > 0
                ? Math.round((successCount / totalAttempts) * 100)
                : 100;

            chrome.storage.local.set({
              // Don't set ankiCardsCreated - background script handles this
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
