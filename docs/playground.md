# Playground

An in-browser deck you can try without installing anything. Pick a bundled source,
adjust how much your swipes steer the order, and watch the deck re-rank as you go.

<Playground />

## What v0 does

- Runs entirely in the browser against bundled fixtures: no network, no account,
  no upload.
- Derives tag affinities from your swipes with the same action weights as the
  engine defaults (`superlike` 2, `like` 1, `later` 0.5, `dislike` -0.6).
- Re-ranks the remaining cards by tag affinity, blended by the weight slider.
- Shows a per-card "why this card" line and the live taste bars.
- Encodes the manifest in the URL hash, and exports the manifest plus a JSONL
  history of the session.

## What v0 does not do yet

- It does not call Open Library or arXiv. Live sources arrive with the HTTP
  adapter in M2, and only CORS-friendly, terms-permitting sources will be offered.
- It does not run `prefVector`, `thompson`, `epsilonRandom` or `mmr`. Those stages
  ship with `@swipeline/rank` in M2; the panel lists only what actually runs.
- Nothing is persisted. Reloading clears the session unless you exported it.

## Share links are data, never code

```text
#manifest=eyJhY3Rpb25zIjp7ImRvd24iOiJsYXRlciIsImxlZnQiOiJkaXNsaWtlIiwi...
```

The hash is a base64url-encoded JSON manifest. Before it is applied it is
validated against a closed shape:

1. Exactly the known keys (`schemaVersion`, `id`, `dataset`, `actions`,
   `pipeline`, `tagWeight`). Anything else is refused.
2. `dataset` must be one of the bundled fixtures, `pipeline` may only name stages
   this page implements, and `tagWeight` must be between 0 and 1.
3. `actions` must map all four directions to a known action.
4. The payload is parsed as JSON and never evaluated; a bad link falls back to
   the default deck with a visible message.

The page makes no requests, so a manifest cannot point it at a third-party
endpoint.

## Accessibility

Every action has a button and a keyboard shortcut (← → ↑ ↓, `U` to undo), changes
are announced in a polite live region, focus stays on the controls you pressed,
and the layout honours `prefers-reduced-motion`. The playground reuses the same
action weights and keyboard map the bindings must implement.
