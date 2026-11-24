# Changesets

Every user-facing change needs a changeset. Run `pnpm changeset`, choose the
packages and the bump type, and commit the generated Markdown file with your PR.
CI fails a PR that changes a package without one, unless the PR is docs- or
CI-only.

A changeset answers two questions:

1. **What changed for a user of this package?** Write it as a sentence a
   consumer can act on, not as a list of commits.
2. **What is the version impact?** While the project is pre-1.0 a `minor` may
   break; mark breaking changes explicitly and add a migration note.

On `main`, the Changesets action collects changesets into a single "Version
Packages" PR. Merging that PR publishes to npm through trusted publishing and
creates the GitHub releases.
