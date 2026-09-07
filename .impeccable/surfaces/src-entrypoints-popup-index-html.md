---
version: 1
slug: "src-entrypoints-popup-index-html"
primary_target: "src/entrypoints/popup/index.html"
related_targets: ["src/entrypoints/popup/style.css"]
---

# Toolbar popup

Scope: `src/entrypoints/popup/` (index.html, style.css) and the parts of
`src/content/extensiontab.ts` that fill it. Visitor mode: **Operate** — opened
for a second or two, many times a day, to confirm or change one thing.

Audience: a learner mid-page on someone else's site. The task is to see whether
Helios is running, see what it is running for, and get to settings. Constraint:
~320px wide, opens under the toolbar icon, must read at a glance.

## Direction contract

THESIS: state is the composition, not a widget inside it. A horizon divides the
panel: what you are learning stands in the light above it, whether Helios is
running is decided below it. Refuses the stack of grey rows every extension
popup ships, where on/off is a switch you must find and read.

OWN-WORLD: the extension's settled system (`@/styles/theme.css`) — near-black
warm-shifted ground, Inter, the orange ramp as light rather than fill. The
horizon is a lit hairline fading to both margins; no cards, no drawn sun.

STORY: the learner opens it, sees light and their language, and closes it. Or
flips the switch and watches the sun go out.

FIRST VIEWPORT: header with mark and settings. Sky: flag, language in its own
script at display size, English name beneath — tap opens settings. Horizon
hairline. Ground: state sentence left, switch flush right.

FORM: Horizon, index 3 of seven ordered structures, fused with Language-leads
(index 4) which supplies the sky's subject. Seed key 6393d7ff.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
