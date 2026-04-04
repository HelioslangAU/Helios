class ContentSettingsApplier {
  static apply(contentInstance, updatedSettings) {
    if (!contentInstance || !updatedSettings) return;

    // Extension enabled
    if (updatedSettings.extensionEnabled !== undefined) {
      contentInstance.extensionEnabled = updatedSettings.extensionEnabled;
    }

    // Activation key
    if (updatedSettings.activationKey !== undefined) {
      contentInstance.activationKey = updatedSettings.activationKey;
      contentInstance.isActivationKeyPressed = false;
    }

    // Auto-highlight
    if (updatedSettings.autoHighlight !== undefined) {
      contentInstance.autoHighlight = updatedSettings.autoHighlight;
      if (contentInstance.pageProcessor) {
        contentInstance.pageProcessor.handleAutoHighlightUpdate(
          contentInstance.autoHighlight,
          contentInstance.extensionEnabled
        );
      }
    }

    // Popup theme
    if (updatedSettings.popupTheme !== undefined) {
      contentInstance.popupTheme = updatedSettings.popupTheme;
      if (contentInstance.popup) {
        contentInstance.popup.updateTheme(updatedSettings.popupTheme);
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.ContentSettingsApplier = ContentSettingsApplier;
}


