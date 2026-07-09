// Shared app-wide constants and date helpers.
// The exam date lives ONLY here — components must import it, never hardcode it.

export const EXAM_DATE_ISO = "2026-10-11";

// Local-midnight Date for exam day. Using local (not UTC) midnight avoids the
// off-by-one-day flip in evening hours for UTC+ timezones (Israel).
export const EXAM_DATE = new Date(2026, 9, 11);

const DAY_MS = 86_400_000;

// Midnight (local) of the given date — the app's single day-boundary definition.
export function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// YYYY-MM-DD in LOCAL time (toISOString() would give the UTC date, which is
// still "yesterday" late in the evening in Israel).
export function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Whole days from today (local) until exam day, floored at 0.
export function daysUntilExam(now = new Date()) {
  return Math.max(0, Math.round((EXAM_DATE - startOfLocalDay(now)) / DAY_MS));
}
