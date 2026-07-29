// Local-only progress tracking. Everything lives in the browser's localStorage
// on YOUR machine (and, when signed in, your own private iCloud database).

import { DATA_KEYS, DATA_KEY_SET, readKey, writeKey } from "./dataKeys.js";

const KEY = "usmle-review-progress-v1";
const DAY = 24 * 60 * 60 * 1000;

// Lightweight spaced-repetition intervals (days) as you mark "Got it".
export const INTERVALS = [1, 3, 7, 16, 35];

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function getCard(progress, id) {
  return (
    progress[id] || { status: "new", streak: 0, lastReviewed: null, dueAt: null }
  );
}

// rating: "got" (correct on review) or "again" (needs more work)
export function rate(id, rating) {
  const progress = loadProgress();
  const card = getCard(progress, id);
  const now = Date.now();
  if (rating === "got") {
    const streak = Math.min(card.streak + 1, INTERVALS.length - 1);
    progress[id] = {
      status: streak >= INTERVALS.length - 1 ? "mastered" : "review",
      streak,
      lastReviewed: now,
      dueAt: now + INTERVALS[streak] * DAY,
    };
  } else {
    progress[id] = {
      status: "review",
      streak: 0,
      lastReviewed: now,
      dueAt: now + INTERVALS[0] * DAY,
    };
  }
  save(progress);
  return progress;
}

export function setDifficulty(id, difficulty) {
  const progress = loadProgress();
  const card = getCard(progress, id);
  progress[id] = { ...card, difficulty };
  save(progress);
  return progress;
}

export function toggleDone(id) {
  const progress = loadProgress();
  const card = getCard(progress, id);
  progress[id] = { ...card, done: !card.done };
  save(progress);
  return progress;
}

// Explicitly set a card's "done" flag. Exists so call sites never have to reach
// for the raw storage key (TestReview used to write "usmle-review-progress-v1"
// inline, which would silently fork into a second store on any key change).
export function setDone(id, done) {
  const progress = loadProgress();
  progress[id] = { ...getCard(progress, id), done: !!done };
  save(progress);
  return progress;
}

// Only a card in `review` can be due. `dueAt` is null for BOTH new and mastered
// cards, so the old `!card.dueAt || …` returned true for them — every caller had
// to remember an external `status === "review"` guard. The guard now lives here.
export function isDue(card) {
  if (card?.status !== "review") return false;
  return !card.dueAt || card.dueAt <= Date.now();
}

// Human label for when a card is next due, e.g. "in 3 days · Jun 18".
export function nextReviewLabel(card) {
  if (!card?.dueAt) return null;
  const diff = card.dueAt - Date.now();
  const days = Math.round(diff / DAY);
  const dateStr = new Date(card.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diff <= 0)   return `due now · ${dateStr}`;
  if (days <= 1)   return `tomorrow · ${dateStr}`;
  return `in ${days} days · ${dateStr}`;
}

// Build the full spaced-repetition picture from the deck + saved progress:
// what's overdue / due today, a 14-day upcoming distribution, and tallies.
export function getReviewSchedule(questions = [], progress = loadProgress()) {
  const now = Date.now();
  const paused = getLightMode().paused;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const t0 = todayStart.getTime();

  let overdue = 0, dueToday = 0, mastered = 0, reviewing = 0, fresh = 0;
  const upcoming = []; // { dueAt }

  for (const q of questions) {
    const c = getCard(progress, q.id);
    if (c.status === "mastered") { mastered++; continue; }
    if (c.status === "new")      { fresh++; continue; }
    reviewing++;
    const dueAt = c.dueAt || now;
    if (dueAt <= now) {
      if (dueAt < t0) overdue++; else dueToday++;
    } else {
      upcoming.push(dueAt);
    }
  }

  const dueNow = paused ? 0 : overdue + dueToday;

  // 14-day distribution (day 0 = today, counts overdue + due-today together).
  // Paused (Light Mode) forces today's load to 0 so the chart/strip/captions match dueNow.
  const days = [];
  for (let i = 0; i < 14; i++) {
    const dStart = t0 + i * DAY;
    const dEnd = dStart + DAY;
    const count = i === 0
      ? (paused ? 0 : overdue + dueToday)
      : upcoming.filter(d => d >= dStart && d < dEnd).length;
    days.push({ ms: dStart, count, isToday: i === 0 });
  }

  return {
    paused, dueNow, overdue, dueToday,
    upcomingTotal: upcoming.length,
    mastered, reviewing, fresh,
    nextDueAt: upcoming.length ? Math.min(...upcoming) : null,
    days,
  };
}

