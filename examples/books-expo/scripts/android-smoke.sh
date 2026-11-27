#!/usr/bin/env bash
# Drives the Expo smoke app on a booted Android emulator and fails unless the
# scripted swipe reports its like on screen. Run by .github/workflows/android.yml,
# where `android-emulator-runner` supplies the device.
set -euo pipefail

APK="examples/books-expo/android/app/build/outputs/apk/release/app-release.apk"

adb install -r "$APK"
adb shell am start -W -n dev.swipeline.expo/.MainActivity

# Metro is not running: this is a release APK with the bundle inside it. The line
# "✓ liked …" appears once the app's scripted swipe has reached the engine and
# written the event.
for attempt in 1 2 3 4 5 6; do
  sleep 10
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  if adb shell cat /sdcard/ui.xml 2>/dev/null | grep -q "liked"; then
    echo "The deck reported:"
    adb shell cat /sdcard/ui.xml | grep -o 'text="[^"]*liked[^"]*"' || true
    exit 0
  fi
done

adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
adb shell cat /sdcard/ui.xml 2>/dev/null || true
echo "::error::the deck never reported a like"
exit 1
