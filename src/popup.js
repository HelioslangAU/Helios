class PopupManager {
  constructor({ highlightManager, dictionaryManager, vocabManager, frequencyManager }) {
    this.highlightManager = highlightManager;
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.frequencyManager = frequencyManager;
    this.popup = null;
    this.isMouseOverPopup = false;
    this.isMouseOverHighlight = false;
    this.hideTimeout = null;
  }

  showDictionaryPopup(x, y, character) {
    this.hidePopup();

    const popup = document.createElement('div');
    popup.className = 'chinese-lang-extension-popup';
    popup.innerHTML = this.createPopupContent(character);

    // Default position (fallback)
    let posX = x, posY = y;

    // If there is a highlight, position popup exactly below it
    if (this.highlightManager.currentHighlight) {
      const rect = this.highlightManager.currentHighlight.getBoundingClientRect();
      posX = rect.left; // No scrollX for fixed
      posY = rect.bottom; // No scrollY for fixed
    }

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;
    popup.style.position = 'fixed';
    popup.style.zIndex = '2147483647';

    document.body.appendChild(popup);
    // --- Check if popup goes offscreen, and reposition if needed ---
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.bottom > window.innerHeight) {
      // Place above the highlight instead
      let newY = posY;
      if (this.highlightManager.currentHighlight) {
        const rect = this.highlightManager.currentHighlight.getBoundingClientRect();
        newY = rect.top - popupRect.height;
      } else {
        newY = posY - popupRect.height;
      }
      // Prevent going off the top
      if (newY < 0) newY = 0;
      popup.style.top = `${newY}px`;
    }

    this.popup = popup;
    this.setupPopupEventListeners(character);
    this.setupPopupMouseEvents();
  }

  setupPopupMouseEvents() {
    if (!this.popup) return;

    this.popup.addEventListener('mouseenter', () => {
      this.isMouseOverPopup = true;
      clearTimeout(this.hideTimeout);
    });

    this.popup.addEventListener('mouseleave', () => {
      this.isMouseOverPopup = false;
      this.scheduleHidePopup();
    });
  }

  scheduleHidePopup() {
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isMouseOverPopup && !this.isMouseOverHighlight) {
        this.hidePopup();
        this.highlightManager.removeLookupHighlight();
      }
    }, 50); // 50ms grace period
  }

  createPopupContent(character) {
    const matches = this.dictionaryManager.dictionary[character] || [];
    const isKnown = this.vocabManager.isWordKnown(character);
    let frequency = null;
    if (this.frequencyManager) {
      frequency = this.frequencyManager.getFrequency(character);
    }

    if (matches.length === 0) {
      return `
        <div class="popup-content">
          <div class="character highlight">${character}</div>
          <div class="definition">Character not found in dictionary</div>
          <div class="popup-buttons">
            <button class="close-btn">Close</button>
          </div>
        </div>
      `;
    }

    const definitionsHtml = matches.map((def, idx) => {
      const toneClass = `tone-${def.tone}`;
      const variants = def.traditional !== def.simplified
        ? `<div class="variants">Traditional: ${def.traditional} | Simplified: ${def.simplified}</div>`
        : '';
      const defs = def.definition.split(';').map(d => d.trim()).filter(Boolean);
      const bullets = defs.length > 1
        ? `<ul class="definition-list">${defs.map(d => `<li>${d}</li>`).join('')}</ul>`
        : `<div class="definition">${defs[0]}</div>`;

      return `
        <div class="definition-block">
          <div class="pinyin">
            <span class="pinyin-text">${def.pinyin}</span>
          </div>
          ${variants}${bullets}
        </div>
      `;
    }).join('');

    return `
      <div class="popup-content">
        <div class="character highlight">${character}</div>
        ${frequency ? `<div class="frequency">Frequency: ${frequency}</div>` : ''}
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="${isKnown ? 'mark-unknown-btn' : 'mark-known-btn'}">
            ${isKnown ? 'Mark Unknown' : 'Mark Known'}
          </button>
          <button class="close-btn">Close</button>
        </div>
      </div>
    `;
  }

  setupPopupEventListeners(character) {
    const addVocabBtn = this.popup.querySelector('.add-vocab-btn:not([disabled])');
    const markKnownBtn = this.popup.querySelector('.mark-known-btn');
    const markUnknownBtn = this.popup.querySelector('.mark-unknown-btn');
    const closeBtn = this.popup.querySelector('.close-btn');

    addVocabBtn?.addEventListener('click', () => this.addToVocab(character));
    if (markKnownBtn) {
      
      markKnownBtn.addEventListener('click', async () => {
        updateKnownWordsCounter();
        await this.vocabManager.markWordAsKnown(character);
        if (window.pageProcessor) window.pageProcessor.updateWordStyling(character, true);
        this.hidePopup();
      });
    }
    if (markUnknownBtn) {
      markUnknownBtn.addEventListener('click', async () => {
        updateKnownWordsCounter();
        await this.vocabManager.markWordAsUnknown(character);
        if (window.pageProcessor) window.pageProcessor.updateWordStyling(character, false);
        // Re-highlight the word if possible
        if (window.highlightManager) {
          const el = document.querySelector(`span[data-word="${character}"]`);
          if (el) {
            window.highlightManager.removeLookupHighlight();
            el.classList.add('lookup-highlight');
            window.highlightManager.currentHighlight = el;
          }
        }
        this.hidePopup();
      });
    }
    closeBtn?.addEventListener('click', () => this.hidePopup());
  }

  async saveVocabList() {
    try {
      localStorage.setItem('chineseExtensionVocabList', JSON.stringify(this.vocabList));
    } catch (error) {
      console.warn('Could not save vocab list:', error);
    }
  }

  async loadVocabList() {
    try {
      const stored = localStorage.getItem('chineseExtensionVocabList');
      if (stored) {
        this.vocabList = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Could not load vocab list:', error);
    }
  }

  updatePopupButton(text, disabled) {
    const addBtn = this.popup?.querySelector('.add-vocab-btn');
    if (addBtn) {
      addBtn.textContent = text;
      addBtn.disabled = disabled;
    }
  }

  hidePopup(event) {
    if (this.popup && event && this.popup.contains(event.target)) {
      return;
    }
    if (this.popup && (!event || !this.popup.contains(event.target))) {
      this.popup.remove();
      this.popup = null;
      this.isMouseOverPopup = false;
    }
  }
}
