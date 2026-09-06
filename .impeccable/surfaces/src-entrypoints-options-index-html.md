---
version: 1
slug: "src-entrypoints-options-index-html"
primary_target: "src/entrypoints/options/index.html"
related_targets: ["src/entrypoints/options/style.css"]
---

# Settings

Scope: `src/entrypoints/options/` (shell + stylesheet) and the seven tab fragments in
`src/public/ui/settings/`. Visitor mode: **Operate** — the visitor changes a setting and
leaves. Scanability and precise controls outrank expression.

## Direction contract

THESIS: The settings page is the same printed reference as the onboarding, opened at its
back matter: a ruled index down the side, entries stacked in one column, structure carried
by rules rather than panels. It refuses the gradient masthead and the card-in-card body it
currently has, which is the arrangement every extension options page ships.

OWN-WORLD: Identical tokens to the onboarding, shared from one file rather than copied —
ground `#14151a`, ink `#f4f1ea`, rules `#2a2c35`, functional orange `#ff6b47`. Archivo for
headings and controls, Literata for explanatory prose, Chivo Mono for labels, keys and
numeric values. Flat ink only: no gradient, no glass, no card. The orange marks the open
tab, the focused control and the on-state of a switch, and nothing else.

STORY: The visitor finds the setting they came for within a second, changes it, and sees
that it took.

FIRST VIEWPORT: A running head carrying the product and the open section, ruled beneath.
The seven sections as a ruled index in the left column, the open one marked by an orange
rule in its gutter. The panel is one column of settings rows: label and control on one
line, explanation beneath in the text face, each row separated by a hairline. No section
scrolls the page sideways and nothing sits in a box.

FORM: Reverse-Printed Dictionary, inherited from the onboarding surface rather than chosen
again; this is one product, and a second identity here would be the failure.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- `helios-settings.ts` drives the page through `.nav-item[data-tab]`, `.tab-content`, and
  the `#general`/`#popup`/`#shortcuts`/`#video-player`/`#anki`/`#vocabulary`/`#advanced`
  ids; the fragments are fetched at runtime and their control ids are read by
  `settings-storage.ts`. Every id and data attribute must survive.
- Controls are the product: inputs, selects, checkboxes, switches and the hotkey recorder
  all need real hover, focus, disabled and invalid states.
- Plain CSS, no build step.
