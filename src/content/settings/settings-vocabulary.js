// Helios Settings Vocabulary Manager
// Handles vocabulary import/export and statistics

class HeliosSettingsVocabulary {
  constructor(manager) {
    this.manager = manager;
    this.vocabManager = null;
    this.languageRegistry = null;
    this.dictionaryManager = null;

    this.init();
  }

  async init() {
    // Initialize language registry and adapters for validation
    if (typeof LanguageRegistry !== 'undefined') {
      this.languageRegistry = new LanguageRegistry();
      this.languageRegistry.initializeDefaultAdapters();
      window.languageRegistry = this.languageRegistry;
      console.log('🔍 Language registry initialized in settings page');
    } else {
      console.warn('🔍 LanguageRegistry not available - validation will be skipped');
    }

    // Initialize dictionary manager
    if (this.languageRegistry && typeof DictionaryManager !== 'undefined') {
      this.dictionaryManager = new DictionaryManager(this.languageRegistry);
      window.dictionaryManager = this.dictionaryManager;
      console.log('🔍 Dictionary manager initialized in settings page');
    } else {
      console.warn('🔍 DictionaryManager not available - validation will be skipped');
    }

    this.vocabManager = new VocabManager();
    // Make vocabManager available globally for AnkiManager
    window.vocabManager = this.vocabManager;
    
    // Set the current language from settings if available
    let targetLanguage = 'zh'; // default
    try {
      const settings = await chrome.storage.local.get(['targetLanguage']);
      if (settings.targetLanguage) {
        targetLanguage = settings.targetLanguage;
        this.vocabManager.setCurrentLanguage(targetLanguage);
        console.log(`🔍 Vocab manager language set to: ${targetLanguage}`);
      }
    } catch (error) {
      console.warn('Could not get target language from settings:', error);
    }

    // Set language in registry and load dictionary if available
    if (this.languageRegistry) {
      this.languageRegistry.setLanguage(targetLanguage);
    }

    // Load dictionary for validation
    if (this.dictionaryManager) {
      try {
        await this.dictionaryManager.loadDictionary();
        console.log('🔍 Dictionary loaded for validation');
      } catch (error) {
        console.warn('🔍 Could not load dictionary:', error);
      }
    }
    
    await this.vocabManager.loadKnownWords();
    await this.loadStatistics();
    
    // Setup Anki import button state
    this.updateAnkiImportButtonState();
    this.updateAnkiSyncButtonState();
  }

