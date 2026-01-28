// Updated Helios Settings Anki Integration - Simplified and Clean
class HeliosSettingsAnki {
  constructor(manager) {
    this.manager = manager;
    this.isConnected = false;
    this.availableDecks = [];
    this.availableNoteTypes = [];
    this.currentNoteTypeFields = [];
    this.autoMappingApplied = false;
    this.currentLanguage = 'zh'; // Will be updated from settings
  }

  // Get language-specific field options
  getAvailableDataTypes() {
    const language = this.manager.settings.targetLanguage || 'zh';

    if (language === 'zh') {
      // Chinese-specific fields
      return [
        { value: "", label: "Not mapped" },
        { value: "expression", label: "Expression (对)" },
        { value: "expressionRubyTxt", label: "Expression with Ruby Pinyin (对[dui4;])" },
        { value: "reading", label: "Reading (dui4)" },
        { value: "traditional", label: "Traditional (對)" },
        { value: "simplified", label: "Simplified (对)" },
        { value: "meaning", label: "Meaning (right; correct)" },
        { value: "sentence", label: "Sentence (这个答案是对的)" },
        { value: "source", label: "Source URL" },
        { value: "frequency", label: "Frequency Rank (129)" },
        { value: "screenshot", label: "Screenshot (image)" },
        { value: "sentenceAudio", label: "Sentence Audio (audio file)" },
      ];
    } else if (language === 'fr') {
      // French-specific fields
      return [
        { value: "", label: "Not mapped" },
        { value: "expression", label: "Word (précis)" },
        { value: "reading", label: "Pronunciation (/pʁesi/)" },
        { value: "meaning", label: "Meaning (accurate; exact)" },
        { value: "sentence", label: "Sentence (Cette mesure est très précise)" },
        { value: "source", label: "Source URL" },
        { value: "screenshot", label: "Screenshot (image)" },
        { value: "sentenceAudio", label: "Sentence Audio (audio file)" },
      ];
    } else if (language === 'es') {
      // Spanish-specific fields
      return [
        { value: "", label: "Not mapped" },
        { value: "expression", label: "Word (preciso)" },
        { value: "reading", label: "Pronunciation (/pɾeˈθiso/)" },
        { value: "meaning", label: "Meaning (precise; accurate)" },
        { value: "sentence", label: "Sentence (Es necesario ser preciso)" },
        { value: "source", label: "Source URL" },
        { value: "screenshot", label: "Screenshot (image)" },
        { value: "sentenceAudio", label: "Sentence Audio (audio file)" },
      ];
    } else if (language === 'en') {
      // English-specific fields
      return [
        { value: "", label: "Not mapped" },
        { value: "expression", label: "Word (precise)" },
        { value: "reading", label: "Pronunciation (/prɪˈsaɪs/)" },
        { value: "meaning", label: "Meaning (exact; accurate)" },
        { value: "sentence", label: "Sentence (The measurements must be precise)" },
        { value: "source", label: "Source URL" },
        { value: "screenshot", label: "Screenshot (image)" },
        { value: "sentenceAudio", label: "Sentence Audio (audio file)" },
      ];
    } else {
      // Generic fallback
      return [
        { value: "", label: "Not mapped" },
        { value: "expression", label: "Word" },
        { value: "reading", label: "Pronunciation" },
        { value: "meaning", label: "Meaning" },
        { value: "sentence", label: "Sentence" },
        { value: "source", label: "Source URL" },
        { value: "frequency", label: "Frequency Rank" },
        { value: "screenshot", label: "Screenshot (image)" },
        { value: "sentenceAudio", label: "Sentence Audio (audio file)" },
      ];
    }
  }

