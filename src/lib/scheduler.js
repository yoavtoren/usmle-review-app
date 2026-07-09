// Adaptive Step-1 scheduler — 100% offline, localStorage only.
// Pure functions in the storage.js house style: every mutator calls save() and
// RETURNS the new state object so React can setState(prev => fn(prev, ...)).
// See CLAUDE_CODE_BUILD_SPEC.md. Weak-spot joins reuse faMap.js keyword mapping
// so the messy deck `system` vocabulary lands on the 16 FA chapters cleanly.

import { INTERVALS, loadProgress } from "./storage.js";
import { chaptersFromText } from "./faMap.js";

const KEY = "usmle-scheduler-v1";
const DAY = 24 * 60 * 60 * 1000;

export const REASONS = [
  { code: "time",       icon: "⏰", label: "Ran out of time" },
  { code: "focus",      icon: "🧠", label: "Couldn't focus" },
  { code: "tired",      icon: "😴", label: "Low energy / tired" },
  { code: "hard",       icon: "🥵", label: "Too hard / overwhelming" },
  { code: "motivation", icon: "🎈", label: "Didn't feel like it" },
  { code: "life",       icon: "🌍", label: "Life got in the way" },
  { code: "swap",       icon: "🔄", label: "Did a different topic" },
];

export const CAPACITY_LABELS = { low: "🌱 Low", med: "🌿 Medium", high: "🌳 High" };

const DEFAULT_SETTINGS = {
  examDate: "2026-10-11",
  contentDeadline: "2026-09-14",
  ankiProtected: true,
  capacityPresets: { low: 90, med: 240, high: 420 },   // minutes incl. Anki
  ankiReserveMin: { low: 45, med: 60, high: 75 },
  blockMinutes: 30,
  weights: {
    yield: 1.0, weak: 1.3, urgency: 0.9,
    foundation: 0.7, spacing: 0.5, interleave: 0.4,
  },
};

