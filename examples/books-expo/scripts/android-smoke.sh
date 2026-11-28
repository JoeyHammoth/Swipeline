#!/usr/bin/env bash
# Drives the Expo smoke app on a booted Android emulator and fails unless the
# scripted swipe reports its like on screen. Run by .github/workflows/android.yml,
# where `android-emulator-runner` supplies the device.
set -euo pipefail

APK="examples/books-expo/android/app/build/outputs/apk/release/app-release.apk"

adb install -r "$APK"
adb shell am start -W -n dev.swipeline.expo/.MainActivity

dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/ui.xml 2>/dev/null || true
}

# Metro is not running: this is a release APK with the bundle inside it. The line
# "✓ liked …" appears once the app's scripted swipe has reached the engine and
# written the event.
for attempt in 1 2 3 4 5 6; do
  sleep 10
  UI=$(dump_ui)
  if printf '%s' "$UI" | grep -q "liked"; then
    echo "The deck reported:"
    printf '%s' "$UI" | grep -o 'text="[^"]*liked[^"]*"' || true
    break
  fi
done

if ! printf '%s' "${UI:-}" | grep -q "liked"; then
  dump_ui
  echo "::error::the deck never reported a like"
  exit 1
fi

# What a screen reader consumes, not the pixels: the deck root and every action
# control must carry a label. TalkBack itself is not driven here — an assistive
# technology pass is still manual.
A11Y=$(dump_ui)
if ! printf '%s' "$A11Y" | grep -q 'content-desc="Book deck"'; then
  echo "::error::the deck exposes no accessibility label"
  exit 1
fi

LABELLED=$(printf '%s' "$A11Y" |
  grep -o 'content-desc="[^"]*"[^>]*clickable="true"' |
  sed -E 's/content-desc="([^"]*)".*/\1/' | grep -v '^$' | sort -u)
COUNT=$(printf '%s\n' "$LABELLED" | grep -c . || true)
if [ "$COUNT" -lt 3 ]; then
  echo "::error::only $COUNT labelled controls in the accessibility tree"
  printf '%s\n' "$LABELLED"
  exit 1
fi
echo "Accessibility tree: deck labelled, $COUNT labelled controls:"
printf '%s\n' "$LABELLED"
