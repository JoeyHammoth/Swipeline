# Adapters catalog

A source adapter turns one API, file or database into [`Card`s](/concepts/cards-and-adapters).
The table below is generated from
[`registry/adapters.json`](https://github.com/JoeyHammoth/Swipeline/blob/main/registry/adapters.json)
by `node scripts/check-registry.mjs --write`; `pnpm registry:check` fails when it
drifts.

<!-- registry:start -->
| Adapter | API | License | Attribution | Conformance |
|---|---|---|---|---|
| [`@swipeline/adapter-openlibrary`](https://github.com/JoeyHammoth/Swipeline/tree/main/packages/adapter-openlibrary) | openlibrary.org | Apache-2.0 | Required | passing |
| [`@swipeline/adapter-themealdb`](https://github.com/JoeyHammoth/Swipeline/tree/main/packages/adapter-themealdb) | themealdb.com | Apache-2.0 | Required | passing |
| [`@swipeline/adapter-arxiv`](https://github.com/JoeyHammoth/Swipeline/tree/main/packages/adapter-arxiv) | info.arxiv.org | Apache-2.0 | Required | passing |
| [`@swipeline/adapter-tmdb`](https://github.com/JoeyHammoth/Swipeline/tree/main/packages/adapter-tmdb) | developer.themoviedb.org | Apache-2.0 | Required | passing |
<!-- registry:end -->

The first-party adapters live in this repository. They are chosen because they
have documented terms, stable endpoints and clear attribution rules — not because
they are the most popular sources.

## Adding an adapter

1. Implement a `SourceAdapter` and test it against recorded fixtures — see
   [Write a source adapter](/guides/write-an-adapter). Live calls in tests are
   rejected in review, because CI cannot depend on a third party.
2. Publish a package named `swipeline-adapter-<name>` with the
   `swipeline-adapter` keyword and a permissive license.
3. Declare `attribution`, rate limits and caching rules in the package README.
4. Open a PR that adds one entry to `registry/adapters.json`. CI validates the
   entry against [`registry/schema.json`](https://github.com/JoeyHammoth/Swipeline/blob/main/registry/schema.json),
   checks a first-party entry against the package it names, and regenerates the
   table above.

`conformance: "passing"` is reserved for adapters whose conformance suite runs in
this repository; a third-party entry has to say `"unknown"` until that changes.
Listing is a convenience, not an endorsement — read the maintainers, license and
terms URL before relying on one.

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
