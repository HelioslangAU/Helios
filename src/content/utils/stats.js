function getStats(dictionaryManager, vocabManager) {
  if (!dictionaryManager || !vocabManager) return null;

  const totalWords = Object.keys(dictionaryManager.dictionary || {}).length;
  const knownWords = vocabManager.knownWords?.size || 0;
  const unknownWordsOnPage = document.querySelectorAll(
    ".chinese-unknown-word"
  ).length;

  return {
    totalWords,
    knownWords,
    unknownWordsOnPage,
    knowledgePercentage:
      totalWords > 0 ? ((knownWords / totalWords) * 100).toFixed(1) : 0,
  };
}


