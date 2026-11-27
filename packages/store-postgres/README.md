# @swipeline/store-postgres

The server-side counterpart to `@swipeline/store-memory`: the same three store
contracts, stored in Postgres. It takes any `pg`-compatible client, so it works
with a `pg.Pool`, a `pg.Client`, or PGlite.

```ts
import { Pool } from 'pg'
import { createPostgresStores } from '@swipeline/store-postgres'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const stores = await createPostgresStores({ client: pool })
const server = createServer({ events: stores.events })
```

`pg` itself is not a dependency: the package only needs `query(text, values)`, so
you choose the driver and its version.

## Schema

Opening the stores creates the `events`, `items` and `profiles` tables if they
are missing, which is enough for a fresh database. It does not migrate existing
tables or manage your schema for you; once the interface is past v0, run the DDL
through your own migration tool.

`append` is idempotent by event id (`on conflict (id) do nothing`) and runs in
one transaction per call, `erase` deletes an actor's events and its derived
profiles in one transaction, and `ts` is compared as text, matching the memory
and SQLite stores exactly.

## Tests

The shared `@swipeline/store-memory/conformance` suite runs against PGlite, a
real Postgres compiled to WASM, in CI. That exercises the SQL rather than a mock,
without needing a database server in the pipeline.

Apache-2.0.
