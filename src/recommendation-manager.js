class RecommendationManager {
  constructor({ vocabManager, frequencyManager, pageProcessor }) {
    this.vocabManager = vocabManager;
    this.frequencyManager = frequencyManager;
    this.pageProcessor = pageProcessor;
    this.recommendationEnabled = true; // Make this a setting later
    this.recommendedSentencesCount = 0;
    this.processedRecommendations = new Set(); // Track unique recommendations
  }

  async init() {
    if (!this.recommendationEnabled) return;
    console.log("🚀 Initializing Recommendation Manager...");
    this.processPageForRecommendations();
  }

  // For the main page content
  processPageForRecommendations() {
    if (!this.recommendationEnabled) return;

    // Reset everything for a new page
    this.clearRecommendations(document.body);
    this.recommendedSentencesCount = 0;
    this.processedRecommendations.clear();

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

  // For subtitle elements specifically
  processElementForRecommendations(element) {
    if (!this.recommendationEnabled) return;

    // Just clear visual highlights, don't reset the count or tracking set
    this.clearRecommendations(element);

    const knownWordsCount = this.vocabManager.getKnownWordsCount();
    const frequencyThreshold = this.calculateFrequencyThreshold(knownWordsCount);
    
    const fullText = element.textContent;
    const sentences = this.splitIntoSentences(fullText);

    for (const sentence of sentences) {
        console.log(sentence);
        this.findAndHighlightT1WordInElement(sentence, frequencyThreshold, element);
    }
    window.bannerManager.updateRecommendedSentences(this.recommendedSentencesCount);
  }

  decrementRecommendationCount() {
    this.recommendedSentencesCount--;
    window.bannerManager.updateRecommendedSentences(this.recommendedSentencesCount);
  }

  // Removes the highlight class, but leaves the span intact
  clearRecommendations(element) {
    const recommendedWords = (element || document.body).querySelectorAll('.helios-recommended-word');
    recommendedWords.forEach(node => {
        node.classList.remove('helios-recommended-word');
    });
  }

  calculateFrequencyThreshold(knownWordsCount) {
    return Math.max(1000, knownWordsCount * 2.6);
  }

  splitIntoSentences(text) {
    return text.match(/[^.!?。！？\n]+[.!?。！？\n]+/g) || [text];
  }

  // For general page content
  findAndHighlightT1Word(sentence, frequencyThreshold, textNode) {
    const words = this.pageProcessor.extractChineseWords(sentence);
    let unknownWords = [];

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
        const sentenceKey = sentence.trim();
        // Only count and highlight if it's a new recommendation
        if (!this.processedRecommendations.has(sentenceKey)) {
            this.processedRecommendations.add(sentenceKey);
            this.highlightWordInNode(textNode, sentence, unknownWord.word);
            this.recommendedSentencesCount++;
        }
      }
    }
  }

  // For subtitle elements
  findAndHighlightT1WordInElement(sentence, frequencyThreshold, element) {
    const words = this.pageProcessor.extractChineseWords(sentence);
    if (words.length === 0) return;

    let unknownWords = [];
    for (const wordData of words) {
        const word = wordData.word;
        if (!this.vocabManager.isWordKnown(word)) {
            const frequency = this.frequencyManager.getFrequency(word);
            unknownWords.push({ word, frequency });
        }
    }

    // Step 1: Determine if the sentence is a valid recommendation.
    const isRecommendation = (unknownWords.length === 1) && 
                            (unknownWords[0].frequency && unknownWords[0].frequency <= frequencyThreshold);

    if (isRecommendation) {
        const unknownWord = unknownWords[0];
        const sentenceKey = sentence.trim();

        // Step 2: Update the count only if it's a new recommendation.
        if (!this.processedRecommendations.has(sentenceKey)) {
            this.processedRecommendations.add(sentenceKey);
            this.recommendedSentencesCount++;
        }

        // Step 3: Find and highlight the specific word span within this sentence context
        this.highlightWordInElementSentence(element, sentence, unknownWord.word);
    }
  }

  // New helper method to highlight word specifically within a sentence context
  highlightWordInElementSentence(element, sentence, wordToHighlight) {
    const elementText = element.textContent;
    const sentenceStartIndex = elementText.indexOf(sentence.trim());
    
    if (sentenceStartIndex === -1) return;
    
    const sentenceEndIndex = sentenceStartIndex + sentence.trim().length;
    
    // Find all word spans and check which ones fall within this sentence
    const wordSpans = element.querySelectorAll(`span[data-word="${wordToHighlight}"]`);
    
    for (const wordSpan of wordSpans) {
      // Get the position of this word span within the element
      const range = document.createRange();
      range.setStartBefore(element.firstChild);
      range.setEndBefore(wordSpan);
      const wordPosition = range.toString().length;
      
      // Check if this word span falls within the sentence boundaries
      if (wordPosition >= sentenceStartIndex && wordPosition < sentenceEndIndex) {
        wordSpan.classList.add('helios-recommended-word');
        break; // Only highlight the first occurrence within the sentence
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