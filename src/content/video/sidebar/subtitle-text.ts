/**
 * Tokenizes subtitle text into the candidate words the sidebar preloads from
 * the dictionary.
 */

const CJK_LANGUAGES = ['zh', 'ja', 'ko'];

/**
 * Extract potential words from text for preloading.
 *
 * @param text - Text to extract words from
 * @param currentLang - Active language code, or null/undefined when none is set
 * @param getMaxWordLength - Longest CJK sequence to emit. Lazy because the
 *   adapter's config getter throws when unconfigured, and space-separated
 *   languages must not touch it at all.
 * @returns Array of potential words
 */
export function extractPotentialWords(
  text: string,
  currentLang: string | null | undefined,
  getMaxWordLength: () => number
): string[] {
  const words: string[] = [];

  if (currentLang && CJK_LANGUAGES.includes(currentLang)) {
    // For CJK languages, extract unique characters and sequences up to maxWordLength
    // This ensures longer words (like idioms and chengyus) are preloaded
    const seen = new Set<string>();
    const maxWordLength = getMaxWordLength();

    // Extract single characters (keep everything from subtitles except whitespace)
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char.trim() && !seen.has(char)) {
        words.push(char);
        seen.add(char);
      }
    }

    // Extract sequences from 2 to maxWordLength characters
    // This ensures longer words (4+ characters like idioms/chengyus) are preloaded
    for (let len = 2; len <= maxWordLength; len++) {
      for (let i = 0; i <= text.length - len; i++) {
        const candidate = text.substring(i, i + len);
        // Keep sequences as they appear in subtitles (skip only whitespace and duplicates)
        if (candidate.trim() && !seen.has(candidate)) {
          words.push(candidate);
          seen.add(candidate);
        }
      }
    }
  } else {
    // For space-separated languages, extract words including apostrophes
    // Pattern allows apostrophes and hyphens within words (e.g., "don't", "M'appelle")
    const matches = text.match(/[\p{L}\p{M}]+(?:[''-][\p{L}\p{M}]+)*/gu);
    if (matches) {
      words.push(...matches.map(w => w.toLowerCase()));
    }
  }

  // Return unique words
  return [...new Set(words)];
}
