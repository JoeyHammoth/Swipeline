# @swipeline/embed

Optional embedding providers. Nothing here runs unless you configure it.

```ts
import { openAiCompatibleEmbedder, transformersEmbedder } from '@swipeline/embed'

const local = transformersEmbedder({ model: 'Xenova/all-MiniLM-L6-v2' })
const hosted = openAiCompatibleEmbedder({
  baseUrl: process.env.EMBEDDINGS_URL!,
  apiKey: () => process.env.EMBEDDINGS_KEY!,
  model: 'text-embedding-3-small',
})
```

- `transformersEmbedder` loads `@huggingface/transformers` lazily; install it only
  if you use this provider. The optional peer keeps the core install small.
- `openAiCompatibleEmbedder` talks to any `/embeddings` endpoint, including
  Ollama, LM Studio and vLLM. The key is read per request.
- Both accept a `template` over the card (`{title}`, `{subtitle}`, `{tags}`,
  `{body}`) and an `id` used as the cache key. Bump the id when the model or
  template changes.
- Requests retry 429/5xx with `Retry-After` and respect the abort signal.

Embeddings can send card text to a third party. Prefer the local provider for
sensitive sources and document the choice in your privacy policy.
