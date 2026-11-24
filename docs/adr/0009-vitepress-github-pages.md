# 0009: VitePress on GitHub Pages

**Status:** accepted

Documentation is a VitePress site built from `docs/` and deployed to GitHub Pages
by a workflow. VitePress is Markdown-first, has local search and dark mode built
in, and allows the interactive playground to be embedded as a Vue island without
a separate app. Its latest stable release is 1.6.4 (verified 2026-11-24 — no 2.x
exists), so the build is pinned to that line. Docusaurus and Starlight were
viable; the choice is not load-bearing beyond the site's build output, which is
plain static files.
