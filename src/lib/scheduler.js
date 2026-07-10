// Adaptive Step-1 scheduler — 100% offline, localStorage only.
// Pure functions in the storage.js house style: every mutator calls save() and
// RETURNS the new state object so React can setState(prev => fn(prev, ...)).
// See CLAUDE_CODE_BUILD_SPEC.md. Weak-spot joins reuse faMap.js keyword mapping
// so the messy deck `system` vocabulary lands on the 16 FA chapters cleanly.

import { INTERVALS, loadProgress, loadTestLog, loadFATopics } from "./storage.js";
import { chaptersFromText } from "./faMap.js";
import { EXAM_DATE_ISO, localISODate } from "./config.js";

// Maps each plan-unit system (short vocab) to the substrings that identify its
// rows in the UWorld/NBME stat breakdown (subjects + systems taxonomy). Lets the
// weakness engine read the stats you enter per test and pull weak systems forward.
const SYS_STAT_MATCH = {
  "Biochemistry": ["biochem"],
  "Cardiovascular": ["cardiovascular"],
  "Endocrine": ["endocrine"],
  "Gastrointestinal": ["gastrointestinal", "nutrition"],
  "Heme / Onc": ["hematology", "oncology"],
  "Immunology": ["immunolog", "allergy"],
  "MSK, Skin & Connective": ["rheumatolog", "orthopedic", "dermatolog"],
  "Microbiology": ["microbiolog", "infectious"],
  "Neuro & Special Senses": ["nervous", "ophthalmolog", "ear, nose"],
  "Pathology": ["pathology", "pathophysiolog"],
  "Pharmacology": ["pharmacolog"],
  "Psychiatry": ["psychiatric", "behavioral", "substance"],
  "Public Health": ["biostat", "epidemiolog", "social scien", "ethics", "poisoning", "environmental"],
  "Renal": ["renal", "urinary", "electrolyte"],
  "Repro": ["reproductive", "pregnancy", "childbirth", "breast"],
  "Respiratory": ["pulmonary", "critical care"],
};

// Aggregate every logged test's per-subject + per-system stats into a raw
// { total, correct } per plan-unit system. This is the live exam signal that
// lets the planner re-rank as your results come in.
export function systemStatsFromTests(log = loadTestLog()) {
  const acc = {}; // system -> { total, correct }
  for (const sys of Object.keys(SYS_STAT_MATCH)) acc[sys] = { total: 0, correct: 0 };
  for (const t of log) {
    for (const kind of ["subjects", "systems"]) {
      for (const [name, row] of Object.entries(t[kind] || {})) {
        if (!row?.total) continue;
        const low = name.toLowerCase();
        for (const [sys, keys] of Object.entries(SYS_STAT_MATCH)) {
          if (keys.some((k) => low.includes(k))) {
            acc[sys].total += Number(row.total) || 0;
            acc[sys].correct += Number(row.correct) || 0;
          }
        }
      }
    }
  }
  return acc;
}

// Miss-rate per plan-unit system, Laplace-smoothed so a system you've barely
// touched doesn't read as maximally weak. Returns { system: weakness 0..1 }.
export function systemWeaknessFromTests(log = loadTestLog()) {
  const K = 6;
  const out = {};
  for (const [sys, { total, correct }] of Object.entries(systemStatsFromTests(log))) {
    if (total > 0) out[sys] = clamp01((total - correct) / (total + K));
  }
  return out;
}

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
  examDate: EXAM_DATE_ISO,
  contentDeadline: "2026-09-14",
  ankiProtected: true,
  capacityPresets: { low: 90, med: 240, high: 420 },   // minutes incl. Anki
  ankiReserveMin: { low: 45, med: 60, high: 75 },
  blockMinutes: 30,
  // "Big and bold first" priority weights (§3.1). weak (1.8) sits just under lead
  // (2.0) so a system you're scoring badly on — or an untouched First Aid chapter —
  // pulls forward past the fixed anchor rotation; size + hard push the big, hard,
  // marquee systems to the front. No foundation gating anymore.
  weights: {
    yield: 1.0, size: 0.9, hard: 0.8, weak: 1.8,
    lead: 2.0, urgency: 0.9, spacing: 0.5, interleave: 0.4,
  },
  // Fraction of the non-Anki budget carved out for the daily 🎯 UWorld block and
  // the 🧊 basics interleave; the rest is the 🔥 anchor (marquee system) budget.
  trackSplit: { uworldPct: 0.25, basicsPct: 0.20 },
  // UWorld Qbank pacing: the total number of Qbank questions you're aiming to
  // finish by the content deadline, plus any you completed before using the app
  // (so the daily quota starts from your real position). ~3200 ≈ the full Step-1
  // Qbank; adjust in Settings.
  uworldGoalTotal: 3200,
  uworldDoneOffset: 0,
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

// Score goal. Step 1 is PASS/FAIL since Jan 2022 — there is no official 3-digit
// score. NBME CBSSA + UWSA still report a legacy 3-digit "predicted" equivalent;
// 196 is the equated pass line. Default framing = pass margin, not an official score.
const DEFAULT_GOAL = { mode: "pass", target: 240, passLine: 196, buffer: 14, updatedAt: null };

