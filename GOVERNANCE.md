# Governance

Swipeline starts maintainer-led and grows into area ownership. This document
describes who decides what, how to become a maintainer, and how significant
changes are proposed.

## Principles

1. **Small core, optional extras.** The core stays narrow; new capability
   usually belongs in a package or an extension point.
2. **Documented decisions.** Decisions that are hard to reverse are recorded as
   ADRs in `docs/adr/`, and API or schema changes go through an RFC in `rfcs/`.
3. **Consent, privacy and accessibility are not features.** They are
   requirements for anything merged.
4. **Open process.** Issue triage, roadmap status and release notes are public.

## Roles

| Role | Responsibilities | How you get it |
|---|---|---|
| **Contributor** | Opens issues and PRs, reviews others' work | Anyone |
| **Triager** | Labels issues, requests reproduction, closes duplicates | Invitation after a few helpful triage actions |
| **Area maintainer** | Merge rights for one area (`core`, `rank`, `bindings`, `adapters`, `docs`, `ci`) | Invitation after sustained contributions and reviews in that area |
| **Maintainer** | Release rights, repository settings, security advisories, final call on disputes | Existing maintainers, by consensus |

There are no commit quotas and no expectation of unpaid on-call. Maintainers who
step away keep credit; access is removed after a quiet period, following the
offboarding checklist in the repository security notes.

## Decision making

- **Routine changes** (bug fixes, docs, adapters, small features): one area
  maintainer approval.
- **Significant changes** (public API, schema, ranking semantics, new package,
  dependency with lock-in): RFC, then lazy consensus among maintainers. Silence
  for 7 days counts as consent for non-breaking proposals; breaking proposals
  need at least one explicit approval from a maintainer outside the author's
  area.
- **Disputes** are resolved by discussion first. If that fails, maintainers vote
  and a simple majority decides; the decision and reasoning are recorded in the
  RFC or ADR.

## RFC process

1. Copy `rfcs/0000-template.md` to `rfcs/NNNN-short-title.md`.
2. Open a PR with the proposal, labelled `needs-rfc` until decided.
3. Discussion happens on the PR. Maintainers label it `accepted`,
   `rejected` or `deferred`.
4. Accepted RFCs are merged and implemented in follow-up PRs. The RFC is the
   record of *why*; the code and docs record *what*.

Schema changes also require a migration note and, for stored events, a tested
migration path.

## Becoming a maintainer

Area maintainers are invited when all of these are true:

- Several substantial PRs merged in the area, with tests and docs.
- Reviews that show judgement about interface, failure modes and scope.
- Familiarity with the glossary, ADRs and privacy/accessibility requirements.
- Willingness to respond to issues in the area within a few days.

Maintainers are added by consensus of existing maintainers. The invitation and
acceptance are recorded in a pinned issue.

## Releases

- Pre-1.0: minor releases roughly monthly, patch releases as needed.
- Post-1.0: semantic versioning per package, with at least one minor release of
  deprecation warnings before removal.
- Releases are cut from `main` through the Changesets workflow. Only
  maintainers can approve the publish environment.
- Release notes credit contributors by name.

## Security and conduct

Security reports follow [SECURITY.md](SECURITY.md): private advisory, fix in a
private branch, coordinated disclosure. Conduct reports follow
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Changes to this document

Governance changes use the RFC process. Proposals that add a new role or change
voting require explicit approval from every current maintainer.
