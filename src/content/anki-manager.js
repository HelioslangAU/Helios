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
    this.hasSyncedOnConnection = false; // Track if we've synced after connection
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
      // Use longer timeout for deck notes requests (large decks can take time)
      const timeoutDuration = action === "ANKI_GET_DECK_NOTES" ? 60000 : 10000; // 60s for deck notes, 10s for others
      const timeout = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeoutDuration);

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
      const wasConnected = this.status.connected;
      const response = await this.sendMessage("ANKI_TEST_CONNECTION");
      this.status.connected = response.success;
      this.status.error = response.error;
      
      // If we just connected (wasn't connected before, now is), trigger sync
      if (!wasConnected && response.success && !this.hasSyncedOnConnection) {
        this.hasSyncedOnConnection = true;
        // Sync in background (don't block connection check)
        this.syncLearningWordsFromAnki().catch(error => {
          console.warn("🃏 Anki sync on connection failed:", error);
        });
      }
      
      // Reset sync flag if connection is lost
      if (!response.success) {
        this.hasSyncedOnConnection = false;
      }
      
      return response.success;
    } catch (error) {
      this.status.connected = false;
      this.status.error = error.message;
      this.hasSyncedOnConnection = false;
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

  // Format definition for Anki export: replace semicolons with newlines and add bullet points
  formatDefinitionForAnki(definition) {
    if (!definition) return definition;
    // Replace semicolons (with optional spaces) with newlines
    // Handle both "; " and ";" patterns, and also "\n;" from variant enhancements
    let formatted = definition
      .replace(/;\s*/g, '\n')  // Replace "; " or ";" with newline
      .replace(/\n+/g, '\n')  // Collapse multiple newlines into one
      .trim();                 // Remove leading/trailing whitespace
    
    // Split by newlines and add bullet point to each definition
    const lines = formatted.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0); // Remove empty lines
    
    // Add bullet point (∙) to each line and join with <br> for Anki HTML rendering
    return lines.map(line => `∙ ${line}`).join('<br>');
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
        let definition = match.definition || match.meaning || "";

        // Enhance variant definitions (e.g., "variant of {something}") by including base definitions
        const adapter = window.languageRegistry?.getAdapter();
        if (adapter && adapter.enhanceVariantDefinition && definition) {
          definition = await adapter.enhanceVariantDefinition(
            definition,
            this.dictionaryManager.dictionary,
            this.dictionaryManager.getDefinition ?
              (word) => this.dictionaryManager.getDefinition(word) :
              null
          );
        }

        // Format definition: replace semicolons with newlines for Anki export
        wordData.definition = this.formatDefinitionForAnki(definition);
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
  async captureAudioForSentence(sentence) {
    try {
      if (!sentence || !window.HeliosAudioRecorder) {
        return null;
      }

      console.log('[Helios Anki] Capturing audio for sentence:', sentence);

      // Get subtitle timing by finding subtitle containing this sentence
      const timing = this.getSubtitleTimingForSentence(sentence);

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

  // Get subtitle timing for a sentence - finds the subtitle containing this sentence
  getSubtitleTimingForSentence(sentence) {
    try {
      console.log('[Helios Anki] Looking for subtitle for sentence:', sentence);

      // Get the primary video binding (contains subtitle data)
      const binding = this._getPrimaryVideoBinding();
      if (!binding) {
        console.warn('[Helios Anki] No video binding available');
        return null;
      }

      // BEST APPROACH (like asbplayer): Get currently active subtitle from overlay
      if (binding.overlay?.currentSubtitles) {
        const currentSubs = binding.overlay.currentSubtitles;
        if (currentSubs.length > 0) {
          const currentSub = currentSubs[0]; // Get first active subtitle
          console.log('[Helios Anki] Using current active subtitle:', currentSub.text);
          return {
            start: currentSub.start,
            end: currentSub.end,
            text: currentSub.text
          };
        }
      }

      // FALLBACK: Search through all subtitles for match
      const subtitleCollection = binding.getSubtitles();
      if (!subtitleCollection || subtitleCollection.isEmpty()) {
        console.warn('[Helios Anki] No subtitles loaded');
        return null;
      }

      const subtitles = subtitleCollection.getAll();
      console.log('[Helios Anki] Searching through', subtitles.length, 'subtitles');

      // Try exact match first
      for (const subtitle of subtitles) {
        if (subtitle.text === sentence) {
          console.log('[Helios Anki] Found exact match:', subtitle.text);
          return {
            start: subtitle.start,
            end: subtitle.end,
            text: subtitle.text
          };
        }
      }

      // Try partial match - subtitle contains sentence
      for (const subtitle of subtitles) {
        if (subtitle.text && subtitle.text.includes(sentence)) {
          console.log('[Helios Anki] Found subtitle containing sentence:', subtitle.text);
          return {
            start: subtitle.start,
            end: subtitle.end,
            text: subtitle.text
          };
        }
      }

      // Try reverse - sentence contains subtitle
      for (const subtitle of subtitles) {
        if (subtitle.text && sentence.includes(subtitle.text)) {
          console.log('[Helios Anki] Found subtitle (reverse match):', subtitle.text);
          return {
            start: subtitle.start,
            end: subtitle.end,
            text: subtitle.text
          };
        }
      }

      console.warn('[Helios Anki] No subtitle found for sentence:', sentence);
      return null;

    } catch (error) {
      console.error('[Helios Anki] Error getting subtitle timing:', error);
      return null;
    }
  }

  // Get primary video binding (helper method)
  _getPrimaryVideoBinding() {
    try {
      // Check if video feature is initialized
      if (!window.heliosVideoFeature || !window.heliosVideoFeature.videoDetector) {
        return null;
      }

      // Get primary binding from video detector
      const binding = window.heliosVideoFeature.videoDetector.getPrimaryBinding();
      return binding;

    } catch (error) {
      console.error('[Helios Anki] Error getting video binding:', error);
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

        // Enhance variant definitions if definition exists and wasn't already enhanced
        const adapter = window.languageRegistry?.getAdapter();
        if (adapter && adapter.enhanceVariantDefinition && wordData.definition && this.dictionaryManager?.dictionary) {
          wordData.definition = await adapter.enhanceVariantDefinition(
            wordData.definition,
            this.dictionaryManager.dictionary,
            this.dictionaryManager.getDefinition ?
              (word) => this.dictionaryManager.getDefinition(word) :
              null
          );
        }

        // Format definition: replace semicolons with newlines for Anki export
        if (wordData.definition) {
          wordData.definition = this.formatDefinitionForAnki(wordData.definition);
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

        // If auto-sync learning words is enabled, mark the word as learning
        try {
          const settings = await this.getSettings();
          if (settings.autoSyncLearningWords && window.vocabManager) {
            const character = wordData.character;
            if (character) {
              // Ensure vocab manager has the correct language set
              const currentLanguage = window.languageRegistry?.getCurrentLanguage() || wordData.language || 'zh';
              window.vocabManager.setCurrentLanguage(currentLanguage);
              
              // Mark word as learning
              await window.vocabManager.markWordAsLearning(character);
              console.log(`🃏 Marked word as learning (auto-sync enabled): ${character}`);
              
              // Update popup button state if popup is open
              this.updatePopupButtonState(character);
            }
          }
        } catch (error) {
          // Non-critical error - log but don't fail card creation
          console.warn("🃏 Error marking word as learning:", error);
        }

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
      const settings = response.settings || {};
      
      // Ensure defaults for new learning words settings
      if (settings.importYoungAsLearning === undefined) {
        settings.importYoungAsLearning = true;
      }
      if (settings.autoSyncLearningWords === undefined) {
        settings.autoSyncLearningWords = true;
      }
      
      return settings;
    } catch (error) {
      console.error("Error getting settings:", error);
      return {
        importYoungAsLearning: true,
        autoSyncLearningWords: true,
      };
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

  // Sync learning words from Anki - promote to known if interval >= 21 days
  async syncLearningWordsFromAnki() {
    try {
      // Check if auto-sync is enabled
      const settings = await this.getSettings();
      if (!settings.autoSyncLearningWords) {
        console.log("🃏 Auto-sync learning words is disabled");
        return { synced: 0, promoted: 0 };
      }

      // Validate prerequisites
      if (!settings.deck || !settings.noteType) {
        console.log("🃏 Anki not fully configured, skipping sync");
        return { synced: 0, promoted: 0 };
      }

      const fieldMappings = settings.fieldMappings || {};
      
      // Find the field mapped to expression or expressionRubyTxt
      let expressionField = null;
      let isRubyText = false;

      for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
        if (mapping === "expression") {
          expressionField = fieldName;
          isRubyText = false;
          break;
        } else if (mapping === "expressionRubyTxt") {
          expressionField = fieldName;
          isRubyText = true;
          break;
        }
      }

      if (!expressionField) {
        console.log("🃏 No expression field mapped, skipping sync");
        return { synced: 0, promoted: 0 };
      }

      // Get all expressions from the deck (optimized - only expression field and intervals)
      const response = await this.sendMessage("ANKI_GET_DECK_NOTES", {
        deck: settings.deck,
        noteType: settings.noteType,
        expressionField,
      });

      if (!response.success || !response.expressions || response.expressions.length === 0) {
        console.log("🃏 No notes found in deck, skipping sync");
        return { synced: 0, promoted: 0 };
      }

      const expressions = response.expressions;

      // Create a map of normalized expression to maxInterval
      const expressionToInterval = new Map();
      for (const item of expressions) {
        let expression = item.expression;

        if (!expression) continue;

        // Remove HTML tags if present
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = expression;
        expression = tempDiv.textContent || tempDiv.innerText || "";

        // Trim whitespace
        expression = expression.trim();

        if (!expression) continue;

        // If it's expressionRubyTxt, remove everything after first "["
        if (isRubyText && expression.includes("[")) {
          expression = expression.split("[")[0].trim();
        }

        if (expression) {
          const normalizedExpression = expression.toLowerCase();
          // maxInterval is already calculated in background script
          const maxInterval = item.maxInterval || 0;
          expressionToInterval.set(normalizedExpression, maxInterval);
        }
      }

      // Get current learning words
      if (!window.vocabManager) {
        console.log("🃏 VocabManager not available, skipping sync");
        return { synced: 0, promoted: 0 };
      }

      const learningWords = window.vocabManager.getCurrentLanguageLearningWords();
      const learningWordsArray = Array.from(learningWords);

      if (learningWordsArray.length === 0) {
        console.log("🃏 No learning words to sync");
        return { synced: 0, promoted: 0 };
      }

      // Check each learning word against Anki intervals
      const wordsToPromote = [];
      let syncedCount = 0;

      for (const learningWord of learningWordsArray) {
        const normalizedWord = learningWord.toLowerCase();
        const maxInterval = expressionToInterval.get(normalizedWord);

        if (maxInterval === undefined) {
          // Word is in learning but not in Anki deck - leave as learning
          continue;
        }

        syncedCount++;

        // If max interval is >= 21 days, promote to known
        if (maxInterval >= 21) {
          wordsToPromote.push(learningWord);
        }
      }

      // Promote words to known
      if (wordsToPromote.length > 0) {
        await window.vocabManager.markMultipleWordsAsKnown(wordsToPromote);
        // Words are automatically removed from learning set in markMultipleWordsAsKnown
        console.log(`🃏 Promoted ${wordsToPromote.length} learning words to known (interval >= 21 days)`);
      }

      console.log(`🃏 Sync complete: ${syncedCount} words checked, ${wordsToPromote.length} promoted to known`);

      return { synced: syncedCount, promoted: wordsToPromote.length };
    } catch (error) {
      console.error("🃏 Error syncing learning words from Anki:", error);
      return { synced: 0, promoted: 0, error: error.message };
    }
  }

  // Update popup button state after vocabulary changes
  updatePopupButtonState(character) {
    try {
      if (!character || !window.vocabManager) {
        return;
      }

      // Find the current popup
      const popup = document.querySelector('.chinese-lang-extension-popup');
      if (!popup) {
        return; // No popup open
      }

      // Find all mark buttons (for both single and multi-card popups)
      const markButtons = popup.querySelectorAll(".mark-known-btn, .mark-ignore-btn, .mark-unknown-btn, .mark-learning-btn");
      if (!markButtons || markButtons.length === 0) {
        return; // No mark buttons found
      }

      // Check the word's current state
      const isKnown = window.vocabManager.isWordKnown(character);
      const isLearning = window.vocabManager.isWordLearning(character);
      const isIgnored = window.vocabManager.isWordIgnored(character);

      // Determine the state
      let state = "unknown";
      if (isKnown) {
        state = "known";
      } else if (isLearning) {
        state = "learning";
      } else if (isIgnored) {
        state = "ignored";
      }

      // Helper function to update a single button
      const updateButton = (button) => {
        button.classList.remove("mark-known-btn", "mark-ignore-btn", "mark-unknown-btn", "mark-learning-btn");
        
        switch (state) {
          case "known":
            button.textContent = "Known";
            button.className = "mark-ignore-btn";
            break;
          case "learning":
            button.textContent = "Learning";
            button.className = "mark-learning-btn";
            break;
          case "ignored":
            button.textContent = "Ignored";
            button.className = "mark-unknown-btn";
            break;
          case "unknown":
          default:
            button.textContent = "Unknown";
            button.className = "mark-known-btn";
            break;
        }
      };

      // Update all mark buttons
      // For multi-card popups, all buttons represent the same word (different pronunciations)
      // For single-card popups, there's just one button
      // We update all of them to reflect the word's current state
      markButtons.forEach(button => {
        updateButton(button);
      });

      console.log(`🃏 Updated popup button state to: ${state} (${markButtons.length} button(s))`);
    } catch (error) {
      // Non-critical error - log but don't fail
      console.warn("🃏 Error updating popup button state:", error);
    }
  }
}

// Export for use in other scripts
if (typeof window !== "undefined") {
  window.AnkiManager = AnkiManager;
}
