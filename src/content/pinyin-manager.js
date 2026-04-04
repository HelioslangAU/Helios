class PinyinManager {
  constructor(dictionaryManager, pageProcessor) {
    this.dictionaryManager = dictionaryManager;
    this.pageProcessor = pageProcessor;
    this.pinyinEnabled = false;
    this.processedElements = new Set();
    this.originalTextNodes = new Map(); // Store original text for restoration
  }

  isEnabled() {
    return this.pinyinEnabled;
  }

  enablePinyin() {
    if (!this.pinyinEnabled) {
      this.togglePinyin();
    }
  }

  disablePinyin() {
    if (this.pinyinEnabled) {
      this.togglePinyin();
    }
  }

  togglePinyin() {
    this.pinyinEnabled = !this.pinyinEnabled;
    console.log("🔤 Pinyin toggle:", this.pinyinEnabled ? "ON" : "OFF");

    if (this.pinyinEnabled) {
      this.addPinyinToPage();
    } else {
      this.removePinyinFromPage();
    }

    // Notify sidebar of change
    if (window.sidebarManager) {
      window.sidebarManager.onPinyinToggle(this.pinyinEnabled);
    }

    // Dispatch event for subtitle overlay to re-render with/without pinyin
    document.dispatchEvent(new CustomEvent('helios-pinyin-toggled', {
      detail: { enabled: this.pinyinEnabled }
    }));
  }

  addPinyinToPage() {
    console.log("🔤 Adding pinyin to page...");
    // Ensure styles are present for ruby rendering
    this.injectPinyinCSS && this.injectPinyinCSS();

    // Get all text nodes that contain Chinese characters
    const textNodes = this.getAllChineseTextNodes(document.body);

    for (const textNode of textNodes) {
      this.processTextNodeForPinyin(textNode);
    }

    console.log("🔤 Pinyin added to", textNodes.length, "text nodes");
  }

  removePinyinFromPage() {
    console.log("🔤 Removing pinyin from page...");

    // Remove all ruby elements and restore original text
    const rubyElements = document.querySelectorAll("ruby.helios-pinyin");
    rubyElements.forEach((ruby) => {
      const parent = ruby.parentNode;
      const originalText = ruby.textContent; // This gets the Chinese text without the pinyin
      const textNode = document.createTextNode(originalText);
      parent.replaceChild(textNode, ruby);
    });

    // Normalize text nodes to merge adjacent ones
    this.normalizeTextNodes(document.body);

    this.processedElements.clear();
    this.originalTextNodes.clear();

    console.log("🔤 Pinyin removed from page");
  }

  // Inject minimal CSS for ruby display if not already present
  injectPinyinCSS() {
    if (document.getElementById("helios-pinyin-styles")) return;
    const style = document.createElement("style");
    style.id = "helios-pinyin-styles";
    style.textContent = `
      .helios-pinyin-wrapper { display: inline; pointer-events: none; }
      ruby.helios-pinyin { ruby-align: center; ruby-position: over; display: inline-ruby; vertical-align: baseline; pointer-events: none; }
      ruby.helios-pinyin rt { font-size: 0.6em; color: #666; line-height: 1.1; text-align: center; display: ruby-text; pointer-events: none; }
      @media (prefers-color-scheme: dark) { ruby.helios-pinyin rt { color: #aaa; } }
      ruby.helios-pinyin + ruby.helios-pinyin { margin-left: 1px; }
    `;
    document.head.appendChild(style);
  }

  getAllChineseTextNodes(element) {
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
        if (parent.closest("ruby.helios-pinyin")) {
          return NodeFilter.FILTER_REJECT;
        }

        // Only accept if contains Chinese characters
        const text = node.textContent.trim();
        return this.containsChinese(text)
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

  processTextNodeForPinyin(textNode) {
    const text = textNode.textContent;
    if (!text || this.processedElements.has(textNode)) return;

    // Store original text for restoration
    this.originalTextNodes.set(textNode, text);
    this.processedElements.add(textNode);

    const rubyHTML = this.convertTextToRuby(text);

    if (rubyHTML !== text) {
      const wrapper = document.createElement("span");
      wrapper.innerHTML = rubyHTML;
      wrapper.classList.add("helios-pinyin-wrapper");

      textNode.parentNode.replaceChild(wrapper, textNode);
    }
  }

  convertTextToRuby(text) {
    let result = "";
    let i = 0;

    while (i < text.length) {
      if (this.isChineseCharacter(text[i])) {
        // Try to find the longest word first (word-by-word approach)
        let longestWord = null;
        let longestLength = 0;

        // Check for words of length 5 down to 1
        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);

          // Make sure all characters in candidate are Chinese
          if ([...candidate].every((c) => this.isChineseCharacter(c))) {
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
          // Found a word - get its pinyin
          const pinyin = this.getPinyinForWord(longestWord);
          if (pinyin) {
            result += `<ruby class="helios-pinyin">${longestWord}<rt>${pinyin}</rt></ruby>`;
          } else {
            // Fallback to character-by-character
            result += this.convertCharactersToPinyin(longestWord);
          }
          i += longestLength;
        } else {
          // No word found, process single character
          const char = text[i];
          const pinyin = this.getPinyinForCharacter(char);
          if (pinyin) {
            result += `<ruby class="helios-pinyin">${char}<rt>${pinyin}</rt></ruby>`;
          } else {
            result += char;
          }
          i++;
        }
      } else {
        // Non-Chinese character, add as-is
        result += text[i];
        i++;
      }
    }

    return result;
  }

  convertCharactersToPinyin(word) {
    let result = "";
    for (const char of word) {
      const pinyin = this.getPinyinForCharacter(char);
      if (pinyin) {
        result += `<ruby class="helios-pinyin">${char}<rt>${pinyin}</rt></ruby>`;
      } else {
        result += char;
      }
    }
    return result;
  }

  getPinyinForWord(word) {
    const entries = this.dictionaryManager.dictionary[word];
    if (entries && entries.length > 0) {
      // Use the first entry's pinyin
      return entries[0].pinyin;
    }
    return null;
  }

  getPinyinForCharacter(character) {
    const entries = this.dictionaryManager.dictionary[character];
    if (entries && entries.length > 0) {
      // For single characters, use the first entry's pinyin
      return entries[0].pinyin;
    }
    return null;
  }

  containsChinese(text) {
    return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
  }

  isChineseCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df)
    );
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
      if (!this.pinyinEnabled) return;

      let shouldReprocess = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (
              node.nodeType === Node.ELEMENT_NODE ||
              node.nodeType === Node.TEXT_NODE
            ) {
              // Check if the added content contains Chinese text
              const text = node.textContent || "";
              if (this.containsChinese(text)) {
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
          this.addPinyinToPage();
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
    this.removePinyinFromPage();
  }
}
