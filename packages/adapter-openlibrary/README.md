# @swipeline/adapter-openlibrary

Open Library search results as `Card`s: title, author, subjects, first sentence,
cover and work link. No API key.

```ts
import { createOpenLibraryAdapter } from '@swipeline/adapter-openlibrary'

const source = createOpenLibraryAdapter({ limit: 50 })
```

Pagination is by page (`offset` in the core contract), and the adapter stops when
`numFound` is reached. Tags are lower-cased subjects, capped at 12. Rows without
a work key or title are dropped and counted by `normalize` returning `null`.

Attribution is required: link to Open Library and keep the cover URLs on their
CDN rather than copying images. See
[Open Library's terms](https://openlibrary.org/developers/api).
