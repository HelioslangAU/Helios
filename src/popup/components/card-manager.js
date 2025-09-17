/**
 * CardManager - Manages card creation and grouping
 * Handles grouping entries by pronunciation and creating character cards
 */
class CardManager {
  constructor(dictionaryManager, definitionFilter) {
    this.dictionaryManager = dictionaryManager;
    this.definitionFilter = definitionFilter;
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

    // Only create character cards for multi-character words
    if (!word || word.length < 2) {
      return characterCards;
    }

    // Create cards for all characters EXCEPT the last one
    // (users can hover over last char separately)
    for (let i = 0; i < word.length - 1; i++) {
      const character = word[i];
      const charEntries = this.dictionaryManager.dictionary[character];

      if (charEntries && charEntries.length > 0) {
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
    const matches = this.dictionaryManager.dictionary[character] || [];
    return {
      matches,
      isKnown: false, // Will be set by calling code
      frequency: null // Will be set by calling code
    };
  }
}