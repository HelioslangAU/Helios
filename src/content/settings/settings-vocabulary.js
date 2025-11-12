// Helios Settings Vocabulary Manager
// Handles vocabulary import/export and statistics

class HeliosSettingsVocabulary {
  constructor(manager) {
    this.manager = manager;
    this.vocabManager= null

    this.init();
  }

  async init() {
    this.vocabManager = new VocabManager();
    
    // Set the current language from settings if available
    try {
      const settings = await chrome.storage.local.get(['targetLanguage']);
      if (settings.targetLanguage) {
        this.vocabManager.setCurrentLanguage(settings.targetLanguage);
        console.log(`🔍 Vocab manager language set to: ${settings.targetLanguage}`);
      }
    } catch (error) {
      console.warn('Could not get target language from settings:', error);
    }
    
    await this.vocabManager.loadKnownWords();
    await this.loadStatistics();
  }

  async loadStatistics() {
    try {
      console.log("🔍 Loading vocabulary statistics...");

      if (chrome.storage && chrome.storage.local) {
        // Reload vocab manager to ensure we have latest data
        await this.vocabManager.loadKnownWords();

        // Get statistics from storage
        const result = await chrome.storage.local.get([
          "ankiCardsCreated",
        ]);

        console.log("🔍 Raw storage data:", result);

        // Anki cards created
        const ankiCards = result.ankiCardsCreated || 0;

        // Get known words count for current language using vocab manager
        const knownWordsCount = this.vocabManager.getKnownWordsCount();

        // Update UI elements
        const elements = {
          "stat-known-words": knownWordsCount,
          "stat-anki-cards": ankiCards,
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
      "stat-anki-cards": "0",
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
}

window.HeliosSettingsVocabulary = HeliosSettingsVocabulary;
