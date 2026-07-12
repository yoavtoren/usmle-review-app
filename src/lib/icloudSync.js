// Apple-account sync for all study progress — every device, one Apple ID.
//
// The app's localStorage keys mirror into the app's CloudKit PRIVATE DATABASE
// (record type "KV", one record per key), which is tied to the user's Apple
// account:
//   • Native builds (iPhone/iPad/Mac): the CloudKitKV plugin talks to CloudKit
//     with the device's iCloud sign-in — no login screen. If CloudKit isn't
//     available it falls back to the legacy iCloud Key-Value Store bridge.
//   • Web build (GitHub Pages): CloudKit JS — the user signs in with their
//     Apple ID on the login page (see AccountPage.jsx); the session persists.
//
// Strategy: per-key last-write-wins. Each synced key carries a timestamp; on
// reconcile the newer side wins for that key (so editing tasks on one device
// and First Aid on another both survive). On the very first link we stash a
// full local snapshot in `usmle:icloud-prelink-backup` so the original state
// is always recoverable.

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  initWebCloud, webBackend, onAuthChange, isSignedIn, userLabel,
} from "./cloudkitWeb.js";
import { isWebCloudConfigured } from "./cloudConfig.js";

const CloudKitKV = registerPlugin("CloudKitKV");
const ICloudKV = registerPlugin("ICloudKV"); // legacy KVS fallback

// Data keys worth syncing. UI-only prefs (e.g. rail-collapsed) are intentionally
// excluded so device-local layout choices don't bounce between devices.
const SYNC_KEYS = [
  "usmle-review-progress-v1",   // spaced-repetition cards
  "usmle-tasks-v1",             // USMLE tasks
  "general-tasks-v1",           // personal tasks
  "fa-topics-v2",               // First Aid topic coverage
  "test-log-v9",                // unified UWorld/NBME test log (result+stats+feeling)
  "usmle-scheduler-v1",         // adaptive planner state
  "usmle-q-seen-v1",            // question import timestamps
  "usmle-app:reset-progress-v2",// one-time reset guard (synced → runs once)
  "usmle-streak-v1",            // daily streak
  "usmle-q-intake-v1",          // question intake
  "usmle-topic-ctr-v1",         // topic counters
  "usmle-fa-intake-v1",         // First Aid intake
  "usmle-light-mode-v1",        // pause / light mode
  "usmle-app:aims-tasks-v2",    // AIMS tasks
  "usmle-app:rhythms-v1",       // workstream rhythms
  "usmle-app:reminder-state-v1",// reminder dismiss / snooze
  "usmle-app:email-config-v1",  // email reminder config
  "fa-book-last-page",          // last First Aid page read
];
const SYNC_SET = new Set(SYNC_KEYS);

const META_KEY = "usmle:icloud-meta";           // { localKey: lastChangeMs }
const PRELINK_BACKUP_KEY = "usmle:icloud-prelink-backup";
const LOGIN_SKIP_KEY = "usmle-app:login-skip-v1"; // device-local "not now" on the web gate
const KVS_PREFIX = "kv:";                        // legacy iCloud KVS namespace
const POLL_MS = 120_000;                         // background pull cadence

// Original, un-patched storage methods — used for applying remote changes so we
// don't re-trigger a push loop.
const rawSet = localStorage.setItem.bind(localStorage);
const rawRemove = localStorage.removeItem.bind(localStorage);

let backend = null;    // { kind, getAll(keys), setItems(entries) }
let enabled = false;
let meta = loadMeta();
const pendingPush = new Set();
let pushTimer = null;
let reloadTimer = null;
let pollTimer = null;
let patched = false;

