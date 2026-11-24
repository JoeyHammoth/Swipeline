# Playground

An in-browser deck you can try without installing anything: pick a source, tune
the ranking pipeline with sliders, and watch the cards change as you swipe.

::: warning Milestone M1 (v0 live), M2 (full)
The playground is not built yet. This page describes the contract it must meet,
including the security constraint that shapes it.
:::

## What it does

```text
┌─ Swipeline Playground ──────────────────────────────────────────────────┐
│ Source: [Open Library ▾]   Query: [science fiction]   [Load]            │
├───────────────────────────────┬─────────────────────────────────────────┤
│        ┌───────────┐          │ Ranker pipeline                         │
│        │   CARD    │          │  1 seenFilter                           │
│        └───────────┘          │  2 tagAffinity   weight [0.4]  ───●──   │
│       (✕) (↶) (★) (♥)         │  3 prefVector    weight [0.6]  ────●─   │
│                               │  4 mmr           lambda [0.75]  ───●──  │
│ Swipes: 23  Likes: 9          │ Why this card?                          │
│                               │  + similar to 3 liked items             │
│ Your taste (live):            │  + tag "space opera" affinity 0.72      │
│  ████ space opera             │  ~ exploration boost 0.08               │
├───────────────────────────────┴─────────────────────────────────────────┤
│ [Export manifest]  [Copy share link]  [Export history (JSONL)]          │
└─────────────────────────────────────────────────────────────────────────┘
```

- Runs entirely in the browser: memory store, no account, no upload.
- Shows the live profile (tag affinities) and the per-card reasons.
- Exports a manifest, which is also the share link payload.

## Share links are data, never code

A share link encodes the manifest in the URL hash:

```text
#manifest=eyJpZCI6ImJvb2tzIiwic291cmNlIjp7InR5cGUiOiJodHRwLWpzb24iLC...
```

Constraints, all of them enforced:

1. The manifest contains no executable code; unknown stages or fields are refused.
2. The playground never evaluates fetched strings.
3. A strict Content-Security-Policy allows only the playground bundle and the
   CORS-friendly sources listed below.
4. The playground never sends manifests or events to a Swipeline service — there
   is none.

## Sources it can load

Only CORS-enabled, terms-permitting sources are offered: Open Library, arXiv, and
a bundled fixture set for offline demos. Anything that needs a key or forbids
browser requests is not selectable; the playground is not a way around an API's
terms.

## Why it exists

Three reasons, in order:

1. **Evaluation:** people can judge the ranking story in thirty seconds instead of
   cloning a repo.
2. **Debugging:** "why this card" makes ranking behaviour concrete.
3. **Sharing:** a manifest in a link is a reproducible bug report or demo.

## Accessibility

The playground uses the same `<swipe-deck>` element as everyone else, so it
inherits the buttons, keyboard map and reduced-motion behaviour. axe runs against
it in CI along with the demos.
