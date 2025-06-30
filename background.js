// Background Script for Language Learning Extension with Anki Integration
class BackgroundService {
  constructor() {
    this.ankiConnectUrl = "http://127.0.0.1:8765";
    this.isAnkiAvailable = null;
    this.extensionSettings = {}; // Store current settings
    this.init();
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.setupInitialData();
    });

    // Listen for messages from content script and settings
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Reset daily session count
    this.setupDailyReset();

    // Check Anki availability on startup
    this.checkAnkiConnect();

    // Load extension settings on startup
    this.loadExtensionSettings();
  }

  async loadExtensionSettings() {
    try {
      const result = await chrome.storage.local.get([
        "extensionEnabled",
        "activationKey",
        "autoHighlight",
        "popupTheme",
      ]);

      // Set defaults if not found
      this.extensionSettings = {
        extensionEnabled:
          result.extensionEnabled !== undefined
            ? result.extensionEnabled
            : true,
        activationKey: result.activationKey || "Shift",
        autoHighlight:
          result.autoHighlight !== undefined ? result.autoHighlight : true,
        popupTheme: result.popupTheme || "dark",
      };

      console.log("🔍 Loaded extension settings:", this.extensionSettings);
    } catch (error) {
      console.error("🔍 Error loading extension settings:", error);
      // Use defaults
      this.extensionSettings = {
        extensionEnabled: true,
        activationKey: "Shift",
        autoHighlight: true,
        popupTheme: "dark",
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

      // Initialize Anki settings
      if (!result.ankiSettings) {
        const defaultAnkiSettings = {
          deck: "Chinese::Helios",
          noteType: "Basic",
          checkDuplicates: true,
          allowDuplicates: false,
          includeSentence: true,
          includeUrl: true,
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

      // Load settings into memory
      await this.loadExtensionSettings();

      console.log("Language Learning Extension with Anki initialized");
    } catch (error) {
      console.error("Failed to setup initial data:", error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("Background received message:", message.type || message.action);

    try {
      switch (message.type || message.action) {
        // === NEW SETTINGS HANDLERS ===
        case "toggleExtension":
          await this.handleToggleExtension(message.enabled, sendResponse);
          break;

        case "settingsChanged":
          await this.handleSettingsChanged(message.settings, sendResponse);
          break;

        case "getExtensionSettings":
          await this.handleGetExtensionSettings(sendResponse);
          break;

        // === EXISTING HANDLERS ===
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

        // Anki-related message handlers
        case "CHECK_ANKI_CONNECT":
          await this.handleCheckAnkiConnect(sendResponse);
          break;

        case "CREATE_ANKI_CARD":
          await this.handleCreateAnkiCard(
            message.wordData,
            message.options,
            sendResponse
          );
          break;

        case "GET_ANKI_SETTINGS":
          await this.handleGetAnkiSettings(sendResponse);
          break;

        case "SAVE_ANKI_SETTINGS":
          await this.handleSaveAnkiSettings(message.settings, sendResponse);
          break;

        case "TEST_ANKI_CONNECTION":
          await this.handleTestAnkiConnection(sendResponse);
          break;

        // Settings page handlers
        case "GET_ANKI_DECKS":
          console.log("Handling GET_ANKI_DECKS request");
          await this.handleGetAnkiDecks(sendResponse);
          break;

        case "GET_ANKI_NOTE_TYPES":
          console.log("Handling GET_ANKI_NOTE_TYPES request");
          await this.handleGetAnkiNoteTypes(sendResponse);
          break;

        case "GET_ANKI_NOTE_TYPE_FIELDS":
          console.log("Handling GET_ANKI_NOTE_TYPE_FIELDS request");
          await this.handleGetAnkiNoteTypeFields(
            message.noteType,
            sendResponse
          );
          break;

        default:
          console.warn("Unknown message type:", message.type || message.action);
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error in handleMessage:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  // ============ NEW SETTINGS HANDLERS ============

  async handleToggleExtension(enabled, sendResponse) {
    try {
      console.log("🔍 Extension toggle:", enabled);

      // Update stored settings
      await chrome.storage.local.set({ extensionEnabled: enabled });
      this.extensionSettings.extensionEnabled = enabled;

      // Notify all content scripts about the change
      const tabs = await chrome.tabs.query({});
      const updatePromises = tabs.map((tab) => {
        return chrome.tabs
          .sendMessage(tab.id, {
            action: "extensionToggled",
            enabled: enabled,
          })
          .catch(() => {
            // Tab might not have content script loaded, ignore
          });
      });

      await Promise.allSettled(updatePromises);

      sendResponse({
        success: true,
        message: `Extension ${enabled ? "enabled" : "disabled"}`,
      });
    } catch (error) {
      console.error("🔍 Error toggling extension:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleSettingsChanged(settings, sendResponse) {
    try {
      console.log("🔍 Settings changed:", settings);

      // Update our cached settings
      this.extensionSettings = { ...this.extensionSettings, ...settings };

      // Notify all content scripts about the changes
      const tabs = await chrome.tabs.query({});
      const updatePromises = tabs.map((tab) => {
        return chrome.tabs
          .sendMessage(tab.id, {
            action: "settingsUpdated",
            settings: settings,
          })
          .catch(() => {
            // Tab might not have content script loaded, ignore
          });
      });

      await Promise.allSettled(updatePromises);

      sendResponse({
        success: true,
        message: "Settings updated and broadcasted",
      });
    } catch (error) {
      console.error("🔍 Error handling settings change:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleGetExtensionSettings(sendResponse) {
    try {
      // Refresh settings from storage
      await this.loadExtensionSettings();

      sendResponse({
        success: true,
        settings: this.extensionSettings,
      });
    } catch (error) {
      console.error("🔍 Error getting extension settings:", error);
      sendResponse({
        success: false,
        error: error.message,
        settings: this.extensionSettings, // Return cached version as fallback
      });
    }
  }

  // ============ ANKI INTEGRATION METHODS ============

  async checkAnkiConnect() {
    try {
      const response = await this.invokeAnki("version");
      this.isAnkiAvailable = response !== null;
      return this.isAnkiAvailable;
    } catch (error) {
      console.warn("AnkiConnect not available:", error);
      this.isAnkiAvailable = false;
      return false;
    }
  }

  async invokeAnki(action, params = {}) {
    try {
      const response = await fetch(this.ankiConnectUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: action,
          version: 6,
          params: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return data.result;
    } catch (error) {
      console.error("AnkiConnect error:", error);
      throw error;
    }
  }

  async ensureDeckExists(deckName) {
    try {
      const decks = await this.invokeAnki("deckNames");
      if (!decks.includes(deckName)) {
        await this.invokeAnki("createDeck", { deck: deckName });
        console.log(`Created deck: ${deckName}`);
      }
      return true;
    } catch (error) {
      console.error("Error ensuring deck exists:", error);
      return false;
    }
  }

  async findDuplicates(expression) {
    try {
      const query = `"Expression:${expression}" OR "Front:${expression}" OR "Chinese:${expression}"`;
      return await this.invokeAnki("findNotes", { query: query });
    } catch (error) {
      console.error("Error finding duplicates:", error);
      return [];
    }
  }

  prepareCardFields(wordData) {
    console.log("🃏 Preparing basic card fields for:", wordData);

    const {
      character,
      traditional,
      simplified,
      pinyin,
      definition,
      sentence,
      url,
      frequency,
    } = wordData || {};

    // Ensure we have at least a character
    if (!character && !simplified && !traditional) {
      console.error("🃏 No character data provided:", wordData);
      throw new Error("No character data provided for card creation");
    }

    const mainCharacter = character || simplified || traditional;
    const reading = pinyin || "";
    const meaning = definition || "";

    return {
      // Primary fields
      Expression: mainCharacter,
      Reading: reading,
      Meaning: meaning,

      // Additional fields
      Sentence: sentence || "",
      Traditional: traditional || mainCharacter,
      Simplified: simplified || mainCharacter,
      Source: url || "",
      Frequency: frequency ? frequency.toString() : "",

      // Alternative field names for compatibility
      Front: mainCharacter,
      Back: reading ? `${reading}<br>${meaning}` : meaning,
      Chinese: mainCharacter,
      Pinyin: reading,
      English: meaning,
      Context: sentence || "",
      URL: url || "",
    };
  }

  // Prepare card fields using field mappings
  prepareCardFieldsWithMapping(wordData, fieldMappings) {
    console.log(
      "🃏 Preparing mapped card fields for:",
      wordData,
      "mappings:",
      fieldMappings
    );

    const {
      character,
      traditional,
      simplified,
      pinyin,
      definition,
      sentence,
      url,
      frequency,
    } = wordData || {};

    // Ensure we have at least a character
    if (!character && !simplified && !traditional) {
      console.error("🃏 No character data provided:", wordData);
      throw new Error("No character data provided for card creation");
    }

    const fields = {};
    const mainCharacter = character || simplified || traditional;

    // Map Helios fields to Anki fields based on user configuration
    if (fieldMappings.expression && fieldMappings.expression !== "") {
      fields[fieldMappings.expression] = mainCharacter;
    }

    if (fieldMappings.reading && fieldMappings.reading !== "") {
      fields[fieldMappings.reading] = pinyin || "";
    }

    if (fieldMappings.meaning && fieldMappings.meaning !== "") {
      fields[fieldMappings.meaning] = definition || "";
    }

    if (fieldMappings.sentence && fieldMappings.sentence !== "") {
      fields[fieldMappings.sentence] = sentence || "";
    }

    if (fieldMappings.traditional && fieldMappings.traditional !== "") {
      fields[fieldMappings.traditional] = traditional || mainCharacter;
    }

    if (fieldMappings.simplified && fieldMappings.simplified !== "") {
      fields[fieldMappings.simplified] = simplified || mainCharacter;
    }

    if (fieldMappings.source && fieldMappings.source !== "") {
      fields[fieldMappings.source] = url || "";
    }

    // Fallback: if no fields are mapped, use basic mapping
    if (Object.keys(fields).length === 0) {
      console.warn("🃏 No field mappings found, using fallback");
      fields["Front"] = mainCharacter;
      fields["Back"] = pinyin
        ? `${pinyin}<br>${definition || ""}`
        : definition || "";
    }

    console.log("🃏 Final mapped fields:", fields);
    return fields;
  }

  // Message Handlers for Anki
  async handleCheckAnkiConnect(sendResponse) {
    try {
      const isAvailable = await this.checkAnkiConnect();
      sendResponse({
        success: true,
        isAvailable: isAvailable,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        isAvailable: false,
      });
    }
  }

  async handleCreateAnkiCard(wordData, options = {}, sendResponse) {
    try {
      console.log(
        "🃏 Creating Anki card with data:",
        wordData,
        "options:",
        options
      );

      // Check AnkiConnect availability
      if (this.isAnkiAvailable === null) {
        await this.checkAnkiConnect();
      }

      if (!this.isAnkiAvailable) {
        throw new Error(
          "AnkiConnect is not available. Please make sure Anki is running with AnkiConnect add-on installed."
        );
      }

      // Get settings with better error handling
      let settings;
      try {
        const result = await chrome.storage.local.get(["ankiSettings"]);
        settings = result.ankiSettings || {
          deck: "Chinese::Helios",
          noteType: "Basic",
          fieldMappings: {
            expression: "Front",
            reading: "Back",
            meaning: "Back",
          },
          checkDuplicates: true,
          allowDuplicates: false,
          tags: ["helios"],
        };
      } catch (error) {
        console.error("🃏 Error getting Anki settings:", error);
        // Use defaults if settings can't be loaded
        settings = {
          deck: "Chinese::Helios",
          noteType: "Basic",
          fieldMappings: {
            expression: "Front",
            reading: "Back",
            meaning: "Back",
          },
          checkDuplicates: true,
          allowDuplicates: false,
          tags: ["helios"],
        };
      }

      console.log("🃏 Using Anki settings:", settings);

      // Merge options with settings
      const finalOptions = { ...settings, ...options };

      // Ensure deck exists
      try {
        await this.ensureDeckExists(finalOptions.deck);
      } catch (error) {
        console.error("🃏 Error ensuring deck exists:", error);
        // Continue anyway, Anki might create it automatically
      }

      // Prepare card fields with better error handling
      let fields;
      try {
        if (
          finalOptions.fieldMappings &&
          Object.keys(finalOptions.fieldMappings).length > 0
        ) {
          fields = this.prepareCardFieldsWithMapping(
            wordData,
            finalOptions.fieldMappings
          );
        } else {
          fields = this.prepareCardFields(wordData);
        }
      } catch (error) {
        console.error("🃏 Error preparing card fields:", error);
        // Fall back to basic fields
        fields = this.prepareCardFields(wordData);
      }

      console.log("🃏 Prepared card fields:", fields);

      // Validate fields
      if (!fields || Object.keys(fields).length === 0) {
        throw new Error("No valid fields prepared for card creation");
      }

      // Check for duplicates if enabled
      if (finalOptions.checkDuplicates && !finalOptions.allowDuplicates) {
        try {
          const duplicates = await this.findDuplicates(
            fields.Front || fields.Expression || wordData.character
          );
          if (duplicates.length > 0) {
            console.log("🃏 Duplicate card found");
            sendResponse({
              success: false,
              error: "Card already exists",
              duplicateIds: duplicates,
            });
            return;
          }
        } catch (error) {
          console.warn("🃏 Error checking duplicates:", error);
          // Continue with card creation if duplicate check fails
        }
      }

      // Create the note with better error handling
      let noteId;
      try {
        noteId = await this.invokeAnki("addNote", {
          note: {
            deckName: finalOptions.deck,
            modelName: finalOptions.noteType,
            fields: fields,
            tags: finalOptions.tags || ["helios"],
            options: {
              allowDuplicate: finalOptions.allowDuplicates || false,
            },
          },
        });
      } catch (error) {
        console.error("🃏 AnkiConnect addNote error:", error);

        // Provide more specific error messages
        if (error.message.includes("model was not found")) {
          throw new Error(
            `Note type "${finalOptions.noteType}" not found in Anki. Please check your note type settings.`
          );
        } else if (error.message.includes("deck was not found")) {
          throw new Error(
            `Deck "${finalOptions.deck}" not found in Anki. Please check your deck settings.`
          );
        } else if (error.message.includes("field")) {
          throw new Error(
            `Field mapping error: ${error.message}. Please check your field mappings in settings.`
          );
        } else {
          throw new Error(`Anki error: ${error.message}`);
        }
      }

      console.log("🃏 Anki card created successfully with note ID:", noteId);

      // Update Anki cards created counter
      try {
        const result = await chrome.storage.local.get(["ankiCardsCreated"]);
        const newCount = (result.ankiCardsCreated || 0) + 1;
        await chrome.storage.local.set({ ankiCardsCreated: newCount });
      } catch (error) {
        console.warn("🃏 Could not update Anki cards counter:", error);
      }

      sendResponse({
        success: true,
        noteId: noteId,
        message: "Card created successfully",
      });
    } catch (error) {
      console.error("🃏 Error creating Anki card:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }

  async handleGetAnkiSettings(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["ankiSettings"]);
      const defaultSettings = {
        deck: "Chinese::Helios",
        noteType: "Basic",
        checkDuplicates: true,
        allowDuplicates: false,
        includeSentence: true,
        includeUrl: true,
        tags: ["helios"],
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

  async handleSaveAnkiSettings(settings, sendResponse) {
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

  async handleTestAnkiConnection(sendResponse) {
    try {
      const isConnected = await this.checkAnkiConnect();
      if (isConnected) {
        const version = await this.invokeAnki("version");
        sendResponse({
          success: true,
          message: `Connected to AnkiConnect (version ${version})`,
          version: version,
        });
      } else {
        sendResponse({
          success: false,
          message: "AnkiConnect not available",
        });
      }
    } catch (error) {
      sendResponse({
        success: false,
        message: error.message,
      });
    }
  }

  // Settings page handlers
  async handleGetAnkiDecks(sendResponse) {
    try {
      if (this.isAnkiAvailable === null) {
        await this.checkAnkiConnect();
      }

      if (!this.isAnkiAvailable) {
        throw new Error("AnkiConnect is not available");
      }

      // Get deck names directly from Anki
      const decks = await this.invokeAnki("deckNames");
      console.log("Raw deck names from Anki:", decks);

      // Filter out any empty or invalid deck names and sort them
      const validDecks = decks
        .filter((deck) => deck && deck.trim() !== "")
        .sort((a, b) => a.localeCompare(b));

      console.log("Valid deck names:", validDecks);

      sendResponse({
        success: true,
        decks: validDecks,
      });
    } catch (error) {
      console.error("Error getting Anki decks:", error);
      sendResponse({
        success: false,
        error: error.message,
        decks: [],
      });
    }
  }

  async handleGetAnkiNoteTypes(sendResponse) {
    try {
      if (this.isAnkiAvailable === null) {
        await this.checkAnkiConnect();
      }

      if (!this.isAnkiAvailable) {
        throw new Error("AnkiConnect is not available");
      }

      const noteTypes = await this.invokeAnki("modelNames");
      console.log("Note types from Anki:", noteTypes);

      sendResponse({
        success: true,
        noteTypes: noteTypes,
      });
    } catch (error) {
      console.error("Error getting Anki note types:", error);
      sendResponse({
        success: false,
        error: error.message,
        noteTypes: [],
      });
    }
  }

  async handleGetAnkiNoteTypeFields(noteType, sendResponse) {
    try {
      if (this.isAnkiAvailable === null) {
        await this.checkAnkiConnect();
      }

      if (!this.isAnkiAvailable) {
        throw new Error("AnkiConnect is not available");
      }

      if (!noteType) {
        throw new Error("Note type is required");
      }

      const modelInfo = await this.invokeAnki("modelFieldNames", {
        modelName: noteType,
      });
      console.log("Fields for note type", noteType, ":", modelInfo);

      sendResponse({
        success: true,
        fields: modelInfo,
      });
    } catch (error) {
      console.error("Error getting note type fields:", error);
      sendResponse({
        success: false,
        error: error.message,
        fields: [],
      });
    }
  }

  // ============ EXISTING METHODS (unchanged) ============

  async handleWordLookup(word, sendResponse) {
    try {
      // Check if extension is enabled
      if (!this.extensionSettings.extensionEnabled) {
        sendResponse({
          success: false,
          error: "Extension is disabled",
        });
        return;
      }

      // This is where you'd integrate with a real dictionary API
      // For now, we'll use a simple lookup
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
    // Placeholder dictionary - replace with real API call
    const dictionary = {
      hello: { definition: "A greeting", pronunciation: "həˈloʊ" },
      world: {
        definition: "The earth and all its inhabitants",
        pronunciation: "wɜrld",
      },
      language: {
        definition: "A system of communication",
        pronunciation: "ˈlæŋɡwɪdʒ",
      },
      learn: {
        definition: "To acquire knowledge or skills",
        pronunciation: "lɜrn",
      },
      study: {
        definition: "To devote time to learning",
        pronunciation: "ˈstʌdi",
      },
    };

    return dictionary[word.toLowerCase()] || null;
  }

  async handleAddToVocab(wordData, sendResponse) {
    try {
      const result = await chrome.storage.local.get(["vocabList"]);
      const vocabList = result.vocabList || [];

      // Check if word already exists
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

  async setupDailyReset() {
    // Check if we need to reset daily counters
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
          console.log("Daily session count reset");
        }
      } catch (error) {
        console.error("Failed to reset daily counters:", error);
      }
    };

    // Check immediately
    await checkAndReset();

    // Set up alarm to check daily
    chrome.alarms.create("dailyReset", {
      delayInMinutes: 1,
      periodInMinutes: 60 * 24,
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "dailyReset") {
        checkAndReset();
      }
    });
  }
}

// Initialize background service
new BackgroundService();
