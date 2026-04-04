// Background Script for Helios Language Learning Extension with Clean Anki Integration
class BackgroundService {
  constructor() {
    this.extensionSettings = {};
    this.init();
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.setupInitialData();

      // Open onboarding page on first install
      if (details.reason === 'install') {
        this.openOnboardingPage();
      }
    });

    // Track pending dictionary requests to route responses back to correct sender
    this.pendingDictionaryRequests = new Map();

    // Listen for messages from content script and settings
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle responses from offscreen document - forward back to original requester
      if (message.action && message.action.startsWith('RESPONSE_DICT_')) {
        const requestId = message.requestId;
        if (requestId && this.pendingDictionaryRequests.has(requestId)) {
          const { sendResponse: originalSendResponse } = this.pendingDictionaryRequests.get(requestId);
          this.pendingDictionaryRequests.delete(requestId);
          originalSendResponse(message.data);
          return false; // Response already sent
        }
        return false;
      }
      
      // Route dictionary messages to offscreen document
      if (message.action && message.action.startsWith('DICT_')) {
        this.routeToOffscreen(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
      
      // Route CREATE_OFFSCREEN to handler
      if (message.action === 'CREATE_OFFSCREEN') {
        this.createOffscreenDocument().then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
      
      // Handle other messages normally
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Create offscreen document on startup
    this.createOffscreenDocument();

    // Reset daily session count
    this.setupDailyReset();

    // Load extension settings on startup
    this.loadExtensionSettings();

    console.log(
      "🔧 Helios Background Service initialized with clean Anki integration"
    );
  }

  /**
   * Create offscreen document for dictionary manager
   */
  async createOffscreenDocument() {
    try {
      // Check if offscreen document already exists
      const clients = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      if (clients.length > 0) {
        console.log('📚 Offscreen document already exists');
        return;
      }

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_SCRAPING'],
        justification: 'Persistent dictionary manager for language learning extension'
      });
      
      console.log('📚 Offscreen document created successfully');
    } catch (error) {
      console.error('Error creating offscreen document:', error);
      throw error;
    }
  }

  /**
   * Route dictionary messages to offscreen document
   */
  async routeToOffscreen(message, sender, sendResponse) {
    try {
      // Ensure offscreen document exists
      const clients = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      if (clients.length === 0) {
        await this.createOffscreenDocument();
        // Wait a bit for offscreen to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Add unique request ID if not already present
      if (!message.requestId) {
        message.requestId = Date.now() + Math.random();
      }
      
      // Store the sendResponse callback to route response back to original sender
      this.pendingDictionaryRequests.set(message.requestId, { sendResponse, sender });
      
      // Send message to offscreen - it will receive it via its onMessage listener
      // The offscreen document will send back a RESPONSE_* message which we'll catch above
      chrome.runtime.sendMessage(message).catch(error => {
        // Clean up on error
        this.pendingDictionaryRequests.delete(message.requestId);
        sendResponse({ success: false, error: error.message });
      });
      
    } catch (error) {
      console.error('Error routing to offscreen:', error);
      if (message.requestId) {
        this.pendingDictionaryRequests.delete(message.requestId);
      }
      sendResponse({ success: false, error: error.message });
    }
  }

  async loadExtensionSettings() {
    try {
      const result = await chrome.storage.local.get([
        "extensionEnabled",
        "activationKey",
        "autoHighlight",
        "popupTheme",
        "targetLanguage",
      ]);

      this.extensionSettings = {
        extensionEnabled:
          result.extensionEnabled !== undefined
            ? result.extensionEnabled
            : true,
        activationKey: result.activationKey || "Shift",
        autoHighlight:
          result.autoHighlight !== undefined ? result.autoHighlight : true,
        popupTheme: result.popupTheme || "dark",
        targetLanguage: result.targetLanguage,
      };

      console.log("🔍 Loaded extension settings:", this.extensionSettings);
    } catch (error) {
      console.error("🔍 Error loading extension settings:", error);
      this.extensionSettings = {
        extensionEnabled: true,
        activationKey: "Shift",
        autoHighlight: true,
        popupTheme: "dark",
        targetLanguage: undefined,
      };
    }
  }

  async setupInitialData() {
    try {
      const result = await chrome.storage.local.get([
        "vocabList",
        "sessionCount",
        "lastResetDate",
        "ankiSettings",
        "extensionEnabled",
        "activationKey",
        "autoHighlight",
        "popupTheme",
        "targetLanguage",
        "hasCompletedOnboarding",
        "installDate",
      ]);

      // Initialize empty vocabulary list if it doesn't exist
      if (!result.vocabList) {
        await chrome.storage.local.set({ vocabList: [] });
      }

      // Initialize session count
      if (!result.sessionCount) {
        await chrome.storage.local.set({ sessionCount: 0 });
      }

      // Set initial reset date
      if (!result.lastResetDate) {
        await chrome.storage.local.set({
          lastResetDate: new Date().toDateString(),
        });
      }

      // Initialize Anki settings with clean structure
      if (!result.ankiSettings) {
        const defaultAnkiSettings = {
          deck: "Chinese::Helios",
          noteType: "Basic",
          fieldMappings: {},
          checkDuplicates: true,
          allowDuplicates: false,
          includeSentence: true,
          tags: ["helios"],
        };
        await chrome.storage.local.set({ ankiSettings: defaultAnkiSettings });
      }

      // Initialize extension settings if they don't exist
      if (result.extensionEnabled === undefined) {
        await chrome.storage.local.set({ extensionEnabled: true });
      }
      if (!result.activationKey) {
        await chrome.storage.local.set({ activationKey: "Shift" });
      }
      if (result.autoHighlight === undefined) {
        await chrome.storage.local.set({ autoHighlight: true });
      }
      if (!result.popupTheme) {
        await chrome.storage.local.set({ popupTheme: "dark" });
      }

      // Don't set a default target language - it should remain blank/null
      // until the user completes onboarding and selects their language
      // The language will be set in onboarding-controller.js when onboarding completes

      // Set install date for first-time users
      if (!result.installDate) {
        await chrome.storage.local.set({
          installDate: new Date().toISOString()
        });
      }

      await this.loadExtensionSettings();
      console.log("🔧 Helios extension initialized with clean Anki system");
    } catch (error) {
      console.error("Failed to setup initial data:", error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log(
      "🔧 Background received message:",
      message.action || message.type
    );

    try {
      switch (message.action || message.type) {
        // === ANKI HANDLERS ===
        case "ANKI_TEST_CONNECTION":
          await this.handleAnkiTestConnection(sendResponse);
          break;

        case "ANKI_CREATE_CARD":
          await this.handleAnkiCreateCard(
            message.wordData,
            message.options,
            sendResponse
          );
          break;

        case "ANKI_LOAD_SETTINGS":
          await this.handleAnkiLoadSettings(sendResponse);
          break;

        case "ANKI_SAVE_SETTINGS":
          await this.handleAnkiSaveSettings(message.settings, sendResponse);
          break;

        case "ANKI_GET_DECKS":
          await this.handleAnkiGetDecks(sendResponse);
          break;

        case "ANKI_GET_NOTE_TYPES":
          await this.handleAnkiGetNoteTypes(sendResponse);
          break;

        case "ANKI_GET_NOTE_TYPE_FIELDS":
          await this.handleAnkiGetNoteTypeFields(
            message.noteType,
            sendResponse
          );
          break;

        case "ANKI_CHECK_MEDIA_NEEDED":
          await this.handleAnkiCheckMediaNeeded(sendResponse);
          break;

        case "CAPTURE_SCREENSHOT":
          await this.handleCaptureScreenshot(sender, sendResponse);
          break;

        case "CAPTURE_TAB_AUDIO":
          await this.handleCaptureTabAudio(message.duration, sender, sendResponse);

          case "ANKI_GET_DECK_NOTES":
          await this.handleAnkiGetDeckNotes(
            message.deck,
            message.noteType,
            message.expressionField,
            sendResponse
          );
          break;

        // === EXTENSION HANDLERS ===
        case "toggleExtension":
          await this.handleToggleExtension(message.enabled, sendResponse);
          break;

        case "settingsChanged":
          await this.handleSettingsChanged(message.settings, sendResponse);
          break;

        case "getExtensionSettings":
          await this.handleGetExtensionSettings(sendResponse);
          break;

        case "onboardingCompleted":
          await this.handleOnboardingCompleted(message.language, sendResponse);
          break;

        case "openSettings":
          this.handleOpenSettings(sendResponse);
          break;

        // === VOCABULARY HANDLERS ===
        case "LOOKUP_WORD":
          await this.handleWordLookup(message.word, sendResponse);
          break;

        case "ADD_TO_VOCAB":
          await this.handleAddToVocab(message.wordData, sendResponse);
          break;

        case "GET_VOCAB_LIST":
          await this.handleGetVocabList(sendResponse);
          break;

        case "INCREMENT_SESSION":
          await this.incrementSessionCount(sendResponse);
          break;

        default:
          console.warn(
            "🔧 Unknown message type:",
            message.action || message.type
          );
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("🔧 Error in handleMessage:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  // ============ ANKI HANDLERS ============

  async handleAnkiTestConnection(sendResponse) {
    try {
      const result = await this.invokeAnki("version");
      sendResponse({
        success: true,
        version: result,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleAnkiCreateCard(wordData, options = {}, sendResponse) {
    try {
      console.log("🃏 Creating Anki card with data:", wordData);

      // Load settings
      const result = await chrome.storage.local.get(["ankiSettings"]);
      const settings = result.ankiSettings || {};
      const finalSettings = { ...settings, ...options };

      // Validate settings
      if (!finalSettings.deck || !finalSettings.noteType) {
        throw new Error("Deck and note type must be configured in settings");
      }

      // Build card fields (now async for media handling)
      const fields = await this.buildCardFields(
        wordData,
        finalSettings.fieldMappings || {}
      );

      // Check for duplicates if enabled
      if (finalSettings.checkDuplicates && !finalSettings.allowDuplicates) {
        const duplicates = await this.findDuplicates(
          wordData.character,
          finalSettings.fieldMappings || {},
          finalSettings.noteType
        );
        if (duplicates.length > 0) {
          throw new Error("Card already exists in Anki");
        }
      }

      // Ensure deck exists
      await this.ensureDeck(finalSettings.deck);

      // Create note
      const note = {
        deckName: finalSettings.deck,
        modelName: finalSettings.noteType,
        fields: fields,
        tags: finalSettings.tags || ["helios"],
        options: {
          // Always allow duplicates because AnkiConnect checks ALL fields (including sentence)
          // Our duplicate check above only checks the word/character field
          allowDuplicate: true,
        },
      };

      const noteId = await this.invokeAnki("addNote", { note });

      // Update statistics
      await this.updateAnkiStats(true);

      sendResponse({
        success: true,
        noteId: noteId,
        message: "Card created successfully",
      });
    } catch (error) {
      console.error("🃏 Error creating Anki card:", error);
      await this.updateAnkiStats(false);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleAnkiLoadSettings(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["ankiSettings"]);
      const defaultSettings = {
        deck: "Chinese::Helios",
        noteType: "Basic",
        fieldMappings: {},
        checkDuplicates: true,
        allowDuplicates: false,
        includeSentence: true,
        tags: ["helios"],
        importYoungAsLearning: true,
        autoSyncLearningWords: true,
      };

      sendResponse({
        success: true,
        settings: result.ankiSettings || defaultSettings,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleAnkiSaveSettings(settings, sendResponse) {
    try {
      await chrome.storage.local.set({ ankiSettings: settings });
      sendResponse({
        success: true,
        message: "Anki settings saved",
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleAnkiGetDecks(sendResponse) {
    try {
      const decks = await this.invokeAnki("deckNames");
      sendResponse({
        success: true,
        decks: decks.sort(),
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        decks: [],
      });
    }
  }

  async handleAnkiGetNoteTypes(sendResponse) {
    try {
      const noteTypes = await this.invokeAnki("modelNames");
      sendResponse({
        success: true,
        noteTypes: noteTypes.sort(),
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        noteTypes: [],
      });
    }
  }

  async handleAnkiGetNoteTypeFields(noteType, sendResponse) {
    try {
      const fields = await this.invokeAnki("modelFieldNames", {
        modelName: noteType,
      });
      sendResponse({
        success: true,
        fields: fields,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        fields: [],
      });
    }
  }

  async handleAnkiCheckMediaNeeded(sendResponse) {
    try {
      // Load current Anki settings
      const settings = await chrome.storage.local.get("ankiSettings");
      const ankiSettings = settings.ankiSettings || {};
      const fieldMappings = ankiSettings.fieldMappings || {};

      // Check if any field is mapped to screenshot or sentenceAudio
      const mappedValues = Object.values(fieldMappings);
      const needsScreenshot = mappedValues.includes('screenshot');
      const needsAudio = mappedValues.includes('sentenceAudio');

      sendResponse({
        success: true,
        needsScreenshot,
        needsAudio
      });
    } catch (error) {
      sendResponse({
        success: false,
        needsScreenshot: false,
        needsAudio: false,
        error: error.message
      });
    }
  }

  async handleCaptureScreenshot(sender, sendResponse) {
    try {
      console.log('[Helios Background] Screenshot capture request received from tab:', sender.tab?.id);

      if (!sender.tab || !sender.tab.id) {
        throw new Error('No tab information in sender');
      }

      // Get the tab information
      const tab = await chrome.tabs.get(sender.tab.id);
      console.log('[Helios Background] Capturing screenshot for tab:', tab.id, 'in window:', tab.windowId);

      // Capture the visible tab (using the tab's window ID, just like asbplayer)
      const dataUrl = await chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: 'jpeg', quality: 95 }
      );

      console.log('[Helios Background] Screenshot captured successfully, size:', dataUrl.length, 'bytes');

      sendResponse({
        success: true,
        dataUrl: dataUrl
      });
    } catch (error) {
      console.error('[Helios Background] Screenshot capture error:', error);
      console.error('[Helios Background] Error stack:', error.stack);
      sendResponse({
        success: false,
        error: error.message,
        dataUrl: null
      });
    }
  }

  async handleCaptureTabAudio(duration, sender, sendResponse) {
    try {
      // Tab audio capture is complex and requires offscreen document
      // For now, return an error indicating this feature needs implementation
      console.warn('[Helios Background] Tab audio capture not yet implemented');

      sendResponse({
        success: false,
        error: 'Tab audio capture is not yet implemented. Please use video element capture instead.',
        dataUrl: null
      });
    } catch (error) {
      console.error('[Helios Background] Tab audio capture error:', error);
      sendResponse({
        success: false,
        error: error.message,
        dataUrl: null
      });
    }
  }
  async handleAnkiGetDeckNotes(deck, noteType, expressionField, sendResponse) {
    try {
      if (!deck || !noteType) {
        throw new Error("Deck and note type are required");
      }

      if (!expressionField) {
        throw new Error("Expression field is required");
      }

      // Find all notes in the deck with the specified note type
      const query = `deck:"${deck}" note:"${noteType}"`;
      const noteIds = await this.invokeAnki("findNotes", { query });

      if (noteIds.length === 0) {
        sendResponse({
          success: true,
          expressions: [],
        });
        return;
      }

      // Process in batches to avoid memory issues
      const BATCH_SIZE = 1000;
      const allCardIds = [];
      const noteIdToCardIds = new Map();

      // First pass: Get card IDs from notes (in batches)
      for (let i = 0; i < noteIds.length; i += BATCH_SIZE) {
        const batchNoteIds = noteIds.slice(i, i + BATCH_SIZE);
        const batchNotes = await this.invokeAnki("notesInfo", { notes: batchNoteIds });

        for (const note of batchNotes) {
          if (note.cards && Array.isArray(note.cards)) {
            noteIdToCardIds.set(note.noteId, note.cards);
            allCardIds.push(...note.cards);
          }
        }
      }

      // Get card intervals (small data - just IDs and intervals)
      const cardIdToInterval = new Map();
      if (allCardIds.length > 0) {
        // Process cards in batches
        for (let i = 0; i < allCardIds.length; i += 1000) {
          const batchCardIds = allCardIds.slice(i, i + 1000);
          const batchCards = await this.invokeAnki("cardsInfo", { cards: batchCardIds });

          // Debug: log first batch structure
          if (i === 0 && batchCards.length > 0) {
            console.log("🃏 First card structure from AnkiConnect:", {
              sampleCard: batchCards[0],
              allFields: Object.keys(batchCards[0]),
              cardIdField: batchCards[0].cardId || batchCards[0].cid || batchCards[0].id,
              intervalField: batchCards[0].interval,
              ivlField: batchCards[0].ivl
            });
          }

          for (const card of batchCards) {
            // AnkiConnect cardsInfo returns 'interval' field (in days)
            // 'ivl' is the internal database field, but AnkiConnect exposes it as 'interval'
            // Check both possible field names
            let intervalValue = 0;
            if (card.interval !== undefined && card.interval !== null) {
              intervalValue = card.interval;
            } else if (card.ivl !== undefined && card.ivl !== null) {
              intervalValue = card.ivl;
            }
            
            // Anki intervals: negative = learning, 0 = new, positive = days
            // Convert to days if needed (AnkiConnect should already return days)
            const interval = intervalValue < 0 ? 0 : intervalValue;
            
            // Use cardId or cid as the key (AnkiConnect might use either)
            // Also normalize to number for consistent matching
            const cardId = card.cardId || card.cid || card.id;
            if (cardId !== undefined && cardId !== null) {
              // Store as both number and string to handle type mismatches
              const numCardId = typeof cardId === 'string' ? Number(cardId) : cardId;
              const strCardId = String(cardId);
              cardIdToInterval.set(numCardId, interval);
              cardIdToInterval.set(strCardId, interval);
            }
            
            // Debug logging for first few cards to verify interval retrieval
            if (cardIdToInterval.size <= 10) {
              console.log("🃏 Card interval debug:", {
                cardId: cardId,
                interval: card.interval,
                ivl: card.ivl,
                finalInterval: interval,
                allCardFields: Object.keys(card)
              });
            }
          }
        }
        
        // Log summary statistics
        const intervals = Array.from(cardIdToInterval.values());
        const intervalsOver21 = intervals.filter(ivl => ivl >= 21).length;
        console.log(`🃏 Interval summary: Total cards: ${intervals.length}, Over 21 days: ${intervalsOver21}, Under 21 days: ${intervals.length - intervalsOver21}`);
      }

      // Second pass: Extract only the expression field and calculate maxInterval
      const expressions = [];
      let debugNoteCount = 0;

      for (let i = 0; i < noteIds.length; i += BATCH_SIZE) {
        const batchNoteIds = noteIds.slice(i, i + BATCH_SIZE);
        const batchNotes = await this.invokeAnki("notesInfo", { notes: batchNoteIds });

        for (const note of batchNotes) {
          // Get expression from the specified field
          const fields = note.fields || {};
          const expressionFieldData = fields[expressionField];
          const expression = expressionFieldData?.value || "";

          // Extra debug for the first few notes so we can see what Anki is returning
          if (debugNoteCount < 5) {
            console.log("🃏 Note fields debug:", {
              noteId: note.noteId || note.id,
              availableFieldNames: Object.keys(fields),
              requestedExpressionField: expressionField,
              expressionFieldData,
              rawExpressionValue: expression
            });
            debugNoteCount++;
          }

          if (!expression) continue;

          // Calculate max interval for this note
          const cardIds = noteIdToCardIds.get(note.noteId) || [];
          let maxInterval = -Infinity;
          for (const cardId of cardIds) {
            // Try both the original cardId and as a number/string to handle type mismatches
            let interval = cardIdToInterval.get(cardId);
            if (interval === undefined) {
              // Try as number if it was a string, or vice versa
              const numCardId = typeof cardId === 'string' ? Number(cardId) : String(cardId);
              interval = cardIdToInterval.get(numCardId);
            }
            
            if (interval !== undefined) {
              maxInterval = Math.max(maxInterval, interval);
            } else {
              // Debug: log if we can't find interval for a card
              if (expressions.length < 3) {
                console.warn("🃏 Could not find interval for cardId:", cardId, typeof cardId, "Available cardIds in map (first 5):", Array.from(cardIdToInterval.keys()).slice(0, 5).map(id => ({id, type: typeof id})));
              }
            }
          }
          // If no cards found or all intervals undefined, treat as new card (0 days)
          if (maxInterval === -Infinity) maxInterval = 0;
          
          // Debug logging for first few expressions
          if (expressions.length < 3) {
            console.log("🃏 Expression interval debug:", {
              expression: expression.substring(0, 20),
              cardIds: cardIds,
              maxInterval: maxInterval
            });
          }

          // Return minimal data: just expression and maxInterval
          expressions.push({
            expression: expression,
            maxInterval: maxInterval,
          });
        }
      }

      sendResponse({
        success: true,
        expressions: expressions,
      });
    } catch (error) {
      console.error("🃏 Error getting deck notes:", error);
      
      // Check if it's a size error and provide helpful message
      if (error.message && error.message.includes("64MB")) {
        sendResponse({
          success: false,
          error: "Deck is too large. Please try importing a smaller deck or contact support for assistance.",
          expressions: [],
        });
      } else {
        sendResponse({
          success: false,
          error: error.message,
          expressions: [],
        });
      }
    }
  }

  // ============ ANKI HELPER METHODS ============

  async invokeAnki(action, params = {}) {
    const endpoints = [
      "http://127.0.0.1:8765",
      "http://localhost:8765",
    ];

    try {
      let lastError = null;
      let response = null;

      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: action,
              version: 6,
              params: params,
            }),
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!response) {
        throw lastError || new Error("Unable to reach AnkiConnect endpoint");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      return data.result;
    } catch (error) {
      console.error("🃏 AnkiConnect error:", error);

      // Provide more helpful error messages
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error('Cannot connect to Anki. Please ensure Anki is running and AnkiConnect add-on is installed.');
      }

      throw error;
    }
  }

  pinyinTonesToNumbers(pinyin, charCount = 1) {
    if (!pinyin) return '';
    const toneMap = {
      'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4',
      'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4',
      'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4',
      'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4',
      'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4',
      'ǖ': 'ü1', 'ǘ': 'ü2', 'ǚ': 'ü3', 'ǜ': 'ü4',
      'Ā': 'A1', 'Á': 'A2', 'Ǎ': 'A3', 'À': 'A4',
      'Ē': 'E1', 'É': 'E2', 'Ě': 'E3', 'È': 'E4',
      'Ī': 'I1', 'Í': 'I2', 'Ǐ': 'I3', 'Ì': 'I4',
      'Ō': 'O1', 'Ó': 'O2', 'Ǒ': 'O3', 'Ò': 'O4',
      'Ū': 'U1', 'Ú': 'U2', 'Ǔ': 'U3', 'Ù': 'U4',
      'Ǖ': 'Ü1', 'Ǘ': 'Ü2', 'Ǚ': 'Ü3', 'Ǜ': 'Ü4'
    };

    // Normalize Unicode (NFC) and collapse any whitespace to single space
    pinyin = (typeof pinyin === 'string' ? pinyin : String(pinyin)).normalize('NFC').replace(/\s+/g, ' ').trim();
    const hasSpace = pinyin.includes(' ');

    // Heuristic to split unspaced pinyin for multi-character words.
    if (charCount > 1 && !hasSpace) {
        let splitPinyin = pinyin;

        // Primary: match pinyin syllables with tone marks
        const syllableRegex = /(?:zh|ch|sh|[bpmfdtnlgkhjqxzcsywr]?)(?:[aeiouvüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n|r)?)/gi;
        const matchedSyllables = splitPinyin.match(syllableRegex);
        if (matchedSyllables && matchedSyllables.length === charCount) {
          pinyin = matchedSyllables.join(' ');
        } else {
          // Fallback: explicit split rules (order matters)
          // 1. ng + consonant: qingxiang -> qing xiang, pingyong -> ping yong
          splitPinyin = splitPinyin.replace(/(ng)([b-df-hj-np-tv-z])/gi, '$1 $2');
          // 2. n (coda) + consonant: ganxiang -> gan xiang (exclude g to avoid breaking "ng" in ning/cheng)
          splitPinyin = splitPinyin.replace(/(n)([b-dfhj-np-tv-z])/gi, '$1 $2');
          // 3. vowel + onset consonant (exclude n - it's always coda after vowel): dama -> da ma, huiyuan -> hui yuan, goucheng -> gou cheng
          splitPinyin = splitPinyin.replace(/([aeiouvüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])([b-dfhj-mp-tv-z])/g, '$1 $2');
          const syllables = splitPinyin.split(/\s+/).filter(Boolean);
          if (syllables.length === charCount) {
            pinyin = syllables.join(' ');
          }
        }
    }

    return pinyin.split(' ').map(syllable => {
      if (syllable.match(/[1-5]$/)) {
        return syllable;
      }

      let result = '';
      let tone = '';
      for (const char of syllable) {
        if (toneMap[char]) {
          const mapping = toneMap[char];
          result += mapping.slice(0, -1);
          tone = mapping.slice(-1);
        } else {
          result += char;
        }
      }
      
      if (tone) {
        return result + tone;
      } else {
        if (result.match(/^[a-zA-ZüÜ]+$/i)) {
            return result + '5';
        }
        return result;
      }
    }).join(' ');
  }

  async buildCardFields(wordData, fieldMappings) {
    const fields = {};
    const language = wordData.language || 'zh'; // Default to Chinese if not specified
    const isChinese = language === 'zh';

    // Build dataMap differently based on language
    let dataMap;

    if (isChinese) {
      // For Chinese: convert pinyin to tone numbers and create ruby text
      const pinyinWithNumbers = this.pinyinTonesToNumbers(wordData.pinyin, wordData.character.length);

      dataMap = {
        expression: wordData.character,
        expressionRubyTxt: `${wordData.character}[${pinyinWithNumbers};]`,
        reading: wordData.pinyin,
        meaning: wordData.definition,
        sentence: wordData.sentence,
        traditional: wordData.traditional,
        simplified: wordData.simplified,
        source: wordData.url,
        frequency: wordData.frequency?.toString() || "",
      };
    } else {
      // For other languages: use raw pronunciation (IPA), no ruby text
      dataMap = {
        expression: wordData.character,
        reading: wordData.pinyin || '', // Raw IPA pronunciation
        meaning: wordData.definition,
        sentence: wordData.sentence,
        source: wordData.url,
        frequency: wordData.frequency?.toString() || "",
        // Traditional/simplified are same as expression for non-Chinese
        traditional: wordData.character,
        simplified: wordData.character,
      };
    }

    // Handle media fields (screenshot and audio)
    if (wordData.screenshotDataUrl) {
      const screenshotField = await this.storeMediaFile(wordData.screenshotDataUrl, 'screenshot');
      if (screenshotField) {
        dataMap.screenshot = screenshotField;
      }
    }

    if (wordData.sentenceAudioDataUrl) {
      const audioField = await this.storeMediaFile(wordData.sentenceAudioDataUrl, 'audio');
      if (audioField) {
        dataMap.sentenceAudio = audioField;
      }
    }

    // Apply field mappings
    for (const [fieldName, dataType] of Object.entries(fieldMappings)) {
      if (dataType && dataMap[dataType]) {
        fields[fieldName] = dataMap[dataType];
      }
    }

    // Fallback if no mappings
    if (Object.keys(fields).length === 0) {
      if (isChinese) {
        const pinyinWithNumbers = this.pinyinTonesToNumbers(wordData.pinyin, wordData.character.length);
        fields["Front"] = wordData.character || "Unknown";
        fields["Back"] =
          pinyinWithNumbers && wordData.definition
            ? `${pinyinWithNumbers}<br>${wordData.definition}`
            : wordData.definition || "No definition";
      } else {
        fields["Front"] = wordData.character || "Unknown";
        fields["Back"] = wordData.definition || "No definition";
      }
    }

    return fields;
  }

  // Store media file via AnkiConnect
  async storeMediaFile(dataUrl, type) {
    try {
      if (!dataUrl) {
        return null;
      }

      // Extract base64 data from data URL
      const base64Data = this.extractBase64FromDataUrl(dataUrl);
      if (!base64Data) {
        console.error('[Helios Media] Failed to extract base64 data');
        return null;
      }

      // Generate filename
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      let extension = '';

      if (type === 'screenshot') {
        extension = 'jpg';
      } else if (type === 'audio') {
        // Detect audio format from data URL
        if (dataUrl.includes('audio/webm')) {
          extension = 'webm';
        } else if (dataUrl.includes('audio/mp3')) {
          extension = 'mp3';
        } else {
          extension = 'webm'; // Default
        }
      }

      const fileName = `helios_${type}_${timestamp}_${random}.${extension}`;

      // Store via AnkiConnect
      console.log('[Helios Media] Storing media file:', fileName);
      await this.invokeAnki('storeMediaFile', {
        filename: fileName,
        data: base64Data
      });

      // Format as Anki field value
      if (type === 'screenshot') {
        return `<img src="${fileName}">`;
      } else if (type === 'audio') {
        return `[sound:${fileName}]`;
      }

      return fileName;

    } catch (error) {
      console.error('[Helios Media] Error storing media file:', error);
      return null;
    }
  }

  // Extract base64 from data URL
  extractBase64FromDataUrl(dataUrl) {
    if (!dataUrl || !dataUrl.includes(',')) {
      return null;
    }

    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      return null;
    }

    return parts[1];
  }

  async findDuplicates(character, fieldMappings, noteType) {
    try {
      // Find which field is used for the expression
      let expressionField = null;
      for (const [fieldName, dataType] of Object.entries(fieldMappings)) {
        if (dataType === 'expression') {
          expressionField = fieldName;
          break;
        }
      }

      // If no mapping is found, use a default field name.
      // For "Basic" and many other common note types, "Front" is the expression field.
      if (!expressionField) {
        expressionField = 'Front';
      }

      // Construct a query for an exact match in a specific field and note type.
      // e.g., 'note:Basic "Front:=你好"'
      const query = `note:"${noteType}" "${expressionField}:=${character}"`;
      return await this.invokeAnki("findNotes", { query });
    } catch (error) {
      console.warn("Could not check duplicates:", error);
      return [];
    }
  }

  async ensureDeck(deckName) {
    try {
      const decks = await this.invokeAnki("deckNames");
      if (!decks.includes(deckName)) {
        await this.invokeAnki("createDeck", { deck: deckName });
      }
    } catch (error) {
      console.warn("Could not ensure deck exists:", error);
    }
  }

  async updateAnkiStats(success) {
    try {
      const result = await chrome.storage.local.get(["ankiCardsCreated"]);
      const newCount = (result.ankiCardsCreated || 0) + (success ? 1 : 0);
      await chrome.storage.local.set({ ankiCardsCreated: newCount });
    } catch (error) {
      console.warn("Could not update Anki stats:", error);
    }
  }

  // ============ EXTENSION HANDLERS ============

  async handleToggleExtension(enabled, sendResponse) {
    try {
      await chrome.storage.local.set({ extensionEnabled: enabled });
      this.extensionSettings.extensionEnabled = enabled;

      const tabs = await chrome.tabs.query({});
      const updatePromises = tabs.map((tab) => {
        return chrome.tabs
          .sendMessage(tab.id, {
            action: "extensionToggled",
            enabled: enabled,
          })
          .catch(() => {});
      });

      await Promise.allSettled(updatePromises);

      sendResponse({
        success: true,
        message: `Extension ${enabled ? "enabled" : "disabled"}`,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleSettingsChanged(settings, sendResponse) {
    try {
      this.extensionSettings = { ...this.extensionSettings, ...settings };

      const tabs = await chrome.tabs.query({});
      const updatePromises = tabs.map((tab) => {
        return chrome.tabs
          .sendMessage(tab.id, {
            action: "settingsUpdated",
            settings: settings,
          })
          .catch(() => {});
      });

      await Promise.allSettled(updatePromises);

      sendResponse({
        success: true,
        message: "Settings updated and broadcasted",
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleGetExtensionSettings(sendResponse) {
    try {
      await this.loadExtensionSettings();
      sendResponse({
        success: true,
        settings: this.extensionSettings,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        settings: this.extensionSettings,
      });
    }
  }

  async handleOpenSettings(sendResponse) {
    try {
      if (chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'openOptionsPage not available' });
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // ============ VOCABULARY HANDLERS ============

  async handleWordLookup(word, sendResponse) {
    try {
      if (!this.extensionSettings.extensionEnabled) {
        sendResponse({
          success: false,
          error: "Extension is disabled",
        });
        return;
      }

      const definition = await this.lookupWord(word);
      await this.incrementSessionCount();

      sendResponse({
        success: true,
        definition: definition,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async lookupWord(word) {
    // Placeholder - replace with real API
    const dictionary = {
      hello: { definition: "A greeting", pronunciation: "həˈloʊ" },
      world: { definition: "The earth", pronunciation: "wɜrld" },
    };
    return dictionary[word.toLowerCase()] || null;
  }

  async handleAddToVocab(wordData, sendResponse) {
    try {
      const result = await chrome.storage.local.get(["vocabList"]);
      const vocabList = result.vocabList || [];

      const exists = vocabList.some((item) => item.word === wordData.word);

      if (!exists) {
        vocabList.push({
          ...wordData,
          dateAdded: new Date().toISOString(),
          reviewCount: 0,
        });

        await chrome.storage.local.set({ vocabList: vocabList });

        sendResponse({
          success: true,
          message: "Word added to vocabulary",
        });
      } else {
        sendResponse({
          success: false,
          message: "Word already in vocabulary",
        });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleGetVocabList(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["vocabList"]);
      sendResponse({
        success: true,
        vocabList: result.vocabList || [],
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async incrementSessionCount(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["sessionCount"]);
      const newCount = (result.sessionCount || 0) + 1;

      await chrome.storage.local.set({ sessionCount: newCount });

      if (sendResponse) {
        sendResponse({
          success: true,
          sessionCount: newCount,
        });
      }
    } catch (error) {
      if (sendResponse) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    }
  }

  /**
   * Open onboarding page for first-time users
   */
  openOnboardingPage() {
    const onboardingUrl = chrome.runtime.getURL('src/ui/onboarding/onboarding.html');
    chrome.tabs.create({ url: onboardingUrl });
    console.log('🔧 Opened onboarding page for first-time user');
  }

  /**
   * Handle onboarding completion
   */
  async handleOnboardingCompleted(languageCode, sendResponse) {
    try {
      console.log(`🔧 Onboarding completed with language: ${languageCode}`);

      // Explicitly update cached settings with the new language
      // This ensures we have the correct language even if storage hasn't fully synced
      this.extensionSettings.targetLanguage = languageCode;

      // Reload our cached settings to ensure everything is in sync
      await this.loadExtensionSettings();

      // Double-check: if storage somehow doesn't have the language, set it explicitly
      const storageCheck = await chrome.storage.local.get(['targetLanguage']);
      if (!storageCheck.targetLanguage || storageCheck.targetLanguage !== languageCode) {
        console.warn(`⚠️ Language mismatch in storage, fixing: expected ${languageCode}, got ${storageCheck.targetLanguage}`);
        await chrome.storage.local.set({ targetLanguage: languageCode });
        this.extensionSettings.targetLanguage = languageCode;
      }

      // Broadcast to all tabs to reload with new language
      const tabs = await chrome.tabs.query({});
      const broadcastPromises = tabs.map(tab => {
        return chrome.tabs.sendMessage(tab.id, {
          action: "settingsUpdated",
          settings: { targetLanguage: languageCode }
        }).catch(() => {
          // Tab might not have content script loaded, ignore
          console.log(`Could not send to tab ${tab.id}, probably no content script`);
        });
      });

      await Promise.allSettled(broadcastPromises);

      console.log(`✅ Successfully broadcasted language change to all tabs`);

      if (sendResponse) {
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('❌ Error handling onboarding completion:', error);
      if (sendResponse) {
        sendResponse({ success: false, error: error.message });
      }
    }
  }

  async setupDailyReset() {
    const checkAndReset = async () => {
      try {
        const result = await chrome.storage.local.get([
          "lastResetDate",
          "sessionCount",
        ]);
        const today = new Date().toDateString();

        if (result.lastResetDate !== today) {
          await chrome.storage.local.set({
            sessionCount: 0,
            lastResetDate: today,
          });
          console.log("🔧 Daily session count reset");
        }
      } catch (error) {
        console.error("Failed to reset daily counters:", error);
      }
    };

    // Check immediately
    await checkAndReset();

    // Set up alarm to check daily
    try {
      await chrome.alarms.create("dailyReset", {
        delayInMinutes: 1,
        periodInMinutes: 60 * 24,
      });

      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "dailyReset") {
          checkAndReset();
        }
      });
    } catch (error) {
      console.warn("Could not set up daily reset alarm:", error);
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Export for debugging
if (typeof globalThis !== "undefined") {
  globalThis.backgroundService = backgroundService;
}
