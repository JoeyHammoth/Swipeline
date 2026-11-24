import { describeStoreConformance } from '../src/conformance.js'
import { createMemoryStores } from '../src/index.js'

describeStoreConformance('memory stores', () => createMemoryStores())
