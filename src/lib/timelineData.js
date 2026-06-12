// ── Palette + maps ────────────────────────────────────────────────────────
export const FRONT_COLORS = {
  "step1":        "#4f46e5",
  "ent":          "#0d9488",
  "july-move":    "#d97706",
  "sept-move":    "#ea580c",
  "aims":         "#7c3aed",
  "medcross":     "#db2777",
  "selfcare":     "#16a34a",
  "relationship": "#16a34a",
  "personal":     "#475569",
};

export const FRONT_LABELS = {
  "step1":        "Step 1",
  "ent":          "ENT",
  "july-move":    "מעבר לפראג",
  "sept-move":    "מעבר לישראל",
  "aims":         "AIMS",
  "medcross":     "MedCross",
  "selfcare":     "טיפול עצמי",
  "relationship": "מערכת יחסים",
  "personal":     "אישי",
};

export const TYPE_LABELS = {
  deadline:        "דד-ליין",
  event:           "אירוע",
  landmark:        "ציון דרך",
  "task-deadline": "משימה",
  aims:            "AIMS",
  blocker:         "חוסם",
};

export const TYPE_ICONS = {
  deadline:        "🔴",
  event:           "📅",
  landmark:        "⭐",
  "task-deadline": "📌",
  blocker:         "🚧",
  aims:            "🎯",
};

export const URGENCY_COLORS = {
  Critical: "#ef4444",
  High:     "#f97316",
  Medium:   "#eab308",
  Low:      "#22c55e",
};

// ── Phases ────────────────────────────────────────────────────────────────
export const PHASES = [
  { id:"ph1", name:"התחלה",             start:"2026-06-10", end:"2026-06-12", color:"#475569", note:"Sell-off groundwork; set contract end-dates; watch flights; ECFMG with faculty." },
  { id:"ph2", name:"ENT + מכירה",       start:"2026-06-13", end:"2026-06-22", color:"#0d9488", note:"Light ENT oral prep with Angela; keep selling/packing; exam 22 Jun." },
  { id:"ph3", name:"יציאה מפראג",       start:"2026-06-23", end:"2026-07-31", color:"#d97706", note:"Pack, sell, cancel contracts, book + take flight; lease ends ~31 Jul." },
  { id:"ph4", name:"נחיתה",             start:"2026-08-01", end:"2026-08-15", color:"#ea580c", note:"Arrive; AIMS peak (3+5 Aug); vacation 14–15 Aug; restart light study." },
  { id:"ph5", name:"דחיפת Step 1",      start:"2026-08-16", end:"2026-10-11", color:"#4f46e5", note:"Dedicated block 12h/day, 1 lighter half-day/wk; Sept permanent move early; exam before 11 Oct." },
];

// ── Goals ─────────────────────────────────────────────────────────────────
export const GOALS = [
  { id:"g1", label:"Step 1: מעבר בטוח",                                             front:"step1" },
  { id:"g2", label:"מעבר חלק; דירה קבועה טובה",                                    front:"sept-move" },
  { id:"g3", label:"אנג'לה מסופקת ונתמכת",                                          front:"relationship" },
  { id:"g4", label:"תפקיד AIMS ללא פגיעה",                                          front:"aims" },
  { id:"g5", label:"MedCross הושק — תוכן, עוקבים אמיתיים, הכנסה ראשונה",           front:"medcross" },
  { id:"g6", label:"להרגיש חזק ולהיראות טוב",                                       front:"personal" },
];

