# Landscape

Where Swipeline sits, honestly. This page is written to help someone decide
*not* to use it, if that is the right answer.

## The three neighbours

| | Swipe UI libraries | Recommender engines | Swipeline |
|---|---|---|---|
| Examples | react-native-deck-swiper, react-card-swiper, svelte-swiper-cards, card-flick | Gorse, Recombee, Amazon Personalize, LensKit, LightFM | — |
| Gestures and card UI | Yes | No | Yes |
| Data source adapters | No | Model/item setup required | Yes, declarative or typed |
| Swipe semantics (undo, later, dwell) | Callbacks only | No | Yes, in the event schema |
| Ranking for one-card-at-a-time decks | No | Generic; needs your modelling | Yes, with cold start and diversity |
| Infrastructure | None | Database + cache, often several services | None in Tier 1 |
| Local-first | Sometimes | No | Yes, by default |
| Measurable quality in CI | No | Not by default | Yes, synthetic benchmark |

## When to use something else

- **You only need the gesture.** Use an existing swipe component. Swipeline is
  more than you need, and the extra layer is real.
- **You already run a recommender at scale.** Keep it. Use the `external` rank
  stage to call it and use Swipeline for the deck, events and local-first storage.
- **You need two-sided matching.** Out of scope. Dating and marketplace matching
  are a different product with different privacy and fairness problems.
- **You need a hosted service with an SLA.** There is none. Tier 2 is
  self-hosted; a hosted offering, if it ever exists, would be a separate project.

## Gorse specifically

Gorse is a complement, not a competitor. It is a full recommender system with a
dashboard and multi-service deployment; Swipeline is a client-side toolkit for a
50-card deck. They meet at `external`: Swipeline can send events to Gorse and use
its ranking, keeping Swipeline's card schema, UI bindings and local history.

## Where this analysis comes from

A landscape check in November 2026, summarised in
[§1 of the design plan](/swipeline-design-and-implementation-plan#1-the-gap-what-exists-and-what-is-missing).
It is evidence, not proof: absence of a comparable project in a search is not
evidence that none exists.

**Before public launch**, the check is repeated against GitHub, npm, PyPI,
pub.dev, Product Hunt and Hacker News with the queries "swipe deck SDK", "swipe
recommendations library", "tinder-style feed backend" and "card swipe +
recommender", and the results are recorded here. If a project already does this
better, this page says so in the first paragraph.
