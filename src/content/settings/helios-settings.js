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
      // Note: targetLanguage is intentionally not set here - it should remain
      // blank/null until the user completes onboarding and selects their language

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
      persistentPopup: true,
      autoCloseDelay: 0,
      highlightStyle: "underline",
      highlightColor: "orange",
      highlightIntensity: "normal",
      hideKnownSites: false,
      
      // Keyboard Shortcuts - Unified structure
      shortcuts: {
        // Popup shortcuts (single character, no modifiers)
        popup: {
          markUnknown: "1",
          markIgnored: "2",
          markKnown: "3",
          ankiAdd: "q"
        },
        // Video shortcuts (with modifiers: ctrl, shift, alt, meta)
        video: {
          loadSubtitles: { key: "L", ctrl: true, shift: true, alt: false, meta: false },
          togglePanel: { key: "S", ctrl: true, shift: true, alt: false, meta: false },
          loadYouTube: { key: "Y", ctrl: true, shift: true, alt: false, meta: false }
        },
        // Video navigation shortcuts (single character, no modifiers)
        videoNavigation: {
          previous: { key: "A", ctrl: false, shift: false, alt: false, meta: false },
          next: { key: "D", ctrl: false, shift: false, alt: false, meta: false },
          restart: { key: "S", ctrl: false, shift: false, alt: false, meta: false },
          toggle: { key: "W", ctrl: false, shift: false, alt: false, meta: false }
        }
      },

      // Video Navigation Behavior
      videoNavigationBehavior: {
        autoPlayAfterNav: false  // Auto-play after A/S/D navigation (when video is paused)
      },

      // Video Player Settings
      videoPlayer: {
        hotkeysEnabled: true,
        dualSubtitlesEnabled: false,
        secondarySubtitleLanguage: null,
        pauseOnHover: true,
        pauseAtEnd: false,
        autoPlayAfterNav: false,
        hotkeys: {
          previous: { key: "a", shift: false, ctrl: false, alt: false },
          next: { key: "d", shift: false, ctrl: false, alt: false },
          restart: { key: "s", shift: false, ctrl: false, alt: false },
          toggle: { key: "w", shift: false, ctrl: false, alt: false }
        }
      },

      // Legacy shortcuts (for backward compatibility)
      hotkeyMarkUnknown: "1",
      hotkeyMarkIgnored: "2",
      hotkeyMarkKnown: "3",
      hotkeyAnkiAdd: "q",

      // Anki
      ankiDeck: "",
      ankiNoteType: "",
      ankiCheckDuplicates: true,
      ankiIncludeSentence: true,
      ankiFieldMappings: {},
      ankiImportYoungAsLearning: true,
      ankiAutoSyncLearningWords: true,

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

      console.log("🔍 DEBUG: Event listeners set up, loading sections...");

      // Every section shares one scroll, so all of them load before the board reports state.
      await this.loadAllSections();

      // The board paints from local settings straight away. Anki is a network
      // probe that can take ten seconds to fail, and the learner who most needs
      // this page is the one whose Anki is not running.
      if (typeof HeliosReadinessBoard !== "undefined") {
        this.readiness = new HeliosReadinessBoard(this);
        this.readiness.render();
      }

      this.setupScrollSpy();
      this.goToHashSection();

      if (this.anki) {
        this.anki
          .initializeAnki()
          .catch((error) => console.error("🃏 Anki init failed:", error))
          .finally(() => this.readiness?.render());
      }

      if (this.vocabulary) {
        this.vocabulary
          .loadStatistics()
          .catch((error) => console.error("🔍 Stats failed:", error));
      }

      console.log("🔍 DEBUG: Helios Settings Manager initialized successfully");

      // Listen for storage changes from other sources (like YouTube sidebar)
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && (changes.videoPlayer || changes.ytSidebarSettings)) {
          console.log("🔍 DEBUG: Storage changed externally, reloading settings");
          this.storage.loadAllSettings().then(() => {
            // Update any currently loaded tabs
            this.loadedTabs.forEach((tabName) => {
              if (this.ui) {
                this.ui.updateTabUI(tabName);
              }
            });
            this.readiness?.render();
          });
        }
      });
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
          <h3 class="section-title">Settings could not start</h3>
          <p class="section-description">
            A settings module failed to load: ${error.message}
          </p>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" onclick="location.reload()">
              Reload settings
            </button>
          </div>
        </div>
      `;
    }
  }

  get sectionNames() {
    return [
      "general",
      "popup",
      "shortcuts",
      "video-player",
      "anki",
      "vocabulary",
      "advanced",
    ];
  }

  async loadAllSections() {
    await Promise.all(
      this.sectionNames.map((name) => this.loadTabContent(name))
    );
  }

  setupEventListeners() {
    document.querySelectorAll(".rail__item").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        this.goToSection(item.dataset.target);
      });
    });

    document
      .getElementById("readiness-recheck")
      ?.addEventListener("click", () => this.recheckReadiness());
  }

  /**
   * Scroll a section into view and move focus there, so the rail works for
   * keyboard and pointer alike.
   * @param {string} sectionId - DOM id of the <section> wrapper
   */
  goToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    section.focus({ preventScroll: true });
    history.replaceState(null, "", `#${sectionId}`);
    this.markCurrentSection(sectionId);
  }

  goToHashSection() {
    const target = window.location.hash.slice(1);
    if (target && document.getElementById(target)) {
      this.goToSection(target);
    }
  }

  markCurrentSection(sectionId) {
    document.querySelectorAll(".rail__item").forEach((item) => {
      item.classList.toggle("is-current", item.dataset.target === sectionId);
    });
  }

  setupScrollSpy() {
    const sections = Array.from(document.querySelectorAll(".main > [id]"));
    if (!sections.length) return;

    let ticking = false;

    const sync = () => {
      ticking = false;
      // The section that owns the reading line just under the app bar is current.
      const line = 140;
      let current = sections[0];

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) {
          current = section;
        }
      }

      const atBottom =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
      if (atBottom) {
        current = sections[sections.length - 1];
      }

      this.markCurrentSection(current.id);
    };

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(sync);
      },
      { passive: true }
    );

    sync();
  }

  async recheckReadiness() {
    const button = document.getElementById("readiness-recheck");
    if (button) button.disabled = true;

    try {
      await this.storage.loadAllSettings();
      if (this.anki) await this.anki.checkConnection();
      if (this.vocabulary) await this.vocabulary.loadStatistics();
      this.readiness?.render();
    } finally {
      if (button) button.disabled = false;
    }
  }

  /**
   * Reflect save activity in the app bar. Settings save on change, so the only
   * honest states are "will save" and "saved".
   * @param {"saving"|"saved"} state
   */
  showSaveState(state) {
    const indicator = document.getElementById("save-state");
    if (!indicator) return;

    const text = indicator.querySelector(".save-state__text");
    indicator.dataset.state = state;
    if (text) {
      text.textContent = state === "saving" ? "Saving…" : "All changes saved";
    }

    clearTimeout(this.saveStateTimer);
    if (state === "saved") {
      this.saveStateTimer = setTimeout(() => {
        delete indicator.dataset.state;
        if (text) text.textContent = "Changes save automatically";
      }, 2400);
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
      tabElement.innerHTML = `<div class="loading-indicator" role="status" aria-label="Loading ${this.getTabDisplayName(
        tabName
      )}"></div>`;

      console.log("🔍 DEBUG: Fetching HTML for:", tabName);

      // Fetch the appropriate HTML file
      // File paths are centralized in src/config/paths.js
      const url = window.PATHS ? window.PATHS.getChromeURL(`HTML.${tabName.toUpperCase()}_SETTINGS`) : chrome.runtime.getURL(`src/ui/settings/${tabName}-settings.html`);
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
          <h3 class="section-title">${this.getTabDisplayName(
            tabName
          )} could not load</h3>
          <p class="section-description">${error.message}</p>
          <div class="btn-row">
            <button class="btn btn-secondary" type="button" onclick="location.reload()">
              Reload settings
            </button>
          </div>
        </div>
      `;
    }
  }

  getTabDisplayName(tabName) {
    const displayNames = {
      general: "General",
      popup: "Lookup popup",
      shortcuts: "Shortcuts",
      "video-player": "Video",
      anki: "Anki",
      vocabulary: "Words & data",
      advanced: "Maintenance",
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
