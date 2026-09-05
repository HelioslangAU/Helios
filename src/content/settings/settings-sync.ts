import { browser } from 'wxt/browser';

export interface SettingsSyncCallbacks {
  onLoaded?: (settings: any) => void;
  onToggled?: (enabled: boolean) => void;
  onSettingsUpdated?: (settings: any) => void;
  onActivationKeyChanged?: (key: string) => void;
  onAutoHighlightChanged?: (enabled: boolean) => void;
  onLanguageChanged?: (language: string) => void;
}

export class SettingsSync {
  callbacks: SettingsSyncCallbacks;

  constructor(callbacks: SettingsSyncCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async load(): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({ action: "getExtensionSettings" });
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

  _listen(): void {
    browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
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
        case "updateLanguage":
          this.callbacks.onLanguageChanged && this.callbacks.onLanguageChanged(message.language);
          break;
      }
      sendResponse({ success: true });
    });
  }
}
