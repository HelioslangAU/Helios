import { describe, it, expect, beforeEach } from 'vitest';
import { HeliosSettingsAnki } from '@/content/settings/settings-anki';
import type { HeliosSettingsManager } from '@/content/settings/helios-settings';

/**
 * Every section's fragment is loaded into one document, so the page always has
 * several `.help-text` notes and General's comes first. These tests pin the
 * connection failure to the note that belongs to it.
 */

const GENERAL_HELP = 'Turns every Helios feature off at once.';
const ANKI_HELP = 'Anki has to be open, with the AnkiConnect add-on installed.';

function renderSettingsPage(): void {
  document.body.innerHTML = `
    <div id="general" class="tab-content">
      <div class="settings-rows">
        <div class="setting">
          <span class="form-label">Extension enabled</span>
          <p class="help-text">${GENERAL_HELP}</p>
        </div>
      </div>
    </div>
    <div id="anki" class="tab-content active">
      <div class="settings-rows">
        <div class="setting">
          <span class="form-label">AnkiConnect</span>
          <div class="status-indicator status-checking" id="anki-connection-status">
            <span>&#9679;</span><span>Checking</span>
          </div>
          <p class="help-text">${ANKI_HELP}</p>
        </div>
      </div>
    </div>
  `;
}

function newAnkiSettings(): HeliosSettingsAnki {
  // The constructor only assigns fields; nothing here reaches the manager.
  return new HeliosSettingsAnki({} as HeliosSettingsManager);
}

const generalHelp = () => document.querySelector<HTMLElement>('#general .help-text')!;
const ankiHelp = () => document.querySelector<HTMLElement>('#anki .help-text')!;

describe('Anki connection failure note', () => {
  beforeEach(renderSettingsPage);

  it('writes the failure under the connection row, not the first note on the page', () => {
    newAnkiSettings().showConnectionError('Message timeout');

    expect(ankiHelp().textContent).toContain('Connection Failed');
    expect(ankiHelp().textContent).toContain('Message timeout');
    // The regression: this note belongs to General's "Extension enabled" row.
    expect(generalHelp().textContent).toBe(GENERAL_HELP);
    expect(generalHelp().style.color).toBe('');
  });

  it('marks the note as an error', () => {
    newAnkiSettings().showConnectionError();

    expect(ankiHelp().style.color).toBe('var(--helios-error)');
  });

  it('restores the original note when the connection later succeeds', () => {
    const anki = newAnkiSettings();

    anki.showConnectionError('Message timeout');
    anki.clearConnectionError();

    expect(ankiHelp().textContent?.trim()).toBe(ANKI_HELP);
    expect(ankiHelp().style.color).toBe('');
  });

  it('does not save an earlier failure as the copy to restore', () => {
    const anki = newAnkiSettings();

    anki.showConnectionError('first failure');
    anki.showConnectionError('second failure');
    anki.clearConnectionError();

    expect(ankiHelp().textContent?.trim()).toBe(ANKI_HELP);
  });

  it('is a no-op when the connection never failed', () => {
    newAnkiSettings().clearConnectionError();

    expect(ankiHelp().textContent?.trim()).toBe(ANKI_HELP);
  });
});
