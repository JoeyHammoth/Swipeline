# Organisation transfer runbook

ADR-0010 keeps the repository under `JoeyHammoth` through M0 and moves it to the
`swipeline` organisation before the first npm publish. This is the checklist for
that move: what to change, in what order, and how to verify it.

::: tip Status
Not started. The repo is still `JoeyHammoth/Swipeline`; npm publishing is blocked
on this runbook plus the name checks in #18.
:::

## 1. Before the move

- [ ] Finish the name checks in #18 (trademark, domain, handles) and record the
      result in `docs/research/2026-11-m0-verification.md`.
- [ ] Confirm the `swipeline` organisation exists and has at least two owners
      with 2FA.
- [ ] Create the `core`, `bindings`, `adapters` and `docs` teams so CODEOWNERS
      can move from a user to teams.
- [ ] Note the current Pages URL, npm scope state and required check names; the
      move changes the repository owner, which changes both URLs and OIDC
      subjects.

## 2. Transfer

- [ ] Settings → General → Danger Zone → Transfer ownership to `swipeline`.
- [ ] Accept the transfer as an organisation owner.
- [ ] `git remote set-url origin git@github.com:swipeline/swipeline.git` locally
      and update any other clones.
- [ ] Keep the old URL redirect in place; GitHub redirects the repository, but
      not GitHub Pages, the wiki or npm metadata.

## 3. Repository settings to re-check

Transfers preserve most settings, but verify instead of assuming:

- [ ] Rulesets on `main` and `v*`: required checks still resolve by name, Code
      Owners still match, bypass list still contains only admins.
- [ ] Environments `npm-publish` and `github-pages`: reviewers, deployment
      branch policies.
- [ ] Actions policy: `sha_pinning_required`, default workflow permissions,
      allowed actions, fork-PR approval.
- [ ] Dependabot alerts, security updates and secret scanning with push
      protection.
- [ ] Discussions, wiki, topics, description, social preview.
- [ ] `CODEOWNERS` now uses `@swipeline/<team>` instead of `@JoeyHammoth`.
- [ ] Add the organisation to the OpenSSF Scorecard allowlist if it publishes
      under the org.

## 4. URLs and docs

- [ ] `docs/.vitepress/config.ts`: `BASE` stays `/Swipeline/` for project Pages;
      update `editLink.pattern`, the social link and the sitemap hostname to the
      new owner.
- [ ] `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `TRADEMARKS.md` and the
      issue templates: replace `JoeyHammoth/Swipeline` links.
- [ ] Re-enable Pages with source **GitHub Actions** and enforce HTTPS on the new
      URL; the old `joeyhammoth.github.io/Swipeline/` deployment is not migrated.
- [ ] Upload the social preview image again (it is not transferable through the
      API; tracked in #15).
- [ ] Wiki: clone `swipeline/swipeline.wiki.git`, push the existing pages, and
      confirm the sidebar still renders.
- [ ] Optionally add a custom domain (`swipeline.dev`) and verify it at the
      organisation level before pointing DNS.

## 5. npm and supply chain

- [ ] Move the `@swipeline` scope to an organisation account that the org owns;
      add at least two maintainers with 2FA.
- [ ] Register the trusted publisher again with the new owner/repo/workflow and
      the `npm-publish` environment. The old registration stops matching.
- [ ] First publish of each package stays manual (trusted publishing needs an
      existing package), then switch to OIDC and remove any token.
- [ ] Verify provenance on the first org-published release and check that the
      `repository` field in each `package.json` points at the new URL.
- [ ] Re-run `pnpm licenses:check` and the SBOM step, if enabled.

## 6. Verification drill

- [ ] Open a PR from a fork: required checks run, no secrets are available, and
      merge is blocked without review.
- [ ] Merge a trivial PR: CI, CodeQL, Scorecard and Docs deploy all succeed.
- [ ] Confirm `https://swipeline.github.io/swipeline/` (or the custom domain)
      serves the playground and the JSON Schema downloads.
- [ ] Run `pnpm install --frozen-lockfile && pnpm test && pnpm build` from a
      fresh clone of the new URL.
- [ ] Publish a `0.0.1` canary from the new org and install it in a scratch
      project.

## 7. Rollback

The transfer is reversible while the old owner still has admin access. If the
organisation cannot complete the checklist, transfer back, keep the repo
unpublished, and record the blocker in #18 rather than publishing from a
half-configured setup.

## Updating action pins

Every `uses:` in `.github/workflows` is pinned to a full commit SHA with the
version in a trailing comment. To bump one deliberately:

```bash
gh api repos/actions/checkout/releases/latest --jq .tag_name   # e.g. v7.0.1
gh api repos/actions/checkout/commits/v7.0.1 --jq .sha         # 40-hex commit
```

Replace the SHA and the comment together, then let CI prove the workflow still
runs. Dependabot updates the pinned SHAs for the `github-actions` ecosystem; a
manual bump is only needed when a group is held back.