const STREAK_KEY = "usmle-streak-v1";

export function recordActivity() {
  const today = new Date().toDateString();
  try {
    const stored = JSON.parse(localStorage.getItem(STREAK_KEY) || "null");
    if (stored?.last === today) return;
    const yesterday = new Date(Date.now() - DAY).toDateString();
    const streak = stored?.last === yesterday ? (stored.streak || 0) + 1 : 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ last: today, streak }));
  } catch {}
}

export function getStreak() {
  try {
    const stored = JSON.parse(localStorage.getItem(STREAK_KEY) || "null");
    if (!stored) return 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - DAY).toDateString();
    return stored.last === today || stored.last === yesterday ? stored.streak || 0 : 0;
  } catch {
    return 0;
  }
}

// ── Smart insights ────────────────────────────────────────────────────────────

export function computeInsights(questions, progress) {
  const insights = [];
  const knowledgeQs = [];
  let distractorCount = 0, comprehensionCount = 0, vocabCount = 0, imagingCount = 0;
  const distractorSystems = {};

  for (const q of questions) {
    const d = progress[q.id]?.difficulty;
    if (!d) continue;
    if (d === "knowledge")    { knowledgeQs.push(q); }
    else if (d === "distractor") { distractorCount++; distractorSystems[q.system] = (distractorSystems[q.system] || 0) + 1; }
    else if (d === "comprehension") comprehensionCount++;
    else if (d === "vocab")   vocabCount++;
    else if (d === "imaging") imagingCount++;
  }

  // FA chapter recommendations from knowledge gaps
  const chapterCounts = {};
  for (const q of knowledgeQs) {
    for (const fa of (q.firstAid || [])) {
      const chapter = fa.location.split(/\s*[>›]\s*/)[0].trim();
      chapterCounts[chapter] = (chapterCounts[chapter] || 0) + 1;
    }
    if (!q.firstAid?.length) {
      const k = `__sys__${q.system}`;
      chapterCounts[k] = (chapterCounts[k] || 0) + 1;
    }
  }

  const topChapters = Object.entries(chapterCounts)
    .filter(([k]) => !k.startsWith("__sys__"))
    .sort((a, b) => b[1] - a[1]).slice(0, 3);

  for (const [chapter, count] of topChapters) {
    insights.push({
      id: `fa-${chapter}`,
      type: "firstaid",
      icon: "📚",
      title: `Review "${chapter}" in First Aid`,
      detail: `${count} knowledge gap${count > 1 ? "s" : ""} here`,
      taskText: `📚 First Aid: ${chapter} — ${count} knowledge gap${count > 1 ? "s" : ""}`,
      priority: count >= 3 ? "high" : "medium",
    });
  }

  // Fallback: system-level knowledge gaps when no FA refs available
  if (knowledgeQs.length > 0 && topChapters.length === 0) {
    const sysCounts = {};
    for (const q of knowledgeQs) sysCounts[q.system] = (sysCounts[q.system] || 0) + 1;
    for (const [sys, count] of Object.entries(sysCounts).sort((a, b) => b[1] - a[1]).slice(0, 2)) {
      insights.push({
        id: `sys-${sys}`,
        type: "firstaid",
        icon: "📚",
        title: `Study ${sys} concepts`,
        detail: `${count} knowledge gap${count > 1 ? "s" : ""}`,
        taskText: `📚 Study ${sys} — ${count} knowledge gap${count > 1 ? "s" : ""}`,
        priority: "medium",
      });
    }
  }

  if (distractorCount >= 2) {
    const topSys = Object.entries(distractorSystems).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: "distractor",
      type: "technique",
      icon: "🧲",
      title: "Practice active elimination",
      detail: `Pulled by wrong answers ${distractorCount} times${topSys ? ` · most in ${topSys[0]}` : ""}`,
      taskText: `🧲 Practice elimination technique — distracted ${distractorCount} times`,
      priority: distractorCount >= 4 ? "high" : "medium",
    });
  }

  if (vocabCount >= 2) {
    insights.push({
      id: "vocab",
      type: "vocab",
      icon: "🔤",
      title: "Review medical vocabulary",
      detail: `Vocabulary gaps on ${vocabCount} question${vocabCount > 1 ? "s" : ""}`,
      taskText: `🔤 Review medical vocabulary — ${vocabCount} questions affected`,
      priority: "medium",
    });
  }

  if (imagingCount >= 2) {
    insights.push({
      id: "imaging",
      type: "imaging",
      icon: "🖼️",
      title: "Review pathology images",
      detail: `Imaging/diagrams blocked you ${imagingCount} times`,
      taskText: `🖼️ Review pathology & imaging — ${imagingCount} questions affected`,
      priority: "medium",
    });
  }

  if (comprehensionCount >= 2) {
    insights.push({
      id: "comprehension",
      type: "technique",
      icon: "🧭",
      title: "Slow down reading question stems",
      detail: `Misread ${comprehensionCount} question${comprehensionCount > 1 ? "s" : ""}`,
      taskText: `🧭 Practice careful reading — misread ${comprehensionCount} stems`,
      priority: "low",
    });
  }

  return insights;
}

