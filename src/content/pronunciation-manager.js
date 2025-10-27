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
    this.isToggling = false; // Prevent concurrent toggles
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
    // Prevent toggling if already in progress
    if (this.isToggling) {
      console.log("🔤 Toggle already in progress, ignoring...");
      return;
    }

    this.isToggling = true;
    this.pronunciationEnabled = !this.pronunciationEnabled;
    console.log("🔤 Pronunciation toggle:", this.pronunciationEnabled ? "ON" : "OFF");

    // Pause mutation observer during toggle to prevent race conditions
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }

    try {
      if (this.pronunciationEnabled) {
        this.addPronunciationToPage();
      } else {
        this.removePronunciationFromPage();
      }
    } catch (error) {
      console.error("🔤 Error during pronunciation toggle:", error);
    }

    // Resume mutation observer after toggle completes
    setTimeout(() => {
      this.isToggling = false;
      if (this.pronunciationEnabled) {
        this.observeForDynamicContent();
      }
    }, 300);

    // Notify sidebar of change
    if (window.sidebarManager) {
      window.sidebarManager.onPronunciationToggle(this.pronunciationEnabled);
    }
  }

  addPronunciationToPage() {
    console.log("🔤 Adding pronunciation to page...");

    // Ensure styles are present for ruby rendering
    this.injectPronunciationCSS && this.injectPronunciationCSS();

    // Clear previous state to ensure clean slate
    this.processedElements.clear();
    this.originalTextNodes.clear();

    // Get all text nodes that contain target language characters
    const textNodes = this.getAllTargetLanguageTextNodes(document.body);
    console.log("🔤 Found", textNodes.length, "text nodes to process");

    let processed = 0;
    for (const textNode of textNodes) {
      try {
        // Verify text node is still in the document
        if (textNode.parentNode && document.contains(textNode)) {
          this.processTextNodeForPronunciation(textNode);
          processed++;
        }
      } catch (error) {
        console.warn("🔤 Error processing text node:", error);
      }
    }

    console.log("🔤 Pronunciation added to", processed, "text nodes");
  }

  removePronunciationFromPage() {
    console.log("🔤 Removing pronunciation from page...");

    // Find and remove all wrapper spans
    const wrappers = document.querySelectorAll("span.helios-pronunciation-wrapper");
    console.log("🔤 Found", wrappers.length, "wrapper spans to remove");

    wrappers.forEach((wrapper) => {
      const parent = wrapper.parentNode;
      if (!parent) return;

      // Extract ONLY the base text (not pronunciation)
      let baseText = '';
      const rubyElements = wrapper.querySelectorAll('ruby.helios-pronunciation');

      if (rubyElements.length > 0) {
        // Get text from each ruby element (excluding rt tags)
        rubyElements.forEach(ruby => {
          // Get only the text nodes that are direct children of ruby (not in rt)
          for (let node of ruby.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              baseText += node.textContent;
            }
          }
        });
      } else {
        // No ruby elements, just get text content
        baseText = wrapper.textContent;
      }

      // Create a single text node with only the base text
      const textNode = document.createTextNode(baseText);

      // Replace the entire wrapper with the text node
      parent.replaceChild(textNode, wrapper);
    });

    // Also remove any standalone ruby elements that might exist
    const rubyElements = document.querySelectorAll("ruby.helios-pronunciation");
    rubyElements.forEach((ruby) => {
      const parent = ruby.parentNode;
      if (!parent) return;

      // Extract ONLY base text (not pronunciation from rt tags)
      let baseText = '';
      for (let node of ruby.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          baseText += node.textContent;
        }
      }

      const textNode = document.createTextNode(baseText);
      parent.replaceChild(textNode, ruby);
    });

    // Normalize text nodes to merge adjacent ones
    this.normalizeTextNodes(document.body);

    // Clear tracking sets
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

        // Skip if inside popup (check ancestors, not just direct parent)
        if (parent.closest(".chinese-lang-extension-popup")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if already processed or if it's inside a ruby element or wrapper
        if (parent.closest("ruby.helios-pronunciation") || parent.closest("span.helios-pronunciation-wrapper")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if parent is our side tab
        if (parent.closest("#helios-side-tab")) {
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
