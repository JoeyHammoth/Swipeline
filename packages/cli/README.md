# @swipeline/cli

The `swipeline` command. It runs the server, works with a portable JSONL history
and runs the benchmark — all against the same SQLite file when you pass `--db`.

```bash
swipeline serve --port 8787 --db ./swipes.db
swipeline export ./swipes.db --actor reader > history.jsonl
swipeline import ./swipes.db history.jsonl
swipeline doctor --db ./swipes.db
swipeline bench --gate
```

## `swipeline serve`

Starts `@swipeline/server`. Without `--db` the event log is in memory and history
lasts as long as the process; with `--db` it is a SQLite file that survives a
restart.

| Flag | Default | Meaning |
|---|---|---|
| `--port` | `8787` | Listen port |
| `--host` | `127.0.0.1` | Bind address |
| `--cors` | none | Allowed origin; repeat for more |
| `--db` | none | SQLite file to persist the event log |

## `swipeline validate`

Reads a JSONL export and validates every non-empty line against the `SwipeEvent`
schema. Errors print with their line number:

```text
$ swipeline validate ./history.jsonl
line 2: id: Invalid string: must match pattern ...
1 invalid line(s).
```

Blank lines are ignored, so an export with a trailing newline is fine.

## `swipeline export` and `swipeline import`

`export` writes JSONL to stdout, so it redirects cleanly; the count goes to
stderr. `--out <file>` writes to a file instead. Filters are the same ones
`EventStore.query` takes: `--actor`, `--deck`, `--since`, `--until`, `--after`
(a ULID cursor) and `--limit`.

`import` validates the whole file first and appends only if every line is valid,
so a bad export cannot leave a half-imported history behind. Both commands create
the database on first use; `export` refuses a path that does not exist, because a
typo should not look like an empty history.

## `swipeline doctor`

Reports the Node version against the `>=24` requirement, `fetch` availability,
and for a `--db` path the schema version and event count, plus whether the
directory is writable. Exit code 1 means the runtime is too old or the database
could not be opened.

## `swipeline bench`

Runs `runBenchmark` and prints precision@k, time-to-first-like and diversity per
strategy. `--gate` compares the default pipeline against the best of the random,
popularity and tag-only baselines and exits `3` when the default does not win,
which is what CI uses to catch a ranking regression.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation failed, a file could not be read, or the runtime is unsupported |
| `2` | Bad usage |
| `3` | Benchmark regression (`bench --gate`) |

## Planned

`init`, `source add` and `dev` are the rest of the v0.3 contract. They need the
deck config format and the playground that consume them, so they are not
implemented yet rather than shipped as commands that write files nothing reads.
