/**
 * Whether a click inside the expanded side tab should collapse it.
 *
 * The panel collapses when you click it, mirroring the way the collapsed rail
 * expands when you click that. The whole panel is therefore a dismiss target,
 * which is only safe if everything you might click *for* is excluded.
 */

/** Controls, and the labels that wrap them. */
const INTERACTIVE = 'button, a, input, label, select, textarea';

export interface CollapseContext {
  /** What the click landed on. */
  target: Element | null;
  /** Text currently selected on the page, if any. */
  selection?: string | null;
}

export function shouldCollapseOnClick({ target, selection }: CollapseContext): boolean {
  if (!target) return false;

  // Clicking a control is using the panel, not dismissing it.
  if (target.closest(INTERACTIVE)) return false;

  // Releasing a drag-select fires a click. Collapsing the panel out from under
  // someone who just selected a word would be maddening, and selecting text is
  // a reasonable thing to do to a panel full of counts.
  if ((selection ?? '').trim().length > 0) return false;

  return true;
}
