// Shared constants + reminder state.
// (Formerly also held the timeline/goals feature, which has been removed —
//  the app now covers USMLE Step 1, AIMS, and personal tasks only.)

// ── Palette + maps ────────────────────────────────────────────────────────
export const FRONT_COLORS = {
  "step1": "#1E4D38",
  "aims":  "#7C3A4D",
};

export const TYPE_ICONS = {
  "task-deadline": "📌",
  aims:            "🎯",
  plan:            "🧭", // Step 1 plan milestones (see strategyData.js)
};

export const URGENCY_COLORS = {
  Critical: "#B04A38",
  High:     "#B5622A",
  Medium:   "#A07C2C",
  Low:      "#2F7D54",
};

// ── Reminder dismiss / snooze state ─────────────────────────────────────────
const REM_KEY = "usmle-app:reminder-state-v1";

export function loadReminderState() {
  try { return JSON.parse(localStorage.getItem(REM_KEY)) || { dismissed: [], snoozedUntil: {} }; }
  catch { return { dismissed: [], snoozedUntil: {} }; }
}
export function saveReminderState(s) { localStorage.setItem(REM_KEY, JSON.stringify(s)); }