const DEFAULT_ADAPT = {
  completionRateEMA: 0.8,
  capacityBiasMin: 0,
  reasonHist: { time: 0, focus: 0, tired: 0, hard: 0, motivation: 0, life: 0, swap: 0 },
  focusByHour: {},
  bestFocusWindow: "morning",
  hardUnits: [],
  lastRetuneWeek: null,
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const todayISO = () => new Date().toISOString().slice(0, 10);
const isoToMs = (iso) => new Date(`${iso}T00:00:00`).getTime();

// ── State load / save ────────────────────────────────────────────────────────
export function loadSched(planMeta) {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
  if (raw && raw.version === 1) return raw;
  return seedDefault(planMeta);
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function seedDefault(planMeta = {}) {
  const settings = { ...DEFAULT_SETTINGS };
  if (planMeta.examDate) settings.examDate = planMeta.examDate;
  if (planMeta.contentDeadline) settings.contentDeadline = planMeta.contentDeadline;
  return save({
    version: 1,
    settings,
    units: {},
    days: {},
    reasonLog: [],
    adaptation: { ...DEFAULT_ADAPT },
    phase: "content",
  });
}

// Make sure every plan unit has a live-state record (idempotent).
export function ensureUnits(state, units) {
  const next = { ...state, units: { ...state.units } };
  let changed = false;
  for (const u of units) {
    if (!next.units[u.key]) {
      next.units[u.key] = {
        status: "todo", weaknessScore: 0, plannedDate: null,
        completedDate: null, postponeCount: 0, lastTouched: null, actualMinutes: null,
      };
      changed = true;
    }
  }
  return changed ? save(next) : state;
}

// ── Weak-spot ingestion (Channel A: questions, Channel B: seed file) ─────────
// Maps every deck question onto its FA chapter via faMap keywords, tallies
// attempted/missed per chapter, and pushes chapterMissRate onto each unit.
export function recomputeWeakness(state, units, deck, seed) {
  const progress = loadProgress();
  const perChapter = {}; // num -> {attempted, missed}
  const bump = (num, missed) => {
    if (!num) return;
    const c = (perChapter[num] ||= { attempted: 0, missed: 0 });
    c.attempted += 1;
    if (missed) c.missed += 1;
  };

  for (const q of deck?.questions || []) {
    const blob = `${q.title || ""} ${q.topic || ""} ${q.system || ""}`;
    const hits = chaptersFromText(blob);
    const nums = hits.map((h) => h.file.match(/chapters\/(\d+)_/)?.[1]).filter(Boolean);
    // A live "again" rating (streak 0, back to review) counts as a fresh miss.
    const card = progress[q.id];
    const liveMiss = card && card.status === "review" && card.streak === 0;
    const missed = !!q.missed || liveMiss;
    const targets = nums.length ? nums : [null];
    for (const n of targets) bump(n, missed);
  }

  // Laplace-smoothed miss rate: a chapter with only 1-2 attempted questions must
  // not read as maximally weak. K pseudo-counts of "not weak" shrink small
  // samples toward 0 so weakness reflects real, repeated misses.
  const WEAK_K = 4;
  const chapterMiss = {};
  for (const [num, c] of Object.entries(perChapter)) {
    chapterMiss[num] = clamp01(c.missed / (c.attempted + WEAK_K));
  }

  // Channel B — external weakness seed, matched by normalized system name.
  const seedBySystem = {};
  for (const w of seed?.weak || []) {
    const lvl = Number(w.level) || 0;
    const sys = (w.system || "").toLowerCase();
    seedBySystem[sys] = Math.max(seedBySystem[sys] || 0, lvl);
  }

  const next = { ...state, units: { ...state.units } };
  for (const u of units) {
    const prev = next.units[u.key] || {};
    const chA = chapterMiss[u.chapterNum] || 0;
    const chB = seedBySystem[(u.system || "").toLowerCase()] || 0;
    next.units[u.key] = { ...prev, weaknessScore: clamp01(Math.max(chA, chB)) };
  }
  return save(next);
}

// ── Priority score (§3.1) ────────────────────────────────────────────────────
function urgency(state, units, u, dateISO) {
  const daysLeft = Math.max(1, studyDaysBetween(dateISO, state.settings.contentDeadline));
  const avgDaily = recentAvgDailyMin(state) || 180;
  const remainingHighYieldMin = units.reduce((sum, x) => {
    const st = state.units[x.key];
    if (st && (st.status === "done" || st.status === "dropped")) return sum;
    return x.yieldWeight >= 4 ? sum + x.estMinutes : sum;
  }, 0);
  const capacityLeft = daysLeft * avgDaily;
  const base = clamp01(remainingHighYieldMin / Math.max(1, capacityLeft));
  const st = state.units[u.key] || {};
  return base + 0.15 * Math.min(st.postponeCount || 0, 4);
}

function spacingReadiness(state, u) {
  const st = state.units[u.key] || {};
  if (st.status === "done" || st.status === "skim") {
    if (!st.completedDate) return 0;
    const streak = Math.min(st.reviewStreak || 0, INTERVALS.length - 1);
    const due = isoToMs(st.completedDate) + INTERVALS[streak] * DAY;
    return Date.now() >= due ? 1 : 0;
  }
  return 0.15; // small constant so fresh content still flows
}

function interleaveBonus(u, recentSystems) {
  if (!recentSystems.length) return 0;
  const last2 = recentSystems.slice(-2);
  if (!last2.includes(u.system)) return 1;
  const last3 = recentSystems.slice(-3);
  if (last3.length === 3 && last3.every((s) => s === u.system)) return -1;
  return 0;
}

// Foundation gate: organ-system units (foundationRank >= 2) are held back until
// the fundamentals (rank <= 1) are mostly cleared, THEN released. This makes
// "foundations dominate early" real even when a system is high-yield/weak — while
// still letting the student swapIn() a system on demand (swap bypasses priority).
const GATE_THRESHOLD = 0.6; // fraction of fundamentals done before systems flow
const GATE_STRENGTH = 2.2;

function foundationGate(state, units, u) {
  if (u.foundationRank < 2 || state.phase === "dedicated") return 0;
  let total = 0, cleared = 0;
  for (const x of units) {
    if (x.foundationRank <= 1) {
      total += 1;
      const s = state.units[x.key];
      if (s && (s.status === "done" || s.status === "skim" || s.status === "dropped")) cleared += 1;
    }
  }
  if (!total) return 0;
  const fraction = cleared / total;
  return GATE_STRENGTH * clamp01((GATE_THRESHOLD - fraction) / GATE_THRESHOLD);
}

export function priority(state, units, u, dateISO, recentSystems = []) {
  const W = state.settings.weights;
  const st = state.units[u.key] || {};
  return (
    W.yield * (u.yieldWeight / 5) +
    W.weak * (st.weaknessScore || 0) +
    W.urgency * urgency(state, units, u, dateISO) -
    W.foundation * (u.foundationRank / 3) +
    W.spacing * spacingReadiness(state, u) +
    W.interleave * interleaveBonus(u, recentSystems) -
    foundationGate(state, units, u)
  );
}

// ── Rollover (§3.3) ──────────────────────────────────────────────────────────
export function rollover(state, dateISO) {
  const next = { ...state, units: { ...state.units } };
  let changed = false;
  for (const [key, st] of Object.entries(next.units)) {
    const stale =
      (st.status === "scheduled" || st.status === "in_progress") &&
      st.plannedDate && st.plannedDate < dateISO;
    if (stale) {
      next.units[key] = {
        ...st, status: "scheduled",
        postponeCount: (st.postponeCount || 0) + 1, plannedDate: null,
      };
      changed = true;
    }
  }
  return changed ? save(next) : state;
}

// ── Plan a day (§3.2) ────────────────────────────────────────────────────────
const FILL = 0.9;

export function planDay(state, units, dateISO, capacity) {
  let s = rollover(state, dateISO);
  s = { ...s, units: { ...s.units }, days: { ...s.days } };

  const preset = s.settings.capacityPresets[capacity];
  const anki = s.settings.ankiReserveMin[capacity];
  let budget = preset - (s.adaptation.capacityBiasMin || 0) - anki;
  budget = Math.max(budget, s.settings.blockMinutes);

  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const recentSystems = recentCompletedSystems(s, byKey, dateISO);

  // Pool = not-done units (todo / scheduled / in_progress); score & sort desc.
  const pool = units.filter((u) => {
    const st = s.units[u.key] || {};
    return ["todo", "scheduled", "in_progress"].includes(st.status);
  });
  const scored = pool
    .map((u) => ({ u, p: priority(s, units, u, dateISO, recentSystems) }))
    .sort((a, b) => b.p - a.p);

  const planned = [];
  let used = 0;
  const target = budget * FILL;
  for (const { u } of scored) {
    if (used >= target) break;
    const est = u.estMinutes;
    if (planned.length === 0 && est > budget && capacity === "low") {
      // Partial: schedule the top unit, carry the remainder.
      planned.push(u.key);
      s.units[u.key] = { ...s.units[u.key], status: "in_progress", plannedDate: dateISO };
      used += budget;
      break;
    }
    if (used + est <= budget || planned.length === 0) {
      planned.push(u.key);
      s.units[u.key] = { ...s.units[u.key], status: "scheduled", plannedDate: dateISO };
      used += est;
    }
  }

  // Reserve ~25% of non-Anki budget for a UWorld block (display hint).
  const uworldMin = Math.round(budget * 0.25);

  const prevDay = s.days[dateISO] || {};
  s.days[dateISO] = {
    capacity,
    planned,
    completed: prevDay.completed || [],
    missed: prevDay.missed || [],
    ankiDone: prevDay.ankiDone || false,
    misses: prevDay.misses || [],
    ankiReserveMin: anki,
    uworldMin,
    plannedMinutes: used,
  };

  s = maybeSwitchPhase(s, dateISO);
  s = maybeRetune(s, dateISO);
  return save(s);
}

// ── Completion / miss (§4) ───────────────────────────────────────────────────
export function recordDone(state, unitKey, actualMinutes, dateISO = todayISO()) {
  const s = { ...state, units: { ...state.units }, days: { ...state.days }, adaptation: { ...state.adaptation } };
  const st = s.units[unitKey] || {};
  s.units[unitKey] = {
    ...st, status: "done", completedDate: dateISO,
    lastTouched: Date.now(), actualMinutes: actualMinutes ?? st.actualMinutes,
    reviewStreak: (st.reviewStreak || 0),
  };
  const day = (s.days[dateISO] ||= { capacity: "med", planned: [], completed: [], missed: [], misses: [], ankiDone: false });
  day.completed = [...new Set([...(day.completed || []), unitKey])];
  day.missed = (day.missed || []).filter((k) => k !== unitKey);

  // done-rate by start hour + completion EMA up
  const hr = new Date().getHours();
  bumpFocusHour(s.adaptation, hr, 1);
  s.adaptation.completionRateEMA = ema(s.adaptation.completionRateEMA, 1, 0.2);
  deriveBestWindow(s.adaptation);
  return save(s);
}

export function recordMiss(state, unitKey, reason, note = "", dateISO = todayISO()) {
  const s = {
    ...state, units: { ...state.units }, days: { ...state.days },
    adaptation: { ...state.adaptation, reasonHist: { ...state.adaptation.reasonHist } },
    reasonLog: [...state.reasonLog], settings: { ...state.settings },
  };
  const st = s.units[unitKey] || {};
  s.units[unitKey] = { ...st, status: "scheduled", plannedDate: null, postponeCount: (st.postponeCount || 0) + 1, lastTouched: Date.now() };

  const day = (s.days[dateISO] ||= { capacity: "med", planned: [], completed: [], missed: [], misses: [], ankiDone: false });
  day.missed = [...new Set([...(day.missed || []), unitKey])];
  const hr = new Date().getHours();
  day.misses = [...(day.misses || []), { unit: unitKey, reason, note, at: Date.now() }];
  s.adaptation.reasonHist[reason] = (s.adaptation.reasonHist[reason] || 0) + 1;
  s.reasonLog.push({ date: dateISO, unit: unitKey, reason, hourOfDay: hr });

  // Reason -> adaptation pathway (bounded so one bad day can't wreck the model).
  const A = s.adaptation;
  switch (reason) {
    case "time":
      A.capacityBiasMin = Math.min((A.capacityBiasMin || 0) + 15, 120);
      A.completionRateEMA = ema(A.completionRateEMA, 0, 0.2);
      break;
    case "focus":
      s.settings.blockMinutes = Math.max(15, s.settings.blockMinutes - 5);
      s.settings.weights = { ...s.settings.weights, interleave: Math.min(s.settings.weights.interleave + 0.1, 1) };
      A.completionRateEMA = ema(A.completionRateEMA, 0, 0.2);
      break;
    case "tired":
      bumpFocusHour(A, hr, 0);
      A.completionRateEMA = ema(A.completionRateEMA, 0, 0.2);
      break;
    case "hard":
      A.hardUnits = [...new Set([...(A.hardUnits || []), unitKey])];
      A.completionRateEMA = ema(A.completionRateEMA, 0, 0.2);
      break;
    case "motivation":
      A.completionRateEMA = ema(A.completionRateEMA, 0, 0.2);
      break;
    case "life":
      // no-fault: roll forward WITHOUT dinging completion EMA
      break;
    case "swap":
      // handled by swapIn; no penalty
      break;
    default:
      A.completionRateEMA = ema(A.completionRateEMA, 0, 0.2);
  }
  deriveBestWindow(A);
  return save(s);
}

export function toggleAnki(state, dateISO = todayISO()) {
  const s = { ...state, days: { ...state.days } };
  const day = (s.days[dateISO] ||= { capacity: "med", planned: [], completed: [], missed: [], misses: [], ankiDone: false });
  day.ankiDone = !day.ankiDone;
  return save(s);
}

// ── On-demand swap (§5) ──────────────────────────────────────────────────────
export function swapIn(state, units, wantedKey, dateISO = todayISO()) {
  const s = { ...state, units: { ...state.units }, days: { ...state.days } };
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const wanted = byKey[wantedKey];
  if (!wanted) return state;

  const day = (s.days[dateISO] ||= { capacity: "med", planned: [], completed: [], missed: [], misses: [], ankiDone: false });
  const planned = day.planned || [];

  if (!planned.includes(wantedKey)) {
    // Displace the lowest-priority currently-planned, not-yet-done unit that
    // frees >= the wanted unit's minutes; push it back to the pool.
    const recentSystems = recentCompletedSystems(s, byKey, dateISO);
    const candidates = planned
      .filter((k) => {
        const st = s.units[k];
        return st && st.status !== "done" && byKey[k];
      })
      .map((k) => ({ k, p: priority(s, units, byKey[k], dateISO, recentSystems), est: byKey[k].estMinutes }))
      .sort((a, b) => a.p - b.p);

    let freed = 0;
    const displaced = [];
    for (const c of candidates) {
      if (freed >= wanted.estMinutes) break;
      displaced.push(c.k);
      freed += c.est;
    }
    for (const k of displaced) {
      s.units[k] = { ...s.units[k], status: "scheduled", plannedDate: null };
    }
    day.planned = [wantedKey, ...planned.filter((k) => !displaced.includes(k))];
  } else {
    // Already planned — just move it to the front (make it active).
    day.planned = [wantedKey, ...planned.filter((k) => k !== wantedKey)];
  }

  s.units[wantedKey] = { ...s.units[wantedKey], status: "in_progress", plannedDate: dateISO };
  return save(s);
}

// Fuzzy-match free text ("anemias") to unit keys for the swap search box.
export function searchUnits(units, query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return units;
  return units.filter((u) =>
    `${u.chapter} ${u.subsection} ${u.system}`.toLowerCase().includes(q));
}

// ── Feasibility monitor & triage (§8) ────────────────────────────────────────
export function feasibility(state, units, dateISO = todayISO()) {
  let remainingMin = 0;
  for (const u of units) {
    const st = state.units[u.key] || {};
    if (["todo", "scheduled", "in_progress"].includes(st.status)) {
      remainingMin += st.status === "skim" ? u.estMinutes / 2 : u.estMinutes;
    }
  }
  const daysLeft = Math.max(0, studyDaysBetween(dateISO, state.settings.contentDeadline));
  const avgDaily = recentAvgDailyMin(state) || 180;
  const ankiPerDay = state.settings.ankiReserveMin.med;
  const capacityLeft = daysLeft * Math.max(30, avgDaily - ankiPerDay);
  const ratio = remainingMin / Math.max(1, capacityLeft);

  let status = "green";
  if (ratio > 1.3) status = "red";
  else if (ratio > 1.0) status = "amber";
  else if (ratio < 0.5) status = "ahead";

  const finishDays = Math.ceil(remainingMin / Math.max(30, avgDaily - ankiPerDay));
  const etaMs = Date.now() + finishDays * DAY;
  const etaLabel = new Date(etaMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return { remainingMin, daysLeft, capacityLeft, ratio, status, etaLabel, finishDays };
}

// Auto-triage: convert lowest-yield todo units to skim (amber) or drop (red).
export function applyTriage(state, units, dateISO = todayISO()) {
  const f = feasibility(state, units, dateISO);
  if (f.status !== "amber" && f.status !== "red") return { state, changed: [] };
  const s = { ...state, units: { ...state.units } };
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const changed = [];

  // Candidates: todo units, lowest yield first. Protect yield>=4 and STRONGLY
  // weak units (>=0.7); everything else is fair game to skim/drop.
  const demotable = units
    .filter((u) => {
      const st = s.units[u.key] || {};
      return st.status === "todo" && u.yieldWeight <= 3 && (st.weaknessScore || 0) < 0.7;
    })
    .sort((a, b) => (a.yieldWeight - b.yieldWeight) || ((s.units[a.key]?.weaknessScore || 0) - (s.units[b.key]?.weaknessScore || 0)));

  for (const u of demotable) {
    const nf = feasibility(s, units, dateISO);
    if (f.status === "amber" && nf.ratio <= 1.1) break;
    if (f.status === "red" && nf.ratio <= 1.15) break;
    if (nf.status === "green" || nf.status === "ahead") break;
    const st = s.units[u.key];
    if (f.status === "red" && u.yieldWeight <= 2) {
      s.units[u.key] = { ...st, status: "dropped" };
      changed.push({ key: u.key, to: "dropped", label: `${byKey[u.key].chapter} › ${byKey[u.key].subsection}` });
    } else {
      s.units[u.key] = { ...st, status: "skim" };
      changed.push({ key: u.key, to: "skim", label: `${byKey[u.key].chapter} › ${byKey[u.key].subsection}` });
    }
  }
  save(s);
  return { state: s, changed };
}

// ── Phase switch (§9) + weekly retune (§4) ───────────────────────────────────
function maybeSwitchPhase(state, dateISO) {
  if (state.phase === "dedicated") return state;
  const past = dateISO >= state.settings.contentDeadline;
  if (past) return { ...state, phase: "dedicated" };
  return state;
}

function maybeRetune(state, dateISO) {
  const week = isoWeek(dateISO);
  if (state.adaptation.lastRetuneWeek === week) return state;
  const s = { ...state, settings: { ...state.settings, weights: { ...state.settings.weights } }, adaptation: { ...state.adaptation } };
  s.adaptation.lastRetuneWeek = week;
  const rate = s.adaptation.completionRateEMA;
  const rh = s.adaptation.reasonHist;
  if (rate < 0.6) {
    s.settings.capacityBiasMin = Math.min((s.settings.capacityBiasMin || 0) + 20, 120);
    s.settings.weights.urgency = Math.min(s.settings.weights.urgency + 0.1, 1.5);
  } else if (rate > 0.9) {
    s.adaptation.capacityBiasMin = Math.max((s.adaptation.capacityBiasMin || 0) - 15, -30);
  }
  const dominant = Object.entries(rh).sort((a, b) => b[1] - a[1])[0];
  if (dominant && dominant[1] >= 3) {
    if (dominant[0] === "focus") s.settings.weights.interleave = Math.min(s.settings.weights.interleave + 0.1, 1);
    if (dominant[0] === "hard") s.settings.weights.foundation = Math.min(s.settings.weights.foundation + 0.1, 1.2);
  }
  return s;
}

// ── Settings mutators ────────────────────────────────────────────────────────
export function updateSettings(state, patch) {
  return save({ ...state, settings: { ...state.settings, ...patch } });
}

// ── Export / import ──────────────────────────────────────────────────────────
export function exportSched(state) {
  return JSON.stringify(state, null, 2);
}
export function importSched(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (data && data.version === 1) return save(data);
  } catch { /* ignore */ }
  return null;
}

// ── Anki new-card hint (§6) ──────────────────────────────────────────────────
export function ankiNewCardHint(state, capacity, dateISO = todayISO()) {
  const daysToExam = Math.max(0, Math.round((isoToMs(state.settings.examDate) - isoToMs(dateISO)) / DAY));
  if (daysToExam <= 5) return 0; // taper to zero in the final days
  const base = { low: 10, med: 30, high: 70 }[capacity] ?? 30;
  if (daysToExam <= 10) return Math.round(base * 0.4);
  return base;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ema(prev, x, alpha) { return prev == null ? x : alpha * x + (1 - alpha) * prev; }

function bumpFocusHour(adapt, hour, value) {
  const cur = adapt.focusByHour[hour];
  adapt.focusByHour[hour] = cur == null ? value : ema(cur, value, 0.3);
}

function deriveBestWindow(adapt) {
  const windows = { morning: [], afternoon: [], evening: [] };
  for (const [h, v] of Object.entries(adapt.focusByHour)) {
    const hr = Number(h);
    if (hr < 12) windows.morning.push(v);
    else if (hr < 18) windows.afternoon.push(v);
    else windows.evening.push(v);
  }
  let best = "morning", bestAvg = -1;
  for (const [w, arr] of Object.entries(windows)) {
    if (!arr.length) continue;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (avg > bestAvg) { bestAvg = avg; best = w; }
  }
  adapt.bestFocusWindow = best;
}

function recentCompletedSystems(state, byKey, dateISO) {
  const out = [];
  const dates = Object.keys(state.days).filter((d) => d <= dateISO).sort();
  for (const d of dates) {
    for (const k of state.days[d].completed || []) {
      if (byKey[k]) out.push(byKey[k].system);
    }
  }
  return out.slice(-4);
}

function recentCompletedSystemsSafe(state, units, dateISO) {
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  return recentCompletedSystems(state, byKey, dateISO);
}

function recentAvgDailyMin(state) {
  const days = Object.values(state.days);
  const withWork = days.filter((d) => (d.completed || []).length > 0 || (d.plannedMinutes || 0) > 0);
  if (!withWork.length) return 0;
  const total = withWork.reduce((sum, d) => sum + (d.plannedMinutes || 0), 0);
  return total / withWork.length;
}

// Study days between two ISO dates (exclusive of start, inclusive of end),
// counting every calendar day (rest days aren't modeled yet).
function studyDaysBetween(fromISO, toISO) {
  const from = isoToMs(fromISO), to = isoToMs(toISO);
  return Math.round((to - from) / DAY);
}

function isoWeek(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / DAY + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export { recentCompletedSystemsSafe };
