# Events, profiles and history

Swiping produces an append-only log. Everything else — preferences, seen sets,
counts — is derived from that log.

## The event

```ts
interface SwipeEvent {
  schemaVersion: 1
  id: string          // ULID: sortable, unique, chosen on the client
  deckId: string
  cardId: string
  actor: string       // pseudonymous
  action: SwipeAction // like | dislike | superlike | skip | later | undo | custom
  position: number    // index in this session
  dwellMs?: number    // how long the card was visible
  ts: string          // ISO 8601
  context?: Record<string, unknown>  // query, filters, rankerVersion
}
```

Two details make the log useful for later analysis: `dwellMs` (a fast like and a
slow like are different evidence) and `context` (which query and ranker produced
this card). Neither is required.

## Actions and weights

| Action | Default weight | Meaning |
|---|---|---|
| `superlike` | +2.0 | strong positive |
| `like` | +1.0 | positive |
| `later` | +0.5 | soft interest; also saved to a collection |
| `skip` | -0.1 | weak negative, may mean "not now" |
| `dislike` | -0.6 | negative, discounted because fast dismissals are noisy |
| `undo` | reverses the last event | keeps the profile honest |
| custom (`buy`, `report`, …) | 0.0 | no ranking signal until you set a weight |

Weights are configurable and the benchmark tunes them; these are starting values.

## Deriving a profile

```ts
rebuildProfile(events, { actor, deckId, tagsByCardId })
```

- events apply in ULID order, so replay equals incremental application;
- `undo` drops the most recent applied event instead of deleting anything;
- a card counts as seen once, liked when net weight is positive;
- tag evidence is a Beta posterior: positives add to `a`, negatives to `b`.

**A subtlety worth knowing:** a `SwipeEvent` has no card metadata, so tag
posteriors cannot be derived from events alone. The engine supplies
`tagsByCardId` from the item store, or records `context.tags` at swipe time when a
card may be evicted from a bounded cache.

## Why event sourcing here

| Benefit | Consequence |
|---|---|
| Ranking changes never lose data | Profiles are rebuilt, not migrated |
| Export is trivial | JSONL dump of events + the manifest |
| Erase is honest | One call removes every event for an actor |
| Benchmarks replay reality | The same log feeds `@swipeline/bench` |
| Undo is auditable | The log keeps both the action and the undo |

The cost is that any read of derived state may need a rebuild. The engine keeps a
hot profile in memory and rebuilds on demand; the server does the same on cold
start.

## Outbox: swiping works offline

Events are written locally first, then delivered. The outbox retries with the
event id as the idempotency key, so a duplicate delivery is harmless.

```text
dispatch swipe
  append to local EventStore
  update profile (derived)
  advance the deck
  enqueue in outbox
  → sink / server delivery (retry, exponential backoff)
```

Delivery failure never blocks the swipe. The snapshot exposes `offline` and an
error reason instead.

## Export and erase

```ts
await exportActor('actor-1')   // JSONL of events + the deck manifest
await eraseActor('actor-1')    // every event, every deck, irreversible
```

Both are first-class APIs in every store implementation, not an afterthought, and
the privacy guide explains what sharing a swipe history can reveal.
