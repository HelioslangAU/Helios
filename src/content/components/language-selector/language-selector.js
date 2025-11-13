/**
 * Reusable Language Selector Component
 * Displays available languages with flags and handles selection
 */

class LanguageSelector {
  constructor(options = {}) {
    this.onLanguageSelected = options.onLanguageSelected || (() => {});
    this.selectedLanguage = options.selectedLanguage || null;
    this.containerClass = options.containerClass || 'language-selector';
    this.layout = options.layout || 'grid'; // 'grid' or 'dropdown'
  }

  /**
   * Get available languages with metadata
   */
  getLanguages() {
    return [
      {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        flag: '🇨🇳',
        description: 'Learn Mandarin Chinese with character-by-character analysis'
      },
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        description: 'Improve your English vocabulary and comprehension'
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸',
        description: 'Learn Spanish with contextual definitions and examples'
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        flag: '🇫🇷',
        description: 'Master French vocabulary with detailed translations'
      }
    ];
  }

  /**
   * Render the language selector
   * @returns {HTMLElement} The language selector element
   */
  render() {
    const container = document.createElement('div');
    container.className = this.containerClass;

    if (this.layout === 'grid') {
      container.innerHTML = this._renderGrid();
    } else {
      container.innerHTML = this._renderDropdown();
    }

    this._attachEventListeners(container);
    return container;
  }

  /**
   * Render grid layout
   */
  _renderGrid() {
    const languages = this.getLanguages();
    return `
      <div class="language-grid">
        ${languages.map(lang => `
          <div class="language-card ${this.selectedLanguage === lang.code ? 'selected' : ''}"
               data-language="${lang.code}">
            <div class="language-flag">${lang.flag}</div>
            <div class="language-info">
              <div class="language-name">${lang.name}</div>
              <div class="language-native">${lang.nativeName}</div>
            </div>
            <div class="language-description">${lang.description}</div>
            <div class="language-select-indicator">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2"/>
                <path d="M7 12l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render dropdown layout
   */
  _renderDropdown() {
    const languages = this.getLanguages();
    return `
      <select class="language-dropdown">
        <option value="">Select a language...</option>
        ${languages.map(lang => `
          <option value="${lang.code}" ${this.selectedLanguage === lang.code ? 'selected' : ''}>
            ${lang.flag} ${lang.name} (${lang.nativeName})
          </option>
        `).join('')}
      </select>
    `;
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners(container) {
    if (this.layout === 'grid') {
      const cards = container.querySelectorAll('.language-card');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          const languageCode = card.dataset.language;
          this._handleSelection(languageCode, container);
        });
      });
    } else {
      const dropdown = container.querySelector('.language-dropdown');
      dropdown.addEventListener('change', (e) => {
        if (e.target.value) {
          this._handleSelection(e.target.value, container);
        }
      });
    }
  }

  /**
   * Handle language selection
   */
  _handleSelection(languageCode, container) {
    this.selectedLanguage = languageCode;

    // Update UI
    if (this.layout === 'grid') {
      container.querySelectorAll('.language-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.language === languageCode) {
          card.classList.add('selected');
        }
      });
    }

    // Call callback
    const language = this.getLanguages().find(l => l.code === languageCode);
    this.onLanguageSelected(languageCode, language);
  }

  /**
   * Get current selection
   */
  getSelectedLanguage() {
    return this.selectedLanguage;
  }

  /**
   * Set selection programmatically
   */
  setSelectedLanguage(languageCode) {
    this.selectedLanguage = languageCode;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.LanguageSelector = LanguageSelector;
}