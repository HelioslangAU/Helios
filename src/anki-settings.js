class AnkiSettingsManager {
  constructor() {
    this.connectionStatus = null;
    this.availableDecks = [];
    this.availableNoteTypes = [];
    this.currentNoteTypeFields = [];

    // CHANGED: Now we map FROM Anki fields TO Helios data
    this.settings = {
      deck: "",
      noteType: "",
      fieldMappings: {}, // Dynamic - will be populated based on note type fields
      checkDuplicates: true,
      allowDuplicates: false,
      tags: ["helios"],
    };

    // Available Helios data that can be mapped to Anki fields
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

    this.init();
  }

  async init() {
    console.log("Initializing Anki Settings Manager...");

    try {
      this.setupEventListeners();
      await this.loadSettings();
      await this.checkConnection();
      this.updateUI();
      console.log("Anki Settings Manager initialized successfully");
    } catch (error) {
      console.error("Error initializing Anki Settings Manager:", error);
      this.updateConnectionStatus("disconnected", "Initialization failed");
    }
  }

  setupEventListeners() {
    // Test connection button
    const testBtn = document.getElementById("test-connection-btn");
    if (testBtn) {
      testBtn.addEventListener("click", () => this.testConnection());
    }

    // Save settings button
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveSettings());
    }

    // Reset settings button
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetSettings());
    }

    // Deck selection
    const deckSelect = document.getElementById("deck-select");
    if (deckSelect) {
      deckSelect.addEventListener("change", (e) => {
        this.settings.deck = e.target.value;
      });
    }

    // Note type selection - KEY CHANGE: Now rebuilds entire field mapping table
    const noteTypeSelect = document.getElementById("note-type-select");
    if (noteTypeSelect) {
      noteTypeSelect.addEventListener("change", async (e) => {
        console.log("Note type selected:", e.target.value);
        this.settings.noteType = e.target.value;

        if (e.target.value) {
          this.showFieldMappingLoading(true);

          try {
            await this.loadNoteTypeFields(e.target.value);
            this.rebuildFieldMappingTable();
            this.setupFieldMappingEventListeners();
          } catch (error) {
            console.error("Error loading note type fields:", error);
          } finally {
            this.showFieldMappingLoading(false);
          }
        } else {
          this.clearFieldMappingTable();
        }
      });
    }

    // Refresh decks button
    const refreshDecksBtn = document.getElementById("refresh-decks-btn");
    if (refreshDecksBtn) {
      refreshDecksBtn.addEventListener("click", async () => {
        refreshDecksBtn.style.transform = "scale(1.1) rotate(360deg)";
        await this.loadDecks();
        this.populateDecksDropdown();
        setTimeout(() => {
          refreshDecksBtn.style.transform = "";
        }, 300);
      });
    }
  }

  // Setup event listeners for dynamically created field mapping dropdowns
  setupFieldMappingEventListeners() {
    const mappingSelects = document.querySelectorAll(".mapping-select");

    // Remove existing listeners to avoid duplicates
    mappingSelects.forEach((select) => {
      select.removeEventListener("change", this.handleFieldMappingChange);
    });

    // Add new listeners
    mappingSelects.forEach((select) => {
      select.addEventListener(
        "change",
        this.handleFieldMappingChange.bind(this)
      );
    });
  }

  // Handle field mapping changes
  handleFieldMappingChange(event) {
    const ankiField = event.target.getAttribute("data-anki-field");
    const heliosData = event.target.value;

    console.log(`Field mapping changed: ${ankiField} ← ${heliosData}`);

    // Update settings
    this.settings.fieldMappings[ankiField] = heliosData;
  }

  // Send message to background script
  async sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!window.chrome?.runtime?.sendMessage) {
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

  // Check Anki connection and load data
  async checkConnection() {
    try {
      this.updateConnectionStatus("checking");

      await this.sendMessage("TEST_ANKI_CONNECTION");
      this.connectionStatus = true;

      await Promise.all([this.loadDecks(), this.loadNoteTypes()]);

      this.updateConnectionStatus("connected");
      this.populateDecksDropdown();
      this.populateNoteTypesDropdown();

      // If we have a saved note type, load its fields
      if (this.settings.noteType) {
        await this.loadNoteTypeFields(this.settings.noteType);
        this.rebuildFieldMappingTable();
        this.setupFieldMappingEventListeners();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      this.connectionStatus = false;
      this.updateConnectionStatus("disconnected", error.message);
    }
  }

  async loadDecks() {
    try {
      const response = await this.sendMessage("GET_ANKI_DECKS");
      this.availableDecks = response.decks || [];
      console.log("Loaded decks:", this.availableDecks);
    } catch (error) {
      console.error("Could not load decks:", error);
      this.availableDecks = [];
    }
  }

  async loadNoteTypes() {
    try {
      const response = await this.sendMessage("GET_ANKI_NOTE_TYPES");
      this.availableNoteTypes = response.noteTypes || [];
      console.log("Loaded note types:", this.availableNoteTypes);
    } catch (error) {
      console.error("Could not load note types:", error);
      this.availableNoteTypes = [];
    }
  }

  async loadNoteTypeFields(noteType) {
    try {
      console.log("Loading fields for note type:", noteType);
      const response = await this.sendMessage("GET_ANKI_NOTE_TYPE_FIELDS", {
        noteType,
      });

      if (response.success && response.fields) {
        this.currentNoteTypeFields = response.fields;
        console.log("Loaded fields:", this.currentNoteTypeFields);
      } else {
        this.currentNoteTypeFields = this.getFallbackFields(noteType);
      }
    } catch (error) {
      console.warn("Could not load note type fields:", error);
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

  // COMPLETELY NEW: Rebuild the entire field mapping table based on Anki fields
  rebuildFieldMappingTable() {
    const tableBody = document.getElementById("field-mapping-body");
    if (!tableBody) {
      console.error("Field mapping table body not found");
      return;
    }

    // Clear existing rows
    tableBody.innerHTML = "";

    // Create a row for each Anki field
    this.currentNoteTypeFields.forEach((ankiField) => {
      const row = document.createElement("tr");

      // Get preview data for this Helios field type
      const currentMapping = this.settings.fieldMappings[ankiField] || "";
      const previewData = this.getPreviewData(currentMapping);

      row.innerHTML = `
        <td class="anki-field">
          <div class="field-name">
            <span class="field-icon">📝</span>
            ${ankiField}
          </div>
        </td>
        <td>
          <select class="mapping-select" data-anki-field="${ankiField}">
            ${this.generateHeliosDataOptions(currentMapping)}
          </select>
        </td>
        <td class="preview-data">${previewData}</td>
      `;

      tableBody.appendChild(row);
    });

    // Auto-map common fields
    this.applyAutoMapping();

    console.log(
      "Field mapping table rebuilt with",
      this.currentNoteTypeFields.length,
      "fields"
    );
  }

  // Generate options for Helios data dropdown
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

  // Get preview data for a specific Helios field type
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

  // Apply automatic mapping for common field names
  applyAutoMapping() {
    const autoMappings = {
      // Anki field name → Helios data type
      Expression: "expression",
      Chinese: "expression",
      Character: "expression",
      Hanzi: "expression",
      "Target Word": "expression",
      Word: "expression",

      Reading: "reading",
      Pinyin: "reading",
      Pronunciation: "reading",

      Meaning: "meaning",
      Definition: "meaning",
      English: "meaning",
      Translation: "meaning",
      Definitions: "meaning",

      Sentence: "sentence",
      Context: "sentence",
      Example: "sentence",
      "Example Sentence": "sentence",

      Traditional: "traditional",
      "Traditional Form": "traditional",

      Simplified: "simplified",
      "Simplified Form": "simplified",

      Source: "source",
      URL: "source",
      "Source URL": "source",

      Audio: "audio",
      "Word Audio": "audio",
      "Pronunciation Audio": "audio",
    };

    this.currentNoteTypeFields.forEach((ankiField) => {
      // Only auto-map if not already mapped
      if (!this.settings.fieldMappings[ankiField]) {
        const autoMapping = autoMappings[ankiField];
        if (autoMapping) {
          this.settings.fieldMappings[ankiField] = autoMapping;

          // Update the dropdown
          const select = document.querySelector(
            `[data-anki-field="${ankiField}"]`
          );
          if (select) {
            select.value = autoMapping;
          }

          console.log(`Auto-mapped: ${ankiField} ← ${autoMapping}`);
        }
      }
    });
  }

  // Show/hide loading state for field mapping
  showFieldMappingLoading(isLoading) {
    const tableBody = document.getElementById("field-mapping-body");
    if (!tableBody) return;

    if (isLoading) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 40px; color: var(--helios-text-muted);">
            <div>Loading fields...</div>
          </td>
        </tr>
      `;
    }
  }

  // Clear field mapping table
  clearFieldMappingTable() {
    const tableBody = document.getElementById("field-mapping-body");
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 40px; color: var(--helios-text-muted);">
          <div>Select a note type to configure field mappings</div>
        </td>
      </tr>
    `;

    // Clear field mappings in settings
    this.settings.fieldMappings = {};
  }

  // Update connection status UI
  updateConnectionStatus(status = null, message = "") {
    const statusElement = document.getElementById("connection-status");
    if (!statusElement) return;

    const statusText = statusElement.querySelector("span");

    if (status === null) {
      status = this.connectionStatus ? "connected" : "disconnected";
    }

    statusElement.classList.remove(
      "status-connected",
      "status-disconnected",
      "status-checking"
    );

    switch (status) {
      case "checking":
        statusElement.classList.add("status-checking");
        statusText.textContent = "Checking...";
        break;
      case "connected":
        statusElement.classList.add("status-connected");
        statusText.textContent = "Connected";
        break;
      case "disconnected":
        statusElement.classList.add("status-disconnected");
        statusText.textContent = message || "Disconnected";
        break;
    }

    // Enable/disable form elements
    const formElements = document.querySelectorAll(
      ".form-select, .btn-primary"
    );
    formElements.forEach((element) => {
      element.disabled = status !== "connected";
    });
  }

  populateDecksDropdown() {
    const deckSelect = document.getElementById("deck-select");
    if (!deckSelect) return;

    deckSelect.innerHTML = '<option value="">Select a deck...</option>';

    this.availableDecks.forEach((deck) => {
      const option = document.createElement("option");
      option.value = deck;
      option.textContent = deck;
      option.selected = deck === this.settings.deck;
      deckSelect.appendChild(option);
    });
  }

  populateNoteTypesDropdown() {
    const noteTypeSelect = document.getElementById("note-type-select");
    if (!noteTypeSelect) return;

    noteTypeSelect.innerHTML =
      '<option value="">Select a note type...</option>';

    this.availableNoteTypes.forEach((noteType) => {
      const option = document.createElement("option");
      option.value = noteType;
      option.textContent = noteType;
      option.selected = noteType === this.settings.noteType;
      noteTypeSelect.appendChild(option);
    });
  }

  // Test connection
  async testConnection() {
    const testBtn = document.getElementById("test-connection-btn");
    const originalText = testBtn.textContent;

    try {
      testBtn.textContent = "Testing...";
      testBtn.disabled = true;

      await this.checkConnection();

      testBtn.textContent = "✓ Success!";
      testBtn.style.background = "linear-gradient(135deg, #4caf50, #388e3c)";

      setTimeout(() => {
        testBtn.textContent = originalText;
        testBtn.style.background = "";
        testBtn.disabled = false;
      }, 2000);
    } catch (error) {
      testBtn.textContent = "✗ Failed";
      testBtn.style.background = "linear-gradient(135deg, #f44336, #d32f2f)";

      setTimeout(() => {
        testBtn.textContent = originalText;
        testBtn.style.background = "";
        testBtn.disabled = false;
      }, 2000);
    }
  }

  // Save settings
  async saveSettings() {
    const saveBtn = document.getElementById("save-btn");
    const originalText = saveBtn.textContent;

    try {
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      // Update settings from UI
      this.settings.deck = document.getElementById("deck-select").value;
      this.settings.noteType =
        document.getElementById("note-type-select").value;

      // Field mappings are already updated via event listeners

      console.log("Saving settings:", this.settings);

      await this.sendMessage("SAVE_ANKI_SETTINGS", { settings: this.settings });

      saveBtn.textContent = "✓ Saved!";
      saveBtn.style.background = "linear-gradient(135deg, #4caf50, #388e3c)";

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Error saving settings:", error);

      saveBtn.textContent = "✗ Error";
      saveBtn.style.background = "linear-gradient(135deg, #f44336, #d32f2f)";

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 2000);
    }
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const response = await this.sendMessage("GET_ANKI_SETTINGS");
      if (response.settings) {
        this.settings = { ...this.settings, ...response.settings };
        console.log("Loaded settings:", this.settings);
      }
    } catch (error) {
      console.warn("Could not load settings, using defaults:", error);
    }
  }

  // Reset to default settings
  async resetSettings() {
    const resetBtn = document.getElementById("reset-btn");
    const originalText = resetBtn.textContent;

    try {
      resetBtn.textContent = "Resetting...";
      resetBtn.disabled = true;

      this.settings = {
        deck: "Chinese::Helios",
        noteType: "Basic",
        fieldMappings: {},
        checkDuplicates: true,
        allowDuplicates: false,
        tags: ["helios"],
      };

      this.updateUI();
      this.clearFieldMappingTable();

      resetBtn.textContent = "✓ Reset!";
      resetBtn.style.background = "linear-gradient(135deg, #ff9800, #f57c00)";

      setTimeout(() => {
        resetBtn.textContent = originalText;
        resetBtn.style.background = "";
        resetBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Error resetting settings:", error);

      setTimeout(() => {
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
      }, 2000);
    }
  }

  // Update UI with current settings
  updateUI() {
    document.getElementById("deck-select").value = this.settings.deck;
    document.getElementById("note-type-select").value = this.settings.noteType;

    if (this.currentNoteTypeFields.length > 0) {
      this.rebuildFieldMappingTable();
      this.setupFieldMappingEventListeners();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.ankiSettingsManager = new AnkiSettingsManager();
});

window.AnkiSettingsManager = AnkiSettingsManager;