// ── Seed timeline events ──────────────────────────────────────────────────
export const SEED_TL_EVENTS = [
  { id:"ev-sell",        title:"התחל למכור רהיטים",                   date:"2026-06-10", tz:"Europe/Prague",  type:"landmark",       front:"july-move",  note:"המשימה שמפחדים ממנה — רשום פריט אחד כדי לשבור את הקרח.",                    reminders:["T-0@09:00"],                                       source:"seed" },
  { id:"ev-contracts",   title:"קבע תאריכי סיום לאינטרנט + טלפון",   date:"2026-06-12", tz:"Europe/Prague",  type:"deadline",       front:"july-move",  note:"בדוק תקופות הודעה מראש קודם.",                                               reminders:["T-1d","T-0@09:00"],                                source:"seed" },
  { id:"ev-ent",         title:"בחינה סופית אוראלית ENT",             date:"2026-06-22", tz:"Europe/Prague",  type:"deadline",       front:"ent",         note:"בחינה אוראלית. חזור בקול עם אנג'לה. שמור על הכנה קלה.",                    reminders:["T-14d","T-7d","T-3d","T-1d","T-0@08:00"],          source:"seed" },
  { id:"ev-flight",      title:"הזמן טיסה פראג→ישראל",               date:"2026-06-30", tz:"Europe/Prague",  type:"task-deadline",  front:"july-move",  note:"דד-ליין רך — הזמן מוקדם בשלב היציאה.",                                      reminders:["T-3d","T-1d","T-0@09:00"],                         source:"seed" },
  { id:"ev-friendbday",  title:"יום הולדת חבר הכי טוב",              date:"2026-07-22", tz:"Europe/Prague",  type:"landmark",       front:"personal",   note:"אולי ייקח יום — תכנן ארוז סביב זה.",                                         reminders:["T-7d","T-1d"],                                     source:"seed" },
  { id:"ev-lease",       title:"חוזה פראג מסתיים — להיות מחוץ לדירה", date:"2026-07-31", tz:"Europe/Prague", type:"deadline",       front:"july-move",  note:"דד-ליין קשיח. חוזות בוטלו, ארוז, נשלח/תרם.",                                reminders:["T-14d","T-7d","T-3d","T-1d","T-0@08:00"],          source:"seed" },
  { id:"ev-aims-bizplan",title:"אירוע תכנון עסקי AIMS",               date:"2026-08-03", tz:"Asia/Jerusalem", type:"event",          front:"aims",       note:"צריך פגישות הכנה לפני. עשה עבודת AIMS בבקרים.",                             reminders:["T-14d","T-7d","T-1d","T-0@08:00"],                 source:"seed" },
  { id:"ev-aims-panel",  title:"פאנל + נאום AIMS",                    date:"2026-08-05", tz:"Asia/Jerusalem", type:"event",          front:"aims",       note:"נהל פאנל + תן נאום. טייט נאום מראש.",                                       reminders:["T-14d","T-7d","T-1d","T-0@08:00"],                 source:"seed" },
  { id:"ev-vacation",    title:"חופשה עם חברים",                      date:"2026-08-14", endDate:"2026-08-15", tz:"Asia/Jerusalem", type:"landmark",      front:"personal",   note:"זמן חופש מוגן.",                                                              reminders:["T-7d","T-1d"],                                     source:"seed" },
  { id:"ev-block",       title:"תחילת בלוק Step 1 ייעודי",            date:"2026-08-16", tz:"Asia/Jerusalem", type:"landmark",       front:"step1",      note:"לחץ 'Reset to test date' היום. 12 שעות/יום, 7 ימים, חצי יום קל בשבוע.",  reminders:["T-7d","T-1d","T-0@08:30"],                         source:"seed" },
  { id:"ev-flathunt",    title:"חלון חיפוש דירה נפתח",               date:"2026-09-01", tz:"Asia/Jerusalem", type:"landmark",       front:"sept-move",  note:"הסתמך על משפחה בישראל. עשה את המעבר בתחילת ספטמבר.",                       reminders:["T-7d","T-0@09:00"],                                source:"seed" },
  { id:"ev-movein",      title:"מעבר לדירה קבועה הושלם (יעד)",       date:"2026-09-10", tz:"Asia/Jerusalem", type:"deadline",       front:"sept-move",  note:"בוצע מוקדם כדי שהשבועיים-שלושה האחרונים לפני הבחינה יישארו פנויים.",     reminders:["T-14d","T-7d","T-3d","T-1d","T-0@09:00"],          source:"seed" },
  { id:"ev-bday",        title:"יום ההולדת שלי",                      date:"2026-09-13", tz:"Asia/Jerusalem", type:"landmark",       front:"personal",   note:"ניתן לדחייה אם עמוק ב-Step 1.",                                              reminders:["T-7d","T-1d"],                                     source:"seed" },
  { id:"ev-step1",       title:"USMLE Step 1 — דד-ליין קשיח",        date:"2026-10-11", tz:"Asia/Jerusalem", type:"deadline",       front:"step1",      note:"חייב לשבת לפני זה. החלף בתאריך בחינה אמיתי עם ההזמנה.",                   reminders:["T-30d","T-14d","T-7d","T-3d","T-1d","T-0@07:30"],  source:"seed" },
  { id:"ev-ecfmg",       title:"אישור סגל ECFMG (בהמתנה)",           date:null,         tz:"Asia/Jerusalem", type:"blocker",        front:"step1",      note:"ממתין לאישור — אין תאריך עדיין. כשיאושר: הזמן מקום בתל אביב.",           reminders:[],                                                  source:"seed" },
];

