/**
 * Language Switch Coordinator
 * Coordinates all components during a language switch to ensure smooth transitions
 */

class LanguageSwitchCoordinator {
  constructor(dependencies) {
    this.languageRegistry = dependencies.languageRegistry;
    this.dictionaryManager = dependencies.dictionaryManager;
    this.pageProcessor = dependencies.pageProcessor;
    this.popup = dependencies.popup;
    this.vocabManager = dependencies.vocabManager;

    this.isSwitching = false;
    this.currentLanguage = null;
  }

  /**
   * Switch to a new language with proper cleanup and initialization
   * @param {string} newLanguageCode - The language code to switch to
   * @returns {Promise<boolean>} Success status
   */
  async switchLanguage(newLanguageCode) {
    if (this.isSwitching) {
      console.warn('Language switch already in progress');
      return false;
    }

    if (!newLanguageCode) {
      console.error('Language code is required');
      return false;
    }

    // Check if language is already active
    const currentLang = this.languageRegistry.getCurrentLanguage();
    if (currentLang === newLanguageCode) {
      console.log(`Language ${newLanguageCode} is already active`);
      return true;
    }

    try {
      this.isSwitching = true;
      console.log(`Starting language switch: ${currentLang} → ${newLanguageCode}`);

      // Show loading indicator
      this._showLoadingIndicator(newLanguageCode);

      // Step 1: Close any open popups
      this._closePopups();

      // Step 2: Clear current page highlights
      this._clearHighlights();

      // Step 3: Update language registry
      this.languageRegistry.setLanguage(newLanguageCode);
      this.currentLanguage = newLanguageCode;

      // Step 3.5: Update vocab manager language
      if (this.vocabManager) {
        this.vocabManager.setCurrentLanguage(newLanguageCode);
      }

      // Step 4: Load new dictionary (this is the heavy operation)
      // This will detect if it's a different language and load the new dictionary
      console.log(`📚 Loading dictionary for new language: ${newLanguageCode}`);
      await this.dictionaryManager.loadDictionary();
      console.log(`✅ Dictionary loaded for ${newLanguageCode}`);

      // Step 5: Reprocess the page with new language
      if (this.pageProcessor) {
        await this.pageProcessor.reprocessPage();
      }

      // Step 6: Update storage
      await this._saveLanguagePreference(newLanguageCode);

      console.log(`Language switch completed: ${newLanguageCode}`);

      // Hide loading indicator
      this._hideLoadingIndicator();

      // Show success notification
      this._showSuccessNotification(newLanguageCode);

      return true;
    } catch (error) {
      console.error('Error during language switch:', error);
      this._hideLoadingIndicator();
      this._showErrorNotification(error);
      return false;
    } finally {
      this.isSwitching = false;
    }
  }

  /**
   * Get current switching status
   * @returns {boolean}
   */
  isSwitchingLanguage() {
    return this.isSwitching;
  }

  /**
   * Close any open popups
   */
  _closePopups() {
    if (this.popup && typeof this.popup.closeAllCards === 'function') {
      this.popup.closeAllCards();
    }
  }

  /**
   * Clear all highlights on the page
   */
  _clearHighlights() {
    // Remove all highlight classes
    const highlightedElements = document.querySelectorAll(
      '.chinese-unknown-word, .language-unknown-word, .language-known-word'
    );
    highlightedElements.forEach(el => {
      el.classList.remove(
        'chinese-unknown-word',
        'language-unknown-word',
        'language-known-word'
      );
    });
  }

  /**
   * Save language preference to storage
   */
  async _saveLanguagePreference(languageCode) {
    try {
      await chrome.storage.local.set({ targetLanguage: languageCode });
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  }

  /**
   * Show loading indicator
   */
  _showLoadingIndicator(languageCode) {
    const languages = {
      zh: 'Chinese',
      ja: 'Japanese',
      en: 'English',
      es: 'Spanish',
      fr: 'French'
    };

    const languageName = languages[languageCode] || languageCode;

    // Create loading overlay with Helios orange theme
    const overlay = document.createElement('div');
    overlay.id = 'helios-language-switch-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b47 0%, #ff8f47 50%, #ffb347 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(255, 107, 71, 0.5), 0 0 20px rgba(255, 107, 71, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease;
      backdrop-filter: blur(10px);
    `;
    overlay.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span>Switching to ${languageName}...</span>
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(overlay);
  }

  /**
   * Hide loading indicator
   */
  _hideLoadingIndicator() {
    const overlay = document.getElementById('helios-language-switch-overlay');
    if (overlay) {
      overlay.style.animation = 'slideOut 0.3s ease';
      overlay.style.cssText += 'animation: slideOut 0.3s ease;';

      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);

      setTimeout(() => overlay.remove(), 300);
    }
  }

  /**
   * Show success notification
   */
  _showSuccessNotification(languageCode) {
    const languages = {
      zh: 'Chinese',
      ja: 'Japanese',
      en: 'English',
      es: 'Spanish',
      fr: 'French'
    };

    const languageName = languages[languageCode] || languageCode;

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b47 0%, #ff8f47 50%, #ffb347 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(255, 107, 71, 0.5), 0 0 20px rgba(255, 107, 71, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideIn 0.3s ease;
      backdrop-filter: blur(10px);
    `;
    notification.textContent = `✓ Switched to ${languageName}`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  /**
   * Show error notification
   */
  _showErrorNotification(error) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideIn 0.3s ease;
      backdrop-filter: blur(10px);
    `;
    notification.textContent = `✗ Error switching language: ${error.message}`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Export
if (typeof window !== 'undefined') {
  window.LanguageSwitchCoordinator = LanguageSwitchCoordinator;
}
