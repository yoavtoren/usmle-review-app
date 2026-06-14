import { useNavigate } from "react-router-dom";
import { PHASES } from "../lib/timelineData.js";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import { loadMedSchool } from "../lib/medSchoolData.js";
import {
  IconDash, IconCalendar, IconTarget, IconPulse, IconHeart, IconCap,
  IconArrow, IconFlame, IconClock, IconSparkle, IconCheck,
} from "./icons.jsx";

const EXAM_DATE = new Date("2026-10-11T00:00:00Z");
const JOURNEY_START = new Date("2026-06-10T00:00:00Z");

function daysUntilExam() {
  return Math.ceil((EXAM_DATE - new Date()) / 86400000);
}

function currentPhase() {
  const t = new Date().toISOString().slice(0, 10);
  return PHASES.find((p) => t >= p.start && t <= p.end) || null;
}

function taskStats(categoryId) {
  try {
    const tasks = loadCategoryTasks(categoryId);
    const today = new Date().toISOString().slice(0, 10);
    return {
      active: tasks.filter((t) => t.status === "Active").length,
      overdue: tasks.filter((t) => t.status === "Active" && t.deadline && t.deadline < today).length,
    };
  } catch {
    return { active: 0, overdue: 0 };
  }
}

export default function HomePage({ testStats, faStats, streak }) {
  const nav = useNavigate();
  const days = daysUntilExam();
  const phase = currentPhase();
  const testPct = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;
  const faPct = faStats.total > 0 ? Math.round((faStats.seen / faStats.total) * 100) : 0;

  const aims = taskStats("aims");
  const medcross = taskStats("medcross");
  const selfcare = taskStats("selfcare");

  const msSubjects = (() => {
    try {
      const all = loadMedSchool();
      const y4 = all.filter((s) => s.year === 4);
      const notesCount = y4.filter((s) => s.notes?.trim()).length;
      return { total: y4.length, notesCount };
    } catch {
      return { total: 0, notesCount: 0 };
    }
  })();

  // Journey progress (days elapsed of the total run to exam)
  const totalSpan = Math.max(1, Math.round((EXAM_DATE - JOURNEY_START) / 86400000));
  const elapsed = Math.max(0, Math.min(totalSpan, Math.round((new Date() - JOURNEY_START) / 86400000)));
  const journeyPct = Math.round((elapsed / totalSpan) * 100);

  // Secondary section cards (the featured Step 1 panel is rendered separately)
  const sections = [
    {
      id: "timeline", to: "/timeline", Icon: IconCalendar, title: "ציר זמן",
      tint: "#0E7C86", tint2: "#14A0AD",
      stats: phase
        ? [{ val: phase.name, lbl: "שלב נוכחי" }, { val: days > 0 ? days : "—", lbl: "ימים" }]
        : [{ val: days > 0 ? days : "—", lbl: "ימים לבחינה" }],
    },
    {
      id: "medschool", to: "/medschool", Icon: IconCap, title: "Med School",
      tint: "#4F46E5", tint2: "#6D5DF0",
      stats: [
        { val: msSubjects.total, lbl: "נושאים" },
        { val: msSubjects.notesCount, lbl: "עם הערות" },
      ],
    },
    {
      id: "aims", to: "/aims", Icon: IconTarget, title: "AIMS",
      tint: "#6D4AC2", tint2: "#8A66E0",
      stats: [
        { val: aims.active, lbl: "מטלות" },
        ...(aims.overdue > 0 ? [{ val: aims.overdue, lbl: "באיחור", alert: true }] : []),
      ],
    },
    {
      id: "medcross", to: "/medcross", Icon: IconPulse, title: "MedCross",
      tint: "#C2185B", tint2: "#E84393",
      stats: [
        { val: medcross.active, lbl: "מטלות" },
        ...(medcross.overdue > 0 ? [{ val: medcross.overdue, lbl: "באיחור", alert: true }] : []),
      ],
    },
    {
      id: "selfcare", to: "/selfcare", Icon: IconHeart, title: "טיפול עצמי",
      tint: "#1F7A52", tint2: "#2EA372",
      stats: [
        { val: selfcare.active, lbl: "מטלות" },
        { val: faPct + "%", lbl: "FA" },
      ],
    },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "לילה טוב";
    if (h < 12) return "בוקר טוב";
    if (h < 18) return "צהריים טובים";
    return "ערב טוב";
  })();
  const dateStr = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  const examStr = EXAM_DATE.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="home">
      <div className="page">
        {/* ── Hero: editorial text + countdown showcase ── */}
        <header className="home-hero3">
          <div className="home-hero3-text">
            <p className="home-eyebrow">{dateStr}</p>
            <h1 className="home-h1">{greeting}, יואב</h1>
            <p className="home-lede">
              {days > 0
                ? <>נותרו <em>{days}</em> ימים ל‑Step 1. {phase ? `אתה ב${phase.name}.` : ""}</>
                : "המסע נמשך — צעד אחד היום."}
            </p>
            <div className="home-hero3-pills">
              {streak > 0 && (
                <div className="home-pill"><IconFlame size={15} /> רצף {streak} ימים</div>
              )}
              {testStats.due > 0 && (
                <div className="home-pill accent"><IconClock size={15} /> {testStats.due} לביקורת היום</div>
              )}
              {phase && (
                <div className="home-pill"><IconSparkle size={15} /> {phase.name}</div>
              )}
            </div>
          </div>

          {/* Countdown showcase card */}
          <div className="home-count">
            <div className="home-count-glow" />
            <span className="home-count-kicker">USMLE STEP 1</span>
            <div className="home-count-num">{days > 0 ? days : 0}</div>
            <span className="home-count-unit">ימים לבחינה</span>
            <span className="home-count-date">{examStr}</span>
            <div className="home-count-track">
              <div className="home-count-fill" style={{ width: `${journeyPct}%` }} />
            </div>
            <span className="home-count-prog">{journeyPct}% מהמסע הושלם</span>
          </div>
        </header>

        {/* ── Featured Step 1 panel ── */}
        <button className="home-feature2" onClick={() => nav("/step1")}>
          <div className="home-feature2-bg" />
          <div className="home-feature2-main">
            <div className="home-feature2-head">
              <span className="home-feature2-ico"><IconDash size={22} /></span>
              <span className="home-feature2-kicker">המוקד</span>
            </div>
            <h2 className="home-feature2-title">USMLE Step 1</h2>
            <p className="home-feature2-sub">בקרת שאלות · חזרה מרווחת · כיסוי First Aid</p>
            <div className="home-feature2-stats">
              <div className="home-fstat2">
                <span className="home-fstat2-num">{testStats.due}</span>
                <span className="home-fstat2-lbl">לביקורת היום</span>
              </div>
              <div className="home-fstat2-sep" />
              <div className="home-fstat2">
                <span className="home-fstat2-num">{testStats.mastered}</span>
                <span className="home-fstat2-lbl">שלטתי</span>
              </div>
              <div className="home-fstat2-sep" />
              <div className="home-fstat2">
                <span className="home-fstat2-num">{testPct}%</span>
                <span className="home-fstat2-lbl">כיסוי</span>
              </div>
            </div>
          </div>
          <div className="home-feature2-side">
            <Ring pct={testPct} />
            <span className="home-feature2-cta">פתח לוח <IconArrow size={15} /></span>
          </div>
        </button>

        {/* ── Section header ── */}
        <div className="home-sec-label">
          <span>הזירות שלך</span>
          <span className="home-sec-line" />
        </div>

        {/* ── Section grid ── */}
        <div className="home-grid3">
          {sections.map((s) => {
            const { Icon } = s;
            return (
              <button
                key={s.id}
                className="home-card3"
                onClick={() => nav(s.to)}
                style={{ "--tint": s.tint, "--tint2": s.tint2 }}
              >
                <div className="home-card3-accent" />
                <div className="home-card3-top">
                  <span className="home-card3-ico"><Icon size={19} /></span>
                  <span className="home-card3-arr"><IconArrow size={16} /></span>
                </div>
                <span className="home-card3-title">{s.title}</span>
                <div className="home-card3-stats">
                  {s.stats.map((st, i) => (
                    <div key={i} className={`home-card3-stat${st.alert ? " alert" : ""}`}>
                      <span className="home-card3-val">{st.val}</span>
                      <span className="home-card3-lbl">{st.lbl}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Progress ring (used in featured panel)
function Ring({ pct }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="home-ring2">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="7" />
        <circle
          cx="46" cy="46" r={r} fill="none" stroke="#fff" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 46 46)" style={{ transition: "stroke-dashoffset 0.9s var(--ease-out)" }}
        />
      </svg>
      <span className="home-ring2-pct">{pct}%</span>
    </div>
  );
}
