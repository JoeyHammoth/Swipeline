## Summary

<!-- The smallest view that makes the change clear: a tree, a diff sketch, a call
tree, a sequence diagram, or a few lines of pseudo-code. Link the issue this
closes (Closes #123). -->

## Evidence

<!-- Before and after: test output, a failing-then-passing case, numbers, or a
screenshot for UI changes. -->

- **Before:**
- **After:**

## Merge danger

**Door:** <!-- one-way or two-way -->

**Blast radius:** <!-- one word: isolated / local / package / workspace / release -->

<!-- Anything a reviewer should know before merging: schema changes, publish
impact, config that consumers must change. -->

## Checklist

- [ ] Tests cover the change, or the PR explains why they cannot.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally.
- [ ] A changeset is included for user-facing changes (`pnpm changeset`).
- [ ] Docs updated when behaviour, config or defaults change.
- [ ] Accessibility: every new action has a button and a keyboard path; motion
      respects `prefers-reduced-motion`.
- [ ] No UI framework dependency added outside a binding package.
- [ ] Commits are signed off (`git commit -s`).
- [ ] Schema or public API change? An accepted RFC is linked.
