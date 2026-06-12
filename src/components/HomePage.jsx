import { useNavigate } from "react-router-dom";
import { PHASES } from "../lib/timelineData.js";
import { loadCategoryTasks } from "../lib/workstreamData.js";

const EXAM_DATE = new Date("2026-10-11T00:00:00Z");

function daysUntilExam() {
  return Math.ceil((EXAM_DATE - new Date()) / 86400000);
}

function currentPhase() {
  const t = new Date().toISOString().slice(0, 10);
  return PHASES.find(p => t >= p.start && t <= p.end) || null;
}

function activeCount(categoryId) {
  try { return loadCategoryTasks(categoryId).filter(t => t.status === "Active").length; }
  catch { return 0; }
}

export default function HomePage({ testStats, faStats, streak }) {
  const nav   = useNavigate();
  const days  = daysUntilExam();
  const phase = currentPhase();
  const testPct = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;
  const faPct   = faStats.total   > 0 ? Math.round((faStats.seen       / faStats.total)   * 100) : 0;

  const aimsActive     = activeCount("aims");
  const medcrossActive = activeCount("medcross");
  const selfcareActive = activeCount("selfcare");

  const sections = [
    {
      id: "step1", to: "/step1", icon: "🎓",
      title: "Step 1", color: "#4f46e5",
      stats: [
        { val: testStats.due,    lbl: "לביקורת היום" },
        { val: testStats.mastered, lbl: "שלטתי" },
        { val: testPct + "%",    lbl: "כיסוי" },
      ],
      progress: testPct,
    },
    {
      id: "timeline", to: "/timeline", icon: "📅",
      title: "ציר זמן", color: "#0d9488",
      stats: [
        { val: days > 0 ? days : "—", lbl: "ימים לבחינה" },
        { val: phase?.name || "—",     lbl: "שלב נוכחי" },
      ],
      progress: null,
    },
    {
      id: "aims", to: "/aims", icon: "🎯",
      title: "AIMS", color: "#7c3aed",
      stats: [{ val: aimsActive, lbl: "משימות פעילות" }],
      progress: null,
    },
    {
      id: "medcross", to: "/medcross", icon: "🏥",
      title: "MedCross", color: "#db2777",
      stats: [{ val: medcrossActive, lbl: "משימות פעילות" }],
      progress: null,
    },
    {
      id: "selfcare", to: "/selfcare", icon: "💚",
      title: "טיפול עצמי", color: "#16a34a",
      stats: [
        { val: selfcareActive, lbl: "משימות פעילות" },
        { val: faPct + "%",   lbl: "כיסוי FA" },
      ],
      progress: null,
    },
  ];

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1 className="home-title">לוח ההישרדות</h1>
        <p className="home-sub">סקירה כללית · {new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}</p>
        {streak > 0 && <div className="streak-badge">🔥 רצף {streak} ימים</div>}
        {phase && (
          <div className="home-phase-badge" style={{ background: phase.color + "18", color: phase.color, border: `1.5px solid ${phase.color}44` }}>
            ▶ {phase.name}
          </div>
        )}
      </div>

      <div className="home-grid">
        {sections.map(s => (
          <button key={s.id} className="home-card" onClick={() => nav(s.to)}
            style={{ borderTopColor: s.color }}>
            <div className="home-card-head">
              <span className="home-card-icon">{s.icon}</span>
              <span className="home-card-title" style={{ color: s.color }}>{s.title}</span>
              <span className="home-card-arrow" style={{ color: s.color }}>←</span>
            </div>
            <div className="home-card-stats">
              {s.stats.map((st, i) => (
                <div key={i} className="home-stat">
                  <span className="home-stat-val" style={{ color: s.color }}>{st.val}</span>
                  <span className="home-stat-lbl">{st.lbl}</span>
                </div>
              ))}
            </div>
            {s.progress !== null && (
              <div className="home-card-prog-wrap">
                <div className="home-card-prog-bar" style={{ width: `${s.progress || 2}%`, background: s.color }} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
