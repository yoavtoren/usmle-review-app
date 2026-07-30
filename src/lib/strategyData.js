// Step 1 strategy overhaul (22 July 2026 brief) as data.
// The plan itself — zones, the 4-pass loop, Anki selection rules, the weak-first
// block sequence, the assessment arc and the daily templates — lives here so the
// Strategy page renders it and other screens (Planner, Home) can read the same
// dates. Every date is a local ISO string; helpers below resolve "where am I
// today" without duplicating date math in components.

import { localISODate, startOfLocalDay } from "./config.js";

const DAY_MS = 86_400_000;

// The booked sit date — Tuesday 6 Oct 2026, same as EXAM_DATE (config.js).
// One fixed date, no window and no hard cap: the taper is built backward from it.
export const TARGET_SIT_ISO = "2026-10-06";
export const PLAN_ANCHOR_ISO = "2026-07-30"; // the day this plan was last revised

export function daysFromToday(iso, now = new Date()) {
  return Math.round((new Date(iso + "T00:00:00") - startOfLocalDay(now)) / DAY_MS);
}

/* ── The three zones ────────────────────────────────────────────────────── */

export const ZONES = [
  {
    id: "D",
    name: "Drill — full focus",
    from: "2026-07-22", to: "2026-09-26",
    headline: "Nothing but Step 1 from here to the exam. Weak-first, system by system.",
    hours: "10–12 h/day, 7 days · the ONLY exception: half days 2–5 Aug",
    doing: [
      "Open by killing the two smallest avoided subjects: Biostatistics (Randy Neil) + Behavioral/Ethics (Mehlman).",
      "Daily UWorld — full blocks, on pace to finish the Qbank by 26 Sept.",
      "2–5 Aug: half days (CEO event 3 Aug, panel + speech 5 Aug). Mornings still belong to Step 1.",
      "Diagnostic NBME ~11–13 Aug — sets the real baseline and re-sorts the block order.",
      "Weak-first sequence (below), each organ system paired with its own pharmacology; 20–30% interleaved mixed UWorld daily.",
      "NBME every ~10–12 days; each form's weak-5 becomes the next block's interleaved focus.",
      "Content DONE by 26 Sept — the taper owns the final stretch to the exam.",
    ],
    dropping: ["Everything that isn't the exam", "MedCross (paused)", "CEO beyond the 2–5 Aug peak", "Flat hunt (parents own it)", "New time on green systems"],
  },
  {
    id: "T",
    name: "Taper & sit",
    from: "2026-09-27", to: "2026-10-06",
    headline: "Free 120 + newest NBME + error-log review. No new material in the last 5 days.",
    hours: "taper",
    doing: [
      "Exam day: Tuesday 6 Oct — booked and fixed.",
      "Sleep, error log, weak-tag Anki only.",
    ],
    dropping: ["All new material"],
  },
];

export function currentZone(todayISO = localISODate()) {
  return ZONES.find((z) => todayISO >= z.from && todayISO <= z.to)
    || (todayISO < ZONES[0].from ? ZONES[0] : ZONES[ZONES.length - 1]);
}

/* ── The 4-pass loop — one topic block = ½ a system or one subject chunk ── */

