// Background Script for Helios Language Learning Extension with Anki Integration (Manifest V3)
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

    console.log("🔧 Helios Background Service initialized (Manifest V3)");
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
          ankiDeck: "Chinese::Helios",
          deck: "Chinese::Helios", // compatibility
          ankiNoteType: "Basic",
          noteType: "Basic", // compatibility
          ankiFieldMappings: {},
          fieldMappings: {}, // compatibility
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

      console.log("🔧 Helios extension initialized with default data");
    } catch (error) {
      console.error("Failed to setup initial data:", error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log(
      "🔧 Background received message:",
      message.type || message.action
    );

    try {
      switch (message.type || message.action) {
        // === SETTINGS HANDLERS ===
        case "toggleExtension":
          await this.handleToggleExtension(message.enabled, sendResponse);
          break;

        case "settingsChanged":
          await this.handleSettingsChanged(message.settings, sendResponse);
          break;

        case "getExtensionSettings":
          await this.handleGetExtensionSettings(sendResponse);
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

        // === ANKI HANDLERS ===
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

        case "GET_ANKI_DECKS":
          await this.handleGetAnkiDecks(sendResponse);
          break;

        case "GET_ANKI_NOTE_TYPES":
          await this.handleGetAnkiNoteTypes(sendResponse);
          break;

        case "GET_ANKI_NOTE_TYPE_FIELDS":
          await this.handleGetAnkiNoteTypeFields(
            message.noteType,
            sendResponse
          );
          break;

        default:
          console.warn(
            "🔧 Unknown message type:",
            message.type || message.action
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

  // ============ SETTINGS HANDLERS ============

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
        settings: this.extensionSettings,
      });
    }
  }

  // ============ ANKI INTEGRATION METHODS ============

  async checkAnkiConnect() {
    try {
      console.log("🃏 Checking AnkiConnect availability...");
      const response = await this.invokeAnki("version");
      this.isAnkiAvailable = response !== null;
      console.log(
        "🃏 AnkiConnect status:",
        this.isAnkiAvailable ? "Available" : "Not available"
      );
      return this.isAnkiAvailable;
    } catch (error) {
      console.warn("🃏 AnkiConnect not available:", error);
      this.isAnkiAvailable = false;
      return false;
    }
  }

  async invokeAnki(action, params = {}) {
    try {
      console.log(`🃏 Invoking Anki action: ${action}`, params);

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
      console.log(`🃏 Anki response for ${action}:`, data);

      if (data.error) {
        throw new Error(data.error);
      }

      return data.result;
    } catch (error) {
      console.error("🃏 AnkiConnect error:", error);
      throw error;
    }
  }

  async ensureDeckExists(deckName) {
    try {
      const decks = await this.invokeAnki("deckNames");
      if (!decks.includes(deckName)) {
        await this.invokeAnki("createDeck", { deck: deckName });
        console.log(`🃏 Created deck: ${deckName}`);
      }
      return true;
    } catch (error) {
      console.error("🃏 Error ensuring deck exists:", error);
      return false;
    }
  }

  async findDuplicates(expression) {
    try {
      const query = `"Expression:${expression}" OR "Front:${expression}" OR "Chinese:${expression}"`;
      return await this.invokeAnki("findNotes", { query: query });
    } catch (error) {
      console.error("🃏 Error finding duplicates:", error);
      return [];
    }
  }

  // Smart field preparation method
  async prepareCardFieldsSmart(wordData, options, availableFields) {
    console.log("🃏 Smart field preparation:", {
      wordData,
      options,
      availableFields,
    });

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
      throw new Error("No character data provided for card creation");
    }

    const mainCharacter = character || simplified || traditional;
    const reading = pinyin || "";
    const meaning = definition || "";

    // Create the data mapping
    const heliosData = {
      expression: mainCharacter,
      reading: reading,
      meaning: meaning,
      sentence: sentence || "",
      traditional: traditional || mainCharacter,
      simplified: simplified || mainCharacter,
      source: url || "",
      frequency: frequency ? frequency.toString() : "",
      tone: "", // Add if you have tone data
      audio: "", // Add if you have audio data
      timestamp: new Date().toISOString(),
    };

    console.log("🃏 Helios data prepared:", heliosData);

    const fields = {};

    // If we have field mappings, use them
    if (
      options.fieldMappings &&
      Object.keys(options.fieldMappings).length > 0
    ) {
      console.log("🃏 Using custom field mappings:", options.fieldMappings);

      for (const [ankiField, heliosField] of Object.entries(
        options.fieldMappings
      )) {
        if (
          heliosField &&
          heliosField !== "" &&
          availableFields.includes(ankiField)
        ) {
          fields[ankiField] = heliosData[heliosField] || "";
        }
      }
    } else {
      // Use smart auto-mapping based on available fields
      console.log(
        "🃏 Using auto-mapping for available fields:",
        availableFields
      );

      const autoMappings = {
        // Common Chinese learning fields
        Expression: "expression",
        Chinese: "expression",
        Character: "expression",
        Front: "expression",

        Reading: "reading",
        Pinyin: "reading",
        Pronunciation: "reading",

        Meaning: "meaning",
        Definition: "meaning",
        English: "meaning",
        Back: "meaning",

        Sentence: "sentence",
        Context: "sentence",
        Example: "sentence",

        Traditional: "traditional",
        Simplified: "simplified",
        Source: "source",
        URL: "source",
      };

      // Map available fields to Helios data
      for (const ankiField of availableFields) {
        const heliosField = autoMappings[ankiField];
        if (heliosField && heliosData[heliosField]) {
          fields[ankiField] = heliosData[heliosField];
        }
      }

      // Ensure we have at least one field mapped
      if (Object.keys(fields).length === 0) {
        // Fallback: use first available field for expression and second for meaning
        if (availableFields.length >= 1) {
          fields[availableFields[0]] = mainCharacter;
        }
        if (availableFields.length >= 2) {
          fields[availableFields[1]] = reading
            ? `${reading}<br>${meaning}`
            : meaning;
        }
      }
    }

    console.log("🃏 Final mapped fields:", fields);

    // Validate that we have at least one non-empty field
    const nonEmptyFields = Object.entries(fields).filter(
      ([key, value]) => value && value.trim()
    );
    if (nonEmptyFields.length === 0) {
      throw new Error("No valid field mappings resulted in non-empty fields");
    }

    return fields;
  }

  // ============ ANKI MESSAGE HANDLERS ============

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

      // Get settings with proper error handling
      let settings;
      try {
        const result = await chrome.storage.local.get(["ankiSettings"]);
        settings = result.ankiSettings || {};

        // Apply defaults for missing settings
        settings = {
          deck: settings.ankiDeck || settings.deck || "Chinese::Helios",
          noteType: settings.ankiNoteType || settings.noteType || "Basic",
          fieldMappings:
            settings.ankiFieldMappings || settings.fieldMappings || {},
          checkDuplicates:
            settings.checkDuplicates !== undefined
              ? settings.checkDuplicates
              : true,
          allowDuplicates:
            settings.allowDuplicates !== undefined
              ? settings.allowDuplicates
              : false,
          tags: settings.tags || ["helios"],
        };

        console.log("🃏 Loaded settings:", settings);
      } catch (error) {
        console.error("🃏 Error getting Anki settings:", error);
        throw new Error("Could not load Anki settings");
      }

      // Merge options with settings (options take priority)
      const finalOptions = { ...settings, ...options };
      console.log("🃏 Final options:", finalOptions);

      // Validate required settings
      if (!finalOptions.deck) {
        throw new Error("No deck specified in settings");
      }
      if (!finalOptions.noteType) {
        throw new Error("No note type specified in settings");
      }

      // Ensure deck exists
      try {
        await this.ensureDeckExists(finalOptions.deck);
      } catch (error) {
        console.error("🃏 Error ensuring deck exists:", error);
        // Continue anyway
      }

      // Get available fields and prepare card fields
      let fields;
      try {
        const availableFields = await this.invokeAnki("modelFieldNames", {
          modelName: finalOptions.noteType,
        });

        console.log("🃏 Available fields for note type:", availableFields);

        fields = await this.prepareCardFieldsSmart(
          wordData,
          finalOptions,
          availableFields
        );

        console.log("🃏 Prepared card fields:", fields);
      } catch (error) {
        console.error("🃏 Error preparing card fields:", error);
        throw new Error(`Could not prepare card fields: ${error.message}`);
      }

      // Validate that we have at least one non-empty field
      const nonEmptyFields = Object.entries(fields).filter(
        ([key, value]) => value && value.trim()
      );
      if (nonEmptyFields.length === 0) {
        throw new Error("All card fields are empty - cannot create card");
      }

      // Check for duplicates if enabled
      if (finalOptions.checkDuplicates && !finalOptions.allowDuplicates) {
        try {
          const mainExpression =
            fields.Front ||
            fields.Expression ||
            fields.Chinese ||
            wordData.character ||
            wordData.simplified ||
            wordData.traditional;

          if (mainExpression) {
            const duplicates = await this.findDuplicates(mainExpression);
            if (duplicates.length > 0) {
              console.log("🃏 Duplicate card found");
              sendResponse({
                success: false,
                error: "Card already exists",
                duplicateIds: duplicates,
              });
              return;
            }
          }
        } catch (error) {
          console.warn("🃏 Error checking duplicates:", error);
        }
      }

      // Create the note
      let noteId;
      try {
        const noteData = {
          deckName: finalOptions.deck,
          modelName: finalOptions.noteType,
          fields: fields,
          tags: finalOptions.tags || ["helios"],
          options: {
            allowDuplicate: finalOptions.allowDuplicates || false,
          },
        };

        console.log("🃏 Creating note with data:", noteData);

        noteId = await this.invokeAnki("addNote", { note: noteData });
      } catch (error) {
        console.error("🃏 AnkiConnect addNote error:", error);

        // Provide specific error messages
        if (error.message.includes("model was not found")) {
          throw new Error(
            `Note type "${finalOptions.noteType}" not found in Anki`
          );
        } else if (error.message.includes("deck was not found")) {
          throw new Error(`Deck "${finalOptions.deck}" not found in Anki`);
        } else if (error.message.includes("empty")) {
          throw new Error("Card fields are empty or invalid");
        } else {
          throw new Error(`Anki error: ${error.message}`);
        }
      }

      console.log("🃏 Anki card created successfully with note ID:", noteId);

      // Update counter
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
        ankiDeck: "Chinese::Helios",
        deck: "Chinese::Helios",
        ankiNoteType: "Basic",
        noteType: "Basic",
        ankiFieldMappings: {},
        fieldMappings: {},
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
      console.log("🃏 Saving Anki settings:", settings);
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

  async handleGetAnkiDecks(sendResponse) {
    try {
      if (this.isAnkiAvailable === null) {
        await this.checkAnkiConnect();
      }

      if (!this.isAnkiAvailable) {
        throw new Error("AnkiConnect is not available");
      }

      const decks = await this.invokeAnki("deckNames");
      const validDecks = decks
        .filter((deck) => deck && deck.trim() !== "")
        .sort((a, b) => a.localeCompare(b));

      sendResponse({
        success: true,
        decks: validDecks,
      });
    } catch (error) {
      console.error("🃏 Error getting Anki decks:", error);
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

      sendResponse({
        success: true,
        noteTypes: noteTypes,
      });
    } catch (error) {
      console.error("🃏 Error getting Anki note types:", error);
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

      sendResponse({
        success: true,
        fields: modelInfo,
      });
    } catch (error) {
      console.error("🃏 Error getting note type fields:", error);
      sendResponse({
        success: false,
        error: error.message,
        fields: [],
      });
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
          console.log("🔧 Daily session count reset");
        }
      } catch (error) {
        console.error("Failed to reset daily counters:", error);
      }
    };

    // Check immediately
    await checkAndReset();

    // Set up alarm to check daily (Manifest V3 compatible)
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

// Initialize background service for Manifest V3
const backgroundService = new BackgroundService();

// Export for debugging (optional)
if (typeof globalThis !== "undefined") {
  globalThis.backgroundService = backgroundService;
}
