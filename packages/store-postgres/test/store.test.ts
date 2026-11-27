import { PGlite } from '@electric-sql/pglite'
import { describeStoreConformance } from '@swipeline/store-memory/conformance'
import { describe, expect, it } from 'vitest'
import { createPostgresStores } from '../src/index.js'

// One PGlite instance for the whole suite; starting Postgres costs about two
// seconds, so the tables are truncated between tests instead. The warm-up pays
// the WASM start here rather than inside the suite's first `beforeEach`.
const shared = new PGlite()
await shared.query('select 1')

describeStoreConformance('postgres stores', async () => {
  const stores = await createPostgresStores({ client: shared })
  return {
    events: stores.events,
    items: stores.items,
    profiles: stores.profiles,
    cleanup: async () => {
      await shared.query('truncate events, items, profiles')
    },
  }
})

describe('postgres store specifics', () => {
  it('is safe to open twice against the same database', async () => {
    const client = new PGlite()
    const first = await createPostgresStores({ client })
    const second = await createPostgresStores({ client })
    expect(first.schemaVersion).toBe(1)
    expect(second.schemaVersion).toBe(1)
    await client.close()
  })
})
