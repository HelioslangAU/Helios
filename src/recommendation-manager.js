class RecommendationManager {
  constructor({ vocabManager, frequencyManager, pageProcessor }) {
    this.vocabManager = vocabManager;
    this.frequencyManager = frequencyManager;
    this.pageProcessor = pageProcessor;
    this.recommendationEnabled = true; // Make this a setting later
    this.recommendedSentencesCount = 0;
  }

  async init() {
    if (!this.recommendationEnabled) return;
    console.log("🚀 Initializing Recommendation Manager...");
    this.processPageForRecommendations();
  }

  processPageForRecommendations() {
    if (!this.recommendationEnabled) return;

    const knownWordsCount = this.vocabManager.getKnownWordsCount();
    const frequencyThreshold = this.calculateFrequencyThreshold(knownWordsCount);
    
    const textNodes = this.getAllTextNodes(document.body);

    for (const textNode of textNodes) {
      const sentences = this.splitIntoSentences(textNode.textContent);
      for (const sentence of sentences) {
        this.findAndHighlightT1Word(sentence, frequencyThreshold, textNode);
      }
    }
    window.bannerManager.updateRecommendedSentences(this.recommendedSentencesCount);
  }

  calculateFrequencyThreshold(knownWordsCount) {
    // Simple ratio for now: for every 1 known word, the threshold increases by 2.6
    // This gives 6500 for 2500 known words.
    return Math.max(1000, knownWordsCount * 2.6);
  }

  splitIntoSentences(text) {
    // Basic sentence splitting. This can be improved.
    return text.match(/[^.!?。！？\n]+[.!?。！？\n]+/g) || [text];
  }

  findAndHighlightT1Word(sentence, frequencyThreshold, textNode) {
    const words = this.pageProcessor.extractChineseWords(sentence);
    let unknownWords = [];
    let unknownWordInfo = null;

    for (const wordData of words) {
      const word = wordData.word;
      if (!this.vocabManager.isWordKnown(word)) {
        const frequency = this.frequencyManager.getFrequency(word);
        unknownWords.push({ word, frequency });
      }
    }

    if (unknownWords.length === 1) {
      const unknownWord = unknownWords[0];
      if (unknownWord.frequency && unknownWord.frequency <= frequencyThreshold) {
        // This is a T1 sentence with a word that meets the frequency criteria.
        // Now we need to highlight it.
        this.highlightWordInNode(textNode, sentence, unknownWord.word);
        this.recommendedSentencesCount++;
      }
    }
  }

  highlightWordInNode(textNode, sentence, wordToHighlight) {
    const sentenceStartIndex = textNode.textContent.indexOf(sentence);
    if (sentenceStartIndex === -1) return;

    const wordStartIndexInSentence = sentence.indexOf(wordToHighlight);
    if (wordStartIndexInSentence === -1) return;

    const highlightStartIndex = sentenceStartIndex + wordStartIndexInSentence;
    const highlightEndIndex = highlightStartIndex + wordToHighlight.length;

    if (highlightStartIndex >= 0 && highlightEndIndex > highlightStartIndex) {
      const range = document.createRange();
      range.setStart(textNode, highlightStartIndex);
      range.setEnd(textNode, highlightEndIndex);

      const span = document.createElement('span');
      span.className = 'helios-recommended-word';
      range.surroundContents(span);
    }
  }

  getAllTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'ruby'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('.chinese-lang-extension-popup')) {
            return NodeFilter.FILTER_REJECT;
        }
        const text = node.textContent.trim();
        return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
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
}