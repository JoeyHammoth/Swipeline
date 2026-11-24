# Contracts

**Status:** M0. These signatures are what M1 implements. `Card`, `SwipeEvent` and
`Profile` are already implemented as Zod schemas in `packages/core`; the rest are
proposals that RFC-0001 freezes. Behaviour described here is normative.

Every contract in this file is a **seam**: a place where an implementation can be
swapped. The rule from the plan applies — one adapter is a hypothetical seam, two
make it real — so each of these has at least two intended implementations.

## Card, SwipeEvent, Profile

```ts
export interface Card {
  schemaVersion: 1
  id: string                    // `${sourceId}:${externalId}`
  sourceId: string
  title: string
  subtitle?: string
  body?: string
  media?: Array<{
    kind: 'image' | 'video'
    url: string
    alt?: string
    width?: number
    height?: number
  }>
  tags?: string[]
  facts?: Array<{ label: string; value: string | number; unit?: string }>
  url?: string
  attribution?: { text: string; url?: string; required?: boolean }
  extra?: Record<string, unknown>
  embedding?: number[]        // Float32Array is a computation-layer detail, not wire format
  fetchedAt: string            // ISO 8601
}

export type SwipeAction = 'like' | 'dislike' | 'superlike' | 'skip' | 'later' | 'undo' | (string & {})

export interface SwipeEvent {
  schemaVersion: 1
  id: string                   // ULID, sortable and unique
  deckId: string
  cardId: string
  actor: string
  action: SwipeAction
  position: number
  dwellMs?: number
  ts: string                   // ISO 8601
  context?: Record<string, unknown>
}

export interface Profile {
  actor: string
  deckId: string
  prefVector?: number[]
  tagStats: Record<string, { a: number; b: number }>   // Beta posteriors
  counts: { seen: number; liked: number; disliked: number }
  updatedAt: string
}
```

Invariants: the three schema fields above are versioned and migrated; ids are
stable across fetches; `actor` is pseudonymous and never requires PII; `tags` are
normalized to lower case and deduplicated by adapters; `embedding` is never part
of a serialized manifest, and it is `number[]` on the wire because a
`Float32Array` would serialize as an object under `JSON.stringify` — the rank and
vector packages convert to typed arrays at the computation boundary.

## SourceAdapter

```ts
export interface SourceAdapter<TRaw = unknown> {
  id: string
  capabilities: {
    pagination: 'cursor' | 'offset' | 'none'
    search?: boolean
    filters?: string[]
  }
  attribution?: Card['attribution']
  fetch(ctx: {
    cursor?: string
    query?: string
    filters?: Record<string, unknown>
    signal?: AbortSignal
  }): Promise<{ items: TRaw[]; nextCursor?: string }>
  normalize(raw: TRaw): Card | null
}
```

- `fetch` must respect the abort signal and the source's rate limits; it should
  honour `Retry-After` and back off on 429/5xx.
- `normalize` returns `null` for anything it cannot map; it never throws on a
  single malformed record, because one bad row must not empty a deck.
- `id` is the `sourceId` used in card ids and must not change between versions
  without a migration.
- Adapters must not scrape undocumented endpoints, and must declare
  `attribution` when the source requires it.

## ItemStore, EventStore, ProfileStore

```ts
export interface ItemStore {
  get(id: string): Promise<Card | undefined>
  put(cards: readonly Card[]): Promise<void>          // upsert by id
  list(): Promise<readonly Card[]>
  delete(ids: readonly string[]): Promise<void>
  clear(): Promise<void>
}

export interface EventQuery {
  actor?: string
  deckId?: string
  cardId?: string
  since?: string                 // ISO 8601, inclusive
  until?: string                 // ISO 8601, exclusive
  afterId?: string               // ULID cursor
  limit?: number
}

export interface EventStore {
  append(events: readonly SwipeEvent[]): Promise<void>  // idempotent by id
  query(q: EventQuery): Promise<readonly SwipeEvent[]>   // ULID order
  export(q: EventQuery): Promise<readonly SwipeEvent[]>
  erase(actor: string): Promise<number>                  // returns deleted count
}

export interface ProfileStore {
  get(actor: string, deckId: string): Promise<Profile | undefined>
  put(profile: Profile): Promise<void>
  delete(actor: string, deckId: string): Promise<void>
}

export function rebuildProfile(
  events: readonly SwipeEvent[],
  opts: {
    actor: string
    deckId: string
    weights?: Readonly<Record<string, number>>
    tagsByCardId?: ReadonlyMap<string, readonly string[]> | Readonly<Record<string, readonly string[]>>
    now?: string
  },
): Profile
```

