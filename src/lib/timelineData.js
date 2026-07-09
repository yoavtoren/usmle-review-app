// Shared constants + reminder state.
// (Formerly also held the timeline/goals feature, which has been removed —
//  the app now covers USMLE Step 1, AIMS, and personal tasks only.)

// ── Palette + maps ────────────────────────────────────────────────────────
export const FRONT_COLORS = {
  "step1": "#4f46e5",
  "aims":  "#7c3aed",
};

export const TYPE_ICONS = {
  "task-deadline": "📌",
  aims:            "🎯",
};

export const URGENCY_COLORS = {
  Critical: "#ef4444",
  High:     "#f97316",
  Medium:   "#eab308",
  Low:      "#22c55e",
};

// ── Reminder dismiss / snooze state ─────────────────────────────────────────
const REM_KEY = "usmle-app:reminder-state-v1";

export function loadReminderState() {
  try { return JSON.parse(localStorage.getItem(REM_KEY)) || { dismissed: [], snoozedUntil: {} }; }
  catch { return { dismissed: [], snoozedUntil: {} }; }
}
export function saveReminderState(s) { localStorage.setItem(REM_KEY, JSON.stringify(s)); }
