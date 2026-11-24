# Embeddings

Embeddings are optional. Without them, ranking uses hashed tag and text features
and still personalizes; with them, similarity captures things tags cannot.

## Nothing by default

The default deck has no `Embedder` and no `VectorIndex`. That keeps the install
small, works offline, and avoids sending card text anywhere.

## Local embeddings

```ts
import { transformersEmbedder } from '@swipeline/embed'

export const deck = defineDeck({
  id: 'papers',
  source: papers,
  embedder: transformersEmbedder({
    model: 'Xenova/all-MiniLM-L6-v2',
    device: 'auto',
  }),
})
```

Runs in the browser or Node via Transformers.js. The model downloads once, then
caches. Sizes are in the tens of MB, so lazy-load it rather than at first paint.

## Hosted embeddings

```ts
import { openAiCompatibleEmbedder } from '@swipeline/embed'

embedder: openAiCompatibleEmbedder({
  baseUrl: process.env.EMBEDDINGS_URL!,
  apiKey: () => process.env.EMBEDDINGS_KEY!,
  model: 'text-embedding-3-small',
})
```

Any OpenAI-compatible endpoint works (hosted providers, Ollama, LM Studio, vLLM).
Credentials come from the host app; Swipeline never ships keys and never calls a
provider you did not configure.

## What gets embedded

A configurable template over the card:

```ts
embedder: transformersEmbedder({
  model: 'Xenova/all-MiniLM-L6-v2',
  template: '{title}. {subtitle}. {tags}. {body}',
})
```

Changing the template invalidates stored vectors — bump the `embedder.id` so the
cache knows to re-embed.

## The vector index

Default: brute-force exact cosine over typed arrays. For a per-user pool of a few
thousand cards that is fast and dependency-free.

| Index | When |
|---|---|
| Brute force (default) | Up to a few thousand candidates; no native deps |
| `sqlite-vec` | Server or local SQLite; still pre-1.0, so optional and pinned |
| `pgvector` | Postgres deployments at larger scale |

All implement the same `VectorIndex` interface, so swapping is a config change.
The exact-scan implementation and the driver must return the same ordering for the
same input, which the test suite asserts.

## Cost and privacy checklists

- **Cost:** embeddings cost CPU or money per card, and again whenever the model or
  template changes. Cache by `(embedder.id, card.id)`.
- **Privacy:** hosted embeddings send card text to a third party. Say so in your
  privacy policy, and prefer local embeddings for sensitive sources.
- **Licensing:** some SQLite vector extensions require a commercial license for
  production use; the dependency-license policy blocks them.
