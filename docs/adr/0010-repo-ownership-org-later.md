# 0010: Personal repository through M0, organisation before first publish

**Status:** accepted. Supersedes the plan's "GitHub organisation from day one".

The design plan recommends creating a GitHub organisation before the repository.
The name `swipeline` is free (verified 2026-11-24), but creating an organisation
is an account and ownership decision that only the owner can make, and M0 work is
unblocked without it. The repository therefore lives at
`JoeyHammoth/Swipeline` through M0 and is transferred to the reserved
`swipeline` organisation before the first publish; GitHub redirects the old
location afterwards, so existing links keep working. This is deliberately
time-boxed: publishing packages from a personal account would bake the wrong
provenance and URLs into the first releases.
