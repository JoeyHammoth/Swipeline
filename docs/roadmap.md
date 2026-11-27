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
- [x] RFC-0001 (Card and SwipeEvent schemas) accepted
- [x] SHA-pinned GitHub Actions
- [ ] Repository transferred to the `swipeline` organisation (before first publish)

## M1 — v0.1: core, gestures, React (in progress)

- [x] `core`: deck engine implementing `DeckStore`, outbox, undo stack
- [x] `gestures`: vanilla pointer/keyboard controller with `computeSwipeIntent`
- [x] `store-memory`, `store-indexeddb` against one conformance suite
- [x] `adapters`: `http-json` with an adapter testkit
- [x] `rank`: the default pipeline plus `@swipeline/bench`
- [x] `react`: `SwipeDeck` with buttons, keyboard path and reduced motion
- [x] Playground v0
- [x] Examples: books, recipes and papers; quickstart docs
- [x] Quickstart measured on a clean tree with a fresh pnpm store: 4m 16s,
  2026-11-26 ([detail](getting-started/quickstart.md#contributor-setup))
- [x] a11y: axe `wcag2a`/`wcag2aa` passes on both binding fixtures in Chromium
  (local run 2026-11-26; CI run `45602865428`, 2026-11-25)
- [x] `check:boundaries` green: 19 packages, no framework imports outside bindings
- [ ] First manual npm publish — blocked on the organisation transfer (#1) and on
  creating the npm organisation

Acceptance met apart from the first publish: quickstart under ten minutes on a
clean machine, unit and component tests pass, a11y checks pass for the default
deck, no framework imports outside binding packages, playground v0 live.

## M2 — v0.2: ranking and adapters

- [x] `embed` (Transformers.js and OpenAI-compatible), `vector` (brute force + `sqlite-vec` driver)
- [x] `thompson` and `explain` stages; `bench` harness gating CI
- [x] Adapters: arXiv, Open Library, TheMealDB, TMDB; adapter testkit and template
- [x] `element` Web Component and `binding-testkit` conformance suite v1
- [x] [Binding status matrix](/reference/binding-status) published from passing runs
- [x] Browser conformance fixtures and `e2e.yml` (Playwright, Chromium)
- Acceptance: default pipeline beats random and popularity baselines by the
  documented margin; React and the Web Component pass conformance; SSR smoke passes

## M3 — v0.3: server and CLI · [release notes](releases/0.3.0)

- [x] `server` core: `GET /health`, validated idempotent `POST /events`, `GET /export/:actor`, `DELETE /actors/:actor`, auth hook and CORS
- [x] `server` storage: SQLite (`store-sqlite`, `node:sqlite`) and Postgres
  (`store-postgres`, any `pg` client), plus `store-remote` with outbox sync
- [x] `sinks`: signed webhook (HMAC-SHA256, replay window) and JSONL
- [x] `cli`: `serve`, `validate`, help and exit codes 0/1/2
- [x] `cli`: bench, export, import, doctor
- [x] `cli`: init, source add, dev
- [x] `create-swipeline` templates: blank, books, papers, recipes and products,
  scaffolded and built by `quickstart.yml`
- [ ] trusted publishing wired up — blocked on the npm organisation and the
  repository transfer (#1)
- Acceptance: offline-then-online sync passes; webhook delivery is idempotent;
  scaffold-and-build nightly job is green
- Offline-then-online sync is covered by `store-remote` tests against a real
  in-process server, and webhook idempotency by `sinks` tests that repeat a
  batch and compare the delivery id. `quickstart.yml` scaffolds all five
  templates and builds them on a schedule, against the workspace packages
  because nothing is published yet; registry resolution is the gap the first
  publish closes.

## M4 — v0.5: mobile and breadth

- [x] `vue` binding, passing the shared conformance suite in jsdom and Chromium
- [x] thin `svelte` binding, passing the shared conformance suite in jsdom and Chromium
- [ ] `react-native` binding — implemented and bundled for iOS and Android by
  the Expo smoke app (`examples/books-expo`); not yet launched on a device,
  simulator or emulator
- [x] Adapter registry: schema-validated, with a generated docs catalog
- [ ] Accessibility audit — automated axe (WCAG 2.0/2.1/2.2, A/AA), the
  keyboard, reflow, target-size, forced-colours and reduced-motion checks, the
  example decks (nightly) and the token-contrast table all pass; the
  screen-reader and touch checklist in [the audit](reference/a11y-audit.md) is
  not done
- [x] OpenAPI specification for the server (`GET /openapi.json`)
- [x] Theming kit: `@swipeline/theme` with both palettes and CSS output
- [x] i18n catalog: `@swipeline/i18n`, wired into both bindings
- [x] `facts` card template: `@swipeline/cards`, used by React and the Web Component
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
