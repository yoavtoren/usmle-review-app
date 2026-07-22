// Error log — the ENCODE step of the 4-pass loop, made a real store.
// One line per miss: what it was, WHY you missed it, and what you did about it.
// The "why" column is the gold: careless → timing/technique fix, gap → more reps,
// misconception → re-LEARN that concept. Reviewed before every NBME.
//
// Same house style as storage.js: pure-ish helpers, every mutator saves and
// returns the new list. Key is synced (icloudSync SYNC_KEYS) and wiped by
// resetAllProgress (storage.RESET_KEYS).

import { localISODate } from "./config.js";

export const ERROR_LOG_KEY = "usmle-error-log-v1";

// Why it was missed. Each reason carries the fix it implies, which is what the
// weekly tally turns into advice.
export const WHY = [
  { code: "misconception", icon: "🌀", label: "Misconception", implies: "Re-LEARN that concept — feed it into next week's LEARN pass." },
  { code: "gap",           icon: "🕳️", label: "Knowledge gap", implies: "More reps — unsuspend the cards and let spacing do the work." },
  { code: "careless",      icon: "⚡", label: "Careless",       implies: "Timing / technique fix — slow down on the stem, not on the content." },
];

// What you did about it — the ENCODE action. Exactly one per miss.
export const FIX = [
  { code: "unsuspend", icon: "🧷", label: "Unsuspended AnKing card(s)" },
  { code: "annotate",  icon: "✍️", label: "Annotated First Aid" },
  { code: "cloze",     icon: "🆕", label: "Made one cloze card" },
];

export const SELF_MADE_CAP = 5; // hard cap on self-made cloze cards per day

export function loadErrors() {
  try {
    const raw = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

export function saveErrors(list) {
  try { localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(list)); } catch { /* quota */ }
  return list;
}

// entry: { system, topic, why, fix, note?, date? }
export function addError(entry) {
  const row = {
    id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: entry.date || localISODate(),
    system: entry.system || "",
    topic: (entry.topic || "").trim(),
    why: entry.why || "gap",
    fix: entry.fix || "unsuspend",
    note: (entry.note || "").trim(),
    createdAt: Date.now(),
  };
  return saveErrors([row, ...loadErrors()]);
}

export function updateError(id, patch) {
  return saveErrors(loadErrors().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function deleteError(id) {
  return saveErrors(loadErrors().filter((e) => e.id !== id));
}

// How many cloze cards you've hand-made today (against SELF_MADE_CAP).
export function selfMadeToday(list = loadErrors(), dateISO = localISODate()) {
  return list.filter((e) => e.date === dateISO && e.fix === "cloze").length;
}

// Weekly tally of the "why" column — the review the brief asks for.
export function whyCounts(list = loadErrors(), sinceISO = null) {
  const rows = sinceISO ? list.filter((e) => e.date >= sinceISO) : list;
  const out = Object.fromEntries(WHY.map((w) => [w.code, 0]));
  for (const e of rows) if (out[e.why] != null) out[e.why] += 1;
  return { counts: out, total: rows.length };
}

export function isoDaysAgo(n, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return localISODate(d);
}

// Misses per system, normalized to 0..1 against the worst system, and damped so
// a handful of entries can't dominate the planner. Channel F in the scheduler's
// weakness engine: the topics you actually get wrong pull themselves forward.
export function systemWeaknessFromErrors(list = loadErrors(), { windowDays = 21 } = {}) {
  const since = isoDaysAgo(windowDays);
  const recent = list.filter((e) => e.date >= since && e.system);
  if (!recent.length) return {};
  const per = {};
  for (const e of recent) per[e.system] = (per[e.system] || 0) + 1;
  const max = Math.max(...Object.values(per));
  const out = {};
  // Confidence ramp: 3 misses in a system ≈ half weight, 9 ≈ three-quarters, so
  // one bad afternoon doesn't rewrite the plan.
  for (const [sys, n] of Object.entries(per)) {
    const conf = n / (n + 3);
    out[sys] = Math.min(1, (n / max) * conf);
  }
  return out;
}
