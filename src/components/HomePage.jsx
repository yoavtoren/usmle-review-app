import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadProgress, getReviewSchedule, getMasteredThisWeek,
  loadTestLog, getWeakSubjects, testScore,
} from "../lib/storage.js";
import { weakSpots } from "../lib/progressData.js";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import { readTodayPlan, nextFAChapters } from "../lib/todayPlan.js";
import { colorFor } from "../lib/subjectColors.js";
import CountUp from "../lib/CountUp.jsx";
import { vtNavigate } from "../lib/vt.js";
import { EXAM_DATE, daysUntilExam, localISODate, startOfLocalDay } from "../lib/config.js";
import {
  IconTarget, IconArrow, IconFlame,
  IconPulse, IconBook, IconClipboard, IconBox, IconCheck, IconSparkle, IconNote,
} from "./icons.jsx";
import { currentBlock } from "../lib/strategyData.js";
import { loadErrors, whyCounts, isoDaysAgo } from "../lib/errorLog.js";
import { fetchAppJSON } from "../lib/appData.js";

const JOURNEY_START = new Date(2026, 5, 10); // local midnight — same day boundary as EXAM_DATE
const DAY = 86400000;
const WEEK_GOAL = 25; // soft weekly target for questions mastered (gives the momentum meter a scale)

