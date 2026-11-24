# Roadmap

The public roadmap mirrors the milestone table in the
[design plan](swipeline-design-and-implementation-plan.md#15-roadmap-and-milestones)
and the [Swipeline project board](https://github.com/users/JoeyHammoth/projects/12).
Status here is updated when a milestone's acceptance criteria are met, not when
work starts.

## M0 — Foundation (in progress)

- [x] Apache-2.0 license, NOTICE, community health files
- [x] pnpm monorepo skeleton with strict TypeScript, lint, tests
- [x] Research verification of external facts ([note](research/2026-11-m0-verification.md))
- [x] ADRs for the architecture-shaping decisions ([index](adr/))
- [x] Architecture overview and normative contracts
- [x] Core `Card`, `SwipeEvent` and `Profile` schemas with tests
- [x] CI, docs deploy, CodeQL, dependency review, Scorecard, Dependabot
- [x] Docs site skeleton deployed to GitHub Pages
- [ ] RFC-0001 (Card and SwipeEvent schemas) accepted
- [ ] SHA-pinned GitHub Actions
- [ ] Repository transferred to the `swipeline` organisation (before first publish)

## M1 — v0.1: core, gestures, React

- `core`: deck engine implementing `DeckStore`, outbox, undo stack
- `gestures`: vanilla pointer/keyboard controller with `computeSwipeIntent`
- `store-memory`, `store-indexeddb`
- `adapters`: `http-json`
- `rank`: `seenFilter`, `tagAffinity`, hashed-feature `prefVector`, `epsilonRandom`, `mmr`
- `react`: `SwipeDeck` with buttons, keyboard path and reduced motion
- Examples: books and recipes; quickstart docs; playground v0
- Acceptance: quickstart under 10 minutes on a clean machine, a11y checks pass,
  `check:boundaries` green

## M2 — v0.2: ranking and adapters

- `embed` (Transformers.js and OpenAI-compatible), `vector` (brute force + `sqlite-vec` driver)
- `thompson` and `explain` stages; `bench` harness gating CI
- Adapters: arXiv, Open Library, TheMealDB, TMDB; adapter testkit and template
- `element` Web Component and `binding-testkit` conformance suite v1
- Acceptance: default pipeline beats random and popularity baselines by the
  documented margin; React and the Web Component pass conformance; SSR smoke passes

## M3 — v0.3: server and CLI

- `server` (SQLite + Postgres), `remote` store with outbox sync
- `sinks`: signed webhook, JSONL
- `cli`: init, source add, dev, validate, export/import, serve
- `create-swipeline` templates; trusted publishing wired up
- Acceptance: offline-then-online sync passes; webhook delivery is idempotent;
  scaffold-and-build nightly job is green

## M4 — v0.5: mobile and breadth

- `react-native` binding, thin `vue` and `svelte` bindings
- OpenAPI specification for the server; theming kit; i18n catalog
- Adapter registry and docs catalog; `facts` card template; accessibility audit
- Acceptance: Expo demo on iOS and Android; Vue and Svelte pass conformance; one
  `deck.config.ts` runs everywhere

## M5 — v1.0: stabilization

- API review and freeze, deprecation policy, security review
- Complete docs: guides, recipes, benchmarks, landscape
- At least three community adapters; versioned docs
- Acceptance: no open `breaking` issues; stability policy published

## Post-1.0

Community bindings (Solid, Angular, Flutter, native via OpenAPI), Notion and
Airtable adapters, optional LLM re-rank/explain stage, Gorse/Recombee ranker
plug-ins. Prioritized by RFCs and community demand.
