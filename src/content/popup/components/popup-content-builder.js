/**
 * PopupContentBuilder - Creates HTML content for popups
 * Handles building different types of popup content
 */
class PopupContentBuilder {
  static createBasicContent(character, dictionaryData, vocabManager, frequencyManager, settings = {}) {
    const { matches, isKnown, isIgnored, frequency } = dictionaryData;

    if (matches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character-container">
            <div class="character highlight">${character}</div>
          </div>
          <div class="definition">Character not found in dictionary</div>
          ${this.createAnkiButton()}
        </div>
      `;
    }

    const pinyin = matches[0].pinyin;
    const definitionsHtml = this.createDefinitionsHtml(matches);
    const pronunciationBtn = this.createPronunciationButton(character, pinyin);
    const showFrequency = settings.showFrequency !== false;

    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight">${pinyin ? `<ruby>${character}<rt>${pinyin}</rt></ruby>` : character}</div>
          ${pronunciationBtn}
          ${frequency && showFrequency ? `<div class="frequency">Frequency: ${frequency}</div>` : ""}
        </div>
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          ${this.createMarkButton(isKnown, isIgnored)}
        </div>
        ${this.createAnkiButton()}
      </div>
    `;
  }

  static createCardContent(displayCharacter, card, isKnown, isIgnored, frequency, settings = {}) {
    const { pinyin, entries } = card;
    const definitionsHtml = this.createDefinitionsHtml(entries);
    const pronunciationBtn = this.createPronunciationButton(displayCharacter, pinyin);
    const showFrequency = settings.showFrequency !== false;

    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight">${pinyin ? `<ruby>${displayCharacter}<rt>${pinyin}</rt></ruby>` : displayCharacter}</div>
          ${pronunciationBtn}
          ${frequency && showFrequency ? `<div class="frequency">Frequency: ${frequency}</div>` : ""}
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

  static createCardContentInner(displayCharacter, card, isKnown, isIgnored, frequency, settings = {}) {
    const { pinyin, entries } = card;
    const definitionsHtml = this.createDefinitionsHtml(entries);
    const pronunciationBtn = this.createPronunciationButton(displayCharacter, pinyin, pinyin);
    const showFrequency = settings.showFrequency !== false;

    return `
      <div class="character-container">
        <div class="character highlight"><ruby>${displayCharacter}<rt>${pinyin}</rt></ruby></div>
        ${pronunciationBtn}
        ${frequency && showFrequency ? `<div class="frequency">Frequency: ${frequency}</div>` : ""}
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