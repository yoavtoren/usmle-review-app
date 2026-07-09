import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadProgress, getReviewSchedule, getMasteredThisWeek,
  loadTestLog, getWeakSubjects,
} from "../lib/storage.js";
import { weakSpots } from "../lib/progressData.js";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import CountUp from "../lib/CountUp.jsx";
import {
  IconDash, IconTarget, IconArrow, IconFlame, IconClock,
  IconPulse, IconBook, IconClipboard, IconBox, IconCheck, IconSparkle,
} from "./icons.jsx";

const EXAM_DATE = new Date("2026-10-11T00:00:00Z");
const JOURNEY_START = new Date("2026-06-10T00:00:00Z");
const DAY = 86400000;
const WEEK_GOAL = 25; // soft weekly target for questions mastered (gives the momentum meter a scale)

function daysUntilExam() {
  return Math.ceil((EXAM_DATE - new Date()) / DAY);
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function HomePage({ testStats, faStats, streak = 0, questions = [] }) {
  const nav = useNavigate();

  const d = useMemo(() => {
    const progress = loadProgress();
    const sched = getReviewSchedule(questions, progress);
    const log = loadTestLog().slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    let weak = weakSpots("subject", 4).map((w) => ({ name: w.name, pct: w.pct, kind: "pct" }));
    if (!weak.length) weak = getWeakSubjects(4).map((w) => ({ name: w.subject, count: w.count, kind: "miss" }));
    return { sched, log, weak, masteredWeek: getMasteredThisWeek() };
  }, [questions, testStats]);

  const { sched, log, weak, masteredWeek } = d;

  const days = daysUntilExam();
  const totalSpan = Math.max(1, Math.round((EXAM_DATE - JOURNEY_START) / DAY));
  const elapsed = Math.max(0, Math.min(totalSpan, Math.round((new Date() - JOURNEY_START) / DAY)));
  const journeyPct = Math.round((elapsed / totalSpan) * 100);

  // Same-domain pipeline (one denominator) for the hero ring — never mix with FA%.
  const pipeTotal = sched.mastered + sched.reviewing + sched.fresh || testStats.total || 0;
  const masteryPct = pipeTotal ? Math.round((sched.mastered / pipeTotal) * 100) : 0;
  const inflightPct = pipeTotal ? Math.round(((sched.mastered + sched.reviewing) / pipeTotal) * 100) : 0;
  const faPct = faStats.total > 0 ? Math.round((faStats.seen / faStats.total) * 100) : 0;

  const latest = log[log.length - 1] || null;
  const cohortDelta = latest && Number.isFinite(latest.uworldAvg) ? latest.score - latest.uworldAvg : null;
  const hasAvg = log.some((t) => Number.isFinite(t.uworldAvg));

  const aims = taskStats("aims");
  const nextWhen = heWhen(sched.nextDueAt);
  // Single source for the "load" captions — the sum of what the bars actually draw
  // (already paused-aware via getReviewSchedule), so caption and chart never disagree.
  const loadTotal = sched.days.reduce((s, x) => s + x.count, 0);

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
      <div className="page hd">
        {/* ═══ Masthead ═══ */}
        <header className="hd-greet">
          <div className="hd-greet-text">
            <p className="hd-eyebrow">{dateStr}</p>
            <h1 className="hd-h1">{greeting}, <span className="hd-name">יואב</span></h1>
            <p className="hd-lede">
              {days > 0
                ? <>נותרו <em className="num">{days}</em> ימים ל‑Step 1.</>
                : "המסע נמשך — צעד אחד היום."}
            </p>
          </div>
          <div className="hd-vitals">
            <div className="hd-vital">
              <span className="hd-vital-n num"><CountUp value={streak} /></span>
              <span className="hd-vital-l"><IconFlame size={11} /> רצף</span>
            </div>
            <div className="hd-vital">
              <span className={`hd-vital-n num${sched.dueNow > 0 ? " hot" : ""}`}><CountUp value={sched.dueNow} /></span>
              <span className="hd-vital-l">לביקורת</span>
            </div>
            <div className="hd-vital">
              <span className="hd-vital-when">{sched.dueNow > 0 ? "עכשיו" : (nextWhen || "—")}</span>
              <span className="hd-vital-l">הבא</span>
            </div>
            <div className="hd-vital">
              <span className="hd-vital-n num">{journeyPct}%</span>
              <span className="hd-vital-bar"><span style={{ width: `${journeyPct}%` }} /></span>
              <span className="hd-vital-l">מהמסע</span>
            </div>
          </div>
        </header>

        {/* ═══ Bento ═══ */}
        <div className="hd-bento">

          {/* A · Hero — Step 1 command center */}
          <button className="hd-card hd-hero c8" onClick={() => nav("/step1")}>
            <div className="hd-hero-bg" />
            <div className="hd-hero-main">
              <div className="hd-hero-head">
                <span className="hd-hero-ico"><IconDash size={20} /></span>
                <span className="hd-hero-kicker">המוקד · STEP 1</span>
              </div>
              <h2 className="hd-hero-title">USMLE Step 1</h2>
              <p className="hd-hero-sub">בקרת שאלות · חזרה מרווחת · כיסוי First Aid</p>

              <div className="hd-hero-stats">
                <HeroStat n={sched.dueNow} label="לביקורת היום" hot={sched.dueNow > 0} />
                <HeroStat n={sched.mastered} label="שלטתי" />
                <HeroStat n={sched.reviewing} label="בתהליך" dim />
              </div>

              <div className="hd-hero-load">
                <div className="hd-hero-load-cap">
                  <span>עומס החזרות · 14 ימים</span>
                  <span className="num">{loadTotal} סה״כ</span>
                </div>
                <LoadStrip days={sched.days} />
              </div>
            </div>

            <div className="hd-hero-rail">
              <MasteryHalo mastery={masteryPct} inflight={inflightPct} due={pipeTotal ? Math.round((sched.dueNow / pipeTotal) * 100) : 0} />
              <div className="hd-hero-railmeta num">{sched.mastered}/{pipeTotal}</div>
              <span className="hd-hero-cta">פתח לוח <IconArrow size={15} className="mir" /></span>
            </div>
          </button>

          {/* B · Countdown certificate */}
          <div className="hd-card hd-count c4">
            <div className="hd-count-frame" />
            <span className="hd-count-kicker">USMLE STEP 1</span>
            <div className="hd-count-gauge">
              <JourneyGauge pct={journeyPct} />
              <div className="hd-count-center">
                <span className="hd-count-num num"><CountUp value={days > 0 ? days : 0} /></span>
                <span className="hd-count-unit">ימים לבחינה</span>
              </div>
            </div>
            <span className="hd-count-date num">{examStr}</span>
            <div className="hd-count-track"><span style={{ width: `${journeyPct}%` }} /></div>
            <span className="hd-count-prog"><b className="num">{journeyPct}%</b> מהמסע הושלם</span>
          </div>

          {/* C · Score trajectory */}
          <div className="hd-card hd-traj c8">
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico green"><IconPulse size={15} /></span> מגמת ציונים</span>
              <span className="hd-ch-meta">
                {cohortDelta != null && (
                  <span className={`hd-delta ${cohortDelta >= 0 ? "up" : "down"}`}>
                    {cohortDelta >= 0 ? "▲" : "▼"} <span className="num">{Math.abs(cohortDelta)}</span> מהממוצע
                  </span>
                )}
                <button className="hd-ch-link" onClick={() => nav("/tests")}>כל המבחנים <IconArrow size={13} className="mir" /></button>
              </span>
            </div>
            <div className="hd-traj-body">
              {log.length >= 2
                ? <Trajectory log={log} />
                : <div className="hd-empty">
                    <span className="hd-empty-ico"><IconPulse size={22} /></span>
                    <p>הוסף מבחן שני כדי לראות מגמה</p>
                    <button className="btn-secondary" onClick={() => nav("/tests")}>לרישום מבחן</button>
                  </div>}
            </div>
            <div className="hd-traj-legend">
              <span className="lg lg-mine">הציון שלי</span>
              {hasAvg && <span className="lg lg-avg">ממוצע UWorld</span>}
              <span className="lg lg-band">אזור מעבר 60–70</span>
            </div>
          </div>

          {/* D · Momentum */}
          <div className="hd-card hd-mom c4">
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico gold"><IconSparkle size={15} /></span> תנופה שבועית</span>
            </div>
            <div className="hd-mom-hero">
              <span className="hd-mom-num num"><CountUp value={masteredWeek} /></span>
              <span className="hd-mom-lbl">נשלטו השבוע · יעד <span className="num">{WEEK_GOAL}</span></span>
            </div>
            <div className="hd-mom-track">
              <span style={{ width: `${Math.min(100, Math.round((masteredWeek / WEEK_GOAL) * 100))}%` }} />
            </div>
            <div className="hd-mom-streak">
              <StreakDots streak={streak} />
              <span className="hd-mom-streaklbl">7 הימים האחרונים</span>
            </div>
            <div className="hd-mom-foot">
              {streak > 0
                ? <><span className="num">{streak}</span> ימי רצף{sched.dueNow > 0 && <> · <span className="num">{sched.dueNow}</span> ממתינות</>}</>
                : <span className="hd-mom-cta">התחל רצף חדש היום 🔥</span>}
            </div>
          </div>

          {/* E · 14-day review load */}
          <div className="hd-card hd-review c3">
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico green"><IconClipboard size={15} /></span> תחזית חזרות</span>
              <span className="hd-ch-meta"><span className="hd-chip num">{loadTotal} בהמתנה</span></span>
            </div>
            <ReviewBars days={sched.days} overdue={sched.overdue} dueToday={sched.dueToday} />
          </div>

          {/* F · First Aid coverage */}
          <button className="hd-card hd-fa c3" onClick={() => nav("/fa")}>
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico gold"><IconBook size={15} /></span> כיסוי First Aid</span>
              <IconArrow size={15} className="hd-ch-arr mir" />
            </div>
            <div className="hd-fa-top">
              <span className="hd-fa-pct num"><CountUp value={faPct} />%</span>
              <span className="hd-fa-of num">{faStats.seen} / {faStats.total} נושאים</span>
            </div>
            <Constellation pct={faPct} />
            <div className="hd-fa-rail"><span style={{ width: `${faPct}%` }} /></div>
            <span className="hd-fa-rest"><span className="num">{faStats.total - faStats.seen}</span> נושאים נותרו</span>
          </button>

          {/* G · Weak subjects */}
          <button className="hd-card hd-weak c3" onClick={() => nav("/progress")}>
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico bad"><IconTarget size={15} /></span> נקודות תורפה</span>
              <IconArrow size={15} className="hd-ch-arr mir" />
            </div>
            {weak.length ? (
              <ul className="hd-weak-list">
                {(() => { const wMax = Math.max(...weak.map((x) => x.kind === "pct" ? (100 - x.pct) : x.count), 1); return weak.map((w, i) => {
                  const val = w.kind === "pct" ? (100 - w.pct) : w.count;
                  const max = wMax;
                  return (
                    <li key={w.name} className="hd-weak-row">
                      <div className="hd-weak-top">
                        <span className="hd-weak-name" dir="ltr">{w.name}</span>
                        <span className="hd-weak-val num">{w.kind === "pct" ? `${w.pct}%` : `${w.count} החמצות`}</span>
                      </div>
                      <span className="hd-weak-bar">
                        <span className={`hd-weak-fill${i === 0 ? " worst" : ""}`} style={{ width: `${Math.round(val / max * 100)}%` }} />
                      </span>
                    </li>
                  );
                }); })()}
              </ul>
            ) : (
              <div className="hd-empty sm">
                <span className="hd-empty-ico ok"><IconCheck size={20} /></span>
                <p>אין עדיין מספיק נתונים</p>
                <span className="hd-empty-sub">תרגל מבחן כדי לזהות חולשות</span>
              </div>
            )}
          </button>

          {/* H · AIMS */}
          <button className="hd-card hd-aims c3" onClick={() => nav("/aims")}>
            <div className="hd-aims-spine" />
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico purple"><IconTarget size={15} /></span> AIMS</span>
              <IconArrow size={15} className="hd-ch-arr mir" />
            </div>
            <p className="hd-aims-desc">מטלות ותאריכי יעד</p>
            <div className="hd-aims-stats">
              <div className="hd-aims-stat">
                <span className="hd-aims-num num"><CountUp value={aims.active} /></span>
                <span className="hd-aims-lbl">מטלות פעילות</span>
              </div>
              {aims.overdue > 0 && (
                <span className="hd-aims-over num">{aims.overdue} באיחור</span>
              )}
            </div>
          </button>

          {/* I · Quick nav */}
          <nav className="hd-nav c12">
            <NavChip Icon={IconClipboard} label="מבחנים" stat={`${log.length} מבחנים`} onClick={() => nav("/tests")} />
            <NavChip Icon={IconBox} label="בנק שאלות" stat={`${testStats.total || 0} שאלות`} onClick={() => nav("/bank")} />
            <NavChip Icon={IconPulse} label="התקדמות" stat={`${masteredWeek} השבוע`} onClick={() => nav("/progress")} />
            <NavChip Icon={IconBook} label="First Aid" stat={`${faPct}% כוסו`} onClick={() => nav("/fa")} />
          </nav>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function HeroStat({ n, label, hot, warn, dim }) {
  return (
    <div className={`hd-hstat${hot ? " hot" : ""}${warn ? " warn" : ""}${dim ? " dim" : ""}`}>
      <span className="hd-hstat-n num"><CountUp value={n || 0} /></span>
      <span className="hd-hstat-l">{label}</span>
    </div>
  );
}

function NavChip({ Icon, label, stat, onClick }) {
  return (
    <button className="hd-navchip" onClick={onClick}>
      <span className="hd-navchip-ico"><Icon size={18} /></span>
      <span className="hd-navchip-label">{label}</span>
      <span className="hd-navchip-stat num">{stat}</span>
    </button>
  );
}

function StreakDots({ streak }) {
  const filled = Math.min(streak, 7);
  return (
    <div className="hd-dots">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={`hd-dot${i < filled ? " on" : ""}`} style={{ animationDelay: `${i * 45}ms` }} />
      ))}
    </div>
  );
}

