# @swipeline/core

Schemas, types and the headless deck engine for [Swipeline](../../README.md).

`core` is the only package every other package depends on, so it stays small:
framework-free, no DOM, and a single runtime dependency (Zod) that provides both
validation and the JSON Schema export.

## Status

**M0: schemas implemented, engine in progress.** Today this package exports
`Card`, `SwipeAction`, `SwipeEvent` and `Profile` schemas, id helpers and the
pure `rebuildProfile` derivation. The `DeckStore` engine, outbox and undo stack
arrive in M1. See [`docs/architecture/contracts.md`](../../docs/architecture/contracts.md).

## Install

Not published yet. Once v0.1 ships:

```bash
pnpm add @swipeline/core
```

## What is here

```ts
import {
  cardSchema,
  swipeEventSchema,
  profileSchema,
  rebuildProfile,
  cardId,
  isCardIdForSource,
} from '@swipeline/core'
```

- **`Card`** — the normalized item a person swipes on. `id` is
  `${sourceId}:${externalId}`, which is what lets one history span many sources.
- **`SwipeEvent`** — an append-only record with a ULID id, deck and actor ids,
  action, position, optional dwell time and ranking context.
- **`Profile`** — derived preferences: Beta posteriors per tag, counts, and an
  optional preference vector filled by `@swipeline/rank`.
- **`rebuildProfile(events, { actor, deckId, tagsByCardId })`** — pure
  derivation. `undo` compensates instead of deleting, so the log stays auditable.

## Invariants

- Schemas are versioned (`schemaVersion: 1`) and closed: unknown fields are
  rejected, and source-specific data goes in `extra`.
- Tag keys are normalized to lower case by derivation.
- Derivation never mutates its input and does not read the clock unless told to.
- Tag evidence needs card metadata, which events do not carry. The engine either
  supplies `tagsByCardId` from the item store or records `context.tags` when a
  card may be evicted.

## JSON Schema

`pnpm schemas:export` writes `card.schema.json`, `swipe-event.schema.json` and
`profile.schema.json` into `docs/public/schemas/` for non-JavaScript clients.

## License

Apache-2.0. See the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).
