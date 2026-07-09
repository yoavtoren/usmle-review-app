// iCloud sync for all study progress.
//
// Mirrors the app's localStorage keys into Apple's iCloud Key-Value Store via
// the native ICloudKV plugin (see ios/App/App/ICloudKVPlugin.swift). Data syncs
// automatically across every device signed into the same Apple ID.
//
// Strategy: per-key last-write-wins. Each synced key carries a timestamp; on
// reconcile the newer side wins for that key (so editing tasks on one device and
// First Aid on another both survive). On the very first link we stash a full
// local snapshot in `usmle:icloud-prelink-backup` so the original state is always
// recoverable. On the web build (no native plugin) this module is a no-op and the
// app behaves exactly as before.

import { Capacitor, registerPlugin } from "@capacitor/core";

const ICloudKV = registerPlugin("ICloudKV");

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
const CLOUD_PREFIX = "kv:";                       // iCloud key namespace

// Original, un-patched storage methods — used for applying remote changes so we
// don't re-trigger a push loop.
const rawSet = localStorage.setItem.bind(localStorage);
const rawRemove = localStorage.removeItem.bind(localStorage);

let enabled = false;
let meta = loadMeta();
const pendingPush = new Set();
let pushTimer = null;
let reloadTimer = null;

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
  catch { return {}; }
}
function saveMeta() {
  try { rawSet(META_KEY, JSON.stringify(meta)); } catch {}
}

// ── native bridge helpers ────────────────────────────────────────────────
async function cloudSetItem(localKey, t, v) {
  await ICloudKV.setItem({
    key: CLOUD_PREFIX + localKey,
    value: JSON.stringify({ t, v }),
  });
}
async function cloudGetAll() {
  const { items } = await ICloudKV.getAll();
  const out = {};
  for (const [k, raw] of Object.entries(items || {})) {
    if (!k.startsWith(CLOUD_PREFIX)) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.t === "number") out[k.slice(CLOUD_PREFIX.length)] = parsed;
    } catch {}
  }
  return out; // { localKey: { t, v } }
}

// ── push (local → iCloud) ────────────────────────────────────────────────
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
  for (const k of keys) {
    const v = localStorage.getItem(k); // null if removed
    const t = meta[k] || Date.now();
    try { await cloudSetItem(k, t, v); } catch {}
  }
  try { await ICloudKV.sync(); } catch {}
}

// ── reconcile (merge iCloud ↔ local, per-key LWW) ─────────────────────────
async function reconcile({ startup } = {}) {
  if (!enabled) return false;
  let cloud;
  try { cloud = await cloudGetAll(); } catch { return false; }

  let localChanged = false;
  const toPush = [];

  for (const K of SYNC_KEYS) {
    const entry = cloud[K];               // { t, v } or undefined
    const localV = localStorage.getItem(K);
    const localT = meta[K] || 0;

    if (entry && entry.t > localT) {
      // iCloud is newer for this key → apply it locally.
      if (entry.v == null) rawRemove(K);
      else rawSet(K, entry.v);
      meta[K] = entry.t;
      localChanged = true;
    } else if (localV != null && localT > (entry ? entry.t : 0)) {
      // Local is newer → push up.
      toPush.push([K, localT, localV]);
    } else if (localV != null && !entry && localT === 0) {
      // Never synced but we have local data → seed iCloud.
      const t = Date.now();
      meta[K] = t;
      toPush.push([K, t, localV]);
    }
  }

  saveMeta();
  for (const [K, t, v] of toPush) {
    try { await cloudSetItem(K, t, v); } catch {}
  }
  if (toPush.length) { try { await ICloudKV.sync(); } catch {} }

  if (localChanged && !startup) scheduleReload();
  return localChanged;
}

// External iCloud changes arrive mid-session; reload so every screen re-reads
// the freshly-applied data consistently. Debounced and only when data changed.
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => window.location.reload(), 900);
}

// Save the untouched local state once, before iCloud ever overwrites anything.
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

// Patch localStorage so every write to a synced key is mirrored to iCloud,
// without touching each call site across the app.
function installStoragePatch() {
  localStorage.setItem = function (k, v) {
    rawSet(k, v);
    if (SYNC_SET.has(k)) { meta[k] = Date.now(); saveMeta(); schedulePush(k); }
  };
  localStorage.removeItem = function (k) {
    rawRemove(k);
    if (SYNC_SET.has(k)) { meta[k] = Date.now(); saveMeta(); schedulePush(k); }
  };
}

/**
 * Initialise iCloud sync. Safe to await on every startup; returns immediately
 * on the web build or when the device isn't signed into iCloud.
 */
export async function initICloudSync() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { available } = await ICloudKV.isAvailable();
    if (!available) return; // not signed into iCloud / entitlement missing
  } catch {
    return; // plugin not present (e.g. capability not enabled yet)
  }

  enabled = true;
  backupBeforeFirstLink();
  installStoragePatch();

  // Pull latest before the first render so screens show synced data immediately.
  try { await ICloudKV.sync(); } catch {}
  await reconcile({ startup: true });

  // React to changes pushed from other devices while the app is open.
  try { ICloudKV.addListener("icloudChange", () => { reconcile({ startup: false }); }); } catch {}

  // Re-pull whenever the app returns to the foreground.
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("resume", async () => {
      try { await ICloudKV.sync(); } catch {}
      reconcile({ startup: false });
    });
  } catch {}
}

/** Force an immediate two-way sync (e.g. from a "Sync now" button). */
export async function syncNow() {
  if (!enabled) return false;
  try { await ICloudKV.sync(); } catch {}
  await flushPush();
  return reconcile({ startup: false });
}
