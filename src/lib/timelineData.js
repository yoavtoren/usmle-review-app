// ── Palette + maps ────────────────────────────────────────────────────────
export const FRONT_COLORS = {
  "step1":        "#4f46e5",
  "ent":          "#0d9488",
  "july-move":    "#d97706",
  "sept-move":    "#ea580c",
  "aims":         "#7c3aed",
  "medcross":     "#db2777",
  "relationship": "#16a34a",
  "personal":     "#475569",
};

export const FRONT_LABELS = {
  "step1":        "Step 1",
  "ent":          "ENT",
  "july-move":    "Prague Move",
  "sept-move":    "Israel Move",
  "aims":         "AIMS",
  "medcross":     "MedCross",
  "relationship": "Relationship",
  "personal":     "Personal",
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
  { id:"ph1", name:"Launch",            start:"2026-06-10", end:"2026-06-12", color:"#475569", note:"Sell-off groundwork; set contract end-dates; watch flights; ECFMG with faculty." },
  { id:"ph2", name:"ENT + sell-off",    start:"2026-06-13", end:"2026-06-22", color:"#0d9488", note:"Light ENT oral prep with Angela; keep selling/packing; exam 22 Jun." },
  { id:"ph3", name:"Move out (Prague)", start:"2026-06-23", end:"2026-07-31", color:"#d97706", note:"Pack, sell, cancel contracts, book + take flight; lease ends ~31 Jul." },
  { id:"ph4", name:"Land & settle",     start:"2026-08-01", end:"2026-08-15", color:"#ea580c", note:"Arrive; AIMS peak (3+5 Aug); vacation 14–15 Aug; restart light study." },
  { id:"ph5", name:"Step 1 push",       start:"2026-08-16", end:"2026-10-11", color:"#4f46e5", note:"Dedicated block 12h/day, 1 lighter half-day/wk; Sept permanent move early; exam before 11 Oct." },
];

// ── Goals ─────────────────────────────────────────────────────────────────
export const GOALS = [
  { id:"g1", label:"Step 1: a confident pass",                                     front:"step1" },
  { id:"g2", label:"Move done smoothly; good permanent flat",                      front:"sept-move" },
  { id:"g3", label:"Angela satisfied and supported",                               front:"relationship" },
  { id:"g4", label:"AIMS role undamaged",                                          front:"aims" },
  { id:"g5", label:"MedCross launched — content, real followers, first revenue",   front:"medcross" },
  { id:"g6", label:"Feel strong and look good",                                    front:"personal" },
];

