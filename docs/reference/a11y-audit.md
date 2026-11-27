# Accessibility audit

What has actually been checked, on which surface, and what still needs a person.
This page records results from a run, not intentions.

## Scope

| Surface | In scope | Automated check | Manual pass |
|---|---|---|---|
| Binding fixture pages (`/react.html`, `/element.html`, `/vue.html`, `/svelte.html`) | Yes | axe + conformance suite | Not done |
| Card templates (`text`, `media`, `facts`) as rendered by the bindings | Yes, through the fixtures | axe + conformance suite | Not done |
| Example apps (`books-react`, `recipes-react`, `movies-tmdb`, `papers-html`) | No — not scanned | — | — |
| React Native (`examples/books-expo`) | No — no device run | — | — |

## Automated results

Run on 2026-11-27, Chromium, `PLAYWRIGHT_CHANNEL=chrome pnpm e2e` (the bundled
Chromium build cannot install on this machine; CI uses Playwright's pinned build):

- **axe: 0 violations** on all four fixture pages with the tags `wcag2a`,
  `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`. The 2.1 and 2.2 rule sets add
  checks the 2.0 tags miss, including focus not obscured, a non-drag way to
  operate the deck, and target size.
- **Binding conformance: 7/7 checks** on each binding — a control per action,
  pointer gestures on the root, ArrowRight advances, `u` undoes, a polite live
  region exists, `destroy` detaches the root, and the first card renders from the
  snapshot.

`e2e.yml` runs the same spec on pull requests that touch the bindings, nightly and
on demand. `ci.yml` runs the jsdom conformance suites on every pull request.

## Manual checklist

Each item is unverified until someone with the tool records the result here.

### Screen readers

- [ ] VoiceOver on macOS with Safari: every fixture page announces the card with
      its title and position on advance, and each button has a usable name.
- [ ] VoiceOver on iOS with `examples/books-expo`: same, plus the announcement
      not interrupting a drag in progress.
- [ ] TalkBack on Android with `examples/books-expo`: labels, disabled undo state,
      and one announcement per card.
- [ ] NVDA on Windows with Firefox: live-region politeness, focus after advance,
      and that a long card body is readable on demand rather than forced.

### Keyboard and switch input

- [ ] Keyboard only, pointer physically disconnected: reach every action with
      `Tab`, activate with `Enter`/`Space`, swipe with the arrow keys, undo with
      `u`/`z`, and never lose focus to `body` after an advance.
- [ ] Focus ring is visible on the deck and on every button against the default
      theme, light and dark.
- [ ] Switch control or voice control can activate every action without a drag.

### Visual

- [ ] 200% browser zoom: no clipped card content, no horizontal scrolling.
- [ ] 320 CSS px viewport reflow.
- [ ] Forced-colors / high-contrast mode keeps the card and buttons distinguishable.
- [ ] Reduced motion set at the OS level: the card still commits on drag, without
      the fly-off transform.

### Touch

- [ ] iOS and Android: targets are at least 44×44 pt / 48×48 dp.
- [ ] A swipe that starts on text scrolls when the user meant to scroll, and
      commits when the user meant to swipe.

## Known gaps

- **AAA.** No AAA rules are run (contrast 7:1, sign language, extended audio).
- **Example apps and the React Native deck are unscanned.** The audit covers the
  binding fixtures only.
- **Hydration.** Server-rendered markup is not compared against the hydrated tree,
  so a hydration mismatch that reorders focusable elements would not be caught.
- **Assistive technology.** Everything in the manual checklist above is still
  open; no screen reader has been run against a deck in this repository.
