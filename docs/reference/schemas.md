# Schemas

The Card, SwipeEvent and Profile formats are defined once as Zod schemas in
`@swipeline/core` and exported as JSON Schema (draft 2020-12) for non-JavaScript
clients and editors.

## Downloads

| Schema | JSON Schema | Source |
|---|---|---|
| Card | [`/schemas/card.schema.json`](/schemas/card.schema.json) | `packages/core/src/card.ts` |
| SwipeEvent | [`/schemas/swipe-event.schema.json`](/schemas/swipe-event.schema.json) | `packages/core/src/event.ts` |
| Profile | [`/schemas/profile.schema.json`](/schemas/profile.schema.json) | `packages/core/src/profile.ts` |

Regenerate with `pnpm schemas:export` after changing a schema; the files are
committed so a client can fetch them from the docs site.

## Versioning

Every payload carries `schemaVersion: 1`. A shape change bumps the version and
adds a tested migration for stored events. Unknown fields are rejected, which is
deliberate: source-specific data goes in `extra`, and a typo should fail loudly
rather than silently disappear.

## Card

```json
{
  "schemaVersion": 1,
  "id": "openlibrary:OL123W",
  "sourceId": "openlibrary",
  "title": "Project Hail Mary",
  "subtitle": "Andy Weir",
  "body": "A lone astronaut must save the earth from disaster…",
  "tags": ["science fiction", "space"],
  "media": [{ "kind": "image", "url": "https://covers.openlibrary.org/b/id/10512345-M.jpg", "alt": "Cover" }],
  "facts": [{ "label": "Pages", "value": 496 }],
  "url": "https://openlibrary.org/works/OL123W",
  "attribution": { "text": "Data from Open Library", "url": "https://openlibrary.org", "required": true },
  "fetchedAt": "2026-11-24T10:00:00.000Z"
}
```

Notes:

- `id` must be `${sourceId}:${externalId}`. The schema is structural; the id rule
  is enforced by `cardId`/`isCardIdForSource` and the adapter testkit.
- `embedding` is `number[]`, never a `Float32Array`, because a typed array
  serializes as an object under `JSON.stringify`.
- `media[].kind` is `image` or `video`; audio is not in v1.

## SwipeEvent

```json
{
  "schemaVersion": 1,
  "id": "01JC0B5V6Q9F3ZK2M4N7P8RSTV",
  "deckId": "books",
  "cardId": "openlibrary:OL123W",
  "actor": "local-8f2c",
  "action": "like",
  "position": 3,
  "dwellMs": 2400,
  "ts": "2026-11-24T10:00:04.000Z",
  "context": { "query": "science fiction", "rankerVersion": "0.1.0" }
}
```

- `id` is a ULID: 26 characters of Crockford base32, time-sortable.
- `action` accepts the six known actions plus any non-empty string.
- `ts` is ISO 8601 with an offset.

## Profile

```json
{
  "actor": "local-8f2c",
  "deckId": "books",
  "tagStats": { "space opera": { "a": 3, "b": 0.6 } },
  "counts": { "seen": 12, "liked": 5, "disliked": 2 },
  "updatedAt": "2026-11-24T10:05:00.000Z"
}
```

`tagStats` holds Beta posteriors; `prefVector` is optional and filled by the rank
package. Profiles are derived and rebuildable, so they are not a backup surface.

## Validation in other languages

Use any draft 2020-12 validator. The OpenAPI document for the server is generated
from the same definitions, so a generated client sees exactly these shapes.
