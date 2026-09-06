import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reportSaveState, resetSaveIndicator } from '@/content/settings/save-indicator';

const badge = () => document.getElementById('save-state')!;

describe('save indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<p class="running-note" id="save-state" data-state="idle" role="status">Changes save automatically</p>';
  });

  afterEach(() => {
    resetSaveIndicator();
    vi.useRealTimers();
  });

  it('acknowledges a write, then stands down on its own', () => {
    reportSaveState('saved');
    expect(badge().textContent).toBe('Saved');
    expect(badge().dataset.state).toBe('saved');

    vi.advanceTimersByTime(1800);
    expect(badge().textContent).toBe('Changes save automatically');
    expect(badge().dataset.state).toBe('idle');
  });

  it('leaves a failure on screen — a change the user believes they made but which never landed is worth keeping visible', () => {
    reportSaveState('failed');
    vi.advanceTimersByTime(60_000);

    expect(badge().textContent).toBe('Could not save');
    expect(badge().dataset.state).toBe('failed');
  });

  it('does not let a stale reset overwrite a newer state', () => {
    reportSaveState('saved');
    vi.advanceTimersByTime(1000);
    // A second write fails before the first one's reset would have fired.
    reportSaveState('failed');
    vi.advanceTimersByTime(5000);

    expect(badge().dataset.state).toBe('failed');
  });

  it('restarts the hold when a second save lands during the first', () => {
    reportSaveState('saved');
    vi.advanceTimersByTime(1500);
    reportSaveState('saved');

    vi.advanceTimersByTime(500);
    expect(badge().dataset.state).toBe('saved');

    vi.advanceTimersByTime(1300);
    expect(badge().dataset.state).toBe('idle');
  });

  it('is a no-op when the badge is absent', () => {
    document.body.innerHTML = '';
    expect(() => reportSaveState('saved')).not.toThrow();
  });
});
