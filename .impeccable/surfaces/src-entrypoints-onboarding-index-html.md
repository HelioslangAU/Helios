---
version: 1
slug: "src-entrypoints-onboarding-index-html"
primary_target: "src/entrypoints/onboarding/index.html"
related_targets: ["src/entrypoints/onboarding/style.css"]
---

# Onboarding

Scope: `src/entrypoints/onboarding/` — the six-step first-run flow (hero, language,
native language, tutorial, level, success). Visitor mode: **Operate** — the visitor
completes setup and learns one interaction.

Structure is pinned by the user: the same steps, asking the same things, in the same
order. This is a visual replacement only.

## Direction contract

THESIS: The product is a bilingual dictionary, so the surface is set like one —
dense entry typography, running guide words, numbered senses, thumb-index tabs —
printed in reverse for a reader working at night. It refuses the centered
rounded card on a dark ground with a gradient button, which is what this category
always ships and what this page currently is.

OWN-WORLD: Flat ink only — no gradient on any surface, no glass, no glow, no
nested cards. Ground `#14151a`; text `#f4f1ea`; rules `#2a2c35`. Orange `#ff6b47`
is functional and appears nowhere decorative: it marks the live step, the active
choice, and vocabulary state. Structure is carried by hairline rules and column
edges, never by boxes. Two type roles: a workhorse grotesque for headwords and
controls, a text serif for definition-register prose; mono small caps for guide
words, codes and pronunciation. The user pinned the site's hero atmosphere, so
the ground carries it: two large soft orange orbs (10% at 140px blur) and drifting
language glyphs at 20%. That blur is ambient only — it never touches a control.

STORY: The learner understands that Helios reads pages with them, chooses their
languages and level, learns Shift-hover by doing it once on a real sentence, and
leaves knowing the extension is already working.

FIRST VIEWPORT: No card. The step fills the page as a dictionary spread. Top-left:
a running guide word in mono small caps. The step's question set as a headword at
display scale with a pronunciation bracket beside it. Senses numbered beneath in
the text face. The six steps are thumb tabs down the right edge, the live one cut
through to the ground in orange. The primary action sits inline at the end of the
last sense — not floating in a corner.

FORM: Reverse-Printed Dictionary, candidate 4 of seven grounded directions,
assigned by the roll. Seed key 518bf26b. Raised by three declined challengers:
flat-ink discipline (elbow panel console), the accent as functional mark only
(industrial quote grammar), the ruled line as structure (mixtape j-card).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- Every element id and class hook consumed by `src/ui/onboarding/onboarding.ts`
  must survive; the flow is driven by them.
- The page hosts the real dictionary popup for its tutorial step. `popup.css`
  owns that popup's appearance and is out of scope.
- Plain CSS. No Tailwind, no build step, no runtime dependency.
