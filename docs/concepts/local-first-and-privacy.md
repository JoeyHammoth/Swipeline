# Local-first and privacy

Swipe history is sensitive. A list of liked and rejected apartments, jobs,
health articles or people says something about a person that they may not want to
share, and may not want a company to hold at all. The defaults reflect that.

## What local-first means here

| Tier 1 (default) | What leaves the device |
|---|---|
| Source requests | The ones your adapter makes, to the source you configured |
| Cards, events, profiles | Nothing |
| Telemetry, remote config, phone-home | None |

There is no Swipeline service. The packages contain no analytics. If your app
collects usage data, that is your app's decision, made in your code, with your
consent flow.

## Pseudonymous by construction

`actor` is an opaque string. Swipeline never asks for an email, a name or a device
fingerprint. If your product has real accounts, map them to an opaque id on your
side; the log never needs to know who the person is.

## Consent is a hook, not a checkbox

When you add sinks or the server, gate delivery per event:

```ts
const engine = createEngine({
  // ...
  consent: async (event) => policy.allows(event, currentUser),
})
```

A `ConsentPolicy` that returns `false` stops both logging and delivery for that
event. `undo` is always recorded, because dropping it would make the log
incoherent. Policies are evaluated on the way out, so changing them does not
rewrite history.

## Export and erase are features

```ts
await engine.exportActor('actor-1')  // JSONL
await engine.eraseActor('actor-1')   // irreversible
```

- **Export** produces the manifest plus a JSONL of events: portable across
  devices, apps and Swipeline versions.
- **Erase** removes every event for the actor across every deck, plus derived
  profiles. It is the only operation that touches history.

## Guidance for builders

1. **Say what you collect.** If you add a sink, tell users in plain language and
   make it configurable.
2. **Prefer on-device ranking.** Tier 1 ranking avoids sending preference data at
   all; server ranking is an optimization, not the default because it is easier.
3. **Be careful with sensitive categories.** Housing, employment, health, credit
   and dating have legal and ethical constraints on profiling in many
   jurisdictions. Swipe data can be a proxy for protected characteristics.
4. **Retention is a decision.** If you store events server-side, decide how long
   and implement it; the server supports deletion by actor, not automatic expiry.
5. **No dark patterns.** `later` exists for "not now". Do not map `dislike` to a
   hidden penalty the user cannot see, and show the undo.
6. **Sharing a deck is not sharing a person.** A manifest contains a source
   mapping and ranking config, never events.

## Threat model (what this does and does not defend)

| Threat | Mitigation |
|---|---|
| Accidental upload of preference data | Local-first default, consent hook |
| History left after a user leaves | `eraseActor`, documented in the server guide |
| Webhook forgery | HMAC-signed batches with timestamp and event id |
| A malicious adapter exfiltrating data | Adapters are installed code; review them. Manifests contain no code |
| Browser storage inspection by another local user | Out of scope; use device-level protections |

The project's own [security policy](https://github.com/JoeyHammoth/Swipeline/blob/main/SECURITY.md)
covers reporting vulnerabilities in this code, not the privacy posture of apps
built with it.
