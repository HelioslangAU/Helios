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
        element.addEventListener("change", () => {
          console.log(
            `🔍 Setting changed: ${element.id} = ${
              element.type === "checkbox" ? element.checked : element.value
            }`
          );
          this.manager.storage.saveSettings();
        });
      });
  }

  setupGeneralEventListeners() {
    console.log("Setting up general event listeners");

    // Extension enabled/disabled toggle
    const extensionEnabled = document.getElementById("extension-enabled");
    if (extensionEnabled) {
      extensionEnabled.addEventListener("change", (e) => {
        console.log("Extension enabled changed:", e.target.checked);
        // Send message to background script to enable/disable extension
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: "toggleExtension",
            enabled: e.target.checked,
          });
        }
      });
    }

    // Activation key change
    const activationKey = document.getElementById("activation-key");
    if (activationKey) {
      activationKey.addEventListener("change", (e) => {
        console.log("Activation key changed:", e.target.value);
        // Send message to content scripts to update activation key
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updateActivationKey",
                    key: e.target.value,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }

    // Target language change
    const targetLanguage = document.getElementById("target-language");
    if (targetLanguage) {
      targetLanguage.addEventListener("change", (e) => {
        console.log("Target language changed:", e.target.value);
        // Send message to content scripts to update language
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updateLanguage",
                    language: e.target.value,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }

    // Auto-highlight toggle
    const autoHighlight = document.getElementById("auto-highlight");
    if (autoHighlight) {
      autoHighlight.addEventListener("change", (e) => {
        console.log("Auto-highlight changed:", e.target.checked);
        // Send message to content scripts to update highlighting
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updateAutoHighlight",
                    enabled: e.target.checked,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }
  }

  setupPopupEventListeners() {
    console.log("Setting up popup event listeners");

    // Popup theme change
    const popupTheme = document.getElementById("popup-theme");
    if (popupTheme) {
      popupTheme.addEventListener("change", (e) => {
        console.log("Popup theme changed:", e.target.value);
        // Send message to content scripts to update popup theme
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updatePopupTheme",
                    theme: e.target.value,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }

    // Font size change
    const popupFontSize = document.getElementById("popup-font-size");
    if (popupFontSize) {
      popupFontSize.addEventListener("change", (e) => {
        console.log("Popup font size changed:", e.target.value);
        // Send message to content scripts to update font size
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updatePopupFontSize",
                    fontSize: e.target.value,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }

    // Show frequency toggle
    const showFrequency = document.getElementById("show-frequency");
    if (showFrequency) {
      showFrequency.addEventListener("change", (e) => {
        console.log("Show frequency changed:", e.target.checked);
        // Send message to content scripts to update frequency display
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updateShowFrequency",
                    enabled: e.target.checked,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }


    // Persistent popup toggle
    const persistentPopup = document.getElementById("persistent-popup");
    if (persistentPopup) {
      persistentPopup.addEventListener("change", (e) => {
        console.log("Persistent popup changed:", e.target.checked);
        // Send message to content scripts to update popup persistence
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updatePersistentPopup",
                    enabled: e.target.checked,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }

    // Auto-close delay change
    const autoCloseDelay = document.getElementById("auto-close-delay");
    if (autoCloseDelay) {
      autoCloseDelay.addEventListener("change", (e) => {
        console.log("Auto-close delay changed:", e.target.value);
        // Send message to content scripts to update auto-close delay
        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (chrome.tabs.sendMessage) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "updateAutoCloseDelay",
                    delay: parseInt(e.target.value) || 0,
                  })
                  .catch(() => {
                    // Tab might not have content script loaded, ignore
                  });
              }
            });
          });
        }
      });
    }
  }

  setupAnkiEventListeners() {
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

    console.log(`🔍 Updating UI for tab: ${tabName}`);

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
    console.log("🔍 Updating general UI with settings:", this.manager.settings);

    // Extension enabled toggle
    const extensionEnabled = tabElement.querySelector("#extension-enabled");
    if (extensionEnabled) {
      extensionEnabled.checked = this.manager.settings.extensionEnabled;
      console.log(
        "🔍 Set extension enabled:",
        this.manager.settings.extensionEnabled
      );
    }

    // Activation key dropdown
    const activationKey = tabElement.querySelector("#activation-key");
    if (activationKey) {
      activationKey.value = this.manager.settings.activationKey;
      console.log(
        "🔍 Set activation key:",
        this.manager.settings.activationKey
      );
    }

    // Target language dropdown
    const targetLanguage = tabElement.querySelector("#target-language");
    if (targetLanguage) {
      targetLanguage.value = this.manager.settings.targetLanguage || 'zh';
      console.log(
        "🔍 Set target language:",
        this.manager.settings.targetLanguage
      );
    }

    // Auto-highlight toggle
    const autoHighlight = tabElement.querySelector("#auto-highlight");
    if (autoHighlight) {
      autoHighlight.checked = this.manager.settings.autoHighlight;
      console.log(
        "🔍 Set auto-highlight:",
        this.manager.settings.autoHighlight
      );
    }
  }

  updatePopupUI(tabElement) {
    console.log("🔍 Updating popup UI with settings:", this.manager.settings);

    const popupTheme = tabElement.querySelector("#popup-theme");
    if (popupTheme) {
      popupTheme.value = this.manager.settings.popupTheme;
      console.log("🔍 Set popup theme:", this.manager.settings.popupTheme);
    }

    const popupFontSize = tabElement.querySelector("#popup-font-size");
    if (popupFontSize) {
      popupFontSize.value = this.manager.settings.popupFontSize;
      console.log("🔍 Set popup font size:", this.manager.settings.popupFontSize);
    }

    const showFrequency = tabElement.querySelector("#show-frequency");
    if (showFrequency) {
      showFrequency.checked = this.manager.settings.showFrequency;
      console.log("🔍 Set show frequency:", this.manager.settings.showFrequency);
    }


    const persistentPopup = tabElement.querySelector("#persistent-popup");
    if (persistentPopup) {
      persistentPopup.checked = this.manager.settings.persistentPopup;
      console.log("🔍 Set persistent popup:", this.manager.settings.persistentPopup);
    }

    const autoCloseDelay = tabElement.querySelector("#auto-close-delay");
    if (autoCloseDelay) {
      autoCloseDelay.value = this.manager.settings.autoCloseDelay;
      console.log("🔍 Set auto-close delay:", this.manager.settings.autoCloseDelay);
    }

    const highlightStyle = tabElement.querySelector("#highlight-style");
    if (highlightStyle) {
      highlightStyle.value = this.manager.settings.highlightStyle;
      console.log("🔍 Set highlight style:", this.manager.settings.highlightStyle);
    }

    const highlightColor = tabElement.querySelector("#highlight-color");
    if (highlightColor) {
      highlightColor.value = this.manager.settings.highlightColor;
      console.log("🔍 Set highlight color:", this.manager.settings.highlightColor);
    }

    const highlightIntensity = tabElement.querySelector("#highlight-intensity");
    if (highlightIntensity) {
      highlightIntensity.value = this.manager.settings.highlightIntensity;
      console.log("🔍 Set highlight intensity:", this.manager.settings.highlightIntensity);
    }

    const hideKnownSites = tabElement.querySelector("#hide-known-sites");
    if (hideKnownSites) {
      hideKnownSites.checked = this.manager.settings.hideKnownSites;
      console.log("🔍 Set hide known sites:", this.manager.settings.hideKnownSites);
    }
  }

  updateAnkiUI(tabElement) {
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
