# Starter templates

Templates consumed by `npm create swipeline@latest`.

| Template | What it scaffolds | Milestone |
|---|---|---|
| `blank` | Core + memory store + `<swipe-deck>`, no framework | M3 |
| `books` | React + Open Library adapter + IndexedDB | M3 |
| `papers` | React + arXiv adapter + facts card | M3 |
| `recipes` | React + TheMealDB adapter + media card | M3 |
| `products` | React + `http-json` mapping + facts strip | M3 |

Requirements for every template:

- Builds from a clean clone with only the published packages, which is what
  guards goal G1 (time-to-first-deck under 10 minutes).
- `quickstart.yml` scaffolds and builds each template on a schedule, so a broken
  template is caught without a human running the docs.
- Accessibility: buttons and keyboard paths work out of the box; reduced motion
  is honoured.
- No secrets and no network calls at build time.
