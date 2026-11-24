# Swipeline

The vocabulary of the swipe-first discovery toolkit. Terms here are specific to
this project. If code, docs or an issue disagree with this glossary, the
glossary wins and the code is wrong.

## Language

### Data and sources

**Card**:
The normalized, versioned representation of one item a person can swipe on. Every source produces Cards, whatever the original shape.
_Avoid_: item, record, entry, result

**Source adapter**:
A module that pages through one external source and normalizes its records into Cards. It owns pagination, attribution and rate-limit behaviour.
_Avoid_: connector, provider, integration, fetcher

**Item store**:
The cache of normalized Cards for a deck. It is not the event log and holds no user preferences.
_Avoid_: item cache, database, repository

**Attribution**:
The credit a source requires on a Card, declared by its adapter and rendered by the UI.
_Avoid_: credit, source note, footer

### Decks and swiping

**Deck**:
The ordered set of Cards a specific actor sees for one deck configuration. A deck is a view over source, ranking and history, not a stored list.
_Avoid_: feed, list, queue, stack

**Deck configuration**:
The declarative definition of a deck: source, stores, ranking pipeline, actions and theme. Serializable except for functions.
_Avoid_: deck config file, settings, options

**Deck manifest**:
A serialized deck configuration containing no executable code, safe to share and import.
_Avoid_: config export, preset, template

**Deck engine**:
The headless state machine that loads, prefetches, ranks, commits swipes, keeps the undo stack and emits events. It has no UI dependency.
_Avoid_: deck store, controller, view model, manager

**Deck store**:
The observable interface a binding subscribes to: `getSnapshot`, `getServerSnapshot`, `subscribe`, `dispatch`. One engine exposes one store.
_Avoid_: state, redux store, context

**Snapshot**:
The immutable, referentially stable value returned by `getSnapshot`. Unchanged state returns the same reference.
_Avoid_: state, model, view state

**Swipe action**:
The semantic meaning of a gesture or button: `like`, `dislike`, `superlike`, `skip`, `later`, `undo`, or a custom string.
_Avoid_: gesture, reaction, vote

**Swipe event**:
The append-only record of one swipe action by one actor on one Card, with position, dwell time and context.
_Avoid_: swipe, action, click, interaction

**Actor**:
The pseudonymous identity whose history a profile is derived from. Never required to be a real person or to contain PII.
_Avoid_: user, account, person

**Event log**:
The append-only, ordered store of Swipe events. It is the source of truth for a deck's history.
_Avoid_: history table, audit log, activity feed

**Profile**:
The derived preferences for one actor and deck — preference vector, tag posteriors, counters — rebuildable from the event log.
_Avoid_: user model, taste profile, embedding

### Ranking

**Rank stage**:
A small typed function that transforms a rank context: filters, scores, diversifies or annotates candidates.
_Avoid_: ranker, scorer, algorithm, plugin

**Ranking pipeline**:
The ordered composition of rank stages that turns candidates into a deck.
_Avoid_: ranker, recommender, engine

**Rank context**:
The object passed through a pipeline: actor, deck, candidates with scores and reasons, profile, limit and a seedable RNG.
_Avoid_: request, query, state

**Cold start**:
The state of an actor with too little history for preference-based ranking. Handled by popularity, recency, seeds and higher exploration.
_Avoid_: new user, bootstrap, zero state

**Exploration**:
Deliberately surfacing uncertain or random Cards so the profile learns and the deck avoids a filter bubble.
_Avoid_: randomness, noise, novelty

**Reason**:
A short human-readable explanation attached by a rank stage for the UI or debugging, such as "similar to 3 things you liked".
_Avoid_: explanation text, why, justification

### Storage and sync

**Sink**:
A destination for batches of Swipe events outside the event log, such as a webhook, a JSONL file or a host application's database.
_Avoid_: exporter, consumer, listener

**Outbox**:
The local queue of events awaiting delivery to a server or sink, retried with the event id as the idempotency key.
_Avoid_: queue, buffer, pending writes

**Tier**:
One of the three adoption levels: Embed (client only), Serve (with the optional server), Integrate (headless inside your own stack).
_Avoid_: plan, edition, mode

### UI and bindings

**Binding**:
A thin package that renders a deck for one UI framework by subscribing to a deck store and rendering a snapshot.
_Avoid_: wrapper, adapter, component library

**Gestures module**:
The framework-free pointer, keyboard and reduced-motion controller shared by web bindings.
_Avoid_: gesture handler, drag library, interaction layer

**Conformance suite**:
The binding test suite a binding must pass to be listed as official or compatible.
_Avoid_: test kit, e2e tests, checklist

**Playground**:
The in-browser docs page that runs a deck from a manifest so people can try sources and ranking without installing anything.
_Avoid_: demo, sandbox, example app