// Dual-metric halo (SAME domain): thick gold mastery arc + thin in-flight arc + a red due-now tick.
function MasteryHalo({ mastery, inflight, due }) {
  const R1 = 44, R2 = 33;
  const c1 = 2 * Math.PI * R1, c2 = 2 * Math.PI * R2;
  const m = clamp(mastery, 0, 100), inf = clamp(inflight, 0, 100), dueA = clamp(due, 0, 100);
  return (
    <div className="hd-halo">
      <svg viewBox="0 0 120 120">
        {/* outer — mastery (gold, thick) */}
        <circle cx="60" cy="60" r={R1} fill="none" stroke="rgba(245,241,229,0.13)" strokeWidth="8" />
        <circle cx="60" cy="60" r={R1} fill="none" stroke="#D5B36A" strokeWidth="8"
          strokeLinecap="round" transform="rotate(-90 60 60)"
          className="hd-arc" style={{ "--dash": c1, "--off": c1 * (1 - m / 100) }} />
        {/* red due-now tick at the head of the reviewing band (just past mastered) */}
        {dueA > 0 && (
          <circle cx="60" cy="60" r={R1} fill="none" stroke="var(--bad)" strokeWidth="8"
            strokeLinecap="butt" transform="rotate(-90 60 60)"
            strokeDasharray={`${(dueA / 100) * c1} ${c1}`} strokeDashoffset={-(m / 100) * c1} opacity="0.9" />
        )}
        {/* inner — in-flight (mastered + reviewing), dim */}
        <circle cx="60" cy="60" r={R2} fill="none" stroke="rgba(245,241,229,0.10)" strokeWidth="4" />
        <circle cx="60" cy="60" r={R2} fill="none" stroke="rgba(213,179,106,0.5)" strokeWidth="4"
          strokeLinecap="round" transform="rotate(-90 60 60)"
          className="hd-arc" style={{ "--dash": c2, "--off": c2 * (1 - inf / 100) }} />
      </svg>
      <span className="hd-halo-pct num">{m}%</span>
      <span className="hd-halo-lbl">שליטה</span>
    </div>
  );
}

