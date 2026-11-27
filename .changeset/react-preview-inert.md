---
"@swipeline/react": patch
---

Mark the preview card `inert` as well as `aria-hidden`, so a custom card's links and buttons no longer stay in the tab order. Found by the example-app accessibility audit (`aria-hidden-focus`).
