/**
 * The header badge that reports whether a change was written.
 *
 * The badge used to be a static claim — "Changes save automatically" — which
 * asked the user to trust the page rather than showing them anything. Worse,
 * `saveSettings` swallowed its own failures into `console.error`, so a save
 * that never landed looked exactly like one that did.
 *
 * This gives the badge three states. It is deliberately the only place the
 * page reports a save: a per-row confirmation on 39 rows would be noise, and
 * the badge is already where the user was told saving happens.
 */

export type SaveState = 'idle' | 'saved' | 'failed';

/** How long "Saved" holds before the badge returns to its resting text. */
const SAVED_HOLD_MS = 1800;

const TEXT: Record<SaveState, string> = {
  idle: 'Changes save automatically',
  saved: 'Saved',
  failed: 'Could not save',
};

let resetTimer: ReturnType<typeof setTimeout> | undefined;

function badge(): HTMLElement | null {
  return document.getElementById('save-state');
}

/**
 * Put the badge into `state`.
 *
 * `saved` returns to `idle` on its own. `failed` does not: a change the user
 * believes they made but which was never written is worth leaving on screen
 * until the next save succeeds.
 */
export function reportSaveState(state: SaveState): void {
  const el = badge();
  if (!el) return;

  clearTimeout(resetTimer);
  resetTimer = undefined;

  el.textContent = TEXT[state];
  el.dataset.state = state;

  if (state === 'saved') {
    resetTimer = setTimeout(() => {
      const current = badge();
      // Only stand down if nothing has moved the badge on in the meantime.
      if (current?.dataset.state === 'saved') {
        current.textContent = TEXT.idle;
        current.dataset.state = 'idle';
      }
      resetTimer = undefined;
    }, SAVED_HOLD_MS);
  }
}

/** Test seam: drop the pending reset so a suite does not leak a timer. */
export function resetSaveIndicator(): void {
  clearTimeout(resetTimer);
  resetTimer = undefined;
}
