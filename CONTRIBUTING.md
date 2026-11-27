# Contributing to Swipeline

Thanks for helping. This document covers the local setup, the rules CI enforces
and the fastest ways to make a first contribution.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ground rules

- **Sign off every commit** with `git commit -s`. We use the
  [Developer Certificate of Origin](https://developercertificate.org/) instead of
  a CLA, and CI rejects commits without a `Signed-off-by` trailer.
- **One change per pull request.** Keep it reviewable; squash merges keep
  `main` linear.
- **A changeset for every user-facing change.** Run `pnpm changeset` and commit
  the generated file. Every package is in one changesets `fixed` group, so the
  highest bump in a release applies to all of them and versions never drift
  apart. Docs-only and CI-only changes do not need one. A release
  commit on `main` has none by design — it consumes them — so
  `pnpm changeset:status` reports "no changesets were found" there. That error is
  expected on a release commit and nowhere else.
- **Schema and API changes need an RFC.** Anything that changes `Card`,
  `SwipeEvent`, `Profile`, a published interface or the `DeckStore` contract
  starts as a PR against `rfcs/`.
- **No framework imports outside binding packages.** `pnpm check:boundaries`
  fails if a non-binding package depends on React, Vue, Svelte or similar.

## Setup

Prerequisites: Node 24 or newer and pnpm 12 (the exact pnpm version is pinned
by `packageManager` in `package.json`, so `corepack enable` is enough).

```bash
git clone https://github.com/JoeyHammoth/Swipeline.git
cd Swipeline
pnpm install
pnpm build
pnpm test
```

Useful scripts:

| Command | What it does |
|---|---|
| `pnpm dev` | Watch-build all packages |
| `pnpm test` | Unit and property-based tests (Vitest) |
| `pnpm test -- --coverage` | Tests with coverage |
| `pnpm typecheck` | Strict TypeScript across the workspace |
| `pnpm lint` / `pnpm format` | Biome lint + format ([why Biome](docs/adr/0014-biome-lint-format.md)) |
| `pnpm build` | Build every package with tsup |
| `pnpm publint` | Validate `exports`, types and dual-format builds |
| `pnpm check:boundaries` | Fail on framework dependencies outside bindings |
| `pnpm licenses:check` | Dependency license policy |
| `pnpm package:licenses` | Published packages carry `LICENSE` and `NOTICE` |
| `pnpm e2e` | Binding conformance in Chromium (see below) |
| `pnpm docs:dev` / `pnpm docs:build` | VitePress site |
| `pnpm changeset` | Record a user-facing change |

### Browser conformance

`pnpm e2e` runs the shared binding conformance suite in Chromium against the
fixture pages in `examples/conformance`, then checks the same page with axe. It
needs a browser binary, which `pnpm install` does not fetch:

```bash
pnpm exec playwright install chromium   # once per machine; add --with-deps on Linux
pnpm e2e
pnpm e2e -- -g svelte                   # one binding
PLAYWRIGHT_CHANNEL=chrome pnpm e2e      # use an installed Chrome instead
```

Playwright starts the fixture dev server itself, so no prior `pnpm build` is
needed. `e2e.yml` runs the same suite on pull requests that touch a binding,
nightly, and on demand (`gh workflow run e2e.yml --ref main`) — a push to `main`
does not trigger it, so dispatch it after merging binding work.

## Where things live

| Path | Contents |
|---|---|
| `packages/core` | Schemas, types, config and the headless deck engine |
| `packages/*` | Workspace packages (see [`packages/README.md`](packages/README.md) for the full list and what each one owns) |
| `adapters/` | Compatibility pointer to first-party adapter packages in `packages/adapter-*` |
| `registry/adapters.json` | Index of adapters; `pnpm registry:check` validates it and keeps the docs catalog in step |
| `docs/` | VitePress pages, ADRs (`docs/adr`), research notes (`docs/research`), architecture (`docs/architecture`) |
| `rfcs/` | Design proposals |

Read [GLOSSARY.md](GLOSSARY.md) before naming anything new. The glossary is
opinionated: if a term is not there, propose it in your PR rather than
inventing a synonym.

## Writing a source adapter

The smallest useful contribution. An adapter converts one API or database into
`Card`s.

1. Read [An adapter in 20 minutes](docs/guides/write-an-adapter.md).
2. Implement `SourceAdapter<TRaw>`: `fetch()` pages the source, `normalize()`
   returns a `Card` or `null` to drop the item.
3. Record fixtures instead of hitting the network in tests; run the adapter
   conformance suite.
4. Declare `attribution`, rate limits and caching rules. Do not scrape, bypass
   terms, or cache beyond what the source allows.
5. Publish as `swipeline-adapter-<name>` and add an entry to
   `registry/adapters.json` in a separate PR.

## Pull requests

The template asks for the summary, evidence and merge risk. In addition:

- [ ] Tests cover the change (or the PR explains why they cannot).
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally.
- [ ] A changeset exists for user-facing changes.
- [ ] Docs are updated when behaviour or config changes.
- [ ] Accessibility impact is considered for any UI change: every action needs
      a button and a keyboard path, and motion must respect
      `prefers-reduced-motion`.
- [ ] Commits are signed off.

A maintainer will label and respond within a few days. If a PR goes quiet, a
polite nudge in the thread is welcome.

## Commit messages

Conventional Commits style: `feat:`, `fix:`, `docs:`, `test:`, `chore:`,
`ci:`, `refactor:`. Scope by package when it helps:
`feat(core): add later action to the deck engine`.

## Review checklist (what maintainers look for)

1. **Interface first.** New public surface is small, typed and documented; the
   implementation stays behind it.
2. **Defaults stay safe.** Local-first, no telemetry, no network call the user
   did not configure.
3. **Failure modes.** Offline, exhausted, rate-limited and malformed-source
   paths are handled, not assumed away.
4. **Tests at the seam.** Behaviour is tested through the public interface,
   with deterministic RNG where ranking is involved.
5. **Licenses.** Permissive dependencies only; no GPL/AGPL/SSPL/BUSL and no
   "commercial license for production" packages.

   npm packs a tarball from the package directory, so every public package
   carries a copy of the root `LICENSE` and `NOTICE` and lists both in `files`.
   The root files stay the source of truth: after either changes, run
   `node scripts/sync-package-licenses.mjs`, and `pnpm package:licenses` fails CI
   when a copy drifts or a tarball would not include it.

## Governance and becoming a maintainer

See [GOVERNANCE.md](GOVERNANCE.md). Area maintainers are added after sustained,
high-quality contributions to a package or area, usually by invitation after a
few merged PRs and reviews.