// Semicircle journey gauge (green ripening into gold toward the exam). RTL: fills from the right.
function JourneyGauge({ pct }) {
  const len = Math.PI * 52; // half-circumference, r=52
  const off = len * (1 - clamp(pct, 0, 100) / 100);
  return (
    <svg className="hd-gauge" viewBox="0 0 120 68">
      <defs>
        <linearGradient id="jgrad" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="65%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--gold-2)" />
        </linearGradient>
      </defs>
      <path d="M 112 60 A 52 52 0 0 0 8 60" fill="none" stroke="var(--surface-4)" strokeWidth="9" strokeLinecap="round" />
      <path d="M 112 60 A 52 52 0 0 0 8 60" fill="none" stroke="url(#jgrad)" strokeWidth="9" strokeLinecap="round"
        className="hd-arc" style={{ "--dash": len, "--off": off }} />
    </svg>
  );
}

// 14 slim bars embedded in the hero — gold-on-green. RTL: today = right-most.
function LoadStrip({ days }) {
  const max = Math.max(1, ...days.map((x) => x.count));
  const W = 560, H = 24, slot = W / 14;
  return (
    <svg className="hd-loadstrip" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {days.map((day, i) => {
        const x = W - (i + 1) * slot + 2;
        const bw = slot - 4;
        const h = day.count ? Math.max(3, (day.count / max) * (H - 4)) : 2;
        return (
          <rect key={day.ms} x={x} y={H - h} width={bw} height={h} rx="1.5"
            fill={day.isToday ? "var(--rail-gold)" : day.count ? "rgba(213,179,106,0.30)" : "rgba(245,241,229,0.12)"} />
        );
      })}
    </svg>
  );
}

