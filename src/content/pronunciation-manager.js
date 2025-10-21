/**
 * Pronunciation Manager
 * 
 * Generalized pronunciation display manager that works with any language adapter.
 * Replaces the Chinese-specific PinyinManager with a language-agnostic approach.
 */
class PronunciationManager {
  constructor(dictionaryManager, pageProcessor, languageRegistry) {
    this.dictionaryManager = dictionaryManager;
    this.pageProcessor = pageProcessor;
    this.languageRegistry = languageRegistry;
    this.pronunciationEnabled = false;
    this.processedElements = new Set();
    this.originalTextNodes = new Map(); // Store original text for restoration
  }

  isEnabled() {
    return this.pronunciationEnabled;
  }

  enablePronunciation() {
    if (!this.pronunciationEnabled) {
      this.togglePronunciation();
    }
  }

  disablePronunciation() {
    if (this.pronunciationEnabled) {
      this.togglePronunciation();
    }
  }

  togglePronunciation() {
    this.pronunciationEnabled = !this.pronunciationEnabled;
    console.log("🔤 Pronunciation toggle:", this.pronunciationEnabled ? "ON" : "OFF");

    if (this.pronunciationEnabled) {
      this.addPronunciationToPage();
    } else {
      this.removePronunciationFromPage();
    }

    // Notify sidebar of change
    if (window.sidebarManager) {
      window.sidebarManager.onPronunciationToggle(this.pronunciationEnabled);
    }
  }

  addPronunciationToPage() {
    console.log("🔤 Adding pronunciation to page...");
    // Ensure styles are present for ruby rendering
    this.injectPronunciationCSS && this.injectPronunciationCSS();

    // Get all text nodes that contain target language characters
    const textNodes = this.getAllTargetLanguageTextNodes(document.body);

    for (const textNode of textNodes) {
      this.processTextNodeForPronunciation(textNode);
    }

    console.log("🔤 Pronunciation added to", textNodes.length, "text nodes");
  }

  removePronunciationFromPage() {
    console.log("🔤 Removing pronunciation from page...");

    // Remove all ruby elements and restore original text
    const rubyElements = document.querySelectorAll("ruby.helios-pronunciation");
    rubyElements.forEach((ruby) => {
      const parent = ruby.parentNode;
      const originalText = ruby.textContent; // This gets the text without the pronunciation
      const textNode = document.createTextNode(originalText);
      parent.replaceChild(textNode, ruby);
    });

    // Normalize text nodes to merge adjacent ones
    this.normalizeTextNodes(document.body);

    this.processedElements.clear();
    this.originalTextNodes.clear();

    console.log("🔤 Pronunciation removed from page");
  }

  // Inject minimal CSS for ruby display if not already present
  injectPronunciationCSS() {
    if (document.getElementById("helios-pronunciation-styles")) return;
    const style = document.createElement("style");
    style.id = "helios-pronunciation-styles";
    style.textContent = `
      .helios-pronunciation-wrapper { display: inline; }
      ruby.helios-pronunciation { ruby-align: center; ruby-position: over; display: inline-ruby; vertical-align: baseline; }
      ruby.helios-pronunciation rt { font-size: 0.6em; color: #666; line-height: 1.1; text-align: center; display: ruby-text; }
      @media (prefers-color-scheme: dark) { ruby.helios-pronunciation rt { color: #aaa; } }
      ruby.helios-pronunciation + ruby.helios-pronunciation { margin-left: 1px; }
    `;
    document.head.appendChild(style);
  }

  getAllTargetLanguageTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip script, style, and our own popup elements
        const tagName = parent.tagName.toLowerCase();
        if (["script", "style", "noscript"].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.classList.contains("chinese-lang-extension-popup")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if already processed or if it's inside a ruby element
        if (parent.closest("ruby.helios-pronunciation")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Only accept if contains target language characters
        const text = node.textContent.trim();
        return this.containsTargetLanguage(text)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }

  processTextNodeForPronunciation(textNode) {
    const text = textNode.textContent;
    if (!text || this.processedElements.has(textNode)) return;

    // Store original text for restoration
    this.originalTextNodes.set(textNode, text);
    this.processedElements.add(textNode);

    const rubyHTML = this.convertTextToRuby(text);

    if (rubyHTML !== text) {
      const wrapper = document.createElement("span");
      wrapper.innerHTML = rubyHTML;
      wrapper.classList.add("helios-pronunciation-wrapper");

      textNode.parentNode.replaceChild(wrapper, textNode);
    }
  }

  convertTextToRuby(text) {
    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return text;

    let result = "";
    let i = 0;

    while (i < text.length) {
      if (adapter.isTargetCharacter(text[i])) {
        // Try to find the longest word first (word-by-word approach)
        let longestWord = null;
        let longestLength = 0;

        const maxWordLength = adapter.getConfig().maxWordLength || 5;
        // Check for words of length maxWordLength down to 1
        for (let len = Math.min(maxWordLength, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);

          // Make sure all characters in candidate are target language characters
          if ([...candidate].every((c) => adapter.isTargetCharacter(c))) {
            // Check if this word exists in our dictionary
            if (this.dictionaryManager.dictionary[candidate]) {
              if (len > longestLength) {
                longestWord = candidate;
                longestLength = len;
              }
            }
          }
        }

        if (longestWord) {
          // Found a word - get its pronunciation
          const pronunciation = this.getPronunciationForWord(longestWord);
          if (pronunciation) {
            result += `<ruby class="helios-pronunciation">${longestWord}<rt>${pronunciation}</rt></ruby>`;
          } else {
            // Fallback to character-by-character
            result += this.convertCharactersToPronunciation(longestWord);
          }
          i += longestLength;
        } else {
          // No word found, process single character
          const char = text[i];
          const pronunciation = this.getPronunciationForCharacter(char);
          if (pronunciation) {
            result += `<ruby class="helios-pronunciation">${char}<rt>${pronunciation}</rt></ruby>`;
          } else {
            result += char;
          }
          i++;
        }
      } else {
        // Non-target language character, add as-is
        result += text[i];
        i++;
      }
    }

    return result;
  }

  convertCharactersToPronunciation(word) {
    const adapter = this.languageRegistry.getAdapter();
    if (!adapter) return word;

    let result = "";
    for (const char of word) {
      const pronunciation = this.getPronunciationForCharacter(char);
      if (pronunciation) {
        result += `<ruby class="helios-pronunciation">${char}<rt>${pronunciation}</rt></ruby>`;
      } else {
        result += char;
      }
    }
    return result;
  }

  getPronunciationForWord(word) {
    const entries = this.dictionaryManager.dictionary[word];
    if (entries && entries.length > 0) {
      const adapter = this.languageRegistry.getAdapter();
      return adapter ? adapter.getPronunciation(word, entries) : null;
    }
    return null;
  }

  getPronunciationForCharacter(character) {
    const entries = this.dictionaryManager.dictionary[character];
    if (entries && entries.length > 0) {
      const adapter = this.languageRegistry.getAdapter();
      return adapter ? adapter.getPronunciation(character, entries) : null;
    }
    return null;
  }

  containsTargetLanguage(text) {
    const adapter = this.languageRegistry.getAdapter();
    return adapter ? adapter.containsTargetLanguage(text) : false;
  }

  normalizeTextNodes(element) {
    // Helper function to merge adjacent text nodes after removing ruby elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    const elementsToNormalize = [element];
    let node;
    while ((node = walker.nextNode())) {
      elementsToNormalize.push(node);
    }

    elementsToNormalize.forEach((el) => {
      if (el.normalize) {
        el.normalize();
      }
    });
  }

  // Handle dynamic content changes (for subtitle sites like Netflix, etc.)
  observeForDynamicContent() {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }

    this.contentObserver = new MutationObserver((mutations) => {
      if (!this.pronunciationEnabled) return;

      let shouldReprocess = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (
              node.nodeType === Node.ELEMENT_NODE ||
              node.nodeType === Node.TEXT_NODE
            ) {
              // Check if the added content contains target language text
              const text = node.textContent || "";
              if (this.containsTargetLanguage(text)) {
                shouldReprocess = true;
                break;
              }
            }
          }
        }
      });

      if (shouldReprocess) {
        // Debounce reprocessing to avoid performance issues
        clearTimeout(this.reprocessTimeout);
        this.reprocessTimeout = setTimeout(() => {
          this.addPronunciationToPage();
        }, 100);
      }
    });

    this.contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Clean up method
  destroy() {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }
    if (this.reprocessTimeout) {
      clearTimeout(this.reprocessTimeout);
    }
    this.removePronunciationFromPage();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PronunciationManager;
} else {
  window.PronunciationManager = PronunciationManager;
}