export const LOOP = [
  {
    n: 1, key: "learn", emoji: "📘", title: "LEARN",
    tag: "~45–75 min",
    lead: "Just enough input to make the questions make sense.",
    points: [
      "One concept source, once: Pathoma (path) · Sketchy (micro, pharm) · Pixorize (biochem, immuno) · B&B or Bootcamp (physiology + mechanisms) · Randy Neil or Mehlman (biostats, ethics).",
      "Then the matching First Aid pages — not passive. Read a subsection, look away, say it out loud as real biology, then check.",
      "Input is the setup, never the main event. If a video bores you within 5 min, skip to the questions — they will re-teach it.",
    ],
  },
  {
    n: 2, key: "practice", emoji: "🎯", title: "PRACTICE",
    tag: "20–40 Q",
    lead: "The honest test — and your strength.",
    points: [
      "UWorld block filtered to that exact topic, immediately after the LEARN pass.",
      "Tutor mode, untimed until you're ~65%+ in that system, then timed.",
      "Read every explanation — including the ones you got right. The explanation is the lesson.",
      "Import each missed/shaky question into the tutor widget for the mechanism breakdown.",
    ],
  },
  {
    n: 3, key: "encode", emoji: "🧷", title: "ENCODE",
    tag: "every miss",
    lead: "Turn every miss into durable memory. This is the step that was missing.",
    points: [
      "For each miss AND each \"right but unsure\", do exactly one: unsuspend the matching AnKing card(s) — primary; or annotate First Aid with one margin line in your own words; or (only if no card exists and it's clearly high-yield) make one cloze card — hard cap ~5 self-made/day.",
      "Log one line in the error log: topic · why you missed it · fix.",
      "The \"why\" column is what you mine before each NBME.",
    ],
  },
  {
    n: 4, key: "space", emoji: "🔁", title: "SPACE",
    tag: "≤ 4 h/day total",
    lead: "The retention engine — daily Anki.",
    points: [
      "Do all due AnKing reviews for everything unsuspended so far.",
      "Order: reviews first, then new until the timer hits 4 h, then stop.",
      "Reviews ~2–2.5 h in the morning, new ~1–1.5 h in the afternoon.",
    ],
  },
];

/* ── How to pick Anki cards — the answer to "I don't know what to pick" ── */

export const ANKI_RULES = [
  {
    n: 1, title: "Unsuspend by the system you're studying this week",
    body: "Browse → search the AnKing tag tree for this week's topic (e.g. tag:#AK_Step1_v12::#B&B::05_Cardiovascular, or ...::Pharmacology::Autonomics) → select all → right-click → Unsuspend. Only that system's cards enter reviews.",
    note: "Confirm the literal version prefix (v12 / v13) once in your own Browse tag tree.",
  },
  {
    n: 2, title: "Unsuspend by the question you just missed",
    body: "AnKing cards carry First-Aid-page and topic tags. On a UWorld miss, search Browse for the keyword or FA page and unsuspend just those 1–3 cards.",
    note: "This is literally \"high-yield, very specific things\" — the deck becomes a mirror of your own gaps.",
  },
];

export const ANKI_MATH = {
  headline: "≤ 4 h/day, always",
  points: [
    "From a near-fresh deck: ~50–80 new cards/day for the system of the week + the growing review pile stays under 4 h.",
    "If reviews alone exceed ~2.5 h → drop new cards to 30/day that week.",
    "Rescue if buried: new = 0 until the pile clears; suspend leeches; a card failed 8× → read the FA line and re-learn it, or suspend it. Don't grind.",
    "Never let Anki eat the UWorld / LEARN window.",
  ],
};

export const RESOURCE_MAP = [
  { subject: "Pharm (general + autonomics)", learn: "B&B / Bootcamp", boost: "Sketchy Pharm", questions: "UWorld pharm filter" },
  { subject: "Biochem / metabolism", learn: "B&B", boost: "Pixorize", questions: "UWorld biochem" },
  { subject: "Immunology", learn: "B&B / Pathoma", boost: "Pixorize", questions: "UWorld immuno" },
  { subject: "Micro", learn: "(maintain only)", boost: "Sketchy Micro", questions: "interleaved" },
  { subject: "Path (all systems)", learn: "Pathoma", boost: "—", questions: "UWorld system filter" },
  { subject: "Biostats / epi", learn: "Randy Neil", boost: "Mehlman biostats", questions: "UWorld biostats" },
  { subject: "Behavioral / ethics", learn: "Mehlman", boost: "—", questions: "UWorld behavioral" },
  { subject: "Physiology / mechanisms", learn: "B&B / Bootcamp", boost: "—", questions: "UWorld system filter" },
];

