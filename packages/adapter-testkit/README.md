# @swipeline/adapter-testkit

Conformance checks every Swipeline `SourceAdapter` must pass: valid rows become
schema-valid Cards with stable, namespaced ids and normalized tags; invalid rows
are dropped, never thrown; ids do not change between calls.

```ts
import { assertAdapterConformance } from '@swipeline/adapter-testkit'

assertAdapterConformance(adapter, { validRaw, invalidRaw })
```

Throws `AdapterConformanceError` with every failure listed at once. The same
helper runs for `@swipeline/adapter-http-json` and hand-written adapters.

Apache-2.0.