  // Initialize Anki integration
  async initializeAnki() {
    try {
      console.log("🃏 Initializing Anki integration...");

      // Check connection
      await this.checkConnection();

      if (this.isConnected) {
        // Load available decks and note types
        await Promise.all([this.loadDecks(), this.loadNoteTypes()]);

        // Populate dropdowns
        this.populateDropdowns();

        // Setup event listeners
        this.setupEventListeners();

        // Load current settings
        await this.loadCurrentSettings();

        // Update import button state after initialization
        this.updateImportButtonState();

        console.log("🃏 Anki integration initialized successfully");
      } else {
        this.showConnectionError();
      }
    } catch (error) {
      console.error("🃏 Error initializing Anki:", error);
      this.showConnectionError(error.message);
    }
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

  // Check connection to Anki
  async checkConnection() {
    const statusElement = document.getElementById("anki-connection-status");
    if (!statusElement) return;

    try {
      statusElement.className = "status-indicator status-checking";
      statusElement.innerHTML = "<span>●</span><span>Checking...</span>";

      const response = await this.sendMessage("ANKI_TEST_CONNECTION");
      this.isConnected = response.success;

      if (this.isConnected) {
        statusElement.className = "status-indicator status-connected";
        statusElement.innerHTML = "<span>●</span><span>Connected</span>";
      } else {
        statusElement.className = "status-indicator status-disconnected";
        statusElement.innerHTML = "<span>●</span><span>Disconnected</span>";
      }

      return this.isConnected;
    } catch (error) {
      console.error("🃏 Connection check failed:", error);
      this.isConnected = false;

      if (statusElement) {
        statusElement.className = "status-indicator status-error";
        statusElement.innerHTML = "<span>●</span><span>Error</span>";
      }

      return false;
    }
  }

  // Load available decks
  async loadDecks() {
    try {
      const response = await this.sendMessage("ANKI_GET_DECKS");
      this.availableDecks = response.decks || [];
      console.log("🃏 Loaded decks:", this.availableDecks);
    } catch (error) {
      console.error("🃏 Error loading decks:", error);
      this.availableDecks = [];
    }
  }

  // Load available note types
  async loadNoteTypes() {
    try {
      const response = await this.sendMessage("ANKI_GET_NOTE_TYPES");
      this.availableNoteTypes = response.noteTypes || [];
      console.log("🃏 Loaded note types:", this.availableNoteTypes);
    } catch (error) {
      console.error("🃏 Error loading note types:", error);
      this.availableNoteTypes = ["Basic"];
    }
  }

  // Populate dropdowns with available options
  populateDropdowns() {
    this.populateDecksDropdown();
    this.populateNoteTypesDropdown();
  }

  populateDecksDropdown() {
    const deckSelect = document.getElementById("anki-deck-select");
    if (!deckSelect) return;

    deckSelect.innerHTML = '<option value="">Select a deck...</option>';

    this.availableDecks.forEach((deck) => {
      const option = document.createElement("option");
      option.value = deck;
      option.textContent = deck;
      deckSelect.appendChild(option);
    });
  }

  populateNoteTypesDropdown() {
    const noteTypeSelect = document.getElementById("anki-note-type-select");
    if (!noteTypeSelect) return;

    noteTypeSelect.innerHTML =
      '<option value="">Select a note type...</option>';

    this.availableNoteTypes.forEach((noteType) => {
      const option = document.createElement("option");
      option.value = noteType;
      option.textContent = noteType;
      noteTypeSelect.appendChild(option);
    });
  }

  // Setup event listeners
  setupEventListeners() {
    // Test connection button
    const testButton = document.getElementById("test-anki-connection");
    if (testButton) {
      testButton.addEventListener("click", () => this.testConnection());
    }

    // Deck selection
    const deckSelect = document.getElementById("anki-deck-select");
    if (deckSelect) {
      deckSelect.addEventListener("change", (e) => this.onDeckChange(e));
    }

    // Note type selection
    const noteTypeSelect = document.getElementById("anki-note-type-select");
    if (noteTypeSelect) {
      noteTypeSelect.addEventListener("change", (e) =>
        this.onNoteTypeChange(e)
      );
    }

    // Settings toggles
    const checkDuplicates = document.getElementById("anki-check-duplicates");
    if (checkDuplicates) {
      checkDuplicates.addEventListener("change", (e) =>
        this.onSettingChange(e)
      );
    }

    const includeSentence = document.getElementById("anki-include-sentence");
    if (includeSentence) {
      includeSentence.addEventListener("change", (e) =>
        this.onSettingChange(e)
      );
    }

    // Import known words button
    const importButton = document.getElementById("anki-import-known-words");
    if (importButton) {
      importButton.addEventListener("click", () =>
        this.importKnownWordsFromAnki()
      );
    }
  }

  // Handle deck change
  async onDeckChange(event) {
    const deck = event.target.value;
    console.log("🃏 Deck changed to:", deck);

    // Update settings
    this.manager.settings.ankiDeck = deck;
    await this.saveSettings();

    // Update import button state
    this.updateImportButtonState();
  }

  // Handle note type change
  async onNoteTypeChange(event) {
    const noteType = event.target.value;
    console.log("🃏 Note type changed to:", noteType);

    // Update settings
    this.manager.settings.ankiNoteType = noteType;
    await this.saveSettings();

    // Load fields for this note type
    if (noteType) {
      await this.loadNoteTypeFields(noteType);
      this.updateFieldMappingTable();
    } else {
      this.clearFieldMappingTable();
    }

    // Update import button state
    this.updateImportButtonState();
  }

  // Handle setting changes
  async onSettingChange(event) {
    const setting = event.target.id;
    const value = event.target.checked;

    console.log("🃏 Setting changed:", setting, value);

    // Update settings based on the control
    switch (setting) {
      case "anki-check-duplicates":
        this.manager.settings.ankiCheckDuplicates = value;
        break;
      case "anki-include-sentence":
        this.manager.settings.ankiIncludeSentence = value;
        break;
    }

    await this.saveSettings();
  }

  // Load fields for a note type
  async loadNoteTypeFields(noteType) {
    try {
      const response = await this.sendMessage("ANKI_GET_NOTE_TYPE_FIELDS", {
        noteType,
      });
      this.currentNoteTypeFields = response.fields || [];
      console.log(
        "🃏 Loaded fields for",
        noteType,
        ":",
        this.currentNoteTypeFields
      );
    } catch (error) {
      console.error("🃏 Error loading note type fields:", error);
      this.currentNoteTypeFields = this.getFallbackFields(noteType);
    }
  }

  // Get fallback fields for common note types
  getFallbackFields(noteType) {
    const lowerType = noteType.toLowerCase();

    if (lowerType.includes("cloze")) {
      return ["Text", "Back Extra"];
    } else if (lowerType.includes("chinese") || lowerType.includes("migaku")) {
      return ["Expression", "Reading", "Meaning", "Sentence"];
    } else {
      return ["Front", "Back"];
    }
  }

  // Update field mapping table
  updateFieldMappingTable() {
    const tableBody = document.getElementById("anki-field-mapping-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    // Get current field mappings
    const currentMappings = this.manager.settings.ankiFieldMappings || {};

    this.currentNoteTypeFields.forEach((field) => {
      const row = document.createElement("tr");
      const currentMapping = currentMappings[field] || "";

      row.innerHTML = `
        <td class="anki-field">
          <div class="field-name">
            <span class="field-icon">📝</span>
            ${field}
          </div>
        </td>
        <td>
          <select class="form-control mapping-select" data-field="${field}">
            ${this.generateDataTypeOptions(currentMapping)}
          </select>
        </td>
        <td class="preview-data">${this.getPreviewData(currentMapping)}</td>
      `;

      tableBody.appendChild(row);
    });

    // Setup field mapping event listeners
    this.setupFieldMappingListeners();

    // Apply auto-mapping if no mappings exist
    if (!this.autoMappingApplied && Object.keys(currentMappings).length === 0) {
      this.applyAutoMapping();
    }
  }

  // Generate options for data type dropdown
  generateDataTypeOptions(selectedValue = "") {
    return this.getAvailableDataTypes()
      .map(
        (dataType) => `
        <option value="${dataType.value}" ${
          dataType.value === selectedValue ? "selected" : ""
        }>
          ${dataType.label}
        </option>
      `
      )
      .join("");
  }

  // Get preview data for a data type (language-aware)
  getPreviewData(dataType) {
    const language = this.manager.settings.targetLanguage || 'zh';

    const previewsByLanguage = {
      zh: {
        "": "—",
        expression: "对",
        expressionRubyTxt: "对[dui4;]",
        reading: "dui4",
        meaning: "right; correct",
        sentence: "这个答案是对的",
        traditional: "對",
        simplified: "对",
        source: "https://example.com",
        frequency: "129",
        screenshot: "[screenshot.jpg]",
        sentenceAudio: "[audio.webm]",
      },
      fr: {
        "": "—",
        expression: "précis",
        reading: "/pʁesi/",
        meaning: "accurate; exact",
        sentence: "Cette mesure est très précise",
        source: "https://example.com",
        screenshot: "[screenshot.jpg]",
        sentenceAudio: "[audio.webm]",
      },
      es: {
        "": "—",
        expression: "preciso",
        reading: "/pɾeˈθiso/",
        meaning: "precise; accurate",
        sentence: "Es necesario ser preciso",
        source: "https://example.com",
        screenshot: "[screenshot.jpg]",
        sentenceAudio: "[audio.webm]",
      },
      en: {
        "": "—",
        expression: "precise",
        reading: "/prɪˈsaɪs/",
        meaning: "exact; accurate",
        sentence: "The measurements must be precise",
        source: "https://example.com",
        screenshot: "[screenshot.jpg]",
        sentenceAudio: "[audio.webm]",
      },
    };

    const previews = previewsByLanguage[language] || previewsByLanguage['zh'];
    return previews[dataType] || "—";
  }

  // Setup field mapping event listeners
  setupFieldMappingListeners() {
    const mappingSelects = document.querySelectorAll(".mapping-select");

    mappingSelects.forEach((select) => {
      select.addEventListener("change", async (e) => {
        const field = e.target.getAttribute("data-field");
        const dataType = e.target.value;

        console.log("🃏 Field mapping changed:", field, "->", dataType);

        // Update settings
        if (!this.manager.settings.ankiFieldMappings) {
          this.manager.settings.ankiFieldMappings = {};
        }

        this.manager.settings.ankiFieldMappings[field] = dataType;

        // Update preview
        const previewCell = e.target
          .closest("tr")
          .querySelector(".preview-data");
        if (previewCell) {
          previewCell.textContent = this.getPreviewData(dataType);
        }

        await this.saveSettings();

        // Update import button state
        this.updateImportButtonState();
      });
    });
  }

  // Apply automatic field mapping
  applyAutoMapping() {
    const autoMappings = {
      Front: "expression",
      Back: "meaning",
      Expression: "expression",
      Chinese: "expression",
      Character: "expression",
      Reading: "reading",
      Pinyin: "reading",
      Meaning: "meaning",
      Definition: "meaning",
      English: "meaning",
      Sentence: "sentence",
      Context: "sentence",
      Traditional: "traditional",
      Simplified: "simplified",
      Source: "source",
      Audio: "sentenceAudio",
      SentenceAudio: "sentenceAudio",
      "Sentence Audio": "sentenceAudio",
      Screenshot: "screenshot",
      Image: "screenshot",
      Picture: "screenshot",
      Frequency: "frequency",
    };

    let mappingApplied = false;

    this.currentNoteTypeFields.forEach((field) => {
      const autoMapping = autoMappings[field];
      if (autoMapping) {
        // Update dropdown
        const select = document.querySelector(`[data-field="${field}"]`);
        if (select) {
          select.value = autoMapping;

          // Update preview
          const previewCell = select
            .closest("tr")
            .querySelector(".preview-data");
          if (previewCell) {
            previewCell.textContent = this.getPreviewData(autoMapping);
          }

          mappingApplied = true;
        }

        // Update settings
        if (!this.manager.settings.ankiFieldMappings) {
          this.manager.settings.ankiFieldMappings = {};
        }
        this.manager.settings.ankiFieldMappings[field] = autoMapping;
      }
    });

    if (mappingApplied) {
      this.autoMappingApplied = true;
      this.saveSettings();
      console.log("🃏 Auto-mapping applied");
    }
  }

  // Clear field mapping table
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

    // Clear current mappings
    this.manager.settings.ankiFieldMappings = {};
    this.autoMappingApplied = false;
    this.saveSettings();
  }

  // Load current settings into UI
  async loadCurrentSettings() {
    try {
      const response = await this.sendMessage("ANKI_LOAD_SETTINGS");
      const settings = response.settings || {};

      console.log("🃏 Loading current settings:", settings);

      // Update dropdowns
      const deckSelect = document.getElementById("anki-deck-select");
      if (deckSelect && settings.deck) {
        deckSelect.value = settings.deck;
        this.manager.settings.ankiDeck = settings.deck;
      }

      const noteTypeSelect = document.getElementById("anki-note-type-select");
      if (noteTypeSelect && settings.noteType) {
        noteTypeSelect.value = settings.noteType;
        this.manager.settings.ankiNoteType = settings.noteType;

        // Load fields for this note type
        await this.loadNoteTypeFields(settings.noteType);
        this.updateFieldMappingTable();
      }

      // Update toggles
      const checkDuplicates = document.getElementById("anki-check-duplicates");
      if (checkDuplicates) {
        checkDuplicates.checked = settings.checkDuplicates !== false;
        this.manager.settings.ankiCheckDuplicates = checkDuplicates.checked;
      }

      const includeSentence = document.getElementById("anki-include-sentence");
      if (includeSentence) {
        includeSentence.checked = settings.includeSentence !== false;
        this.manager.settings.ankiIncludeSentence = includeSentence.checked;
      }

      // Load field mappings
      this.manager.settings.ankiFieldMappings = settings.fieldMappings || {};

      // Update import button state
      this.updateImportButtonState();
    } catch (error) {
      console.error("🃏 Error loading current settings:", error);
    }
  }

  // Save settings to storage
  async saveSettings() {
    try {
      const settings = {
        deck: this.manager.settings.ankiDeck || "",
        noteType: this.manager.settings.ankiNoteType || "",
        fieldMappings: this.manager.settings.ankiFieldMappings || {},
        checkDuplicates: this.manager.settings.ankiCheckDuplicates !== false,
        allowDuplicates: this.manager.settings.ankiCheckDuplicates === false,
        includeSentence: this.manager.settings.ankiIncludeSentence !== false,
        tags: ["helios"],
      };

      console.log("🃏 Saving settings:", settings);

      // Save to local storage
      await this.manager.storage.saveSettings();

      // Save to background script
      await this.sendMessage("ANKI_SAVE_SETTINGS", { settings });

      console.log("🃏 Settings saved successfully");
    } catch (error) {
      console.error("🃏 Error saving settings:", error);
    }
  }

  // Test connection with user feedback
  async testConnection() {
    const button = document.getElementById("test-anki-connection");
    if (!button) return;

    const originalText = button.innerHTML;
    button.innerHTML = "<span>🔄</span>Testing...";
    button.disabled = true;

    try {
      const connected = await this.checkConnection();

      if (connected) {
        button.innerHTML = "<span>✅</span>Connected!";
        button.className = "btn btn-success";

        // Reload decks and note types
        await this.loadDecks();
        await this.loadNoteTypes();
        this.populateDropdowns();
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

  // Show connection error
  showConnectionError(message = "Could not connect to Anki") {
    const statusElement = document.getElementById("anki-connection-status");
    if (statusElement) {
      statusElement.className = "status-indicator status-disconnected";
      statusElement.innerHTML = "<span>●</span><span>Disconnected</span>";
    }

    // Show help text
    const helpText = document.querySelector(".help-text");
    if (helpText) {
      helpText.innerHTML = `
        <strong>Connection Failed:</strong> ${message}<br>
        Make sure Anki is running with the AnkiConnect add-on installed (code: 2055492159)
      `;
      helpText.style.color = "var(--helios-error)";
    }
  }

  // Export settings
  exportSettings() {
    const settings = {
      deck: this.manager.settings.ankiDeck,
      noteType: this.manager.settings.ankiNoteType,
      fieldMappings: this.manager.settings.ankiFieldMappings,
      checkDuplicates: this.manager.settings.ankiCheckDuplicates,
      includeSentence: this.manager.settings.ankiIncludeSentence,
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "helios-anki-settings.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  // Import settings
  async importSettings(file) {
    try {
      const text = await file.text();
      const settings = JSON.parse(text);

      // Validate settings
      if (!settings.deck || !settings.noteType) {
        throw new Error("Invalid settings file");
      }

      // Update UI
      const deckSelect = document.getElementById("anki-deck-select");
      if (deckSelect) deckSelect.value = settings.deck;

      const noteTypeSelect = document.getElementById("anki-note-type-select");
      if (noteTypeSelect) noteTypeSelect.value = settings.noteType;

      // Update manager settings
      this.manager.settings.ankiDeck = settings.deck;
      this.manager.settings.ankiNoteType = settings.noteType;
      this.manager.settings.ankiFieldMappings = settings.fieldMappings || {};
      this.manager.settings.ankiCheckDuplicates =
        settings.checkDuplicates !== false;
      this.manager.settings.ankiIncludeSentence =
        settings.includeSentence !== false;

      // Load fields and update mapping table
      await this.loadNoteTypeFields(settings.noteType);
      this.updateFieldMappingTable();

      // Save settings
      await this.saveSettings();

      console.log("🃏 Settings imported successfully");
      return true;
    } catch (error) {
      console.error("🃏 Error importing settings:", error);
      return false;
    }
  }

  // Get comprehensive status
  async getStatus() {
    const status = {
      connected: this.isConnected,
      ready: false,
      settings: this.manager.settings,
      errors: [],
    };

    // Check if settings are complete
    if (!this.manager.settings.ankiDeck) {
      status.errors.push("No deck selected");
    }

    if (!this.manager.settings.ankiNoteType) {
      status.errors.push("No note type selected");
    }

    const fieldMappings = this.manager.settings.ankiFieldMappings || {};
    const hasMapping = Object.values(fieldMappings).some(
      (value) => value && value.trim()
    );

    if (!hasMapping) {
      status.errors.push("No field mappings configured");
    }

    status.ready = this.isConnected && status.errors.length === 0;

    return status;
  }

  // Reset all settings
  async resetSettings() {
    if (confirm("Are you sure you want to reset all Anki settings?")) {
      this.manager.settings.ankiDeck = "";
      this.manager.settings.ankiNoteType = "";
      this.manager.settings.ankiFieldMappings = {};
      this.manager.settings.ankiCheckDuplicates = true;
      this.manager.settings.ankiIncludeSentence = true;

      // Clear UI
      const deckSelect = document.getElementById("anki-deck-select");
      if (deckSelect) deckSelect.value = "";

      const noteTypeSelect = document.getElementById("anki-note-type-select");
      if (noteTypeSelect) noteTypeSelect.value = "";

      this.clearFieldMappingTable();
      this.autoMappingApplied = false;

      await this.saveSettings();
      console.log("🃏 Settings reset");
    }
  }

  // Create a test card
  async createTestCard() {
    try {
      const status = await this.getStatus();

      if (!status.ready) {
        alert(`Cannot create test card: ${status.errors.join(", ")}`);
        return;
      }

      const testWordData = {
        character: "测试",
        traditional: "測試",
        simplified: "测试",
        pinyin: "cèshì",
        definition: "test; to test",
        sentence: "这是一个测试。",
        url: "https://helios-extension.com/test",
        frequency: "999",
      };

      const response = await this.sendMessage("ANKI_CREATE_CARD", {
        wordData: testWordData,
        options: {},
      });

      if (response.success) {
        alert("Test card created successfully!");
      } else {
        alert(`Test card creation failed: ${response.error}`);
      }
    } catch (error) {
      alert(`Error creating test card: ${error.message}`);
    }
  }

  // Update import button state based on prerequisites
  updateImportButtonState() {
    const importButton = document.getElementById("anki-import-known-words");
    if (!importButton) return;

    const deck = this.manager.settings.ankiDeck;
    const noteType = this.manager.settings.ankiNoteType;
    const fieldMappings = this.manager.settings.ankiFieldMappings || {};

    // Check if expression or expressionRubyTxt is mapped
    const hasExpressionMapping = Object.values(fieldMappings).some(
      (mapping) => mapping === "expression" || mapping === "expressionRubyTxt"
    );

    // Enable button only if all prerequisites are met
    const canImport = deck && noteType && hasExpressionMapping;
    importButton.disabled = !canImport;

    if (canImport) {
      // Button is ready - use normal styling
      importButton.innerHTML = "<span>📥</span>Import Known Words";
      importButton.title = "Import known words from Anki deck";
      importButton.className = "btn btn-anki";
    } else {
      // Button not ready - use red/danger styling
      importButton.innerHTML = "<span>⚠️</span>Anki not set up";
      importButton.title =
        "Select deck, note type, and map expression field to enable import";
      importButton.className = "btn btn-danger";
    }
  }

  // Import known words from Anki deck
  async importKnownWordsFromAnki() {
    const importButton = document.getElementById("anki-import-known-words");
    if (!importButton) return;

    try {
      // Validate prerequisites
      const deck = this.manager.settings.ankiDeck;
      const noteType = this.manager.settings.ankiNoteType;
      const fieldMappings = this.manager.settings.ankiFieldMappings || {};

      if (!deck) {
        alert("Please select an Anki deck first");
        return;
      }

      if (!noteType) {
        alert("Please select a note type first");
        return;
      }

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
        alert(
          'Please map a field to "Expression" or "Expression with Ruby Pinyin" first'
        );
        return;
      }

      // Update button to loading state
      importButton.innerHTML = "<span>⏳</span>Importing...";
      importButton.disabled = true;

      // Get all notes from the deck
      const response = await this.sendMessage("ANKI_GET_DECK_NOTES", {
        deck,
        noteType,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to get notes from Anki");
      }

      const notes = response.notes || [];

      if (notes.length === 0) {
        alert("No notes found in the selected deck");
        this.updateImportButtonState();
        return;
      }

      // Extract expressions from notes
      const expressions = new Set(); // Use Set to automatically deduplicate

      for (const note of notes) {
        const fields = note.fields || {};
        let expression = fields[expressionField]?.value || "";

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
          expressions.add(expression);
        }
      }

      if (expressions.size === 0) {
        alert("No valid expressions found in the deck");
        this.updateImportButtonState();
        return;
      }

      // Get vocab manager and ensure language is set correctly
      const vocabManager = this.manager.vocabulary?.vocabManager;
      if (!vocabManager) {
        throw new Error("Vocabulary manager not available");
      }

      // Ensure vocab manager has the correct language
      const targetLanguage =
        this.manager.settings.targetLanguage ||
        window.languageRegistry?.getCurrentLanguage() ||
        "zh";
      vocabManager.setCurrentLanguage(targetLanguage);

      // Import words
      const wordsArray = Array.from(expressions);
      const result = await vocabManager.markMultipleWordsAsKnown(wordsArray);

      // Reset button first (before alert which might block)
      // Use updateImportButtonState to ensure correct styling
      this.updateImportButtonState();
      
      // Show success message
      const message = `Successfully imported ${result.newWordsCount} known word${result.newWordsCount !== 1 ? "s" : ""} from Anki deck "${deck}"`;
      alert(message);

      console.log(
        `🃏 Imported ${result.newWordsCount} words from Anki deck:`,
        wordsArray
      );
    } catch (error) {
      console.error("🃏 Error importing known words from Anki:", error);
      alert(`Error importing words: ${error.message}`);
      // Update button state to ensure correct styling
      this.updateImportButtonState();
    }
  }
}

// Export for use in settings
window.HeliosSettingsAnki = HeliosSettingsAnki;