export const GUARDRAILS = [
  {
    title: "FOMO trap",
    body: "No new time on green systems (micro, derm, ID, anatomy). Maintenance = Anki reviews + a few interleaved questions. New hours go to red.",
  },
  {
    title: "\"Performing knowledge\" trap",
    body: "The UWorld % and the NBME are the honest test — not how fluent the teach-back felt.",
  },
];

export const TEACH_BACK = {
  title: "Teach-back to Angela",
  body: "After a topic block, explain the mechanism out loud to Angela (or a voice memo) as real biology. Retrieval practice + your best modality + couple time in one. ~3×/week inside the dedicated block.",
};

export const WHAT_TO_DROP = [
  { front: "MedCross", call: "Paused until after Step 1 — the sacrificial front. No content, no dev." },
  { front: "CEO", call: "Contained to the 2–5 Aug half-day peak, then mornings, ~2–5 h/week. Maintenance." },
  { front: "Flat hunt", call: "Fully delegated to parents — zero attention until after the exam." },
  { front: "Green subjects", call: "Micro / derm / ID / anatomy — maintenance only." },
  { front: "Collisions", call: "The exam wins. Everything else yields." },
];

/* ── Weak-first block sequence (§5) ─────────────────────────────────────── */

export const BLOCKS = [
  {
    id: "pre", label: "Pre", from: "2026-07-22", to: "2026-08-15",
    primary: "Biostats (Randy Neil) + Behavioral/Ethics (Mehlman)",
    why: "Smallest, most-avoided, lowest % — kill them before the dedicated block",
    assessment: "Diagnostic NBME ~11–13 Aug",
    filters: ["Biostatistics & Epidemiology", "Social Sciences (Ethics/Legal/Professional)", "Psychiatric/Behavioral"],
    anki: "Unsuspend the biostats + behavioral/ethics tags only",
    teachBack: "Study design & bias · confidentiality vs. duty to warn",
    collision: "CEO peak — 2–5 Aug are half days (mornings = Step 1, afternoons = CEO).",
  },
  {
    id: "w1", label: "Week 1", from: "2026-08-16", to: "2026-08-22",
    primary: "Pharmacology general principles + autonomics · Biochemistry (metabolism, molecular)",
    why: "Pharm 39% (64 Q) + Biochem 29% — the biggest avoided levers",
    assessment: null,
    filters: ["Pharmacology (General Principles)", "Biochemistry (General Principles)"],
    anki: "Pharmacology::Autonomics + Biochemistry tag subtrees",
    teachBack: "Receptor classes & second messengers · glycolysis regulation",
    collision: null,
  },
  {
    id: "w2", label: "Week 2", from: "2026-08-23", to: "2026-08-29",
    primary: "Immunology + Heme/Onc (+ heme pharm: anticoagulants, chemo)",
    why: "Immuno 40%; Heme/Onc 23% = your lowest system",
    assessment: "NBME #2 ~29 Aug",
    filters: ["Allergy & Immunology", "Hematology & Oncology"],
    anki: "Immunology + Heme/Onc subtrees + anticoagulant/chemo pharm cards",
    teachBack: "Hypersensitivity types · the coagulation cascade as real chemistry",
    collision: null,
  },
  {
    id: "w3", label: "Week 3", from: "2026-08-30", to: "2026-09-05",
    primary: "Cardiovascular (+ CV pharm)",
    why: "CV 42%, 42 Q, high-yield backbone",
    assessment: null,
    filters: ["Cardiovascular System"],
    anki: "Cardiovascular subtree + antihypertensives/antiarrhythmics",
    teachBack: "Pressure–volume loops · why each antihypertensive class works",
    collision: null,
  },
  {
    id: "w4", label: "Week 4", from: "2026-09-06", to: "2026-09-12",
    primary: "Pulmonary + Renal (+ their pharm)",
    why: "Pulm 36%, Renal 49%",
    assessment: "NBME #3 ~12 Sep",
    filters: ["Pulmonary & Critical Care", "Renal, Urinary Systems & Electrolytes"],
    anki: "Respiratory + Renal subtrees + diuretics",
    teachBack: "V/Q mismatch · where each diuretic acts along the nephron",
    collision: null,
  },
  {
    id: "w5", label: "Week 5", from: "2026-09-13", to: "2026-09-19",
    primary: "Endocrine + GI + Repro/Pregnancy (+ pharm)",
    why: "Endo 35%; GI / Repro yellow",
    assessment: null,
    filters: ["Endocrine, Diabetes & Metabolism", "Gastrointestinal & Nutrition", "Female Reproductive System & Breast"],
    anki: "Endocrine + GI + Repro subtrees",
    teachBack: "Feedback loops on each axis · the menstrual cycle hormone by hormone",
    collision: null,
  },
  {
    id: "w6", label: "Week 6", from: "2026-09-20", to: "2026-09-26",
    primary: "Neuro (biggest, 55 Q) + Psych (+ psych pharm) + MSK/Rheum",
    why: "Neuro 49%, Psych 23%",
    assessment: "NBME #4 / UWSA2 ~26 Sep",
    filters: ["Nervous System", "Psychiatric/Behavioral & Substance Use Disorder", "Rheumatology/Orthopedics & Sports"],
    anki: "Neuro + Psych + MSK subtrees + antipsychotics/antidepressants",
    teachBack: "Tract lesions by level · mechanism of each psych drug class",
    collision: null,
  },
  {
    id: "w7", label: "Week 7 / taper", from: "2026-09-27", to: "2026-10-05",
    primary: "Free 120 + mixed timed sets + error-log review + weak-tag Anki",
    why: "Readiness + consolidation",
    assessment: "Free 120 ~1–2 Oct",
    filters: ["Mixed / random, timed"],
    anki: "Reviews only — no new cards",
    teachBack: "Whatever the error log says you keep missing",
    collision: "No new material in the last 5 days.",
  },
  {
    id: "exam", label: "Exam", from: "2026-10-06", to: "2026-10-06",
    primary: "Sit Step 1 — Tuesday 6 Oct",
    why: "",
    assessment: null,
    filters: [],
    anki: "Light reviews or nothing",
    teachBack: "",
    collision: null,
  },
];

