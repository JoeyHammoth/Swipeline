# 0012: `sqlite-vec` is optional, never the default

**Status:** accepted

Vector search defaults to brute-force exact cosine. `sqlite-vec` (0.1.9 on npm,
verified 2026-11-24) is still pre-1.0, so it ships as an optional driver behind
the `VectorIndex` interface and is never bundled or required. Related SQLite
vector extensions with "commercial license required for production" terms are
excluded by the dependency-license policy entirely. This protects the default
install from a moving API and from non-permissive terms, at the cost of an
exact scan that is fast enough for the candidate sizes the toolkit targets.
