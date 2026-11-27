# CLI

The `swipeline` command runs the optional server, works with a portable JSONL
history and runs the benchmark. Everything it does is also a library call; the
CLI exists to remove setup friction.

::: warning Milestone M3 in progress
`serve`, `validate`, `export`, `import`, `doctor` and `bench` are implemented in
`@swipeline/cli`. The three commands under
[Planned](#planned-v03-contract) are not, and the CLI exits with code 2 for them
rather than writing files nothing reads yet.
:::

## Implemented

| Command | What it does |
|---|---|
| `swipeline serve [--port <port>] [--host <host>] [--cors <origin>]… [--db <file>]` | Starts the HTTP API; `--db` persists the event log in SQLite |
| `swipeline validate <history.jsonl>` | Validates every non-empty line against the `SwipeEvent` schema and reports line numbers |
| `swipeline export <swipes.db> [--actor] [--deck] [--since] [--until] [--after] [--limit] [--out]` | Writes a stored history as JSONL |
| `swipeline import <swipes.db> <history.jsonl>` | Validates the file, then appends it; a bad line imports nothing |
| `swipeline doctor [--db <file>]` | Reports the Node version, `fetch`, and the schema version and row count of a database |
| `swipeline bench [--seed] [--users] [--cards] [--k] [--gate]` | Runs the synthetic-user benchmark; `--gate` exits 3 on a regression |
| `swipeline help` | Prints usage |

```bash
# Serve the API for a local client, keeping history across restarts
swipeline serve --port 8787 --db ./swipes.db --cors http://localhost:5173

# Move a history between machines
swipeline export ./swipes.db --actor reader > history.jsonl
swipeline import ./swipes.db history.jsonl

# Check an exported history before importing it somewhere else
swipeline validate ./history.jsonl

# Fail a release when the ranker regresses
swipeline bench --gate
```

Without `--db`, `serve` keeps the log in memory and history is lost when the
process exits. With it, the log is a SQLite file through
`@swipeline/store-sqlite` — see [Self-host the server](/guides/self-host-the-server).

`export` writes JSONL to stdout so it redirects cleanly, and puts the count on
stderr. `import` validates the whole file before writing, so a half-imported
history is not possible.

`validate` ignores blank lines, so a file with a trailing newline is fine:

```text
$ swipeline validate ./history.jsonl
line 2: id: Invalid string: must match pattern ...
1 invalid line(s).
```

## Planned (v0.3 contract)

| Command | What it will do |
|---|---|
| `npm create swipeline@latest <dir> -- --template <name>` | Scaffold a project (`blank`, `books`, `papers`, `recipes`, `products`) |
| `swipeline init` | Detect the framework, write `deck.config.ts`, print the install command |
| `swipeline source add <url \| adapter>` | Fetch a sample, preview normalized cards, write the mapping |
| `swipeline dev` | Local playground with a ranker inspector and "why this card" |

The three `swipeline` commands need the deck config format and the playground that
consume them; they are tracked in the M3 epic.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation failed, a file or database could not be used, or the runtime is unsupported |
| `2` | Bad usage, or a command that is not implemented yet |
| `3` | Benchmark regression (`bench --gate`) |

CI relies on these codes, so they are part of the contract.
