#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build-mac-app.sh — builds the Mac version of the app ("Designed for iPad" on
# Apple Silicon) and installs it to /Applications, replacing the previous copy.
# Called by auto-sync.sh after a green build so the installed Mac app always
# runs the latest update. Safe to run manually: bash scripts/build-mac-app.sh
#
# Requires: the web bundle already synced into the Xcode project
# (`npm run sync:ios`) — auto-sync.sh does this before calling us.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO="/Users/yoavtoren/Apps/usmle-review-app"
DERIVED="$HOME/Library/Developer/Xcode/DerivedData/usmle-mac"
APP_NAME="USMLE Tracker.app"
DEST="/Applications/$APP_NAME"

cd "$REPO/ios/App" || exit 1

xcodebuild -project App.xcodeproj \
  -scheme "USMLE Tracker" \
  -configuration Release \
  -destination 'platform=macOS,arch=arm64,variant=Designed for iPad' \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  build || { echo "xcodebuild failed"; exit 1; }

BUILT="$(find "$DERIVED/Build/Products" -maxdepth 2 -name "$APP_NAME" -print -quit)"
[ -n "$BUILT" ] || { echo "built .app not found under $DERIVED"; exit 1; }

# Install using macOS's "wrapped bundle" layout — iPad binaries can't be
# launched as a plain .app; Finder/LaunchServices need the Wrapper structure
# (the same layout the App Store uses for iPhone/iPad apps on Apple Silicon).
# If the app is open, macOS keeps the running process on the old binary; the
# update applies on next launch.
STAGE="$(mktemp -d)/$APP_NAME"
mkdir -p "$STAGE/Wrapper"
ditto "$BUILT" "$STAGE/Wrapper/$APP_NAME" || exit 1
ln -s "Wrapper/$APP_NAME" "$STAGE/WrappedBundle"
rm -rf "$DEST"
ditto "$STAGE" "$DEST" || exit 1
rm -rf "$(dirname "$STAGE")"
echo "installed → $DEST"