function taskStats(categoryId) {
  try {
    const tasks = loadCategoryTasks(categoryId);
    const today = localISODate();
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
  if (days === 7) return "בעוד שבוע";
  if (days <= 10) return `בעוד ${days} ימים`;
  if (days <= 17) return "בעוד שבועיים";
  return `בעוד ${Math.round(days / 7)} שבועות`;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// "12.8" — compact Hebrew-style day.month for an ISO date.
function heDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export default function HomePage({ testStats, faStats, streak = 0, questions = [], loading = false }) {
  const nav = useNavigate();
  const go = (to, opts) => vtNavigate(nav, to, opts);

  // Pull the planner's own data (topic units + FA checklist) so the home page can
  // show today's *actual* tasks and the next FA chapters — not just status numbers.
  const [planUnits, setPlanUnits] = useState(null);
  const [faData, setFaData] = useState(null);
  useEffect(() => {
    let live = true;
    // Session-cached (appData.js): App already fetched fa-progress.json, and this
    // page remounts on every navigation back to it.
    fetchAppJSON("topic-plan.json", { units: [] })
      .then((p) => { if (live) setPlanUnits(p?.units || []); });
    fetchAppJSON("fa/fa-progress.json", null)
      .then((f) => { if (live && f) setFaData(f); });
    return () => { live = false; };
  }, []);

  const today = useMemo(
    () => (planUnits ? readTodayPlan(planUnits) : null),
    [planUnits, testStats],
  );
  const faNext = useMemo(() => nextFAChapters(faData, 3), [faData]);

  const d = useMemo(() => {
    const progress = loadProgress();
    const sched = getReviewSchedule(questions, progress);
    // Resolve each test's overall % the same way the Tests page does — an entry
    // logged with only a subject/system breakdown has no explicit `score`, and
    // feeding that raw into the chart's scale produced a NaN path that silently
    // blanked the whole trajectory.
    const log = loadTestLog()
      .map((t) => ({ ...t, score: testScore(t) }))
      .filter((t) => Number.isFinite(t.score))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let weak = weakSpots("subject", 4).map((w) => ({ name: w.name, pct: w.pct, kind: "pct" }));
    if (!weak.length) weak = getWeakSubjects(4).map((w) => ({ name: w.subject, count: w.count, kind: "miss" }));
    return { sched, log, weak, masteredWeek: getMasteredThisWeek() };
  }, [questions, testStats]);

  const { sched, log, weak, masteredWeek } = d;

  const days = daysUntilExam();
  const totalSpan = Math.max(1, Math.round((EXAM_DATE - JOURNEY_START) / DAY));
  const elapsed = Math.max(0, Math.min(totalSpan, Math.round((startOfLocalDay() - JOURNEY_START) / DAY)));
  const journeyPct = Math.round((elapsed / totalSpan) * 100);

  const faPct = faStats.total > 0 ? Math.round((faStats.seen / faStats.total) * 100) : 0;

  // Quick-nav stats for the strategy + error-log chips: which block of the plan
  // we're in, and whether the ENCODE step happened this week.
  const strategyStat = currentBlock()?.label || "התוכנית";
  const errorStat = useMemo(() => {
    const n = whyCounts(loadErrors(), isoDaysAgo(7)).total;
    return n ? `${n} השבוע` : "אין רישום";
  }, []);

  const latest = log[log.length - 1] || null;
  const cohortDelta = latest && Number.isFinite(latest.uworldAvg) ? Math.round(latest.score - latest.uworldAvg) : null;
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
              <span className={`hd-vital-n num${!loading && sched.dueNow > 0 ? " hot" : ""}`}>{loading ? "…" : <CountUp value={sched.dueNow} />}</span>
              <span className="hd-vital-l">לביקורת</span>
            </div>
            <div className="hd-vital">
              <span className="hd-vital-when">{loading ? "…" : sched.dueNow > 0 ? "עכשיו" : (nextWhen || "—")}</span>
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

          {/* A · Hero — Today (NBME countdown loudest, UWorld quota next, topics support) */}
          <section className="hd-card hd-hero hd-today c8"
            aria-label="המשימות שלי להיום">
            <div className="hd-hero-bg" aria-hidden="true" />
            <div className="hd-hero-main">
              <div className="hd-hero-head">
                <span className="hd-hero-ico" aria-hidden="true"><IconClipboard size={18} /></span>
                <span className="hd-hero-kicker">היום · מה באמת חשוב</span>
                {today && today.dayFraction < 1 && (
                  <span className="hd-half-chip">
                    {today.dayFraction === 0 ? "יום מנוחה" : today.dayFraction === 0.5 ? "חצי יום" : "יום מופחת"}
                  </span>
                )}
                {today?.hasPlan && (
                  <span className="hd-today-count num">{today.doneCount}/{today.totalCount} הושלמו</span>
                )}
              </div>

              {!today ? (
                <div className="hd-today-list"><span className="hd-today-skel" /><span className="hd-today-skel" /><span className="hd-today-skel" /></div>
              ) : (<>
                {/* 1 · The two numbers that matter — NBME (loudest) + UWorld quota */}
                <div className="hd-focus">
                  {today.nbme && (
                    <button className={`hd-nbme${today.nbme.days <= 3 ? " imminent" : ""}`} onClick={() => go("/planner")}
                      aria-label={`המבחן הבא: ${today.nbme.label}, בעוד ${today.nbme.days} ימים`}>
                      <span className="hd-nbme-txt">
                        <span className="hd-nbme-kicker">🧪 המבחן הבא · {heDate(today.nbme.iso)}</span>
                        <span className="hd-nbme-label" dir="ltr">{today.nbme.label}</span>
                      </span>
                      <span className="hd-nbme-days num">
                        {today.nbme.days === 0 ? "היום!" : today.nbme.days === 1 ? "מחר" : <>{today.nbme.days}<small> ימים</small></>}
                      </span>
                    </button>
                  )}
                  <button className="hd-uwq" onClick={() => go("/planner")}
                    aria-label={`יעד UWorld להיום: ${today.uworld.targetQ} שאלות`}>
                    <span className="hd-uwq-txt">
                      <span className="hd-uwq-kicker">🎯 UWorld היום</span>
                      <span className="hd-uwq-s num">
                        {today.uworld.goalQ > 0
                          ? `${today.uworld.doneQ}/${today.uworld.goalQ} · עד ${heDate(today.uworld.deadline)}`
                          : "לסיים לפני הטייפר"}
                      </span>
                    </span>
                    <span className={`hd-uwq-n num${today.uworld.done ? " done" : ""}`}>
                      {today.uworld.done && today.uworld.total ? today.uworld.total : today.uworld.targetQ}
                      <small> שאלות{today.uworld.done ? " ✓" : ""}</small>
                    </span>
                  </button>
                </div>

                {/* 2 · Topic suggestion — support, not the headline */}
                <div className="hd-sugg-h">
                  {today.isSuggestion ? "הצעת נושאים להיום (מהמתכנן)" : "הנושאים של היום"}
                  {today.planned.length > 2 && <span className="hd-sugg-more num"> · ‏+{today.planned.length - 2} במתכנן</span>}
                </div>
                <ul className="hd-today-list">
                  {today.planned.slice(0, 2).map((p) => (
                    <TaskRow key={p.key} done={p.done}
                      dot={colorFor(p.colorKey).hex}
                      title={p.system} note={p.detail}
                      right={p.minutes ? `${p.minutes}′` : null} />
                  ))}
                  {!today.planned.length && (
                    <li className="hd-today-more">אין בלוקים להיום — פתח את המתכנן לבחירת עומס</li>
                  )}
                  <TaskRow done={today.anki.done} emoji="🎴" title="Anki" note="חזרות מרווחות"
                    right={!loading && sched.dueNow > 0 ? `${sched.dueNow} ממתינות` : null} />
                </ul>
              </>)}
            </div>

            <div className="hd-hero-rail hd-today-rail">
              <div className="hd-ahead">
                <span className="hd-ahead-t"><IconTarget size={12} /> אבני דרך קרובות</span>
                {today?.milestones?.length ? (
                  <ul className="hd-ahead-list">
                    {today.milestones.slice(0, 4).map((m) => (
                      <li key={m.id}>
                        <span className="hd-ahead-lbl">{m.label}</span>
                        <span className="hd-ahead-when num">{m.days === 0 ? "היום" : m.days === 1 ? "מחר" : `${m.days} ימים`}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hd-ahead-none">אין מבחני הערכה מתוזמנים</p>
                )}
              </div>
              <button className="hd-hero-cta" onClick={() => go("/planner")}>
                {today?.hasPlan ? "פתח מתכנן" : "תכנן את היום"} <IconArrow size={15} className="mir" aria-hidden="true" />
              </button>
            </div>
          </section>

          {/* B · Countdown certificate */}
          <div className="hd-card hd-count c4">
            <div className="hd-count-frame" />
            <span className="hd-count-kicker">USMLE STEP 1</span>
            <div className="hd-count-gauge">
              <JourneyGauge pct={journeyPct} />
              <div className="hd-count-center">
                <span className="hd-count-num num">{days}</span>
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
                <button className="hd-ch-link" onClick={() => go("/tests")}>כל המבחנים <IconArrow size={13} className="mir" /></button>
              </span>
            </div>
            <div className="hd-traj-body">
              {log.length >= 2
                ? <Trajectory log={log} />
                : <div className="hd-empty">
                    <span className="hd-empty-ico"><IconPulse size={22} /></span>
                    <p>הוסף מבחן שני כדי לראות מגמה</p>
                    <button className="btn-secondary" onClick={() => go("/tests", { state: { openForm: true } })}>לרישום מבחן</button>
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
              <span className="hd-ch-meta">
                {!loading && sched.overdue > 0 && (
                  <span className="hd-chip num" style={{ color: "var(--bad)" }}>{sched.overdue} באיחור</span>
                )}
                <span className="hd-chip num">{loading ? "…" : `${loadTotal} בהמתנה`}</span>
              </span>
            </div>
            <ReviewBars days={sched.days} overdue={sched.overdue} dueToday={sched.dueToday} />
          </div>

          {/* F · First Aid coverage */}
          <button className="hd-card hd-fa c3" onClick={() => go("/fa")}>
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico gold"><IconBook size={15} /></span> כיסוי First Aid</span>
              <IconArrow size={15} className="hd-ch-arr mir" />
            </div>
            <div className="hd-fa-top">
              <span className="hd-fa-pct num">{loading ? "…" : <><CountUp value={faPct} />%</>}</span>
              <span className="hd-fa-of num">{loading ? "…" : `${faStats.seen} / ${faStats.total} נושאים`}</span>
            </div>
            <div className="hd-fa-rail" aria-hidden="true"><span style={{ width: `${faPct}%` }} /></div>
            {faNext.length ? (
              <ul className="hd-fa-next">
                <li className="hd-fa-next-h">הבא בתור</li>
                {faNext.map((c) => (
                  <li key={c.name} className="hd-fa-next-row">
                    <span className="hd-fa-next-dot" style={{ background: colorFor(c.name).hex }} />
                    <span className="hd-fa-next-name" dir="ltr">{c.name}</span>
                    <span className="hd-fa-next-frac num">{c.seen}/{c.total}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Constellation pct={faPct} />
            )}
            <span className="hd-fa-rest"><span className="num">{loading ? "…" : faStats.total - faStats.seen}</span> נושאים נותרו</span>
          </button>

          {/* G · Weak subjects */}
          <button className="hd-card hd-weak c3" onClick={() => go("/progress")}>
            <div className="hd-ch">
              <span className="hd-ch-t"><span className="hd-ch-ico bad"><IconTarget size={15} /></span> נקודות תורפה</span>
              <IconArrow size={15} className="hd-ch-arr mir" />
            </div>
            {weak.length ? (
              <ul className="hd-weak-list">
                {(() => { const missMax = Math.max(...weak.map((x) => x.kind === "miss" ? x.count : 0), 1); return weak.map((w, i) => {
                  // Bar encodes the printed number directly: pct rows draw the score
                  // (short bar = weak, red/amber keeps weakness salient); miss rows
                  // draw the miss count (long bar = weak, as before).
                  const width = w.kind === "pct" ? clamp(w.pct, 0, 100) : Math.round((w.count / missMax) * 100);
                  const bad = w.kind === "pct" ? w.pct < 60 : i === 0;
                  return (
                    <li key={w.name} className="hd-weak-row">
                      <div className="hd-weak-top">
                        <span className="hd-weak-name" dir="ltr">{w.name}</span>
                        <span className="hd-weak-val num">{w.kind === "pct" ? `${w.pct}%` : `${w.count} החמצות`}</span>
                      </div>
                      <span className="hd-weak-bar">
                        <span className={`hd-weak-fill${bad ? " worst" : ""}`} style={{ width: `${width}%` }} />
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
          <button className="hd-card hd-aims c3" onClick={() => go("/aims")}>
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
            <NavChip Icon={IconTarget} label="אסטרטגיה" stat={strategyStat} onClick={() => go("/strategy")} />
            <NavChip Icon={IconNote} label="יומן טעויות" stat={errorStat} onClick={() => go("/errors")} />
            <NavChip Icon={IconClipboard} label="מבחנים" stat={`${log.length} מבחנים`} onClick={() => go("/tests")} />
            <NavChip Icon={IconBox} label="בנק שאלות" stat={loading ? "…" : `${testStats.total || 0} שאלות`} onClick={() => go("/bank")} />
            <NavChip Icon={IconPulse} label="התקדמות" stat={`${masteredWeek} השבוע`} onClick={() => go("/progress")} />
            <NavChip Icon={IconBook} label="First Aid" stat={loading ? "…" : `${faPct}% כוסו`} onClick={() => go("/fa")} />
          </nav>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

// One row in the Today checklist: a check (filled when done), an emoji or colored
// subject dot, the task title, an optional note, and an optional right-side stat.
function TaskRow({ done, emoji, dot, title, note, right }) {
  return (
    <li className={`hd-trow${done ? " done" : ""}`}>
      <span className="hd-trow-box" aria-hidden="true">{done && <IconCheck size={11} />}</span>
      {emoji
        ? <span className="hd-trow-emoji" aria-hidden="true">{emoji}</span>
        : <span className="hd-trow-dot" style={{ background: dot || "var(--rail-gold)" }} aria-hidden="true" />}
      <span className="hd-trow-title">{title}</span>
      {note && <span className="hd-trow-note">{note}</span>}
      {right && <span className="hd-trow-right num">{right}</span>}
    </li>
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

// Semicircle journey gauge (green ripening into gold toward the exam). RTL: fills from the right.
function JourneyGauge({ pct }) {
  const len = Math.PI * 52; // half-circumference, r=52
  const off = len * (1 - clamp(pct, 0, 100) / 100);
  return (
    <svg className="hd-gauge" viewBox="0 0 120 68" role="img" aria-label={`${clamp(pct, 0, 100)}% מהמסע לבחינה הושלמו`}>
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

// Dual-line trajectory: my score vs UWorld average. RTL — newest on the left, oldest on the right.
function Trajectory({ log }) {
  const W = 1000, H = 164;
  const padT = 16, padB = 28, padL = 16, padR = 48;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = log.length;
  // Dynamic domain that never clips a real point (contains e.g. 28), padded for headroom.
  // Only finite values feed the scale — a NaN/undefined from bad synced data must not wipe the chart.
  const vals = log.flatMap((t) => [t.score, t.uworldAvg]).filter((v) => Number.isFinite(v));
  const LO = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10) : 0;
  const HI = vals.length ? Math.min(100, Math.ceil((Math.max(...vals) + 8) / 10) * 10) : 100;
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

  // Concise summary for screen readers: latest score + direction vs the previous test.
  const lastScore = log[n - 1].score;
  const prevScore = n >= 2 ? log[n - 2].score : null;
  const dir = !Number.isFinite(lastScore) || !Number.isFinite(prevScore) ? ""
    : lastScore > prevScore ? ", במגמת עלייה"
    : lastScore < prevScore ? ", במגמת ירידה"
    : ", ללא שינוי";
  const fmtDate = (t) => { const dt = new Date(t.date); return `${dt.getDate()}/${dt.getMonth() + 1}`; };

  return (
    <svg className="hd-traj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      role="img" aria-label={`מגמת ציונים: הציון האחרון ${Number.isFinite(lastScore) ? `${lastScore}%` : "לא זמין"}${dir}`}>
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
          <text x={W - padR + 7} y={yAt(g) + 3.5} className="hd-axis" textAnchor="start">{g}%</text>
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
        <circle key={i} cx={x} cy={y} r="4.2" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.4">
          <title>{`${log[i].score}% · ${fmtDate(log[i])}`}</title>
        </circle>
      ))}
      {/* x labels (date); the newest point is marked "עכשיו" as the RTL time-axis cue */}
      {log.map((t, i) => {
        if (n > 6 && i % 2 !== 0 && i !== n - 1) return null;
        const lbl = i === n - 1 ? "עכשיו" : fmtDate(t);
        return <text key={i} x={xAt(i)} y={H - padB + 16} className="hd-axis" textAnchor="middle">{lbl}</text>;
      })}
      {/* latest emphasis */}
      <circle cx={last[0]} cy={last[1]} r="10" fill="none" stroke="var(--gold-2)" strokeWidth="1.8" opacity="0.65" />
      <circle cx={last[0]} cy={last[1]} r="5.4" fill="var(--gold-2)" stroke="var(--surface)" strokeWidth="1.8" />
      <g transform={`translate(${last[0]}, ${last[1] - 17})`}>
        <rect x="-23" y="-18" width="46" height="23" rx="6" fill="var(--surface)" stroke="var(--gold-mid)" />
        <text x="0" y="-1.5" className="hd-traj-flag" textAnchor="middle">{log[n - 1].score}%</text>
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
  const peakIdx = days.reduce((best, x, i) => (x.count > days[best].count ? i : best), 0);
  const total = days.reduce((s, x) => s + x.count, 0);
  const dayLabel = (i) => (i === 0 ? "היום" : `בעוד ${i} ימים`);

  return (
    <svg className="hd-reviewbars" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      role="img" aria-label={`תחזית חזרות: ${total} שאלות ב־14 הימים הקרובים${overdue > 0 ? `, מתוכן ${overdue} באיחור` : ""}`}>
      <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="var(--line)" strokeWidth="1" />
      {days.map((day, i) => {
        const bw = Math.min(11, slot - 4);
        const cx = (W - padR) - (i + 0.5) * slot;
        const x = cx - bw / 2;
        if (!day.count) return <rect key={day.ms} x={x} y={base - 2} width={bw} height="2" rx="1" fill="var(--surface-3)" />;
        const h = Math.max(4, (day.count / max) * plotH);
        const peakText = i === peakIdx && (
          <text x={cx} y={base - h - 5} className="hd-bar-peak" textAnchor="middle">{day.count}</text>
        );
        if (day.isToday && overdue > 0) {
          const stackTotal = overdue + dueToday || day.count;
          const overH = h * (overdue / stackTotal);
          const dueH = h - overH;
          return (
            <g key={day.ms}>
              <g className="hd-bar hd-bar-today" style={{ animationDelay: `${i * 32}ms` }}>
                <rect x={x} y={base - overH} width={bw} height={overH} rx="0" fill="var(--bad)" opacity="0.85">
                  <title>{`${overdue} באיחור`}</title>
                </rect>
                <rect x={x} y={base - h} width={bw} height={dueH} rx="3" fill="url(#rgold)">
                  <title>{`${dayLabel(i)} · ${day.count}`}</title>
                </rect>
              </g>
              {peakText}
            </g>
          );
        }
        const fill = day.isToday ? "url(#rgold)" : i <= 7 ? "rgba(30,77,56,0.80)" : "rgba(30,77,56,0.42)";
        return (
          <g key={day.ms}>
            <rect className={`hd-bar${day.isToday ? " hd-bar-today" : ""}`} x={x} y={base - h} width={bw} height={h} rx="3" fill={fill}
              style={{ animationDelay: `${i * 32}ms` }}>
              <title>{`${dayLabel(i)} · ${day.count}`}</title>
            </rect>
            {peakText}
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
    <div className="hd-constel" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <span key={i} className={`hd-cdot${i < on ? " on" : ""}`} style={{ animationDelay: `${i * 11}ms` }} />
      ))}
    </div>
  );
}