// Green systems get no dedicated week — Anki reviews + interleaved Q only.
export const MAINTAIN_ONLY = ["Microbiology", "Dermatology", "Infectious Diseases", "ENT", "Anatomy", "Allergy & Immunology"];

export function currentBlock(todayISO = localISODate()) {
  return BLOCKS.find((b) => todayISO >= b.from && todayISO <= b.to) || null;
}

/* ── Assessment arc (§6) ────────────────────────────────────────────────── */

export const ASSESSMENTS = [
  { date: "2026-08-12", form: "Diagnostic — NBME 25 or UWSA1", role: "Baseline only. Don't over-read it." },
  { date: "2026-08-29", form: "NBME 27", role: "First real checkpoint of the block" },
  { date: "2026-09-12", form: "NBME 29 / 30", role: "Mid-block re-sort" },
  { date: "2026-09-26", form: "NBME 31 / UWSA2", role: "Readiness signal" },
  { date: "2026-10-01", form: "Free 120", role: "The single most predictive readiness check" },
];

export const GO_NO_GO =
  "The date is booked: Tuesday 6 Oct. The go/no-go question is no longer WHEN to sit — it's WHAT the taper drills. "
  + "If the last two assessments + the Free 120 clear the passing threshold with margin → taper as planned. "
  + "If not → the taper becomes 100% error-log + weak-tag work on the forms' worst categories. Step 1 is pass/fail: aim for a clear margin over passing, not a number. "
  + "Take every form timed, in one sitting, in the morning. Log each one, and let its top-5 weak categories become the next block's interleaved focus.";

/* ── Daily templates (§7) ───────────────────────────────────────────────── */

