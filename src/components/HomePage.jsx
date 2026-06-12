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
      title: "Step 1", color: "#4f46e5", featured: true,
      stats: [
        { val: testStats.due,      lbl: "לביקורת היום" },
        { val: testStats.mastered, lbl: "שלטתי" },
        { val: testPct + "%",      lbl: "כיסוי" },
      ],
      progress: testPct,
    },
    {
      id: "timeline", to: "/timeline", icon: "📅",
      title: "ציר זמן", color: "#0d9488", featured: false,
      stats: [{ val: days > 0 ? days : "—", lbl: "ימים לבחינה" }],
      progress: null,
    },
    {
      id: "aims", to: "/aims", icon: "🎯",
      title: "AIMS", color: "#7c3aed", featured: false,
      stats: [{ val: aimsActive, lbl: "פעילות" }],
      progress: null,
    },
    {
      id: "medcross", to: "/medcross", icon: "🏥",
      title: "MedCross", color: "#db2777", featured: false,
      stats: [{ val: medcrossActive, lbl: "פעילות" }],
      progress: null,
    },
    {
      id: "selfcare", to: "/selfcare", icon: "💚",
      title: "טיפול עצמי", color: "#16a34a", featured: false,
      stats: [
        { val: selfcareActive, lbl: "פעילות" },
        { val: faPct + "%",   lbl: "FA" },
      ],
      progress: null,
    },
  ];

  const dateStr = new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="home-page">

      <div className="home-hero">
        <h1 className="home-title">לוח ההישרדות</h1>
        <p className="home-sub">{dateStr}</p>
        <div className="home-hero-chips">
          {days > 0 && <span className="home-chip home-chip-days">{days} ימים לבחינה</span>}
          {streak > 0 && <span className="home-chip home-chip-streak">🔥 {streak} ימים</span>}
          {phase && <span className="home-chip home-chip-phase">▶ {phase.name}</span>}
        </div>
      </div>

      <div className="home-content">
        <div className="home-grid">
          {sections.map(s => (
            <button
              key={s.id}
              className={`home-card${s.featured ? " home-card-featured" : ""}`}
              onClick={() => nav(s.to)}
              style={{ "--card-c": s.color }}
            >
              <div className="home-card-band">
                <span className="home-card-icon">{s.icon}</span>
                <span className="home-card-name">{s.title}</span>
                <span className="home-card-arr">←</span>
              </div>
              <div className="home-card-body">
                {s.stats.map((st, i) => (
                  <div key={i} className="home-stat">
                    <span className="home-stat-val">{st.val}</span>
                    <span className="home-stat-lbl">{st.lbl}</span>
                  </div>
                ))}
              </div>
              {s.progress !== null && (
                <div className="home-card-prog">
                  <div className="home-card-prog-bar" style={{ width: `${Math.max(s.progress, 2)}%` }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
