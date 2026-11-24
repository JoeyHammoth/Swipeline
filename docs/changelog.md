# Changelog

Release notes are generated from [Changesets](https://github.com/changesets/changesets)
and published with each GitHub Release and npm version.

## How a change becomes a release note

1. A contributor runs `pnpm changeset` and writes one or two sentences a consumer
   can act on.
2. CI fails a PR that changes a package without a changeset (docs- and CI-only PRs
   are exempt).
3. On `main`, the Changesets action opens a **"Version Packages"** PR with version
   bumps and changelogs.
4. Merging that PR publishes with provenance and creates the releases.

## Reading a release note

Each entry names the package, the version bump and the user-visible effect:

```md
## @swipeline/react

### Minor Changes

- Add `renderSkeleton` prop so a deck can render a stable placeholder during SSR
  hydration instead of an empty frame.

### Patch Changes

- Fix focus being lost when a custom card unmounts the action row.
```

## Pre-1.0 policy

Before 1.0, a minor version may include breaking changes. They are marked clearly
in the changeset and the release note, with a migration note. After 1.0, breaking
changes require a major and at least one minor release of deprecation warnings.

## Status

No releases yet. The first publishable version is v0.1 (milestone M1); until then
the repository history is the changelog and the [roadmap](/roadmap) is the plan.
