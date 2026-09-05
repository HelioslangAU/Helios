import { items, storage } from '@/config/storage';
import { browser } from 'wxt/browser';
import type { AnkiManager } from '@/content/anki-manager';
import type { FrequencyManager } from '@/content/frequency-manager';
import type { CardNavigator } from '@/content/popup/components/card-navigator';
import type { DictionaryEntry, WordCard } from '@/content/popup/components/card-manager';
import type { PopupManager } from '@/content/popup/popup-manager';
import type { PopupSettingsManager } from '@/content/popup/popup-settings-manager';
import type { PopupPronunciationManager } from '@/content/pronunciation';
import type { VocabManager } from '@/content/vocab-manager';

/** Bundle of manager instances shared with popup event handlers. */
export interface PopupManagers {
  vocabManager: VocabManager;
  ankiManager: AnkiManager;
  pronunciationManager: PopupPronunciationManager;
  frequencyManager: FrequencyManager | undefined;
  dictionaryManager: any;
  /** Multi-card managers additionally expose cardNavigator/originalCharacter. */
  popupManager: PopupManager & { cardNavigator?: CardNavigator; originalCharacter?: string | null };
  settingsManager: PopupSettingsManager;
}

/** A single hotkey: legacy single-character string or key+modifiers object. */
type HotkeyShortcut = string | { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean };

interface HotkeySettings {
  hotkeyMarkUnknown: HotkeyShortcut;
  hotkeyMarkIgnored: HotkeyShortcut;
  hotkeyMarkKnown: HotkeyShortcut;
  hotkeyMarkLearning: HotkeyShortcut;
  hotkeyAnkiAdd: HotkeyShortcut;
}

type MarkState = 'known' | 'learning' | 'ignored' | 'unknown';

interface PopupEventOptions {
  isMultiCard?: boolean;
  currentCard?: WordCard | null;
  cardNavigator?: CardNavigator | null;
}

/**
 * PopupEventHandler - Manages all popup event listeners
 * Centralizes event handling for clean separation of concerns
 */
export class PopupEventHandler {
  static keyboardListener: ((e: KeyboardEvent) => void) | null = null; // Track current keyboard listener
  static currentManagers: {
    managers: PopupManagers;
    isMultiCard: boolean;
    currentCard: WordCard | null;
    character: string;
    hotkeySettings: HotkeySettings;
  } | null = null; // Track current managers for keyboard handler

  static setupEvents(popup: HTMLElement, character: string, managers: PopupManagers, options: PopupEventOptions = {}): void {
    const { isMultiCard = false, currentCard = null, cardNavigator = null } = options;

    // Common mouse events for hiding logic
    this.setupMouseEvents(popup, managers);

    // Mark known/ignore/unknown buttons - unified three-state cycling approach
    this.setupMarkButtonEvents(popup, character, managers, isMultiCard, currentCard);

    // Anki button
    this.setupAnkiEvents(popup, character, managers, isMultiCard, currentCard);

    // Pronunciation buttons
    this.setupPronunciationEvents(popup, managers);

    // Multi-card specific events
    if (isMultiCard && cardNavigator) {
      this.setupNavigationEvents(popup, cardNavigator);
    }

    // Keyboard shortcuts for marking words
    this.setupKeyboardEvents(popup, character, managers, isMultiCard, currentCard);
  }

  static setupMouseEvents(popup: HTMLElement, managers: PopupManagers): void {
    popup.addEventListener("mouseenter", () => {
      managers.popupManager.isMouseOverPopup = true;
      if (managers.popupManager.hideTimeout) {
        clearTimeout(managers.popupManager.hideTimeout);
        managers.popupManager.hideTimeout = null;
      }
    });

    popup.addEventListener("mouseleave", () => {
      managers.popupManager.isMouseOverPopup = false;
      managers.popupManager.scheduleHidePopup();
    });
  }

