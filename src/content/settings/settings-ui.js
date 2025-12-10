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
      case "shortcuts":
        this.setupShortcutsEventListeners();
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

  setupShortcutsEventListeners() {
    console.log("Setting up shortcuts event listeners");

    // Popup shortcuts (now use click-to-record)
    const popupShortcutIds = [
      "hotkey-mark-unknown",
      "hotkey-mark-ignored",
      "hotkey-mark-known",
      "hotkey-anki-add"
    ];

    // Setup click-to-record for popup shortcuts
    popupShortcutIds.forEach((shortcutId) => {
      const element = document.getElementById(shortcutId);
      if (!element) return;

      // On focus/click, enable recording
      element.addEventListener("focus", () => {
        element.removeAttribute("readonly");
        element.value = "";
        element.placeholder = "Press any key...";
        this.clearShortcutError(shortcutId);
      });

      // Capture keypress and update shortcut
      element.addEventListener("keydown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignore modifier keys alone
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
          return;
        }

        // Normalize key names for special keys
        let keyName = e.key;
        if (keyName.startsWith("Arrow")) {
          keyName = keyName.substring(5); // "ArrowLeft" -> "Left"
        }

        const newHotkey = {
          key: keyName.toLowerCase(),
          shift: e.shiftKey,
          ctrl: e.ctrlKey || e.metaKey, // Meta (Cmd) treated as Ctrl
          alt: e.altKey,
          meta: false
        };

        // Check for conflicts with other shortcuts (popup + video)
        const allShortcutIds = [...popupShortcutIds, "video-load", "video-panel", "video-youtube", 
          "video-nav-previous", "video-nav-next", "video-nav-restart", "video-nav-toggle"];
        const conflict = this.checkVideoShortcutConflict(shortcutId, newHotkey, allShortcutIds);
        if (conflict) {
          this.showShortcutError(shortcutId, `This shortcut conflicts with: ${conflict}`);
          element.blur();
          element.setAttribute("readonly", "true");
          return;
        }

        // Check for Chrome conflicts (only for single keys without modifiers)
        if (!newHotkey.ctrl && !newHotkey.shift && !newHotkey.alt) {
          if (this.isChromeShortcutConflict(newHotkey.key)) {
            this.showShortcutError(shortcutId, "This key conflicts with Chrome shortcuts");
            element.blur();
            element.setAttribute("readonly", "true");
            return;
          }
        }

        // Update display
        const displayText = this.formatHotkeyDisplay(newHotkey);
        element.value = displayText;
        element.blur();
        element.setAttribute("readonly", "true");

        // Save settings
        this.manager.storage.saveSettings();
      });

      // Handle blur - restore readonly
      element.addEventListener("blur", () => {
        element.setAttribute("readonly", "true");
        // Restore value if empty
        if (!element.value) {
          const currentShortcut = this.getCurrentPopupShortcut(shortcutId);
          if (currentShortcut) {
            element.value = this.formatHotkeyDisplay(currentShortcut);
          }
        }
      });
    });

    // Video shortcuts (all use click-to-record)
    const videoShortcutIds = [
      "video-load",
      "video-panel",
      "video-youtube",
      "video-nav-previous",
      "video-nav-next",
      "video-nav-restart",
      "video-nav-toggle"
    ];

    // Setup click-to-record for all video shortcuts
    videoShortcutIds.forEach((shortcutId) => {
      const element = document.getElementById(shortcutId);
      if (!element) return;

      // On focus/click, enable recording
      element.addEventListener("focus", () => {
        element.removeAttribute("readonly");
        element.value = "";
        element.placeholder = "Press any key...";
        this.clearShortcutError(shortcutId);
      });

      // Capture keypress and update shortcut
      element.addEventListener("keydown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignore modifier keys alone
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
          return;
        }

        // Normalize key names for special keys
        let keyName = e.key;
        if (keyName.startsWith("Arrow")) {
          keyName = keyName.substring(5); // "ArrowLeft" -> "Left"
        }

        const newHotkey = {
          key: keyName.toLowerCase(),
          shift: e.shiftKey,
          ctrl: e.ctrlKey || e.metaKey, // Meta (Cmd) treated as Ctrl
          alt: e.altKey,
          meta: false
        };

        // Check for conflicts with other shortcuts
        const conflict = this.checkVideoShortcutConflict(shortcutId, newHotkey, videoShortcutIds);
        if (conflict) {
          this.showShortcutError(shortcutId, `This shortcut conflicts with: ${conflict}`);
          element.blur();
          element.setAttribute("readonly", "true");
          return;
        }

        // Check for Chrome conflicts (only for single keys without modifiers)
        if (!newHotkey.ctrl && !newHotkey.shift && !newHotkey.alt) {
          if (this.isChromeShortcutConflict(newHotkey.key)) {
            this.showShortcutError(shortcutId, "This key conflicts with Chrome shortcuts");
            element.blur();
            element.setAttribute("readonly", "true");
            return;
          }
        }

        // Update display
        const displayText = this.formatHotkeyDisplay(newHotkey);
        element.value = displayText;
        element.blur();
        element.setAttribute("readonly", "true");

        // Save settings
        this.manager.storage.saveSettings();
      });

      // Handle blur - restore readonly
      element.addEventListener("blur", () => {
        element.setAttribute("readonly", "true");
        // Restore value if empty
        if (!element.value) {
          const currentShortcut = this.getCurrentVideoShortcut(shortcutId);
          if (currentShortcut) {
            element.value = this.formatHotkeyDisplay(currentShortcut);
          }
        }
      });
    });
  }

  /**
   * Validate a popup shortcut key (single character)
   * @param {string} shortcutId - The ID of the shortcut input
   * @param {string} value - The shortcut value
   * @param {string[]} allShortcutIds - All shortcut IDs to check for overlaps
   */
  validatePopupShortcut(shortcutId, value, allShortcutIds) {
    const errorElement = document.getElementById(`error-${shortcutId.replace("hotkey-", "")}`);
    if (!errorElement) return;

    // Clear previous error
    this.clearShortcutError(shortcutId);

    if (!value || value.trim() === "") {
      this.showShortcutError(shortcutId, "Shortcut cannot be empty");
      return false;
    }

    const normalizedValue = value.toLowerCase().trim();

    // Check for overlap with other shortcuts
    for (const otherId of allShortcutIds) {
      if (otherId === shortcutId) continue;
      
      const otherInput = document.getElementById(otherId);
      if (otherInput && otherInput.value.toLowerCase().trim() === normalizedValue) {
        this.showShortcutError(shortcutId, `This shortcut conflicts with another shortcut`);
        return false;
      }
    }

    // Check for Chrome shortcut conflicts
    if (this.isChromeShortcutConflict(normalizedValue)) {
      this.showShortcutError(shortcutId, `This key conflicts with Chrome shortcuts`);
      return false;
    }

    return true;
  }

  /**
   * Format hotkey object for display (e.g., "Ctrl+Shift+L")
   * @param {Object} hotkey - Hotkey configuration object
   * @returns {string} - Formatted display string
   */
  formatHotkeyDisplay(hotkey) {
    if (!hotkey || !hotkey.key) return "";
    
    const parts = [];
    if (hotkey.ctrl) parts.push("Ctrl");
    if (hotkey.shift) parts.push("Shift");
    if (hotkey.alt) parts.push("Alt");

    // Capitalize first letter of key for display
    const keyDisplay = hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1);
    parts.push(keyDisplay);

    return parts.join("+");
  }

  /**
   * Get current video shortcut configuration from input value
   * @param {string} shortcutId - The ID of the shortcut input
   * @returns {Object|null} - Shortcut configuration or null
   */
  getCurrentVideoShortcut(shortcutId) {
    const element = document.getElementById(shortcutId);
    if (!element || !element.value) return null;

    // Parse the display string back to config
    return this.parseHotkeyDisplay(element.value);
  }

  /**
   * Get current popup shortcut configuration from input value
   * @param {string} shortcutId - The ID of the shortcut input
   * @returns {Object|null} - Shortcut configuration or null
   */
  getCurrentPopupShortcut(shortcutId) {
    const element = document.getElementById(shortcutId);
    if (!element || !element.value) {
      // Fallback to settings
      const shortcuts = this.manager.settings.shortcuts || {};
      const popupShortcuts = shortcuts.popup || {};
      const legacyMap = {
        "hotkey-mark-unknown": "markUnknown",
        "hotkey-mark-ignored": "markIgnored",
        "hotkey-mark-known": "markKnown",
        "hotkey-anki-add": "ankiAdd"
      };
      const key = legacyMap[shortcutId];
      if (key && popupShortcuts[key]) {
        return popupShortcuts[key];
      }
      // Return default as single key
      const defaults = {
        "hotkey-mark-unknown": { key: "1", ctrl: false, shift: false, alt: false, meta: false },
        "hotkey-mark-ignored": { key: "2", ctrl: false, shift: false, alt: false, meta: false },
        "hotkey-mark-known": { key: "3", ctrl: false, shift: false, alt: false, meta: false },
        "hotkey-anki-add": { key: "q", ctrl: false, shift: false, alt: false, meta: false }
      };
      return defaults[shortcutId] || null;
    }

    // Parse the display string back to config
    return this.parseHotkeyDisplay(element.value);
  }

  /**
   * Parse hotkey display string to configuration object
   * @param {string} displayString - Display string like "Ctrl+Shift+L"
   * @returns {Object} - Hotkey configuration object
   */
  parseHotkeyDisplay(displayString) {
    if (!displayString) return null;

    const parts = displayString.split("+").map(p => p.trim());
    const key = parts[parts.length - 1].toLowerCase();
    const ctrl = parts.includes("Ctrl");
    const shift = parts.includes("Shift");
    const alt = parts.includes("Alt");

    return { key, ctrl, shift, alt, meta: false };
  }

  /**
   * Check if a video shortcut conflicts with others
   * @param {string} shortcutId - Current shortcut ID
   * @param {Object} newHotkey - New hotkey configuration
   * @param {Array} allShortcutIds - All shortcut IDs to check
   * @returns {string|null} - Conflicting shortcut ID or null
   */
  checkVideoShortcutConflict(shortcutId, newHotkey, allShortcutIds) {
    for (const otherId of allShortcutIds) {
      if (otherId === shortcutId) continue;

      const otherElement = document.getElementById(otherId);
      if (!otherElement || !otherElement.value) continue;

      const otherHotkey = this.parseHotkeyDisplay(otherElement.value);
      if (!otherHotkey) continue;

      if (
        otherHotkey.key === newHotkey.key &&
        otherHotkey.ctrl === newHotkey.ctrl &&
        otherHotkey.shift === newHotkey.shift &&
        otherHotkey.alt === newHotkey.alt
      ) {
        return otherId;
      }
    }
    return null;
  }

  /**
   * Validate a video shortcut (with modifiers) - Legacy method, kept for compatibility
   * @param {string} shortcutId - The ID of the shortcut
   * @param {Object} shortcut - Shortcut configuration object
   * @param {Array} allShortcuts - All video shortcuts to check for overlaps
   */
  validateVideoShortcut(shortcutId, shortcut, allShortcuts) {
    const errorElement = document.getElementById(`error-${shortcutId}`);
    if (!errorElement) return;

    // Clear previous error
    this.clearShortcutError(shortcutId);

    const keyInput = document.getElementById(shortcut.keyId);
    const ctrlCheckbox = document.getElementById(shortcut.ctrlId);
    const shiftCheckbox = document.getElementById(shortcut.shiftId);

    if (!keyInput || !ctrlCheckbox || !shiftCheckbox) return;

    const key = keyInput.value.trim().toUpperCase();
    const ctrl = ctrlCheckbox.checked;
    const shift = shiftCheckbox.checked;

    if (!key) {
      this.showShortcutError(shortcutId, "Key cannot be empty");
      return false;
    }

    // Check for overlap with other video shortcuts
    for (const otherShortcut of allShortcuts) {
      if (otherShortcut.id === shortcutId) continue;

      const otherKeyInput = document.getElementById(otherShortcut.keyId);
      const otherCtrlCheckbox = document.getElementById(otherShortcut.ctrlId);
      const otherShiftCheckbox = document.getElementById(otherShortcut.shiftId);

      if (otherKeyInput && otherCtrlCheckbox && otherShiftCheckbox) {
        const otherKey = otherKeyInput.value.trim().toUpperCase();
        const otherCtrl = otherCtrlCheckbox.checked;
        const otherShift = otherShiftCheckbox.checked;

        if (key === otherKey && ctrl === otherCtrl && shift === otherShift) {
          this.showShortcutError(shortcutId, "This shortcut conflicts with another shortcut");
          return false;
        }
      }
    }

    // Check for Chrome conflicts (video shortcuts use Ctrl+Shift, which are generally safe)
    // But we should warn about very common ones
    if (ctrl && shift) {
      const commonConflicts = ["W", "T", "N", "R"]; // Close tab, New tab, New window, Reload
      if (commonConflicts.includes(key)) {
        this.showShortcutError(shortcutId, `Warning: ${key} is commonly used by Chrome`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a key conflicts with Chrome's built-in shortcuts
   * @param {string} key - The key to check
   * @returns {boolean} - True if conflict exists
   */
  isChromeShortcutConflict(key) {
    const normalizedKey = key.toLowerCase().trim();
    
    // Function keys (F1-F12) - Chrome uses these for various functions
    if (/^f([1-9]|1[0-2])$/.test(normalizedKey)) {
      return true;
    }
    
    // Special navigation/control keys that Chrome intercepts
    const specialKeys = [
      "escape", "esc", "enter", "return", "tab", "backspace", 
      "delete", "del", "insert", "home", "end", "pageup", 
      "pagedown", "arrowup", "arrowdown", "arrowleft", "arrowright"
    ];
    
    if (specialKeys.includes(normalizedKey)) {
      return true;
    }
    
    // Note: Single character keys (letters, numbers, symbols) without modifiers
    // are generally safe as Chrome shortcuts typically require Ctrl/Cmd modifiers.
    // We allow these to be used as shortcuts.
    
    return false;
  }

  /**
   * Show error message for a shortcut
   * @param {string} shortcutId - The ID of the shortcut input
   * @param {string} message - Error message to display
   */
  showShortcutError(shortcutId, message) {
    // Handle both popup shortcuts (hotkey-*) and video shortcuts (video-*)
    let errorId = shortcutId.replace("hotkey-", "");
    if (shortcutId.startsWith("video-")) {
      errorId = shortcutId;
    }
    
    const errorElement = document.getElementById(`error-${errorId}`);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
      
      // Find and mark the input as error
      const input = document.getElementById(shortcutId);
      if (!input && shortcutId.startsWith("video-")) {
        // For video shortcuts, find the key input
        const keyInput = document.getElementById(`${shortcutId}-key`);
        if (keyInput) keyInput.classList.add("error");
      } else if (input) {
        input.classList.add("error");
      }
    }
  }

  /**
   * Clear error message for a shortcut
   * @param {string} shortcutId - The ID of the shortcut input
   */
  clearShortcutError(shortcutId) {
    // Handle both popup shortcuts (hotkey-*) and video shortcuts (video-*)
    let errorId = shortcutId.replace("hotkey-", "");
    if (shortcutId.startsWith("video-")) {
      errorId = shortcutId;
    }
    
    const errorElement = document.getElementById(`error-${errorId}`);
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
      
      // Find and remove error class
      const input = document.getElementById(shortcutId);
      if (!input && shortcutId.startsWith("video-")) {
        // For video shortcuts, find the key input
        const keyInput = document.getElementById(`${shortcutId}-key`);
        if (keyInput) keyInput.classList.remove("error");
      } else if (input) {
        input.classList.remove("error");
      }
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
      case "shortcuts":
        this.updateShortcutsUI(tabElement);
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

  updateShortcutsUI(tabElement) {
    console.log("🔍 Updating shortcuts UI with settings:", this.manager.settings);

    // Get shortcuts from new structure or fallback to legacy
    const shortcuts = this.manager.settings.shortcuts || {};
    const popupShortcuts = shortcuts.popup || {};
    const videoShortcuts = shortcuts.video || {};

    // Update popup shortcuts (now use click-to-record format)
    const hotkeyMarkUnknown = tabElement.querySelector("#hotkey-mark-unknown");
    if (hotkeyMarkUnknown) {
      const shortcut = popupShortcuts.markUnknown || 
        (this.manager.settings.hotkeyMarkUnknown ? 
          { key: this.manager.settings.hotkeyMarkUnknown, ctrl: false, shift: false, alt: false, meta: false } : 
          { key: "1", ctrl: false, shift: false, alt: false, meta: false });
      hotkeyMarkUnknown.value = this.formatHotkeyDisplay(shortcut);
      console.log("🔍 Set hotkey mark unknown:", hotkeyMarkUnknown.value);
    }

    const hotkeyMarkIgnored = tabElement.querySelector("#hotkey-mark-ignored");
    if (hotkeyMarkIgnored) {
      const shortcut = popupShortcuts.markIgnored || 
        (this.manager.settings.hotkeyMarkIgnored ? 
          { key: this.manager.settings.hotkeyMarkIgnored, ctrl: false, shift: false, alt: false, meta: false } : 
          { key: "2", ctrl: false, shift: false, alt: false, meta: false });
      hotkeyMarkIgnored.value = this.formatHotkeyDisplay(shortcut);
      console.log("🔍 Set hotkey mark ignored:", hotkeyMarkIgnored.value);
    }

    const hotkeyMarkKnown = tabElement.querySelector("#hotkey-mark-known");
    if (hotkeyMarkKnown) {
      const shortcut = popupShortcuts.markKnown || 
        (this.manager.settings.hotkeyMarkKnown ? 
          { key: this.manager.settings.hotkeyMarkKnown, ctrl: false, shift: false, alt: false, meta: false } : 
          { key: "3", ctrl: false, shift: false, alt: false, meta: false });
      hotkeyMarkKnown.value = this.formatHotkeyDisplay(shortcut);
      console.log("🔍 Set hotkey mark known:", hotkeyMarkKnown.value);
    }

    const hotkeyAnkiAdd = tabElement.querySelector("#hotkey-anki-add");
    if (hotkeyAnkiAdd) {
      const shortcut = popupShortcuts.ankiAdd || 
        (this.manager.settings.hotkeyAnkiAdd ? 
          { key: this.manager.settings.hotkeyAnkiAdd, ctrl: false, shift: false, alt: false, meta: false } : 
          { key: "q", ctrl: false, shift: false, alt: false, meta: false });
      hotkeyAnkiAdd.value = this.formatHotkeyDisplay(shortcut);
      console.log("🔍 Set hotkey anki add:", hotkeyAnkiAdd.value);
    }

    // Update video shortcuts (all use click-to-record format)
    const loadShortcut = videoShortcuts.loadSubtitles || { key: "L", ctrl: true, shift: true, alt: false, meta: false };
    const panelShortcut = videoShortcuts.togglePanel || { key: "S", ctrl: true, shift: true, alt: false, meta: false };
    const youtubeShortcut = videoShortcuts.loadYouTube || { key: "Y", ctrl: true, shift: true, alt: false, meta: false };

    const videoLoad = tabElement.querySelector("#video-load");
    if (videoLoad) videoLoad.value = this.formatHotkeyDisplay(loadShortcut);

    const videoPanel = tabElement.querySelector("#video-panel");
    if (videoPanel) videoPanel.value = this.formatHotkeyDisplay(panelShortcut);

    const videoYoutube = tabElement.querySelector("#video-youtube");
    if (videoYoutube) videoYoutube.value = this.formatHotkeyDisplay(youtubeShortcut);

    // Update video navigation shortcuts
    const videoNavShortcuts = shortcuts.videoNavigation || {};
    const navPrevious = videoNavShortcuts.previous || { key: "A", ctrl: false, shift: false, alt: false, meta: false };
    const navNext = videoNavShortcuts.next || { key: "D", ctrl: false, shift: false, alt: false, meta: false };
    const navRestart = videoNavShortcuts.restart || { key: "S", ctrl: false, shift: false, alt: false, meta: false };
    const navToggle = videoNavShortcuts.toggle || { key: "W", ctrl: false, shift: false, alt: false, meta: false };

    const videoNavPrevious = tabElement.querySelector("#video-nav-previous");
    if (videoNavPrevious) videoNavPrevious.value = this.formatHotkeyDisplay(navPrevious);

    const videoNavNext = tabElement.querySelector("#video-nav-next");
    if (videoNavNext) videoNavNext.value = this.formatHotkeyDisplay(navNext);

    const videoNavRestart = tabElement.querySelector("#video-nav-restart");
    if (videoNavRestart) videoNavRestart.value = this.formatHotkeyDisplay(navRestart);

    const videoNavToggle = tabElement.querySelector("#video-nav-toggle");
    if (videoNavToggle) videoNavToggle.value = this.formatHotkeyDisplay(navToggle);

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

    // Get and display extension version
    const extensionVersion = tabElement.querySelector("#extension-version");
    if (extensionVersion && chrome.runtime && chrome.runtime.getManifest) {
      const currentVersion = chrome.runtime.getManifest().version;
      extensionVersion.textContent = currentVersion;
      
      // Track version changes to get actual last update date
      this.updateExtensionUpdateDate(currentVersion);
    }

    // Display last update date
    const lastUpdated = tabElement.querySelector("#last-updated");
    if (lastUpdated) {
      this.displayLastUpdateDate(lastUpdated);
    }
  }

  /**
   * Track extension version changes and store update date
   * @param {string} currentVersion - Current extension version from manifest
   */
  async updateExtensionUpdateDate(currentVersion) {
    try {
      if (!chrome.storage || !chrome.storage.local) return;

      const result = await chrome.storage.local.get(['extensionVersion', 'extensionLastUpdateDate']);
      const storedVersion = result.extensionVersion;
      
      // If version changed or not stored, update the stored version and date
      if (storedVersion !== currentVersion) {
        const updateDate = new Date().toISOString();
        await chrome.storage.local.set({
          extensionVersion: currentVersion,
          extensionLastUpdateDate: updateDate
        });
      }
    } catch (error) {
      console.error('Error updating extension update date:', error);
    }
  }

  /**
   * Display the last update date from storage
   * @param {HTMLElement} element - Element to display the date in
   */
  async displayLastUpdateDate(element) {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        element.textContent = '-';
        return;
      }

      const result = await chrome.storage.local.get('extensionLastUpdateDate');
      if (result.extensionLastUpdateDate) {
        const updateDate = new Date(result.extensionLastUpdateDate);
        element.textContent = this.formatDateDDMMYYYY(updateDate);
      } else {
        // Fallback: if no stored date, use current date (first time)
        const currentDate = new Date();
        element.textContent = this.formatDateDDMMYYYY(currentDate);
        // Store it for future reference
        await chrome.storage.local.set({
          extensionLastUpdateDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error displaying last update date:', error);
      element.textContent = '-';
    }
  }

  /**
   * Format date as DD/MM/YYYY
   * @param {Date} date - Date object to format
   * @returns {string} Formatted date string
   */
  formatDateDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

window.HeliosSettingsUI = HeliosSettingsUI;