// ── Task manager ─────────────────────────────────────────────────────────────
const TASKS_KEY = "usmle-tasks-v1";

export function loadTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
  catch { return []; }
}
export function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

// ── General tasks & events (dedicated task area) ─────────────────────────────
const GTASKS_KEY = "general-tasks-v1";

export function loadGeneralTasks() {
  try { return JSON.parse(localStorage.getItem(GTASKS_KEY)) || []; }
  catch { return []; }
}
export function saveGeneralTasks(tasks) {
  localStorage.setItem(GTASKS_KEY, JSON.stringify(tasks));
}

// ── Rail scratch notes (free-form pad in the sidebar) ────────────────────────
const RAIL_NOTES_KEY = "usmle-app:rail-notes-v1";

export function loadRailNotes() {
  try { return localStorage.getItem(RAIL_NOTES_KEY) || ""; }
  catch { return ""; }
}
export function saveRailNotes(text) {
  localStorage.setItem(RAIL_NOTES_KEY, text || "");
}

// ── FA topic manual tracking ──────────────────────────────────────────────────
const FA_TOPICS_KEY = "fa-topics-v2";

// One-time remap of topic keys after the FA tracker was reconciled against the
// real First Aid 2025 book (renumbered sections/topics, fixed names, merges).
// Each entry maps an old `file::section::topic` key to its new key so existing
// progress (done state, difficulty, reviews) survives the rename. See
// faMigration.json (generated from the book) for the full mapping.
import FA_KEY_MIGRATION from "./faMigration.json";
const FA_MIGRATION_FLAG = "fa-topics-migrated-v3";
let _faMigrated = false;
function ensureFAMigration() {
  if (_faMigrated) return;
  _faMigrated = true;
  try {
    if (localStorage.getItem(FA_MIGRATION_FLAG)) return;
    const raw = localStorage.getItem(FA_TOPICS_KEY);
    if (raw) {
      const t = JSON.parse(raw) || {};
      // Collect every move first, delete all old keys, THEN write the new keys.
      // Section renumbering permutes keys (e.g. a topic at 07→08 while another
      // goes 09→07), so an in-place move would clobber; two passes avoid that.
      const moves = [];
      for (const [oldK, newK] of Object.entries(FA_KEY_MIGRATION)) {
        if (t[oldK] !== undefined) moves.push([oldK, newK, t[oldK]]);
      }
      if (moves.length) {
        for (const [oldK] of moves) delete t[oldK];
        for (const [, newK, val] of moves) if (t[newK] === undefined) t[newK] = val;
        localStorage.setItem(FA_TOPICS_KEY, JSON.stringify(t));
      }
    }
    localStorage.setItem(FA_MIGRATION_FLAG, "1");
  } catch { /* never block reads on a migration hiccup */ }
}

