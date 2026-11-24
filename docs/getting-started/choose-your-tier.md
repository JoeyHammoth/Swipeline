# Choose your tier

Three ways to adopt Swipeline. Start at the lowest tier that solves your problem;
moving up later does not rewrite your deck config.

## Tier 1 — Embed (client only)

You install `@swipeline/core`, a binding and a store. Everything runs in the
browser or app: fetching, ranking, event log, profiles.

| | |
|---|---|
| **Backend** | None |
| **Data location** | Device (memory or IndexedDB) |
| **Best for** | Consumer apps, prototypes, offline-first products, private data |
| **Limits** | No multi-device sync; history lives where it was created |

```ts
createEngine({ deckId: 'books', actor: 'local', source, items: memoryItemStore() })
```

## Tier 2 — Serve (self-hosted)

Add `@swipeline/server` for shared storage, multi-device sync, server-side
ranking and webhooks. The server is a small Hono app with SQLite by default and
Postgres as an option; it implements the same store interfaces as the client, so
ranking results match across devices.

| | |
|---|---|
| **Backend** | Node, Bun or an edge runtime + SQLite/Postgres |
| **Data location** | Your database |
| **Best for** | Products with accounts, multiple devices, shared decks |
| **Limits** | You operate it; Swipeline does not host anything |

```bash
npx swipeline serve --db ./swipeline.db --port 8787
```

## Tier 3 — Integrate (headless)

Use `@swipeline/core` directly inside your own UI and database. You can run the
engine headlessly, consume the event stream through sinks, and keep your own
service as the source of truth.

| | |
|---|---|
| **Backend** | Yours |
| **Data location** | Wherever you put it |
| **Best for** | Existing platforms, native apps, custom recommenders |
| **Limits** | You implement the stores you need behind the contracts |

```ts
const engine = createEngine({ deck, sinks: [webhookSink({ url, secret })] })
const next = await engine.next({ actor: 'user_123', limit: 10 })
```

## What stays the same across tiers

- `Card`, `SwipeEvent` and `Profile` schemas, versioned and exported as JSON Schema.
- The ranking pipeline and its stage names.
- `deck.config.ts` (functions are the only thing that cannot be serialized).
- Swipe semantics: undo is compensating, ids are stable, append is idempotent.

## What changes

| Concern | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| `EventStore` | memory / IndexedDB | server SQL | your database |
| Ranking runs | in the client | client or server | wherever you call it |
| Identity | local pseudonym | API key or JWT hook | your auth |
| Delivery | sinks (optional) | sync + webhooks | sinks |

See [Local-first and privacy](/concepts/local-first-and-privacy) before adding
any off-device delivery, and [Self-host the server](/guides/self-host-the-server)
when you are ready for Tier 2.
