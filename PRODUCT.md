# Product

<!-- impeccable:product-schema 1 -->

> Written from repository evidence and the user's brief rather than an interview —
> the interview round was declined. Lines marked [inferred] are hypotheses drawn
> from code, not confirmed product truth, and should be corrected on sight.

## Platform

web

## Users

[inferred] People reading or watching native-language material who want to look
words up without leaving the page. The vocabulary model (known / learning /
ignored, tracked per language) and the one-click Anki pipeline point at learners
already doing immersion rather than beginners working through lessons.

Supported languages ship as first-class adapters, not a Japanese-first tool
stretched to fit: Chinese (with jieba segmentation), English, Spanish, French.

## Product Purpose

Read and watch real content in a language you're learning, and look words up in
place. Helios detects words on the page, marks what you know, shows definitions
on hover, and sends cards to Anki without breaking reading flow.

Success is a session where the learner keeps reading — lookups cost a hover, not
a context switch.

## Positioning

[inferred] The same dictionary, vocabulary state and Anki pipeline works both on
ordinary web pages and over YouTube / Netflix subtitles, from one install and one
vocabulary. Neighbouring tools tend to own one of those surfaces.

Helios also tracks comprehension of the page itself — what share of the words the
learner already knows — which is state a pure lookup tool does not keep.

## Operating Context

The learner is mid-page on someone else's website, or mid-episode on a streaming
site. The extension is a guest in a hostile styling environment and must not
interrupt: hold Shift, hover a word, read, keep going.

Onboarding runs once, in its own tab, before any of that has happened.

## Capabilities and Constraints

- Hover lookup with pronunciation, definitions, and frequency.
- Per-language vocabulary state: known / learning / ignored.
- Anki card creation via AnkiConnect, optionally with screenshot and sentence audio.
- Subtitle handling on YouTube and Netflix, plus drag-and-dropped SRT/VTT files.
- Comprehension statistics per page.
- Chromium only: the dictionary is hosted in an offscreen document, an API
  Firefox does not have.
- The dictionary is downloaded and cached per language, not bundled.

## Brand Commitments

Name: Helios. There is a marketing site at `../helios-web-new` (Next.js +
Tailwind) whose palette is an orange gradient (#ff6b47 → #ffb347) on a near-black
ground, set in Inter.

[unconfirmed] Whether that palette binds this surface is open. The user asked for
a complete redesign of onboarding after rejecting a version built to match the
site, and named Impeccable — whose rules call out gradient-as-decoration, nested
cards, and Inter specifically. Treat the site's look as evidence, not authority,
until the user says otherwise.

## Evidence on Hand

- Working extension: hover lookup, video subtitles, Anki integration, settings.
- Real dictionary and frequency data; real onboarding vocabulary lists
  (5k-word CSVs per language).
- No testimonials, user counts, benchmarks, or pricing exist. Do not invent any.

## Product Principles

1. Reading is the activity; the extension is never the activity.
2. The learner's vocabulary state is the durable asset — everything else serves it.
3. One install covers page and video; the learner should not think about which.
4. A guest on other people's pages: never break their layout, never get broken by it.

## Accessibility & Inclusion

[inferred] No product-specific standard has been established. The onboarding is
keyboard-reachable in its current form and should stay that way; the lookup
interaction is Shift-plus-hover, which is not reachable by keyboard alone.