export function loadFATopics() {
  ensureFAMigration();
  try { return JSON.parse(localStorage.getItem(FA_TOPICS_KEY)) || {}; }
  catch { return {}; }
}

export function saveFATopics(topics) {
  localStorage.setItem(FA_TOPICS_KEY, JSON.stringify(topics));
}

// ── UWorld test log (single source of truth) ──────────────────────────────────
// One entry per logged test carries EVERYTHING about that sitting: overall
// result, date, the per-subject / per-system stat breakdown, and how you felt
// that day. The Tests page, the Progress page (via progressData), the Home
// dashboard, and the planner's weakness engine all read from this one list, so
// filling the form once flows to every screen. Entry shape:
//   { id, testNum, date, score, uworldAvg?, questionCount?,
//     feeling?: { mood: 1..5, note },
//     subjects?: { name: { total, correct, omitted } },
//     systems?:  { name: { total, correct, omitted } },
//     createdAt, block?, deckFile?, hasQuestions? }
const TEST_LOG_KEY = "test-log-v9";

export function loadTestLog() {
  try {
    const raw = localStorage.getItem(TEST_LOG_KEY);
    return raw !== null ? (JSON.parse(raw) || []) : [];
  } catch { return []; }
}

export function saveTestLog(log) {
  localStorage.setItem(TEST_LOG_KEY, JSON.stringify(log));
}

// Delete one logged test. Snapshots first — a test entry carries the result, the
// full per-subject/per-system breakdown and the day's feeling note, and it is
// deletable from two different screens with only a two-tap confirm.
export function deleteTest(id) {
  snapshotAll("pre-delete-test");
  const next = loadTestLog().filter((t) => t.id !== id);
  saveTestLog(next);
  return next;
}

// Overall % for one test — prefer an explicit score, else derive it from the
// subject stat breakdown (correct / graded), else from systems.
export function testScore(test) {
  if (test == null) return null;
  if (Number.isFinite(test.score)) return test.score;
  for (const kind of ["subjects", "systems"]) {
    let total = 0, correct = 0;
    for (const r of Object.values(test[kind] || {})) {
      if (r?.total) { total += Number(r.total) || 0; correct += Number(r.correct) || 0; }
    }
    if (total) return Math.round((correct / total) * 100);
  }
  return null;
}

// ── Question intake metadata ───────────────────────────────────────────────
const Q_INTAKE_KEY = "usmle-q-intake-v1";

export function loadQIntake() {
  try { return JSON.parse(localStorage.getItem(Q_INTAKE_KEY)) || {}; }
  catch { return {}; }
}
function saveQIntakeRaw(data) { localStorage.setItem(Q_INTAKE_KEY, JSON.stringify(data)); }
export function getQIntakeMeta(id) { return loadQIntake()[id] || null; }
export function saveQuestionIntake(id, meta) {
  const all = loadQIntake();
  all[id] = { ...meta, savedAt: Date.now() };
  saveQIntakeRaw(all);
}

// Reset a set of questions back to "unreviewed" for a fresh re-review:
// clears SR progress + done, intake tags, and any auto-generated linked tasks.
export function resetQuestions(ids) {
  const set = new Set(ids);
  if (set.size === 0) return 0;
  snapshotAll(`pre-reset-questions (${set.size})`);

  const progress = loadProgress();
  for (const id of set) delete progress[id];
  save(progress);

  const intake = loadQIntake();
  for (const id of set) delete intake[id];
  saveQIntakeRaw(intake);

  const tasks = loadTasks().filter(t => !set.has(t.linkedQuestionId));
  saveTasks(tasks);

  return set.size;
}

