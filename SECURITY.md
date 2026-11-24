# Security Policy

## Supported versions

Swipeline is pre-alpha. Until `@swipeline/core` reaches 1.0, only the latest
published version of each package receives security fixes. After 1.0, the
latest minor of each major line is supported.

| Version | Supported |
|---|---|
| `main` (unreleased) | Fixes land here first |
| Latest published 0.x | Yes |
| Older 0.x | No |

## Reporting a vulnerability

**Do not open a public issue, discussion, or pull request for a security
problem.** Use GitHub's [private vulnerability reporting](https://github.com/JoeyHammoth/Swipeline/security/advisories/new)
for this repository. If that is unavailable, contact the maintainer
`@JoeyHammoth` privately on GitHub and ask for a secure channel before sharing
details.

Please include:

- The affected package and version.
- A description of the issue and its impact (for example: event-log forgery,
  webhook signature bypass, prototype pollution in an adapter mapping, XSS in a
  default card template).
- Reproduction steps or a proof of concept, if you have one.
- Whether the issue is already public anywhere.

## What to expect

| Stage | Target |
|---|---|
| Acknowledgement of your report | Within 3 business days |
| Initial assessment and severity | Within 7 business days |
| Fix or mitigation for critical/high issues in a published runtime package | Within 2–3 days of confirmation |
| Fix for medium issues | Next regular release |
| Public advisory | After a patched release is available, coordinated with you |

We will credit you in the advisory unless you ask us not to.

## Scope

In scope:

- Published `@swipeline/*` packages and `swipeline-adapter-*` packages
  maintained in this repository.
- The optional server, including webhook signing, authentication hooks and
  event ingestion.
- The documentation site, where it could execute untrusted content (the
  playground must only load declarative manifests).

Out of scope:

- Vulnerabilities in third-party dependencies with no exploit path through
  Swipeline code (report those upstream; we track them through Dependabot).
- Findings from automated scanners with no demonstrated impact.
- Social engineering and physical attacks.
- Denial of service through unrealistic resource exhaustion in a local-first
  library.

## Handling a confirmed vulnerability

1. A draft GitHub Security Advisory is opened privately.
2. The fix is developed in a private fork or a temporary private branch, never
   a public PR.
3. A patch release is published with provenance.
4. The advisory is published, a CVE requested where appropriate, and affected
   versions deprecated on npm if users must move.
5. The post-mortem is recorded in the advisory, including detection, impact and
   follow-up work.

## Supply chain

- Releases use npm trusted publishing (OIDC) with provenance attestations; no
  long-lived `NPM_TOKEN` is stored in the repository.
- GitHub Actions are pinned to commit SHAs and updated by Dependabot.
- CI installs with `--frozen-lockfile`, and dependency review blocks PRs that
  introduce known vulnerabilities or disallowed licenses.
- Maintainer accounts require two-factor authentication.

## Safe harbour

We will not pursue legal action against researchers who make a good-faith
effort to follow this policy, avoid privacy violations and data destruction,
and give us reasonable time to fix the issue before disclosure.
