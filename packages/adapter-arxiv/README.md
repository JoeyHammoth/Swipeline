# @swipeline/adapter-arxiv

arXiv Atom entries as paper `Card`s: title, authors, abstract, categories,
publication date and the abstract page.

```ts
import { createArxivAdapter } from '@swipeline/adapter-arxiv'

const source = createArxivAdapter({ categories: ['cs.LG', 'cs.CL'], limit: 50 })
```

Without a query the configured categories are OR-ed (`cat:cs.LG OR cat:cs.CL`);
with one, the text is passed through as an arXiv search expression. Pagination is
an offset (`start`). The parser handles the subset of Atom arXiv returns and is
exported as `parseArxivFeed` for fixture tests.

arXiv asks API clients to make no more than one request every three seconds and
to identify themselves. Keep `limit` modest, cache pages and credit arXiv.
