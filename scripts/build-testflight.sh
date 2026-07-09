#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build-testflight.sh — archives the iOS app and uploads it to TestFlight.
# After processing (~10-15 min), install it from the TestFlight app on the
# iPad AND on the Mac (Apple-silicon Macs can run iPad builds via TestFlight).
#
# Usage: bash scripts/build-testflight.sh [--upload-only]
#   --upload-only  skip the rebuild/archive and re-upload the existing archive
#                  (e.g. after fixing an App Store Connect issue like missingApp)
#
# Auth for the upload, in order of preference:
#   1. App Store Connect API key — put AuthKey_<KEYID>.p8 in
#      ~/.appstoreconnect/private_keys/ and export ASC_ISSUER_ID=<issuer-uuid>
#      (create at appstoreconnect.apple.com → Users and Access → Integrations).
#   2. The Apple ID session already signed into Xcode (Settings → Accounts).
#
# One-time prerequisite: an app record for com.yoavtoren.usmlereview must
# exist in App Store Connect (appstoreconnect.apple.com → My Apps → "+").
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="/Users/yoavtoren/Apps/usmle-review-app"
ARCHIVE="$HOME/Library/Developer/Xcode/DerivedData/usmle-archive/USMLE.xcarchive"
EXPORT_PLIST="$REPO/scripts/exportOptions-testflight.plist"
BUILD_NUM="$(date +%Y%m%d%H%M)"   # ascending build number, e.g. 202607092130

if [ "${1:-}" = "--upload-only" ]; then
  [ -d "$ARCHIVE" ] || { echo "No archive at $ARCHIVE — run without --upload-only first."; exit 1; }
  BUILD_NUM="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$ARCHIVE/Info.plist")"
  echo "── Skipping build; re-uploading existing archive (build $BUILD_NUM)…"
else
  echo "── Building web bundle + syncing Capacitor…"
  cd "$REPO"
  npm run sync:ios

  echo "── Archiving (build $BUILD_NUM)…"
  cd "$REPO/ios/App"
  xcodebuild archive \
    -project App.xcodeproj \
    -scheme "USMLE Tracker" \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    CURRENT_PROJECT_VERSION="$BUILD_NUM" \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration
fi

# Optional App Store Connect API key (more reliable than the Xcode session).
AUTH_ARGS=()
KEY_FILE="$(ls "$HOME/.appstoreconnect/private_keys"/AuthKey_*.p8 2>/dev/null | head -1 || true)"
if [ -n "$KEY_FILE" ] && [ -n "${ASC_ISSUER_ID:-}" ]; then
  KEY_ID="$(basename "$KEY_FILE" .p8)"; KEY_ID="${KEY_ID#AuthKey_}"
  AUTH_ARGS=(-authenticationKeyPath "$KEY_FILE" \
             -authenticationKeyID "$KEY_ID" \
             -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  echo "── Uploading with App Store Connect API key $KEY_ID…"
else
  echo "── Uploading with the Apple ID signed into Xcode…"
fi

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates \
  "${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}"

echo ""
echo "✓ Uploaded build $BUILD_NUM. It appears in TestFlight after Apple finishes"
echo "  processing (usually 10–15 min): App Store Connect → TestFlight tab."
echo "  Install on iPad/Mac via the TestFlight app (same Apple ID)."
