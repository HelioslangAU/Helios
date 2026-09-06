/**
 * What the page says after the target language changes.
 *
 * A modal confirmation would be the obvious move, but it is the wrong one
 * here: switching is fully reversible and costs nothing. The dictionaries ship
 * inside the extension and load over `runtime.getURL`, so there is no download
 * to warn about, and the known, learning and ignored lists are stored per
 * language — switching hides the old ones, it never deletes them.
 *
 * A confirmation on an action like that taxes the people who meant it in order
 * to help the few who did not. Undo is the better trade: apply the change at
 * once, say plainly what happened, and offer one click back.
 */

/** How each language is named in the notice. */
const LANGUAGE_NAMES: Record<string, string> = {
  zh: 'Chinese',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  vi: 'Vietnamese',
  ko: 'Korean',
  ja: 'Japanese',
  de: 'German',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/**
 * The sentence shown after a switch. Names both languages, because the point
 * is to reassure the user that the lists they can no longer see still exist.
 */
export function describeSwitch(from: string, to: string): string {
  return `Now reading ${languageName(to)}. Your ${languageName(from)} word lists are kept.`;
}

export interface LanguageSwitchNoticeOptions {
  /** Put the select back and re-run everything a change normally triggers. */
  onUndo: (previous: string) => void;
}

/**
 * Show the notice under the target-language row.
 *
 * Returns silently when the notice element is absent, so a section rendered
 * without it is not a crash.
 */
export function showLanguageSwitchNotice(
  from: string,
  to: string,
  { onUndo }: LanguageSwitchNoticeOptions,
): void {
  const host = document.getElementById('language-switch-notice');
  if (!host || from === to) return;

  host.replaceChildren();
  host.hidden = false;

  const message = document.createElement('span');
  message.textContent = describeSwitch(from, to);

  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'link-button';
  undo.textContent = `Switch back to ${languageName(from)}`;
  undo.addEventListener('click', () => {
    hideLanguageSwitchNotice();
    onUndo(from);
  });

  host.append(message, undo);
}

export function hideLanguageSwitchNotice(): void {
  const host = document.getElementById('language-switch-notice');
  if (!host) return;
  host.replaceChildren();
  host.hidden = true;
}