**Why `tagsByCardId`:** tag posteriors cannot be derived from events alone,
because a `SwipeEvent` carries no card metadata. The engine supplies the lookup
from the `ItemStore`, or records `context.tags` at swipe time when the card may
be evicted (a bounded cache). This keeps the log sufficient for a rebuild without
widening every event with a full card snapshot.

- `append` is atomic per call: either all events are stored or none are.
- `query` returns events in ULID order so replay equals incremental application.
- `erase` removes every event for an actor across decks and is irreversible.
  Implementations must also drop derived profiles.
- `rebuildProfile` is a pure function and the only place default action weights
  are applied, so the same code runs in the engine, the server and the benchmark.

## Embedder and VectorIndex

```ts
export interface Embedder {
  id: string
  dimensions: number
  embed(items: readonly Card[], opts?: { signal?: AbortSignal }): Promise<readonly Float32Array[]>
}

export interface VectorIndex {
  upsert(items: ReadonlyArray<{ id: string; vector: Float32Array }>): Promise<void>
  search(
    vector: Float32Array,
    k: number,
    opts?: { exclude?: ReadonlySet<string> },
  ): Promise<ReadonlyArray<{ id: string; score: number }>>
  delete(ids: readonly string[]): Promise<void>
  size(): number
}
```

- `Embedder.embed` returns one vector per input, in the same order.
- `VectorIndex.search` returns cosine similarity in descending order; the exact
  scan implementation must produce identical results to a naive double loop with
  the same input ordering (ties broken by id) so tests can assert equality.
- `dimensions` must match the vectors written to an index; a mismatch is an
  error, not silent padding.

## RankStage and RankContext

```ts
export interface Candidate { card: Card; score: number; reasons?: string[] }

export interface RankContext {
  actor: string
  deckId: string
  candidates: Candidate[]
  profile: Profile
  limit: number
  rng: () => number
  seen?: ReadonlySet<string>
  query?: string
  filters?: Record<string, unknown>
  now?: number
}

export interface RankStage {
  name: string
  run(ctx: RankContext): Promise<RankContext> | RankContext
}
```

- A stage returns a new context; mutating `ctx` in place is a bug.
- Stages are individually testable with a hand-built `RankContext`; no store or
  network is required by any stage except `external`.
- A pipeline is `pipeline(...stages)` and is itself a `RankStage` named
  `pipeline`, which makes composition and tracing uniform.
- Tracing: the engine may wrap each stage to record duration and candidate
  deltas for the `explain` UI and the CLI's ranker inspector.

## Sink and ConsentPolicy

```ts
export interface Sink {
  id: string
  deliver(events: readonly SwipeEvent[]): Promise<void>   // throws to trigger retry
}

export type ConsentPolicy = (event: SwipeEvent) => boolean | Promise<boolean>
```

- `deliver` must be idempotent from the receiver's perspective: events carry
  stable ids, and webhook sinks sign each batch so receivers can deduplicate.
- A `ConsentPolicy` that returns `false` prevents both logging and delivery for
  that event, except `undo`, which is always recorded to keep the log coherent.

## DeckStore and DeckSnapshot

