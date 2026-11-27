# CLI

The `swipeline` command scaffolds a deck manifest, previews a deck, runs the
optional server, works with a portable JSONL history and runs the benchmark.
Everything it does is also a library call; the CLI exists to remove setup
friction.

## Implemented

| Command | What it does |
|---|---|
| `swipeline init [dir] [--template <name>] [--id <deckId>] [--force]` | Writes `swipeline.deck.json` and prints the next step for the detected framework |
| `swipeline source add <url> [--id <sourceId>] [--config <file>] [--deck <deckId>]` | Fetches a sample, infers the field map and previews the cards it would produce |
| `swipeline dev [--config <file>] [--port <port>] [--db <file>] [--actor <id>]` | Loads the source, serves a playground on the real API routes and records swipes in SQLite |
| `swipeline serve [--port <port>] [--host <host>] [--cors <origin>]… [--db <file>]` | Starts the HTTP API; `--db` persists the event log in SQLite |
| `swipeline validate <history.jsonl>` | Validates every non-empty line against the `SwipeEvent` schema and reports line numbers |
| `swipeline export <swipes.db> [--actor] [--deck] [--since] [--until] [--after] [--limit] [--out]` | Writes a stored history as JSONL |
| `swipeline import <swipes.db> <history.jsonl>` | Validates the file, then appends it; a bad line imports nothing |
| `swipeline doctor [--db <file>]` | Reports the Node version, `fetch`, and the schema version and row count of a database |
| `swipeline bench [--seed] [--users] [--cards] [--k] [--gate]` | Runs the synthetic-user benchmark; `--gate` exits 3 on a regression |
| `swipeline help` | Prints usage |

```bash
# Start from a template and preview it against the live source
swipeline init . --template books
swipeline dev

# Map an API you already have, then check the cards it produces
swipeline source add https://api.example.com/items --config swipeline.deck.json
swipeline dev --config swipeline.deck.json

# Serve the API for a local client, keeping history across restarts
swipeline serve --port 8787 --db ./swipes.db --cors http://localhost:5173

# Move a history between machines
swipeline export ./swipes.db --actor reader > history.jsonl
swipeline import ./swipes.db history.jsonl

# Fail a release when the ranker regresses
swipeline bench --gate
```

## `init`, `source add` and `dev`

`init` writes a manifest, never a project: it refuses to replace an existing
`swipeline.deck.json` unless you pass `--force`, and it prints the one install
command that matches the framework it detected in `package.json`.

`source add` fetches the URL once, finds the first array of objects, and maps
`id`/`title`/`subtitle`/`tags` from the first record. The inference is shallow on
purpose — it maps flat scalar fields, because guessing at nested objects would
produce a config that looks right and silently drops rows. It prints the cards it
would produce so you can see the mapping before trusting it.

`dev` loads the manifest, fetches one page, and serves a playground on the same
port as the real API: `/api/*` is the documented server surface, and `/dev/swipe`
is a dev-only shortcut that records a swipe with a generated ULID. Swipes go to
`.swipeline/dev.db` by default, so a reload keeps them.

## `serve`, `export` and `import`

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

## `doctor` and `bench`

`doctor` reports the runtime against the `>=24` requirement and, for a `--db`
path, the schema version and event count. `bench --gate` compares the default
pipeline against the best baseline and exits `3` when it does not win.

New projects come from `create-swipeline` (`npm create swipeline@latest`), which
is a separate binary.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation failed, a file or database could not be used, or the runtime is unsupported |
| `2` | Bad usage |
| `3` | Benchmark regression (`bench --gate`) |

CI relies on these codes, so they are part of the contract.
