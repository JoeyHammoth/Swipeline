#!/usr/bin/env bash
# Builds the Expo smoke app for an iOS simulator, installs it, launches it and
# fails unless the app logs its scripted-swipe result. Run by
# .github/workflows/ios.yml after `expo prebuild` has generated `ios/`.
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="dev.swipeline.expo"

UDID=$(xcrun simctl list devices available -j |
  jq -r '[.devices[][] | select(.name | startswith("iPhone"))] | .[0].udid')
if [ -z "$UDID" ] || [ "$UDID" = "null" ]; then
  echo "::error::no iPhone simulator is available on this runner"
  exit 1
fi
echo "Simulator: $UDID"

WORKSPACE=$(ls -d ios/*.xcworkspace | sed -n 1p)
PROJECT=$(ls -d ios/*.xcodeproj | sed -n 1p)
# The workspace lists every Pods scheme too (`boost` sorts first), so pick the
# scheme named after the app's own project, and only fall back to the first
# non-Pods scheme.
WANTED=$(basename "$PROJECT" .xcodeproj)
SCHEMES=$(xcodebuild -workspace "$WORKSPACE" -list -json | jq -r '.workspace.schemes[]')
SCHEME=$(printf '%s\n' "$SCHEMES" | grep -Fx "$WANTED" || printf '%s\n' "$SCHEMES" | grep -v '^Pods' | sed -n 1p)
if [ -z "$SCHEME" ]; then
  echo "::error::no app scheme in $WORKSPACE; schemes were:"
  printf '%s\n' "$SCHEMES"
  exit 1
fi
echo "Workspace: $WORKSPACE, scheme: $SCHEME"

# A Release build inlines the JavaScript bundle, so the simulator needs no Metro.
# The full log goes to a file: GitHub truncates a 20k-line xcodebuild run and
# takes the error lines with it, so only the failures are printed.
if ! xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build \
  CODE_SIGNING_ALLOWED=NO \
  build > ios-build.log 2>&1; then
  echo "--- build errors"
  grep -E "error:|The following build commands failed" -A 4 ios-build.log | sed -n 1,60p
  echo "--- tail"
  tail -20 ios-build.log
  exit 1
fi

# BSD find on macOS has no `-maxdepth`, so search the products tree by name.
# `sed -n 1p` rather than `head -1`: head closes the pipe and `pipefail` would
# turn that into a failure.
APP=$(find ios/build/Build/Products -type d -name '*.app' 2>/dev/null | sed -n 1p)
if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "::error::xcodebuild produced no .app under ios/build/Build/Products"
  ls -R ios/build/Build/Products | sed -n 1,40p
  exit 1
fi
echo "App: $APP"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE_ID"

# The app writes its result into its own container, which the host can read:
# pixels are not readable here and a release build's `console.log` never reaches
# the simulator log.
CONTAINER=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)
RESULT="$CONTAINER/Documents/smoke.txt"
for _ in $(seq 1 24); do
  if [ -f "$RESULT" ]; then
    case "$(cat "$RESULT")" in
      pass*)
        echo "The app reported: $(cat "$RESULT")"
        exit 0
        ;;
      fail*)
        echo "::error::the deck failed its scripted swipe: $(cat "$RESULT")"
        exit 1
        ;;
    esac
  fi
  sleep 5
done

echo "--- app log"
xcrun simctl spawn "$UDID" log show --last 2m --style compact \
  --predicate 'process CONTAINS "Swipeline"' 2>/dev/null | tail -40 || true
echo "::error::the app never reported a like"
exit 1