// ── status (consumed by the login gate + Account page) ─────────────────────
// state: "off" | "unavailable" | "loading" | "unconfigured" | "signed-out" | "on"
const status = {
  platform: Capacitor.isNativePlatform() ? "native" : "web",
  state: "off",
  backendKind: null,
  user: null,
  lastSyncAt: null,
  error: null,
};
const statusSubs = new Set();
function setStatus(patch) {
  Object.assign(status, patch);
  for (const cb of statusSubs) { try { cb({ ...status }); } catch {} }
}
export function getSyncStatus() { return { ...status }; }
export function subscribeSyncStatus(cb) {
  statusSubs.add(cb);
  return () => statusSubs.delete(cb);
}
export function isLoginSkipped() { return localStorage.getItem(LOGIN_SKIP_KEY) === "1"; }
export function setLoginSkipped() { rawSet(LOGIN_SKIP_KEY, "1"); setStatus({}); }

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
  catch { return {}; }
}
function saveMeta() {
  try { rawSet(META_KEY, JSON.stringify(meta)); } catch {}
}

// ── native backends ─────────────────────────────────────────────────────────
const nativeCloudKitBackend = {
  kind: "cloudkit-native",
  async getAll(keys) {
    const { items } = await CloudKitKV.getItems({ keys });
    return parsePayloadMap(items);
  },
  async setItems(entries) {
    await CloudKitKV.setItems({
      items: entries.map(({ key, t, v }) => ({ key, value: JSON.stringify({ t, v }) })),
    });
  },
};

// CloudKit primary + KVS mirror: reads take the newest copy per key, writes go
// to both. Keeps devices still running a pre-CloudKit build (KVS-only) in sync
// during the transition instead of splitting the data between two channels.
const nativeMergedBackend = {
  kind: "cloudkit-native",
  async getAll(keys) {
    const [ck, kvs] = await Promise.all([
      nativeCloudKitBackend.getAll(keys),
      nativeKVSBackend.getAll().catch(() => ({})),
    ]);
    const out = { ...kvs };
    for (const [k, entry] of Object.entries(ck)) {
      if (!out[k] || entry.t >= out[k].t) out[k] = entry;
    }
    return out;
  },
  async setItems(entries) {
    await nativeCloudKitBackend.setItems(entries);
    nativeKVSBackend.setItems(entries).catch(() => {});
  },
};

const nativeKVSBackend = {
  kind: "kvs-native",
  async getAll() {
    await ICloudKV.sync().catch(() => {});
    const { items } = await ICloudKV.getAll();
    const scoped = {};
    for (const [k, raw] of Object.entries(items || {})) {
      if (k.startsWith(KVS_PREFIX)) scoped[k.slice(KVS_PREFIX.length)] = raw;
    }
    return parsePayloadMap(scoped);
  },
  async setItems(entries) {
    for (const { key, t, v } of entries) {
      await ICloudKV.setItem({ key: KVS_PREFIX + key, value: JSON.stringify({ t, v }) });
    }
    await ICloudKV.sync().catch(() => {});
  },
};

function parsePayloadMap(items) {
  const out = {};
  for (const [k, raw] of Object.entries(items || {})) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.t === "number") out[k] = parsed;
    } catch {}
  }
  return out; // { localKey: { t, v } }
}

// ── push (local → cloud) ────────────────────────────────────────────────────
function schedulePush(localKey) {
  if (!enabled) return;
  pendingPush.add(localKey);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, 1200);
}
async function flushPush() {
  if (!enabled || pendingPush.size === 0) return;
  const keys = [...pendingPush];
  pendingPush.clear();
  const entries = keys.map((k) => ({
    key: k,
    t: meta[k] || Date.now(),
    v: localStorage.getItem(k), // null if removed
  }));
  try { await backend.setItems(entries); setStatus({ lastSyncAt: Date.now(), error: null }); }
  catch (e) { keys.forEach((k) => pendingPush.add(k)); setStatus({ error: String(e?.message || e) }); }
}