  async loadStatistics() {
    try {
      console.log("🔍 Loading vocabulary statistics...");

      if (chrome.storage && chrome.storage.local) {
        // Reload vocab manager to ensure we have latest data
        await this.vocabManager.loadKnownWords();

        // Get known words count for current language using vocab manager
        const knownWordsCount = this.vocabManager.getKnownWordsCount();
        
        // Get learning words count for current language
        const learningWordsCount = this.vocabManager.getCurrentLanguageLearningWords().size;
        
        // Get ignored words count for current language
        const ignoredWordsCount = this.vocabManager.getCurrentLanguageIgnoredWords().size;

        // Update UI elements
        const elements = {
          "stat-known-words": knownWordsCount,
          "stat-learning-words": learningWordsCount,
          "stat-ignored-words": ignoredWordsCount,
        };

        Object.entries(elements).forEach(([id, value]) => {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = value.toString();
            console.log(`🔍 Updated ${id}: ${value}`);
          }
        });

        console.log("🔍 Statistics loaded successfully");
      } else {
        console.log("🔍 Chrome storage not available, using defaults");
        this.setDefaultStats();
      }
    } catch (error) {
      console.error("🔍 Error loading statistics:", error);
      this.setDefaultStats();
    }
  }

  setDefaultStats() {
    // Set default values when storage is not available
    const defaultStats = {
      "stat-known-words": "0",
      "stat-learning-words": "0",
      "stat-ignored-words": "0",
    };

    Object.entries(defaultStats).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  async importKnownWords() {
    const textarea = document.getElementById("bulk-import-textarea");
    const text = textarea.value.trim();

    if (!text) {
      alert("Please enter some words to import.");
      return;
    }

    // Parse input text - split by various delimiters
    const words = text.split(/[\s,\n\r]+/).filter((word) => word.trim());

    if (words.length === 0) {
      alert("No valid words found. Please check your input.");
      return;
    }

    try {
      // Ensure vocab manager is loaded
      await this.vocabManager.loadKnownWords();
      
      // Import words using vocab manager (it will normalize and handle them)
      // Returns an object with newWordsCount and processedWordsCount
      const result = await this.vocabManager.markMultipleWordsAsKnown(words);
      const newWordsCount = result.newWordsCount;
      const processedWordsCount = result.processedWordsCount;
      const duplicatesCount = processedWordsCount - newWordsCount;

      textarea.value = "";
      await this.loadStatistics();

      let message = `Successfully imported ${newWordsCount} new word${newWordsCount !== 1 ? 's' : ''}!`;
      if (duplicatesCount > 0) {
        message += `\n${duplicatesCount} duplicate word${duplicatesCount !== 1 ? 's were' : ' was'} skipped.`;
      }
      message += `\n\nWords imported for language: ${this.vocabManager.currentLanguage || 'current'}`;

      alert(message);
    } catch (error) {
      console.error("🔍 Error importing words:", error);
      alert("Error importing words. Please try again.");
    }
  }

  async exportKnownWords() {
    try {
      this.vocabManager.exportKnownWordsToFile();
    } catch (error) {
      console.error("🔍 Error exporting words:", error);
      alert("Error exporting words. Please try again.");
    }
  }

  async clearKnownWords() {
    const currentLang = this.vocabManager.currentLanguage || 'current language';
    
    if (
      !confirm(
        `Are you sure you want to clear all known words for ${currentLang}? This cannot be undone.`
      )
    ) {
      return;
    }

    if (
      !confirm(
        "This will permanently delete all your vocabulary progress for this language. Are you absolutely sure?"
      )
    ) {
      return;
    }

    try {
      // Clear words for current language
      await this.vocabManager.clearAllKnownWords();
      await this.loadStatistics();
      alert(`All known words for ${currentLang} have been cleared successfully.`);
      console.log("🔍 All known words cleared for language:", currentLang);
    } catch (error) {
      console.error("🔍 Error clearing words:", error);
      alert("Error clearing words. Please try again.");
    }
  }

  async backupAllData() {
    try {
      console.log("🔍 Creating backup...");

      let allData = {};

      if (chrome.storage && chrome.storage.local) {
        allData = await chrome.storage.local.get(null);
      }

      // Calculate total word count across all languages
      await this.vocabManager.loadKnownWords();
      const allKnownWords = this.vocabManager.getAllKnownWordsAllLanguages();
      let totalWordCount = 0;
      Object.values(allKnownWords).forEach(words => {
        totalWordCount += words.length;
      });

      const backupData = {
        ...allData,
        backupInfo: {
          extensionVersion: "1.1.0",
          backupDate: new Date().toISOString(),
          source: "Helios Extension",
          dataKeys: Object.keys(allData),
          wordCount: totalWordCount,
          languages: Object.keys(allKnownWords),
          languageWordCounts: Object.fromEntries(
            Object.entries(allKnownWords).map(([lang, words]) => [lang, words.length])
          ),
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
      console.log("🔍 Backup created successfully");
    } catch (error) {
      console.error("🔍 Error creating backup:", error);
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

        console.log("🔍 Restoring data from backup...");

        const text = await file.text();
        const backupData = JSON.parse(text);

        // Validate backup file - check for new or old format
        const hasNewFormat = backupData.knownWordsByLanguage || backupData.backupInfo;
        const hasOldFormat = backupData.chineseExtensionKnownWords;
        const hasSettings = backupData.extensionEnabled;
        
        if (!hasNewFormat && !hasOldFormat && !hasSettings) {
          throw new Error("Invalid backup file format");
        }

        if (
          !confirm(
            "Are you sure you want to restore this backup? This will overwrite all your current settings and data."
          )
        ) {
          return;
        }

        // Remove backup info before restoring
        delete backupData.backupInfo;

        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.clear();
          await chrome.storage.local.set(backupData);
          
          // Reload vocab manager to pick up restored data
          await this.vocabManager.loadKnownWords();
        }

        alert("Backup restored successfully! The page will now reload.");
        console.log("🔍 Backup restored successfully");
        location.reload();
      } catch (error) {
        console.error("🔍 Error restoring backup:", error);
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
      console.log("🔍 Resetting all data...");

      await this.manager.storage.clearAllData();
      alert("All data has been reset. The page will now reload.");
      console.log("🔍 All data reset completed");
      location.reload();
    } catch (error) {
      console.error("🔍 Error resetting data:", error);
      alert("Error resetting data. Please try again.");
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
      // Use longer timeout for deck notes requests (large decks can take time)
      const timeoutDuration = action === "ANKI_GET_DECK_NOTES" ? 60000 : 10000; // 60s for deck notes, 10s for others
      const timeout = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeoutDuration);

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

  // Update Anki import button state based on prerequisites
  updateAnkiImportButtonState() {
    const importButton = document.getElementById("vocab-anki-import-known-words");
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
      importButton.innerHTML = "<span>📥</span>Import Known Words from Anki";
      importButton.title = "Import known words from Anki deck";
      importButton.className = "btn btn-anki";
    } else {
      // Button not ready - use red/danger styling
      importButton.innerHTML = "<span>⚠️</span>Anki not set up";
      importButton.title =
        "Configure Anki deck, note type, and expression field mapping in Anki settings to enable import";
      importButton.className = "btn btn-danger";
    }
  }

  // Update Anki sync button state based on prerequisites
  updateAnkiSyncButtonState() {
    const syncButton = document.getElementById("vocab-anki-sync-learning-words");
    if (!syncButton) return;

    const deck = this.manager.settings.ankiDeck;
    const noteType = this.manager.settings.ankiNoteType;
    const fieldMappings = this.manager.settings.ankiFieldMappings || {};

    // Check if expression or expressionRubyTxt is mapped
    const hasExpressionMapping = Object.values(fieldMappings).some(
      (mapping) => mapping === "expression" || mapping === "expressionRubyTxt"
    );

    // Enable button only if all prerequisites are met
    const canSync = deck && noteType && hasExpressionMapping;
    syncButton.disabled = !canSync;

    if (canSync) {
      // Button is ready - use normal styling
      syncButton.innerHTML = "<span>🔄</span>Sync Learning Words";
      syncButton.title = "Sync learning words from Anki and promote to known when interval >= 21 days";
      syncButton.className = "btn btn-anki";
    } else {
      // Button not ready - use red/danger styling
      syncButton.innerHTML = "<span>⚠️</span>Anki not set up";
      syncButton.title =
        "Configure Anki deck, note type, and expression field mapping in Anki settings to enable sync";
      syncButton.className = "btn btn-danger";
    }
  }

  // Import known words from Anki deck
  async importKnownWordsFromAnki() {
    const importButton = document.getElementById("vocab-anki-import-known-words");
    if (!importButton) return;

    try {
      // Validate prerequisites
      const deck = this.manager.settings.ankiDeck;
      const noteType = this.manager.settings.ankiNoteType;
      const fieldMappings = this.manager.settings.ankiFieldMappings || {};

      if (!deck) {
        alert("Please select an Anki deck first in Anki settings");
        return;
      }

      if (!noteType) {
        alert("Please select a note type first in Anki settings");
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
          'Please map a field to "Expression" or "Expression with Ruby Pinyin" in Anki settings first'
        );
        return;
      }

      // Update button to loading state
      importButton.innerHTML = "<span>⏳</span>Importing...";
      importButton.disabled = true;

      // Get all expressions from the deck (optimized - only expression field and intervals)
      const response = await this.sendMessage("ANKI_GET_DECK_NOTES", {
        deck,
        noteType,
        expressionField,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to get notes from Anki");
      }

      const expressions = response.expressions || [];

      if (expressions.length === 0) {
        alert("No notes found in the selected deck");
        this.updateAnkiImportButtonState();
        this.updateAnkiSyncButtonState();
        return;
      }

      // Check if import young as learning is enabled
      const importYoungAsLearning = this.manager.settings.ankiImportYoungAsLearning !== false;

      // Process expressions and categorize by interval
      const expressionsToImportAsKnown = new Set();
      const expressionsToImportAsLearning = new Set();

      for (const item of expressions) {
        let expression = item.expression;

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

        if (!expression) continue;

        // Check interval if importYoungAsLearning is enabled
        let shouldImportAsLearning = false;
        if (importYoungAsLearning) {
          // maxInterval is already calculated in background script
          const maxInterval = item.maxInterval || 0;
          // If max interval is less than 21 days, import as learning
          shouldImportAsLearning = maxInterval < 21;
        }

        if (shouldImportAsLearning) {
          expressionsToImportAsLearning.add(expression);
        } else {
          expressionsToImportAsKnown.add(expression);
        }
      }

      const totalExpressions = expressionsToImportAsKnown.size + expressionsToImportAsLearning.size;

      if (totalExpressions === 0) {
        alert("No valid expressions found in the deck");
        this.updateAnkiImportButtonState();
        this.updateAnkiSyncButtonState();
        return;
      }

      // Ensure vocab manager has the correct language
      const targetLanguage =
        this.manager.settings.targetLanguage ||
        window.languageRegistry?.getCurrentLanguage() ||
        "zh";
      this.vocabManager.setCurrentLanguage(targetLanguage);

      // Import words as known and learning
      let knownResult = { newWordsCount: 0, processedWordsCount: 0 };
      let learningResult = { newWordsCount: 0, processedWordsCount: 0 };

      if (expressionsToImportAsKnown.size > 0) {
        const knownWordsArray = Array.from(expressionsToImportAsKnown);
        knownResult = await this.vocabManager.markMultipleWordsAsKnown(knownWordsArray);
      }

      if (expressionsToImportAsLearning.size > 0) {
        const learningWordsArray = Array.from(expressionsToImportAsLearning);
        learningResult = await this.vocabManager.markMultipleWordsAsLearning(learningWordsArray);
      }

      // Reset button first (before alert which might block)
      // Use updateAnkiImportButtonState to ensure correct styling
      this.updateAnkiImportButtonState();
      
      // Reload statistics to update the count
      await this.loadStatistics();
      
      // Show success message with breakdown
      let message = `Successfully imported ${totalExpressions} word${totalExpressions !== 1 ? "s" : ""} from Anki deck "${deck}"`;
      if (importYoungAsLearning) {
        message += `\n- ${knownResult.newWordsCount} imported as known (interval ≥ 21 days)`;
        message += `\n- ${learningResult.newWordsCount} imported as learning (interval < 21 days)`;
      } else {
        message += `\n- ${knownResult.newWordsCount} imported as known`;
      }
      alert(message);

      console.log(
        `🃏 Imported ${totalExpressions} words from Anki deck:`,
        `${knownResult.newWordsCount} known, ${learningResult.newWordsCount} learning`
      );
    } catch (error) {
      console.error("🃏 Error importing known words from Anki:", error);
      alert(`Error importing words: ${error.message}`);
      // Update button state to ensure correct styling
      this.updateAnkiImportButtonState();
      this.updateAnkiSyncButtonState();
    }
  }

  // Sync learning words from Anki
  async syncLearningWordsFromAnki() {
    const syncButton = document.getElementById("vocab-anki-sync-learning-words");
    if (!syncButton) return;

    try {
      // Validate prerequisites
      const deck = this.manager.settings.ankiDeck;
      const noteType = this.manager.settings.ankiNoteType;
      const fieldMappings = this.manager.settings.ankiFieldMappings || {};

      if (!deck) {
        alert("Please select an Anki deck first in Anki settings");
        return;
      }

      if (!noteType) {
        alert("Please select a note type first in Anki settings");
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
          'Please map a field to "Expression" or "Expression with Ruby Pinyin" in Anki settings first'
        );
        return;
      }

      // Update button to loading state
      syncButton.innerHTML = "<span>⏳</span>Syncing...";
      syncButton.disabled = true;

      // Get AnkiManager instance
      if (!window.AnkiManager) {
        throw new Error("AnkiManager not available");
      }

      const ankiManager = new AnkiManager();
      if (this.dictionaryManager) {
        ankiManager.initialize(this.dictionaryManager);
      }

      // Perform sync
      const result = await ankiManager.syncLearningWordsFromAnki();

      if (result.error) {
        throw new Error(result.error);
      }

      // Show success message
      const message = `Sync complete! ${result.synced || 0} words synced, ${result.promoted || 0} words promoted to known.`;
      alert(message);

      // Reload statistics to reflect changes
      await this.loadStatistics();

      // Update button state
      this.updateAnkiSyncButtonState();
    } catch (error) {
      console.error("🃏 Error syncing learning words from Anki:", error);
      alert(`Error syncing learning words: ${error.message}`);
      this.updateAnkiSyncButtonState();
    }
  }
}

window.HeliosSettingsVocabulary = HeliosSettingsVocabulary;
