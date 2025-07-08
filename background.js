// Background Script for Helios Language Learning Extension with Clean Anki Integration
class BackgroundService {
  constructor() {
    this.extensionSettings = {};
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

    // Load extension settings on startup
    this.loadExtensionSettings();

    console.log(
      "🔧 Helios Background Service initialized with clean Anki integration"
    );
  }

  async loadExtensionSettings() {
    try {
      const result = await chrome.storage.local.get([
        "extensionEnabled",
        "activationKey",
        "autoHighlight",
        "popupTheme",
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
      };

      console.log("🔍 Loaded extension settings:", this.extensionSettings);
    } catch (error) {
      console.error("🔍 Error loading extension settings:", error);
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

      // Build card fields
      const fields = this.buildCardFields(
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
          allowDuplicate: finalSettings.allowDuplicates || false,
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

  // ============ ANKI HELPER METHODS ============

  async invokeAnki(action, params = {}) {
    try {
      const response = await fetch("http://127.0.0.1:8765", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      console.error("🃏 AnkiConnect error:", error);
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

    // Heuristic to split unspaced pinyin for multi-character words.
    // This regex finds a vowel and splits before the following consonant.
    if (charCount > 1 && !pinyin.includes(' ')) {
        const syllables = pinyin.replace(/([aeiouvüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])([b-df-hj-np-tv-z])/g, '$1 $2').split(' ');
        if (syllables.length === charCount) {
            pinyin = syllables.join(' ');
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

  buildCardFields(wordData, fieldMappings) {
    const fields = {};

    const pinyinWithNumbers = this.pinyinTonesToNumbers(wordData.pinyin, wordData.character.length);

    // Available data
    const dataMap = {
      expression: wordData.character,
      expressionRubyTxt: `${wordData.character}[${pinyinWithNumbers};]`,
      reading: pinyinWithNumbers,
      meaning: wordData.definition,
      sentence: wordData.sentence,
      traditional: wordData.traditional,
      simplified: wordData.simplified,
      source: wordData.url,
      frequency: wordData.frequency?.toString() || "",
    };

    // Apply field mappings
    for (const [fieldName, dataType] of Object.entries(fieldMappings)) {
      if (dataType && dataMap[dataType]) {
        fields[fieldName] = dataMap[dataType];
      }
    }

    // Fallback if no mappings
    if (Object.keys(fields).length === 0) {
      fields["Front"] = wordData.character || "Unknown";
      fields["Back"] =
        pinyinWithNumbers && wordData.definition
          ? `${pinyinWithNumbers}<br>${wordData.definition}`
          : wordData.definition || "No definition";
    }

    return fields;
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
