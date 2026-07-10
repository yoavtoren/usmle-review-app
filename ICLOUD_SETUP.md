# Apple-account sync — every device, one Apple ID

Your study progress (test log, planner, First Aid coverage, spaced-repetition
schedule, streak, tasks) syncs through your **Apple account** on all platforms:

| Platform | How it connects | Login needed? |
| --- | --- | --- |
| iPhone / iPad / Mac app | CloudKit via the device's iCloud sign-in | No — automatic |
| Web (GitHub Pages, any browser) | CloudKit JS + **Sign in with Apple** login page | Yes — once per browser |

Everything lands in the same **CloudKit private database** (container
`iCloud.com.yoavtoren.usmlereview`), so a test logged in Safari shows up on the
iPad and vice versa. Merging is per-key last-write-wins, exactly like the old
KVS sync. If CloudKit isn't set up yet, native builds fall back to the legacy
iCloud Key-Value Store bridge (Mac ↔ iPad keep syncing as before) — the app
proves CloudKit with a real probe write on launch, since iCloud sign-in alone
doesn't mean the `KV` schema was deployed. While CloudKit is active, writes are
also mirrored to KVS so devices still on an older build stay in sync. The web
shows "setup needed" on the login/Profile page until the token is pasted in.

---

## What's in the repo

| File | Purpose |
| --- | --- |
| `ios/App/App/CloudKitKVPlugin.swift` | Native bridge to the CloudKit private DB (record type `KV`) |
| `ios/App/App/ICloudKVPlugin.swift` | Legacy `NSUbiquitousKeyValueStore` bridge (fallback) |
| `ios/App/App/MainViewController.swift` | Registers both plugins with the Capacitor bridge |
| `ios/App/App/App.entitlements` | iCloud CloudKit + KVS entitlements, container pinned to Production |
| `src/lib/cloudConfig.js` | Container ID + CloudKit JS API token (**paste your token here**) |
| `src/lib/cloudkitWeb.js` | CloudKit JS backend — Apple sign-in + record fetch/save |
| `src/lib/icloudSync.js` | Sync engine: localStorage ↔ cloud, per-key last-write-wins |
| `src/components/AccountPage.jsx` | `/account` page + the first-visit web login gate |

Data model: one record per localStorage key — record type `KV`, single string
field `payload` = JSON `{t, v}` (timestamp + raw value). Records are fetched by
known record names, so no CloudKit queries or indexes are needed.

---

## One-time setup (needs your Apple ID — ~10 minutes)

### 1. Xcode — enable the CloudKit capability

1. Open `ios/App/App.xcodeproj`, select the **App** target → **Signing & Capabilities**.
2. Confirm Team = your paid developer team, bundle ID `com.yoavtoren.usmlereview`.
3. **+ Capability → iCloud** (if not already there), then check **CloudKit**
   (keep **Key-value storage** checked too — it's the fallback).
4. Under **Containers**, tick/add `iCloud.com.yoavtoren.usmlereview`.
   Xcode registers the container with Apple automatically.

The committed `App.entitlements` already contains the matching keys, including
`com.apple.developer.icloud-container-environment = Production` so debug builds,
TestFlight and the web all share **one** database.

### 2. CloudKit Console — create the schema and deploy it

1. Go to <https://icloud.developer.apple.com> → sign in → open container
   `iCloud.com.yoavtoren.usmlereview`.
2. **Schema → Record Types → +**: create type `KV` with one field
   `payload` of type **String**. Save.
3. **Deploy Schema Changes… → Deploy to Production** (required — the app pins
   the Production environment, which never auto-creates types).

### 3. CloudKit Console — create the web API token

1. Same container → **API Access** (a.k.a. Tokens) → **New CloudKit JS API Token**.
2. Name it (e.g. `web-app`), environment **Production**, and allow
   **Sign in with Apple ID** (the default web-auth flow). Create and copy the token.
3. Paste it into `src/lib/cloudConfig.js` → `apiToken: "…"`.
   The token is safe to ship publicly — it only lets a signed-in user touch
   their *own* private database.

### 4. Rebuild

```bash
npm run sync:ios     # native bundle (dist-ios) + cap sync
```

⚠️ Always `sync:ios` for the app (never plain `npm run build` before `cap sync`) —
the iOS app needs the relative-base build. The web deploy + Mac app rebuild happen
automatically via the auto-sync hook.

---

## Using it

- **Native (iPhone/iPad/Mac):** just be signed into iCloud in system settings.
  No login screen; sync starts on launch, pulls on foreground, pushes ~1s after
  any change, and polls every 2 minutes while open.
- **Web:** first visit shows the **Sign in with Apple** gate (skippable with
  "לא עכשיו"). The session persists in the browser. The sidebar's
  **פרופיל** (`/account`) page shows status, last sync time, "Sync now"
  and sign-out; its icon carries a live dot (green = synced, amber = attention).

### Verify it works

1. Sign in on the web, log a test → within a couple of seconds open the iPad
   app → the test is there.
2. Change something on the iPad, refocus the browser tab → it reloads with the
   change (pull happens on tab focus and every 2 min).

## Safety nets

- Before the cloud ever overwrites anything, the untouched local state is
  snapshotted to the `usmle:icloud-prelink-backup` localStorage key.
- Manual JSON export/import lives in `src/lib/storage.js`
  (`exportAllData` / `importAllData`).
- Conflicts: per-key last-write-wins — editing tasks on one device and First
  Aid on another both survive; editing the *same* key on two offline devices
  keeps whichever synced last.

## Notes & limits

- CloudKit private-DB storage counts against *your* iCloud quota — these ~18
  small JSON records are negligible.
- The legacy Mac ↔ iPad KVS sync keeps working on builds made before the
  CloudKit capability was enabled; once rebuilt, those devices switch to
  CloudKit automatically (their local data seeds the new database on first run).
- Browsers have no CloudKit push channel, so remote changes appear on tab
  focus / every 2 minutes / on "Sync now" — not instantly.
