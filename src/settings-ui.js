// Helios Settings UI Manager
// Handles all UI updates and form interactions

class HeliosSettingsUI {
  constructor(manager) {
    this.manager = manager;
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
        element.addEventListener("change", () =>
          this.manager.storage.saveSettings()
        );
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
      ?.addEventListener("click", () => this.manager.anki.testAnkiConnection());
    document
      .getElementById("anki-deck-select")
      ?.addEventListener("change", (e) => this.manager.anki.onDeckChange(e));
    document
      .getElementById("anki-note-type-select")
      ?.addEventListener("change", (e) =>
        this.manager.anki.onNoteTypeChange(e)
      );
  }

  setupVocabularyEventListeners() {
    // Vocabulary management specific event listeners
    document
      .getElementById("import-known-words")
      ?.addEventListener("click", () =>
        this.manager.vocabulary.importKnownWords()
      );
    document
      .getElementById("export-known-words")
      ?.addEventListener("click", () =>
        this.manager.vocabulary.exportKnownWords()
      );
    document
      .getElementById("clear-known-words")
      ?.addEventListener("click", () =>
        this.manager.vocabulary.clearKnownWords()
      );
    document
      .getElementById("backup-data")
      ?.addEventListener("click", () =>
        this.manager.vocabulary.backupAllData()
      );
    document
      .getElementById("restore-data")
      ?.addEventListener("click", () => this.manager.vocabulary.restoreData());
    document
      .getElementById("reset-all-data")
      ?.addEventListener("click", () => this.manager.vocabulary.resetAllData());
  }

  setupAdvancedEventListeners() {
    // Advanced settings specific event listeners
    document
      .getElementById("clear-cache")
      ?.addEventListener("click", () => this.manager.advanced.clearCache());
    document
      .getElementById("export-logs")
      ?.addEventListener("click", () => this.manager.advanced.exportLogs());
    document
      .getElementById("run-diagnostics")
      ?.addEventListener("click", () => this.manager.advanced.runDiagnostics());
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
      extensionEnabled.checked = this.manager.settings.extensionEnabled;

    const activationKey = tabElement.querySelector("#activation-key");
    if (activationKey)
      activationKey.value = this.manager.settings.activationKey;

    const autoHighlight = tabElement.querySelector("#auto-highlight");
    if (autoHighlight)
      autoHighlight.checked = this.manager.settings.autoHighlight;

    const scanDelay = tabElement.querySelector("#scan-delay");
    if (scanDelay) scanDelay.value = this.manager.settings.scanDelay;

    const maxWordLength = tabElement.querySelector("#max-word-length");
    if (maxWordLength)
      maxWordLength.value = this.manager.settings.maxWordLength;

    const preferTraditional = tabElement.querySelector("#prefer-traditional");
    if (preferTraditional)
      preferTraditional.checked = this.manager.settings.preferTraditional;
  }

  updatePopupUI(tabElement) {
    // Popup settings UI updates
    const popupTheme = tabElement.querySelector("#popup-theme");
    if (popupTheme) popupTheme.value = this.manager.settings.popupTheme;

    const popupFontSize = tabElement.querySelector("#popup-font-size");
    if (popupFontSize)
      popupFontSize.value = this.manager.settings.popupFontSize;

    const showFrequency = tabElement.querySelector("#show-frequency");
    if (showFrequency)
      showFrequency.checked = this.manager.settings.showFrequency;

    const showVariants = tabElement.querySelector("#show-variants");
    if (showVariants) showVariants.checked = this.manager.settings.showVariants;

    const persistentPopup = tabElement.querySelector("#persistent-popup");
    if (persistentPopup)
      persistentPopup.checked = this.manager.settings.persistentPopup;

    const autoCloseDelay = tabElement.querySelector("#auto-close-delay");
    if (autoCloseDelay)
      autoCloseDelay.value = this.manager.settings.autoCloseDelay;

    const highlightStyle = tabElement.querySelector("#highlight-style");
    if (highlightStyle)
      highlightStyle.value = this.manager.settings.highlightStyle;

    const highlightColor = tabElement.querySelector("#highlight-color");
    if (highlightColor)
      highlightColor.value = this.manager.settings.highlightColor;

    const highlightIntensity = tabElement.querySelector("#highlight-intensity");
    if (highlightIntensity)
      highlightIntensity.value = this.manager.settings.highlightIntensity;

    const hideKnownSites = tabElement.querySelector("#hide-known-sites");
    if (hideKnownSites)
      hideKnownSites.checked = this.manager.settings.hideKnownSites;
  }

  updateAnkiUI(tabElement) {
    // Anki settings UI updates
    const ankiDeck = tabElement.querySelector("#anki-deck-select");
    if (ankiDeck) ankiDeck.value = this.manager.settings.ankiDeck;

    const ankiNoteType = tabElement.querySelector("#anki-note-type-select");
    if (ankiNoteType) ankiNoteType.value = this.manager.settings.ankiNoteType;

    const checkDuplicates = tabElement.querySelector("#anki-check-duplicates");
    if (checkDuplicates)
      checkDuplicates.checked = this.manager.settings.ankiCheckDuplicates;

    const includeSentence = tabElement.querySelector("#anki-include-sentence");
    if (includeSentence)
      includeSentence.checked = this.manager.settings.ankiIncludeSentence;
  }

  updateVocabularyUI(tabElement) {
    // Vocabulary settings UI updates - statistics will be loaded separately
  }

  updateAdvancedUI(tabElement) {
    // Advanced settings UI updates
    const processingMode = tabElement.querySelector("#processing-mode");
    if (processingMode)
      processingMode.value = this.manager.settings.processingMode;

    const cacheDictionary = tabElement.querySelector("#cache-dictionary");
    if (cacheDictionary)
      cacheDictionary.checked = this.manager.settings.cacheDictionary;

    const maxElements = tabElement.querySelector("#max-elements");
    if (maxElements) maxElements.value = this.manager.settings.maxElements;

    const backgroundProcessing = tabElement.querySelector(
      "#background-processing"
    );
    if (backgroundProcessing)
      backgroundProcessing.checked = this.manager.settings.backgroundProcessing;

    const autoDetectChinese = tabElement.querySelector("#auto-detect-chinese");
    if (autoDetectChinese)
      autoDetectChinese.checked = this.manager.settings.autoDetectChinese;

    const workIncognito = tabElement.querySelector("#work-incognito");
    if (workIncognito)
      workIncognito.checked = this.manager.settings.workIncognito;

    const debugMode = tabElement.querySelector("#debug-mode");
    if (debugMode) debugMode.checked = this.manager.settings.debugMode;

    const showMetrics = tabElement.querySelector("#show-metrics");
    if (showMetrics) showMetrics.checked = this.manager.settings.showMetrics;

    const disabledSites = tabElement.querySelector("#disabled-sites-textarea");
    if (disabledSites)
      disabledSites.value = (this.manager.settings.disabledSites || []).join(
        "\n"
      );

    const lastUpdated = tabElement.querySelector("#last-updated");
    if (lastUpdated) lastUpdated.textContent = new Date().toLocaleDateString();
  }
}

window.HeliosSettingsUI = HeliosSettingsUI;
