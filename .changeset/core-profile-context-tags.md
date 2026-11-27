---
"@swipeline/core": patch
---

Fall back to `event.context.tags` in `rebuildProfile` when `tagsByCardId` is omitted or lacks an entry for the card, while keeping `tagsByCardId` precedence and ignoring malformed `context.tags` values.
