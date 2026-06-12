// Local-only progress tracking. Everything lives in the browser's localStorage
// on YOUR machine. Nothing is sent anywhere.

const KEY = "usmle-review-progress-v1";
const DAY = 24 * 60 * 60 * 1000;

// Lightweight spaced-repetition intervals (days) as you mark "Got it".
const INTERVALS = [1, 3, 7, 16, 35];

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

export function isDue(card) {
  return !card.dueAt || card.dueAt <= Date.now();
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

// ── FA topic manual tracking ──────────────────────────────────────────────────
const FA_TOPICS_KEY = "fa-topics-v2";

export function loadFATopics() {
  try { return JSON.parse(localStorage.getItem(FA_TOPICS_KEY)) || {}; }
  catch { return {}; }
}

export function saveFATopics(topics) {
  localStorage.setItem(FA_TOPICS_KEY, JSON.stringify(topics));
}

// ── Test score log ────────────────────────────────────────────────────────────
const TEST_LOG_KEY = "test-log-v8";

const SEED_TESTS = [
  { id: 1748563200000, testNum: "UWORLD test 1", score: 28, date: "2026-05-18", uworldAvg: 54, hasQuestions: true, block: "test1", deckFile: "questions/deck.json" },
  { id: 1749686400000, testNum: "UWORLD test 2", score: 55, date: "2026-06-11", uworldAvg: 59, hasQuestions: true, block: "test2", deckFile: "questions/deck.json" },
  { id: 1749772800000, testNum: "UWORLD test 3", score: 49, date: "2026-06-12", uworldAvg: 62, hasQuestions: true, block: "test3", deckFile: "questions/deck.json" },
  { id: 1749859200000, testNum: "UWORLD test 4", score: 45, date: "2026-06-05", uworldAvg: 60, hasQuestions: true, block: "test4", deckFile: "questions/deck.json" },
];

export function loadTestLog() {
  try {
    const raw = localStorage.getItem(TEST_LOG_KEY);
    if (raw !== null) return JSON.parse(raw) || [];
    localStorage.setItem(TEST_LOG_KEY, JSON.stringify(SEED_TESTS));
    return SEED_TESTS;
  } catch { return []; }
}

export function saveTestLog(log) {
  localStorage.setItem(TEST_LOG_KEY, JSON.stringify(log));
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

// ── JSON export / import ──────────────────────────────────────────────────
export function exportAllData() {
  const keys = [KEY, TASKS_KEY, FA_TOPICS_KEY, TEST_LOG_KEY, STREAK_KEY,
    Q_INTAKE_KEY, TOPIC_CTR_KEY, FA_INTAKE_KEY, LIGHT_MODE_KEY];
  const out = {};
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw) try { out[k] = JSON.parse(raw); } catch {}
  }
  return JSON.stringify(out, null, 2);
}
export function importAllData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
    return true;
  } catch { return false; }
}
