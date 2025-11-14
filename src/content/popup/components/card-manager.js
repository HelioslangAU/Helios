/**
 * CardManager - Manages card creation and grouping
 * Handles grouping entries by pronunciation and creating character cards
 */
class CardManager {
  constructor(dictionaryManager, definitionFilter, languageRegistry = null) {
    this.dictionaryManager = dictionaryManager;
    this.definitionFilter = definitionFilter;
    this.languageRegistry = languageRegistry;
  }

  groupByPronunciation(entries, originalCharacter) {
    const groups = {};

    entries.forEach((entry) => {
      if (!groups[entry.pinyin]) {
        groups[entry.pinyin] = [];
      }
      groups[entry.pinyin].push(entry);
    });

    // Start with the main word pronunciations
    const mainWordCards = Object.entries(groups).map(([pinyin, entries]) => ({
      pinyin,
      entries: this.definitionFilter.filterAndSortDefinitions(entries),
      isMainWord: true,
    }));

    // Add individual character cards for multi-character words
    const characterCards = this.createCharacterCards(originalCharacter);

    return [...mainWordCards, ...characterCards];
  }

  createCharacterCards(word) {
    const characterCards = [];

    // Only create character cards for char based languages 
    if (!this.languageRegistry || this.languageRegistry.getLanguageInfo(this.languageRegistry.getCurrentLanguage()).scanResolution !== 'char') {
      return characterCards;
    }

    // Only create character cards for multi-character words
    if (!word || word.length < 2) {
      return characterCards;
    }

    // Create cards for all characters EXCEPT the last one
    // (users can hover over last char separately)
    for (let i = 0; i < word.length - 1; i++) {
      const character = word[i];
      const charEntries = this.dictionaryManager.dictionary[character];

      if (charEntries && Array.isArray(charEntries) && charEntries.length > 0) {
        // Group character entries by pronunciation
        const charGroups = {};
        charEntries.forEach((entry) => {
          if (!charGroups[entry.pinyin]) {
            charGroups[entry.pinyin] = [];
          }
          charGroups[entry.pinyin].push(entry);
        });

        // Add cards for each pronunciation of this character
        Object.entries(charGroups).forEach(([pinyin, entries]) => {
          characterCards.push({
            pinyin,
            entries: this.definitionFilter.filterAndSortDefinitions(entries),
            isCharacterCard: true,
            character: character,
          });
        });
      }
    }

    return characterCards;
  }

  prepareBasicPopupData(character) {
    if (this.languageRegistry.getCaseSensitive(this.languageRegistry.getCurrentLanguage())) {
      character = character.toLowerCase();
    }
    let matches = this.dictionaryManager.dictionary[character];
    // Handle null/undefined from async dictionary proxy
    if (!matches) {
      matches = [];
    }
    if (matches && matches.length > 0) {
      // Process each match that has an empty definition
      const processedMatches = [];
      for (const match of matches) {
        if (match.definition === '') {
          // If this match has variations, get the base form's definition
          if (match.variations && match.variations.length > 0) {
            const baseForm = match.variations[0];
            const baseFormDefs = this.dictionaryManager.dictionary[baseForm];
            if (baseFormDefs && Array.isArray(baseFormDefs) && baseFormDefs.length > 0) {
              // Add base form annotation to each definition
              const annotatedDefs = baseFormDefs.map(def => ({
                ...def,
                definition: def.definition ? `${def.definition} {${baseForm}}` : `{${baseForm}}`,
                translation: def.translation ? `${def.translation} {${baseForm}}` : `{${baseForm}}`
              }));
              processedMatches.push(...annotatedDefs);
            }
          }
        } else {
          // Keep matches that already have definitions
          processedMatches.push(match);
        }
      }
      // Only update matches if we found any processed entries
      if (processedMatches.length > 0) {
        matches = processedMatches;
      }
    }

    return {
      matches: matches || [],
      isKnown: false, // Will be set by calling code
      frequency: null // Will be set by calling code
    };
  }
}