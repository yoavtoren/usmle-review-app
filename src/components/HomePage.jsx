import { useNavigate } from "react-router-dom";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import {
  IconDash, IconTarget,
  IconArrow, IconFlame, IconClock,
} from "./icons.jsx";

const EXAM_DATE = new Date("2026-10-11T00:00:00Z");
const JOURNEY_START = new Date("2026-06-10T00:00:00Z");

function daysUntilExam() {
  return Math.ceil((EXAM_DATE - new Date()) / 86400000);
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
  const testPct = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;

  const aims = taskStats("aims");

  // Journey progress (days elapsed of the total run to exam)
  const totalSpan = Math.max(1, Math.round((EXAM_DATE - JOURNEY_START) / 86400000));
  const elapsed = Math.max(0, Math.min(totalSpan, Math.round((new Date() - JOURNEY_START) / 86400000)));
  const journeyPct = Math.round((elapsed / totalSpan) * 100);

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
      <div className="page home-page">
        {/* ── Greeting band ── */}
        <header className="home-hero3">
          <div className="home-hero3-text">
            <p className="home-eyebrow">{dateStr}</p>
            <h1 className="home-h1">{greeting}, יואב</h1>
            <p className="home-lede">
              {days > 0
                ? <>נותרו <em>{days}</em> ימים ל‑Step 1.</>
                : "המסע נמשך — צעד אחד היום."}
            </p>
            <div className="home-hero3-pills">
              {streak > 0 && (
                <div className="home-pill"><IconFlame size={15} /> רצף {streak} ימים</div>
              )}
              {testStats.due > 0 && (
                <div className="home-pill accent"><IconClock size={15} /> {testStats.due} לביקורת היום</div>
              )}
            </div>
          </div>
        </header>

        {/* ── iPad landscape stage: dominant Step 1 + companion column ── */}
        <div className="home-stage">
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
              </div>
            </div>
            <div className="home-feature2-side">
              <Ring pct={testPct} />
              <span className="home-feature2-cta">פתח לוח <IconArrow size={15} /></span>
            </div>
          </button>

          {/* ── Companion column: countdown + AIMS ── */}
          <div className="home-aside">
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

            {/* AIMS companion */}
            <button
              className="home-card3"
              onClick={() => nav("/aims")}
              style={{ "--tint": "#6D4AC2", "--tint2": "#8A66E0" }}
            >
              <div className="home-card3-accent" />
              <div className="home-card3-top">
                <span className="home-card3-ico"><IconTarget size={19} /></span>
                <span className="home-card3-arr"><IconArrow size={16} /></span>
              </div>
              <div className="home-card3-head">
                <span className="home-card3-title">AIMS</span>
                <span className="home-card3-desc">מטלות ותאריכי יעד</span>
              </div>
              <div className="home-card3-stats">
                <div className="home-card3-stat">
                  <span className="home-card3-val">{aims.active}</span>
                  <span className="home-card3-lbl">מטלות</span>
                </div>
                {aims.overdue > 0 && (
                  <div className="home-card3-stat alert">
                    <span className="home-card3-val">{aims.overdue}</span>
                    <span className="home-card3-lbl">באיחור</span>
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Progress ring (used in featured panel)
function Ring({ pct }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="home-ring2">
      <svg viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="8" />
        <circle
          cx="59" cy="59" r={r} fill="none" stroke="#fff" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 59 59)" style={{ transition: "stroke-dashoffset 0.9s var(--ease-out)" }}
        />
      </svg>
      <span className="home-ring2-pct">{pct}%</span>
      <span className="home-ring2-lbl">כיסוי</span>
    </div>
  );
}