// ── Atomic wizard completion (schedule + mark done in one write) ───────────
export function processWizardComplete(id, schedule) {
  const progress = loadProgress();
  const card = getCard(progress, id);
  const now = Date.now();
  let update = {};
  if (schedule === "mastered") {
    update = { status: "mastered", streak: INTERVALS.length - 1, lastReviewed: now, dueAt: null };
  } else if (schedule === "got") {
    const streak = Math.min(card.streak + 1, INTERVALS.length - 1);
    update = { status: streak >= INTERVALS.length - 1 ? "mastered" : "review", streak, lastReviewed: now, dueAt: now + INTERVALS[streak] * DAY };
  } else if (schedule === "again") {
    update = { status: "review", streak: 0, lastReviewed: now, dueAt: now + INTERVALS[0] * DAY };
  }
  progress[id] = { ...card, ...update, done: true };
  save(progress);
  return progress;
}

// ── Topic miss counters ───────────────────────────────────────────────────
const TOPIC_CTR_KEY = "usmle-topic-ctr-v1";

export function loadTopicCounters() {
  try { return JSON.parse(localStorage.getItem(TOPIC_CTR_KEY)) || {}; }
  catch { return {}; }
}
export function saveTopicCounters(ctrs) {
  localStorage.setItem(TOPIC_CTR_KEY, JSON.stringify(ctrs));
}
export function bumpTopicMiss(subject, system, questionId) {
  const ctrs = loadTopicCounters();
  const key = `${subject}::${system}`;
  const cur = ctrs[key] || { count: 0, questionIds: [] };
  const qIds = [...new Set([...cur.questionIds, questionId])];
  ctrs[key] = { count: qIds.length, questionIds: qIds };
  saveTopicCounters(ctrs);
  return ctrs[key].count;
}
export function getWeakSubjects(n = 3) {
  const ctrs = loadTopicCounters();
  const totals = {};
  for (const [key, val] of Object.entries(ctrs)) {
    const [subject] = key.split("::");
    totals[subject] = (totals[subject] || 0) + val.count;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([subject, count]) => ({ subject, count }));
}

// ── Light mode — pause SR due-counter ────────────────────────────────────
const LIGHT_MODE_KEY = "usmle-light-mode-v1";
export function getLightMode() {
  try { return JSON.parse(localStorage.getItem(LIGHT_MODE_KEY)) || { paused: false }; }
  catch { return { paused: false }; }
}
export function setLightMode(paused) {
  localStorage.setItem(LIGHT_MODE_KEY, JSON.stringify({ paused, changedAt: Date.now() }));
}
export function isDueRespectingMode(card) {
  if (getLightMode().paused) return false;
  return isDue(card);
}

// ── Reset schedule to a target date ──────────────────────────────────────
export function resetScheduleToDate(targetDateStr) {
  snapshotAll("pre-reschedule");
  const progress = loadProgress();
  const targetMs = new Date(targetDateStr).getTime();
  const now = Date.now();
  const reviewCards = Object.entries(progress).filter(([, c]) => c.status === "review" || c.status === "mastered");
  if (!reviewCards.length) return;
  const span = Math.max(targetMs - now, DAY);
  const step = Math.floor(span / Math.max(reviewCards.length, 1));
  reviewCards.forEach(([id, card], i) => {
    if (card.status !== "mastered") {
      progress[id] = { ...card, dueAt: now + i * step };
    }
  });
  save(progress);
}

// ── FA coverage from intake (sections read via "read-fa" tasks) ───────────
const FA_INTAKE_KEY = "usmle-fa-intake-v1";
export function loadFAIntake() {
  try { return JSON.parse(localStorage.getItem(FA_INTAKE_KEY)) || {}; }
  catch { return {}; }
}
export function touchFASection(sectionId) {
  if (!sectionId) return;
  const data = loadFAIntake();
  if (!data[sectionId]) {
    data[sectionId] = { touchedAt: Date.now() };
    localStorage.setItem(FA_INTAKE_KEY, JSON.stringify(data));
  }
}
export function getFAIntakeCoverage() {
  return Object.keys(loadFAIntake()).length;
}

// ── Mastered this week ───────────────────────────────────────────────────
export function getMasteredThisWeek() {
  const progress = loadProgress();
  const weekAgo = Date.now() - 7 * DAY;
  return Object.values(progress).filter(c => c.status === "mastered" && c.lastReviewed >= weekAgo).length;
}