  static setupMarkButtonEvents(popup: HTMLElement, character: string, managers: PopupManagers, isMultiCard: boolean, currentCard: WordCard | null = null): void {
    const markButton = popup.querySelector(".mark-known-btn, .mark-ignore-btn, .mark-unknown-btn, .mark-learning-btn");

    if (markButton) {
      markButton.addEventListener("click", async () => {
        const currentState = this.getCurrentMarkState(markButton);
        const nextState = this.getNextMarkState(currentState);

        // Execute the appropriate action based on current state
        await this.executeMarkAction(character, managers, nextState, isMultiCard, currentCard);

        // Update button appearance
        this.updateMarkButton(markButton, nextState);

        // Only hide popup if not in persistent mode
        if (managers.settingsManager && !managers.settingsManager.shouldPreventAutoHide()) {
          managers.popupManager.hidePopup();
        }
      });
    }
  }

  static setupAnkiEvents(popup: HTMLElement, character: string, managers: PopupManagers, isMultiCard: boolean, currentCard: WordCard | null): void {
    const ankiBtn = popup.querySelector<HTMLButtonElement>(".anki-btn");
    if (ankiBtn && !ankiBtn.disabled) {
      ankiBtn.addEventListener("click", async () => {
        // handleAnkiAdd and handleMultiCardAnkiAdd call createCardFromPopup
        // which manages the button state (loading -> success/error)
        // So we don't override it here
        if (isMultiCard && currentCard) {
          await this.handleMultiCardAnkiAdd(currentCard, managers);
        } else {
          await this.handleAnkiAdd(character, managers);
        }
      });
    }
  }