// ── Seed timeline events ──────────────────────────────────────────────────
export const SEED_TL_EVENTS = [
  { id:"ev-sell",       title:"Start selling furniture",           date:"2026-06-10", tz:"Europe/Prague",  type:"landmark",       front:"july-move",   note:"The dreaded task — list one item to break the seal.",                          reminders:["T-0@09:00"],                                       source:"seed" },
  { id:"ev-contracts",  title:"Set internet + phone end-dates",    date:"2026-06-12", tz:"Europe/Prague",  type:"deadline",       front:"july-move",   note:"Check notice periods first.",                                                  reminders:["T-1d","T-0@09:00"],                                source:"seed" },
  { id:"ev-ent",        title:"ENT oral final",                    date:"2026-06-22", tz:"Europe/Prague",  type:"deadline",       front:"ent",          note:"Oral exam. Rehearse out loud with Angela. Keep prep light.",                   reminders:["T-14d","T-7d","T-3d","T-1d","T-0@08:00"],          source:"seed" },
  { id:"ev-flight",     title:"Book flight Prague→Israel",         date:"2026-06-30", tz:"Europe/Prague",  type:"task-deadline",  front:"july-move",   note:"Soft deadline — book early in the move-out phase.",                            reminders:["T-3d","T-1d","T-0@09:00"],                         source:"seed" },
  { id:"ev-friendbday", title:"Best friend's birthday",            date:"2026-07-22", tz:"Europe/Prague",  type:"landmark",       front:"personal",     note:"May take a day — plan packing around it.",                                    reminders:["T-7d","T-1d"],                                     source:"seed" },
  { id:"ev-lease",      title:"Prague lease ends — be moved out",  date:"2026-07-31", tz:"Europe/Prague",  type:"deadline",       front:"july-move",   note:"HARD deadline. Contracts cancelled, packed, shipped/donated.",                 reminders:["T-14d","T-7d","T-3d","T-1d","T-0@08:00"],          source:"seed" },
  { id:"ev-aims-bizplan",title:"AIMS business-planning event",     date:"2026-08-03", tz:"Asia/Jerusalem", type:"event",          front:"aims",         note:"Needs prep meetings beforehand. Do AIMS work in mornings.",                   reminders:["T-14d","T-7d","T-1d","T-0@08:00"],                 source:"seed" },
  { id:"ev-aims-panel", title:"AIMS panel + speech",               date:"2026-08-05", tz:"Asia/Jerusalem", type:"event",          front:"aims",         note:"Manage a panel + give a speech. Draft speech in advance.",                    reminders:["T-14d","T-7d","T-1d","T-0@08:00"],                 source:"seed" },
  { id:"ev-vacation",   title:"Vacation with friends",             date:"2026-08-14", endDate:"2026-08-15", tz:"Asia/Jerusalem", type:"landmark",       front:"personal",     note:"Protected time off.",                                                          reminders:["T-7d","T-1d"],                                     source:"seed" },
  { id:"ev-block",      title:"Dedicated Step 1 block begins",     date:"2026-08-16", tz:"Asia/Jerusalem", type:"landmark",       front:"step1",        note:"Press 'Reset to test date' today. 12h/day, 7 days, one lighter half-day/wk.", reminders:["T-7d","T-1d","T-0@08:30"],                         source:"seed" },
  { id:"ev-flathunt",   title:"Apartment hunt window opens",       date:"2026-09-01", tz:"Asia/Jerusalem", type:"landmark",       front:"sept-move",    note:"Lean on family in Israel. Do the move EARLY in September.",                   reminders:["T-7d","T-0@09:00"],                                source:"seed" },
  { id:"ev-movein",     title:"Permanent flat move done (target)", date:"2026-09-10", tz:"Asia/Jerusalem", type:"deadline",       front:"sept-move",    note:"Done early so last 2–3 weeks before exam stay clear.",                        reminders:["T-14d","T-7d","T-3d","T-1d","T-0@09:00"],          source:"seed" },
  { id:"ev-bday",       title:"My birthday",                       date:"2026-09-13", tz:"Asia/Jerusalem", type:"landmark",       front:"personal",     note:"Postponable if deep in Step 1.",                                               reminders:["T-7d","T-1d"],                                     source:"seed" },
  { id:"ev-step1",      title:"USMLE Step 1 — hard deadline",      date:"2026-10-11", tz:"Asia/Jerusalem", type:"deadline",       front:"step1",        note:"Must sit BEFORE this. Replace with real test date once booked.",              reminders:["T-30d","T-14d","T-7d","T-3d","T-1d","T-0@07:30"],  source:"seed" },
  { id:"ev-ecfmg",      title:"ECFMG faculty approval (pending)",  date:null,         tz:"Asia/Jerusalem", type:"blocker",        front:"step1",        note:"Awaiting approval — no date yet. WHEN CLEARED: book Tel Aviv seat.",          reminders:[],                                                  source:"seed" },
];

// ── Seed AIMS tasks ───────────────────────────────────────────────────────
export const SEED_AIMS_TASKS = [
  { id:"aims-prep",   title:"Schedule prep meetings for 3 Aug business-planning event", urgency:"High",   deadline:"2026-07-20", tz:"Asia/Jerusalem", people:[{name:"AIMS board",role:"co-organizers",contact:""}], status:"Active", notes:"Book the prep meetings in July so 3 Aug isn't chaotic.",  addToTimeline:true  },
  { id:"aims-speech", title:"Draft + rehearse 5 Aug speech",                            urgency:"High",   deadline:"2026-08-01", tz:"Asia/Jerusalem", people:[],                                                     status:"Active", notes:"Outline early; rehearse out loud.",                        addToTimeline:true  },
  { id:"aims-panel",  title:"Lock 5 Aug panel logistics",                               urgency:"Medium", deadline:"2026-08-01", tz:"Asia/Jerusalem", people:[{name:"Panelists",role:"speakers",contact:""}],        status:"Active", notes:"Confirm panelists, room, running order.",                  addToTimeline:true  },
  { id:"aims-weekly", title:"Weekly meetings / approvals / emails",                     urgency:"Medium", deadline:null,         tz:"Asia/Jerusalem", people:[],                                                     status:"Active", notes:"Recurring ~2–5 h/week. Batch in mornings. No one to delegate to.", addToTimeline:false },
  { id:"aims-conf",   title:"Conference planning",                                      urgency:"Medium", deadline:null,         tz:"Asia/Jerusalem", people:[],                                                     status:"Active", notes:"Ongoing.",                                             addToTimeline:false },
];

// ── Storage keys ──────────────────────────────────────────────────────────
const TL_KEY     = "usmle-app:tl-events-v1";
const AIMS_KEY   = "usmle-app:aims-tasks-v1";
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