export const DAY_BLOCK = {
  id: "block", title: "Block day (Zone C)",
  sub: "Built around your circadian pattern on purpose — morning is low-focus-safe, 13:30–17:00 is the money window.",
  rows: [
    { time: "08:30", what: "Wake · one heaped spoon instant coffee (empty stomach — not hungry till noon)" },
    { time: "09:00–11:30", what: "Low-focus-safe: Anki reviews (~2–2.5 h) + one LEARN video (Sketchy/Pixorize/Pathoma). Never heavy memorization here.", kind: "anki" },
    { time: "~12:00", what: "MAIN MEAL (midday), after the nausea clears + a real break", kind: "meal" },
    { time: "13:30", what: "\"Begin now\" nudge → start with one easy momentum task: open UWorld, do the first 5 Q", kind: "trigger" },
    { time: "13:30–17:00", what: "PEAK: new LEARN + UWorld PRACTICE + ENCODE (unsuspend / annotate / error log)", kind: "peak" },
    { time: "~17:00", what: "Movement break, wrist-neutral: stairs, squats, forearm plank or a walk (15–20 min) · 2nd coffee 14:00–16:00", kind: "move" },
    { time: "17:30–20:30", what: "2nd focus block: more UWorld / new cards / teach-back to Angela / error-log review" },
    { time: "20:30–21:00", what: "Wind-down · lighter, earlier dinner (reflux + sleep)", kind: "meal" },
    { time: "Evening", what: "Angela phone-down time + 30–60 min self-care/shower. Teach-back can be the couple time.", kind: "angela" },
  ],
  footer: "One lighter half-day/week (Fri family/judo or Sat): reviews only, no new systems.",
};

export const DAY_HALF = {
  id: "half", title: "Half day (2–5 Aug · CEO peak)",
  sub: "The CEO front owns the afternoon — the morning still belongs to Step 1, every one of these days.",
  rows: [
    { time: "08:30", what: "Wake · coffee · straight into reviews before the day gets eaten", kind: "trigger" },
    { time: "09:00–10:30", what: "Anki: all due reviews (≤1.5 h so the pile doesn't grow)", kind: "anki" },
    { time: "10:30–12:00", what: "One UWorld set (20–40 Q) — biostats/ethics or the current weak system, tutor mode", kind: "peak" },
    { time: "~12:00", what: "MAIN MEAL midday, then hand the day to the CEO front", kind: "meal" },
    { time: "Afternoon", what: "CEO: business-planning event (3.8) / panel + speech (5.8) — planned, no guilt" },
    { time: "Evening", what: "ENCODE the morning's misses (error log + unsuspend) if energy allows · Angela phone-down time", kind: "angela" },
  ],
  footer: "Half day = the scheduler expects ~half the minutes on 2–5 Aug. No new Anki cards on these days.",
};

/* ── Deadline radar (§8.1) ──────────────────────────────────────────────── */

// `he` is the notification copy (the app's Hebrew side); `what` is the page copy.
export const RADAR = [
  { date: "2026-08-02", what: "Half days begin (2–5 Aug) — mornings are Step 1's", he: "מתחילים חצאי ימים (2–5.8) — הבקרים שייכים ל‑Step 1", front: "CEO" },
  { date: "2026-08-03", what: "CEO business-planning event (half day)", he: "אירוע תכנון עסקי (CEO) — חצי יום", front: "CEO" },
  { date: "2026-08-05", what: "CEO panel + speech (half day, last one)", he: "פאנל ונאום (CEO) — חצי יום אחרון", front: "CEO" },
  { date: "2026-08-06", what: "Back to full days — nothing but the exam from here", he: "חוזרים לימים מלאים — רק הבחינה מכאן", front: "Step 1", hot: true },
  { date: "2026-08-12", what: "Diagnostic NBME", he: "NBME אבחוני — קו הבסיס האמיתי", front: "Step 1", hot: true },
  { date: "2026-09-27", what: "Taper begins — no new material", he: "מתחיל הטייפר — בלי חומר חדש", front: "Step 1", hot: true },
  { date: "2026-10-06", what: "EXAM DAY — Step 1 (booked, fixed)", he: "יום הבחינה — Step 1 (סגור וקבוע)", front: "Step 1", hot: true },
];