```ts
export type DeckState =
  | 'idle' | 'loading' | 'ready' | 'dragging'
  | 'committing' | 'exhausted' | 'error' | 'offline'

export interface DeckSnapshot {
  readonly state: DeckState
  readonly deckId: string
  readonly actor: string
  readonly cards: readonly Card[]          // current + preview buffer
  readonly position: number                // swipes committed this session
  readonly canUndo: boolean
  readonly loadingMore: boolean
  readonly lastError?: { code: string; message: string; retryable: boolean }
  readonly reasons?: Readonly<Record<string, readonly string[]>>
  readonly version: number                 // monotonic; changes with the object
}

export type DeckCommand =
  | { type: 'swipe'; action: SwipeAction; cardId: string; dwellMs?: number }
  | { type: 'undo' }
  | { type: 'refill' }
  | { type: 'setQuery'; query: string }
  | { type: 'setFilters'; filters: Record<string, unknown> }
  | { type: 'retry' }
  | { type: 'setDragging'; dragging: boolean }

export interface DeckStore {
  getSnapshot(): DeckSnapshot
  getServerSnapshot(): DeckSnapshot
  subscribe(listener: () => void): () => void
  dispatch(cmd: DeckCommand): void
}
```

- `dispatch` is synchronous and fire-and-forget; effects (fetch, append, ranking)
  happen after it returns, and the snapshot updates when they settle.
- The same snapshot reference is returned while nothing changed.
- `getServerSnapshot` returns the same stable object for the lifetime of the
  store when no server-side ranking has run.
- `subscribe` returns an unsubscribe function and must tolerate a listener that
  unsubscribes during notification.
- A `swipe` for a `cardId` that is not the current card is ignored (bindings can
  be slow, and gestures can race), never applied to the wrong card.

## Engine configuration

```ts
export interface EngineConfig {
  deckId: string
  actor: string | (() => string)
  source: SourceAdapter
  items?: ItemStore
  events?: EventStore
  profiles?: ProfileStore
  embedder?: Embedder
  index?: VectorIndex
  rank?: RankStage
  sinks?: Sink[]
  consent?: ConsentPolicy
  actions?: Partial<Record<'right' | 'left' | 'up' | 'down', SwipeAction>>
  prefetch?: { buffer: number; refillAt: number }
  undoDepth?: number
  clock?: () => number
  rng?: () => number
  idFactory?: () => string
}

export function createEngine(config: EngineConfig): DeckStore
```

Defaults: memory stores, no embedder, brute-force index only when an embedder
exists, the default pipeline from the plan, `buffer: 8`, `refillAt: 3`,
`undoDepth: 5`, `crypto.randomUUID`-based ids when ULID generation is not
provided, `Math.random` when no seed is supplied.

`clock`, `rng` and `idFactory` exist so tests and benchmarks are deterministic;
they are not public API for product code.

## Binding contract

A binding, at minimum:

1. Subscribes to `DeckStore` and renders `snapshot.cards[0]`.
2. Maps pointer/gesture input through `computeSwipeIntent` to `dispatch({type:'swipe'})`.
3. Exposes a button and a keyboard shortcut for every configured action.
4. Announces card changes in an ARIA live region and moves focus on advance.
5. Renders loading, empty, exhausted, error and offline states.
6. Accepts a custom card template in the framework's idiom.
7. Unsubscribes on unmount with no retained listeners.
8. Renders on the server without touching `window`/`document`.

If a binding needs behaviour the engine cannot express, the engine changes — not
the binding.

## Versioning of contracts

| Contract | Stability promise |
|---|---|
| `Card`, `SwipeEvent`, `Profile` | `schemaVersion` bump + tested migration for any change |
| `SourceAdapter`, `ItemStore`, `EventStore`, `ProfileStore` | additive only after v1.0; before that, minor versions may break with a changeset |
| `RankStage`, `Sink`, `ConsentPolicy` | additive; existing shapes stable |
| `DeckStore` | additive only; removing a field requires a major |
| JSON Schema / OpenAPI | published per release; breaking changes follow the schema version |
