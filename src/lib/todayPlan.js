// Read-only snapshot of the adaptive planner's state for the home dashboard.
// The planner persists everything to localStorage on every mutation (scheduler.js),
// so the home page can render *today's actual tasks* without re-running the planner —
// it just reads what the planner already wrote and maps unit keys to human labels.
//
// Sync guarantee: the home hero must NEVER show an empty day while the planner's
// calendar shows work. When today wasn't explicitly planned yet, we fall back to
// the same forward projection the Planner's calendar/timeline draws (projectSchedule)
// and to the same Qbank pacing model (uworldPacing) — one source of truth, two pages.

import { loadSched, todayISO, uworldPacing, projectSchedule, dayFraction } from "./scheduler.js";
import { ASSESSMENTS } from "./strategyData.js";

const DAY = 86400000;
const isoMs = (iso) => new Date(`${iso}T00:00:00`).getTime();

// Returns today's plan as the home hero needs it, or a well-formed empty shape
// when the planner has never been opened / today isn't planned yet. Never throws.
export function readTodayPlan(units = []) {
  let sched = null;
  try { sched = loadSched({}); } catch { sched = null; }

  const date = todayISO();
  const day = sched?.days?.[date] || null;
  const hasPlan = !!(day && day.capacity);
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));

  const toRow = (k, done, suggested) => {
    const u = byKey[k] || {};
    return {
      key: k,
      system: u.system || "—",
      detail: u.subsection || "",
      colorKey: u.colorKey || u.system || null,
      minutes: u.estMinutes || null,
      done,
      suggested,
    };
  };

  const completed = new Set(day?.completed || []);
  let planned = (day?.planned || []).map((k) => toRow(k, completed.has(k), false));

  // Today not planned yet → suggest today's topics from the SAME projection the
  // planner's calendar shows, so both pages tell one story.
  let isSuggestion = false;
  if (!planned.length && sched && units.length) {
    try {
      const proj = projectSchedule(sched, units, date, { maxDays: 1 });
      planned = (proj.days[0]?.items || []).map((it) => toRow(it.key, false, true));
      isSuggestion = planned.length > 0;
    } catch { /* projection is advisory — never break the home page */ }
  }

  // UWorld — THE number of the day. A planned day carries its own logged block;
  // otherwise the goal-driven quota (half-day aware) says what today demands.
  let pace = null;
  try { pace = sched ? uworldPacing(sched, date) : null; } catch { pace = null; }
  const uw = day?.uworld || null;
  const uworld = {
    targetQ: uw?.targetQ || uw?.quotaQ || pace?.perDay || 0,
    done: !!uw?.done,
    correct: uw?.correct ?? null,
    total: uw?.total ?? null,
    doneQ: pace?.done ?? 0,
    goalQ: pace?.goal ?? 0,
    pct: pace?.pct ?? 0,
    deadline: pace?.deadline || sched?.settings?.contentDeadline || null,
  };

  // Future look: the next untaken self-assessment checkpoints (NBME/UWSA/Free120),
  // each with how many days away it is — the real milestones on the runway.
  const nowMs = isoMs(date);
  let milestones = (sched?.assessments || [])
    .filter((a) => !a.takenDate && a.plannedDate && isoMs(a.plannedDate) >= nowMs)
    .map((a) => ({
      id: a.id, label: a.label, iso: a.plannedDate,
      days: Math.round((isoMs(a.plannedDate) - nowMs) / DAY),
    }))
    .sort((a, b) => (a.iso < b.iso ? -1 : 1));
  // Planner never opened → the strategy's static assessment arc is the truth.
  if (!milestones.length) {
    milestones = ASSESSMENTS
      .filter((a) => a.date >= date)
      .map((a) => ({
        id: `s-${a.date}`, label: a.form, iso: a.date,
        days: Math.round((isoMs(a.date) - nowMs) / DAY),
      }));
  }
  const nbme = milestones[0] || null;

  const doneCount = planned.filter((p) => p.done).length
    + (day?.ankiDone ? 1 : 0)
    + (uworld.done ? 1 : 0);
  const totalCount = planned.length + 1 /* anki */ + 1 /* uworld */;

  return {
    hasPlan,
    isSuggestion,
    capacity: day?.capacity || null,
    // Half-day awareness (2–5 Aug etc.) so the hero can say "יום חצי".
    dayFraction: sched ? dayFraction(sched, date) : 1,
    phase: sched?.phase || "content",
    planned,
    anki: { done: !!day?.ankiDone },
    uworld,
    nbme,
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
