// Helios Settings Vocabulary Manager
// Handles vocabulary import/export and statistics

class HeliosSettingsVocabulary {
  constructor(manager) {
    this.manager = manager;
  }

  async loadStatistics() {
    try {
      const stats = await this.manager.storage.getStatistics();

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
      await this.manager.storage.clearAllData();
      alert("All data has been reset. The page will now reload.");
      location.reload();
    } catch (error) {
      console.error("Error resetting data:", error);
      alert("Error resetting data. Please try again.");
    }
  }
}

window.HeliosSettingsVocabulary = HeliosSettingsVocabulary;
