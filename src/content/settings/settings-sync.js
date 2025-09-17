class SettingsSync {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
  }

  async load() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getExtensionSettings" });
      if (response && response.success) {
        this.callbacks.onLoaded && this.callbacks.onLoaded(response.settings);
      } else {
        this.callbacks.onLoaded && this.callbacks.onLoaded({});
      }
    } catch (_) {
      this.callbacks.onLoaded && this.callbacks.onLoaded({});
    }
    this._listen();
  }

  _listen() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case "extensionToggled":
          this.callbacks.onToggled && this.callbacks.onToggled(message.enabled);
          break;
        case "settingsUpdated":
          this.callbacks.onSettingsUpdated && this.callbacks.onSettingsUpdated(message.settings);
          break;
        case "updateActivationKey":
          this.callbacks.onActivationKeyChanged && this.callbacks.onActivationKeyChanged(message.key);
          break;
        case "updateAutoHighlight":
          this.callbacks.onAutoHighlightChanged && this.callbacks.onAutoHighlightChanged(message.enabled);
          break;
      }
      sendResponse({ success: true });
    });
  }
}


