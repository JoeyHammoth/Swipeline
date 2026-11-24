# 0003: The event log is the source of truth; profiles are derived

**Status:** accepted

Swipe events are appended to an immutable log and every preference artifact —
preference vector, tag posteriors, counters — is a projection that can be
rebuilt with `rebuildProfile(actor, deck)`. This makes ranking-config changes
lossless, makes history export a `JSONL` dump rather than a migration, and lets
the benchmark replay real logs. The cost is that reads sometimes need a rebuild
and that undo must be modelled as a compensating event rather than a delete; the
engine handles both. Storing mutable profile state as the primary record was
rejected because any scoring change would silently invalidate it.
