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

export function isDue(card) {
  return !card.dueAt || card.dueAt <= Date.now();
}
