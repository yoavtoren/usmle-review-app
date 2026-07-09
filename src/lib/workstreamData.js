// ── Category config ────────────────────────────────────────────────────────
export const CATEGORIES = {
  aims: {
    title:      "AIMS",
    subtitle:   "עמוד פיקוד — ארגון סטודנטים",
    accent:     "#7C3A4D",
    storageKey: "usmle-app:aims-tasks-v2",
    streams:    null,
    tone:       "blunt",
    frontKey:   "aims",
  },
};

// No seed data — every area starts empty and the user adds their own tasks.

// ── Load / save ────────────────────────────────────────────────────────────
export function loadCategoryTasks(categoryId) {
  const cat = CATEGORIES[categoryId];
  if (!cat) return [];
  try {
    const raw = localStorage.getItem(cat.storageKey);
    if (raw !== null) return JSON.parse(raw);
    return [];
  } catch { return []; }
}

export function saveCategoryTasks(categoryId, tasks) {
  const cat = CATEGORIES[categoryId];
  if (cat) localStorage.setItem(cat.storageKey, JSON.stringify(tasks));
}

export function loadAllWorkstreamTasks() {
  return Object.keys(CATEGORIES).flatMap(id => loadCategoryTasks(id));
}

// ── Rhythms storage ────────────────────────────────────────────────────────
const RHYTHMS_KEY = "usmle-app:rhythms-v1";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

export function loadRhythms() {
  try { return JSON.parse(localStorage.getItem(RHYTHMS_KEY)) || {}; }
  catch { return {}; }
}
export function saveRhythms(r) { localStorage.setItem(RHYTHMS_KEY, JSON.stringify(r)); }

export function isRhythmDone(rhythms, itemId, period) {
  const last = rhythms[itemId];
  if (!last) return false;
  if (period === "daily")  return last >= isoToday();
  if (period === "weekly") return last >= isoWeekStart();
  return false;
}
export function markRhythm(rhythms, itemId) {
  return { ...rhythms, [itemId]: isoToday() };
}
