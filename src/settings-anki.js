// Helios Settings Anki Integration
// Handles all Anki-related functionality

class HeliosSettingsAnki {
  constructor(manager) {
    this.manager = manager;
    this.ankiConnection = null;
    this.availableDecks = [];
    this.availableNoteTypes = [];
    this.currentNoteTypeFields = [];

    // Available Helios data for Anki field mapping
    this.availableHeliosData = [
      { value: "", label: "Not mapped" },
      { value: "expression", label: "Expression (对)" },
      { value: "reading", label: "Reading (duì)" },
      { value: "meaning", label: "Meaning (right; correct; towards...)" },
      { value: "sentence", label: "Sentence (这个答案是对的。)" },
      { value: "traditional", label: "Traditional (對)" },
      { value: "simplified", label: "Simplified (对)" },
      { value: "source", label: "Source URL" },
      { value: "frequency", label: "Frequency Rank" },
      { value: "tone", label: "Tone Number" },
      { value: "audio", label: "Audio URL" },
      { value: "timestamp", label: "Timestamp" },
    ];
  }

  async initializeAnki() {
    try {
      await this.checkAnkiConnection();
      if (this.ankiConnection) {
        await Promise.all([this.loadAnkiDecks(), this.loadAnkiNoteTypes()]);
        this.populateAnkiDropdowns();

        // Load existing note type and setup field mappings
        const noteType =
          this.manager.settings.ankiNoteType || this.manager.settings.noteType;
        if (noteType) {
          await this.loadNoteTypeFields(noteType);
          this.updateFieldMappingTable();
        }

        // Setup toggle event listeners
        this.setupToggleEventListeners();

        // Load existing toggle states
        this.loadToggleStates();

        // Setup dropdown event listeners
        this.setupDropdownEventListeners();
      }
    } catch (error) {
      console.error("Error initializing Anki:", error);
    }
  }

