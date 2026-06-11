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
const TEST_LOG_KEY = "test-log-v5";

const SEED_TESTS = [
  { id: 1748563200000, testNum: "UWORLD test 1", score: 28, date: "2026-05-18", uworldAvg: 54, hasQuestions: true, block: "test1", deckFile: "questions/deck.json" },
  { id: 1749686400000, testNum: "UWORLD test 2", score: 55, date: "2026-06-11", uworldAvg: 54, hasQuestions: true, block: "test2", deckFile: "questions/deck.json" },
  { id: 1749772800000, testNum: "UWORLD test 3", score: 49, date: "2026-06-12", uworldAvg: 54, hasQuestions: true, block: "test3", deckFile: "questions/deck.json" },
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
