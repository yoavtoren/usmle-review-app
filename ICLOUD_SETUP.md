# iCloud progress sync — setup

Your study progress (test scores, First Aid coverage, spaced-repetition schedule,
streak, tasks) now syncs to **iCloud Key-Value Store**, tied to your Apple ID, and
mirrors automatically across every device signed into that Apple ID.

The code is done. One one-time step remains — it needs **your Apple ID** and a
**paid Apple Developer account** ($99/yr), because Apple only grants the iCloud
entitlement to paid accounts.

---

## What's already in the repo

| File | Purpose |
|------|---------|
| `ios/App/App/ICloudKVPlugin.swift` | Native bridge to `NSUbiquitousKeyValueStore` |
| `ios/App/App/MainViewController.swift` | Registers the plugin with the Capacitor bridge |
| `ios/App/App/App.entitlements` | Grants the iCloud key-value permission |
| `src/lib/icloudSync.js` | Mirrors localStorage ↔ iCloud (per-key last-write-wins) |
| `src/main.jsx` | Pulls iCloud data before first render |

On the **web build** and when **not signed into iCloud**, sync is a silent no-op —
the app works exactly as before.

---

## Rebuilding the web bundle into the app

From the project root:

```bash
npm run sync:ios
```

⚠️ Always use `sync:ios` (never a plain `npm run build` before `cap sync`) — the
iOS app needs the relative-base build. `sync:ios` builds it into `dist-ios/`,
which Capacitor copies into the app; the web build in `dist/` keeps the GitHub
Pages base and would blank-screen inside the app.

The plugin file and its registration (`MainViewController.swift`) are already part
of the Xcode project — no manual Xcode file steps needed.

## Step — Turn on signing + the iCloud capability

1. Select the blue **App** project → **App** target → **Signing & Capabilities**.
2. Under **Signing**, set **Team** to your paid Apple Developer team and make sure
   *Automatically manage signing* is checked. Confirm the Bundle Identifier is
   `com.yoavtoren.usmlereview`.
3. Click **+ Capability** (top-left of that tab) → add **iCloud**.
4. In the iCloud section that appears, check **Key-value storage**.

Xcode wires the entitlement into your provisioning profile automatically. It may
create/point to its own `App.entitlements` — that's fine; the committed one has the
same single key (`com.apple.developer.ubiquity-kvstore-identifier =
$(TeamIdentifierPrefix)$(CFBundleIdentifier)`).

---

## Run it

- Sign the iPad/iPhone into iCloud (Settings → your name → iCloud must be on).
- Build & run from Xcode onto the device.
- Progress now pushes to iCloud on every change and pulls on launch / when the app
  returns to the foreground / when another device changes something.

## How to verify sync works

1. Run on device A, log a test or mark a review — wait a couple of seconds.
2. Run on device B (same Apple ID) → your data appears on launch.
3. Change something on B, foreground A → A reloads with B's change.

## Safety net

The first time iCloud sync applies remote data, your original untouched local state
is saved to the `usmle:icloud-prelink-backup` localStorage key, so nothing you had
before linking can be lost. The existing JSON export/import in
`src/lib/storage.js` (`exportAllData` / `importAllData`) remains as a manual backup.

## Mac app

The same app runs natively on the MacBook (Apple Silicon, "Designed for iPad"
mode) as **/Applications/USMLE Tracker.app**. It shares the exact same iCloud
key-value container (`QNP44Q5Q3X.com.yoavtoren.usmlereview`) as the iPad, so
progress syncs both ways automatically — no extra setup beyond being signed
into the same Apple ID.

- `scripts/build-mac-app.sh` rebuilds it and reinstalls to /Applications.
  iPad binaries can't launch as a plain `.app` on macOS — the script installs
  the App Store-style *wrapped bundle* layout (`Wrapper/` + `WrappedBundle`
  symlink), which is what makes it double-clickable.
- `scripts/auto-sync.sh` (the Stop hook) calls it after every green build, so
  the installed Mac app always has the latest update — it takes effect the
  next time the app is launched (quit + reopen to pick it up).

## Notes & limits

- iCloud KVS budget is **1 MB total / 1024 keys** — this app uses ~15 small JSON
  keys, far under the limit.
- Conflict handling is **per-key last-write-wins**: editing tasks on one device and
  First Aid on another both survive; editing the *same* key on two offline devices
  keeps whichever synced last.
- Sync needs iCloud Drive enabled and network access; offline changes push on
  reconnect.
