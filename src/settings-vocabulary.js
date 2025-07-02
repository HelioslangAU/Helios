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
    await this.vocabManager.loadKnownWords();
    await this.loadStatistics();
  }

  async loadStatistics() {
    try {
      console.log("🔍 Loading vocabulary statistics...");

      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          "chineseExtensionVocabList",
          "todayLookupCount",
          "totalLookups",
          "ankiCardsCreated",
          "lastResetDate",
        ]);


        console.log("🔍 Raw storage data:", result);

        // Calculate known words count

        // Calculate vocab list count (for total lookups approximation)
        const vocabListCount = result.chineseExtensionVocabList?.length || 0;

        // Get today's lookups (with day reset logic)
        const today = new Date().toDateString();
        const lastReset = result.lastResetDate || "";
        let todayLookups = result.todayLookupCount || 0;

        if (lastReset !== today) {
          todayLookups = 0;
          // Update the reset date in storage
          chrome.storage.local.set({
            todayLookupCount: 0,
            lastResetDate: today,
          });
        }

        // Use vocab list count as total lookups if not specifically tracked
        const totalLookups = result.totalLookups || vocabListCount;

        // Anki cards created
        const ankiCards = result.ankiCardsCreated || 0;

        // Update UI elements
        await this.vocabManager.loadKnownWords();
        const elements = {
          "stat-known-words": this.vocabManager.knownWords.size,
          "stat-total-lookups": totalLookups,
          "stat-today-lookups": todayLookups,
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
      "stat-total-lookups": "0",
      "stat-today-lookups": "0",
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


    // Parse input text - split by various delimiters and filter Chinese characters
    const words = text.split(/[\s,\n\r]+/).filter((word) => word.trim());
    const chineseWords = words.filter((word) =>
      /[\u4e00-\u9fff\u3400-\u4dbf]/.test(word)
    );

    if (chineseWords.length === 0) {
      alert("No valid Chinese words found. Please check your input.");
      return;
    }

    try {
      // Use VocabManager for consistency
      //await this.vocabManager.loadKnownWords();
      await this.vocabManager.markMultipleWordsAsKnown(chineseWords);

      textarea.value = "";
      await this.loadStatistics();

      alert(
        `Successfully imported ${chineseWords.length} Chinese words!\n\n` +
          `Total words processed: ${words.length}\n` +
          `Valid Chinese words: ${chineseWords.length}`
      );
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
      await this.vocabManager.clearKnownWords();
      await this.loadStatistics();
      alert("All known words have been cleared successfully.");
      console.log("🔍 All known words cleared");
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

      const backupData = {
        ...allData,
        backupInfo: {
          extensionVersion: "1.1.0",
          backupDate: new Date().toISOString(),
          source: "Helios Extension",
          dataKeys: Object.keys(allData),
          wordCount: allData.chineseExtensionKnownWords?.length || 0,
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

        // Validate backup file
        if (
          !backupData.backupInfo &&
          !backupData.chineseExtensionKnownWords &&
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

        // Remove backup info before restoring
        delete backupData.backupInfo;

        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.clear();
          await chrome.storage.local.set(backupData);
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
