import { makeCard, makeEvent } from '@swipeline/store-memory/conformance'
import { indexedDB } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createIndexedDbStores } from '../src/index.js'

const ISO = new Date(Date.UTC(2026, 10, 24)).toISOString()

function openRaw(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

describe('IndexedDB schema upgrades', () => {
  it('keeps v1 rows and adds the by_deck index on the v2 upgrade', async () => {
    const name = 'swipeline-upgrade-test'

    const v1 = await createIndexedDbStores({ name, version: 1, factory: indexedDB })
    const card = makeCard(1)
    const event = makeEvent(1)
    await v1.items.put([card])
    await v1.events.append([event])
    await v1.profiles.put({
      actor: 'actor-1',
      deckId: 'books',
      tagStats: {},
      counts: { seen: 1, liked: 1, disliked: 0 },
      updatedAt: ISO,
    })
    await v1.close()

    const v2 = await createIndexedDbStores({ name, version: 2, factory: indexedDB })
    expect((await v2.items.get(card.id))?.title).toBe(card.title)
    expect((await v2.events.query({ deckId: 'books' })).map((row) => row.id)).toEqual([event.id])
    expect((await v2.profiles.get('actor-1', 'books'))?.deckId).toBe('books')

    const raw = await openRaw(name, 2)
    const transaction = raw.transaction('events', 'readonly')
    expect(transaction.objectStore('events').indexNames.contains('by_deck')).toBe(true)
    raw.close()

    await v2.close()
    await deleteDatabase(name)
  })
})
