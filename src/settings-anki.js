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

        if (this.manager.settings.ankiNoteType) {
          await this.loadNoteTypeFields(this.manager.settings.ankiNoteType);
          this.updateFieldMappingTable();
        }
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
        option.selected = deck === this.manager.settings.ankiDeck;
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
        option.selected = noteType === this.manager.settings.ankiNoteType;
        noteTypeSelect.appendChild(option);
      });
    }
  }

  async onDeckChange(event) {
    this.manager.settings.ankiDeck = event.target.value;
    await this.manager.storage.saveSettings();
  }

  async onNoteTypeChange(event) {
    this.manager.settings.ankiNoteType = event.target.value;
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
      const currentMapping =
        this.manager.settings.ankiFieldMappings?.[ankiField] || "";
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

  setupFieldMappingEventListeners() {
    const mappingSelects = document.querySelectorAll(".mapping-select");

    mappingSelects.forEach((select) => {
      select.addEventListener("change", (e) => {
        const ankiField = e.target.getAttribute("data-anki-field");
        const heliosData = e.target.value;

        if (!this.manager.settings.ankiFieldMappings) {
          this.manager.settings.ankiFieldMappings = {};
        }
        this.manager.settings.ankiFieldMappings[ankiField] = heliosData;

        const previewCell = e.target
          .closest("tr")
          .querySelector(".preview-data");
        if (previewCell) {
          previewCell.textContent = this.getPreviewData(heliosData);
        }

        this.manager.storage.saveSettings();
      });
    });
  }

  applyAutoMapping() {
    const autoMappings = {
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
      URL: "source",
      Audio: "audio",
    };

    this.currentNoteTypeFields.forEach((ankiField) => {
      if (!this.manager.settings.ankiFieldMappings?.[ankiField]) {
        const autoMapping = autoMappings[ankiField];
        if (autoMapping) {
          if (!this.manager.settings.ankiFieldMappings) {
            this.manager.settings.ankiFieldMappings = {};
          }
          this.manager.settings.ankiFieldMappings[ankiField] = autoMapping;

          const select = document.querySelector(
            `[data-anki-field="${ankiField}"]`
          );
          if (select) {
            select.value = autoMapping;
          }
        }
      }
    });

    this.manager.storage.saveSettings();
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

    this.manager.settings.ankiFieldMappings = {};
    this.manager.storage.saveSettings();
  }
}

window.HeliosSettingsAnki = HeliosSettingsAnki;
