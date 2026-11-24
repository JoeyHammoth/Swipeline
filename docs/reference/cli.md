# CLI

The `swipeline` command scaffolds, runs and inspects decks. Everything it does is
also available as a library call; the CLI exists to remove setup friction.

::: warning Milestone M3
Commands below are the v0.3 contract. Only the repository scripts exist today.
:::

## Commands

| Command | What it does |
|---|---|
| `npm create swipeline@latest <dir> -- --template <name>` | Scaffold a project (`blank`, `books`, `papers`, `recipes`, `products`) |
| `swipeline init` | Add Swipeline to an existing project: detects the framework, writes `deck.config.ts`, prints the install command |
| `swipeline source add <url \| adapter>` | Interactive mapper: fetches a sample, previews normalized cards, writes the mapping |
| `swipeline dev` | Local playground: mock user, live card preview, ranker inspector |
| `swipeline validate` | Validate config, manifest and registry entries against the schemas |
| `swipeline bench` | Run the synthetic-user benchmark against a pipeline |
| `swipeline serve` | Run the optional server |
| `swipeline export` / `import` | Portable history in JSONL |
| `swipeline doctor` | Diagnose versions, peer dependencies and configuration |

## Examples

```bash
# Start a deck from a template
npm create swipeline@latest my-deck -- --template books

# Map an API you already have
swipeline source add https://api.example.com/items

# See why cards are ranked the way they are
swipeline dev --deck ./deck.config.ts

# Check that a shared manifest is valid and safe
swipeline validate ./shared/books.deck.json

# Measure a pipeline change before opening a PR
swipeline bench --pipeline ./deck.config.ts --users 200 --swipes 100 --seed 7
```

## `swipeline dev`

```text
┌─ Swipeline dev ────────────────────────────────────────────┐
│ Deck: books   Actor: local-dev   Source: openlibrary       │
├──────────────────────────┬─────────────────────────────────┤
│  ┌─────────────┐         │ Pipeline                        │
│  │   CARD      │         │ 1 seenFilter      2.1 ms        │
│  └─────────────┘         │ 2 tagAffinity     0.8 ms        │
│  (✕) (↶) (★) (♥)         │ 3 prefVector      1.4 ms        │
│                          │ Why this card?                  │
│ Swipes: 23  Likes: 9     │  + tag "space opera" 0.72       │
│                          │  + similar to 3 liked books     │
├──────────────────────────┴─────────────────────────────────┤
│ [Export manifest]  [Export history]  [Reset local actor]   │
└────────────────────────────────────────────────────────────┘
```

## `swipeline doctor`

Checks, in order:

1. Node and package manager versions against `engines`.
2. Duplicate copies of peer dependencies (React, Reanimated, Gesture Handler).
3. Config validation and unknown fields.
4. Store reachability (IndexedDB availability, server health).
5. Source connectivity and rate-limit headers.
6. Schema version of stored events versus the library.

It prints a fix for each failure, not just a diagnosis.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation failed or a check errored |
| `2` | Bad usage or missing configuration |
| `3` | Benchmark regression beyond the configured threshold |

CI relies on these codes, so they are part of the contract.
