import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadProgress,
  getReviewSchedule,
  getMasteredThisWeek,
  computeInsights,
  loadTestLog,
  getWeakSubjects,
  getStreak,
} from "../lib/storage.js";
import { weakSpots } from "../lib/progressData.js";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import CountUp from "../lib/CountUp.jsx";
import {
  IconArrow, IconFlame, IconClock, IconSparkle, IconPulse,
  IconTarget, IconBook, IconCalendar, IconCheck,
} from "./icons.jsx";

const DAY = 86400000;

// Hebrew relative-day phrasing for the next scheduled review.
function heWhen(ms) {
  if (!ms) return null;
  const days = Math.round((ms - Date.now()) / DAY);
  if (days <= 0) return "היום";
  if (days === 1) return "מחר";
  if (days <= 6) return `בעוד ${days} ימים`;
  if (days <= 13) return "בעוד שבוע";
  return `בעוד ${Math.round(days / 7)} שבועות`;
}

export default function HomeWidgets({ testStats, faStats, questions = [] }) {
  const nav = useNavigate();

  const data = useMemo(() => {
    const progress = loadProgress();
    const schedule = getReviewSchedule(questions, progress);
    const insights = computeInsights(questions, progress).slice(0, 3);
    const log = loadTestLog().slice().sort((a, b) => (a.date < b.date ? -1 : 1));

    // Weakest subjects: prefer graded QBank snapshots, fall back to miss counters.
    let weak = weakSpots("subject", 4).map((w) => ({ name: w.name, pct: w.pct, kind: "pct" }));
    if (!weak.length) {
      weak = getWeakSubjects(4).map((w) => ({ name: w.subject, count: w.count, kind: "miss" }));
    }

    const today = new Date().toISOString().slice(0, 10);
    const aims = loadCategoryTasks("aims").filter((t) => t.status === "Active");
    const agenda = [];
    if (schedule.dueNow > 0) {
      agenda.push({
        id: "reviews",
        label: `${schedule.dueNow} שאלות לחזרה מרווחת`,
        overdue: schedule.overdue > 0,
        go: () => nav("/tests/review", { state: { filter: "due" } }),
      });
    }
    for (const t of aims) {
      if (t.deadline && t.deadline <= today) {
        agenda.push({
          id: t.id,
          label: t.title || t.text || "משימת AIMS",
          overdue: t.deadline < today,
          go: () => nav("/aims"),
        });
      }
    }

    return {
      schedule, insights, log, weak, agenda,
      mastered: getMasteredThisWeek(),
      streak: getStreak(),
    };
  }, [questions, nav]);

  const { schedule, insights, log, weak, agenda, mastered, streak } = data;

  const faPct = faStats.total > 0 ? Math.round((faStats.seen / faStats.total) * 100) : 0;
  const latest = log[log.length - 1] || null;
  const prev = log.length > 1 ? log[log.length - 2] : null;
  const scoreDelta = latest && prev ? latest.score - prev.score : null;

  return (
    <section className="hw-wrap">
      <div className="home-sec-label">
        <span>סקירה יומית</span>
        <span className="home-sec-line" />
      </div>

      {/* ── Momentum strip (full width) ── */}
      <div className="hw-momentum">
        <MomentumStat icon={<IconFlame size={18} />} value={streak} label="ימי רצף" tint="gold" />
        <div className="hw-momentum-sep" />
        <MomentumStat icon={<IconSparkle size={18} />} value={mastered} label="נשלטו השבוע" tint="green" />
        <div className="hw-momentum-sep" />
        <MomentumStat icon={<IconCheck size={18} />} value={testStats.mastered} label="נשלטו בסך הכול" tint="green" />
        <div className="hw-momentum-sep" />
        <MomentumStat icon={<IconClock size={18} />} value={schedule.dueNow} label="לחזרה היום" tint={schedule.dueNow > 0 ? "gold" : "muted"} />
      </div>

      <div className="hw-grid">
        {/* ── 1 · Review forecast (wide) ── */}
        <Card wide title="תחזית חזרות" sub="14 הימים הקרובים" icon={<IconCalendar size={16} />}
          onClick={() => nav("/progress")}>
          <ReviewForecast days={schedule.days} />
        </Card>

        {/* ── 2 · Score trend ── */}
        <Card title="מגמת ציונים" sub="מבחני UWORLD" icon={<IconPulse size={16} />}
          onClick={() => nav("/tests")}>
          {log.length >= 2 ? (
            <div className="hw-trend">
              <Sparkline points={log.map((t) => t.score)} />
              <div className="hw-trend-foot">
                <div className="hw-trend-now">
                  <span className="hw-trend-num"><CountUp value={latest.score} />%</span>
                  {scoreDelta != null && (
                    <span className={`hw-delta ${scoreDelta >= 0 ? "up" : "down"}`}>
                      {scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(scoreDelta)}
                    </span>
                  )}
                </div>
                {latest.uworldAvg != null && (
                  <span className="hw-trend-avg">ממוצע QBank {latest.uworldAvg}%</span>
                )}
              </div>
            </div>
          ) : (
            <Empty>הוסף מבחן שני כדי לראות מגמה</Empty>
          )}
        </Card>

        {/* ── 3 · Weakest subjects ── */}
        <Card title="נושאים חלשים" sub="להתמקד בהם" icon={<IconTarget size={16} />}
          onClick={() => nav("/progress")}>
          {weak.length ? (
            <ul className="hw-weak">
              {weak.map((w) => (
                <li key={w.name} className="hw-weak-row">
                  <span className="hw-weak-name" dir="ltr">{w.name}</span>
                  {w.kind === "pct" ? (
                    <span className="hw-weak-meter">
                      <span className="hw-weak-fill" style={{ width: `${w.pct}%` }} />
                      <span className="hw-weak-pct">{w.pct}%</span>
                    </span>
                  ) : (
                    <span className="hw-weak-badge">{w.count} החמצות</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>רשום נתוני ביצועים כדי לזהות חולשות</Empty>
          )}
        </Card>

        {/* ── 4 · Smart suggestions (wide) ── */}
        <Card wide title="המלצות חכמות" sub="לפי סוגי הטעויות שלך" icon={<IconSparkle size={16} />}
          onClick={() => nav("/tasks")}>
          {insights.length ? (
            <ul className="hw-tips">
              {insights.map((it) => (
                <li key={it.id} className={`hw-tip prio-${it.priority}`}>
                  <span className="hw-tip-ico">{it.icon}</span>
                  <span className="hw-tip-text" dir="ltr">
                    <span className="hw-tip-title">{it.title}</span>
                    <span className="hw-tip-detail">{it.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>סמן שאלות לפי סוג הטעות כדי לקבל המלצות</Empty>
          )}
        </Card>

        {/* ── 5 · First Aid coverage ── */}
        <Card title="כיסוי First Aid" sub={`${faStats.seen} מתוך ${faStats.total} נושאים`} icon={<IconBook size={16} />}
          onClick={() => nav("/fa")}>
          <div className="hw-fa">
            <div className="hw-fa-ring">
              <Ring pct={faPct} />
            </div>
            <div className="hw-fa-meta">
              <span className="hw-fa-pct"><CountUp value={faPct} />%</span>
              <span className="hw-fa-lbl">נקראו</span>
              <span className="hw-fa-rest">{faStats.total - faStats.seen} נותרו</span>
            </div>
          </div>
        </Card>

        {/* ── 6 · Today's agenda (wide) ── */}
        <Card wide title="סדר היום" sub="מה על הפרק היום" icon={<IconCheck size={16} />}>
          {agenda.length ? (
            <ul className="hw-agenda">
              {agenda.map((a) => (
                <li key={a.id}>
                  <button className={`hw-agenda-row${a.overdue ? " overdue" : ""}`} onClick={a.go}>
                    <span className="hw-agenda-dot" />
                    <span className="hw-agenda-label">{a.label}</span>
                    {a.overdue && <span className="hw-agenda-flag">באיחור</span>}
                    <IconArrow size={15} className="hw-agenda-arr" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>הכול נקי להיום — יום פנוי 🎉</Empty>
          )}
        </Card>

        {/* ── 7 · Next review countdown ── */}
        <Card title="החזרה הבאה" sub="מתי לחזור" icon={<IconClock size={16} />}
          onClick={() => nav("/tests/review", { state: { filter: "due" } })}>
          <div className="hw-next">
            {schedule.dueNow > 0 ? (
              <>
                <span className="hw-next-big"><CountUp value={schedule.dueNow} /></span>
                <span className="hw-next-lbl">שאלות ממתינות עכשיו</span>
              </>
            ) : schedule.nextDueAt ? (
              <>
                <span className="hw-next-when">{heWhen(schedule.nextDueAt)}</span>
                <span className="hw-next-lbl">
                  {new Date(schedule.nextDueAt).toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
                </span>
              </>
            ) : (
              <>
                <span className="hw-next-when">אין חזרות</span>
                <span className="hw-next-lbl">התחל לתרגל שאלות</span>
              </>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ── Building blocks ─────────────────────────────────────────────── */

function Card({ title, sub, icon, children, onClick, wide }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`hw-card${wide ? " hw-wide" : ""}${onClick ? " hw-clickable" : ""}`} onClick={onClick}>
      <div className="hw-card-hd">
        <span className="hw-card-ico">{icon}</span>
        <span className="hw-card-titles">
          <span className="hw-card-title">{title}</span>
          {sub && <span className="hw-card-sub">{sub}</span>}
        </span>
        {onClick && <IconArrow size={15} className="hw-card-arr" />}
      </div>
      <div className="hw-card-body">{children}</div>
    </Tag>
  );
}

function MomentumStat({ icon, value, label, tint }) {
  return (
    <div className={`hw-mstat tint-${tint}`}>
      <span className="hw-mstat-ico">{icon}</span>
      <span className="hw-mstat-num"><CountUp value={value} /></span>
      <span className="hw-mstat-lbl">{label}</span>
    </div>
  );
}

function Empty({ children }) {
  return <p className="hw-empty">{children}</p>;
}

// 14-day upcoming-review bar chart. LTR so the date axis reads oldest→newest.
function ReviewForecast({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="hw-fc" dir="ltr">
      {days.map((d, i) => {
        const h = d.count ? Math.max(8, Math.round((d.count / max) * 100)) : 3;
        const wd = new Date(d.ms).toLocaleDateString("he-IL", { weekday: "narrow" });
        return (
          <div key={d.ms} className={`hw-fc-col${d.isToday ? " today" : ""}${d.count ? "" : " empty"}`}>
            <span className="hw-fc-count">{d.count || ""}</span>
            <span className="hw-fc-bar" style={{ height: `${h}%` }} />
            <span className="hw-fc-day">{i % 2 === 0 ? wd : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

// Simple SVG sparkline scaled to its own min/max.
function Sparkline({ points }) {
  const W = 100, H = 40, pad = 4;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => {
    const x = points.length > 1 ? pad + (i / (points.length - 1)) * (W - 2 * pad) : W / 2;
    const y = H - pad - ((p - min) / span) * (H - 2 * pad);
    return [x, y];
  });
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg className="hw-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={area} className="hw-spark-area" />
      <path d={line} className="hw-spark-line" />
      <circle cx={lx} cy={ly} r="2.6" className="hw-spark-dot" />
    </svg>
  );
}

function Ring({ pct }) {
  const r = 30, c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg viewBox="0 0 72 72" className="hw-ring">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--gold)" strokeWidth="7"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset 0.9s var(--ease-out)" }} />
    </svg>
  );
}
