/**
 * PopupContentBuilder - Creates HTML content for popups
 * Handles building different types of popup content
 */
class PopupContentBuilder {
  static getWordLengthClass(word) {
    // Remove HTML tags and get actual character count
    const cleanWord = word.replace(/<[^>]*>/g, '');
    const length = cleanWord.length;

    // Progressive sizing for long words to prevent overflow
    if (length > 18) return 'super-long-word'; // Extreme cases (progressivement, etc.)
    if (length > 15) return 'extra-long-word';
    if (length > 10) return 'very-long-word';
    if (length > 6) return 'long-word';
    return '';
  }

  static getLanguageClass(languageCode) {
    const languageMap = {
      'zh': 'lang-chinese',
      'en': 'lang-english',
      'fr': 'lang-french',
      'es': 'lang-spanish'
    };
    return languageMap[languageCode] || '';
  }

  static formatFrequency(frequency) {
    if (!frequency) return null;

    // Return with "FREQUENCY: " prefix and numeric value
    // Format with comma separators for readability
    return `FREQUENCY: ${frequency.toLocaleString()}`;
  }

  static createBasicContent(character, dictionaryData, vocabManager, frequencyManager, settings = {}, languageCode = null) {
    const { matches, isKnown, isIgnored, frequency } = dictionaryData;
    const lengthClass = this.getWordLengthClass(character);
    const languageClass = languageCode ? this.getLanguageClass(languageCode) : '';
    const combinedClasses = `${lengthClass} ${languageClass}`.trim();
    const formattedFrequency = this.formatFrequency(frequency);

    // Handle null/undefined matches from async dictionary
    const safeMatches = matches || [];
    if (safeMatches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character-container">
            <div class="character highlight ${combinedClasses}">${character}</div>
          </div>
          <div class="definition">Word not found in dictionary</div>
          ${this.createAnkiButton()}
        </div>
      `;
    }

    const pinyin = safeMatches[0].pinyin;
    const definitionsHtml = this.createDefinitionsHtml(safeMatches);
    const pronunciationBtn = this.createPronunciationButton(character, pinyin);
    const showFrequency = settings.showFrequency !== false;

    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight ${combinedClasses}">${pinyin ? `<ruby>${character}<rt>${pinyin}</rt></ruby>` : character}</div>
          ${pronunciationBtn}
          ${formattedFrequency && showFrequency ? `<div class="frequency">${formattedFrequency}</div>` : ""}
        </div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          ${this.createMarkButton(isKnown, isIgnored)}
        </div>
        ${this.createAnkiButton()}
      </div>
    `;
  }

  static createCardContent(displayCharacter, card, isKnown, isIgnored, frequency, settings = {}, languageCode = null) {
    const { pinyin: cardPinyin, entries } = card;
    // Use card's pinyin if available (may be empty string), otherwise fall back to first entry's pinyin
    // This ensures each card shows its own pinyin corresponding to its entries
    const pinyin = (cardPinyin !== undefined && cardPinyin !== null) ? cardPinyin : (entries && entries.length > 0 ? entries[0].pinyin : null);
    const lengthClass = this.getWordLengthClass(displayCharacter);
    const languageClass = languageCode ? this.getLanguageClass(languageCode) : '';
    const combinedClasses = `${lengthClass} ${languageClass}`.trim();
    const formattedFrequency = this.formatFrequency(frequency);
    const definitionsHtml = this.createDefinitionsHtml(entries);
    const pronunciationBtn = this.createPronunciationButton(displayCharacter, pinyin);
    const showFrequency = settings.showFrequency !== false;

    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight ${combinedClasses}">${pinyin ? `<ruby>${displayCharacter}<rt>${pinyin}</rt></ruby>` : displayCharacter}</div>
          ${pronunciationBtn}
          ${formattedFrequency && showFrequency ? `<div class="frequency">${formattedFrequency}</div>` : ""}
        </div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="${this.getMarkButtonClass(isKnown, isIgnored)}" data-card-id="${displayCharacter}-${pinyin}">
            ${this.getMarkButtonText(isKnown, isIgnored)}
          </button>
        </div>
        ${this.createAnkiButton()}
      </div>
    `;
  }

  static createCardContentInner(displayCharacter, card, isKnown, isIgnored, frequency, settings = {}, languageCode = null) {
    const { pinyin: cardPinyin, entries } = card;
    // Use card's pinyin if available (may be empty string), otherwise fall back to first entry's pinyin
    // This ensures each card shows its own pinyin corresponding to its entries
    const pinyin = (cardPinyin !== undefined && cardPinyin !== null) ? cardPinyin : (entries && entries.length > 0 ? entries[0].pinyin : null);
    const lengthClass = this.getWordLengthClass(displayCharacter);
    const languageClass = languageCode ? this.getLanguageClass(languageCode) : '';
    const combinedClasses = `${lengthClass} ${languageClass}`.trim();
    const formattedFrequency = this.formatFrequency(frequency);
    const definitionsHtml = this.createDefinitionsHtml(entries);
    const pronunciationBtn = this.createPronunciationButton(displayCharacter, pinyin, pinyin);
    const showFrequency = settings.showFrequency !== false;

    return `
      <div class="character-container">
        <div class="character highlight ${combinedClasses}">${pinyin ? `<ruby>${displayCharacter}<rt>${pinyin}</rt></ruby>` : displayCharacter}</div>
        ${pronunciationBtn}
        ${formattedFrequency && showFrequency ? `<div class="frequency">${formattedFrequency}</div>` : ""}
      </div>
      <div class="definitions-scroll">${definitionsHtml}</div>
      <div class="popup-buttons">
        <button class="${this.getMarkButtonClass(isKnown, isIgnored)}" data-card-id="${displayCharacter}-${pinyin}">
          ${this.getMarkButtonText(isKnown, isIgnored)}
        </button>
      </div>
      ${this.createAnkiButton()}
    `;
  }

  static createDefinitionsHtml(entries) {
    return entries
      .map((entry) => {
        const defs = entry.definition.split(";").map(d => d.trim()).filter(Boolean);
        const bullets = defs.length > 1
          ? `<ul class="definition-list">${defs.map(d => `<li>${d}</li>`).join("")}</ul>`
          : `<div class="definition">${defs[0]}</div>`;
        return `<div class="definition-block">${bullets}</div>`;
      })
      .join("");
  }

  static createPronunciationButton(character, pinyin, ttsText = null) {
    return `
      <button
        class="pronunciation-btn"
        title="Play pronunciation${ttsText ? ` (${ttsText})` : ""}"
        data-word="${character}"
        data-pinyin="${pinyin}"
        ${ttsText ? `data-tts-text="${ttsText}"` : ""}
      >
        <span class="icon">🔊</span>
      </button>
    `;
  }

  static createAnkiButton() {
    return `<button class="anki-btn anki-available" title="Add to Anki">A</button>`;
  }

  static createNavigationDots(cards, currentIndex) {
    if (cards.length <= 1) return "";

    const dots = cards
      .map((_, i) =>
        `<span class="nav-dot ${i === currentIndex ? "active" : ""}" data-index="${i}"></span>`
      )
      .join("");

    return `
      <div class="navigation-dots">
        ${dots}
        <span class="card-counter">${currentIndex + 1} of ${cards.length}</span>
      </div>
    `;
  }

  static createMarkButton(isKnown, isIgnored) {
    return `<button class="${this.getMarkButtonClass(isKnown, isIgnored)}">${this.getMarkButtonText(isKnown, isIgnored)}</button>`;
  }

  static getMarkButtonClass(isKnown, isIgnored) {
    if (isKnown) {
      return "mark-ignore-btn";
    } else if (isIgnored) {
      return "mark-unknown-btn";
    } else {
      return "mark-known-btn";
    }
  }

  static getMarkButtonText(isKnown, isIgnored) {
    if (isKnown) {
      return "Mark Ignore";
    } else if (isIgnored) {
      return "Mark Unknown";
    } else {
      return "Mark Known";
    }
  }
}