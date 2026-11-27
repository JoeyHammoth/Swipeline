# Accessibility audit

What has actually been checked, on which surface, and what still needs a person.
This page records results from a run, not intentions.

## Scope

| Surface | In scope | Automated check | Manual pass |
|---|---|---|---|
| Binding fixture pages (`/react.html`, `/element.html`, `/vue.html`, `/svelte.html`) | Yes | axe + the audit suite + binding conformance | Not done |
| Card templates (`text`, `media`, `facts`) as rendered by the bindings | Yes, through the fixtures | axe + conformance | Not done |
| Example apps (`books-react`, `recipes-react`, `movies-tmdb`, `papers-html`) | No — not scanned | — | — |
| React Native (`examples/books-expo`) | No — no device run | — | — |

## Automated results

Run on 2026-11-27, Chromium, `PLAYWRIGHT_CHANNEL=chrome pnpm e2e` — 24 tests, all
passing. (The bundled Chromium cannot install on this machine; CI uses
Playwright's pinned build.) `e2e.yml` runs the same specs on pull requests that
touch the bindings, nightly and on demand.

**axe**, with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`:

- 0 violations on all four fixture pages in the default theme.
- 0 violations again with forced colours active.
- The 2.1 and 2.2 rule sets add focus-not-obscured, a non-drag way to operate the
  deck, and target size, which the 2.0 tags miss.

**Behavioural checks**, on each of the four bindings:

- **Keyboard only.** `Tab` reaches the deck, `ArrowRight` advances it, focus stays
  on the deck instead of falling back to `<body>`, `Tab` reaches an action button
  and `Enter` activates it.
- **Reflow.** The page does not scroll horizontally at 320 CSS px.
- **Target size.** Every `[data-action]` control is at least 24×24 px (WCAG 2.2,
  2.5.8). React's published stylesheet renders 34 px tall controls; the
  consumer-side stylesheet used for the other bindings sets 44 px.
- **Reduced motion.** A key press still advances the deck with
  `prefers-reduced-motion: reduce` emulated.
- **Binding conformance.** 7/7 checks per binding in the same run.

## What this audit found

- **The axe scan was passing on an empty page.** The Vue, Svelte and Web Component
  fixtures only mounted a deck inside the conformance call, and the suite tears its
  deck down before returning — so axe analysed an empty `<main>`. The fixtures now
  mount on load, the scan runs before the suite, and a `toContain('First card')`
  guard fails the test if the page renders nothing.
- **The fixtures were unstyled.** Only React ships a stylesheet, so its fixture now
  imports the published one and the other three import a consumer-side stylesheet
  written the way their READMEs describe. Without it the action buttons were 21 px
  tall, under the 24 px minimum.

## Manual checklist

Each item is unverified until someone with the tool records the result here.

### Screen readers

- [ ] VoiceOver on macOS with Safari: every fixture page announces the card with
      its title and position on advance, and each button has a usable name.
- [ ] VoiceOver on iOS with `examples/books-expo`: same, plus the announcement not
      interrupting a drag in progress.
- [ ] TalkBack on Android with `examples/books-expo`: labels, disabled undo state,
      and one announcement per card.
- [ ] NVDA on Windows with Firefox: live-region politeness, focus after advance,
      and that a long card body is readable on demand rather than forced.

### Switch, voice and touch

- [ ] Switch control or voice control can activate every action without a drag.
- [ ] iOS and Android: targets are at least 44×44 pt / 48×48 dp in the native deck.
- [ ] A swipe that starts on text scrolls when the user meant to scroll, and
      commits when the user meant to swipe.

### Visual

- [ ] 200% browser zoom, not just the 320 px viewport the suite emulates: no
      clipped card content.
- [ ] Forced-colours mode checked by eye, not only by axe.

## Known gaps

- **AAA.** No AAA rules are run (contrast 7:1, sign language, extended audio).
- **Example apps and the React Native deck are unscanned.** The audit covers the
  binding fixtures only.
- **Hydration.** Server-rendered markup is not compared against the hydrated tree,
  so a mismatch that reorders focusable elements would not be caught.
- **Assistive technology.** Everything in the manual checklist above is still
  open; no screen reader has been run against a deck in this repository.