  async sendAnkiMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error("Chrome extension context not available"));
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

  async checkAnkiConnection() {
    const statusElement = document.getElementById("anki-connection-status");
    if (!statusElement) return;

    try {
      statusElement.className = "status-indicator status-checking";
      statusElement.innerHTML = "<span>●</span><span>Checking...</span>";

      const response = await this.sendAnkiMessage("TEST_ANKI_CONNECTION");
      this.ankiConnection = true;

      statusElement.className = "status-indicator status-connected";
      statusElement.innerHTML = "<span>●</span><span>Connected</span>";

      return true;
    } catch (error) {
      console.error("Anki connection failed:", error);
      this.ankiConnection = false;

      statusElement.className = "status-indicator status-disconnected";
      statusElement.innerHTML = "<span>●</span><span>Disconnected</span>";

      return false;
    }
  }

  async testAnkiConnection() {
    const button = document.getElementById("test-anki-connection");
    if (!button) return;

    const originalText = button.innerHTML;
    button.innerHTML = "<span>🔄</span>Testing...";
    button.disabled = true;

    try {
      const connected = await this.checkAnkiConnection();

      if (connected) {
        button.innerHTML = "<span>✅</span>Connected!";
        button.className = "btn btn-success";
      } else {
        button.innerHTML = "<span>❌</span>Failed";
        button.className = "btn btn-danger";
      }

      setTimeout(() => {
        button.innerHTML = originalText;
        button.className = "btn btn-anki";
        button.disabled = false;
      }, 2000);
    } catch (error) {
      button.innerHTML = "<span>❌</span>Error";
      button.className = "btn btn-danger";

      setTimeout(() => {
        button.innerHTML = originalText;
        button.className = "btn btn-anki";
        button.disabled = false;
      }, 2000);
    }
  }

  async loadAnkiDecks() {
    try {
      const response = await this.sendAnkiMessage("GET_ANKI_DECKS");
      this.availableDecks = response.decks || [];
      console.log("Loaded Anki decks:", this.availableDecks);
    } catch (error) {
      console.error("Error loading Anki decks:", error);
      this.availableDecks = [];
    }
  }

  async loadAnkiNoteTypes() {
    try {
      const response = await this.sendAnkiMessage("GET_ANKI_NOTE_TYPES");
      this.availableNoteTypes = response.noteTypes || [];
      console.log("Loaded Anki note types:", this.availableNoteTypes);
    } catch (error) {
      console.error("Error loading Anki note types:", error);
      this.availableNoteTypes = [];
    }
  }

  populateAnkiDropdowns() {
    // Populate decks dropdown
    const deckSelect = document.getElementById("anki-deck-select");
    if (deckSelect) {
      deckSelect.innerHTML = '<option value="">Select a deck...</option>';
      this.availableDecks.forEach((deck) => {
        const option = document.createElement("option");
        option.value = deck;
        option.textContent = deck;
        // Check both possible setting keys for selection
        const selectedDeck =
          this.manager.settings.ankiDeck || this.manager.settings.deck;
        option.selected = deck === selectedDeck;
        deckSelect.appendChild(option);
      });
    }

    // Populate note types dropdown
    const noteTypeSelect = document.getElementById("anki-note-type-select");
    if (noteTypeSelect) {
      noteTypeSelect.innerHTML =
        '<option value="">Select a note type...</option>';
      this.availableNoteTypes.forEach((noteType) => {
        const option = document.createElement("option");
        option.value = noteType;
        option.textContent = noteType;
        // Check both possible setting keys for selection
        const selectedNoteType =
          this.manager.settings.ankiNoteType || this.manager.settings.noteType;
        option.selected = noteType === selectedNoteType;
        noteTypeSelect.appendChild(option);
      });
    }
  }

  // FIXED: Setup dropdown event listeners
  setupDropdownEventListeners() {
    const deckSelect = document.getElementById("anki-deck-select");
    const noteTypeSelect = document.getElementById("anki-note-type-select");

    if (deckSelect) {
      deckSelect.addEventListener("change", (e) => this.onDeckChange(e));
    }

    if (noteTypeSelect) {
      noteTypeSelect.addEventListener("change", (e) =>
        this.onNoteTypeChange(e)
      );
    }
  }

  // FIXED: Deck change handler
  async onDeckChange(event) {
    console.log("🎯 Deck changed to:", event.target.value);

    // Update settings with both possible key names for compatibility
    this.manager.settings.ankiDeck = event.target.value;
    this.manager.settings.deck = event.target.value; // fallback

    await this.manager.storage.saveSettings();

    // Also save to background storage
    await this.saveAnkiSettings();

    console.log("🎯 Deck setting saved");
  }

  // FIXED: Note type change handler
  async onNoteTypeChange(event) {
    console.log("🎯 Note type changed to:", event.target.value);

    // Update settings with both possible key names for compatibility
    this.manager.settings.ankiNoteType = event.target.value;
    this.manager.settings.noteType = event.target.value; // fallback

    await this.manager.storage.saveSettings();

    if (event.target.value) {
      try {
        await this.loadNoteTypeFields(event.target.value);
        this.updateFieldMappingTable();
      } catch (error) {
        console.error("Error loading note type fields:", error);
      }
    } else {
      this.clearFieldMappingTable();
    }

    // Also save to background storage
    await this.saveAnkiSettings();

    console.log("🎯 Note type setting saved");
  }

  async loadNoteTypeFields(noteType) {
    try {
      const response = await this.sendAnkiMessage("GET_ANKI_NOTE_TYPE_FIELDS", {
        noteType,
      });

      if (response.success && response.fields) {
        this.currentNoteTypeFields = response.fields;
      } else {
        this.currentNoteTypeFields = this.getFallbackFields(noteType);
      }
    } catch (error) {
      console.warn("Error loading note type fields:", error);
      this.currentNoteTypeFields = this.getFallbackFields(noteType);
    }
  }

  getFallbackFields(noteType) {
    if (!noteType) return ["Front", "Back"];

    const lowerNoteType = noteType.toLowerCase();
    if (lowerNoteType.includes("cloze")) {
      return ["Text", "Back Extra"];
    } else if (
      lowerNoteType.includes("chinese") ||
      lowerNoteType.includes("migaku")
    ) {
      return ["Expression", "Reading", "Meaning", "Sentence", "Audio", "Image"];
    } else {
      return ["Front", "Back"];
    }
  }

  updateFieldMappingTable() {
    const tableBody = document.getElementById("anki-field-mapping-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    this.currentNoteTypeFields.forEach((ankiField) => {
      const row = document.createElement("tr");
      // Check both possible mapping keys
      const currentMapping =
        this.manager.settings.ankiFieldMappings?.[ankiField] ||
        this.manager.settings.fieldMappings?.[ankiField] ||
        "";
      const previewData = this.getPreviewData(currentMapping);

      row.innerHTML = `
        <td class="anki-field">
          <div class="field-name">
            <span class="field-icon">📝</span>
            ${ankiField}
          </div>
        </td>
        <td>
          <select class="form-control mapping-select" data-anki-field="${ankiField}">
            ${this.generateHeliosDataOptions(currentMapping)}
          </select>
        </td>
        <td class="preview-data">${previewData}</td>
      `;

      tableBody.appendChild(row);
    });

    this.setupFieldMappingEventListeners();
    this.applyAutoMapping();
  }

  generateHeliosDataOptions(selectedValue = "") {
    return this.availableHeliosData
      .map(
        (item) =>
          `<option value="${item.value}" ${
            item.value === selectedValue ? "selected" : ""
          }>
        ${item.label}
      </option>`
      )
      .join("");
  }

  getPreviewData(heliosFieldType) {
    const previews = {
      "": "—",
      expression: "对",
      reading: "duì",
      meaning: "right; correct; towards...",
      sentence: "这个答案是对的。",
      traditional: "對",
      simplified: "对",
      source: "https://example.com",
      frequency: "129",
      tone: "4",
      audio: "[audio]",
      timestamp: "00:05:23",
    };

    return previews[heliosFieldType] || "—";
  }

  // FIXED: Field mapping event listeners
  setupFieldMappingEventListeners() {
    const mappingSelects = document.querySelectorAll(".mapping-select");

    mappingSelects.forEach((select) => {
      select.addEventListener("change", async (e) => {
        const ankiField = e.target.getAttribute("data-anki-field");
        const heliosData = e.target.value;

        console.log(`🎯 Field mapping changed: ${ankiField} -> ${heliosData}`);

        // Initialize field mappings object if it doesn't exist
        if (!this.manager.settings.ankiFieldMappings) {
          this.manager.settings.ankiFieldMappings = {};
        }

        // Also store in alternative key name for compatibility
        if (!this.manager.settings.fieldMappings) {
          this.manager.settings.fieldMappings = {};
        }

        // Update both possible key names
        this.manager.settings.ankiFieldMappings[ankiField] = heliosData;
        this.manager.settings.fieldMappings[ankiField] = heliosData;

        // Update preview
        const previewCell = e.target
          .closest("tr")
          .querySelector(".preview-data");
        if (previewCell) {
          previewCell.textContent = this.getPreviewData(heliosData);
        }

        // Save settings
        await this.manager.storage.saveSettings();

        // Also save to background storage
        await this.saveAnkiSettings();

        console.log(
          "🎯 Field mapping saved:",
          this.manager.settings.ankiFieldMappings
        );
      });
    });
  }

  applyAutoMapping() {
    const autoMappings = {
      Expression: "expression",
      Chinese: "expression",
      Character: "expression",
      Front: "expression",
      Reading: "reading",
      Pinyin: "reading",
      Meaning: "meaning",
      Definition: "meaning",
      English: "meaning",
      Back: "meaning",
      Sentence: "sentence",
      Context: "sentence",
      Traditional: "traditional",
      Simplified: "simplified",
      Source: "source",
      URL: "source",
      Audio: "audio",
    };

    let hasExistingMappings = false;

    // Check if any field already has a mapping
    this.currentNoteTypeFields.forEach((ankiField) => {
      const existingMapping =
        this.manager.settings.ankiFieldMappings?.[ankiField] ||
        this.manager.settings.fieldMappings?.[ankiField];
      if (existingMapping) {
        hasExistingMappings = true;
      }
    });

    // Only apply auto-mapping if no existing mappings
    if (!hasExistingMappings) {
      this.currentNoteTypeFields.forEach((ankiField) => {
        const autoMapping = autoMappings[ankiField];
        if (autoMapping) {
          if (!this.manager.settings.ankiFieldMappings) {
            this.manager.settings.ankiFieldMappings = {};
          }
          if (!this.manager.settings.fieldMappings) {
            this.manager.settings.fieldMappings = {};
          }

          this.manager.settings.ankiFieldMappings[ankiField] = autoMapping;
          this.manager.settings.fieldMappings[ankiField] = autoMapping;

          const select = document.querySelector(
            `[data-anki-field="${ankiField}"]`
          );
          if (select) {
            select.value = autoMapping;

            // Update preview
            const previewCell = select
              .closest("tr")
              .querySelector(".preview-data");
            if (previewCell) {
              previewCell.textContent = this.getPreviewData(autoMapping);
            }
          }
        }
      });

      this.manager.storage.saveSettings();
      this.saveAnkiSettings();
    }
  }

  clearFieldMappingTable() {
    const tableBody = document.getElementById("anki-field-mapping-body");
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 40px; color: var(--helios-text-muted);">
          <div>Select a note type to configure field mappings</div>
        </td>
      </tr>
    `;

    // Clear mappings
    this.manager.settings.ankiFieldMappings = {};
    this.manager.settings.fieldMappings = {};
    this.manager.storage.saveSettings();
    this.saveAnkiSettings();
  }

  // FIXED: Setup toggle event listeners
  setupToggleEventListeners() {
    const checkDuplicatesToggle = document.getElementById(
      "anki-check-duplicates"
    );
    const includeSentenceToggle = document.getElementById(
      "anki-include-sentence"
    );

    if (checkDuplicatesToggle) {
      checkDuplicatesToggle.addEventListener("change", async (e) => {
        console.log("🎯 Check duplicates changed to:", e.target.checked);

        this.manager.settings.checkDuplicates = e.target.checked;
        this.manager.settings.allowDuplicates = !e.target.checked; // inverse logic

        await this.manager.storage.saveSettings();
        await this.saveAnkiSettings();

        console.log("🎯 Duplicate checking setting saved");
      });
    }

    if (includeSentenceToggle) {
      includeSentenceToggle.addEventListener("change", async (e) => {
        console.log("🎯 Include sentence changed to:", e.target.checked);

        this.manager.settings.includeSentence = e.target.checked;

        await this.manager.storage.saveSettings();
        await this.saveAnkiSettings();

        console.log("🎯 Include sentence setting saved");
      });
    }
  }

  // FIXED: Load existing toggle states from settings
  loadToggleStates() {
    const checkDuplicatesToggle = document.getElementById(
      "anki-check-duplicates"
    );
    const includeSentenceToggle = document.getElementById(
      "anki-include-sentence"
    );

    if (checkDuplicatesToggle) {
      // Default to true if not set
      const checkDuplicates =
        this.manager.settings.checkDuplicates !== undefined
          ? this.manager.settings.checkDuplicates
          : true;
      checkDuplicatesToggle.checked = checkDuplicates;
    }

    if (includeSentenceToggle) {
      // Default to true if not set
      const includeSentence =
        this.manager.settings.includeSentence !== undefined
          ? this.manager.settings.includeSentence
          : true;
      includeSentenceToggle.checked = includeSentence;
    }
  }

  // FIXED: Save settings to background storage
  async saveAnkiSettings() {
    try {
      const ankiSettings = {
        ankiDeck: this.manager.settings.ankiDeck || this.manager.settings.deck,
        deck: this.manager.settings.ankiDeck || this.manager.settings.deck, // compatibility
        ankiNoteType:
          this.manager.settings.ankiNoteType || this.manager.settings.noteType,
        noteType:
          this.manager.settings.ankiNoteType || this.manager.settings.noteType, // compatibility
        ankiFieldMappings: this.manager.settings.ankiFieldMappings || {},
        fieldMappings: this.manager.settings.ankiFieldMappings || {}, // compatibility
        checkDuplicates:
          this.manager.settings.checkDuplicates !== undefined
            ? this.manager.settings.checkDuplicates
            : true,
        allowDuplicates:
          this.manager.settings.allowDuplicates !== undefined
            ? this.manager.settings.allowDuplicates
            : false,
        includeSentence:
          this.manager.settings.includeSentence !== undefined
            ? this.manager.settings.includeSentence
            : true,
        includeUrl:
          this.manager.settings.includeUrl !== undefined
            ? this.manager.settings.includeUrl
            : true,
        tags: this.manager.settings.tags || ["helios"],
      };

      console.log("🎯 Saving Anki settings to background:", ankiSettings);

      const response = await this.sendAnkiMessage("SAVE_ANKI_SETTINGS", {
        settings: ankiSettings,
      });

      console.log("🎯 Anki settings saved to background:", response);
      return response.success;
    } catch (error) {
      console.error("🎯 Error saving Anki settings:", error);
      return false;
    }
  }
}

window.HeliosSettingsAnki = HeliosSettingsAnki;
