// Main Helios Settings Manager - Entry Point
// This file coordinates all the settings modules

class HeliosSettingsManager {
  constructor() {
    console.log("🔍 DEBUG: HeliosSettingsManager constructor called");
    this.settings = {};
    this.loadedTabs = new Set();

    // Import modules (will be initialized after DOM loads)
    this.storage = null;
    this.ui = null;
    this.anki = null;
    this.vocabulary = null;
    this.advanced = null;

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
  }

  async init() {
    console.log("🔍 DEBUG: Initializing Helios Settings Manager...");

    try {
      // Wait for all module classes to be available
      await this.waitForModules();

      console.log("🔍 DEBUG: All modules loaded, initializing...");

      // Initialize modules
      this.storage = new HeliosSettingsStorage(this);
      this.ui = new HeliosSettingsUI(this);
      this.anki = new HeliosSettingsAnki(this);
      this.vocabulary = new HeliosSettingsVocabulary(this);
      this.advanced = new HeliosSettingsAdvanced(this);

      console.log("🔍 DEBUG: Modules initialized, loading settings...");

      // Load settings
      await this.storage.loadAllSettings();

      console.log("🔍 DEBUG: Settings loaded, setting up event listeners...");

      // Set up main navigation
      this.setupEventListeners();

      console.log("🔍 DEBUG: Event listeners set up, loading general tab...");

      // Load the first tab (General) immediately
      await this.loadTabContent("general");

      console.log("🔍 DEBUG: Helios Settings Manager initialized successfully");
    } catch (error) {
      console.error("🔍 DEBUG: Error initializing settings:", error);
      console.error("🔍 DEBUG: Error details:", error.message);
      console.error("🔍 DEBUG: Stack trace:", error.stack);

      // Fallback: show error message
      this.showInitializationError(error);
    }
  }

  async waitForModules() {
    const maxAttempts = 50; // 5 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (
        typeof HeliosSettingsStorage !== "undefined" &&
        typeof HeliosSettingsUI !== "undefined" &&
        typeof HeliosSettingsAnki !== "undefined" &&
        typeof HeliosSettingsVocabulary !== "undefined" &&
        typeof HeliosSettingsAdvanced !== "undefined"
      ) {
        console.log(
          "🔍 DEBUG: All module classes found after",
          attempts,
          "attempts"
        );
        return;
      }

      console.log("🔍 DEBUG: Waiting for modules... attempt", attempts + 1);
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    // Check which modules are missing
    const missing = [];
    if (typeof HeliosSettingsStorage === "undefined")
      missing.push("HeliosSettingsStorage");
    if (typeof HeliosSettingsUI === "undefined")
      missing.push("HeliosSettingsUI");
    if (typeof HeliosSettingsAnki === "undefined")
      missing.push("HeliosSettingsAnki");
    if (typeof HeliosSettingsVocabulary === "undefined")
      missing.push("HeliosSettingsVocabulary");
    if (typeof HeliosSettingsAdvanced === "undefined")
      missing.push("HeliosSettingsAdvanced");

    throw new Error(`Module classes not found: ${missing.join(", ")}`);
  }

  showInitializationError(error) {
    const generalTab = document.getElementById("general");
    if (generalTab) {
      generalTab.innerHTML = `
        <div class="section-card">
          <h2 class="section-title">
            <span>⚠️</span>
            Settings Initialization Error
          </h2>
          <p class="section-description">
            Failed to initialize settings modules: ${error.message}
          </p>
          <div class="help-text">
            Please check the browser console for more details and try refreshing the page.
          </div>
          <button class="btn btn-primary" onclick="location.reload()">
            Refresh Page
          </button>
        </div>
      `;
    }
  }

  setupEventListeners() {
    console.log("🔍 DEBUG: Setting up event listeners...");

    // Tab Navigation
    const navItems = document.querySelectorAll(".nav-item");
    console.log("🔍 DEBUG: Found", navItems.length, "nav items");

    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        console.log(
          "🔍 DEBUG: Tab clicked:",
          e.currentTarget.getAttribute("data-tab")
        );
        this.switchTab(e);
      });
    });
  }

  async switchTab(event) {
    const targetTab = event.currentTarget.getAttribute("data-tab");
    console.log("🔍 DEBUG: Switching to tab:", targetTab);

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
    if (targetTab === "anki" && this.anki && !this.anki.ankiConnection) {
      await this.anki.initializeAnki();
    }

    if (targetTab === "vocabulary" && this.vocabulary) {
      await this.vocabulary.loadStatistics();
    }
  }

  async loadTabContent(tabName) {
    console.log("🔍 DEBUG: Loading tab content for:", tabName);

    const tabElement = document.getElementById(tabName);
    if (!tabElement) {
      console.error("🔍 DEBUG: Tab element not found:", tabName);
      return;
    }

    try {
      // Show loading indicator
      tabElement.innerHTML =
        '<div class="loading-indicator">Loading ' +
        this.getTabDisplayName(tabName) +
        "...</div>";

      console.log("🔍 DEBUG: Fetching HTML for:", tabName);

      // Fetch the appropriate HTML file
      const url = chrome.runtime.getURL(`settings/${tabName}-settings.html`);
      console.log("🔍 DEBUG: Fetch URL:", url);

      const response = await fetch(url);
      console.log("🔍 DEBUG: Fetch response status:", response.status);

      if (!response.ok) {
        throw new Error(
          `Failed to load ${tabName} settings: ${response.status}`
        );
      }

      const html = await response.text();
      console.log("🔍 DEBUG: HTML loaded, length:", html.length);

      tabElement.innerHTML = html;

      // Mark as loaded
      this.loadedTabs.add(tabName);

      // Set up event listeners for this tab
      if (this.ui) {
        this.ui.setupTabEventListeners(tabName);
      }

      // Update UI with current settings
      if (this.ui) {
        this.ui.updateTabUI(tabName);
      }

      console.log(`🔍 DEBUG: Successfully loaded ${tabName} tab`);
    } catch (error) {
      console.error(`🔍 DEBUG: Error loading ${tabName} tab:`, error);
      tabElement.innerHTML = `
        <div class="section-card">
          <h2 class="section-title">
            <span>⚠️</span>
            Error Loading ${this.getTabDisplayName(tabName)}
          </h2>
          <p class="section-description">
            Failed to load settings content: ${error.message}
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
}

// Initialize when DOM is ready
console.log("🔍 DEBUG: Setting up DOM ready listener");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔍 DEBUG: DOM ready, creating settings manager");

  // Small delay to ensure all scripts are loaded
  setTimeout(() => {
    window.heliosSettings = new HeliosSettingsManager();
    window.heliosSettings.init();
  }, 100);
});

window.HeliosSettingsManager = HeliosSettingsManager;
