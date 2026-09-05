import { CardManager } from '@/content/popup/components/card-manager';
import { CardNavigator } from '@/content/popup/components/card-navigator';
import { DefinitionFilter } from '@/content/popup/components/definition-filter';
import { PopupContentBuilder } from '@/content/popup/components/popup-content-builder';
import { PopupEventHandler } from '@/content/popup/components/popup-event-handler';
import type { PopupManagers } from '@/content/popup/components/popup-event-handler';
import { PopupPositioner } from '@/content/popup/components/popup-positioner';
import { PopupManager } from '@/content/popup/popup-manager';
import type { PopupManagerOptions } from '@/content/popup/popup-manager';

/**
 * MultiCardPopupManager - Advanced popup orchestrator
 * Coordinates all components for multi-card popups with navigation
 */
export class MultiCardPopupManager extends PopupManager {
  originalCharacter: string | null;
  cardNavigator: CardNavigator;
  definitionFilter: DefinitionFilter;

  constructor(options: PopupManagerOptions) {
    super(options);
    this.originalCharacter = null;
    this.cardNavigator = new CardNavigator(this);
    this.definitionFilter = new DefinitionFilter();
    this.cardManager = new CardManager(this.dictionaryManager, this.definitionFilter, this.languageRegistry);
  }

  override async showDictionaryPopup(x: number, y: number, character: string, sentence: string | null): Promise<void> {
    // Generate unique request ID for this popup creation
    const requestId = Date.now() + Math.random();
    this.currentPopupRequestId = requestId;

    // Clear any pending hide timers immediately
    clearTimeout(this.hideTimeout!);

    // CRITICAL: Remove ALL existing popups immediately (synchronously)
    this.hidePopup();
    this.removeAllPopupsFromPage();

    // Mark that popup creation is in progress
    this.popupCreationInProgress = true;

    this.originalCharacter = character;
    this.capturedSentence = sentence;

    try {
      // Ensure dictionary entry is loaded (for async dictionary proxy)
      // This also updates the sync dictionary cache
      if (this.dictionaryManager.getDefinition) {
        await this.dictionaryManager.getDefinition(character);
        // Small delay to ensure cache is updated
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Check if this request was cancelled (newer request came in)
      if (this.currentPopupRequestId !== requestId) {
        return; // Another popup request is in progress, abort this one
      }

      // Handle async dictionary - get entries (may be null/undefined if not cached)
      const allEntries = this.dictionaryManager.dictionary[character];
      const safeEntries = Array.isArray(allEntries) ? allEntries : [];

      // If still no entries, try one more time
      if (safeEntries.length === 0) {
        console.log('⚠️ No entries found in multi-card, retrying...');
        await this.dictionaryManager.getDefinition(character);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check again if cancelled
        if (this.currentPopupRequestId !== requestId) {
          return;
        }

        const retryEntries = this.dictionaryManager.dictionary[character];
        if (Array.isArray(retryEntries) && retryEntries.length > 0) {
          console.log('✅ Found entries on retry:', retryEntries.length);
          return await super.showDictionaryPopup(x, y, character, sentence);
        }
      }

      // Check again before proceeding
      if (this.currentPopupRequestId !== requestId) {
        return;
      }

      const cards = await this.cardManager.groupByPronunciation(safeEntries, character);

      // If only one card, use basic popup
      if (cards.length <= 1) {
        return await super.showDictionaryPopup(x, y, character, sentence);
      }

      // Setup multi-card popup
      this.cardNavigator.setCards(cards);
      this.showCard(x, y, character, 0, requestId);
    } finally {
      // Only clear the flag if this is still the current request
      if (this.currentPopupRequestId === requestId) {
        this.popupCreationInProgress = false;
      }
    }
  }

  showCard(x: number, y: number, character: string, cardIndex: number, requestId: number | null = null): void {
    // CRITICAL: Remove ALL existing popups immediately (synchronously)
    this.hidePopup();
    this.removeAllPopupsFromPage();

    // If requestId is provided, check if this request is still valid
    // (showCard can be called from navigation, in which case requestId is null)
    if (requestId !== null && this.currentPopupRequestId !== requestId) {
      // This is a stale request, don't show the popup
      return;
    }

    const card = this.cardNavigator.currentCards[cardIndex];
    const popup = PopupPositioner.createPopupElement(this.settingsManager.settings.popupFontSize);

    // Determine display character and get data
    const displayCharacter = card.isCharacterCard
      ? card.character!
      : this.originalCharacter || character;

    const isKnown = this.vocabManager.isWordKnown(displayCharacter);
    const isIgnored = this.vocabManager.isWordIgnored(displayCharacter);
    const isLearning = this.vocabManager.isWordLearning(displayCharacter);
    const frequency = this.frequencyManager?.getFrequency(displayCharacter);


    // Build content
    const currentLanguage = this.languageRegistry.getCurrentLanguage();
    popup.innerHTML = PopupContentBuilder.createCardContent(
      displayCharacter,
      card,
      isKnown,
      isIgnored,
      isLearning,
      frequency,
      this.settingsManager.settings,
      currentLanguage,
      this.dictionaryManager.dictionary
    );

    // Add to DOM and position
    document.body.appendChild(popup);
    const positioned = PopupPositioner.positionPopup(popup, this.highlightManager);

    if (!positioned) {
      return;
    }

    this.popup = popup;
    this.currentCharacter = displayCharacter; // Track current character for hotkeys

    // Apply settings to the popup
    this.settingsManager.onPopupCreated(popup);

    // Remove creating class to enable transitions after initial setup
    popup.classList.remove('creating');

    // Track word lookup for recent vocabulary
    if (card && card.entries && card.entries.length > 0) {
      this.vocabManager.trackWordLookup(displayCharacter, card.entries[0]);
    }

    // Add navigation if multiple cards
    this.cardNavigator.addNavigationDots(popup);

    // Setup all popup events using unified event handler
    const managers: PopupManagers = {
      vocabManager: this.vocabManager,
      ankiManager: this.ankiManager,
      pronunciationManager: this.pronunciationManager,
      frequencyManager: this.frequencyManager,
      dictionaryManager: this.dictionaryManager,
      popupManager: this,
      settingsManager: this.settingsManager
    };

    PopupEventHandler.setupEvents(popup, character, managers, {
      isMultiCard: true,  // Enable multi-card mode for proper handling
      currentCard: card,
      cardNavigator: this.cardNavigator
    });

    // Setup events for the initial card content
    this.cardNavigator.setupScrolling(popup);
  }

  // Expose filter management methods
  addFilter(type: string, pattern: string): void {
    this.definitionFilter.addFilter(type, pattern);
  }

  removeFilter(type: string, patternString: string): void {
    this.definitionFilter.removeFilter(type, patternString);
  }

  getFilters(): Record<string, string[]> {
    return this.definitionFilter.getFilters();
  }
}