// Dual-line trajectory: my score vs UWorld average. RTL — newest on the left, oldest on the right.
function Trajectory({ log }) {
  const W = 1000, H = 164;
  const padT = 16, padB = 28, padL = 16, padR = 48;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = log.length;
  // Dynamic domain that never clips a real point (contains e.g. 28), padded for headroom.
  // Only finite values feed the scale — a NaN/undefined from bad synced data must not wipe the chart.
  const vals = log.flatMap((t) => [t.score, t.uworldAvg]).filter((v) => Number.isFinite(v));
  const LO = Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10);
  const HI = Math.min(100, Math.ceil((Math.max(...vals) + 8) / 10) * 10);
  const xAt = (i) => (W - padR) - (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v) => padT + (1 - (clamp(v, LO, HI) - LO) / (HI - LO)) * plotH;

  const mine = log.map((t, i) => [xAt(i), yAt(t.score)]);
  const mineLine = mine.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${mineLine} L${mine[mine.length - 1][0].toFixed(1)} ${H - padB} L${mine[0][0].toFixed(1)} ${H - padB} Z`;

  // UWorld benchmark: index-aligned, split into contiguous real-value segments so the
  // dashed line breaks at tests without an average instead of drawing a phantom trend.
  const avgPts = log.map((t, i) => (Number.isFinite(t.uworldAvg) ? [xAt(i), yAt(t.uworldAvg)] : null));
  const avgSegs = [];
  let seg = [];
  for (const p of avgPts) { if (p) seg.push(p); else if (seg.length) { avgSegs.push(seg); seg = []; } }
  if (seg.length) avgSegs.push(seg);

  // Gridlines derived from the actual domain (always ~4–6 lines, never zero).
  const grid = [];
  for (let g = LO + 10; g <= HI; g += 10) grid.push(g);
  const bandLo = clamp(60, LO, HI), bandHi = clamp(70, LO, HI);
  const last = mine[mine.length - 1]; // newest = leftmost

  return (
    <svg className="hd-traj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="tgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(30,77,56,0.20)" />
          <stop offset="100%" stopColor="rgba(30,77,56,0)" />
        </linearGradient>
      </defs>
      {/* pass band 60–70 */}
      {bandHi > bandLo && (
        <rect x={padL} y={yAt(bandHi)} width={plotW} height={yAt(bandLo) - yAt(bandHi)} fill="rgba(30,77,56,0.07)" />
      )}
      {grid.map((g) => (
        <g key={g}>
          <line x1={padL} y1={yAt(g)} x2={W - padR} y2={yAt(g)} stroke="var(--line-soft)" strokeWidth="1" />
          <text x={W - padR + 7} y={yAt(g) + 3.5} className="hd-axis" textAnchor="start">{g}</text>
        </g>
      ))}
      {/* UWorld benchmark — one path per contiguous run; a lone point renders as a dot */}
      {avgSegs.map((s, si) => (s.length >= 2
        ? <path key={si} d={s.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
            fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="3 4" strokeLinecap="round" opacity="0.8" />
        : <circle key={si} cx={s[0][0]} cy={s[0][1]} r="2.6" fill="none" stroke="var(--gold)" strokeWidth="1.6" opacity="0.85" />
      ))}
      {/* my score */}
      <path d={area} fill="url(#tgrad)" className="hd-traj-area" />
      <path d={mineLine} fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" className="hd-traj-line" />
      {mine.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.2" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.4" />
      ))}
      {/* x labels (date) */}
      {log.map((t, i) => {
        if (n > 6 && i % 2 !== 0 && i !== n - 1) return null;
        const dt = new Date(t.date);
        const lbl = `${dt.getDate()}/${dt.getMonth() + 1}`;
        return <text key={i} x={xAt(i)} y={H - padB + 16} className="hd-axis" textAnchor="middle">{lbl}</text>;
      })}
      {/* latest emphasis */}
      <circle cx={last[0]} cy={last[1]} r="10" fill="none" stroke="var(--gold-2)" strokeWidth="1.8" opacity="0.65" />
      <circle cx={last[0]} cy={last[1]} r="5.4" fill="var(--gold-2)" stroke="var(--surface)" strokeWidth="1.8" />
      <g transform={`translate(${last[0]}, ${last[1] - 17})`}>
        <rect x="-21" y="-18" width="42" height="23" rx="6" fill="var(--surface)" stroke="var(--gold-mid)" />
        <text x="0" y="-1.5" className="hd-traj-flag" textAnchor="middle">{log[n - 1].score}</text>
      </g>
    </svg>
  );
}

// 14-day review bars. RTL — today (day 0) on the right. Today stacks overdue (red) under due (gold).
function ReviewBars({ days, overdue = 0, dueToday = 0 }) {
  const W = 240, H = 118;
  const padT = 14, padB = 22, padL = 6, padR = 6;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / 14;
  const max = Math.max(1, ...days.map((x) => x.count));
  const base = H - padB;
  const peakIdx = days.reduce((best, x, i) => (i > 0 && x.count > days[best].count ? i : best), 1);

  return (
    <svg className="hd-reviewbars" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="var(--line)" strokeWidth="1" />
      {days.map((day, i) => {
        const bw = Math.min(11, slot - 4);
        const cx = (W - padR) - (i + 0.5) * slot;
        const x = cx - bw / 2;
        if (!day.count) return <rect key={day.ms} x={x} y={base - 2} width={bw} height="2" rx="1" fill="var(--surface-3)" />;
        const h = Math.max(4, (day.count / max) * plotH);
        if (day.isToday && overdue > 0) {
          const total = overdue + dueToday || day.count;
          const overH = h * (overdue / total);
          const dueH = h - overH;
          return (
            <g key={day.ms} className="hd-bar hd-bar-today" style={{ animationDelay: `${i * 32}ms` }}>
              <rect x={x} y={base - overH} width={bw} height={overH} rx="0" fill="var(--bad)" opacity="0.85" />
              <rect x={x} y={base - h} width={bw} height={dueH} rx="3" fill="url(#rgold)" />
            </g>
          );
        }
        const fill = day.isToday ? "url(#rgold)" : i <= 7 ? "rgba(30,77,56,0.80)" : "rgba(30,77,56,0.42)";
        return (
          <g key={day.ms}>
            <rect className={`hd-bar${day.isToday ? " hd-bar-today" : ""}`} x={x} y={base - h} width={bw} height={h} rx="3" fill={fill}
              style={{ animationDelay: `${i * 32}ms` }} />
            {i === peakIdx && days[peakIdx].count > 0 && (
              <text x={cx} y={base - h - 5} className="hd-bar-peak" textAnchor="middle">{day.count}</text>
            )}
          </g>
        );
      })}
      {days.map((day, i) => {
        if (!(i === 0 || i === 6 || i === 13)) return null;
        const cx = (W - padR) - (i + 0.5) * slot;
        const lbl = i === 0 ? "היום" : `+${i}`;
        return <text key={`l${i}`} x={cx} y={base + 14} className="hd-axis" textAnchor="middle">{lbl}</text>;
      })}
      <defs>
        <linearGradient id="rgold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold-2)" />
          <stop offset="100%" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 40-dot coverage constellation — first N dots lit in proportion to FA coverage.
function Constellation({ pct }) {
  const on = Math.round((40 * clamp(pct, 0, 100)) / 100);
  return (
    <div className="hd-constel">
      {Array.from({ length: 40 }, (_, i) => (
        <span key={i} className={`hd-cdot${i < on ? " on" : ""}`} style={{ animationDelay: `${i * 11}ms` }} />
      ))}
    </div>
  );
}