// ── One-time cleanup of removed areas ─────────────────────────────────────
// The app was scoped down to USMLE Step 1 + AIMS + personal tasks. This wipes
// any previously-saved tasks/events from the removed life-management areas
// (and resets AIMS + personal tasks to empty), so the only thing left is your
// USMLE study progress + test scores. Runs exactly once per browser.
const CLEANUP_FLAG = "usmle-app:cleanup-scope-v1";
const CLEARED_ON_CLEANUP = [
  "usmle-app:aims-tasks-v2",      // AIMS tasks (reset to empty)
  "usmle-app:medcross-tasks-v2",  // removed area
  "usmle-app:selfcare-tasks-v2",  // removed area
  "usmle-app:tl-events-v2",       // timeline events (removed)
  "usmle-app:rhythms-v1",         // workstream rhythms
  "usmle-app:goals-done-v1",      // timeline goals (removed)
  "usmle-app:events-done-v1",     // timeline events (removed)
  "usmle-app:reminder-state-v1",  // reminder dismiss/snooze state
  "general-tasks-v1",             // personal tasks (reset to empty)
  "medschool-v5",                 // Med School (removed)
];

export function cleanupRemovedAreas() {
  try {
    if (localStorage.getItem(CLEANUP_FLAG)) return;
    for (const k of CLEARED_ON_CLEANUP) localStorage.removeItem(k);
    localStorage.setItem(CLEANUP_FLAG, "1");
  } catch { /* never block startup on a cleanup hiccup */ }
}

// ── Question "imported to the app" timestamps ─────────────────────────────
// The deck itself has no creation date, so we stamp each question id the first
// time the app sees it. New questions added in a later import get a later stamp,
// which is what the Question Bank sorts by ("newest first"). Existing ids keep
// their original stamp; a batch of brand-new ids is stamped in deck order (tiny
// increments) so their relative import order is preserved.
const Q_SEEN_KEY = "usmle-q-seen-v1";

export function loadQuestionSeen() {
  try { return JSON.parse(localStorage.getItem(Q_SEEN_KEY)) || {}; }
  catch { return {}; }
}

// Stamp any ids we haven't seen before. `orderedIds` should be in deck order.
// Returns the full id → firstSeenMs map (including pre-existing stamps).
export function stampQuestionsSeen(orderedIds = []) {
  const seen = loadQuestionSeen();
  const fresh = orderedIds.filter((id) => seen[id] == null);
  if (fresh.length) {
    // Monotonic: a fresh batch always stamps after every id seen so far, so a
    // later import sorts above earlier ones even if the clock hasn't advanced.
    const maxSeen = Object.values(seen).reduce((m, v) => Math.max(m, v || 0), 0);
    const base = Math.max(Date.now(), maxSeen + 1);
    fresh.forEach((id, i) => { seen[id] = base + i; }); // preserve deck order
    localStorage.setItem(Q_SEEN_KEY, JSON.stringify(seen));
  }
  return seen;
}

// ── Full progress reset ───────────────────────────────────────────────────
// Wipes every study-progress store back to a clean slate so the user can
// re-import their real tests from scratch. Structural / preference data
// (personal + AIMS tasks, email config, last FA page read) is left untouched.
const RESET_FLAG = "usmle-app:reset-progress-v2";
const RESET_KEYS = [
  KEY,                          // spaced-repetition cards
  TEST_LOG_KEY, "test-log-v8",  // unified test log (+ legacy)
  "usmle-perf-snapshots-v1",    // legacy standalone snapshots (now derived)
  TASKS_KEY,                    // auto-generated study tasks
  FA_TOPICS_KEY,                // First Aid topic coverage
  Q_INTAKE_KEY,                 // question intake tags
  TOPIC_CTR_KEY,                // topic miss counters
  FA_INTAKE_KEY,                // First Aid section coverage
  STREAK_KEY,                   // daily streak
  LIGHT_MODE_KEY,               // pause / light mode
  Q_SEEN_KEY,                   // question import timestamps
  "usmle-scheduler-v1",         // adaptive planner state
  "usmle-error-log-v1",         // error log (why each question was missed)
];

