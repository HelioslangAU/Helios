/**
 * Filter every setting on the page from one box.
 *
 * Thirty-nine settings live across seven sections, and the hard question is
 * never "what is this control" — it is "which section is it in". Answering
 * that by guessing costs two clicks per wrong guess, so the search deliberately
 * spans *all* sections rather than the open one: a query for "popup" has to
 * find the timeout on Popup & display while you are standing on General.
 *
 * That means every section has to be in the document before the first query
 * runs. Sections are fetched lazily on first visit, so the first keystroke
 * pulls in whichever ones have not been opened yet.
 */

import { SETTINGS_TABS } from '@/config/paths';

/** What a section is called, for matching and for the result headings. */
const SECTION_NAMES: Record<string, string> = {
  general: 'General',
  popup: 'Popup & display',
  shortcuts: 'Keyboard shortcuts',
  'video-player': 'Video player',
  anki: 'Anki integration',
  vocabulary: 'Vocabulary',
  advanced: 'Advanced',
};

/** Loads a section's fragment into the page. Supplied by the settings manager. */
export type TabLoader = (tab: string) => Promise<void>;

interface SearchDeps {
  loadTab: TabLoader;
  isLoaded: (tab: string) => boolean;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The text a row can be found by: its own label and explanation, the title of
 * the card holding it, and the name of the section. Searching the section name
 * is what lets "anki" pull up the whole Anki section rather than only the rows
 * that happen to spell it.
 */
function haystack(setting: HTMLElement): string {
  const card = setting.closest('.settings-group');
  const section = setting.closest('.tab-content');
  return normalise(
    [
      setting.textContent ?? '',
      card?.querySelector('.group-title')?.textContent ?? '',
      section ? (SECTION_NAMES[section.id] ?? '') : '',
    ].join(' '),
  );
}

export class SettingsSearch {
  private readonly deps: SearchDeps;
  private input: HTMLInputElement | null = null;
  private summary: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private loadedEverything = false;

  constructor(deps: SearchDeps) {
    this.deps = deps;
  }

  attach(): void {
    this.input = document.getElementById('settings-search') as HTMLInputElement | null;
    this.summary = document.getElementById('search-summary');
    this.root = document.querySelector('.settings');
    if (!this.input) return;

    this.input.addEventListener('input', () => void this.run());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.clear();
    });

    // `/` is the shorthand people already have for "search this page"; it must
    // not fire while they are typing into a field or recording a shortcut.
    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      this.input?.focus();
    });
  }

  /** Pull in every section that has not been opened yet. */
  private async loadEverything(): Promise<void> {
    if (this.loadedEverything) return;
    await Promise.all(
      SETTINGS_TABS.filter((tab) => !this.deps.isLoaded(tab)).map((tab) =>
        this.deps.loadTab(tab).catch(() => {
          // A section that will not load must not take the search down with
          // it; the rest of the page is still searchable.
        }),
      ),
    );
    this.loadedEverything = true;
  }

  private async run(): Promise<void> {
    const query = normalise(this.input?.value ?? '');
    if (!query) {
      this.exitSearchMode();
      return;
    }

    await this.loadEverything();
    // The box may have been cleared while the fragments were in flight.
    if (!normalise(this.input?.value ?? '')) {
      this.exitSearchMode();
      return;
    }

    this.root?.setAttribute('data-searching', 'true');

    let hits = 0;
    for (const section of document.querySelectorAll<HTMLElement>('.tab-content')) {
      let sectionHits = 0;

      for (const card of section.querySelectorAll<HTMLElement>('.settings-group')) {
        let cardHits = 0;

        for (const setting of card.querySelectorAll<HTMLElement>('.setting')) {
          const match = haystack(setting).includes(query);
          setting.hidden = !match;
          if (match) cardHits++;
        }

        // A card whose own title matches but whose rows do not still belongs in
        // the results — it is how someone finds a whole area by name.
        const cardMatches =
          cardHits > 0 || normalise(card.textContent ?? '').includes(query);
        if (cardMatches && cardHits === 0) {
          for (const setting of card.querySelectorAll<HTMLElement>('.setting')) {
            setting.hidden = false;
          }
        }

        card.hidden = !cardMatches;
        if (cardMatches) sectionHits += cardHits || 1;
      }

      section.hidden = sectionHits === 0;
      hits += sectionHits;
    }

    this.announce(hits, this.input?.value.trim() ?? '');
  }

  private announce(hits: number, query: string): void {
    if (!this.summary) return;
    this.summary.textContent =
      hits === 0
        ? `Nothing matches “${query}”`
        : `${hits} ${hits === 1 ? 'setting' : 'settings'} matching “${query}”`;
  }

  /** Put every section, card and row back and hand the page to the sidebar. */
  private exitSearchMode(): void {
    this.root?.removeAttribute('data-searching');
    for (const el of document.querySelectorAll<HTMLElement>(
      '.tab-content, .settings-group, .setting',
    )) {
      el.hidden = false;
    }
    if (this.summary) this.summary.textContent = '';
  }

  clear(): void {
    if (this.input) this.input.value = '';
    this.exitSearchMode();
    this.input?.blur();
  }
}
