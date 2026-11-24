# Adapters catalog

A source adapter turns one API, file or database into [`Card`s](/concepts/cards-and-adapters).
This page is generated from
[`registry/adapters.json`](https://github.com/JoeyHammoth/Swipeline/blob/main/registry/adapters.json).

## First-party (in this repository)

| Adapter | Source | Milestone | Attribution |
|---|---|---|---|
| `swipeline-adapter-arxiv` | arXiv API | M2 | Required by arXiv terms; cite the paper |
| `swipeline-adapter-openlibrary` | Open Library search | M2 | Data from Open Library |
| `swipeline-adapter-themealdb` | TheMealDB | M2 | TheMealDB free tier terms |
| `swipeline-adapter-tmdb` | TMDB | M2 | "This product uses the TMDB API but is not endorsed or certified by TMDB" |

These are chosen because they have documented terms, stable endpoints and clear
attribution rules — not because they are the most popular sources.

## Community adapters

Nothing listed yet. The registry ships with an empty `adapters` array and a schema
([`registry/schema.json`](https://github.com/JoeyHammoth/Swipeline/blob/main/registry/schema.json)).

To be listed:

1. Publish a package named `swipeline-adapter-<name>` with the `swipeline-adapter`
   keyword and a permissive license.
2. Pass the adapter conformance suite (M2) with recorded fixtures.
3. Declare `attribution`, rate limits and caching rules in the package README.
4. Open a PR that adds one entry to `registry/adapters.json`. CI validates the
   schema, the license and that the package exists.

Listing is a convenience, not an endorsement. Entries show maintainers, license,
terms URL and last publish date so users can judge for themselves.

## What "conformance" means

| Check | Why |
|---|---|
| `normalize` never throws and returns `null` for bad rows | One malformed record must not empty a deck |
| Card ids are namespaced and stable | Ids are history keys |
| Pagination terminates | A cursor loop is a hung deck |
| Attribution present when `required` | Legal terms |
| Abort signal respected | Cancelling a deck must cancel requests |
| Fixtures, not live calls, in tests | CI cannot depend on a third party |

## Writing one

Start with [Write a source adapter](/guides/write-an-adapter). If a source's terms
forbid caching or redistribution, an adapter is not the right tool — talk to the
provider or use a user-owned export instead.
