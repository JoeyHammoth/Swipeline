# Architecture decision records

Decisions that are hard to reverse, surprising without context, and the result of a
real trade-off. One short record each; the reasoning matters more than the format.

| # | Decision | Status |
|---|---|---|
| [0001](./0001-monorepo-toolkit-not-framework.md) | A monorepo of small packages, not a framework | Accepted |
| [0002](./0002-schema-first-zod.md) | Schema-first TypeScript with Zod, exported as JSON Schema | Accepted |
| [0003](./0003-event-log-source-of-truth.md) | The event log is the source of truth; profiles are derived | Accepted |
| [0004](./0004-observable-deck-store-contract.md) | One observable `DeckStore` is the only binding contract | Accepted |
| [0005](./0005-brute-force-vector-default.md) | Brute-force exact vector search by default | Accepted |
| [0006](./0006-no-ml-default-ranking.md) | Ranking personalizes without ML by default | Accepted |
| [0007](./0007-apache-2-dco.md) | Apache-2.0 with DCO, no CLA | Accepted |
| [0008](./0008-actions-changesets-trusted-publishing.md) | GitHub Actions, Changesets, npm trusted publishing | Accepted |
| [0009](./0009-vitepress-github-pages.md) | VitePress on GitHub Pages | Accepted |
| [0010](./0010-repo-ownership-org-later.md) | Personal repository through M0, organisation before first publish | Accepted (supersedes the plan) |
| [0011](./0011-node-24-pnpm-12-publint.md) | Node 24+, pnpm 12, publint/attw instead of api-extractor | Accepted |
| [0012](./0012-sqlite-vec-optional.md) | `sqlite-vec` is optional, never the default | Accepted |
| [0013](./0013-web-component-reference-binding.md) | The Web Component is the reference binding, built in M2 | Accepted |
| [0014](./0014-biome-lint-format.md) | Biome for lint and format, not ESLint + Prettier | Accepted |
| [0015](./0015-public-api-freeze.md) | Three promise levels, and a frozen public surface | Accepted |

## Not an ADR

- Feature ideas, backlog items and milestone plans — see the [roadmap](/roadmap).
- Proposals still under discussion — see [RFCs](/contributing/rfcs).
- Default weights and thresholds — tuned by the [benchmark](/benchmarks), not
  decided once.
