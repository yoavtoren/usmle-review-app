// ── Category config ────────────────────────────────────────────────────────
export const CATEGORIES = {
  aims: {
    title:      "AIMS",
    subtitle:   "עמוד פיקוד — ארגון סטודנטים",
    accent:     "#7c3aed",
    storageKey: "usmle-app:aims-tasks-v1",
    streams:    null,
    tone:       "blunt",
    frontKey:   "aims",
  },
  medcross: {
    title:      "MedCross",
    subtitle:   "אינסטגרם + לפני לונץ׳",
    accent:     "#db2777",
    storageKey: "usmle-app:medcross-tasks-v1",
    streams:    null,
    tone:       "creative",
    frontKey:   "medcross",
  },
  selfcare: {
    title:      "טיפול עצמי",
    subtitle:   "אנג'לה · עצמי · כללי — להגן על זה",
    accent:     "#16a34a",
    storageKey: "usmle-app:selfcare-tasks-v1",
    streams: [
      { id: "angela",  label: "אנג'לה" },
      { id: "myself",  label: "עצמי"   },
      { id: "general", label: "כללי"   },
    ],
    tone:       "warm",
    frontKey:   "selfcare",
  },
};

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_MEDCROSS = [
  { id: "mc-fake",    title: "Stop adding fake followers",                                  urgency: "High",   deadline: null,         people: [], status: "Active", notes: "~10k fake vs ~100 real. Fake ones hurt reach — stop now.",                                                                                addToTimeline: false, category: "medcross" },
  { id: "mc-post",    title: "Start posting real content now (light, batchable)",           urgency: "Medium", deadline: null,         people: [], status: "Active", notes: "Build a real audience: med students, doctors, the medically curious.",                                                                      addToTimeline: false, category: "medcross" },
  { id: "mc-batch",   title: "Batch cinematic 'puzzle of the day' videos",                  urgency: "Medium", deadline: null,         people: [], status: "Active", notes: "Produce several at once in the morning creative window. Gemini / nano banana workflow.",                                                     addToTimeline: false, category: "medcross" },
  { id: "mc-launch",  title: "Public launch — calm window after landing",                   urgency: "Medium", deadline: "2026-08-25", tz: "Asia/Jerusalem", people: [], status: "Active", notes: "NOT during ENT or the move. Needs enough content + real followers + path to first revenue. Adjust date once August clears.", addToTimeline: true, category: "medcross", reminders: ["T-7d","T-1d","T-0@10:00"] },
  { id: "mc-revenue", title: "Reach first revenue",                                         urgency: "Low",    deadline: null,         people: [], status: "Active", notes: "Win condition by October. Possible 'general science' spin-off later.",                                                                        addToTimeline: false, category: "medcross" },
];

const SEED_SELFCARE = [
  // Angela stream
  { id: "sc-weekly",       title: "One distraction-free moment with Angela",           urgency: "High",   deadline: null,         tz: "Asia/Jerusalem", people: [{ name: "Angela", role: "girlfriend", contact: "khouryangela12@gmail.com" }], status: "Active", notes: "We barely get one a week — protect it deliberately. Phones down.",                             addToTimeline: false, category: "selfcare", stream: "angela", recurring: "weekly" },
  { id: "sc-move-support", title: "Support Angela through the move (concretely)",      urgency: "High",   deadline: "2026-07-25", tz: "Europe/Prague",  people: [{ name: "Angela", role: "girlfriend", contact: "khouryangela12@gmail.com" }], status: "Active", notes: "She's more stressed about the move than I am. Take ownership of the split; remove specific blockers.", addToTimeline: true,  category: "selfcare", stream: "angela", reminders: ["T-7d","T-1d"] },
  { id: "sc-gesture",      title: "Weekly thoughtful gesture (cheap, specific)",       urgency: "Medium", deadline: null,         tz: "Asia/Jerusalem", people: [{ name: "Angela", role: "girlfriend", contact: "khouryangela12@gmail.com" }], status: "Active", notes: "A walk, a workout together, a dinner I cook, an affordable spa. Attention > money.",              addToTimeline: false, category: "selfcare", stream: "angela", recurring: "weekly" },
  { id: "sc-friday",       title: "Friday family dinner (Israel)",                     urgency: "Medium", deadline: null,         tz: "Asia/Jerusalem", people: [], status: "Active", notes: "Matters. Later: judo on Fridays — fun + pairs with family Friday.",                                                                                     addToTimeline: false, category: "selfcare", stream: "angela", recurring: "weekly" },
  // Myself stream
  { id: "sc-shower",  title: "Evening shower / self-care (30–60 min)",                urgency: "Medium", deadline: null, people: [], status: "Active", notes: "Protected wind-down before sleep.",                                                                                          addToTimeline: false, category: "selfcare", stream: "myself", recurring: "daily"  },
  { id: "sc-move",    title: "Daily movement break (wrist-neutral)",                  urgency: "Medium", deadline: null, people: [], status: "Active", notes: "Ganglion cyst limits thumb/hand extension — stairs, squats, forearm planks. Avoid heavy push-ups.",                          addToTimeline: false, category: "selfcare", stream: "myself", recurring: "daily"  },
  { id: "sc-doctor",  title: "Raise morning-nausea pattern with GERD doctor",         urgency: "High",   deadline: null, people: [{ name: "GERD doctor", role: "physician", contact: "" }], status: "Active", notes: "Daily PPI; nausea most mornings until ~12:00. Worth a dedicated appointment.", addToTimeline: false, category: "selfcare", stream: "myself" },
  { id: "sc-train",   title: "Training / workout",                                    urgency: "Low",    deadline: null, people: [], status: "Active", notes: "Wrist-neutral. Pairs well with Angela (workout together).",                                                                   addToTimeline: false, category: "selfcare", stream: "myself", recurring: "weekly" },
  // General stream
  { id: "sc-cook-main",  title: "Cook the midday main meal",      urgency: "Medium", deadline: null, people: [], status: "Active", notes: "Main meal at midday (after nausea clears, long study break). Lighter, earlier dinner for reflux.", addToTimeline: false, category: "selfcare", stream: "general", recurring: "daily"  },
  { id: "sc-cook-batch", title: "Cook twice a week, then recombine", urgency: "Medium", deadline: null, people: [], status: "Active", notes: "Recombine a few proteins + bases into varied meals so Angela gets variety without nightly cooking.",  addToTimeline: false, category: "selfcare", stream: "general", recurring: "weekly" },
  { id: "sc-groceries",  title: "Groceries + meal prep",           urgency: "Low",    deadline: null, people: [], status: "Active", notes: "Real food only, no takeaway. Doubles as reflux management.",                                          addToTimeline: false, category: "selfcare", stream: "general", recurring: "weekly" },
];

const SEEDS = { aims: null, medcross: SEED_MEDCROSS, selfcare: SEED_SELFCARE };

// ── Load / save ────────────────────────────────────────────────────────────
export function loadCategoryTasks(categoryId) {
  const cat = CATEGORIES[categoryId];
  if (!cat) return [];
  try {
    const raw = localStorage.getItem(cat.storageKey);
    if (raw !== null) return JSON.parse(raw);
    const seed = SEEDS[categoryId];
    if (seed) {
      localStorage.setItem(cat.storageKey, JSON.stringify(seed));
      return seed;
    }
    return [];
  } catch { return SEEDS[categoryId] || []; }
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
