// Read-only snapshot of the adaptive planner's state for the home dashboard.
// The planner persists everything to localStorage on every mutation (scheduler.js),
// so the home page can render *today's actual tasks* without re-running the planner —
// it just reads what the planner already wrote and maps unit keys to human labels.

import { loadSched, todayISO } from "./scheduler.js";

const DAY = 86400000;
const isoMs = (iso) => new Date(`${iso}T00:00:00`).getTime();

// Returns today's plan as the home hero needs it, or a well-formed empty shape
// when the planner has never been opened / today isn't planned yet. Never throws.
export function readTodayPlan(units = []) {
  let sched = null;
  try { sched = loadSched({}); } catch { sched = null; }

  const date = todayISO();
  const day = sched?.days?.[date] || null;
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));

  const completed = new Set(day?.completed || []);
  const planned = (day?.planned || []).map((k) => {
    const u = byKey[k] || {};
    return {
      key: k,
      system: u.system || "—",
      detail: u.subsection || "",
      colorKey: u.colorKey || u.system || null,
      minutes: u.estMinutes || null,
      done: completed.has(k),
    };
  });

  const uw = day?.uworld || null;
  const uworld = uw
    ? { targetQ: uw.targetQ || uw.quotaQ || 0, done: !!uw.done, correct: uw.correct, total: uw.total }
    : null;

  // Future look: the next untaken self-assessment checkpoints (NBME/UWSA/Free120),
  // each with how many days away it is — the real milestones on the runway.
  const nowMs = isoMs(date);
  const milestones = (sched?.assessments || [])
    .filter((a) => !a.takenDate && a.plannedDate && isoMs(a.plannedDate) >= nowMs)
    .map((a) => ({
      id: a.id, label: a.label, iso: a.plannedDate,
      days: Math.round((isoMs(a.plannedDate) - nowMs) / DAY),
    }))
    .sort((a, b) => (a.iso < b.iso ? -1 : 1));

  const doneCount = planned.filter((p) => p.done).length
    + (day?.ankiDone ? 1 : 0)
    + (uworld?.done ? 1 : 0);
  const totalCount = planned.length + 1 /* anki */ + (uworld ? 1 : 0);

  return {
    hasPlan: !!(day && day.capacity),
    capacity: day?.capacity || null,
    phase: sched?.phase || "content",
    planned,
    anki: { done: !!day?.ankiDone },
    uworld,
    milestones,
    doneCount,
    totalCount,
  };
}

// Next incomplete First Aid chapters (by name) from the checklist progress file —
// the "what to read next" the FA tracker implies but never surfaces on the home page.
export function nextFAChapters(faData, limit = 3) {
  if (!faData?.chapters) return [];
  return faData.chapters
    .filter((c) => (c.seen || 0) < (c.total || 0))
    .slice(0, limit)
    .map((c) => ({
      name: c.chapter.replace(/^\d+\s+/, ""),
      seen: c.seen || 0,
      total: c.total || 0,
      pct: c.total ? Math.round(((c.seen || 0) / c.total) * 100) : 0,
    }));
}
