# 0015: Three promise levels, and a frozen public surface

**Status:** accepted

Every export carries one of three promises: **contract** (named in
[the contracts](/architecture/contracts) or taught by a guide — covered by the
deprecation policy from 1.0), **supported** (types, option objects and helpers that
make a contract usable — same stability, no RFC needed unless a change breaks
compatibility), or **internal** (exported for tests, fixtures, the CLI's own
dispatcher or the scaffolder's data — may change in any release without notice).

Without the split, a symbol that leaked into `export` is as public as
`createEngine`, and the 1.0 freeze either freezes everything or nothing. With it,
[the surface page](/reference/api-surface) can state the promise for each of the
262 exports, and a new export has to be classified in the PR that adds it rather
than inheriting the strongest promise by accident.
