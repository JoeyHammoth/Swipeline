# 0008: GitHub Actions with Changesets and npm trusted publishing

**Status:** accepted

CI runs on GitHub Actions; versions and changelogs come from Changesets; npm
publishing uses OIDC trusted publishing with provenance instead of a stored
token. This puts the whole quality and release path in one public, reviewable
system and removes the long-lived credential that a supply-chain compromise
would look for. The cost: the first release of each package must be published
manually before a trusted publisher can be registered on npm, and the
"Version Packages" PR created with `GITHUB_TOKEN` does not trigger CI on itself,
so that single bot PR needs a manual re-run or an app token. Both are documented
in the release workflow rather than discovered at the first release.
