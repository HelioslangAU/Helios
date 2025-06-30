class AnkiSettingsManager {
  constructor() {
    this.connectionStatus = null;
    this.availableDecks = [];
    this.availableNoteTypes = [];
    this.currentNoteTypeFields = [];
    this.settings = {
      deck: "",
      noteType: "",
      fieldMappings: {
        expression: "",
        reading: "",
        meaning: "",
        sentence: "",
        traditional: "",
        simplified: "",
        source: "",
      },
      checkDuplicates: true,
      allowDuplicates: false,
      tags: ["helios"],
    };

    this.init();
  }

  async init() {
    console.log("Initializing Anki Settings Manager...");

    try {
      this.setupEventListeners();
      console.log("Event listeners set up");

      await this.loadSettings();
      console.log("Settings loaded");

      await this.checkConnection();
      console.log("Connection checked");

      this.updateUI();
      console.log("UI updated");

      console.log("Anki Settings Manager initialized successfully");
    } catch (error) {
      console.error("Error initializing Anki Settings Manager:", error);
      this.updateConnectionStatus("disconnected", "Initialization failed");
    }
  }

  setupEventListeners() {
    console.log("Setting up event listeners...");

    // Connection test button
    const testBtn = document.getElementById("test-connection-btn");
    if (testBtn) {
      testBtn.addEventListener("click", () => {
        console.log("Test connection button clicked");
        this.testConnection();
      });
    } else {
      console.warn("Test connection button not found");
    }

    // Save settings button
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        console.log("Save button clicked");
        this.saveSettings();
      });
    } else {
      console.warn("Save button not found");
    }

    // Reset settings button
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        console.log("Reset button clicked");
        this.resetSettings();
      });
    } else {
      console.warn("Reset button not found");
    }

    // Deck selection
    const deckSelect = document.getElementById("deck-select");
    if (deckSelect) {
      deckSelect.addEventListener("change", (e) => {
        console.log("Deck selected:", e.target.value);
        this.settings.deck = e.target.value;
        this.updateConnectionStatus();
      });
    } else {
      console.warn("Deck select not found");
    }

    // Note type selection
    const noteTypeSelect = document.getElementById("note-type-select");
    if (noteTypeSelect) {
      noteTypeSelect.addEventListener("change", async (e) => {
        console.log("Note type selected:", e.target.value);
        this.settings.noteType = e.target.value;
        if (e.target.value) {
          await this.loadNoteTypeFields(e.target.value);
          this.updateFieldMappingOptions();
        }
      });
    } else {
      console.warn("Note type select not found");
    }

    // Field mapping changes
    const mappingSelects = document.querySelectorAll(".mapping-select");
    console.log("Found mapping selects:", mappingSelects.length);

    mappingSelects.forEach((select) => {
      select.addEventListener("change", (e) => {
        const heliosField = e.target.getAttribute("data-helios-field");
        console.log("Field mapping changed:", heliosField, "→", e.target.value);
        this.settings.fieldMappings[heliosField] = e.target.value;
        this.updateConnectionStatus();
      });
    });

    // Refresh decks button
    const refreshDecksBtn = document.getElementById("refresh-decks-btn");
    if (refreshDecksBtn) {
      refreshDecksBtn.addEventListener("click", async () => {
        console.log("Refresh decks button clicked");
        refreshDecksBtn.style.transform = "scale(1.1) rotate(360deg)";
        await this.loadDecks();
        this.populateDecksDropdown();
        setTimeout(() => {
          refreshDecksBtn.style.transform = "";
        }, 300);
      });
    } else {
      console.warn("Refresh decks button not found");
    }
  }

  // Send message to background script
  async sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      // Check if we're in a chrome extension context
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

  // Check Anki connection and load data
  async checkConnection() {
    try {
      this.updateConnectionStatus("checking");

      // Test connection
      const connectionResult = await this.sendMessage("TEST_ANKI_CONNECTION");
      this.connectionStatus = true;

      // Load decks and note types
      await Promise.all([this.loadDecks(), this.loadNoteTypes()]);

      this.updateConnectionStatus("connected");
      this.populateDecksDropdown();
      this.populateNoteTypesDropdown();
    } catch (error) {
      console.error("Connection failed:", error);
      this.connectionStatus = false;
      this.updateConnectionStatus("disconnected", error.message);
    }
  }

  // Load available decks from Anki
  async loadDecks() {
    try {
      console.log("Loading decks from Anki...");

      const response = await this.sendMessage("GET_ANKI_DECKS");

      if (response.success) {
        this.availableDecks = response.decks || [];
        console.log(
          "Successfully loaded decks from Anki:",
          this.availableDecks
        );
      } else {
        console.warn("Failed to load decks:", response.error);
        this.availableDecks = [];
      }
    } catch (error) {
      console.error("Could not load decks:", error);
      this.availableDecks = []; // Empty array - no hardcoded decks!
    }
  }

  // Load available note types from Anki
  async loadNoteTypes() {
    try {
      console.log("Loading note types from Anki...");

      const response = await this.sendMessage("GET_ANKI_NOTE_TYPES");

      if (response.success) {
        this.availableNoteTypes = response.noteTypes || [];
        console.log(
          "Successfully loaded note types from Anki:",
          this.availableNoteTypes
        );
      } else {
        console.warn("Failed to load note types:", response.error);
        this.availableNoteTypes = [];
      }
    } catch (error) {
      console.error("Could not load note types:", error);
      this.availableNoteTypes = []; // Empty array - no hardcoded note types!
    }
  }

  // Load fields for a specific note type
  async loadNoteTypeFields(noteType) {
    try {
      console.log("Loading fields for note type:", noteType);
      const response = await this.sendMessage("GET_ANKI_NOTE_TYPE_FIELDS", {
        noteType,
      });
      console.log("Fields response:", response);

      if (response.success) {
        this.currentNoteTypeFields = response.fields || [];
      } else {
        console.warn("Failed to get fields, using fallback");
        this.currentNoteTypeFields = this.getFallbackFields(noteType);
      }

      console.log("Current note type fields:", this.currentNoteTypeFields);
    } catch (error) {
      console.warn("Could not load note type fields:", error);
      this.currentNoteTypeFields = this.getFallbackFields(noteType);
    }
  }

  // Get fallback fields based on note type name
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
    } else if (lowerNoteType.includes("reversed")) {
      return ["Front", "Back"];
    } else {
      return ["Front", "Back"]; // Basic note type
    }
  }

  // Update connection status UI
  updateConnectionStatus(status = null, message = "") {
    const statusElement = document.getElementById("connection-status");
    const statusText = statusElement.querySelector("span");

    if (status === null) {
      status = this.connectionStatus ? "connected" : "disconnected";
    }

    // Remove all status classes
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

    // Enable/disable form elements based on connection
    const formElements = document.querySelectorAll(
      ".form-select, .mapping-select, .btn-primary"
    );
    formElements.forEach((element) => {
      if (status === "connected") {
        element.disabled = false;
        element.parentElement?.classList.remove("loading");
      } else {
        element.disabled = true;
        element.parentElement?.classList.add("loading");
      }
    });
  }

  // Populate decks dropdown
  populateDecksDropdown() {
    const deckSelect = document.getElementById("deck-select");
    deckSelect.innerHTML = '<option value="">Select a deck...</option>';

    this.availableDecks.forEach((deck) => {
      const option = document.createElement("option");
      option.value = deck;
      option.textContent = deck;
      option.selected = deck === this.settings.deck;
      deckSelect.appendChild(option);
    });
  }

  // Populate note types dropdown
  populateNoteTypesDropdown() {
    const noteTypeSelect = document.getElementById("note-type-select");
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

  // Update field mapping dropdown options
  updateFieldMappingOptions() {
    console.log(
      "Updating field mapping options with fields:",
      this.currentNoteTypeFields
    );

    const mappingSelects = document.querySelectorAll(".mapping-select");

    mappingSelects.forEach((select) => {
      const currentValue = select.value;
      const heliosField = select.getAttribute("data-helios-field");

      // Clear existing options
      select.innerHTML = '<option value="">Not mapped</option>';

      // Add available fields
      this.currentNoteTypeFields.forEach((field) => {
        const option = document.createElement("option");
        option.value = field;
        option.textContent = field;
        select.appendChild(option);
      });

      // Restore saved mapping if it exists
      if (this.settings.fieldMappings[heliosField]) {
        const savedValue = this.settings.fieldMappings[heliosField];
        // Check if the saved value exists in the current note type
        if (this.currentNoteTypeFields.includes(savedValue)) {
          select.value = savedValue;
        } else {
          // Try to auto-map common field names
          const autoMapping = this.getAutoMapping(heliosField);
          if (autoMapping && this.currentNoteTypeFields.includes(autoMapping)) {
            select.value = autoMapping;
            this.settings.fieldMappings[heliosField] = autoMapping;
          }
        }
      } else {
        // Try auto-mapping for new configurations
        const autoMapping = this.getAutoMapping(heliosField);
        if (autoMapping && this.currentNoteTypeFields.includes(autoMapping)) {
          select.value = autoMapping;
          this.settings.fieldMappings[heliosField] = autoMapping;
        }
      }
    });

    console.log(
      "Field mapping updated, current mappings:",
      this.settings.fieldMappings
    );
  }

  // Get automatic field mapping suggestions
  getAutoMapping(heliosField) {
    const mappings = {
      expression: ["Expression", "Chinese", "Front", "Word"],
      reading: ["Reading", "Pinyin", "Pronunciation"],
      meaning: ["Meaning", "English", "Definition", "Back"],
      sentence: ["Sentence", "Context", "Example"],
      traditional: ["Traditional", "Traditional Form"],
      simplified: ["Simplified", "Simplified Form"],
      source: ["Source", "URL", "Link"],
    };

    const candidates = mappings[heliosField] || [];

    // Return the first matching field from the note type
    for (const candidate of candidates) {
      if (this.currentNoteTypeFields.includes(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  // Test connection manually
  async testConnection() {
    const testBtn = document.getElementById("test-connection-btn");
    const originalText = testBtn.textContent;

    try {
      testBtn.textContent = "Testing...";
      testBtn.disabled = true;

      await this.checkConnection();

      // Show success feedback
      testBtn.textContent = "✓ Success!";
      testBtn.style.background = "linear-gradient(135deg, #4caf50, #388e3c)";

      setTimeout(() => {
        testBtn.textContent = originalText;
        testBtn.style.background = "";
        testBtn.disabled = false;
      }, 2000);
    } catch (error) {
      // Show error feedback
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

      // Update field mappings
      document.querySelectorAll(".mapping-select").forEach((select) => {
        const heliosField = select.getAttribute("data-helios-field");
        this.settings.fieldMappings[heliosField] = select.value;
      });

      // Save to storage via background script
      await this.sendMessage("SAVE_ANKI_SETTINGS", { settings: this.settings });

      // Show success feedback
      saveBtn.textContent = "✓ Saved!";
      saveBtn.style.background = "linear-gradient(135deg, #4caf50, #388e3c)";

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Error saving settings:", error);

      // Show error feedback
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
      this.settings = { ...this.settings, ...response.settings };
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

      // Reset to defaults
      this.settings = {
        deck: "Chinese::Helios",
        noteType: "Basic",
        fieldMappings: {
          expression: "Front",
          reading: "Back",
          meaning: "Back",
          sentence: "",
          traditional: "",
          simplified: "",
          source: "",
        },
        checkDuplicates: true,
        allowDuplicates: false,
        tags: ["helios"],
      };

      // Update UI
      this.updateUI();

      // Show success feedback
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
    // Update dropdowns
    document.getElementById("deck-select").value = this.settings.deck;
    document.getElementById("note-type-select").value = this.settings.noteType;

    // Update field mappings
    document.querySelectorAll(".mapping-select").forEach((select) => {
      const heliosField = select.getAttribute("data-helios-field");
      if (this.settings.fieldMappings[heliosField]) {
        select.value = this.settings.fieldMappings[heliosField];
      }
    });
  }

  // Validate current settings
  validateSettings() {
    const errors = [];

    if (!this.settings.deck) {
      errors.push("Please select a deck");
    }

    if (!this.settings.noteType) {
      errors.push("Please select a note type");
    }

    // Check if at least Expression is mapped
    if (!this.settings.fieldMappings.expression) {
      errors.push("Expression field must be mapped");
    }

    return errors;
  }

  // Get current settings for export
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  // Import settings from JSON
  async importSettings(jsonString) {
    try {
      const importedSettings = JSON.parse(jsonString);
      this.settings = { ...this.settings, ...importedSettings };
      this.updateUI();
      await this.saveSettings();
      return true;
    } catch (error) {
      console.error("Error importing settings:", error);
      return false;
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.ankiSettingsManager = new AnkiSettingsManager();
});

// Make it globally accessible for debugging
window.AnkiSettingsManager = AnkiSettingsManager;
