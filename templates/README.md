# Starter templates

The templates live in `packages/create-swipeline` as descriptors, not as checked-in
directories: five starters share one generator, so they cannot drift apart and
the check below tests exactly what users get.

| Template | What it scaffolds | Milestone |
|---|---|---|
| `blank` | Core + an in-memory source + `<swipe-deck>`, no framework | M3 |
| `books` | React + Open Library adapter + IndexedDB | M3 |
| `papers` | React + Crossref through the `http-json` mapping | M3 |
| `recipes` | React + TheMealDB through `http-json` | M3 |
| `products` | React + a product `http-json` mapping to edit | M3 |

```bash
npm create swipeline@latest my-deck -- --template books
```

Requirements for every template:

- Builds from a clean install, which is what guards goal G1 (time-to-first-deck
  under 10 minutes).
- `quickstart.yml` scaffolds and builds each template on a schedule, so a broken
  template is caught without a human running the docs. `pnpm quickstart:verify`
  does the same locally, and `node scripts/check-templates.mjs --install` also
  builds them.
- Accessibility: buttons and keyboard paths work out of the box; reduced motion
  is honoured.
- No secrets and no network calls at build time.

The check scaffolds with workspace dependencies because the packages are not
published yet; registry resolution is the part the first publish adds. That gap is
recorded in the M3 section of the roadmap rather than hidden here.
