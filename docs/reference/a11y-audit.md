# Accessibility audit

What has actually been checked, on which surface, and what still needs a person.
This page records results from a run, not intentions.

## Scope

| Surface | In scope | Automated check | Manual pass |
|---|---|---|---|
| Binding fixture pages (`/react.html`, `/element.html`, `/vue.html`, `/svelte.html`) | Yes | axe + the audit suite + binding conformance | Not done |
| Card templates (`text`, `media`, `facts`) as rendered by the bindings | Yes, through the fixtures | axe + conformance | Not done |
| Example apps (`books-react`, `recipes-react`, `movies-tmdb`, `papers-html`) | Yes, nightly | axe via `pnpm e2e:examples` | Not done |
| React Native (`examples/books-expo`) | Android and iOS, weekly | launches, reports its like, and labelled controls in the accessibility tree on both platforms (`android.yml`, `ios.yml`); no axe | Not done |

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

## Example apps (nightly)

`pnpm e2e:examples` boots the four example decks on their own servers and scans
each with the same axe tag set. It runs in `e2e.yml` on the nightly schedule and
on demand, not on pull requests, because the decks call live APIs. Each example
is scanned in whichever state it settles in — a loaded card, a spinner, or an
error with a retry button — since all three are things a person has to use.
`movies-tmdb` needs `TMDB_API_KEY`; without it the app renders its error state,
and that state must still pass.

Last run 2026-11-27: 4/4 pages, 0 violations. Getting there required the three
fixes recorded below.

## Native decks (weekly)

`examples/books-expo` builds a release app and drives it on both platforms. Last
runs: Android 2026-11-27 (`android.yml` 46089762260) and iOS 2026-11-28
(`ios.yml` 46096448443).

Both print the same five labels from the platform's accessibility tree —
`Dislike (Left)`, `Later (Down)`, `Like (Right)`, `Superlike (Up)` and
`Undo last swipe (U)` — and fail if fewer than three labelled controls appear.
The iOS run also fails if any control is exposed without a label. Android reads
`uiautomator`'s dump; iOS runs an XCTest that reads the live tree. Neither drives
a screen reader, so this records what VoiceOver and TalkBack are offered, not
what they say.

## Token contrast

Measured from the palette values in `@swipeline/theme`, pinned by
`packages/theme/test/contrast.test.ts` so a palette change cannot silently
regress the record.

| Pair | Light | Dark |
|---|---|---|
| `color-fg` on `color-bg` | 17.74:1 (AAA) | 17.14:1 (AAA) |
| `color-muted` on `color-bg` | 7.56:1 (AAA) | 12.08:1 (AAA) |
| `color-accent` on `color-bg` | 8.72:1 (AAA) | 7.05:1 (AAA) |
| `color-border` on `color-bg` | 3.24:1 | 3.77:1 |

Every text pair clears AAA, and both boundary pairs clear the 3:1 minimum. Two
values changed to get there: light `color-accent` went `#2563eb → #1e40af`
(5.17:1 → 8.72:1) and the borders went `#e5e7eb → #8a8f9b` and
`#334155 → #64748b` (1.24:1 and 1.73:1 → 3.24:1 and 3.77:1). That is a visible
change — a mid-grey hairline and a deeper link blue — accepted because a border
below 3:1 is not a boundary a low-vision user can see. A theme that overrides
these tokens takes over the obligation: the audit only measures the defaults.
`examples/recipes-react` had the same problem on its dark page and moved its own
border from `#3a3d63` to `#6f74a8` (1.60:1 → 3.73:1).

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

- **The Web Component put status and error text on the page's background.** Its
  shadow styles colour text with `--swl-color-fg` (dark) but gave these blocks no
  surface, so on the dark `papers-html` and `movies-tmdb` pages they were dark on
  dark. `.swl-status` and `.swl-error` now carry the palette's background.
- **The React preview card stayed in the tab order.** `aria-hidden` alone does not
  remove a custom card's links from focus; the preview is now `inert` too.
- **The recipes example drew light text on the binding's white card.** It now sets
  the dark palette tokens on its root instead of only styling the page.

## Manual checklist

Each item is unverified until someone with the tool records the result here.
The [screen-reader script](/reference/a11y-manual-script) is this checklist
written as steps to run, with the commands, what to listen for, and how to record
a result.

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

- **AAA.** No AAA axe rules are run (sign language, extended audio). Text
  contrast is measured directly against the AAA threshold instead — see
  [Token contrast](#token-contrast) — but a themed palette is not measured.
- **The native deck is not scanned.** `android.yml` and `ios.yml` show that the
  React Native deck launches and swipes on an Android emulator and an iOS
  simulator, and both jobs read the platform's accessibility tree: each fails
  unless at least three controls expose labels. That is what a screen reader is
  offered, not how it reads it — no TalkBack or VoiceOver pass exists, and no
  axe-equivalent rule set runs against native.
- **Hydration.** Server-rendered markup is not compared against the hydrated tree,
  so a mismatch that reorders focusable elements would not be caught.
- **Assistive technology.** Everything in the manual checklist above is still
  open; no screen reader has been run against a deck in this repository.
