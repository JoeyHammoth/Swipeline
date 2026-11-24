# Decisions on the plan's open questions

The design plan leaves ten questions open in
[§18](../swipeline-design-and-implementation-plan.md#18-open-questions-and-decisions-needed).
This page resolves them so implementation is not blocked on a conversation.
Each resolution names where the reasoning lives.

| # | Question | Decision | Why / record |
|---|---|---|---|
| 1 | Name | **Swipeline** | Names verified free on npm and PyPI on 2026-11-24; GitHub org name also free. Trademark search remains open — [research](../research/2026-11-m0-verification.md) |
| 2 | License | **Apache-2.0** | [ADR-0007](../../docs/adr/0007-apache-2-dco.md) |
| 3 | Contribution terms | **DCO**, enforced in CI | [ADR-0007](../../docs/adr/0007-apache-2-dco.md) |
| 4 | Ownership | **Personal repo through M0**, transfer to the `swipeline` org before first publish | [ADR-0010](../adr/0010-repo-ownership-org-later.md) |
| 5 | First UI target | **Vanilla `gestures` + React in v0.1; Web Component in M2** as the reference binding | [ADR-0013](../adr/0013-web-component-reference-binding.md) |
| 6 | Embeddings in v0.2 | **Both** a local Transformers.js provider and an OpenAI-compatible HTTP provider, both optional | `embed` is an optional package; neither is in the default path ([ADR-0006](../adr/0006-no-ml-default-ranking.md)) |
| 7 | Server runtime | **Runtime-agnostic (Hono)**, with SQLite as the default store and Postgres optional | §5.10 of the plan; revisit only if a host cannot run it |
| 8 | First-party adapters | **arXiv, Open Library, TheMealDB, TMDB** — all with documented terms and attribution requirements | Adapter terms review is part of each adapter issue |
| 9 | Hosted offering | **Out of scope**, and no relicensing plan, which is why DCO is enough | [ADR-0007](../adr/0007-apache-2-dco.md) |
| 10 | Funding | **GitHub Sponsors**, after the first public release; no fiscal host now | Low cost to set up later; nothing in the code depends on it |

## Additional decisions taken during M0 setup

These were not in §18 but were needed to start writing code.

| Topic | Decision | Record |
|---|---|---|
| Runtime floor | Node 24+; CI on 24 and 26 | [ADR-0011](../adr/0011-node-24-pnpm-12-publint.md) |
| Package API validation | `publint` + `arethetypeswrong`, not `api-extractor` | [ADR-0011](../adr/0011-node-24-pnpm-12-publint.md) |
| Lint and format | **Biome 2**, not ESLint + Prettier, because `typescript-eslint` cannot parse TypeScript 7 | [ADR-0014](../adr/0014-biome-lint-format.md) |
| Package granularity | Start with **fewer, larger** packages: `core`, `rank`, `adapters`, `gestures`, `react`, `element`, `store-memory`, `store-indexeddb`, `binding-testkit`, `cli`, `server` exist in v0.x; `embed`, `vector`, `sinks`, `bench`, `store-sqlite`, `store-postgres` split out when a dependency-weight reason appears | §6 of the plan, applied |
| Schema library | Zod 4, types inferred, JSON Schema exported from the same definitions | [ADR-0002](../adr/0002-schema-first-zod.md) |
| Docs hosting | VitePress 1.x on GitHub Pages with `base: '/Swipeline/'` until the org move | [ADR-0009](../adr/0009-vitepress-github-pages.md) |
| Action pinning | Major tags at M0, SHA pins tracked as a security issue | [Research §3](../research/2026-11-m0-verification.md) |

## Deliberately still open

- **Exact default ranking weights.** The plan's numbers are starting values; the
  benchmark in `@swipeline/bench` must tune them before v0.2 ships.
- **Bundle-size budget.** Set after the first measured build of
  `@swipeline/react` (plan §15.1).
- **Custom domain.** Deferred until after the organisation transfer; Pages must
  be re-verified then.