/* ── The 22 Jul baseline (§1 / §8.4) ────────────────────────────────────── */

// pct = UWorld accuracy, q = questions attempted, avoided = one of the six
// subjects he has historically avoided (front-load these).
export const BASELINE = {
  asOf: "2026-07-22",
  overallPct: 53,
  subjects: [
    { name: "Pharmacology", pct: 39, q: 64, avoided: true },
    { name: "Pathophysiology", pct: 50, q: 63 },
    { name: "Pathology", pct: 50, q: 56 },
    { name: "Behavioral science", pct: 27, q: 37, avoided: true },
    { name: "Anatomy", pct: 60, q: 45 },
    { name: "Biochemistry", pct: 29, q: 24, avoided: true },
    { name: "Physiology", pct: 52, q: 35 },
    { name: "Microbiology", pct: 76, q: 50 },
    { name: "Genetics", pct: 43, q: 20 },
    { name: "Biostatistics", pct: 36, q: 12, avoided: true },
    { name: "Immunology", pct: 40, q: 11, avoided: true },
    { name: "Embryology", pct: 58, q: 12 },
    { name: "Histology", pct: 50, q: 10 },
  ],
  systems: [
    { name: "Nervous", pct: 49, q: 55 },
    { name: "Cardiovascular", pct: 42, q: 42 },
    { name: "Pulmonary", pct: 36, q: 32 },
    { name: "GI", pct: 58, q: 48 },
    { name: "Heme/Onc", pct: 23, q: 26 },
    { name: "Endocrine", pct: 35, q: 30 },
    { name: "Psych/Behavioral", pct: 23, q: 24, avoided: true },
    { name: "Social/Ethics", pct: 23, q: 19, avoided: true },
    { name: "Infectious", pct: 68, q: 36 },
    { name: "Renal", pct: 49, q: 21 },
    { name: "Rheum/MSK", pct: 45, q: 16 },
    { name: "Genetics", pct: 40, q: 14 },
    { name: "Biostats/Epi", pct: 50, q: 10 },
    { name: "Female Repro", pct: 43, q: 7 },
    { name: "Derm", pct: 73, q: 13 },
    { name: "Pregnancy", pct: 57, q: 7 },
    { name: "Ophtho", pct: 50, q: 4 },
    { name: "Allergy/Immuno", pct: 80, q: 7 },
    { name: "ENT", pct: 78, q: 5 },
    { name: "Poisoning", pct: 88, q: 5 },
    { name: "Male Repro", pct: 100, q: 3 },
  ],
};

// 🔴 <45% attack · 🟡 45–64% lift · ✅ ≥65% maintain
export function statusFor(pct) {
  if (pct == null) return { key: "none", label: "—", tone: "" };
  if (pct < 45) return { key: "attack", label: "Attack", tone: "bad" };
  if (pct < 65) return { key: "lift", label: "Lift", tone: "warn" };
  return { key: "maintain", label: "Maintain", tone: "ok" };
}

export const DIAGNOSIS = {
  problem:
    "Questions → read the explanation → move on → forget. The loop has no encoding step, so volume goes up and retention doesn't. "
    + "First Aid read passively doesn't land, and AnKing is either the whole overwhelming deck or hand-built cards that are too slow — so Anki feels like a treadmill.",
  fix:
    "One repeatable loop, run system by system, that welds learning + questions + memory together: LEARN a little → do UWorld on that exact topic → "
    + "ENCODE every miss (unsuspend the matching AnKing card + one error-log line) → SPACE it with daily reviews.",
  standing:
    "53% UWorld overall, ~700+ questions, no NBME yet. This is not a cold start — the gap is retention, not exposure. "
    + "The six avoided subjects are still the six weakest, which is the whole problem in one sentence.",
};
