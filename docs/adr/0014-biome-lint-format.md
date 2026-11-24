# 0014: Biome for lint and format, not ESLint + Prettier

**Status:** accepted

Lint and formatting use Biome 2.6.8 (one binary for both). The plan allowed
either Biome or ESLint + Prettier; the deciding fact is toolchain compatibility.
`typescript-eslint` 8.74 declares its TypeScript peer as `>=4.8.4 <6.1.0`, so it
cannot parse TypeScript 7, the current stable compiler (verified 2026-11-24).
Pairing ESLint with an older TypeScript just to satisfy the linter would either
pin the whole repo to a superseded compiler or split the repo across two
TypeScript versions. Biome parses TypeScript itself, has no compiler peer
dependency, and covers formatting as well. The cost is losing ESLint's ecosystem
(a handful of project-specific rules); those rules live as scripts instead —
`check:boundaries` and `check:licenses` — which is where they belong anyway,
since they reason about package manifests rather than syntax.
