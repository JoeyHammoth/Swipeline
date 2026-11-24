import { describeStoreConformance } from '@swipeline/store-memory/conformance'
import { indexedDB } from 'fake-indexeddb'
import { createIndexedDbStores } from '../src/index.js'

let database = 0

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    // A blocked delete means a connection was not closed; the suite closes it.
    request.onblocked = () => resolve()
  })
}

describeStoreConformance('indexeddb stores', async () => {
  const name = `swipeline-conformance-${database++}`
  const stores = await createIndexedDbStores({ name, factory: indexedDB })
  return {
    events: stores.events,
    items: stores.items,
    profiles: stores.profiles,
    cleanup: async () => {
      await stores.close()
      await deleteDatabase(name)
    },
  }
})