// ── reconcile (merge cloud ↔ local, per-key LWW) ────────────────────────────
async function reconcile({ startup } = {}) {
  if (!enabled) return false;
  let cloud;
  try { cloud = await backend.getAll(SYNC_KEYS); }
  catch (e) { setStatus({ error: String(e?.message || e) }); return false; }

  let localChanged = false;
  const toPush = [];

  for (const K of SYNC_KEYS) {
    const entry = cloud[K];               // { t, v } or undefined
    const localV = localStorage.getItem(K);
    const localT = meta[K] || 0;

    if (entry && entry.t > localT) {
      // Cloud is newer for this key → apply it locally.
      if (entry.v == null) rawRemove(K);
      else rawSet(K, entry.v);
      meta[K] = entry.t;
      localChanged = true;
    } else if (localV != null && localT > (entry ? entry.t : 0)) {
      // Local is newer → push up.
      toPush.push({ key: K, t: localT, v: localV });
    } else if (localV != null && !entry && localT === 0) {
      // Never synced but we have local data → seed the cloud.
      const t = Date.now();
      meta[K] = t;
      toPush.push({ key: K, t, v: localV });
    }
  }

  saveMeta();
  if (toPush.length) {
    try { await backend.setItems(toPush); } catch {}
  }
  setStatus({ lastSyncAt: Date.now(), error: null });

  // On the pre-render startup pull a change needs no reload; any later pull
  // does (screens re-read localStorage only on mount).
  const rendered = Boolean(document.getElementById("root")?.hasChildNodes());
  if (localChanged && (!startup || rendered)) scheduleReload();
  return localChanged;
}

// External changes arrive mid-session; reload so every screen re-reads the
// freshly-applied data consistently. Debounced and only when data changed.
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => window.location.reload(), 900);
}

// Save the untouched local state once, before the cloud ever overwrites anything.
function backupBeforeFirstLink() {
  if (localStorage.getItem(PRELINK_BACKUP_KEY)) return;
  const snapshot = {};
  let hasData = false;
  for (const K of SYNC_KEYS) {
    const v = localStorage.getItem(K);
    if (v != null) { snapshot[K] = v; hasData = true; }
  }
  if (hasData) {
    try { rawSet(PRELINK_BACKUP_KEY, JSON.stringify({ at: Date.now(), keys: snapshot })); } catch {}
  }
}

// Patch localStorage so every write to a synced key is mirrored to the cloud,
// without touching each call site across the app.
function installStoragePatch() {
  if (patched) return;
  patched = true;
  localStorage.setItem = function (k, v) {
    rawSet(k, v);
    if (SYNC_SET.has(k)) { meta[k] = Date.now(); saveMeta(); schedulePush(k); }
  };
  localStorage.removeItem = function (k) {
    rawRemove(k);
    if (SYNC_SET.has(k)) { meta[k] = Date.now(); saveMeta(); schedulePush(k); }
  };
}

// Periodic + focus-driven pulls: CloudKit has no push channel to a browser (and
// we skip silent-push complexity on native), so poll while visible.
function installPullTriggers() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") reconcile({ startup: false });
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && enabled) reconcile({ startup: false });
  });
}

async function enableSync(b, { startup } = {}) {
  backend = b;
  enabled = true;
  backupBeforeFirstLink();
  installStoragePatch();
  await reconcile({ startup: Boolean(startup) });
  installPullTriggers();
  setStatus({ state: "on", backendKind: b.kind, error: null });
}

function disableSync() {
  enabled = false;
  backend = null;
  clearInterval(pollTimer);
  pendingPush.clear();
}

