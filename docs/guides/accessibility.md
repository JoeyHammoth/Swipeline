# Accessibility

A gesture interface excludes people by default. Swipeline treats accessibility as
part of a binding's definition of done, not a later audit.

<p align="center">
  <img src="/brand/icon-hand-drag.png" alt="Hand drag icon" width="64" height="64" />
</p>

## The requirements

| Requirement | How it is met | Checked by |
|---|---|---|
| Every action has a button | Default templates render a control row | Component tests + conformance |
| Every action has a keyboard shortcut | Arrow keys map to the configured actions; `Z` undoes | Conformance suite |
| Card changes are announced | ARIA live region with title and position | Conformance suite |
| Focus is managed on advance | Focus stays in the action group, not lost to `body` | Component tests |
| Reduced motion is honoured | `prefers-reduced-motion` switches to a fade, durations go to 0 | Conformance suite |
| Contrast is sufficient | Default theme meets WCAG AA; tokens documented | axe scan in CI |
| Custom cards keep access | Templates cannot remove the action controls | Review checklist |

## Keyboard map (default)

| Key | Action |
|---|---|
| `←` | dislike |
| `→` | like |
| `↑` | superlike |
| `↓` | later |
| `Z` | undo |
| `Tab` / `Shift+Tab` | move between actions |
| `Enter` / `Space` | activate the focused action |

Actions are configurable, so a deck that renames `later` to `save` keeps the same
keyboard surface. The map is published in the snapshot so a binding can render a
shortcut hint.

## Screen reader narrative

When the card advances, the live region announces:

```text
Card 4 of 20: "Project Hail Mary", by Andy Weir. 3 tags. Actions: dislike, undo, superlike, like.
```

Keep announcements short. Do not read the body automatically; a long abstract on
every card makes the deck unusable with a screen reader. The card content is
focusable for people who want to read it.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .swl-card { transition: opacity 150ms linear; transform: none !important; }
}
```

The gesture controller still commits on drag, but the card does not fly off
screen. The overlay labels appear without scaling.

## Testing it

- `axe` runs against every demo page in the `e2e` workflow.
- The binding conformance suite includes a keyboard-only path and a
  reduced-motion path.
- Manual checks before a release: VoiceOver on macOS/iOS, NVDA on Windows, and a
  keyboard-only run with the pointer physically disconnected.

## Reporting a barrier

Accessibility issues are bugs, not feature requests. Open a
[bug report](https://github.com/JoeyHammoth/Swipeline/issues/new?template=bug_report.yml)
with the `accessibility` label; they are triaged ahead of cosmetic issues.
