/**
 * Pure helpers for turning YouTube's caption track list into the language
 * options the sidebar's secondary-subtitle dropdown shows.
 */

/** Language code to proper name mapping */
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
  'tr': 'Turkish',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'id': 'Indonesian',
  'ms': 'Malay',
  'cs': 'Czech',
  'da': 'Danish',
  'fi': 'Finnish',
  'el': 'Greek',
  'he': 'Hebrew',
  'hu': 'Hungarian',
  'no': 'Norwegian',
  'ro': 'Romanian',
  'sk': 'Slovak',
  'uk': 'Ukrainian'
};

/**
 * Get proper display name for language
 */
export function getLanguageDisplayName(youtubeName: string, langCode: string): string {
  // If YouTube provides a good name, use it (especially for Chinese variants)
  if (youtubeName && youtubeName.length > 2 && !youtubeName.includes('-')) {
    return youtubeName;
  }

  // Otherwise, use our mapping
  const baseCode = langCode.split('-')[0];
  return LANGUAGE_NAMES[baseCode] || youtubeName || langCode;
}

/**
 * Collapse a track list into unique language entries.
 * Key: full language code (e.g., "en", "zh-Hans", "zh-Hant")
 * Value: display name
 */
export function buildLanguageMap(tracks: any[]): Map<string, string> {
  const languageMap = new Map<string, string>();

  tracks.forEach(track => {
    const langCode = track.language;
    const langName = track.languageName || track.language;

    if (langCode && !languageMap.has(langCode)) {
      // Keep Chinese variants separate
      if (langCode.startsWith('zh')) {
        languageMap.set(langCode, langName);
      } else {
        // For other languages, use base code but keep full name
        const baseCode = langCode.split('-')[0];
        if (!languageMap.has(baseCode)) {
          languageMap.set(baseCode, getLanguageDisplayName(langName, langCode));
        }
      }
    }
  });

  return languageMap;
}

/**
 * Language entries sorted alphabetically by display name.
 */
export function sortLanguagesByName(languageMap: Map<string, string>): Array<[string, string]> {
  return Array.from(languageMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
}
