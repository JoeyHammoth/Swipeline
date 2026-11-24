# 0006: Ranking personalizes without ML by default; embeddings are an upgrade

**Status:** accepted

With no `Embedder` configured, the preference vector is built from hashed
tag-and-text features and scoring uses tag posteriors, so a deck is personalized
after a dozen swipes with zero model downloads, native dependencies or
credentials. Embeddings, external rankers and LLM re-ranking are optional stages
that a user opts into, never part of the default pipeline. This keeps the
library usable in offline, privacy-sensitive and low-resource environments, and
keeps cold start honest: popularity and exploration do the work until there is
signal.