// Standard 2026 Step-1 self-assessment arc, back-scheduled from the exam date.
// NBME CBSSA (25-31) + UWorld Self-Assessments (UWSA 1/2) report a 3-digit
// predicted score; the official Free 120 reports % correct only.
const STANDARD_ASSESSMENTS = [
  { id: "nbme-26", kind: "nbme", label: "NBME 26", form: "26", role: "baseline", unit: "three_digit", offset: 35 },
  { id: "nbme-28", kind: "nbme", label: "NBME 28", form: "28", role: "mid",      unit: "three_digit", offset: 24 },
  { id: "uwsa-1",  kind: "uwsa", label: "UWSA 1",  form: "1",  role: "mid",      unit: "three_digit", offset: 17 },
  { id: "nbme-30", kind: "nbme", label: "NBME 30", form: "30", role: "mid",      unit: "three_digit", offset: 11 },
  { id: "uwsa-2",  kind: "uwsa", label: "UWSA 2",  form: "2",  role: "final",    unit: "three_digit", offset: 7 },
  { id: "nbme-31", kind: "nbme", label: "NBME 31", form: "31", role: "final",    unit: "three_digit", offset: 4 },
  { id: "free120", kind: "free120", label: "Free 120", form: "", role: "final",  unit: "percent",     offset: 2 },
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const todayISO = () => localISODate(); // local date — toISOString() is "yesterday" in +TZ evenings
const isoToMs = (iso) => new Date(`${iso}T00:00:00`).getTime();
// Local-consistent inverse of isoToMs (toISOString would drift a day in +TZ like Israel).
const msToISO = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── Predicted-score conversions (Free 120 % ⇆ legacy 3-digit) ────────────────
// Linear, slope 2.0, pass anchored exactly at 60% = 196. NBME/UWSA already give
// a 3-digit and are stored as-is; ONLY percent-unit results are converted.
export const pctToPredicted3 = (pct) => clamp(Math.round(2 * pct + 76), 150, 280);
export const predicted3ToPct = (s) => clamp(Math.round((s - 76) / 2), 30, 100);
export const toPredicted3 = (a) => (a.unit === "three_digit" ? a.actual : pctToPredicted3(a.actual));
export function effectiveTarget(goal = DEFAULT_GOAL) {
  return goal.mode === "predicted" ? goal.target : (goal.passLine || 196) + (goal.buffer || 0);
}

// ── State load / save ────────────────────────────────────────────────────────
export function loadSched(planMeta) {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
  if (raw && (raw.version === 1 || raw.version === 2)) return migrate(raw);
  return seedDefault(planMeta);
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

// Idempotent, additive backfill of v2 fields onto any v1/v2 state. Safe to run
// repeatedly and on partially-migrated or re-imported state — each field is
// checked independently and existing data is never touched.
export function migrate(raw) {
  let changed = raw.version !== 2;
  const state = { ...raw, version: 2 };
  if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
  if (!state.settings.goal) { state.settings = { ...state.settings, goal: { ...DEFAULT_GOAL } }; changed = true; }
  // Migrate the priority model from foundations-first to "big and bold first":
  // ensure size/hard weights + trackSplit exist and drop the retired foundation
  // weight. Idempotent — only fills what's missing.
  const w = state.settings.weights || {};
  if (w.size == null || w.hard == null || w.lead == null || w.foundation != null) {
    const { foundation, ...rest } = w;
    state.settings = {
      ...state.settings,
      weights: { ...DEFAULT_SETTINGS.weights, ...rest },
    };
    changed = true;
  }
  if (!state.settings.trackSplit) {
    state.settings = { ...state.settings, trackSplit: { ...DEFAULT_SETTINGS.trackSplit } };
    changed = true;
  }
  if (state.settings.uworldGoalTotal == null) {
    state.settings = {
      ...state.settings,
      uworldGoalTotal: DEFAULT_SETTINGS.uworldGoalTotal,
      uworldDoneOffset: state.settings.uworldDoneOffset ?? DEFAULT_SETTINGS.uworldDoneOffset,
    };
    changed = true;
  }
  if (!Array.isArray(state.assessments)) { state.assessments = []; changed = true; }
  if (!Array.isArray(state.tasks)) { state.tasks = []; changed = true; }
  // One-time re-tune: lift `weak` toward the `lead` anchor-rotation weight so a
  // bad test result visibly pulls its weak systems earlier in the plan/calendar
  // instead of the fixed rotation drowning it out. Math.max never lowers a value
  // the user (or auto-triage) already raised. Guarded by a flag so it runs once.
  if (!state.settings.weightsTunedFA) {
    state.settings = {
      ...state.settings,
      weights: { ...state.settings.weights, weak: Math.max(state.settings.weights.weak || 0, DEFAULT_SETTINGS.weights.weak) },
      weightsTunedFA: true,
    };
    changed = true;
  }
  return changed ? save(state) : state;
}

export function seedDefault(planMeta = {}) {
  const settings = { ...DEFAULT_SETTINGS, goal: { ...DEFAULT_GOAL } };
  if (planMeta.examDate) settings.examDate = planMeta.examDate;
  if (planMeta.contentDeadline) settings.contentDeadline = planMeta.contentDeadline;
  return save({
    version: 2,
    settings,
    units: {},
    days: {},
    assessments: [],
    tasks: [],
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

// ── Plan extras bootstrap: goal + assessments + tasks ────────────────────────
// Runs once in the Planner init (after ensureUnits). Backfills defaults and
// seeds the standard assessment arc only when none exist yet.
export function ensurePlanExtras(state) {
  let s = migrate(state);
  if (!s.assessments.length) s = seedAssessments(s);
  return s;
}

// Build (or, with {force}, rebuild) the standard assessment arc back-scheduled
// from examDate. Re-seeding preserves any taken/edited rows (matched by id).
export function seedAssessments(state, { force = false } = {}) {
  if (state.assessments?.length && !force) return state;
  const E = isoToMs(state.settings.examDate);
  const today = isoToMs(todayISO());
  const goal = state.settings.goal || DEFAULT_GOAL;
  const eff = effectiveTarget(goal);
  const spanDays = Math.max(1, STANDARD_ASSESSMENTS[0].offset - STANDARD_ASSESSMENTS.at(-1).offset);

  const prevById = Object.fromEntries((state.assessments || []).map((a) => [a.id, a]));
  const usedDates = new Set();
  const rows = [];
  for (const t of STANDARD_ASSESSMENTS) {
    const prev = prevById[t.id];
    // Never move a taken or user-edited row; carry it through unchanged.
    if (prev && (prev.takenDate || prev.touched)) { rows.push(prev); if (prev.plannedDate) usedDates.add(prev.plannedDate); continue; }

    let ms = Math.max(today, E - t.offset * DAY);
    let iso = msToISO(ms);
    while (usedDates.has(iso)) { ms += DAY; iso = msToISO(ms); } // never stack two on one day
    usedDates.add(iso);

    const daysToExam = Math.max(0, Math.round((E - ms) / DAY));
    const g3 = clamp(Math.round(eff - 15 * (daysToExam / spanDays)), 150, 280);
    const goalScore = t.unit === "percent" ? predicted3ToPct(g3) : g3;
    rows.push({
      id: t.id, kind: t.kind, label: t.label, form: t.form, role: t.role, unit: t.unit,
      plannedDate: iso, goalScore,
      actual: prev?.actual ?? null, takenDate: prev?.takenDate ?? null,
      note: prev?.note ?? "", seeded: true, touched: false,
    });
  }
  // Keep any custom (non-standard) rows the user added.
  const customRows = (state.assessments || []).filter((a) => !STANDARD_ASSESSMENTS.some((t) => t.id === a.id));
  return save({ ...state, assessments: [...rows, ...customRows] });
}

export function setGoal(state, patch) {
  const goal = { ...(state.settings.goal || DEFAULT_GOAL), ...patch, updatedAt: Date.now() };
  return save({ ...state, settings: { ...state.settings, goal } });
}

export function upsertAssessment(state, a) {
  const list = [...(state.assessments || [])];
  const idx = list.findIndex((x) => x.id === a.id);
  const row = { unit: "three_digit", seeded: false, touched: true, actual: null, takenDate: null, note: "", ...a };
  if (idx >= 0) list[idx] = { ...list[idx], ...a, touched: true };
  else list.push({ id: a.id || `a-${Date.now()}`, ...row });
  return save({ ...state, assessments: list });
}

export function logAssessment(state, id, actual, takenISO = todayISO()) {
  const list = (state.assessments || []).map((a) =>
    a.id === id ? { ...a, actual: actual === "" || actual == null ? null : Number(actual), takenDate: actual == null || actual === "" ? null : takenISO } : a);
  return save({ ...state, assessments: list });
}

export function removeAssessment(state, id) {
  return save({ ...state, assessments: (state.assessments || []).filter((a) => a.id !== id) });
}

// ── Ad-hoc tasks ─────────────────────────────────────────────────────────────
export function addTask(state, text, { dueISO = null, link = null } = {}) {
  const t = (text || "").trim();
  if (!t) return state;
  const task = { id: `t-${Date.now()}`, text: t, done: false, createdISO: todayISO(), dueISO, doneISO: null, link };
  return save({ ...state, tasks: [...(state.tasks || []), task] });
}
export function toggleTask(state, id) {
  const tasks = (state.tasks || []).map((t) =>
    t.id === id ? { ...t, done: !t.done, doneISO: !t.done ? todayISO() : null } : t);
  return save({ ...state, tasks });
}
export function deleteTask(state, id) {
  return save({ ...state, tasks: (state.tasks || []).filter((t) => t.id !== id) });
}

// ── Readiness projection (advisory only — never mutates the plan) ─────────────
export function projectReadiness(state) {
  const goal = state.settings.goal || DEFAULT_GOAL;
  const target = effectiveTarget(goal);
  const passLine = goal.passLine || 196;
  const pts = (state.assessments || [])
    .filter((a) => a.takenDate && a.actual != null)
    .map((a) => ({ t: isoToMs(a.takenDate), y: toPredicted3(a) }))
    .sort((p, q) => p.t - q.t);

  if (!pts.length) return { status: "baseline", target, passLine, confidence: "none" };

  const examMs = isoToMs(state.settings.examDate);
  const latestY = pts[pts.length - 1].y;
  let projected, slope = 0;
  if (pts.length === 1) {
    projected = latestY;
  } else {
    const n = pts.length;
    const mt = pts.reduce((s, p) => s + p.t, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    const denom = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0);
    if (denom === 0) { projected = latestY; }       // identical dates → flat
    else {
      slope = pts.reduce((s, p) => s + (p.t - mt) * (p.y - my), 0) / denom;
      const intercept = my - slope * mt;
      projected = Math.round(slope * examMs + intercept);
    }
  }
  projected = clamp(projected, 150, 280);
  // Damping: two noisy early forms can't promise a huge jump.
  projected = clamp(projected, latestY - 20, latestY + 30);

  const gap = projected - target;
  const passMargin = projected - passLine;
  let status;
  if (projected < passLine || gap < -15) status = "at_risk";
  else if (gap < -5) status = "behind";
  else if (gap < 0) status = "close";
  else status = "on_track";

  return {
    status, projected, band: [clamp(projected - 10, 150, 280), clamp(projected + 10, 150, 280)],
    latest: latestY, target, passLine, gap, passMargin,
    slopePerWeek: Math.round(slope * 7 * DAY), n: pts.length,
    confidence: pts.length >= 2 ? "firm" : "low",
  };
}

// Count untaken assessment days that fall inside the content phase (they cost a
// study day). Most checkpoints land after the deadline, so this rarely fires.
function assessmentContentDays(state, dateISO) {
  const deadline = state.settings.contentDeadline;
  return (state.assessments || []).filter((a) =>
    !a.takenDate && a.plannedDate && a.plannedDate > dateISO && a.plannedDate <= deadline).length;
}

// ── Student profile (public/profile.json) — closes the 7 scheduler gaps ──────
// Maps profile system names to the plan-unit system vocabulary so per-system
// performance lands on the right units.
const PROFILE_SYS_ALIAS = {
  "cardiovascular": "Cardiovascular", "renal": "Renal", "respiratory": "Respiratory",
  "hematology/oncology": "Heme / Onc", "heme / onc": "Heme / Onc", "endocrine": "Endocrine",
  "gastrointestinal": "Gastrointestinal", "reproductive": "Repro", "repro": "Repro",
  "neurology": "Neuro & Special Senses", "neuro & special senses": "Neuro & Special Senses",
  "psychiatry": "Psychiatry", "msk/skin": "MSK, Skin & Connective",
  "msk, skin & connective": "MSK, Skin & Connective", "biochemistry": "Biochemistry",
  "immunology": "Immunology", "microbiology": "Microbiology", "pharmacology": "Pharmacology",
  "pathology": "Pathology", "public health": "Public Health",
};
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (iso) => DOW[new Date(`${iso}T00:00:00`).getDay()];

function isRestDay(profile, iso) {
  const sc = profile?.schedule;
  if (!sc) return false;
  return (sc.restDays || []).includes(dayKey(iso)) || (sc.offDates || []).includes(iso);
}
function reducedCapacity(profile, iso) {
  const sc = profile?.schedule;
  return sc?.reducedDays?.[dayKey(iso)] || null; // e.g. "low"
}
export function weakReviewTarget(state) {
  return state.settings?.weakReviewTarget || state.profile?.retention?.weakTopicReviewTarget || 1;
}

// Store the profile on state, wire the retention target, and (once per profile
// version) seed the real assessment calendar. Idempotent across reloads.
export function applyProfile(state, profile) {
  if (!profile) return state;
  const already = state.profileAppliedAt === profile.updatedAt && state.profile;
  let s = { ...state, profile };
  const target = profile.retention?.weakTopicReviewTarget;
  if (target) s = { ...s, settings: { ...s.settings, weakReviewTarget: target } };
  if (!already) {
    s = seedAssessmentsFromProfile(s, profile);
    s.profileAppliedAt = profile.updatedAt;
  }
  return save(s);
}

function profileTargetToGoal(targetStr, unit) {
  const str = String(targetStr || "").toLowerCase();
  const pctMatch = str.match(/(\d{2})\s*%/);
  if (unit === "percent") return pctMatch ? Number(pctMatch[1]) : 65;
  if (pctMatch) return pctToPredicted3(Number(pctMatch[1]));
  if (str.includes("comfortable")) return 216;
  if (str.includes("margin")) return 206;
  return 200; // "pass"
}

// Replace the auto-seeded arc with the profile's real dated calendar, preserving
// any row the user already took or edited in-app (matched by label).
function seedAssessmentsFromProfile(state, profile) {
  const list = profile.assessments || [];
  if (!list.length) return state;
  const prevByLabel = Object.fromEntries((state.assessments || []).map((a) => [a.label, a]));
  const rows = list.map((p, i) => {
    const name = p.name || `Checkpoint ${i + 1}`;
    const low = name.toLowerCase();
    const kind = low.includes("free 120") || low.includes("free120") ? "free120"
      : low.includes("uwsa") ? "uwsa" : "nbme";
    const unit = kind === "free120" ? "percent" : "three_digit";
    const label = name.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
    const role = low.includes("baseline") ? "baseline" : low.includes("final") || low.includes("free") ? "final" : "mid";
    const prev = prevByLabel[label];
    const form = (name.match(/\b(\d{1,2})\b/) || [])[1] || "";
    return {
      id: `p-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind, label, form, role, unit,
      plannedDate: p.date, goalScore: profileTargetToGoal(p.target, unit),
      actual: prev?.actual ?? (p.result != null ? Number(p.result) : null),
      takenDate: prev?.takenDate ?? null,
      note: "", seeded: true, touched: prev?.touched || false,
    };
  });
  // Keep any user-added custom rows that aren't part of the profile calendar.
  const labels = new Set(rows.map((r) => r.label));
  const custom = (state.assessments || []).filter((a) => !labels.has(a.label) && (a.id?.startsWith("a-") || a.takenDate));
  return { ...state, assessments: [...rows, ...custom].sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1)) };
}

// Effective study-day capacity between two dates, honoring rest/reduced days.
// Rest day = 0, reduced day = low/med ratio, full day = 1. Falls back to a plain
// day count when there's no profile (backward compatible).
function scheduleCapacityDays(state, fromISO, toISO) {
  const profile = state.profile;
  const from = isoToMs(fromISO), to = isoToMs(toISO);
  if (to <= from) return 0;
  if (!profile?.schedule) return Math.round((to - from) / DAY);
  const cp = state.settings.capacityPresets;
  const redRatio = clamp01((cp.low || 90) / Math.max(1, cp.med || 240));
  let days = 0;
  for (let ms = from + DAY; ms <= to; ms += DAY) {
    const iso = msToISO(ms);
    if (isRestDay(profile, iso)) continue;
    days += reducedCapacity(profile, iso) ? redRatio : 1;
  }
  return days;
}

// ── Weak-spot ingestion (Channel A: questions, Channel B: seed file) ─────────
// Maps every deck question onto its FA chapter via faMap keywords, tallies
// attempted/missed per chapter, and pushes chapterMissRate onto each unit.
// First Aid coverage tuning: at/above FA_DONE fraction of a unit's FA topics
// checked off, the unit is auto-completed and leaves the projection; below that,
// partial coverage relieves weakness proportionally (relief 1 = fully covered
// would zero the live weakness even before it's marked done).
const FA_DONE = 0.9;
const FA_COV_RELIEF = 1;

export function recomputeWeakness(state, units, deck, seed) {
  const progress = loadProgress();
  const faTopics = loadFATopics();
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

  // Channel C — LIVE miss rate from the stats you enter per UWorld/NBME test,
  // carried with its per-system question count so we know how much to trust it.
  const testStats = systemStatsFromTests();

  // Channel D — per-system performance from the student profile: pct correct →
  // miss rate, keyed to the plan-unit vocabulary. A static baseline/prior.
  const profileWeakBySystem = {};
  for (const row of state.profile?.perSystemPerformance || []) {
    if (row.pct == null) continue;
    const sys = PROFILE_SYS_ALIAS[(row.system || "").toLowerCase()] || row.system;
    profileWeakBySystem[sys] = Math.max(profileWeakBySystem[sys] || 0, clamp01(1 - row.pct / 100));
  }

  // How fast the live exam channel overrides the static prior. With CONF_K = 30,
  // 30 logged questions in a system = half-trust, 90 = three-quarters. Below that
  // we lean on the seed/profile baseline; above it, your real scores rule.
  const CONF_K = 30;
  const TEST_K = 6; // Laplace smoothing on the live miss-rate itself

  const next = { ...state, units: { ...state.units } };
  for (const u of units) {
    const prev = next.units[u.key] || {};
    const chA = chapterMiss[u.chapterNum] || 0;                      // FA/deck progress (live)
    const chB = seedBySystem[(u.system || "").toLowerCase()] || 0;   // manual seed prior
    const chD = profileWeakBySystem[u.system] || 0;                  // profile prior
    const prior = Math.max(chB, chD);                                // static baseline

    // Blend the live exam signal toward the prior by confidence. As you log more
    // questions in a system AND score better, its weakness falls — so a system
    // you keep acing sheds weight and a still-weak one (e.g. Genetics) rises past
    // it. With no exam data yet, this is exactly the old prior.
    const ts = testStats[u.system] || { total: 0, correct: 0 };
    let examWeak = prior;
    if (ts.total > 0) {
      const raw = clamp01((ts.total - ts.correct) / (ts.total + TEST_K));
      const conf = ts.total / (ts.total + CONF_K);
      examWeak = conf * raw + (1 - conf) * prior;
    }

    // First Aid / deck progress (chA) is the other live channel: mastering a
    // chapter's questions drops it. Weakness is the worse of the two live views.
    const liveWeak = clamp01(Math.max(chA, examWeak));

    // Channel E — First Aid TRACKER coverage (live). Fraction of this unit's FA
    // topics you've ticked off in the tracker (fa-topics-v2). Covered material
    // sheds weakness so it sinks in priority; a fully-covered chapter is auto-
    // completed and drops out of the calendar entirely. Untouched units (cov 0)
    // are unchanged.
    const ids = u.faItemIds || [];
    const cov = ids.length ? ids.filter((id) => faTopics[id]?.done).length / ids.length : 0;
    const weaknessScore = clamp01(liveWeak * (1 - FA_COV_RELIEF * cov));

    // Auto-complete / auto-revert from FA coverage. Never touch a unit you marked
    // done by hand (no faAuto flag); faAuto tags the transition so unchecking the
    // chapter later brings it back into the plan.
    let status = prev.status;
    let completedDate = prev.completedDate || null;
    let faAuto = !!prev.faAuto;
    const manualDone = prev.status === "done" && !prev.faAuto;
    if (!manualDone) {
      if (ids.length && cov >= FA_DONE) {
        status = "done"; faAuto = true;
        completedDate = completedDate || localISODate();
      } else if (faAuto) {
        status = "scheduled"; faAuto = false; completedDate = null;
      }
    }

    next.units[u.key] = { ...prev, weaknessScore, status, faAuto, completedDate };
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

// Has a done/skim/review unit's spaced interval elapsed? (reuses storage.js INTERVALS)
function reviewDue(state, u) {
  const st = state.units[u.key] || {};
  if (!st.completedDate) return true;
  const streak = Math.min(st.reviewStreak || 0, INTERVALS.length - 1);
  const due = isoToMs(st.completedDate) + INTERVALS[streak] * DAY;
  return Date.now() >= due;
}

function spacingReadiness(state, u) {
  const st = state.units[u.key] || {};
  if (st.status === "done" || st.status === "skim" || st.status === "review") {
    return reviewDue(state, u) ? 1 : 0;
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

// Priority (§3.1) — "big, hard, high-yield, and weak units dominate." There is
// NO foundation gating: foundations (basics track) aren't forced to the front,
// they ride the separate basics-interleave budget in planDay. size + hard push
// the biggest, hardest marquee systems up; weak (largest weight) keeps your
// wrong-answer topics resurfacing so they win ties even against fresh content.
// Anchor-rotation bonus: earlier-leadWeek marquee systems surface first (Cardio
// opens), then unlock in order as each completes and leaves the pool. Basics have
// no leadWeek — they ride the separate basics-interleave budget in planDay, so
// they get no rotation bonus. Weak/urgency can still pull a later system forward.
const MAX_LEAD_WEEK = 6;
function anchorLead(W, u) {
  if (u.track !== "anchor" || u.leadWeek == null) return 0;
  return W.lead * (1 - Math.min(u.leadWeek, MAX_LEAD_WEEK) / MAX_LEAD_WEEK);
}

export function priority(state, units, u, dateISO, recentSystems = []) {
  const W = state.settings.weights;
  const st = state.units[u.key] || {};
  return (
    W.yield * (u.yieldWeight / 5) +
    W.size * (u.sizeRank || 0) +
    W.hard * (u.hardness || 0) +
    W.weak * (st.weaknessScore || 0) +
    anchorLead(W, u) +
    W.urgency * urgency(state, units, u, dateISO) +
    W.spacing * spacingReadiness(state, u) +
    W.interleave * interleaveBonus(u, recentSystems)
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

  // Simulation day: an untaken assessment scheduled for today owns the day.
  // Cut content to a single light block so only Anki + light review get planned.
  const assessmentToday = (s.assessments || []).find((a) => !a.takenDate && a.plannedDate === dateISO) || null;
  if (assessmentToday) budget = s.settings.blockMinutes;

  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const recentSystems = recentCompletedSystems(s, byKey, dateISO);

  // Track budgets (§3.2): carve out the 🎯 UWorld block and the 🧊 basics
  // interleave first; the 🔥 anchor (marquee system) budget gets the majority.
  const split = s.settings.trackSplit || DEFAULT_SETTINGS.trackSplit;
  const dedicated = s.phase === "dedicated";
  const uworldBudget = Math.round(budget * split.uworldPct);
  const content = budget - uworldBudget;
  const basicsBudget = Math.round(content * split.basicsPct);
  const anchorBudget = content - basicsBudget;

  // Pool = not-done units (todo / scheduled / in_progress), plus weak units
  // awaiting a retention review whose spaced interval is due (§retention target).
  const inPool = (u) => {
    const st = s.units[u.key] || {};
    if (["todo", "scheduled", "in_progress"].includes(st.status)) return true;
    return st.status === "review" && reviewDue(s, u);
  };
  const scoreDesc = (a, b) => b.p - a.p;
  const score = (list) => list.map((u) => ({ u, p: priority(s, units, u, dateISO, recentSystems) })).sort(scoreDesc);

  // Greedy fill of a scored pool up to `cap`, scheduling each picked unit.
  // In dedicated phase, anchor/basics distinction dissolves — everything is
  // targeted review, so both budgets draw from the whole pool.
  const planned = [];
  let used = 0;
  const fill = (scored, cap, { allowPartial = false } = {}) => {
    const target = cap * FILL;
    let localUsed = 0;
    for (const { u } of scored) {
      if (localUsed >= target) break;
      if (planned.includes(u.key)) continue;
      const est = u.estMinutes;
      if (planned.length === 0 && allowPartial && est > budget && capacity === "low") {
        planned.push(u.key);
        s.units[u.key] = { ...s.units[u.key], status: "in_progress", plannedDate: dateISO };
        used += budget; localUsed += budget;
        break;
      }
      if (localUsed + est <= cap || planned.length === 0) {
        planned.push(u.key);
        s.units[u.key] = { ...s.units[u.key], status: "scheduled", plannedDate: dateISO };
        used += est; localUsed += est;
      }
    }
  };

  const anchorPool = score(units.filter((u) => inPool(u) && (dedicated || u.track === "anchor")));
  fill(anchorPool, anchorBudget, { allowPartial: true });

  // 🧊 Basics interleave: guaranteed daily, but never the same basics subject two
  // days running (spaced-rotation guard) so foundations arrive as seasoning.
  const yesterdayBasics = new Set(
    (s.days[addDaysISO(dateISO, -1)]?.basics || [])
      .map((k) => byKey[k]?.colorKey).filter(Boolean));
  const basicsPool = score(
    units.filter((u) => inPool(u) && u.track === "basics" && !yesterdayBasics.has(u.colorKey)));
  const basicsStart = planned.length;
  fill(basicsPool, basicsBudget);
  const basics = planned.slice(basicsStart);
  const anchor = planned.slice(0, basicsStart);

  // 🎯 Daily UWorld block — a synthetic item planDay always emits (§16). Sized to
  // the UWorld budget; studies yesterday's incorrects; system = today's anchor.
  const perQ = s.profile?.resourceMinutesPerTopic?.UWorld || 1.5;
  const anchorSystem = byKey[anchor[0]]?.system || byKey[planned[0]]?.system || "mixed";
  const prevUworld = s.days[addDaysISO(dateISO, -1)]?.uworld;
  // Question target = the goal-driven quota that keeps you on pace to finish the
  // Qbank by the deadline; floored so there's always a real block, and it never
  // needs to exceed what the reserved time can hold (perQ minutes each).
  const pace = uworldPacing(s, dateISO);
  const timeCap = Math.max(dedicated ? 40 : 10, Math.round(uworldBudget / perQ));
  const quotaQ = pace.perDay;
  const uworld = {
    mode: dedicated ? "random" : "tutor",
    system: dedicated ? "mixed" : anchorSystem,
    targetQ: Math.max(dedicated ? 20 : 10, quotaQ || timeCap),
    quotaQ,                 // goal-driven pace target (what "must" be done today)
    timeCap,               // what the reserved block time comfortably holds
    minutes: uworldBudget,
    studyTargets: prevUworld?.missedUnits || [],
    done: false, correct: null, total: null, missedSystems: [],
  };

  const prevDay = s.days[dateISO] || {};
  s.days[dateISO] = {
    capacity,
    planned,
    anchor,
    basics,
    uworld,
    completed: prevDay.completed || [],
    missed: prevDay.missed || [],
    ankiDone: prevDay.ankiDone || false,
    misses: prevDay.misses || [],
    ankiReserveMin: anki,
    uworldMin: uworldBudget,
    plannedMinutes: used,
    assessmentToday: assessmentToday?.id || null,
  };

  s = maybeSwitchPhase(s, dateISO);
  s = maybeRetune(s, dateISO);
  return save(s);
}

// ── Daily UWorld block logging (§16) ─────────────────────────────────────────
// Log a completed UWorld block: record correct/total, raise weakness for the
// systems you missed, and queue those units as tomorrow's "study this miss"
// targets. missedSystems is a list of unit `system` strings (from chips).
export function recordUworld(state, units, { correct, total, missedSystems = [] }, dateISO = todayISO()) {
  const s = { ...state, units: { ...state.units }, days: { ...state.days } };
  const day = (s.days[dateISO] ||= { capacity: "med", planned: [], completed: [], missed: [], misses: [], ankiDone: false });
  const missedSet = new Set(missedSystems);

  // Units in a missed system get a weakness bump and a re-test (not `done` until
  // the retention target of correct passes). Collect them as tomorrow's targets.
  const missedUnits = [];
  for (const u of units) {
    if (!missedSet.has(u.system)) continue;
    const st = s.units[u.key] || {};
    s.units[u.key] = {
      ...st,
      weaknessScore: clamp01((st.weaknessScore || 0) + 0.2),
      status: st.status === "done" ? "review" : st.status,
      reviewStreak: st.status === "done" ? 0 : (st.reviewStreak || 0),
    };
    missedUnits.push(u.key);
  }

  day.uworld = {
    ...(day.uworld || {}),
    done: true,
    correct: correct == null ? null : Number(correct),
    total: total == null ? null : Number(total),
    missedSystems: [...missedSet],
    missedUnits,
  };
  return save(s);
}

// ── UWorld Qbank pacing (§ daily quota to the mid-Sept goal) ─────────────────
// Sum the questions you've logged in the daily UWorld blocks, plus any you
// completed before adopting the app (the offset). This is the "done" count that
// drives the per-day quota.
export function uworldDone(state) {
  let done = Math.max(0, Number(state.settings?.uworldDoneOffset) || 0);
  for (const d of Object.values(state.days || {})) {
    if (d?.uworld?.done && d.uworld.total) done += Number(d.uworld.total) || 0;
  }
  return done;
}

// The pacing model: how many Qbank questions per day keep you on track to finish
// `uworldGoalTotal` by the content deadline. `perDay` is what each date shows.
export function uworldPacing(state, dateISO = todayISO()) {
  const goal = Math.max(0, Number(state.settings?.uworldGoalTotal) || 0);
  const done = uworldDone(state);
  const remaining = Math.max(0, goal - done);
  const deadline = state.settings.contentDeadline;
  // Days you can still practice, counting today (so the deadline day = 1 day).
  const daysLeft = Math.max(1, studyDaysBetween(dateISO, deadline) + 1);
  const perDay = Math.ceil(remaining / daysLeft);
  const pct = goal ? clamp(Math.round((done / goal) * 100), 0, 100) : 0;
  return { goal, done, remaining, daysLeft, perDay, pct, deadline, complete: goal > 0 && remaining === 0 };
}

// ── Completion / miss (§4) ───────────────────────────────────────────────────
export function recordDone(state, unitKey, actualMinutes, dateISO = todayISO()) {
  const s = { ...state, units: { ...state.units }, days: { ...state.days }, adaptation: { ...state.adaptation, focusByHour: { ...state.adaptation.focusByHour } } };
  const st = s.units[unitKey] || {};
  // Retention: a weak unit isn't retired until it comes back correct `target`
  // times on spaced review (profile.retention.weakTopicReviewTarget, default 1).
  const target = weakReviewTarget(s);
  const weak = (st.weaknessScore || 0) >= 0.4;
  const nextStreak = (st.reviewStreak || 0) + 1;
  const retire = !weak || nextStreak >= target;
  const hr = new Date().getHours();
  // Snapshot everything this mutator changes so undoDone can restore it exactly.
  s.lastDone = {
    key: unitKey, date: dateISO,
    prevUnit: { ...st },
    prevWasCompleted: (s.days[dateISO]?.completed || []).includes(unitKey),
    prevEMA: s.adaptation.completionRateEMA,
    hr, prevFocus: s.adaptation.focusByHour[hr] ?? null,
    prevBestWindow: s.adaptation.bestFocusWindow,
  };
  s.units[unitKey] = {
    ...st, status: retire ? "done" : "review", completedDate: dateISO,
    lastTouched: Date.now(), actualMinutes: actualMinutes ?? st.actualMinutes,
    reviewStreak: nextStreak,
  };
  const day = (s.days[dateISO] ||= { capacity: "med", planned: [], completed: [], missed: [], misses: [], ankiDone: false });
  day.completed = [...new Set([...(day.completed || []), unitKey])];
  day.missed = (day.missed || []).filter((k) => k !== unitKey);

  // done-rate by start hour + completion EMA up
  bumpFocusHour(s.adaptation, hr, 1);
  s.adaptation.completionRateEMA = ema(s.adaptation.completionRateEMA, 1, 0.2);
  deriveBestWindow(s.adaptation);
  return save(s);
}

// Inverse of recordDone — restores the unit, the day's completed list, and the
// adaptation stats from the snapshot recordDone captured. One level deep only.
export function undoDone(state, unitKey) {
  const u = state.lastDone;
  if (!u || (unitKey && u.key !== unitKey)) return state;
  const s = {
    ...state, units: { ...state.units }, days: { ...state.days },
    adaptation: { ...state.adaptation, focusByHour: { ...state.adaptation.focusByHour } },
  };
  s.units[u.key] = { ...u.prevUnit };
  const day = s.days[u.date];
  if (day && !u.prevWasCompleted) {
    s.days[u.date] = { ...day, completed: (day.completed || []).filter((k) => k !== u.key) };
  }
  s.adaptation.completionRateEMA = u.prevEMA;
  if (u.prevFocus == null) delete s.adaptation.focusByHour[u.hr];
  else s.adaptation.focusByHour[u.hr] = u.prevFocus;
  s.adaptation.bestFocusWindow = u.prevBestWindow;
  delete s.lastDone;
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
  const perDay = Math.max(30, avgDaily - ankiPerDay);
  // Effective days honor profile rest/reduced days (Friday = reduced, etc.);
  // assessment days inside the content phase are also lost to content work.
  const effectiveDays = scheduleCapacityDays(state, dateISO, state.settings.contentDeadline);
  const lostToAssessments = assessmentContentDays(state, dateISO);
  const capacityLeft = Math.max(0, effectiveDays - lostToAssessments) * perDay;
  const ratio = remainingMin / Math.max(1, capacityLeft);

  let status = "green";
  if (ratio > 1.3) status = "red";
  else if (ratio > 1.0) status = "amber";
  else if (ratio < 0.5) status = "ahead";

  const finishDays = Math.ceil(remainingMin / perDay);
  const etaMs = Date.now() + finishDays * DAY;
  const etaLabel = new Date(etaMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return { remainingMin, daysLeft, capacityLeft, ratio, status, etaLabel, finishDays };
}

// ── Forward projection (powers the Gantt + calendar views) ───────────────────
// Deterministically lays out every remaining unit across the study days ahead,
// filling each day up to its content budget in priority order. A unit longer
// than one day spans consecutive days, giving each a contiguous [start,end]
// window for the Gantt. Purely advisory — never mutates state.
export function addDaysISO(iso, n) { return msToISO(isoToMs(iso) + n * DAY); }

export function projectSchedule(state, units, fromISO = todayISO(), { maxDays = 400 } = {}) {
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const recentSystems = recentCompletedSystems(state, byKey, fromISO);

  // Remaining work, highest priority first. skim units cost half.
  const remaining = units
    .filter((u) => ["todo", "scheduled", "in_progress", "skim"].includes(state.units[u.key]?.status || "todo"))
    .map((u) => ({ u, p: priority(state, units, u, fromISO, recentSystems) }))
    .sort((a, b) => b.p - a.p)
    .map(({ u }) => ({
      key: u.key,
      remain: (state.units[u.key]?.status === "skim" ? u.estMinutes / 2 : u.estMinutes),
    }));

  const anki = state.settings.ankiReserveMin.med;
  const perDay = Math.max(state.settings.blockMinutes,
    (recentAvgDailyMin(state) || state.settings.capacityPresets.med) - anki);

  // Untaken assessments block their day (light — Anki only, no content).
  const assessByDate = {};
  for (const a of state.assessments || []) {
    if (a.plannedDate && !a.takenDate) assessByDate[a.plannedDate] = a;
  }

  const examISO = state.settings.examDate;
  const days = [];
  const spans = {};
  let ptr = 0, date = fromISO, guard = 0;

  while (ptr < remaining.length && guard++ < maxDays) {
    const assessment = assessByDate[date] || null;
    const items = [];
    if (!assessment) {
      let cap = perDay;
      while (cap > 0 && ptr < remaining.length) {
        const cur = remaining[ptr];
        const take = Math.min(cap, cur.remain);
        items.push({ key: cur.key, minutes: Math.round(take) });
        const sp = (spans[cur.key] ||= { start: date, end: date, minutes: 0 });
        sp.end = date; sp.minutes += Math.round(take);
        cur.remain -= take; cap -= take;
        if (cur.remain <= 0.5) ptr++;
      }
    }
    days.push({
      date,
      items,
      minutes: items.reduce((s, x) => s + x.minutes, 0),
      assessment,
      afterDeadline: date > state.settings.contentDeadline,
    });
    if (date >= examISO && ptr < remaining.length) {
      // Past the exam with work still queued — stop; the Gantt flags the overflow.
      break;
    }
    date = addDaysISO(date, 1);
  }

  return { fromISO, days, spans, exhaustedISO: date, overflow: ptr < remaining.length };
}

// Merge the real logged past (state.days) with the forward projection into one
// date-keyed map for the calendar: { iso: { planned, completed, missed, ankiDone,
// projected, assessment } }.
export function calendarModel(state, units, { pastDays = 120, futureFromISO = todayISO() } = {}) {
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const model = {};

  for (const [iso, d] of Object.entries(state.days || {})) {
    model[iso] = {
      iso, capacity: d.capacity,
      completed: (d.completed || []).filter((k) => byKey[k]),
      missed: (d.missed || []).filter((k) => byKey[k]),
      planned: (d.planned || []).filter((k) => byKey[k]),
      ankiDone: !!d.ankiDone, uworld: d.uworld || null, projected: [], real: true,
    };
  }

  const proj = projectSchedule(state, units, futureFromISO);
  for (const d of proj.days) {
    if (d.date < futureFromISO) continue;
    const entry = (model[d.date] ||= { iso: d.date, completed: [], missed: [], planned: [], ankiDone: false, projected: [], real: false });
    // Don't double-show a unit already completed/planned that real day.
    const taken = new Set([...entry.completed, ...entry.planned]);
    entry.projected = d.items.map((x) => x.key).filter((k) => !taken.has(k));
  }

  // Fold in assessment checkpoints on their planned dates.
  for (const a of state.assessments || []) {
    if (!a.plannedDate) continue;
    const entry = (model[a.plannedDate] ||= { iso: a.plannedDate, completed: [], missed: [], planned: [], ankiDone: false, projected: [], real: false });
    (entry.assessments ||= []).push(a);
  }

  return { model, proj };
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
    // focus/hard both point to "too much hard content at once" — lean harder on
    // interleave so easier basics/easy-win systems get mixed between the marquee
    // anchors (more scaffolding without a foundation wall).
    if (dominant[0] === "focus" || dominant[0] === "hard") {
      s.settings.weights.interleave = Math.min(s.settings.weights.interleave + 0.1, 1);
    }
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
    if (data && (data.version === 1 || data.version === 2)) return migrate(data);
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