// ── Seed AIMS tasks ───────────────────────────────────────────────────────
export const SEED_AIMS_TASKS = [
  { id:"aims-prep",   title:"תאם פגישות הכנה לאירוע תכנון עסקי 3 אוג'", urgency:"High",   deadline:"2026-07-20", tz:"Asia/Jerusalem", people:[{name:"AIMS board",role:"co-organizers",contact:""}], status:"Active", notes:"הזמן פגישות הכנה ביולי כדי ש-3 אוג' לא יהיה כאוטי.", addToTimeline:true,  category:"aims" },
  { id:"aims-speech", title:"טייט + חזור על נאום 5 אוג'",                urgency:"High",   deadline:"2026-08-01", tz:"Asia/Jerusalem", people:[],                                                     status:"Active", notes:"תכנן מוקדם; חזור בקול.",                               addToTimeline:true,  category:"aims" },
  { id:"aims-panel",  title:"נעל לוגיסטיקת פאנל 5 אוג'",                urgency:"Medium", deadline:"2026-08-01", tz:"Asia/Jerusalem", people:[{name:"Panelists",role:"speakers",contact:""}],        status:"Active", notes:"אשר פאנליסטים, חדר, סדר הפעולות.",                     addToTimeline:true,  category:"aims" },
  { id:"aims-weekly", title:"פגישות שבועיות / אישורים / אימיילים",       urgency:"Medium", deadline:null,         tz:"Asia/Jerusalem", people:[],                                                     status:"Active", notes:"חוזר ~2-5 שעות/שבוע. מרכז בבקרים. אין למי להאציל.",    addToTimeline:false, category:"aims", recurring:"weekly" },
  { id:"aims-conf",   title:"תכנון ועידה",                               urgency:"Medium", deadline:null,         tz:"Asia/Jerusalem", people:[],                                                     status:"Active", notes:"מתמשך.",                                                addToTimeline:false, category:"aims" },
];

// ── Storage keys ──────────────────────────────────────────────────────────
const TL_KEY     = "usmle-app:tl-events-v2";
const AIMS_KEY   = "usmle-app:aims-tasks-v2";
const REM_KEY    = "usmle-app:reminder-state-v1";
const GOALS_KEY  = "usmle-app:goals-done-v1";

export function loadTimelineEvents() {
  try {
    const raw = localStorage.getItem(TL_KEY);
    if (raw !== null) return JSON.parse(raw);
    localStorage.setItem(TL_KEY, JSON.stringify(SEED_TL_EVENTS));
    return SEED_TL_EVENTS;
  } catch { return SEED_TL_EVENTS; }
}
export function saveTimelineEvents(evs) { localStorage.setItem(TL_KEY, JSON.stringify(evs)); }

export function loadAimsTasks() {
  try {
    const raw = localStorage.getItem(AIMS_KEY);
    if (raw !== null) return JSON.parse(raw);
    localStorage.setItem(AIMS_KEY, JSON.stringify(SEED_AIMS_TASKS));
    return SEED_AIMS_TASKS;
  } catch { return SEED_AIMS_TASKS; }
}
export function saveAimsTasks(tasks) { localStorage.setItem(AIMS_KEY, JSON.stringify(tasks)); }

export function loadReminderState() {
  try { return JSON.parse(localStorage.getItem(REM_KEY)) || { dismissed: [], snoozedUntil: {} }; }
  catch { return { dismissed: [], snoozedUntil: {} }; }
}
export function saveReminderState(s) { localStorage.setItem(REM_KEY, JSON.stringify(s)); }

export function loadGoalsDone() {
  try { return JSON.parse(localStorage.getItem(GOALS_KEY)) || {}; }
  catch { return {}; }
}
export function saveGoalsDone(done) { localStorage.setItem(GOALS_KEY, JSON.stringify(done)); }
