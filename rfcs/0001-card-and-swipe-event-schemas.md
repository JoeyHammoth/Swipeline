# RFC 0001: Card, SwipeEvent and Profile schemas

- **Status:** proposed
- **Author(s):** Swipeline maintainers
- **Date:** 2026-11-24
- **Affects:** `@swipeline/core`, every adapter, the event log format, the docs
  JSON Schema, the server API

## Problem

The card and event formats are the project's interop surface. Every adapter,
binding, store, sink and future non-JavaScript client depends on them, and they
are expensive to change once real histories exist. They need to be frozen
explicitly, with their invariants written down, before M1 writes an engine
against them.

## Proposal

Implement the three schemas exactly as specified in
[`docs/architecture/contracts.md`](../docs/architecture/contracts.md) with Zod 4
and export them as JSON Schema draft 2020-12. The implemented version is in
`packages/core/src/{card,event,profile}.ts`; this RFC is the review of that
shape, not a separate design.

Key points under review:

1. `Card.id` is `${sourceId}:${externalId}`; the schema is structural and the
   convention is enforced by `cardId` / `isCardIdForSource` plus the adapter
   testkit. A schema refinement was rejected because it prevents a clean JSON
   Schema export.
2. Unknown fields are rejected (`strict`). Source-specific data goes in `extra`,
   which is deliberate: it keeps adapters honest and stops silent schema drift.
3. `SwipeEvent.id` is a ULID. Ordering by id equals ordering by time, which makes
   replay deterministic without trusting a device clock for ordering.
4. `action` accepts known actions plus arbitrary non-empty strings, so
   `buy`/`share`/`report` work without a schema change.
5. `Profile.tagStats` uses Beta posteriors. Deriving them needs card tags, which
   events do not carry, so derivation takes `tagsByCardId`; the engine either
   reads the item store or records `context.tags` when a card may be evicted.
6. `embedding` accepts `number[] | Float32Array` and is never serialized into a
   deck manifest.

## Behaviour and invariants

- Append is idempotent by event id.
- `undo` is a compensating event; replay applies it by dropping the last applied
  event. The log is never rewritten.
- A card is counted as seen once; liked/disliked by net weight sign.
- Tag keys are lower-cased and trimmed by derivation.
- Unknown actions have weight 0 and count as seen only.

## Compatibility

- This is `schemaVersion: 1`; nothing has shipped, so no migration.
- After this RFC is accepted, any change needs `schemaVersion: 2` and a tested
  migration for stored events.
- Packages are pre-1.0, so a breaking minor is permitted but must be in a changeset.

## Alternatives

- **Hand-written types + runtime assertions.** Rejected: two definitions drift.
- **JSON Schema as the source, generate types.** Rejected: weaker TypeScript
  ergonomics for adapter authors, and Zod gives better error messages.
- **Flat `Record<string, unknown>` extra fields allowed at top level.** Rejected:
  makes typos silent and complicates migrations.
- **Delete on undo.** Rejected: loses auditability and breaks append-only stores.

## Cost

One runtime dependency (Zod) in `core`, roughly 12 kB minzipped in the bundle.
Adapters must map into a fixed shape, which is the intended constraint.

## Decision

Pending review. Accepting this RFC freezes v1 of the three schemas for M1.
