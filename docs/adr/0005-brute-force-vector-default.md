# 0005: Brute-force exact vector search by default

**Status:** accepted

The default `VectorIndex` scans typed arrays with exact cosine similarity. A
per-user candidate pool is hundreds to a few thousand cards, where an exact scan
is fast, dependency-free and works identically in a browser, a worker and Node.
An approximate or native index is an optimization behind the same interface,
swapped in when profiling justifies it. This also keeps the default path off
pre-1.0 database extensions, whose licensing and stability would otherwise
become the project's problem.
