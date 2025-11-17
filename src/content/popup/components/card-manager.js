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
    const mainWordCards = Object.entries(groups).map(([pinyin, entries]) => {
      const sortedEntries = this.definitionFilter.filterAndSortDefinitions(entries);
      return {
        pinyin,
        entries: sortedEntries,
        isMainWord: true,
        // Calculate card priority based on highest priority definition in the card
        cardPriority: this.getCardPriority(sortedEntries),
      };
    });

    // Add individual character cards for multi-character words
    const characterCards = this.createCharacterCards(originalCharacter);

    // Sort cards by priority (highest priority first)
    const allCards = [...mainWordCards, ...characterCards];
    return allCards.sort((a, b) => {
      const aPriority = a.cardPriority !== undefined ? a.cardPriority : this.getCardPriority(a.entries || []);
      const bPriority = b.cardPriority !== undefined ? b.cardPriority : this.getCardPriority(b.entries || []);
      return bPriority - aPriority; // Higher priority cards first
    });
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
          const sortedEntries = this.definitionFilter.filterAndSortDefinitions(entries);
          characterCards.push({
            pinyin,
            entries: sortedEntries,
            isCharacterCard: true,
            character: character,
            cardPriority: this.getCardPriority(sortedEntries),
          });
        });
      }
    }

    return characterCards;
  }


  // Helper method to get the highest priority score from a card's entries
  getCardPriority(entries) {
    if (!entries || entries.length === 0) return 0;
    
    // Get the highest priority score from all definitions in this card
    return Math.max(...entries.map(entry => 
      this.definitionFilter.getDefinitionPriority(entry.definition)
    ));
  }

  async prepareBasicPopupData(character) {

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
            
            // Ensure base form is loaded in dictionary (for async dictionary)
            if (this.dictionaryManager.getDefinition) {
              await this.dictionaryManager.getDefinition(baseForm);
            }
            
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
      
      // Apply definition filter and sorting
      matches = this.definitionFilter.filterAndSortDefinitions(matches);
    }

    return {
      matches: matches || [],
      isKnown: false, // Will be set by calling code
      frequency: null // Will be set by calling code
    };
  }
}