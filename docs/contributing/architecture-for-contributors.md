# Architecture for contributors

A working map for someone about to change code. The normative version is
[Contracts](/architecture/contracts) and the reasoning is in [ADRs](/adr/).

## Where code goes

```text
packages/core/src/
├── schema.ts     # id helpers, version constants
├── card.ts       # Card schema and parsers
├── event.ts      # SwipeEvent schema, action list, ordering
├── profile.ts    # Profile schema, weights, rebuildProfile
└── index.ts      # the public surface; nothing else is exported
```

A package exposes one entry point. If you need a subpath export, say why in the
PR: every entry point is a compatibility promise.

## The seams

| Seam | Interface | Two real implementations |
|---|---|---|
| Source | `SourceAdapter` | `http-json`, a typed adapter |
| Cards | `ItemStore` | memory, IndexedDB |
| Events | `EventStore` | memory, SQL/server |
| Profiles | `ProfileStore` | memory, SQL/server |
| Vectors | `VectorIndex` | brute force, `sqlite-vec`/`pgvector` |
| Ranking | `RankStage` | built-in stages, `external` |
| Delivery | `Sink` | webhook, JSONL |
| UI | `DeckStore` | React, Web Component |

One adapter is a hypothetical seam; two make it real. Do not add a seam for a
thing that will only ever have one implementation — put it behind a plain
function instead.

## Testing strategy

| Level | Tool | What it covers |
|---|---|---|
| Unit | Vitest | schema behaviour, id helpers, single stages |
| Property-based | fast-check | log invariants, undo reversal, no duplicates, determinism |
| Adapter conformance | adapter-testkit + fixtures | normalization, pagination, attribution |
| Component | Testing Library | rendering, buttons, focus |
| E2E / binding conformance | Playwright | gestures, keyboard, offline, a11y, SSR |
| Package integrity | publint, attw | exports, types, dual format |
| Ranking quality | bench | precision, regret, diversity, coverage |

Test through the interface, not past it. If a test needs a private field, the
module shape is wrong.

## TypeScript conventions

- `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- `verbatimModuleSyntax`: use `import type` for types.
- ESM-first; the build emits ESM and CJS with two declaration entry points.
- No default exports in library code.
- Public functions document their failure modes in TSDoc, not just their types.

## Adding a package

1. Copy an existing package's `package.json`, `tsconfig.json`,
   `tsconfig.build.json`.
2. Add the entry point, a README with status, and at least one test.
3. Run `pnpm build && pnpm publint && pnpm check:boundaries`.
4. Add a changeset (`minor`, since it is new public surface).
5. Add it to `packages/README.md` with its milestone.

Do not add a package for code that has no consumer yet. Fewer, larger packages are
the stated preference until a dependency-weight reason to split appears.

## Branching and commits

- Trunk-based: short-lived branches off `main`, squash merge, linear history.
- Branch names: `feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`.
- Commits: Conventional Commits, signed off, one logical change each.

## Windows, Linux, macOS

CI runs Linux; the repository is developed on all three. Avoid path separators in
scripts, do not assume case-insensitive filesystems, and prefer Node APIs over
shell utilities.
