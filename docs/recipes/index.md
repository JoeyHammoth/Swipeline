# Recipes

One core, one card schema, unrelated domains. If a domain needs a schema change,
that is a signal the design is wrong — `facts` and `extra` exist to avoid it.

## Books — Open Library

```ts
source: httpJson({
  id: 'openlibrary',
  url: 'https://openlibrary.org/search.json?q={query}&limit=50&page={page}',
  pagination: { type: 'page', param: 'page' },
  itemsPath: 'docs',
  map: {
    id: 'key',
    title: 'title',
    subtitle: 'author_name[0]',
    tags: 'subject[:8]',
    media: [{ kind: 'image', url: 'https://covers.openlibrary.org/b/id/{cover_i}-M.jpg' }],
    url: 'https://openlibrary.org{key}',
  },
  attribution: { text: 'Data from Open Library', url: 'https://openlibrary.org' },
})
```

Template: `media`. Tags drive affinity from the first few swipes.

## Papers — arXiv

```ts
source: arxiv({ categories: ['cs.LG', 'cs.CL'], sortBy: 'submittedDate' })
```

Template: `text`. `body` carries the abstract, clamped to four lines. Use
`later` as "read later" and the collection endpoint as a reading list.

## Recipes — TheMealDB

```ts
source: theMealDb({ query: 'vegetarian' })
```

Template: `media`, with `facts` for prep time and area. Images are the main
signal, so `mmr` matters: near-duplicate pasta photos are the failure mode.

## Products — a price comparison feed

```ts
source: httpJson({
  id: 'my-feed',
  url: 'https://feed.example.com/products?cursor={cursor}',
  pagination: { type: 'cursor', param: 'cursor', nextPath: 'next' },
  itemsPath: 'items',
  map: {
    id: 'sku',
    title: 'name',
    subtitle: 'brand',
    facts: [
      { label: 'Price', value: 'price', unit: 'USD' },
      { label: 'Rating', value: 'rating' },
    ],
  },
})
```

Template: `facts`. Add a hard filter on price before ranking; a great product
outside the budget is noise.

## Apartments — a user-owned export

```ts
source: csvAdapter({
  id: 'my-listings',
  path: './listings.csv',
  map: { id: 'id', title: 'address', subtitle: 'neighbourhood', tags: 'features[]' },
})
```

Template: `facts` with rent, size and commute. Sensitive-category care applies:
housing preferences can correlate with protected characteristics, so server-side
profiling needs a legal review.

## Restaurants — a user-owned CSV export

```ts
source: csvAdapter({
  id: 'my-restaurants',
  path: './restaurants.csv',
  map: {
    id: 'id',
    title: 'name',
    subtitle: 'cuisine + " · " + neighborhood',
    tags: 'cuisine',
    facts: [
      { label: 'Price', value: 'price', unit: 'USD' },
      { label: 'Rating', value: 'rating', unit: '/5' },
    ],
  },
})
```

Template: `facts`. Keep price and rating in `facts`, not in the title, so a
template can reformat them. A hard filter on price belongs before ranking: a
perfect restaurant outside the budget is noise, and no score should resurrect it.

The privacy trade-off is the point: a file the user owns means no third-party
terms, no API key and no network request. It also means the user is responsible
for the data; do not upload it to a server without consent.

## Anything else

The pattern is always: map to `Card`, pick a template, pick a store, choose a
pipeline. If you find yourself adding a field for one domain, use `facts` or
`extra` first — and open an RFC if that is genuinely insufficient.
