import { services } from '@/content/services';

/**
 * Extract potential words from text.
 *
 * For the space-less languages (zh/ja/ko) every character plus every substring
 * up to 10 characters long is a candidate, because the dictionary lookup is
 * what decides where the word boundaries actually are.
 */
export function extractPotentialWords(text: string): string[] {
  const words: string[] = [];
  const currentLang = services.languageRegistry?.getCurrentLanguage();

  if (currentLang && ['zh', 'ja', 'ko'].includes(currentLang)) {
    const seen = new Set<string>();

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char.trim() && !seen.has(char)) {
        words.push(char);
        seen.add(char);
      }
    }

    for (let len = 2; len <= 10; len++) {
      for (let i = 0; i <= text.length - len; i++) {
        const candidate = text.substring(i, i + len);
        if (candidate.trim() && !seen.has(candidate)) {
          words.push(candidate);
          seen.add(candidate);
        }
      }
    }
  } else {
    const matches = text.match(/[\p{L}\p{M}]+(?:[''-][\p{L}\p{M}]+)*/gu);
    if (matches) {
      words.push(...matches.map(w => w.toLowerCase()));
    }
  }

  return [...new Set(words)];
}
