# First publish runbook

`docs/releases/0.4.1.md` records the situation: thirty packages are versioned,
built and dry-run clean, and none of them exist on npm. OIDC cannot change that
on its own — npm only accepts a trusted publisher for a package that is already
on the registry — so the first publish needs one credential, created by a person,
once.

::: tip Status
Blocked. The repository has no `NPM_TOKEN`, so the Release workflow reaches the
registry and fails per package with `E404 Not Found`. Everything below the token
step is already in place: `pnpm publish:check` proves all thirty manifests are
acceptable, and the workflow verifies the result afterwards.
:::

## 1. Before the token

- [ ] The [organisation transfer](/operations/org-transfer) is done, or is
      deliberately deferred — the npm scope, the repository owner and the
      trusted-publisher registration must all agree in the end.
- [ ] The npm account that creates the token owns the `@swipeline` scope
      (an npm organisation, not a personal scope) and can publish
      `create-swipeline`.
- [ ] That account has 2FA, and at least one other maintainer can publish.
- [ ] `pnpm publish:check` passes locally: thirty packages accepted by
      `npm publish --dry-run`, every advertised entry point in the tarball.

## 2. Create the automation token

On npmjs.com → **Access Tokens** → **Generate New Token** → **Granular Access
Token**:

| Field | Value |
|---|---|
| Name | `swipeline-release` |
| Expiration | 90 days |
| Permissions | Read and write |
| Packages and scopes | `@swipeline` (all packages), plus `create-swipeline` |
| Bypass 2FA | Yes — CI cannot answer a one-time password |

A classic automation token also works but grants every package the account can
reach; the granular token is the narrower choice. Note the expiration date
somewhere a calendar will see it: an expired token fails the release the same way
a missing one does.

## 3. Store it where the job runs

The `release` job declares `environment: npm-publish`, so the narrowest place is
a secret on that environment:

```bash
gh secret set NPM_TOKEN --env npm-publish --repo JoeyHammoth/Swipeline
gh secret list --env npm-publish --repo JoeyHammoth/Swipeline
```

A repository secret works too (`gh secret set NPM_TOKEN`), and then any workflow
can read it. Prefer the environment.

## 4. Publish

The Release workflow runs on every push to `main`. With no changesets pending it
only builds and opens nothing. To publish `0.4.1`:

1. Merge the `chore: version packages` PR that `changesets/action` opened (or
   push one), which is the push that triggers publishing.
2. Watch the **Create release PR or publish** step; it runs `pnpm release`, which
   builds and calls `changeset publish`.
3. The next step, **Every published package version resolves on npm**, asks the
   registry for each manifest version and fails naming any package that did not
   arrive. A green job means all thirty are live.

To retry, re-run the Release workflow; a package that already published at that
version is skipped by changesets, and the verification step checks it again.

## 5. Verify by hand, once

```bash
npm view @swipeline/core version                       # 0.4.1
pnpm publish:check:registry                            # the same check CI runs
npm view @swipeline/core --json | jq '.dist.attestations'   # not null
```

Then install it away from the workspace:

```bash
cd "$(mktemp -d)" && npm init -y >/dev/null && npm install @swipeline/core@0.4.1
node -e "import('@swipeline/core').then((m) => console.log(Object.keys(m).length))"
```

On npmjs.com the package should read "Built and signed on GitHub Actions", and
its repository link should be the URL the packages advertise.

## 6. Switch to trusted publishing

Only after every package exists:

- [ ] For each of the thirty packages: **Settings → Trusted publishing → GitHub
      Actions**, with repository `JoeyHammoth/Swipeline`, workflow `release.yml`
      and environment `npm-publish`.
- [ ] Remove `NODE_AUTH_TOKEN` from the changesets step, drop the
      **Check for a first-publish token** step, and delete both the `NPM_TOKEN`
      secret and the token on npmjs.com.
- [ ] Publish the next release and confirm the log has no token, the job still
      has `id-token: write`, and provenance is still attached.

## 7. Failure modes

| Symptom | Likely cause |
|---|---|
| `E404 Not Found` on publish | The scope is not owned by the token's account, or the token is scoped to other packages |
| `E403 Forbidden` | Token lacks write permission, or 2FA is not bypassed for automation |
| `E409 Conflict` | That version already exists — publish the fix as the next patch, do not reuse a version |
| Some packages resolve, others do not | The verification step names them; fix the cause and re-run Release |
| Published but no provenance | `NPM_CONFIG_PROVENANCE` unset, or `id-token: write` removed from the job |

## 8. Rollback

Within 72 hours, and with no dependents, `npm unpublish <package>@<version>` is
allowed; after that, patch forward or `npm deprecate`. The version number is
spent either way.

## After it lands

- [ ] Tick the first-publish item in [the roadmap](/roadmap).
- [ ] Record the run ID and the registry check result in
      [the 0.4.1 release notes](/releases/0.4.1).
- [ ] `quickstart.yml` stops resolving the workspace and starts installing from
      npm; confirm the nightly scaffold-and-build job stays green.
