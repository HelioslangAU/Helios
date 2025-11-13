// Helios Settings Advanced Operations
// Handles cache, logs, diagnostics and advanced features

class HeliosSettingsAdvanced {
  constructor(manager) {
    this.manager = manager;
  }

  async clearCache() {
    try {
      await this.manager.storage.clearCache();
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
        JSON.stringify(this.manager.settings, null, 2),
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
          settingsLoaded: Object.keys(this.manager.settings).length > 0,
          loadedTabs: Array.from(this.manager.loadedTabs),
        },
        anki: {
          connectionStatus: this.manager.anki.ankiConnection,
          availableDecks: this.manager.anki.availableDecks.length,
          availableNoteTypes: this.manager.anki.availableNoteTypes.length,
          currentNoteTypeFields: this.manager.anki.currentNoteTypeFields.length,
        },
        statistics: await this.manager.storage.getStatistics(),
        settings: {
          totalSettings: Object.keys(this.manager.settings).length,
          extensionEnabled: this.manager.settings.extensionEnabled,
          activationKey: this.manager.settings.activationKey,
          ankiDeck: this.manager.settings.ankiDeck,
          ankiNoteType: this.manager.settings.ankiNoteType,
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

window.HeliosSettingsAdvanced = HeliosSettingsAdvanced;