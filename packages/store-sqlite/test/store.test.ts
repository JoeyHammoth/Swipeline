import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describeStoreConformance } from '@swipeline/store-memory/conformance'
import { describe, expect, it } from 'vitest'
import { createSqliteStores } from '../src/index.js'

describeStoreConformance('sqlite stores', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'swipeline-sqlite-'))
  const stores = createSqliteStores({ path: join(directory, 'store.db') })
  return {
    events: stores.events,
    items: stores.items,
    profiles: stores.profiles,
    cleanup: async () => {
      stores.close()
      await rm(directory, { recursive: true, force: true })
    },
  }
})

describe('sqlite store specifics', () => {
  it('keeps events across a reopen and records the schema version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'swipeline-sqlite-'))
    const path = join(directory, 'store.db')

    const first = createSqliteStores({ path })
    expect(first.schemaVersion).toBe(1)
    await first.events.append([
      {
        schemaVersion: 1,
        id: '01JC0B5V6Q9F3ZK2M4N7P8RAAA',
        deckId: 'books',
        cardId: 'demo:1',
        actor: 'reader',
        action: 'like',
        position: 0,
        ts: new Date(Date.UTC(2026, 10, 24)).toISOString(),
      },
    ])
    first.close()

    const second = createSqliteStores({ path })
    expect((await second.events.query({ actor: 'reader' })).map((event) => event.cardId)).toEqual([
      'demo:1',
    ])
    const version = second.schemaVersion
    second.close()
    expect(version).toBe(1)

    await rm(directory, { recursive: true, force: true })
  })

  it('refuses a database written by a newer schema', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'swipeline-sqlite-'))
    const path = join(directory, 'store.db')

    const newer = new DatabaseSync(path)
    newer.exec('pragma user_version = 2')
    newer.close()

    expect(() => createSqliteStores({ path })).toThrow(/newer than this package/)

    await rm(directory, { recursive: true, force: true })
  })
})
