/**
 * PopupSettingsManager - Handles applying user settings to popups
 * Controls theme, font size, frequency display, persistence, and auto-close
 */
class PopupSettingsManager {
  constructor() {
    this.settings = {};
    this.autoCloseTimer = null;
    this.persistentMode = false;
    this.loadSettings();
    this.setupMessageListener();
  }

  async loadSettings() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          'popupTheme',
          'popupFontSize',
          'showFrequency',
          'persistentPopup',
          'autoCloseDelay'
        ]);

        this.settings = {
          popupTheme: result.popupTheme || 'dark',
          popupFontSize: result.popupFontSize || 'medium',
          showFrequency: result.showFrequency !== false,
          persistentPopup: result.persistentPopup !== false,
          autoCloseDelay: result.autoCloseDelay || 0
        };

        console.log('🎨 Popup settings loaded:', this.settings);
      }
    } catch (error) {
      console.error('Error loading popup settings:', error);
    }
  }

  setupMessageListener() {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
          case 'updatePopupTheme':
            this.settings.popupTheme = message.theme;
            this.applyThemeToExistingPopup();
            break;
          case 'updatePopupFontSize':
            this.settings.popupFontSize = message.fontSize;
            this.applyFontSizeToExistingPopup();
            break;
          case 'updateShowFrequency':
            this.settings.showFrequency = message.enabled;
            this.applyFrequencyDisplayToExistingPopup();
            break;
          case 'updatePersistentPopup':
            this.settings.persistentPopup = message.enabled;
            this.applyPersistenceToExistingPopup();
            break;
          case 'updateAutoCloseDelay':
            this.settings.autoCloseDelay = message.delay;
            this.applyAutoCloseToExistingPopup();
            break;
        }
      });
    }
  }

  applySettingsToPopup(popup) {
    if (!popup) return;

    this.applyTheme(popup);
    this.applyFontSize(popup);
    this.applyFrequencyDisplay(popup);
    this.applyPersistence(popup);
    this.applyAutoClose(popup);
  }

  applyTheme(popup) {
    if (!popup) return;

    popup.classList.remove('theme-dark', 'theme-light', 'theme-auto');

    if (this.settings.popupTheme === 'light') {
      popup.classList.add('theme-light');
    } else if (this.settings.popupTheme === 'auto') {
      popup.classList.add('theme-auto');
      // Apply system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      popup.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    } else {
      popup.classList.add('theme-dark');
    }
  }

  applyFontSize(popup) {
    if (!popup) return;

    // Size class is already applied during popup creation to prevent resizing
    // Only update if the current class doesn't match settings
    const expectedSizeClass = `size-${this.settings.popupFontSize}`;
    if (!popup.classList.contains(expectedSizeClass)) {
      popup.classList.remove('size-small', 'size-medium', 'size-large', 'size-extra-large');
      popup.classList.add(expectedSizeClass);
    }

    // Remove any inline styles that might cause resizing
    popup.style.width = '';
    popup.style.height = '';
  }

  applyFrequencyDisplay(popup) {
    if (!popup) return;

    const frequencyElements = popup.querySelectorAll('.frequency');
    frequencyElements.forEach(el => {
      el.style.display = this.settings.showFrequency ? 'inline-block' : 'none';
    });
  }

  applyPersistence(popup) {
    if (!popup) return;

    this.persistentMode = this.settings.persistentPopup;

    if (this.persistentMode) {
      popup.classList.add('persistent-mode');
    } else {
      popup.classList.remove('persistent-mode');
    }
  }

  applyAutoClose(popup) {
    if (!popup) return;

    this.clearAutoCloseTimer();

    if (this.settings.autoCloseDelay > 0) {
      popup.classList.add('auto-closing');
      popup.style.setProperty('--auto-close-duration', `${this.settings.autoCloseDelay}s`);

      this.autoCloseTimer = setTimeout(() => {
        if (popup && popup.parentNode) {
          popup.remove();
        }
      }, this.settings.autoCloseDelay * 1000);
    } else {
      popup.classList.remove('auto-closing');
    }
  }

  clearAutoCloseTimer() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }

  // Apply settings to existing popup
  applyThemeToExistingPopup() {
    const popup = document.querySelector('.chinese-lang-extension-popup');
    this.applyTheme(popup);
  }

  applyFontSizeToExistingPopup() {
    const popup = document.querySelector('.chinese-lang-extension-popup');
    this.applyFontSize(popup);
  }

  applyFrequencyDisplayToExistingPopup() {
    const popup = document.querySelector('.chinese-lang-extension-popup');
    this.applyFrequencyDisplay(popup);
  }

  applyPersistenceToExistingPopup() {
    const popup = document.querySelector('.chinese-lang-extension-popup');
    this.applyPersistence(popup);
  }

  applyAutoCloseToExistingPopup() {
    const popup = document.querySelector('.chinese-lang-extension-popup');
    this.applyAutoClose(popup);
  }

  shouldPreventAutoHide() {
    return this.persistentMode;
  }

  shouldPreventKeyUpHide() {
    return this.persistentMode;
  }

  onPopupCreated(popup) {
    this.applySettingsToPopup(popup);
  }

  onPopupDestroyed() {
    this.clearAutoCloseTimer();
  }
}

// Export for use by other modules
if (typeof window !== 'undefined') {
  window.PopupSettingsManager = PopupSettingsManager;
}