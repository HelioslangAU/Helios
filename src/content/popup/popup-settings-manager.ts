/** User-facing popup settings loaded from chrome.storage (all optional until loaded). */
export interface PopupSettings {
  popupTheme?: string;
  popupFontSize?: string;
  showFrequency?: boolean;
  persistentPopup?: boolean;
  autoCloseDelay?: number;
}

/**
 * PopupSettingsManager - Handles applying user settings to popups
 * Controls theme, font size, frequency display, persistence, and auto-close
 */
export class PopupSettingsManager {
  settings: PopupSettings;
  autoCloseTimer: ReturnType<typeof setTimeout> | null;
  persistentMode: boolean | undefined;

  constructor() {
    this.settings = {};
    this.autoCloseTimer = null;
    this.persistentMode = false;
    this.loadSettings();
    this.setupMessageListener();
  }

  async loadSettings(): Promise<void> {
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
          persistentPopup: result.persistentPopup !== false, // Default to ON
          autoCloseDelay: result.autoCloseDelay || 0
        };
      }
    } catch (error) {
      console.error('Error loading popup settings:', error);
    }
  }

  setupMessageListener(): void {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
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

  applySettingsToPopup(popup: HTMLElement | null): void {
    if (!popup) return;

    this.applyTheme(popup);
    this.applyFontSize(popup);
    this.applyFrequencyDisplay(popup);
    this.applyPersistence(popup);
    this.applyAutoClose(popup);
  }

  applyTheme(popup: HTMLElement | null): void {
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

  applyFontSize(popup: HTMLElement | null): void {
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

  applyFrequencyDisplay(popup: HTMLElement | null): void {
    if (!popup) return;

    const frequencyElements = popup.querySelectorAll<HTMLElement>('.frequency');
    frequencyElements.forEach(el => {
      el.style.display = this.settings.showFrequency ? 'inline-block' : 'none';
    });
  }

  applyPersistence(popup: HTMLElement | null): void {
    if (!popup) return;

    this.persistentMode = this.settings.persistentPopup;

    if (this.persistentMode) {
      popup.classList.add('persistent-mode');
    } else {
      popup.classList.remove('persistent-mode');
    }
  }

  applyAutoClose(popup: HTMLElement | null): void {
    if (!popup) return;

    this.clearAutoCloseTimer();

    const autoCloseDelay = this.settings.autoCloseDelay;
    if (autoCloseDelay !== undefined && autoCloseDelay > 0) {
      popup.classList.add('auto-closing');
      popup.style.setProperty('--auto-close-duration', `${autoCloseDelay}s`);

      this.autoCloseTimer = setTimeout(() => {
        if (popup && popup.parentNode) {
          popup.remove();
        }
      }, autoCloseDelay * 1000);
    } else {
      popup.classList.remove('auto-closing');
    }
  }

  clearAutoCloseTimer(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }

  // Apply settings to existing popup
  applyThemeToExistingPopup(): void {
    const popup = document.querySelector<HTMLElement>('.chinese-lang-extension-popup');
    this.applyTheme(popup);
  }

  applyFontSizeToExistingPopup(): void {
    const popup = document.querySelector<HTMLElement>('.chinese-lang-extension-popup');
    this.applyFontSize(popup);
  }

  applyFrequencyDisplayToExistingPopup(): void {
    const popup = document.querySelector<HTMLElement>('.chinese-lang-extension-popup');
    this.applyFrequencyDisplay(popup);
  }

  applyPersistenceToExistingPopup(): void {
    const popup = document.querySelector<HTMLElement>('.chinese-lang-extension-popup');
    this.applyPersistence(popup);
  }

  applyAutoCloseToExistingPopup(): void {
    const popup = document.querySelector<HTMLElement>('.chinese-lang-extension-popup');
    this.applyAutoClose(popup);
  }

  shouldPreventAutoHide(): boolean | undefined {
    return this.persistentMode;
  }

  shouldPreventKeyUpHide(): boolean | undefined {
    return this.persistentMode;
  }

  onPopupCreated(popup: HTMLElement): void {
    this.applySettingsToPopup(popup);
  }

  onPopupDestroyed(): void {
    this.clearAutoCloseTimer();
  }
}

// Export for use by other modules
if (typeof window !== 'undefined') {
  window.PopupSettingsManager = PopupSettingsManager;
}
