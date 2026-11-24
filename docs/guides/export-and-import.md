# Export and import history

History is portable by design: a manifest plus a JSONL of events.

## Export

```bash
swipeline export --actor local-8f2c --out ./swipeline-export
```

```text
swipeline-export/
├── deck.json        # the manifest: source mapping, actions, ranking
└── events.jsonl     # one SwipeEvent per line, ULID order
```

Programmatically:

```ts
const events = await engine.exportActor('local-8f2c')
const manifest = deck.toManifest()
```

## Import

```bash
swipeline import ./swipeline-export --actor local-8f2c
```

Import behaviour:

| Situation | Result |
|---|---|
| Event id already exists | Skipped (idempotent) |
| Card id unknown to the source | Event kept; the card is re-fetched lazily or the event is ignored by `seenFilter` |
| Manifest has a schema version newer than the library | Refused with a clear error |
| Actor differs from the current one | `--actor` remaps on import |

Remapping an actor is how a person moves history to a new device: export, then
import under the new local actor id.

## Format details

`events.jsonl` is newline-delimited JSON, one event per line, sorted by ULID. It is
the same format the server returns from `GET /export/:actor` and the same format
sinks can write. Nothing is compressed or wrapped, so `grep`, `jq` and `wc -l` work.

## What an export does not contain

- No card bodies. Cards are cached data from the source, not user data.
- No profile. Profiles are derived; they are rebuilt from the events (which is
  also why exporting after changing ranker weights is safe).
- No credentials, no source API keys.

## Erasing instead

```bash
swipeline erase --actor local-8f2c --yes
```

Removes every event and derived profile for that actor, across all decks, in every
configured store. It is irreversible; the CLI requires `--yes` and prints the
count first. The server exposes the same operation as `DELETE /actors/:actor`.
