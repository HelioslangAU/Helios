class PageProcessor {
  constructor(dictionaryManager, vocabManager, unknownWordElements) {
    this.dictionaryManager = dictionaryManager;
    this.vocabManager = vocabManager;
    this.unknownWordElements = new Map();
  }

  processPageForUnknownWords() {
    const textNodes = this.getAllTextNodes(document.body);

    for (const textNode of textNodes) {
      this.processTextNodeForUnknownWords(textNode);
    }

    console.log('Page processed for unknown words');
  }

  getAllTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('chinese-unknown-word') ||
              parent.classList.contains('chinese-lang-extension-popup')) {
            return NodeFilter.FILTER_REJECT;
          }
          return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    return textNodes;
  }

  processTextNodeForUnknownWords(textNode) {
    const text = textNode.textContent;
    if (!text) return;

    const chineseWords = this.extractChineseWords(text);
    if (chineseWords.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    chineseWords.forEach(({ word, start, end }) => {
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }
      const span = document.createElement('span');
      span.textContent = word;

      if (!this.vocabManager.isWordKnown(word) && this.dictionaryManager.dictionary[word]) {
        span.className = 'chinese-unknown-word';
        span.setAttribute('data-word', word);
        this.unknownWordElements.set(word, span);
      }

      fragment.appendChild(span);
      lastIndex = end;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  extractChineseWords(text) {
    const words = [];
    let i = 0;

    while (i < text.length) {
      if (this.isChineseCharacter(text[i])) {
        let longestWord = null;
        let longestLength = 0;

        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const candidate = text.substring(i, i + len);
          if ([...candidate].every(c => this.isChineseCharacter(c)) && this.dictionaryManager.dictionary[candidate]) {
            if (len > longestLength) {
              longestWord = candidate;
              longestLength = len;
            }
          }
        }

        if (longestWord) {
          words.push({
            word: longestWord,
            start: i,
            end: i + longestLength
          });
          i += longestLength;
        } else {
          if (this.dictionaryManager.dictionary[text[i]]) {
            words.push({
              word: text[i],
              start: i,
              end: i + 1
            });
          }
          i++;
        }
      } else {
        i++;
      }
    }

    return words;
  }

  updateWordStyling(word, isKnown) {
    const elements = document.querySelectorAll(`[data-word="${word}"]`);
    elements.forEach(element => {
      if (isKnown) {
        element.classList.remove('chinese-unknown-word');
      } else {
        element.classList.add('chinese-unknown-word');
      }
    });
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReprocess = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              shouldReprocess = true;
              break;
            }
          }
        }
      });

      if (shouldReprocess) {
        setTimeout(() => this.processPageForUnknownWords(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  isChineseCharacter(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x20000 && code <= 0x2A6DF);
  }

    getCharacterAtPosition(event) {
    try {
      const accurateResult = this.getCharacterAtPositionAccurate(event);
      if (accurateResult) return accurateResult;
      
      return this.getCharacterAtPositionFallback(event);
    } catch (error) {
      console.error('Error getting character at position:', error);
      return null;
    }
  }

  getCharacterAtPositionAccurate(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element) return null;

    const textNodes = this.getTextNodes(element);
    
    for (const textNode of textNodes) {
      const result = this.checkTextNodeAtPosition(textNode, event.clientX, event.clientY);
      if (result) return result;
    }
    
    return null;
  }

  checkTextNodeAtPosition(textNode, x, y) {
    const text = textNode.textContent;
    if (!text) return null;

    const range = document.createRange();
    
    for (let i = 0; i < text.length; i++) {
      if (!this.isChineseCharacter(text[i])) continue;
      
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      
      const rect = range.getBoundingClientRect();
      
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom) {
        
        const wordResult = this.findLongestWord(textNode, i);
        if (wordResult) return wordResult;
        
        return { 
          word: text[i], 
          textNode, 
          start: i, 
          end: i + 1 
        };
      }
    }
    
    return null;
  }

  findLongestWord(textNode, startOffset) {
    const text = textNode.textContent;
    
    for (let len = 5; len >= 1; len--) {
      if (startOffset + len <= text.length) {
        const candidate = text.substring(startOffset, startOffset + len);
        
        if ([...candidate].every(c => this.isChineseCharacter(c)) &&
            this.dictionaryManager.dictionary[candidate]) {
          return { 
            word: candidate, 
            textNode, 
            start: startOffset, 
            end: startOffset + len 
          };
        }
      }
    }
    
    return null;
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    
    return textNodes;
  }

  getCharacterAtPositionFallback(event) {
    const offsets = [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 }
    ];
    
    for (const offset of offsets) {
      const result = this.tryGetCharacterAtPoint(
        event.clientX + offset.x, 
        event.clientY + offset.y
      );
      if (result) return result;
    }
    
    return null;
  }

  tryGetCharacterAtPoint(x, y) {
    const caret = document.caretPositionFromPoint?.(x, y);
    if (!caret?.offsetNode) return null;

    let { offsetNode: textNode, offset } = caret;
    if (textNode.nodeType !== Node.TEXT_NODE) return null;

    for (let len = 5; len >= 1; len--) {
      if (offset + len <= textNode.textContent.length) {
        const candidate = textNode.textContent.substring(offset, offset + len);
        if ([...candidate].every(c => this.isChineseCharacter(c)) &&
            this.dictionaryManager.dictionary[candidate]) {
          return { word: candidate, textNode, start: offset, end: offset + len };
        }
      }
    }

    const text = textNode.textContent;
    if (this.isChineseCharacter(text[offset])) {
      return { word: text[offset], textNode, start: offset, end: offset + 1 };
    }

    return null;
  }
}

