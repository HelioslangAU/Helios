import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsSearch } from '@/content/settings/settings-search';

/**
 * Two sections, one of them not yet fetched, which is the case the search
 * exists for: the setting you cannot name is usually in the section you have
 * not opened.
 */

const GENERAL = `
  <section class="settings-group">
    <h2 class="group-title">Extension</h2>
    <div class="settings-rows">
      <div class="setting">
        <span class="form-label">Extension enabled</span>
        <p class="help-text">Turns every Helios feature off at once.</p>
      </div>
      <div class="setting">
        <span class="form-label">Activation key</span>
        <p class="help-text">Hold this key and hover a word.</p>
      </div>
    </div>
  </section>`;

const POPUP = `
  <section class="settings-group">
    <h2 class="group-title">Staying open</h2>
    <div class="settings-rows">
      <div class="setting">
        <span class="form-label">Close it after</span>
        <p class="help-text">Closes the card on its own after this many seconds.</p>
      </div>
    </div>
  </section>`;

function render(): void {
  document.body.innerHTML = `
    <div class="settings">
      <input type="search" id="settings-search" />
      <button class="nav-item active" data-tab="general"></button>
      <p id="search-summary"></p>
      <div class="tab-content active" id="general" data-section-name="General">${GENERAL}</div>
      <div class="tab-content" id="popup" data-section-name="Popup &amp; display"></div>
      <div class="tab-content" id="shortcuts" data-section-name="Keyboard shortcuts"></div>
      <div class="tab-content" id="video-player" data-section-name="Video player"></div>
      <div class="tab-content" id="anki" data-section-name="Anki integration"></div>
      <div class="tab-content" id="vocabulary" data-section-name="Vocabulary"></div>
      <div class="tab-content" id="advanced" data-section-name="Advanced"></div>
    </div>`;
}

const input = () => document.getElementById('settings-search') as HTMLInputElement;
const root = () => document.querySelector('.settings')!;
const summary = () => document.getElementById('search-summary')!;
const visibleLabels = () =>
  [...document.querySelectorAll<HTMLElement>('.setting')]
    .filter(
      (s) =>
        !s.hidden &&
        !s.closest<HTMLElement>('.settings-group')?.hidden &&
        !s.closest<HTMLElement>('.tab-content')?.hidden,
    )
    .map((s) => s.querySelector('.form-label')?.textContent);

/** Stands in for the manager: `popup` arrives only when asked for. */
function makeDeps() {
  const loaded = new Set(['general']);
  return {
    loaded,
    loadTab: vi.fn(async (tab: string) => {
      if (tab === 'popup') document.getElementById('popup')!.innerHTML = POPUP;
      loaded.add(tab);
    }),
    isLoaded: (tab: string) => loaded.has(tab),
  };
}

async function type(search: SettingsSearch, value: string): Promise<void> {
  input().value = value;
  input().dispatchEvent(new Event('input'));
  // Let loadEverything and the filter pass settle.
  await vi.waitFor(() => {
    if (value && !root().hasAttribute('data-searching')) throw new Error('not yet');
  });
}

describe('settings search', () => {
  let deps: ReturnType<typeof makeDeps>;
  let search: SettingsSearch;

  beforeEach(() => {
    render();
    deps = makeDeps();
    search = new SettingsSearch({ loadTab: deps.loadTab, isLoaded: deps.isLoaded });
    search.attach();
  });

  it('finds a setting in a section that was never opened', async () => {
    await type(search, 'seconds');

    expect(deps.loadTab).toHaveBeenCalledWith('popup');
    expect(visibleLabels()).toEqual(['Close it after']);
  });

  it('fetches each unopened section once, however much is typed', async () => {
    await type(search, 'clo');
    await type(search, 'close');
    await type(search, 'close it');

    const popupLoads = deps.loadTab.mock.calls.filter(([t]) => t === 'popup');
    expect(popupLoads).toHaveLength(1);
    // The section already in the document is never re-fetched.
    expect(deps.loadTab).not.toHaveBeenCalledWith('general');
  });

  it('matches the explanation, not only the label', async () => {
    await type(search, 'hover a word');
    expect(visibleLabels()).toEqual(['Activation key']);
  });

  it('pulls up a whole area by its section name', async () => {
    await type(search, 'popup');

    expect(document.getElementById('popup')!.hidden).toBe(false);
    expect(document.getElementById('general')!.hidden).toBe(true);
  });

  it('keeps a card whose title matches even when no row does', async () => {
    await type(search, 'staying open');
    expect(visibleLabels()).toEqual(['Close it after']);
  });

  it('says so when nothing matches', async () => {
    await type(search, 'zzzz');

    expect(summary().textContent).toBe('Nothing matches “zzzz”');
    expect(visibleLabels()).toEqual([]);
  });

  it('counts what it found, and gets the singular right', async () => {
    await type(search, 'seconds');
    expect(summary().textContent).toBe('1 setting matching “seconds”');

    // Both rows in the Extension card, reached through the card's own title.
    await type(search, 'extension');
    expect(summary().textContent).toBe('2 settings matching “extension”');
  });

  it('restores every section, card and row when cleared', async () => {
    await type(search, 'seconds');
    search.clear();

    expect(root().hasAttribute('data-searching')).toBe(false);
    expect([...document.querySelectorAll<HTMLElement>('.tab-content, .settings-group, .setting')]
      .every((el) => !el.hidden)).toBe(true);
    expect(summary().textContent).toBe('');
  });

  it('leaves search mode when the box is emptied', async () => {
    await type(search, 'seconds');
    input().value = '';
    input().dispatchEvent(new Event('input'));

    await vi.waitFor(() => {
      if (root().hasAttribute('data-searching')) throw new Error('still searching');
    });
  });

  it('ignores case and stray whitespace', async () => {
    await type(search, '  CLOSE   IT  ');
    expect(visibleLabels()).toEqual(['Close it after']);
  });

  it('survives a section that will not load', async () => {
    deps.loadTab.mockImplementation(async (tab: string) => {
      if (tab === 'popup') throw new Error('404');
      deps.loaded.add(tab);
    });

    await type(search, 'activation');
    expect(visibleLabels()).toEqual(['Activation key']);
  });

  it('focuses the box on "/" but not while typing in a field', () => {
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(other);

    other.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(input());
  });
});
