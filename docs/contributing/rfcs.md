# RFCs

An RFC is the written proposal for a change that is hard to undo: a schema, a
published interface, the `DeckStore` contract, ranking semantics, or a dependency
that brings lock-in.

## When an RFC is required

| Change | RFC? |
|---|---|
| Adding a field to `Card`, `SwipeEvent`, `Profile` | Yes |
| Changing a published interface or removing an export | Yes |
| Changing default action weights or pipeline order | Yes |
| Adding a package with a new responsibility | Yes |
| Adding a dependency with a non-permissive license | Blocked outright |
| Fixing a bug, adding a stage, docs, adapters | No |

## Process

1. Copy [`rfcs/0000-template.md`](https://github.com/JoeyHammoth/Swipeline/blob/main/rfcs/0000-template.md)
   to `rfcs/NNNN-short-title.md`.
2. Open a PR. It is labelled `needs-rfc` while open.
3. Discussion happens on the PR; concrete objections are addressed in the text, not
   just in comments.
4. Maintainers label it `accepted`, `rejected` or `deferred`. Non-breaking
   proposals need lazy consensus (7 days without objection); breaking ones need an
   explicit approval from a maintainer outside the author's area.
5. Merge the RFC, then implement it in follow-up PRs.

An accepted RFC is the record of *why*. Code and docs remain the record of *what*.

## Open and accepted RFCs

| RFC | Title | Status |
|---|---|---|
| [0001](https://github.com/JoeyHammoth/Swipeline/blob/main/rfcs/0001-card-and-swipe-event-schemas.md) | Card, SwipeEvent and Profile schemas | Proposed |

## Schema changes additionally need

- A `schemaVersion` bump.
- A tested migration for stored events, with a fixture of the old shape.
- A note in the release changeset and a migration section in the docs.

## Design decisions that are not RFCs

Not every decision needs a proposal. The [ADRs](/adr/) record decisions that are
hard to reverse, surprising without context, and the result of a real trade-off.
If a change is reversible and obvious, just do it and explain it in the PR.
