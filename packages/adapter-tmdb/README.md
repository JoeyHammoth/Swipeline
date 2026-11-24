# @swipeline/adapter-tmdb

TMDB movies as `Card`s: title, year, overview, genres, poster, rating and vote
count. Discover is used without a query, search with one.

```ts
import { createTmdbAdapter } from '@swipeline/adapter-tmdb'

const source = createTmdbAdapter({
  apiKey: () => process.env.TMDB_API_KEY!,
  genres: { 18: 'Drama', 53: 'Thriller', 878: 'Science Fiction' },
})
```

The key is required and read per request. Never ship it in a browser bundle; use
a server-side proxy or the server package. `filters.genre` maps to
`with_genres`. Pagination follows `total_pages`.

Attribution is mandatory: “This product uses the TMDB API but is not endorsed or
certified by TMDB.” See
[TMDB's terms](https://www.themoviedb.org/documentation/api/terms-of-use).
