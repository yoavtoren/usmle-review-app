// ── The canonical registry of every localStorage key that holds real user data ──
//
// ONE list, three consumers:
//   • Apple-account sync   — icloudSync.SYNC_KEYS
//   • JSON backup          — storage.exportAllData / importAllData
//   • local snapshot ring  — storage.snapshotAll / restoreSnapshot
//
// They used to be three hand-maintained lists that drifted: the error log was
// synced and wiped by a reset but was NOT in the backup, so "export your data"
// silently produced an incomplete file. Adding a key here now makes it sync AND
// back up AND be recoverable. That coupling is the point.
//
// UI-only prefs are deliberately absent — device-local layout choices
// (rail collapsed, rail panel tab, sound on/off) must not bounce between
// devices, and losing them costs nothing.

export const DATA_KEYS = [
  "usmle-review-progress-v1",   // spaced-repetition cards
  "usmle-tasks-v1",             // USMLE study tasks
  "general-tasks-v1",           // personal tasks
  "fa-topics-v2",               // First Aid topic coverage
  "test-log-v9",                // unified UWorld/NBME test log (result+stats+feeling)
  "usmle-scheduler-v1",         // adaptive planner state
  "usmle-error-log-v1",         // error log (ENCODE step — why each question was missed)
  "usmle-q-seen-v1",            // question import timestamps
  "usmle-app:reset-progress-v2",// one-time reset guard (synced → runs once)
  "usmle-streak-v1",            // daily streak
  "usmle-q-intake-v1",          // question intake
  "usmle-topic-ctr-v1",         // topic counters
  "usmle-fa-intake-v1",         // First Aid intake
  "usmle-light-mode-v1",        // pause / light mode
  "usmle-app:aims-tasks-v2",    // AIMS tasks
  "usmle-app:rail-notes-v1",    // sidebar scratch notes
  "usmle-app:rhythms-v1",       // workstream rhythms
  "usmle-app:reminder-state-v1",// reminder dismiss / snooze
  "usmle-app:email-config-v1",  // email reminder config
  "fa-book-last-page",          // last First Aid page read
];

export const DATA_KEY_SET = new Set(DATA_KEYS);

// Keys whose stored value is a RAW STRING, not JSON. Export/import must not
// JSON-encode these a second time — and `JSON.parse("")` on an empty scratch
// note throws, which is how rail notes were being dropped from backups.
export const RAW_STRING_KEYS = new Set([
  "usmle-app:rail-notes-v1",
  "fa-book-last-page",
]);

/** Read a key into its natural JS value (object for JSON keys, string for raw). */
export function readKey(k) {
  const raw = localStorage.getItem(k);
  if (raw == null) return undefined;
  if (RAW_STRING_KEYS.has(k)) return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

/** Write a value back under `k`, respecting whether the key stores raw strings. */
export function writeKey(k, v) {
  if (v === undefined) return;
  const raw = (RAW_STRING_KEYS.has(k) || typeof v === "string") ? String(v) : JSON.stringify(v);
  localStorage.setItem(k, raw);
}
