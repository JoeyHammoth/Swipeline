# 0011: Node 24+, pnpm 12, and publint/attw instead of api-extractor

**Status:** accepted

Runtime support starts at Node 24 ("Krypton"), the oldest active LTS line on
2026-11-24; CI tests 24 and 26. This is forced as much as chosen: Vitest 5,
tsup 9 and Changesets 3 all require Node 22.18 or newer, and Node 22 left
support. The package manager is pnpm 12.23.0, pinned through `packageManager`.

The plan allowed `api-extractor` **or** `publint` + `arethetypeswrong` for public
API validation. We use publint + attw: TypeScript 7 is the native compiler, and
tooling that drives the compiler's JavaScript API is not yet a stable target for
API reports. Typechecking still uses `tsc --noEmit` in strict mode, so type
correctness is not weakened — only the API-report artifact is deferred.
