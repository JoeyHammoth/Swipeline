# Contributing

Swipeline is maintained in the open and designed to be extended. The fastest way
to help is a new source adapter, a card template, or a docs fix.

The authoritative document is
[CONTRIBUTING.md](https://github.com/JoeyHammoth/Swipeline/blob/main/CONTRIBUTING.md);
this page is the short version.

## Ground rules

- Sign off commits (`git commit -s`) — the project uses the DCO, not a CLA.
- One change per pull request; squash merges keep `main` linear.
- A changeset for every user-facing change.
- Schema or public API changes start as an [RFC](/contributing/rfcs).
- No framework imports outside binding packages (`pnpm check:boundaries` enforces it).
- Accessibility is not optional: buttons, keyboard and reduced motion for every
  deck.

## Setup

```bash
git clone https://github.com/JoeyHammoth/Swipeline.git
cd Swipeline
corepack enable
pnpm install
pnpm build && pnpm test
pnpm docs:dev
```

Node 24+, pnpm 12 (pinned by `packageManager`). `pnpm lint` runs Biome; `pnpm
typecheck` runs `tsc` in strict mode.

## Good first issues

| Kind | Where to start |
|---|---|
| New adapter | [Write a source adapter](/guides/write-an-adapter), label `adapter wanted` |
| Card templates | [Custom card templates](/guides/custom-card-template) |
| Docs | Any page with a stale or missing section; label `documentation` |
| Translations | Not started; an i18n catalog lands in M4 |
| Benchmark scenarios | `bench` (M2), label `rank` |

Issues labelled `good first issue` are scoped to be finishable in a day, with the
files to touch named in the issue.

## Review

1. CI must be green: lint, typecheck, tests, build, publint, boundaries, licenses,
   DCO, CodeQL, dependency review.
2. One maintainer approval; the reviewer checks interface, failure modes, defaults
   and tests.
3. The PR template asks for evidence and merge risk — fill it in, it shortens
   review.

We aim to label and respond to new issues and PRs within a few days. If yours is
quiet, a polite nudge is welcome.

## What we will ask you to change

- A public API that could be smaller.
- A new dependency without a license check and a reason.
- A test that asserts implementation detail instead of interface behaviour.
- A UI change with no keyboard path.
- A ranking change with no benchmark result.

None of these are personal; they are the review checklist.
