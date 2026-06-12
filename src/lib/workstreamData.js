import { SEED_AIMS_TASKS } from "./timelineData.js";

// ── Category config ────────────────────────────────────────────────────────
export const CATEGORIES = {
  aims: {
    title:      "AIMS",
    subtitle:   "עמוד פיקוד — ארגון סטודנטים",
    accent:     "#7c3aed",
    storageKey: "usmle-app:aims-tasks-v2",
    streams:    null,
    tone:       "blunt",
    frontKey:   "aims",
  },
  medcross: {
    title:      "MedCross",
    subtitle:   "אינסטגרם + לפני לונץ׳",
    accent:     "#db2777",
    storageKey: "usmle-app:medcross-tasks-v2",
    streams:    null,
    tone:       "creative",
    frontKey:   "medcross",
  },
  selfcare: {
    title:      "טיפול עצמי",
    subtitle:   "אנג'לה · עצמי · כללי — להגן על זה",
    accent:     "#16a34a",
    storageKey: "usmle-app:selfcare-tasks-v2",
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
  { id: "mc-fake",    title: "הפסק להוסיף עוקבים מזויפים",                         urgency: "High",   deadline: null,         people: [], status: "Active", notes: "~10 אלף מזויפים מול ~100 אמיתיים. מזויפים פוגעים בהגעה — הפסק עכשיו.",                                        addToTimeline: false, category: "medcross" },
  { id: "mc-post",    title: "התחל לפרסם תוכן אמיתי עכשיו (קל, ניתן לאצווה)",     urgency: "Medium", deadline: null,         people: [], status: "Active", notes: "בנה קהל אמיתי: סטודנטים לרפואה, רופאים, סקרנים רפואיים.",                                                addToTimeline: false, category: "medcross" },
  { id: "mc-batch",   title: "צור סרטוני 'חידה של היום' קולנועיים באצוות",        urgency: "Medium", deadline: null,         people: [], status: "Active", notes: "צור כמה בבת אחת בחלון היצירתי של הבוקר. תהליך עבודה Gemini / nano banana.",                                addToTimeline: false, category: "medcross" },
  { id: "mc-launch",  title: "השקה ציבורית — חלון שקט אחרי הנחיתה",              urgency: "Medium", deadline: "2026-08-25", tz: "Asia/Jerusalem", people: [], status: "Active", notes: "לא במהלך ENT או המעבר. צריך תוכן מספיק + עוקבים אמיתיים + נתיב להכנסה ראשונה.", addToTimeline: true, category: "medcross", reminders: ["T-7d","T-1d","T-0@10:00"] },
  { id: "mc-revenue", title: "הגיע להכנסה ראשונה",                                urgency: "Low",    deadline: null,         people: [], status: "Active", notes: "תנאי ניצחון עד אוקטובר. ייתכן ספין-אוף 'מדע כללי' בהמשך.",                                               addToTimeline: false, category: "medcross" },
];

const SEED_SELFCARE = [
  // Angela stream
  { id: "sc-weekly",       title: "רגע ללא הסחות עם אנג'לה",                    urgency: "High",   deadline: null,         tz: "Asia/Jerusalem", people: [{ name: "Angela", role: "girlfriend", contact: "khouryangela12@gmail.com" }], status: "Active", notes: "בקושי מקבלים אחד בשבוע — הגן עליו במכוון. טלפונים למטה.",                                       addToTimeline: false, category: "selfcare", stream: "angela", recurring: "weekly" },
  { id: "sc-move-support", title: "תמוך באנג'לה דרך המעבר (באופן קונקרטי)",     urgency: "High",   deadline: "2026-07-25", tz: "Europe/Prague",  people: [{ name: "Angela", role: "girlfriend", contact: "khouryangela12@gmail.com" }], status: "Active", notes: "היא יותר לחוצה לגבי המעבר ממני. קח אחריות על ההפרדה; הסר חסמים ספציפיים.", addToTimeline: true,  category: "selfcare", stream: "angela", reminders: ["T-7d","T-1d"] },
  { id: "sc-gesture",      title: "מחווה שבועית מחושבת (זולה, ספציפית)",        urgency: "Medium", deadline: null,         tz: "Asia/Jerusalem", people: [{ name: "Angela", role: "girlfriend", contact: "khouryangela12@gmail.com" }], status: "Active", notes: "טיול, אימון יחד, ארוחה שאני מבשל, ספא בהישג יד. תשומת לב > כסף.",              addToTimeline: false, category: "selfcare", stream: "angela", recurring: "weekly" },
  { id: "sc-friday",       title: "ארוחת ערב משפחתית שישי (ישראל)",             urgency: "Medium", deadline: null,         tz: "Asia/Jerusalem", people: [], status: "Active", notes: "חשוב. בהמשך: ג'ודו בימי שישי — כיף + משתלב עם ארוחת משפחה.",                        addToTimeline: false, category: "selfcare", stream: "angela", recurring: "weekly" },
  // Myself stream
  { id: "sc-shower",  title: "מקלחת ערב / טיפול עצמי (30-60 דק')",            urgency: "Medium", deadline: null, people: [], status: "Active", notes: "הרגעה מוגנת לפני שינה.",                                                                                          addToTimeline: false, category: "selfcare", stream: "myself", recurring: "daily"  },
  { id: "sc-move",    title: "הפסקת תנועה יומית (ניטרלי לפרק כף יד)",          urgency: "Medium", deadline: null, people: [], status: "Active", notes: "ציסטה גנגליונית מגבילה שחרור אגודל/יד — מדרגות, כריעות, לוחות על אמת יד. הימנע משכיבות שמיכה כבדות.",           addToTimeline: false, category: "selfcare", stream: "myself", recurring: "daily"  },
  { id: "sc-doctor",  title: "העלה דפוס בחילת בוקר אצל רופא GERD",             urgency: "High",   deadline: null, people: [{ name: "GERD doctor", role: "physician", contact: "" }], status: "Active", notes: "PPI יומי; בחילה ברוב הבקרים עד ~12:00. שווה תור ייעודי.", addToTimeline: false, category: "selfcare", stream: "myself" },
  { id: "sc-train",   title: "אימון / כושר",                                    urgency: "Low",    deadline: null, people: [], status: "Active", notes: "ניטרלי לפרק כף יד. משתלב עם אנג'לה (אימון יחד).",                                                                addToTimeline: false, category: "selfcare", stream: "myself", recurring: "weekly" },
  // General stream
  { id: "sc-cook-main",  title: "בשל את הארוחה הראשית של הצהריים",      urgency: "Medium", deadline: null, people: [], status: "Active", notes: "ארוחה ראשית בצהריים (אחרי שהבחילה עוברת, הפסקת לימוד ארוכה). ארוחת ערב קלה יותר ומוקדמת לרפלוקס.", addToTimeline: false, category: "selfcare", stream: "general", recurring: "daily"  },
  { id: "sc-cook-batch", title: "בשל פעמיים בשבוע, ואז שלב מחדש",        urgency: "Medium", deadline: null, people: [], status: "Active", notes: "שלב כמה חלבונים + בסיסים לארוחות מגוונות כדי שאנג'לה תקבל מגוון ללא בישול יומיומי.",                           addToTimeline: false, category: "selfcare", stream: "general", recurring: "weekly" },
  { id: "sc-groceries",  title: "קניות + הכנת אוכל",                      urgency: "Low",    deadline: null, people: [], status: "Active", notes: "אוכל אמיתי בלבד, לא מוכן. כפול כניהול רפלוקס.",                                                                   addToTimeline: false, category: "selfcare", stream: "general", recurring: "weekly" },
];

const SEEDS = { aims: SEED_AIMS_TASKS, medcross: SEED_MEDCROSS, selfcare: SEED_SELFCARE };

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