// ── init ────────────────────────────────────────────────────────────────────
// accountStatus == .available only proves the device is signed into iCloud —
// NOT that the KV record type was deployed to the Production schema. Until that
// one-time console step is done every save fails, so prove CloudKit with a real
// round-trip write before trusting it; otherwise stay on the KVS bridge that
// has always worked.
async function cloudKitUsable() {
  try {
    const { available } = await CloudKitKV.isAvailable();
    if (!available) return false;
    await Promise.race([
      CloudKitKV.setItems({
        items: [{ key: "usmle:ck-probe", value: JSON.stringify({ t: Date.now(), v: "1" }) }],
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("probe timeout")), 4000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function initNativeSync() {
  // Prefer CloudKit (shared with the web); fall back to the legacy KVS bridge
  // so sync keeps working until the CloudKit schema/token setup is completed.
  const ckOk = await cloudKitUsable();
  let kvsOk = false;
  try { kvsOk = (await ICloudKV.isAvailable()).available; } catch {}

  if (!ckOk && !kvsOk) { setStatus({ state: "unavailable" }); return; }
  const b = ckOk ? (kvsOk ? nativeMergedBackend : nativeCloudKitBackend) : nativeKVSBackend;
  await enableSync(b, { startup: true });
  if (kvsOk) {
    try { ICloudKV.addListener("icloudChange", () => { reconcile({ startup: false }); }); } catch {}
  }
  hookNativeResume();
}

async function hookNativeResume() {
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("resume", () => { reconcile({ startup: false }); });
  } catch {}
}

async function initWebSync() {
  if (!isWebCloudConfigured()) { setStatus({ state: "unconfigured" }); return; }
  setStatus({ state: "loading" });

  const start = async () => {
    try {
      const { signedIn } = await initWebCloud();
      onAuthChange(async (nowSignedIn) => {
        if (nowSignedIn) {
          setStatus({ user: userLabel() });
          await enableSync(webBackend, { startup: false });
        } else {
          disableSync();
          setStatus({ state: "signed-out", user: null, backendKind: null });
          scheduleReload(); // drop in-memory state from the signed-out account
        }
      });
      if (signedIn) {
        setStatus({ user: userLabel() });
        await enableSync(webBackend, { startup: true });
      } else {
        setStatus({ state: "signed-out" });
      }
    } catch (e) {
      setStatus({ state: "off", error: String(e?.message || e) });
    }
  };

  // Don't let a slow CDN block first paint: give the restore-session path a
  // short head start, then render regardless — sync finishes in the background
  // and reloads once if it pulled newer data.
  await Promise.race([start(), new Promise((r) => setTimeout(r, 2500))]);
}

/**
 * Initialise Apple-account sync. Safe to await on every startup; on the web it
 * yields within ~2.5s even if the network is slow, and continues in background.
 */
export async function initICloudSync() {
  if (Capacitor.isNativePlatform()) await initNativeSync();
  else await initWebSync();
}

/** Force an immediate two-way sync (e.g. from a "Sync now" button). */
export async function syncNow() {
  if (!enabled) return false;
  await flushPush();
  return reconcile({ startup: false });
}

// ── Manual one-way transfer (explicit "Upload" / "Download" buttons) ─────────
// The automatic per-key last-write-wins merge can silently do nothing when a
// device's timestamps look "newer" than reality (e.g. after a clock skew or a
// re-imported backup). These two give the user a deterministic override: push
// THIS device's state up, or pull the cloud's state down — no timestamp compare.

/** Push every synced key's current local value to the cloud (this device wins). */
export async function uploadAll() {
  if (!enabled || !backend) return { ok: false, reason: "sync-off", count: 0 };
  await flushPush(); // drain anything already queued so it can't clobber us later
  const now = Date.now();
  const entries = [];
  for (const K of SYNC_KEYS) {
    const v = localStorage.getItem(K);
    if (v == null) continue; // a manual upload seeds the cloud, never deletes from it
    meta[K] = now;
    entries.push({ key: K, t: now, v });
  }
  saveMeta();
  if (!entries.length) return { ok: true, count: 0 };
  try {
    await backend.setItems(entries);
    setStatus({ lastSyncAt: Date.now(), error: null });
    return { ok: true, count: entries.length };
  } catch (e) {
    setStatus({ error: String(e?.message || e) });
    return { ok: false, reason: String(e?.message || e), count: 0 };
  }
}

/** Pull every synced key from the cloud, overwriting local (cloud wins), then reload. */
export async function downloadAll() {
  if (!enabled || !backend) return { ok: false, reason: "sync-off", count: 0 };
  let cloud;
  try { cloud = await backend.getAll(SYNC_KEYS); }
  catch (e) { setStatus({ error: String(e?.message || e) }); return { ok: false, reason: String(e?.message || e), count: 0 }; }

  let changed = 0;
  for (const K of SYNC_KEYS) {
    const entry = cloud[K]; // { t, v } or undefined
    if (!entry) continue;   // nothing in the cloud for this key → keep whatever's local
    if (entry.v == null) rawRemove(K);
    else rawSet(K, entry.v);
    meta[K] = entry.t;
    changed++;
  }
  saveMeta();
  setStatus({ lastSyncAt: Date.now(), error: null });
  if (changed) scheduleReload(); // screens re-read localStorage only on mount
  return { ok: true, count: changed };
}
