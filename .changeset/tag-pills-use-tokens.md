---
'@swipeline/element': patch
'@swipeline/react': patch
---

Tag pills are drawn from the palette instead of a fixed light grey, which left
the tag text inherited from a dark page on a near-white pill, and both packages'
`var()` fallbacks carry the new palette values so a deck without a stylesheet
matches the theme.
