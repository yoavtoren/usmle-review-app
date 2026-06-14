import { useNavigate } from "react-router-dom";
import { PHASES } from "../lib/timelineData.js";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import { loadMedSchool } from "../lib/medSchoolData.js";
import {
  IconDash, IconCalendar, IconTarget, IconPulse, IconHeart, IconCap,
  IconArrow, IconFlame, IconClock,
} from "./icons.jsx";

const EXAM_DATE = new Date("2026-10-11T00:00:00Z");

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

  // Secondary section cards (the featured Step 1 panel is rendered separately)
  const sections = [
    {
      id: "timeline", to: "/timeline", Icon: IconCalendar, title: "ציר זמן",
      stats: phase
        ? [{ val: phase.name, lbl: "שלב נוכחי" }, { val: days > 0 ? days : "—", lbl: "ימים" }]
        : [{ val: days > 0 ? days : "—", lbl: "ימים לבחינה" }],
    },
    {
      id: "medschool", to: "/medschool", Icon: IconCap, title: "Med School",
      stats: [
        { val: msSubjects.total, lbl: "נושאים" },
        { val: msSubjects.notesCount, lbl: "עם הערות" },
      ],
    },
    {
      id: "aims", to: "/aims", Icon: IconTarget, title: "AIMS",
      stats: [
        { val: aims.active, lbl: "מטלות" },
        ...(aims.overdue > 0 ? [{ val: aims.overdue, lbl: "באיחור", alert: true }] : []),
      ],
    },
    {
      id: "medcross", to: "/medcross", Icon: IconPulse, title: "MedCross",
      stats: [
        { val: medcross.active, lbl: "מטלות" },
        ...(medcross.overdue > 0 ? [{ val: medcross.overdue, lbl: "באיחור", alert: true }] : []),
      ],
    },
    {
      id: "selfcare", to: "/selfcare", Icon: IconHeart, title: "טיפול עצמי",
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

  return (
    <div className="home">
      <div className="page">
        {/* ── Hero ── */}
        <header className="home-hero2">
          <div className="home-hero2-text">
            <p className="home-eyebrow">{dateStr}</p>
            <h1 className="home-h1">{greeting}, יואב</h1>
            <p className="home-lede">
              {days > 0
                ? <>נותרו <em>{days}</em> ימים ל‑Step 1. {phase ? `אתה ב${phase.name}.` : ""}</>
                : "המסע נמשך — צעד אחד היום."}
            </p>
          </div>
          <div className="home-hero2-meta">
            {streak > 0 && (
              <div className="home-pill">
                <IconFlame size={15} /> רצף {streak} ימים
              </div>
            )}
            {testStats.due > 0 && (
              <div className="home-pill accent">
                <IconClock size={15} /> {testStats.due} לביקורת היום
              </div>
            )}
          </div>
        </header>

        {/* ── Featured Step 1 panel ── */}
        <button className="home-feature" onClick={() => nav("/step1")}>
          <div className="home-feature-main">
            <div className="home-feature-head">
              <span className="home-feature-ico"><IconDash size={20} /></span>
              <span className="home-feature-kicker">המוקד</span>
            </div>
            <h2 className="home-feature-title">USMLE Step 1</h2>
            <p className="home-feature-sub">בקרת שאלות · חזרה מרווחת · כיסוי First Aid</p>
            <div className="home-feature-stats">
              <div className="home-fstat">
                <span className="home-fstat-num">{testStats.due}</span>
                <span className="home-fstat-lbl">לביקורת היום</span>
              </div>
              <div className="home-fstat">
                <span className="home-fstat-num">{testStats.mastered}</span>
                <span className="home-fstat-lbl">שלטתי</span>
              </div>
              <div className="home-fstat">
                <span className="home-fstat-num">{testPct}%</span>
                <span className="home-fstat-lbl">כיסוי</span>
              </div>
            </div>
          </div>
          <div className="home-feature-side">
            <Ring pct={testPct} />
            <span className="home-feature-cta">פתח לוח <IconArrow size={15} /></span>
          </div>
        </button>

        {/* ── Section grid ── */}
        <div className="home-grid2">
          {sections.map((s) => {
            const { Icon } = s;
            return (
              <button key={s.id} className="home-tile" onClick={() => nav(s.to)}>
                <div className="home-tile-top">
                  <span className="home-tile-ico"><Icon size={18} /></span>
                  <span className="home-tile-arr"><IconArrow size={16} /></span>
                </div>
                <span className="home-tile-title">{s.title}</span>
                <div className="home-tile-stats">
                  {s.stats.map((st, i) => (
                    <div key={i} className={`home-tile-stat${st.alert ? " alert" : ""}`}>
                      <span className="home-tile-val">{st.val}</span>
                      <span className="home-tile-lbl">{st.lbl}</span>
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

// Minimal progress ring
function Ring({ pct }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="home-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--surface-4)" strokeWidth="6" />
        <circle
          cx="42" cy="42" r={r} fill="none" stroke="var(--accent)" strokeWidth="6"
          strokelinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset 0.8s var(--ease-out)" }}
        />
      </svg>
      <span className="home-ring-pct">{pct}%</span>
    </div>
  );
}
