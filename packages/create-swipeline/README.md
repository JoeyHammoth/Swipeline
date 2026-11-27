# create-swipeline

Scaffolds a runnable deck.

```bash
npm create swipeline@latest my-deck -- --template books
```

| Template | What you get |
|---|---|
| `blank` | No framework, an in-memory source that needs no network, `<swipe-deck>` |
| `books` | React, Open Library, IndexedDB history, default ranker |
| `papers` | React, Crossref metadata through `http-json` |
| `recipes` | React, TheMealDB through `http-json`, no pagination |
| `products` | React and a product catalogue mapping to edit |

Every template writes `package.json`, `index.html`, `tsconfig.json`,
`vite.config.ts`, `src/app.css`, an entry point and — except for `blank` — a
`src/deck.config.ts` that maps the source to cards. Nothing is installed and no
network request is made while scaffolding.

`--force` writes into a directory that is not empty; without it, a non-empty
directory is refused so a typo cannot overwrite a project.

## Template checks in this repo

`scripts/check-templates.mjs` scaffolds all five templates into
`examples/scaffold-*` with `SWIPELINE_LINK_WORKSPACE=1`, which writes
`workspace:*` instead of a version. `pnpm quickstart:verify` then installs and
builds them, and `.github/workflows/quickstart.yml` runs that weekly. That checks
the template code against the workspace packages; it cannot check registry
resolution until the first publish happens, which is noted in the workflow.

Apache-2.0.