export function resetAllProgress() {
  try {
    snapshotAll("pre-reset");   // always recoverable — see listSnapshots()
    for (const k of RESET_KEYS) localStorage.removeItem(k);
    // Mark it done. Synced (see dataKeys.DATA_KEYS) so the wipe happens once
    // across all devices instead of re-clobbering freshly re-imported data.
    localStorage.setItem(RESET_FLAG, JSON.stringify({ at: Date.now() }));
  } catch { /* best-effort */ }
}

// RETIRED one-time reset.
//
// This used to call resetAllProgress() whenever the guard flag was missing. That
// was a live data-loss path: initICloudSync() installs the localStorage patch
// BEFORE its first reconcile finishes, and the web path deliberately yields after
// 2.5s. On a slow network boot continued, the flag hadn't been pulled yet, and the
// wipe ran through the PATCHED removeItem — pushing `null` tombstones for every
// progress key to CloudKit and destroying the data on every other device too.
//
// The reset it existed for shipped and ran long ago. We keep writing the flag so
// no device can ever re-arm it, but we never delete anything.
export function maybeAutoReset() {
  try {
    if (localStorage.getItem(RESET_FLAG)) return;
    localStorage.setItem(RESET_FLAG, JSON.stringify({ at: Date.now(), retired: true }));
  } catch { /* never block startup */ }
}

// ── Local snapshot ring (the undo behind every destructive action) ─────────
// Every irreversible action snapshots first. Deliberately NOT in DATA_KEYS: it
// must never sync (it would blow the CloudKit record size) and must never be
// cleared by a reset — it is what you recover *from*.
const SNAP_KEY = "usmle:snapshots-v1";
const SNAP_MAX = 5;

export function snapshotAll(label = "manual") {
  try {
    const snaps = listSnapshots();
    snaps.unshift({ at: Date.now(), label, data: JSON.parse(exportAllData()) });
    localStorage.setItem(SNAP_KEY, JSON.stringify(snaps.slice(0, SNAP_MAX)));
  } catch { /* quota / parse — a failed snapshot must never block the action */ }
}

export function listSnapshots() {
  try {
    const list = JSON.parse(localStorage.getItem(SNAP_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/** Restore a snapshot by its `at` timestamp. Snapshots the CURRENT state first. */
export function restoreSnapshot(at) {
  const snap = listSnapshots().find((s) => s.at === at);
  if (!snap) return { ok: false, reason: "not-found" };
  snapshotAll("pre-restore");
  let count = 0;
  for (const k of DATA_KEYS) {
    if (snap.data[k] === undefined) continue;
    writeKey(k, snap.data[k]);
    count++;
  }
  return { ok: true, count };
}

// ── JSON export / import ──────────────────────────────────────────────────
// Both walk DATA_KEYS, so the backup covers exactly what syncs — no more
// silently-unbacked-up stores (the error log, AIMS tasks and rail notes were all
// missing from the old hand-written list).
export function exportAllData() {
  const out = { __app: "usmle-review-app", __v: 1, __at: Date.now() };
  for (const k of DATA_KEYS) {
    const v = readKey(k);
    if (v !== undefined) out[k] = v;
  }
  return JSON.stringify(out, null, 2);
}

/** Returns { ok, count, skipped } | { ok:false, reason }. Snapshots before writing. */
export function importAllData(jsonStr) {
  let data;
  try { data = JSON.parse(jsonStr); } catch { return { ok: false, reason: "not-json" }; }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "bad-shape" };
  }
  // Allowlist: only keys this app owns are ever written to localStorage.
  const keys = Object.keys(data).filter((k) => DATA_KEY_SET.has(k));
  if (!keys.length) return { ok: false, reason: "no-known-keys" };

  snapshotAll("pre-import");
  for (const k of keys) writeKey(k, data[k]);
  const skipped = Object.keys(data).filter((k) => !DATA_KEY_SET.has(k) && !k.startsWith("__")).length;
  return { ok: true, count: keys.length, skipped };
}
