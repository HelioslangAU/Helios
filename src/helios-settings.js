class HeliosSettingsManager {
  constructor() {
    this.settings = {};
    this.ankiConnection = null;
    this.availableDecks = [];
    this.availableNoteTypes = [];
    this.currentNoteTypeFields = [];
    this.loadedTabs = new Set();

    // Default settings
    this.defaultSettings = {
      // General
      extensionEnabled: true,
      activationKey: "Shift",
      autoHighlight: true,
      scanDelay: 100,
      maxWordLength: 5,
      preferTraditional: false,

      // Popup & Display
      popupTheme: "dark",
      popupFontSize: "medium",
      showFrequency: true,
      showVariants: true,
      persistentPopup: true,
      autoCloseDelay: 0,
      highlightStyle: "underline",
      highlightColor: "orange",
      highlightIntensity: "normal",
      hideKnownSites: false,

      // Anki
      ankiDeck: "",
      ankiNoteType: "",
      ankiCheckDuplicates: true,
      ankiIncludeSentence: true,
      ankiFieldMappings: {},

      // Vocabulary
      knownWords: [],
      totalLookups: 0,
      todayLookups: 0,
      ankiCardsCreated: 0,
      lastResetDate: new Date().toDateString(),

      // Advanced
      processingMode: "full",
      cacheDictionary: true,
      maxElements: 1000,
      backgroundProcessing: true,
      autoDetectChinese: true,
      workIncognito: false,
      disabledSites: [],
      debugMode: false,
      showMetrics: false,
    };

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

    this.init();
  }

  async init() {
    console.log("Initializing Helios Settings Manager...");

    try {
      await this.loadAllSettings();
      this.setupEventListeners();

      // Load the first tab (General) immediately
      await this.loadTabContent("general");

      console.log("Helios Settings Manager initialized successfully");
    } catch (error) {
      console.error("Error initializing settings:", error);
    }
  }

  setupEventListeners() {
    // Tab Navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => this.switchTab(e));
    });
  }

  async switchTab(event) {
    const targetTab = event.currentTarget.getAttribute("data-tab");

    // Update active nav item
    document
      .querySelectorAll(".nav-item")
      .forEach((nav) => nav.classList.remove("active"));
    event.currentTarget.classList.add("active");

    // Update active tab content
    document
      .querySelectorAll(".tab-content")
      .forEach((tab) => tab.classList.remove("active"));
    document.getElementById(targetTab).classList.add("active");

    // Load tab content if not already loaded
    if (!this.loadedTabs.has(targetTab)) {
      await this.loadTabContent(targetTab);
    }

    // Special handling for specific tabs
    if (targetTab === "anki" && !this.ankiConnection) {
      await this.initializeAnki();
    }

    if (targetTab === "vocabulary") {
      await this.loadStatistics();
    }
  }

  async loadTabContent(tabName) {
    const tabElement = document.getElementById(tabName);
    if (!tabElement) return;

    try {
      // Show loading indicator
      tabElement.innerHTML =
        '<div class="loading-indicator">Loading ' +
        this.getTabDisplayName(tabName) +
        "...</div>";

      // Fetch the appropriate HTML file
      const response = await fetch(
        chrome.runtime.getURL(`settings/${tabName}-settings.html`)
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load ${tabName} settings: ${response.status}`
        );
      }

      const html = await response.text();
      tabElement.innerHTML = html;

      // Mark as loaded
      this.loadedTabs.add(tabName);

      // Set up event listeners for this tab
      this.setupTabEventListeners(tabName);

      // Update UI with current settings
      this.updateTabUI(tabName);

      console.log(`Successfully loaded ${tabName} tab`);
    } catch (error) {
      console.error(`Error loading ${tabName} tab:`, error);
      tabElement.innerHTML = `
        <div class="section-card">
          <h2 class="section-title">
            <span>⚠️</span>
            Error Loading ${this.getTabDisplayName(tabName)}
          </h2>
          <p class="section-description">
            Failed to load settings content. Please refresh the page and try again.
          </p>
          <button class="btn btn-secondary" onclick="location.reload()">
            Refresh Page
          </button>
        </div>
      `;
    }
  }

  getTabDisplayName(tabName) {
    const displayNames = {
      general: "General Settings",
      popup: "Popup & Display Settings",
      anki: "Anki Integration",
      vocabulary: "Vocabulary Management",
      advanced: "Advanced Settings",
    };
    return displayNames[tabName] || tabName;
  }

  setupTabEventListeners(tabName) {
    switch (tabName) {
      case "general":
        this.setupGeneralEventListeners();
        break;
      case "popup":
        this.setupPopupEventListeners();
        break;
      case "anki":
        this.setupAnkiEventListeners();
        break;
      case "vocabulary":
        this.setupVocabularyEventListeners();
        break;
      case "advanced":
        this.setupAdvancedEventListeners();
        break;
    }

    // Auto-save for all form controls in this tab
    const tabElement = document.getElementById(tabName);
    tabElement
      .querySelectorAll("input, select, textarea")
      .forEach((element) => {
        element.addEventListener("change", () => this.saveSettings());
      });
  }

  setupGeneralEventListeners() {
    // General settings specific event listeners
    console.log("Setting up general event listeners");
  }

  setupPopupEventListeners() {
    // Popup settings specific event listeners
    console.log("Setting up popup event listeners");
  }

  setupAnkiEventListeners() {
    // Anki settings specific event listeners
    document
      .getElementById("test-anki-connection")
      ?.addEventListener("click", () => this.testAnkiConnection());
    document
      .getElementById("anki-deck-select")
      ?.addEventListener("change", (e) => this.onDeckChange(e));
    document
      .getElementById("anki-note-type-select")
      ?.addEventListener("change", (e) => this.onNoteTypeChange(e));
  }

  setupVocabularyEventListeners() {
    // Vocabulary management specific event listeners
    document
      .getElementById("import-known-words")
      ?.addEventListener("click", () => this.importKnownWords());
    document
      .getElementById("export-known-words")
      ?.addEventListener("click", () => this.exportKnownWords());
    document
      .getElementById("clear-known-words")
      ?.addEventListener("click", () => this.clearKnownWords());
    document
      .getElementById("backup-data")
      ?.addEventListener("click", () => this.backupAllData());
    document
      .getElementById("restore-data")
      ?.addEventListener("click", () => this.restoreData());
    document
      .getElementById("reset-all-data")
      ?.addEventListener("click", () => this.resetAllData());
  }

  setupAdvancedEventListeners() {
    // Advanced settings specific event listeners
    document
      .getElementById("clear-cache")
      ?.addEventListener("click", () => this.clearCache());
    document
      .getElementById("export-logs")
      ?.addEventListener("click", () => this.exportLogs());
    document
      .getElementById("run-diagnostics")
      ?.addEventListener("click", () => this.runDiagnostics());
  }

  updateTabUI(tabName) {
    // Update form elements with current settings for the specific tab
    const tabElement = document.getElementById(tabName);
    if (!tabElement) return;

    // Update based on tab type
    switch (tabName) {
      case "general":
        this.updateGeneralUI(tabElement);
        break;
      case "popup":
        this.updatePopupUI(tabElement);
        break;
      case "anki":
        this.updateAnkiUI(tabElement);
        break;
      case "vocabulary":
        this.updateVocabularyUI(tabElement);
        break;
      case "advanced":
        this.updateAdvancedUI(tabElement);
        break;
    }
  }

  updateGeneralUI(tabElement) {
    // General settings UI updates
    const extensionEnabled = tabElement.querySelector("#extension-enabled");
    if (extensionEnabled)
      extensionEnabled.checked = this.settings.extensionEnabled;

    const activationKey = tabElement.querySelector("#activation-key");
    if (activationKey) activationKey.value = this.settings.activationKey;

    const autoHighlight = tabElement.querySelector("#auto-highlight");
    if (autoHighlight) autoHighlight.checked = this.settings.autoHighlight;

    const scanDelay = tabElement.querySelector("#scan-delay");
    if (scanDelay) scanDelay.value = this.settings.scanDelay;

    const maxWordLength = tabElement.querySelector("#max-word-length");
    if (maxWordLength) maxWordLength.value = this.settings.maxWordLength;

    const preferTraditional = tabElement.querySelector("#prefer-traditional");
    if (preferTraditional)
      preferTraditional.checked = this.settings.preferTraditional;
  }

  updatePopupUI(tabElement) {
    // Popup settings UI updates
    const popupTheme = tabElement.querySelector("#popup-theme");
    if (popupTheme) popupTheme.value = this.settings.popupTheme;

    const popupFontSize = tabElement.querySelector("#popup-font-size");
    if (popupFontSize) popupFontSize.value = this.settings.popupFontSize;

    const showFrequency = tabElement.querySelector("#show-frequency");
    if (showFrequency) showFrequency.checked = this.settings.showFrequency;

    const showVariants = tabElement.querySelector("#show-variants");
    if (showVariants) showVariants.checked = this.settings.showVariants;

    const persistentPopup = tabElement.querySelector("#persistent-popup");
    if (persistentPopup)
      persistentPopup.checked = this.settings.persistentPopup;

    const autoCloseDelay = tabElement.querySelector("#auto-close-delay");
    if (autoCloseDelay) autoCloseDelay.value = this.settings.autoCloseDelay;

    const highlightStyle = tabElement.querySelector("#highlight-style");
    if (highlightStyle) highlightStyle.value = this.settings.highlightStyle;

    const highlightColor = tabElement.querySelector("#highlight-color");
    if (highlightColor) highlightColor.value = this.settings.highlightColor;

    const highlightIntensity = tabElement.querySelector("#highlight-intensity");
    if (highlightIntensity)
      highlightIntensity.value = this.settings.highlightIntensity;

    const hideKnownSites = tabElement.querySelector("#hide-known-sites");
    if (hideKnownSites) hideKnownSites.checked = this.settings.hideKnownSites;
  }

  updateAnkiUI(tabElement) {
    // Anki settings UI updates
    const ankiDeck = tabElement.querySelector("#anki-deck-select");
    if (ankiDeck) ankiDeck.value = this.settings.ankiDeck;

    const ankiNoteType = tabElement.querySelector("#anki-note-type-select");
    if (ankiNoteType) ankiNoteType.value = this.settings.ankiNoteType;

    const checkDuplicates = tabElement.querySelector("#anki-check-duplicates");
    if (checkDuplicates)
      checkDuplicates.checked = this.settings.ankiCheckDuplicates;

    const includeSentence = tabElement.querySelector("#anki-include-sentence");
    if (includeSentence)
      includeSentence.checked = this.settings.ankiIncludeSentence;
  }

  updateVocabularyUI(tabElement) {
    // Vocabulary settings UI updates - statistics will be loaded separately
  }

  updateAdvancedUI(tabElement) {
    // Advanced settings UI updates
    const processingMode = tabElement.querySelector("#processing-mode");
    if (processingMode) processingMode.value = this.settings.processingMode;

    const cacheDictionary = tabElement.querySelector("#cache-dictionary");
    if (cacheDictionary)
      cacheDictionary.checked = this.settings.cacheDictionary;

    const maxElements = tabElement.querySelector("#max-elements");
    if (maxElements) maxElements.value = this.settings.maxElements;

    const backgroundProcessing = tabElement.querySelector(
      "#background-processing"
    );
    if (backgroundProcessing)
      backgroundProcessing.checked = this.settings.backgroundProcessing;

    const autoDetectChinese = tabElement.querySelector("#auto-detect-chinese");
    if (autoDetectChinese)
      autoDetectChinese.checked = this.settings.autoDetectChinese;

    const workIncognito = tabElement.querySelector("#work-incognito");
    if (workIncognito) workIncognito.checked = this.settings.workIncognito;

    const debugMode = tabElement.querySelector("#debug-mode");
    if (debugMode) debugMode.checked = this.settings.debugMode;

    const showMetrics = tabElement.querySelector("#show-metrics");
    if (showMetrics) showMetrics.checked = this.settings.showMetrics;

    const disabledSites = tabElement.querySelector("#disabled-sites-textarea");
    if (disabledSites)
      disabledSites.value = (this.settings.disabledSites || []).join("\n");

    const lastUpdated = tabElement.querySelector("#last-updated");
    if (lastUpdated) lastUpdated.textContent = new Date().toLocaleDateString();
  }

  // ==================== SETTINGS MANAGEMENT ====================

  async loadAllSettings() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(null);
        this.settings = { ...this.defaultSettings, ...result };
      } else {
        this.settings = { ...this.defaultSettings };
      }
      console.log("Settings loaded:", this.settings);
    } catch (error) {
      console.error("Error loading settings:", error);
      this.settings = { ...this.defaultSettings };
    }
  }

  async saveSettings() {
    try {
      // Collect all form values from all loaded tabs
      const formData = this.collectFormData();
      this.settings = { ...this.settings, ...formData };

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set(this.settings);
        console.log("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  collectFormData() {
    const formData = {};

    // Collect from all loaded tabs
    this.loadedTabs.forEach((tabName) => {
      const tabElement = document.getElementById(tabName);
      if (tabElement) {
        this.collectTabFormData(tabElement, formData);
      }
    });

    return formData;
  }

  collectTabFormData(tabElement, formData) {
    // Collect all form inputs from the tab
    tabElement
      .querySelectorAll("input, select, textarea")
      .forEach((element) => {
        const id = element.id;
        if (!id) return;

        if (element.type === "checkbox") {
          formData[this.getSettingKey(id)] = element.checked;
        } else if (element.type === "number") {
          formData[this.getSettingKey(id)] = parseInt(element.value) || 0;
        } else if (id === "disabled-sites-textarea") {
          formData.disabledSites = element.value
            .split("\n")
            .filter((site) => site.trim())
            .map((site) => site.trim());
        } else {
          formData[this.getSettingKey(id)] = element.value;
        }
      });
  }

  getSettingKey(elementId) {
    // Convert element IDs to setting keys
    const keyMap = {
      "extension-enabled": "extensionEnabled",
      "activation-key": "activationKey",
      "auto-highlight": "autoHighlight",
      "scan-delay": "scanDelay",
      "max-word-length": "maxWordLength",
      "prefer-traditional": "preferTraditional",
      "popup-theme": "popupTheme",
      "popup-font-size": "popupFontSize",
      "show-frequency": "showFrequency",
      "show-variants": "showVariants",
      "persistent-popup": "persistentPopup",
      "auto-close-delay": "autoCloseDelay",
      "highlight-style": "highlightStyle",
      "highlight-color": "highlightColor",
      "highlight-intensity": "highlightIntensity",
      "hide-known-sites": "hideKnownSites",
      "anki-deck-select": "ankiDeck",
      "anki-note-type-select": "ankiNoteType",
      "anki-check-duplicates": "ankiCheckDuplicates",
      "anki-include-sentence": "ankiIncludeSentence",
      "processing-mode": "processingMode",
      "cache-dictionary": "cacheDictionary",
      "max-elements": "maxElements",
      "background-processing": "backgroundProcessing",
      "auto-detect-chinese": "autoDetectChinese",
      "work-incognito": "workIncognito",
      "debug-mode": "debugMode",
      "show-metrics": "showMetrics",
    };

    return keyMap[elementId] || elementId;
  }

  // ==================== ANKI INTEGRATION ====================

  async initializeAnki() {
    try {
      await this.checkAnkiConnection();
      if (this.ankiConnection) {
        await Promise.all([this.loadAnkiDecks(), this.loadAnkiNoteTypes()]);
        this.populateAnkiDropdowns();

        if (this.settings.ankiNoteType) {
          await this.loadNoteTypeFields(this.settings.ankiNoteType);
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
        option.selected = deck === this.settings.ankiDeck;
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
        option.selected = noteType === this.settings.ankiNoteType;
        noteTypeSelect.appendChild(option);
      });
    }
  }

  async onDeckChange(event) {
    this.settings.ankiDeck = event.target.value;
    await this.saveSettings();
  }

  async onNoteTypeChange(event) {
    this.settings.ankiNoteType = event.target.value;
    await this.saveSettings();

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
      const currentMapping = this.settings.ankiFieldMappings?.[ankiField] || "";
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

        if (!this.settings.ankiFieldMappings) {
          this.settings.ankiFieldMappings = {};
        }
        this.settings.ankiFieldMappings[ankiField] = heliosData;

        const previewCell = e.target
          .closest("tr")
          .querySelector(".preview-data");
        if (previewCell) {
          previewCell.textContent = this.getPreviewData(heliosData);
        }

        this.saveSettings();
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
      if (!this.settings.ankiFieldMappings?.[ankiField]) {
        const autoMapping = autoMappings[ankiField];
        if (autoMapping) {
          if (!this.settings.ankiFieldMappings) {
            this.settings.ankiFieldMappings = {};
          }
          this.settings.ankiFieldMappings[ankiField] = autoMapping;

          const select = document.querySelector(
            `[data-anki-field="${ankiField}"]`
          );
          if (select) {
            select.value = autoMapping;
          }
        }
      }
    });

    this.saveSettings();
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

    this.settings.ankiFieldMappings = {};
    this.saveSettings();
  }

  // ==================== VOCABULARY MANAGEMENT ====================

  async loadStatistics() {
    try {
      const stats = await this.getStatistics();

      document.getElementById("stat-known-words").textContent =
        stats.knownWords || "0";
      document.getElementById("stat-total-lookups").textContent =
        stats.totalLookups || "0";
      document.getElementById("stat-today-lookups").textContent =
        stats.todayLookups || "0";
      document.getElementById("stat-anki-cards").textContent =
        stats.ankiCards || "0";
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }

  async getStatistics() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          "knownWords",
          "chineseExtensionVocabList",
          "totalLookups",
          "todayLookupCount",
          "ankiCardsCreated",
          "lastResetDate",
        ]);

        const today = new Date().toDateString();
        const lastReset = result.lastResetDate || "";
        let todayLookups = result.todayLookupCount || 0;

        if (lastReset !== today) {
          todayLookups = 0;
          chrome.storage.local.set({
            todayLookupCount: 0,
            lastResetDate: today,
          });
        }

        return {
          knownWords:
            result.knownWords?.length ||
            result.chineseExtensionVocabList?.length ||
            0,
          totalLookups: result.totalLookups || 0,
          todayLookups: todayLookups,
          ankiCards: result.ankiCardsCreated || 0,
        };
      }
    } catch (error) {
      console.error("Error getting statistics:", error);
    }

    return {
      knownWords: 0,
      totalLookups: 0,
      todayLookups: 0,
      ankiCards: 0,
    };
  }

  async importKnownWords() {
    const textarea = document.getElementById("bulk-import-textarea");
    const text = textarea.value.trim();

    if (!text) {
      alert("Please enter some words to import.");
      return;
    }

    try {
      const words = text.split(/[\s,\n\r]+/).filter((word) => word.trim());
      const chineseWords = words.filter((word) =>
        /[\u4e00-\u9fff\u3400-\u4dbf]/.test(word)
      );

      if (chineseWords.length === 0) {
        alert("No valid Chinese words found. Please check your input.");
        return;
      }

      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          "knownWords",
          "chineseExtensionVocabList",
        ]);

        const existingKnown = new Set(result.knownWords || []);
        chineseWords.forEach((word) => existingKnown.add(word));

        const existingVocab = result.chineseExtensionVocabList || [];
        const existingVocabWords = new Set(
          existingVocab.map((item) => item.character || item.word)
        );

        const newVocabItems = chineseWords
          .filter((word) => !existingVocabWords.has(word))
          .map((word) => ({
            character: word,
            word: word,
            definition: "Imported word",
            pinyin: "",
            dateAdded: new Date().toISOString(),
            reviewCount: 0,
          }));

        const updatedVocab = [...existingVocab, ...newVocabItems];

        await chrome.storage.local.set({
          knownWords: Array.from(existingKnown),
          chineseExtensionVocabList: updatedVocab,
        });

        textarea.value = "";
        await this.loadStatistics();

        alert(
          `Successfully imported ${chineseWords.length} Chinese words!\n\nTotal words processed: ${words.length}\nValid Chinese words: ${chineseWords.length}\nNew words added: ${newVocabItems.length}`
        );
      }
    } catch (error) {
      console.error("Error importing words:", error);
      alert("Error importing words. Please try again.");
    }
  }

  async exportKnownWords() {
    try {
      let knownWords = [];

      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          "knownWords",
          "chineseExtensionVocabList",
        ]);

        if (result.knownWords && result.knownWords.length > 0) {
          knownWords = result.knownWords;
        } else if (result.chineseExtensionVocabList) {
          knownWords = result.chineseExtensionVocabList.map(
            (item) => item.character || item.word
          );
        }
      }

      if (knownWords.length === 0) {
        alert("No known words to export.");
        return;
      }

      const exportData = {
        words: knownWords,
        exportDate: new Date().toISOString(),
        totalWords: knownWords.length,
        source: "Helios Extension",
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `helios-known-words-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      alert(`Successfully exported ${knownWords.length} known words!`);
    } catch (error) {
      console.error("Error exporting words:", error);
      alert("Error exporting words. Please try again.");
    }
  }

  async clearKnownWords() {
    if (
      !confirm(
        "Are you sure you want to clear all known words? This cannot be undone."
      )
    ) {
      return;
    }

    if (
      !confirm(
        "This will permanently delete all your vocabulary progress. Are you absolutely sure?"
      )
    ) {
      return;
    }

    try {
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          knownWords: [],
          chineseExtensionVocabList: [],
        });
      }

      await this.loadStatistics();
      alert("All known words have been cleared successfully.");
    } catch (error) {
      console.error("Error clearing words:", error);
      alert("Error clearing words. Please try again.");
    }
  }

  async backupAllData() {
    try {
      let allData = {};

      if (chrome.storage && chrome.storage.local) {
        allData = await chrome.storage.local.get(null);
      }

      const backupData = {
        ...allData,
        backupInfo: {
          extensionVersion: "1.1.0",
          backupDate: new Date().toISOString(),
          source: "Helios Extension",
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `helios-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      alert("Backup created successfully!");
    } catch (error) {
      console.error("Error creating backup:", error);
      alert("Error creating backup. Please try again.");
    }
  }

  async restoreData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const backupData = JSON.parse(text);

        if (
          !backupData.backupInfo &&
          !backupData.knownWords &&
          !backupData.extensionEnabled
        ) {
          throw new Error("Invalid backup file format");
        }

        if (
          !confirm(
            "Are you sure you want to restore this backup? This will overwrite all your current settings and data."
          )
        ) {
          return;
        }

        delete backupData.backupInfo;

        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.clear();
          await chrome.storage.local.set(backupData);
        }

        alert("Backup restored successfully! The page will now reload.");
        location.reload();
      } catch (error) {
        console.error("Error restoring backup:", error);
        alert(
          "Error restoring backup. Please check the file format and try again."
        );
      }
    };

    input.click();
  }

  async resetAllData() {
    if (
      !confirm(
        "Are you sure you want to reset ALL data? This will delete everything and cannot be undone."
      )
    ) {
      return;
    }

    if (
      !confirm(
        "This is your final warning. All settings, vocabulary, and data will be permanently deleted."
      )
    ) {
      return;
    }

    try {
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.clear();
      }

      alert("All data has been reset. The page will now reload.");
      location.reload();
    } catch (error) {
      console.error("Error resetting data:", error);
      alert("Error resetting data. Please try again.");
    }
  }

  // ==================== ADVANCED SETTINGS ====================

  async clearCache() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(null);
        const keysToKeep = [
          "knownWords",
          "chineseExtensionVocabList",
          "extensionEnabled",
          "activationKey",
          "ankiDeck",
          "ankiNoteType",
          "ankiFieldMappings",
        ];

        const dataToKeep = {};
        keysToKeep.forEach((key) => {
          if (result[key] !== undefined) {
            dataToKeep[key] = result[key];
          }
        });

        await chrome.storage.local.clear();
        await chrome.storage.local.set(dataToKeep);
      }

      alert("Cache cleared successfully!");
    } catch (error) {
      console.error("Error clearing cache:", error);
      alert("Error clearing cache. Please try again.");
    }
  }

  async exportLogs() {
    try {
      const logs = [
        `Helios Extension Debug Log - ${new Date().toISOString()}`,
        "=".repeat(50),
        `Extension Version: 1.1.0`,
        `Browser: ${navigator.userAgent}`,
        `Settings:`,
        JSON.stringify(this.settings, null, 2),
        "=".repeat(50),
        "End of log",
      ];

      const blob = new Blob([logs.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `helios-debug-log-${
        new Date().toISOString().split("T")[0]
      }.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      alert("Debug log exported successfully!");
    } catch (error) {
      console.error("Error exporting logs:", error);
      alert("Error exporting logs. Please try again.");
    }
  }

  async runDiagnostics() {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        extensionVersion: "1.1.0",
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
        },
        extension: {
          chromeStorageAvailable: !!(chrome.storage && chrome.storage.local),
          chromeRuntimeAvailable: !!(
            chrome.runtime && chrome.runtime.sendMessage
          ),
          settingsLoaded: Object.keys(this.settings).length > 0,
          loadedTabs: Array.from(this.loadedTabs),
        },
        anki: {
          connectionStatus: this.ankiConnection,
          availableDecks: this.availableDecks.length,
          availableNoteTypes: this.availableNoteTypes.length,
          currentNoteTypeFields: this.currentNoteTypeFields.length,
        },
        statistics: await this.getStatistics(),
        settings: {
          totalSettings: Object.keys(this.settings).length,
          extensionEnabled: this.settings.extensionEnabled,
          activationKey: this.settings.activationKey,
          ankiDeck: this.settings.ankiDeck,
          ankiNoteType: this.settings.ankiNoteType,
        },
      };

      console.group("🔍 Helios Diagnostics");
      console.log("Full diagnostic report:", diagnostics);
      console.groupEnd();

      const summary = [
        "🔍 Diagnostics Complete!",
        "",
        `✅ Extension: ${
          diagnostics.extension.settingsLoaded ? "OK" : "Error"
        }`,
        `✅ Chrome APIs: ${
          diagnostics.extension.chromeStorageAvailable ? "OK" : "Error"
        }`,
        `✅ Anki: ${
          diagnostics.anki.connectionStatus ? "Connected" : "Disconnected"
        }`,
        `✅ Known Words: ${diagnostics.statistics.knownWords}`,
        `✅ Loaded Tabs: ${diagnostics.extension.loadedTabs.join(", ")}`,
        "",
        "Full details logged to console (F12 → Console)",
      ].join("\n");

      alert(summary);
    } catch (error) {
      console.error("Error running diagnostics:", error);
      alert("Error running diagnostics. Check console for details.");
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing Helios Settings...");
  window.heliosSettings = new HeliosSettingsManager();
});

window.HeliosSettingsManager = HeliosSettingsManager;
