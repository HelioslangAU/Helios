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
      'ja': 'lang-japanese',
      'en': 'lang-english',
      'fr': 'lang-french',
      'es': 'lang-spanish'
    };
    return languageMap[languageCode] || '';
  }

  /**
   * Resolve the pronunciation/reading string from a dictionary entry.
   * Chinese stores it as `pinyin`; Japanese stores it as `pronunciation`.
   * Fall through all three field names so any language works.
   * @param {Object} entry
   * @returns {string|null}
   */
  static getEntryPronunciation(entry) {
    if (!entry) return null;
    return entry.pinyin || entry.pronunciation || entry.reading || null;
  }

  static formatFrequency(frequency) {
    if (!frequency) return null;

    // Return with "FREQUENCY: " prefix and numeric value
    // Format with comma separators for readability
    return `FREQUENCY: ${frequency.toLocaleString()}`;
  }

  /**
   * Extract gender from grammar field
   * @param {string} grammar - Grammar field content
   * @returns {string|null} - 'masc', 'fem', 'neut', or null
   */
  static extractGender(grammar) {
    if (!grammar || typeof grammar !== 'string') return null;
    
    const grammarLower = grammar.toLowerCase().trim();
    
    // Check for masculine patterns
    if (/\b(m|masc|masculine)\b/.test(grammarLower)) {
      return 'masc';
    }
    
    // Check for feminine patterns
    if (/\b(f|fem|feminine)\b/.test(grammarLower)) {
      return 'fem';
    }
    
    // Check for neutral patterns
    if (/\b(n|neut|neutral)\b/.test(grammarLower)) {
      return 'neut';
    }
    
    return null;
  }

  /**
   * Check if language uses gender
   * @param {string} languageCode - Language code
   * @returns {boolean} - True if language uses gender
   */
  static languageUsesGender(languageCode) {
    const genderedLanguages = ['fr', 'es', 'it', 'pt', 'de', 'ru'];
    return genderedLanguages.includes(languageCode);
  }

  /**
   * Check if entry is a non-lemma word based on grammar field
   * @param {Object} entry - Dictionary entry
   * @returns {boolean} - True if entry is non-lemma
   */
  static isNonLemma(entry) {
    if (!entry || !entry.grammar || typeof entry.grammar !== 'string') return false;
    
    const grammarLower = entry.grammar.toLowerCase().trim();
    return grammarLower === 'non-lemma' || grammarLower.includes('non-lemma');
  }

  /**
   * Create info boxes for extra information
   * @param {Object} entry - Dictionary entry
   * @param {number|null} frequency - Word frequency
   * @param {Object} settings - Settings object
   * @param {string|null} languageCode - Language code
   * @returns {string} - HTML string for info boxes
   */
  static createInfoBoxes(entry, frequency, settings = {}, languageCode = null) {
    if (!entry) return '';
    
    const boxes = [];
    const showFrequency = settings.showFrequency !== false;
    
    // Frequency box
    if (frequency && showFrequency) {
      const formattedFreq = frequency.toLocaleString();
      boxes.push(`<span class="info-box info-box-frequency" title="frequency">${formattedFreq}</span>`);
    }
    
    // Part of Speech box
    if (entry.partOfSpeech && entry.partOfSpeech.trim()) {
      const pos = entry.partOfSpeech.trim();
      // Expand common abbreviations for tooltip
      const posExpansions = {
        'n': 'noun',
        'v': 'verb',
        'adj': 'adjective',
        'adv': 'adverb',
        'pron': 'pronoun',
        'prep': 'preposition',
        'conj': 'conjunction',
        'interj': 'interjection',
        'art': 'article',
        'num': 'numeral'
      };
      const posTooltip = posExpansions[pos.toLowerCase()] || pos;
      boxes.push(`<span class="info-box info-box-pos" title="${posTooltip}">${pos}</span>`);
    }
    
    // Gender box (only for gendered languages)
    if (languageCode && this.languageUsesGender(languageCode)) {
      const gender = this.extractGender(entry.grammar);
      if (gender) {
        const genderLabel = gender === 'masc' ? 'masculine' : gender === 'fem' ? 'feminine' : 'neutral';
        const genderSymbol = gender === 'masc' ? 'm' : gender === 'fem' ? 'f' : 'n';
        boxes.push(`<span class="info-box info-box-gender-${gender}" title="${genderLabel}">${genderSymbol}</span>`);
      }
    }
    
    // Lemma box (only for non-lemma entries as indicated in grammar)
    if (this.isNonLemma(entry) && entry.variations && Array.isArray(entry.variations) && entry.variations.length > 0) {
      const lemma = entry.variations[0];
      if (lemma) {
        boxes.push(`<span class="info-box info-box-lemma" title="lemma">${lemma}</span>`);
      }
    }
    
    // Return container with boxes if any exist
    if (boxes.length === 0) return '';
    
    return `<div class="info-boxes-container">${boxes.join('')}</div>`;
  }

  static createBasicContent(character, dictionaryData, vocabManager, frequencyManager, settings = {}, languageCode = null, dictionary = null) {
    const { matches, isKnown, isIgnored, isLearning, frequency } = dictionaryData;
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

    const pinyin = this.getEntryPronunciation(safeMatches[0]);
    const firstEntry = safeMatches[0];
    const definitionsHtml = this.createDefinitionsHtml(safeMatches, dictionary);
    const pronunciationBtn = this.createPronunciationButton(character, pinyin);
    const infoBoxes = this.createInfoBoxes(firstEntry, frequency, settings, languageCode);

    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight ${combinedClasses}">${pinyin ? `<ruby>${character}<rt>${pinyin}</rt></ruby>` : character}</div>
          ${pronunciationBtn}
        </div>
        ${infoBoxes}
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          ${this.createMarkButton(isKnown, isIgnored, isLearning)}
        </div>
        ${this.createAnkiButton()}
      </div>
    `;
  }

  static createCardContent(displayCharacter, card, isKnown, isIgnored, isLearning, frequency, settings = {}, languageCode = null, dictionary = null) {
    const { pinyin: cardPinyin, entries } = card;
    // Use card's pinyin if available (may be empty string), otherwise fall back to first entry's pronunciation
    // Supports Chinese (pinyin), Japanese (pronunciation/reading), and other languages
    const pinyin = (cardPinyin !== undefined && cardPinyin !== null) ? cardPinyin : (entries && entries.length > 0 ? this.getEntryPronunciation(entries[0]) : null);
    const firstEntry = entries && entries.length > 0 ? entries[0] : null;
    const lengthClass = this.getWordLengthClass(displayCharacter);
    const languageClass = languageCode ? this.getLanguageClass(languageCode) : '';
    const combinedClasses = `${lengthClass} ${languageClass}`.trim();
    const definitionsHtml = this.createDefinitionsHtml(entries, dictionary);
    const pronunciationBtn = this.createPronunciationButton(displayCharacter, pinyin);
    const infoBoxes = this.createInfoBoxes(firstEntry, frequency, settings, languageCode);

    return `
      <div class="popup-content">
        <div class="character-container">
          <div class="character highlight ${combinedClasses}">${pinyin ? `<ruby>${displayCharacter}<rt>${pinyin}</rt></ruby>` : displayCharacter}</div>
          ${pronunciationBtn}
        </div>
        ${infoBoxes}
        <div class="definitions-scroll">${definitionsHtml}</div>
        <div class="popup-buttons">
          <button class="${this.getMarkButtonClass(isKnown, isIgnored, isLearning)}" data-card-id="${displayCharacter}-${pinyin}">
            ${this.getMarkButtonText(isKnown, isIgnored, isLearning)}
          </button>
        </div>
        ${this.createAnkiButton()}
      </div>
    `;
  }

  static createCardContentInner(displayCharacter, card, isKnown, isIgnored, isLearning, frequency, settings = {}, languageCode = null, dictionary = null) {
    const { pinyin: cardPinyin, entries } = card;
    // Use card's pinyin if available (may be empty string), otherwise fall back to first entry's pronunciation
    // Supports Chinese (pinyin), Japanese (pronunciation/reading), and other languages
    const pinyin = (cardPinyin !== undefined && cardPinyin !== null) ? cardPinyin : (entries && entries.length > 0 ? this.getEntryPronunciation(entries[0]) : null);
    const firstEntry = entries && entries.length > 0 ? entries[0] : null;
    const lengthClass = this.getWordLengthClass(displayCharacter);
    const languageClass = languageCode ? this.getLanguageClass(languageCode) : '';
    const combinedClasses = `${lengthClass} ${languageClass}`.trim();
    const definitionsHtml = this.createDefinitionsHtml(entries, dictionary);
    const pronunciationBtn = this.createPronunciationButton(displayCharacter, pinyin, pinyin);
    const infoBoxes = this.createInfoBoxes(firstEntry, frequency, settings, languageCode);

    return `
      <div class="character-container">
        <div class="character highlight ${combinedClasses}">${pinyin ? `<ruby>${displayCharacter}<rt>${pinyin}</rt></ruby>` : displayCharacter}</div>
        ${pronunciationBtn}
      </div>
      ${infoBoxes}
      <div class="definitions-scroll">${definitionsHtml}</div>
      <div class="popup-buttons">
        <button class="${this.getMarkButtonClass(isKnown, isIgnored, isLearning)}" data-card-id="${displayCharacter}-${pinyin}">
          ${this.getMarkButtonText(isKnown, isIgnored, isLearning)}
        </button>
      </div>
      ${this.createAnkiButton()}
    `;
  }

  static createDefinitionsHtml(entries, dictionary = null) {
    const processedEntries = [];
    
    for (const entry of entries) {
      // Check if this is a non-lemma entry with morphology and variations
      // Check for non-empty morphology string and variations array
      const hasMorphology = entry.morphology && typeof entry.morphology === 'string' && entry.morphology.trim().length > 0;
      const hasVariations = entry.variations && Array.isArray(entry.variations) && entry.variations.length > 0;
      
      if (hasMorphology && hasVariations && dictionary) {
        // Get the base form (lemma) first
        const baseForm = entry.variations[0];
        
        // First, add the base word (lemma) definitions
        // Use stored baseFormDefinitions if available (avoids dictionary lookup)
        if (entry.baseFormDefinitions && Array.isArray(entry.baseFormDefinitions) && entry.baseFormDefinitions.length > 0) {
          // Use the pre-stored base form definitions
          for (const baseEntry of entry.baseFormDefinitions) {
            if (baseEntry.definition) {
              const baseDefs = baseEntry.definition.split(";").map(d => d.trim()).filter(Boolean);
              if (baseDefs.length > 0) {
                const baseBullets = baseDefs.length > 1
                  ? `<ul class="definition-list">${baseDefs.map(d => `<li>${d}</li>`).join("")}</ul>`
                  : `<div class="definition">${baseDefs[0]}</div>`;
                processedEntries.push(`<div class="definition-block">${baseBullets}</div>`);
              }
            }
          }
        } else if (baseForm && dictionary) {
          // Fallback to dictionary lookup if baseFormDefinitions not available
          const normalizedBaseForm = baseForm.toLowerCase().trim();
          let baseFormEntries = dictionary[normalizedBaseForm];
          
          // If normalized lookup fails, try the base form as-is (for case-sensitive languages)
          if (!baseFormEntries && baseForm !== normalizedBaseForm) {
            baseFormEntries = dictionary[baseForm];
          }
          
          // Also try with trimmed base form in case there are whitespace issues
          if (!baseFormEntries) {
            const trimmedBaseForm = baseForm.trim();
            if (trimmedBaseForm !== baseForm) {
              baseFormEntries = dictionary[trimmedBaseForm.toLowerCase()] || dictionary[trimmedBaseForm];
            }
          }
          
          if (baseFormEntries && Array.isArray(baseFormEntries) && baseFormEntries.length > 0) {
            // Add all definitions from the base form
            for (const baseEntry of baseFormEntries) {
              if (baseEntry.definition) {
                const baseDefs = baseEntry.definition.split(";").map(d => d.trim()).filter(Boolean);
                if (baseDefs.length > 0) {
                  const baseBullets = baseDefs.length > 1
                    ? `<ul class="definition-list">${baseDefs.map(d => `<li>${d}</li>`).join("")}</ul>`
                    : `<div class="definition">${baseDefs[0]}</div>`;
                  processedEntries.push(`<div class="definition-block">${baseBullets}</div>`);
                }
              }
            }
          }
        }
        
        // Then, add the morphology as its own entry with "of [baseForm]"
        const morphologyDefs = entry.morphology.split(";").map(d => d.trim()).filter(Boolean);
        if (morphologyDefs.length > 0) {
          // Append "of [baseForm]" to each morphology definition
          const morphologyWithBase = baseForm 
            ? morphologyDefs.map(d => `${d} of ${baseForm}`)
            : morphologyDefs;
          
          const morphologyBullets = morphologyWithBase.length > 1
            ? `<ul class="definition-list">${morphologyWithBase.map(d => `<li>${d}</li>`).join("")}</ul>`
            : `<div class="definition">${morphologyWithBase[0]}</div>`;
          processedEntries.push(`<div class="definition-block">${morphologyBullets}</div>`);
        }
        
        // If the entry also has its own definition (not empty), show it too
        if (entry.definition && entry.definition.trim().length > 0) {
          const defs = entry.definition.split(";").map(d => d.trim()).filter(Boolean);
          if (defs.length > 0) {
            const bullets = defs.length > 1
              ? `<ul class="definition-list">${defs.map(d => `<li>${d}</li>`).join("")}</ul>`
              : `<div class="definition">${defs[0]}</div>`;
            processedEntries.push(`<div class="definition-block">${bullets}</div>`);
          }
        }
      } else {
        // Regular entry processing - only show if it doesn't have the {baseForm} annotation
        // (which means it was already processed by card-manager for empty definitions)
        const defs = entry.definition ? entry.definition.split(";").map(d => d.trim()).filter(Boolean) : [];
        if (defs.length > 0) {
          const bullets = defs.length > 1
            ? `<ul class="definition-list">${defs.map(d => `<li>${d}</li>`).join("")}</ul>`
            : `<div class="definition">${defs[0]}</div>`;
          processedEntries.push(`<div class="definition-block">${bullets}</div>`);
        }
      }
    }
    
    return processedEntries.join("");
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

  static createMarkButton(isKnown, isIgnored, isLearning = false) {
    return `<button class="${this.getMarkButtonClass(isKnown, isIgnored, isLearning)}">${this.getMarkButtonText(isKnown, isIgnored, isLearning)}</button>`;
  }

  static getMarkButtonClass(isKnown, isIgnored, isLearning = false) {
    if (isKnown) {
      return "mark-ignore-btn";
    } else if (isLearning) {
      return "mark-learning-btn";
    } else if (isIgnored) {
      return "mark-unknown-btn";
    } else {
      return "mark-known-btn";
    }
  }

  static getMarkButtonText(isKnown, isIgnored, isLearning = false) {
    if (isKnown) {
      return "Known";
    } else if (isLearning) {
      return "Learning";
    } else if (isIgnored) {
      return "Ignored";
    } else {
      return "Unknown";
    }
  }
}