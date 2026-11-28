# Screen-reader script

The [accessibility audit](/reference/a11y-audit) has an automated half and a
manual half. This page is the manual half written as something one person can run
in about twenty minutes, with a place to record what they actually heard.

The automated checks prove what an assistive technology is *offered* — the
Android job reads the platform's accessibility tree and fails unless the deck root
and at least three controls carry labels. Only this script establishes what a
screen reader *says*, so a release that claims screen-reader support needs a
result recorded here first.

## Before you start

Write down the date, OS version and device for every pass. A result without them
cannot be compared with the next run, and the audit page asks for both.

### Browser fixtures

```bash
pnpm --filter ./examples/conformance dev --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/react.html` in Safari, then `element.html`,
`vue.html` and `svelte.html`. That is the same server and the same four pages
`pnpm e2e` scans.

### The mobile deck

```bash
pnpm build
cd examples/books-expo
npx expo prebuild --platform ios      # or --platform android
npx expo run:ios --device             # or: npx expo run:android --device
```

CI builds this app with `xcodebuild` and Gradle (`.github/workflows/ios.yml` and
`android.yml`); the `expo run` commands are the local equivalent and are not
exercised by this repository. If they fail, suspect the local toolchain before
filing a bug against the deck.

## Part A — VoiceOver with Safari (macOS)

1. Turn VoiceOver on with Command-F5. Cover the screen and use VoiceOver only —
   the point is what is reachable without seeing the page.
2. Load `react.html`. **Expect:** the card is announced with its title and
   position ("card 1 of 3" or similar), not as an anonymous group.
3. Press `Tab` until focus is on the deck, then `ArrowRight`. **Expect:** one
   announcement, containing the new card's title and position. Silence, or the
   whole body read out, is a failure.
4. Press `Tab` through the action controls. **Expect:** each one is announced
   with a usable name — "Like", "Dislike", "Later", "Superlike" plus a direction
   or shortcut — not "button".
5. Press Control-Option-Space on the Like control. **Expect:** the same single
   announcement as the arrow key, and focus still inside the deck.
6. Repeat steps 2–5 on `element.html`, `vue.html` and `svelte.html`. Note any
   binding that differs; they are expected to behave the same.
7. Turn off the screen (Control-Option-Shift-S or a dark overlay) and repeat
   step 3. **Expect:** the announcement does not depend on anything drawn.

## Part B — VoiceOver on iOS

1. Settings → Accessibility → VoiceOver, or triple-click the side button if that
   shortcut is set. Then launch the app from the home screen so VoiceOver starts
   with it, not mid-deck.
2. Swipe right through the elements. **Expect:** the deck, the card's title, the
   card's facts and finally one button per action plus undo, each with a name.
3. Double-tap the Like button. **Expect:** one announcement for the new card, and
   the undo control becomes available (it is announced as dimmed before any
   swipe).
4. Try a one-finger drag on the card while VoiceOver is on. **Expect:** the drag
   either does nothing or is announced once, and it never leaves VoiceOver stuck
   on a card that has already moved. This is the case the automated check cannot
   see.
5. Rotate to landscape and repeat step 2. **Expect:** the same labels, reachable.

## Part C — TalkBack on Android

1. Settings → Accessibility → TalkBack → Use TalkBack, then launch the app.
2. Swipe right through the elements. **Expect:** the same order and the same
   names as iOS: deck, title, facts, one control per action, undo.
3. Double-tap Like. **Expect:** one announcement for the next card, and undo is
   announced as unavailable before the first swipe and available after it.
4. Long-press an action control to check the local context menu is not offered
   when it has nothing to act on. **Expect:** nothing useful is missing from it.

## Recording the result

Edit the checklist in `docs/reference/a11y-audit.md`: change the `- [ ]` to
`- [x]` **only** for what you ran, and append a line beneath it with the date,
platform and what you heard, for example:

```text
- [x] TalkBack on Android with `examples/books-expo`: labels, disabled undo state,
      and one announcement per card.
      Run 2026-12-02, Pixel 7 / Android 15, TalkBack 15.0 — all three held; the
      announcement repeated once on a fast double-tap.
```

A failure is recorded the same way with `- [ ]` kept and the observation added.
Do not record a pass for a step you skipped, and do not record a pass on the
strength of the automated jobs: they never run a screen reader.
