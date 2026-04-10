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

  /**
   * Resolve the pronunciation key for an entry — works for any language.
   * Chinese stores it as `pinyin`; Japanese/others store it as `pronunciation` or `reading`.
   * @param {Object} entry
   * @returns {string}
   */
  _getPronunciationKey(entry) {
    return entry.pinyin || entry.pronunciation || entry.reading || '';
  }

  async groupByPronunciation(entries, originalCharacter) {
    const groups = {};

    entries.forEach((entry) => {
      const key = this._getPronunciationKey(entry);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });

    // Enhance variant definitions before grouping
    const adapter = this.languageRegistry?.getAdapter();
    if (adapter && adapter.enhanceVariantDefinition) {
      for (const [pinyin, pinyinEntries] of Object.entries(groups)) {
        const enhancedEntries = [];
        for (const entry of pinyinEntries) {
          if (entry.definition) {
            const enhancedDefinition = await adapter.enhanceVariantDefinition(
              entry.definition,
              this.dictionaryManager.dictionary,
              this.dictionaryManager.getDefinition ? 
                (word) => this.dictionaryManager.getDefinition(word) : 
                null,
              pinyinEntries
            );
            enhancedEntries.push({
              ...entry,
              definition: enhancedDefinition
            });
          } else {
            enhancedEntries.push(entry);
          }
        }
        groups[pinyin] = enhancedEntries;
      }
    }

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
    const characterCards = await this.createCharacterCards(originalCharacter);

    // Sort cards by priority (highest priority first)
    const allCards = [...mainWordCards, ...characterCards];
    return allCards.sort((a, b) => {
      const aPriority = a.cardPriority !== undefined ? a.cardPriority : this.getCardPriority(a.entries || []);
      const bPriority = b.cardPriority !== undefined ? b.cardPriority : this.getCardPriority(b.entries || []);
      return bPriority - aPriority; // Higher priority cards first
    });
  }

  async createCharacterCards(word) {
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
        // Group character entries by pronunciation (language-agnostic)
        const charGroups = {};
        charEntries.forEach((entry) => {
          const key = this._getPronunciationKey(entry);
          if (!charGroups[key]) {
            charGroups[key] = [];
          }
          charGroups[key].push(entry);
        });

        // Enhance variant definitions before creating cards
        const adapter = this.languageRegistry?.getAdapter();
        if (adapter && adapter.enhanceVariantDefinition) {
          for (const [pinyin, pinyinEntries] of Object.entries(charGroups)) {
            const enhancedEntries = [];
            for (const entry of pinyinEntries) {
              if (entry.definition) {
                const enhancedDefinition = await adapter.enhanceVariantDefinition(
                  entry.definition,
                  this.dictionaryManager.dictionary,
                  this.dictionaryManager.getDefinition ? 
                    (word) => this.dictionaryManager.getDefinition(word) : 
                    null,
                  pinyinEntries
                );
                enhancedEntries.push({
                  ...entry,
                  definition: enhancedDefinition
                });
              } else {
                enhancedEntries.push(entry);
              }
            }
            charGroups[pinyin] = enhancedEntries;
          }
        }

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
    // Use adapter's getDictionaryEntries to handle base word resolution and enhancements.
    // Bug #3: pass the async getDefinition loader so adapters (e.g. Japanese) can
    // await base-form lookups when the sync proxy cache misses.
    let matches = null;
    if (this.languageRegistry) {
      const adapter = this.languageRegistry.getAdapter();
      if (adapter && adapter.getDictionaryEntries) {
        const asyncLoader = this.dictionaryManager.getDefinition
          ? (word) => this.dictionaryManager.getDefinition(word)
          : null;
        matches = await adapter.getDictionaryEntries(
          character,
          this.dictionaryManager.dictionary,
          asyncLoader
        );
      }
    }
    
    // Fallback to direct dictionary lookup if adapter method not available
    if (!matches) {
      matches = this.dictionaryManager.dictionary[character];
    }
    
    // Handle null/undefined from async dictionary proxy
    if (!matches) {
      matches = [];
    }
    if (matches && matches.length > 0) {
      // Process each match that has an empty definition
      const processedMatches = [];
      for (const match of matches) {
        if (match.definition === '') {
          // If this match has morphology, preserve it and let popup builder handle display
          // Otherwise, if it has variations, get the base form's definition
          const hasMorphology = match.morphology && typeof match.morphology === 'string' && match.morphology.trim().length > 0;
          
          if (hasMorphology) {
            // Keep the entry with morphology - popup builder will handle displaying it
            // But ensure base form is loaded so popup builder can look it up
            if (match.variations && match.variations.length > 0) {
              const baseForm = match.variations[0];
              if (this.dictionaryManager.getDefinition) {
                await this.dictionaryManager.getDefinition(baseForm);
              }
            }
            processedMatches.push(match);
          } else if (match.variations && match.variations.length > 0) {
            // No morphology, so use the old behavior of adding base form definitions
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
      
      // Ensure base forms are loaded for all entries with morphology (for popup builder lookup)
      for (const match of matches) {
        const hasMorphology = match.morphology && typeof match.morphology === 'string' && match.morphology.trim().length > 0;
        if (hasMorphology && match.variations && match.variations.length > 0) {
          const baseForm = match.variations[0];
          if (baseForm && this.dictionaryManager.getDefinition) {
            await this.dictionaryManager.getDefinition(baseForm);
          }
        }
      }
      
      // Enhance variant definitions by appending base variant definitions
      const adapter = this.languageRegistry.getAdapter();
      if (adapter && adapter.enhanceVariantDefinition) {
        const enhancedMatches = [];
        for (const match of matches) {
          if (match.definition) {
            // Check if this is a variant pattern and enhance it
            const enhancedDefinition = await adapter.enhanceVariantDefinition(
              match.definition,
              this.dictionaryManager.dictionary,
              this.dictionaryManager.getDefinition ? 
                (word) => this.dictionaryManager.getDefinition(word) : 
                null,
              matches
            );
            
            // If definition was enhanced, create a new match with enhanced definition
            if (enhancedDefinition !== match.definition) {
              enhancedMatches.push({
                ...match,
                definition: enhancedDefinition
              });
            } else {
              enhancedMatches.push(match);
            }
          } else {
            enhancedMatches.push(match);
          }
        }
        matches = enhancedMatches;
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