  static setupPronunciationEvents(popup: HTMLElement, managers: PopupManagers): void {
    const { pronunciationManager } = managers;
    const pronunciationBtns = popup.querySelectorAll<HTMLButtonElement>(".pronunciation-btn");

    pronunciationBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = btn.getAttribute("data-word");
        const pinyin = btn.getAttribute("data-pinyin");
        await this.handlePronunciation(btn, word, pinyin, pronunciationManager);
      });
    });
  }

  static setupNavigationEvents(popup: HTMLElement, cardNavigator: CardNavigator): void {
    popup.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("nav-dot")) {
        const index = parseInt(target.getAttribute("data-index")!);
        cardNavigator.goToCard(index);
      }
    });
  }

  static setupKeyboardEvents(popup: HTMLElement, character: string, managers: PopupManagers, isMultiCard: boolean, currentCard: WordCard | null): void {
    // Remove any existing keyboard listener
    if (this.keyboardListener) {
      document.removeEventListener("keydown", this.keyboardListener, true);
      this.keyboardListener = null;
    }

    // Load hotkey settings once when popup is shown (synchronously if possible, async otherwise)
    this.loadHotkeySettings().then((hotkeySettings) => {
      // Store current managers and hotkey settings for keyboard handler
      this.currentManagers = { managers, isMultiCard, currentCard, character, hotkeySettings };

      // Create new keyboard listener with capture phase to override YouTube shortcuts
      this.keyboardListener = (e: KeyboardEvent) => {
        this.handleKeyboardEvent(e, managers, isMultiCard, currentCard, hotkeySettings);
      };

      // Add keyboard listener to document with capture phase (true = capture phase)
      // This ensures our handler runs before YouTube's handlers
      document.addEventListener("keydown", this.keyboardListener, true);
    });
  }

  static async loadHotkeySettings(): Promise<HotkeySettings> {
    let hotkeySettings: HotkeySettings = {
      hotkeyMarkUnknown: { key: "1", ctrl: false, shift: false, alt: false, meta: false },
      hotkeyMarkIgnored: { key: "2", ctrl: false, shift: false, alt: false, meta: false },
      hotkeyMarkKnown: { key: "3", ctrl: false, shift: false, alt: false, meta: false },
      hotkeyMarkLearning: { key: "4", ctrl: false, shift: false, alt: false, meta: false },
      hotkeyAnkiAdd: { key: "q", ctrl: false, shift: false, alt: false, meta: false }
    };

    try {
      if (browser.runtime?.id) {
        // Try to load from unified shortcuts structure first
        const shortcuts = await items.shortcuts.getValue();
        if (shortcuts.popup) {
          // Stored popup shortcuts are either legacy strings or {key, modifiers} objects.
          const popupShortcuts: Record<string, HotkeyShortcut | undefined> = shortcuts.popup;
          hotkeySettings = {
            hotkeyMarkUnknown: typeof popupShortcuts.markUnknown === 'object'
              ? popupShortcuts.markUnknown
              : { key: popupShortcuts.markUnknown || "1", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyMarkIgnored: typeof popupShortcuts.markIgnored === 'object'
              ? popupShortcuts.markIgnored
              : { key: popupShortcuts.markIgnored || "2", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyMarkKnown: typeof popupShortcuts.markKnown === 'object'
              ? popupShortcuts.markKnown
              : { key: popupShortcuts.markKnown || "3", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyMarkLearning: typeof popupShortcuts.markLearning === 'object'
              ? popupShortcuts.markLearning
              : { key: popupShortcuts.markLearning || "4", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyAnkiAdd: typeof popupShortcuts.ankiAdd === 'object'
              ? popupShortcuts.ankiAdd
              : { key: popupShortcuts.ankiAdd || "q", ctrl: false, shift: false, alt: false, meta: false }
          };
        } else {
          // Fallback to legacy format (single character strings).
          // There is no legacy `hotkeyMarkLearning` key — it was never read here
          // either, so learning stays on its built-in default.
          const [markUnknown, markIgnored, markKnown, ankiAdd] = await storage.getItems([
            items.hotkeyMarkUnknown,
            items.hotkeyMarkIgnored,
            items.hotkeyMarkKnown,
            items.hotkeyAnkiAdd
          ]) as Array<{ value: string | null }>;
          hotkeySettings = {
            hotkeyMarkUnknown: { key: markUnknown.value || "1", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyMarkIgnored: { key: markIgnored.value || "2", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyMarkKnown: { key: markKnown.value || "3", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyMarkLearning: { key: "4", ctrl: false, shift: false, alt: false, meta: false },
            hotkeyAnkiAdd: { key: ankiAdd.value || "q", ctrl: false, shift: false, alt: false, meta: false }
          };
        }
      }
    } catch (error) {
      console.warn("Failed to load hotkey settings:", error);
    }

    return hotkeySettings;
  }

  static handleKeyboardEvent(event: KeyboardEvent, managers: PopupManagers, isMultiCard: boolean, currentCard: WordCard | null, hotkeySettings: HotkeySettings): void {
    // Check if popup is visible
    if (!managers.popupManager || !managers.popupManager.popup) {
      return;
    }

    // Ignore if user is typing in input fields, textareas, or contenteditable elements
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // Use provided hotkey settings or fallback to defaults
    const settings: HotkeySettings = hotkeySettings || {
      hotkeyMarkUnknown: "1",
      hotkeyMarkIgnored: "2",
      hotkeyMarkKnown: "3",
      hotkeyMarkLearning: "4",
      hotkeyAnkiAdd: "q"
    };

    // Helper to check if a shortcut matches the current keypress
    const matchesShortcut = (shortcut: HotkeyShortcut | undefined): boolean => {
      if (!shortcut) return false;

      // Handle both string (legacy) and object (new format) shortcuts
      if (typeof shortcut === 'string') {
        return event.key.toLowerCase() === shortcut.toLowerCase() &&
               !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
      }

      // Object format with modifiers
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey);
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    };

    // Determine which action to take based on pressed key
    let targetState: MarkState | null = null;
    let isAnkiAction = false;

    if (matchesShortcut(settings.hotkeyMarkUnknown)) {
      targetState = "unknown";
    } else if (matchesShortcut(settings.hotkeyMarkIgnored)) {
      targetState = "ignored";
    } else if (matchesShortcut(settings.hotkeyMarkKnown)) {
      targetState = "known";
    } else if (matchesShortcut(settings.hotkeyMarkLearning)) {
      targetState = "learning";
    } else if (matchesShortcut(settings.hotkeyAnkiAdd)) {
      isAnkiAction = true;
    }

    // If no matching hotkey, ignore the event
    if (!targetState && !isAnkiAction) {
      return;
    }

    // CRITICAL: Prevent default and stop ALL propagation immediately
    // This must happen BEFORE any async operations to override YouTube's shortcuts
    event.preventDefault();
    event.stopImmediatePropagation(); // Stop all other handlers, including YouTube's

    // Execute the appropriate action
    if (isAnkiAction) {
      this.executeAnkiKeyboardAction(managers, isMultiCard, currentCard);
    } else {
      this.executeKeyboardAction(targetState!, managers, isMultiCard, currentCard);
    }
  }

  static async executeKeyboardAction(targetState: MarkState, managers: PopupManagers, isMultiCard: boolean, currentCard: WordCard | null): Promise<void> {

    // Get the character to mark (handle multi-card mode)
    let targetCharacter: string | null | undefined;
    if (isMultiCard) {
      // For multi-card mode, get the current card from cardNavigator
      const cardNavigator = managers.popupManager.cardNavigator;
      if (cardNavigator && cardNavigator.currentCards && cardNavigator.currentCards.length > 0) {
        const currentCardIndex = cardNavigator.currentCardIndex || 0;
        const currentCard = cardNavigator.currentCards[currentCardIndex];
        if (currentCard) {
          targetCharacter = currentCard.isCharacterCard
            ? currentCard.character
            : managers.popupManager.originalCharacter;
        } else {
          targetCharacter = managers.popupManager.originalCharacter;
        }
      } else {
        // Fallback to originalCharacter if cardNavigator not available
        targetCharacter = managers.popupManager.originalCharacter;
      }
    } else {
      // For single card mode, use currentCharacter
      targetCharacter = managers.popupManager.currentCharacter;
    }

    if (!targetCharacter) {
      console.warn("No character to mark");
      return;
    }

    // Execute the appropriate action
    switch (targetState) {
      case "unknown":
        await this.handleMarkUnknown(targetCharacter);
        break;
      case "ignored":
        await this.handleMarkIgnored(targetCharacter);
        break;
      case "known":
        await this.handleMarkKnown(targetCharacter);
        break;
      case "learning":
        await this.handleMarkLearning(targetCharacter);
        break;
    }

    // Update button state
    const markButton = managers.popupManager.popup!.querySelector(
      ".mark-known-btn, .mark-ignore-btn, .mark-unknown-btn, .mark-learning-btn"
    );
    if (markButton) {
      this.updateMarkButton(markButton, targetState);
    }

    // Optionally hide popup (based on persistent mode)
    if (managers.settingsManager && !managers.settingsManager.shouldPreventAutoHide()) {
      managers.popupManager.hidePopup();
    }
  }

  static async executeAnkiKeyboardAction(managers: PopupManagers, isMultiCard: boolean, currentCard: WordCard | null): Promise<void> {
    // Get the character to add to Anki (handle multi-card mode)
    let targetCharacter: string | null | undefined;
    if (isMultiCard) {
      // For multi-card mode, get the current card from cardNavigator
      const cardNavigator = managers.popupManager.cardNavigator;
      if (cardNavigator && cardNavigator.currentCards && cardNavigator.currentCards.length > 0) {
        const currentCardIndex = cardNavigator.currentCardIndex || 0;
        const currentCard = cardNavigator.currentCards[currentCardIndex];
        if (currentCard) {
          // Use the card for Anki add
          await this.handleMultiCardAnkiAdd(currentCard, managers);
          return;
        } else {
          targetCharacter = managers.popupManager.originalCharacter;
        }
      } else {
        // Fallback to originalCharacter if cardNavigator not available
        targetCharacter = managers.popupManager.originalCharacter;
      }
    } else {
      // For single card mode, use currentCharacter
      targetCharacter = managers.popupManager.currentCharacter;
    }

    if (!targetCharacter) {
      console.warn("No character to add to Anki");
      return;
    }

    // Execute Anki add action
    await this.handleAnkiAdd(targetCharacter, managers);
  }

  static cleanupKeyboardListener(): void {
    if (this.keyboardListener) {
      // Remove with capture phase flag to match how we added it
      document.removeEventListener("keydown", this.keyboardListener, true);
      this.keyboardListener = null;
      this.currentManagers = null;
    }
  }

  static getCurrentMarkState(button: Element): MarkState {
    if (button.classList.contains("mark-ignore-btn")) return "known";
    if (button.classList.contains("mark-learning-btn")) return "learning";
    if (button.classList.contains("mark-unknown-btn")) return "ignored";
    if (button.classList.contains("mark-known-btn")) return "unknown";
    return "unknown";
  }

  static getNextMarkState(currentState: MarkState): MarkState {
    const stateCycle: Record<string, MarkState> = { unknown: "known", known: "learning", learning: "ignored", ignored: "unknown" };
    return stateCycle[currentState] || "unknown";
  }

  static async executeMarkAction(character: string, managers: PopupManagers, targetState: MarkState, isMultiCard: boolean, currentCard: WordCard | null = null): Promise<void> {
    let targetCharacter: string;

    if (isMultiCard && currentCard) {
      // For multi-card mode, use the card-specific character
      targetCharacter = currentCard.isCharacterCard
        ? currentCard.character!
        : managers.popupManager.originalCharacter!;
    } else {
      // For single card mode, use currentCharacter (set when popup is shown)
      targetCharacter = managers.popupManager.currentCharacter || character;
    }

    switch (targetState) {
      case "known":
        await this.handleMarkKnown(targetCharacter);
        break;
      case "learning":
        await this.handleMarkLearning(targetCharacter);
        break;
      case "ignored":
        await this.handleMarkIgnored(targetCharacter);
        break;
      case "unknown":
        await this.handleMarkUnknown(targetCharacter);
        break;

    }
  }

  static async handleMarkKnown(character: string): Promise<void> {
    await window.vocabManager.markWordAsUnignored(character);
    await window.vocabManager.markWordAsKnown(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, true);
    }
    // Update counter via chrome storage listener (will trigger in extension tab)
    this.notifyCounterUpdate();
    // Update side tab stats
    this.updateSideTabStats();
  }

  static async handleMarkUnknown(character: string): Promise<void> {
    await window.vocabManager.markWordAsUnignored(character);
    await window.vocabManager.markWordAsUnknown(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, false);
    }
    // Update counter via chrome storage listener (will trigger in extension tab)
    this.notifyCounterUpdate();
    // Update side tab stats
    this.updateSideTabStats();
  }

  static async handleMarkLearning(character: string): Promise<void> {
    await window.vocabManager.markWordAsUnignored(character);
    await window.vocabManager.markWordAsLearning(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, true);
    }
    // Update counter via chrome storage listener (will trigger in extension tab)
    this.notifyCounterUpdate();
    // Update side tab stats
    this.updateSideTabStats();
  }

  static async handleMarkIgnored(character: string): Promise<void> {
    await window.vocabManager.markWordAsUnknown(character);
    await window.vocabManager.markWordAsIgnored(character);
    if (window.pageProcessor) {
      window.pageProcessor.updateWordStyling(character, true);
    }
    // Update counter via chrome storage listener (will trigger in extension tab)
    this.notifyCounterUpdate();
    // Update side tab stats
    this.updateSideTabStats();
  }

  static async handleAnkiAdd(character: string, managers: PopupManagers): Promise<void> {
    const { dictionaryManager, ankiManager, frequencyManager } = managers;
    const matches = dictionaryManager.dictionary[character] || [];
    const firstMatch = matches.length > 0 ? matches[0] : {};

    // Get current language
    const currentLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

    // Typed loosely: AnkiManager's AnkiWordData is not exported and declares
    // `sentence?: string`, while capturedSentence is `string | null`.
    const wordData: Record<string, any> = {
      character: character,
      language: currentLanguage, // Add language
      // Use pinyin for Chinese, pronunciation for other languages
      pinyin: firstMatch.pinyin || firstMatch.pronunciation || '',
      definition: firstMatch.definition || 'No definition',
      sentence: managers.popupManager.capturedSentence,
      // Traditional/simplified only exist for Chinese, fallback to character
      traditional: firstMatch.traditional || character,
      simplified: firstMatch.simplified || character,
    };

    const ankiBtn = managers.popupManager.popup!.querySelector<HTMLButtonElement>(".anki-btn");
    await ankiManager.createCardFromPopup(wordData, ankiBtn, frequencyManager);
  }

  static async handleMultiCardAnkiAdd(currentCard: WordCard, managers: PopupManagers): Promise<void> {
    const { ankiManager, frequencyManager } = managers;
    const displayCharacter = currentCard.isCharacterCard
      ? currentCard.character!
      : managers.popupManager.originalCharacter!;

    const firstEntry: Partial<DictionaryEntry> = currentCard.entries[0] || {};

    // Get current language
    const currentLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

    // See handleAnkiAdd: AnkiWordData is not exported and rejects a null sentence.
    const wordData: Record<string, any> = {
      character: displayCharacter,
      language: currentLanguage, // Add language
      // Use pinyin for Chinese, pronunciation for other languages
      pinyin: currentCard.pinyin || firstEntry.pronunciation || '',
      definition: currentCard.entries.map(e => e.definition).join('; '),
      sentence: managers.popupManager.capturedSentence,
      // Traditional/simplified only exist for Chinese, fallback to character
      traditional: firstEntry.traditional || displayCharacter,
      simplified: firstEntry.simplified || displayCharacter,
    };

    const ankiBtn = managers.popupManager.popup!.querySelector<HTMLButtonElement>(".anki-btn");
    await ankiManager.createCardFromPopup(wordData, ankiBtn, frequencyManager);
  }

  static async handlePronunciation(button: HTMLButtonElement, word: string | null, pinyin: string | null, pronunciationManager: PopupPronunciationManager): Promise<void> {
    try {
      button.classList.add("loading");
      button.disabled = true;
      button.title = "Loading audio...";

      const ttsText = button.getAttribute("data-tts-text") || word;
      const success = await pronunciationManager.playPronunciation(ttsText!);

      if (success) {
        button.classList.remove("loading");
        button.classList.add("playing");
        button.title = "Playing...";
        setTimeout(() => {
          button.classList.remove("playing");
          button.disabled = false;
          button.title = "Play pronunciation";
        }, 2000);
      } else {
        button.classList.remove("loading");
        button.classList.add("error");
        button.title = "Audio not available";
        setTimeout(() => {
          button.classList.remove("error");
          button.disabled = false;
          button.title = "Play pronunciation";
        }, 1500);
      }
    } catch (error) {
      console.error("🔊 Error in pronunciation handler:", error);
      button.classList.remove("loading");
      button.classList.add("error");
      button.title = "Error playing audio";
      setTimeout(() => {
        button.classList.remove("error");
        button.disabled = false;
        button.title = "Play pronunciation";
      }, 1500);
    }
  }

  static updateMarkButton(button: Element, state: MarkState): void {
    // Clear all state classes
    button.classList.remove("mark-known-btn", "mark-ignore-btn", "mark-unknown-btn", "mark-learning-btn");

    switch (state) {
      case "known":
        button.textContent = "Known";
        button.className = "mark-ignore-btn";
        break;
      case "learning":
        button.textContent = "Learning";
        button.className = "mark-learning-btn";
        break;
      case "ignored":
        button.textContent = "Ignored";
        button.className = "mark-unknown-btn";
        break;
      case "unknown":
      default:
        button.textContent = "Unknown";
        button.className = "mark-known-btn";
        break;
    }
  }

  static notifyCounterUpdate(): void {
    // The storage.onChanged listener in extensiontab will automatically
    // detect changes to chineseExtensionKnownWords and update the counter
    // This happens because VocabManager.saveKnownWords() triggers storage changes
    console.log("Word status updated - extension tab will auto-update via storage listener");
  }

  static updateSideTabStats(): void {
    // Update side tab stats after marking words
    // Delegate to BannerManager's debounced refresh logic to avoid duplicate heavy calculations
    if (window.bannerManager && typeof window.bannerManager.refreshData === 'function') {
      window.bannerManager.refreshData();
    }
  }
}
