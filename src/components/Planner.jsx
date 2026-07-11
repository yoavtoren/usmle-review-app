import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconClock, IconCheck, IconClose, IconTarget, IconSparkle,
  IconChevronDown, IconArrow, IconBox, IconPulse, IconCalendar, IconClipboard,
} from "./icons.jsx";
import { GanttView, CalendarView, PlannerViewTabs } from "./PlannerViews.jsx";
import { getStreak, recordActivity, loadGeneralTasks } from "../lib/storage.js";
import {
  loadSched, ensureUnits, ensurePlanExtras, applyProfile, recomputeWeakness, planDay, rollover,
  recordDone, undoDone, recordMiss, toggleAnki, swapIn, searchUnits, feasibility,
  applyTriage, ankiNewCardHint, updateSettings, exportSched, importSched,
  setGoal, seedAssessments, upsertAssessment, logAssessment, removeAssessment,
  addTask, toggleTask, deleteTask, projectReadiness, effectiveTarget,
  pctToPredicted3, predicted3ToPct, toPredicted3, recordUworld,
  uworldPacing, todayISO, REASONS,
} from "../lib/scheduler.js";
import { colorFor, TRACKS } from "../lib/subjectColors.js";
import { impact, notification } from "../lib/haptics.js";

const BASE = import.meta.env.BASE_URL;

/* ─── data loading ─────────────────────────────────────────────────────────── */
function usePlanData() {
  const [plan, setPlan] = useState(null);
  const [deck, setDeck] = useState(null);
  const [seed, setSeed] = useState(null);
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = none
  useEffect(() => {
    fetch(`${BASE}topic-plan.json`).then((r) => r.json()).then(setPlan).catch(() => setPlan({ units: [] }));
    fetch(`${BASE}questions/deck.json`).then((r) => r.json()).then(setDeck).catch(() => setDeck({ questions: [] }));
    fetch(`${BASE}weakness-seed.json`).then((r) => r.json()).then(setSeed).catch(() => setSeed({ weak: [] }));
    fetch(`${BASE}profile.json`).then((r) => (r.ok ? r.json() : null)).then(setProfile).catch(() => setProfile(null));
  }, []);
  return { plan, deck, seed, profile };
}

export default function Planner() {
  const { plan, deck, seed, profile } = usePlanData();
  const nav = useNavigate();
  const units = plan?.units || [];
  const [sched, setSched] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("today");   // today | timeline | calendar
  const [undoable, setUndoable] = useState(null); // { key } — shows "Done — Undo" for ~10s
  const undoTimer = useRef();
  const [refreshMsg, setRefreshMsg] = useState(null); // transient "re-ranked" summary
  const [refreshedAt, setRefreshedAt] = useState(null);
  const refreshTimer = useRef();
  const date = todayISO();

  // One-time bootstrap: seed state, register units, backfill v2 extras
  // (goal + assessments + tasks), apply the student profile, ingest weakness, roll forward.
  useEffect(() => {
    if (!plan || !deck || !seed || profile === undefined) return;
    let s = loadSched({ examDate: plan.examDate, contentDeadline: plan.contentDeadline });
    s = ensureUnits(s, units);
    s = ensurePlanExtras(s);
    s = applyProfile(s, profile);
    s = recomputeWeakness(s, units, deck, seed);
    s = rollover(s, date);
    setSched(s);
    setReady(true);
  }, [plan, deck, seed, profile]); // eslint-disable-line

  useEffect(() => () => { clearTimeout(undoTimer.current); clearTimeout(refreshTimer.current); }, []);

  // Success chord exactly once, when the day first completes. Lives above the
  // early return so the hook count stays stable across the loading flip.
  const todayEntry = sched?.days?.[date];
  const allDone = !!(todayEntry?.capacity
    && (todayEntry.planned || []).length > 0
    && (todayEntry.planned || []).every((k) => (todayEntry.completed || []).includes(k))
    && todayEntry.ankiDone);
  const prevAllDone = useRef(false);
  useEffect(() => {
    if (allDone && !prevAllDone.current) notification("success");
    prevAllDone.current = allDone;
  }, [allDone]);

  if (!ready || !sched) {
    return <div className="page page-narrow"><div className="boot">Building your plan…</div></div>;
  }

  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
  const today = sched.days[date];
  const capacity = today?.capacity || null;
  const streak = getStreak();
  const feas = feasibility(sched, units, date);

  const plannedKeys = today?.planned || [];
  const completed = new Set(today?.completed || []);
  const activeKey = plannedKeys.find((k) => !completed.has(k) && sched.units[k]?.status !== "done");
  const activeUnit = activeKey ? byKey[activeKey] : null;

  /* ── mutators (each returns fresh state) ── */
  const mutate = (fn) => setSched((prev) => fn(prev));
  const pickCapacity = (cap) => mutate((s) => planDay(s, units, date, cap));
  const markDone = (key, mins) => {
    recordActivity();
    impact("light");
    mutate((s) => recordDone(s, key, mins, date));
    setUndoable({ key });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoable(null), 10000);
  };
  const onUndoDone = () => {
    if (!undoable) return;
    clearTimeout(undoTimer.current);
    mutate((s) => undoDone(s, undoable.key));
    setUndoable(null);
  };
  const markMiss = (key, reason, note) => mutate((s) => recordMiss(s, key, reason, note, date));
  const doSwap = (key) => mutate((s) => swapIn(s, units, key, date));
  const flipAnki = () => { if (!today?.ankiDone) impact("light"); mutate((s) => toggleAnki(s, date)); };
  const runTriage = () => mutate((s) => applyTriage(s, units, date).state);
  const onGoal = (patch) => mutate((s) => setGoal(s, patch));
  const onSettings = (patch) => mutate((s) => updateSettings(s, patch));
  // Changing the UWorld goal/offset re-plans today so the block's quota updates now.
  const onUworldGoal = (patch) => mutate((s) => {
    let ns = updateSettings(s, patch);
    const cap = ns.days?.[date]?.capacity;
    if (cap) ns = planDay(ns, units, date, cap);
    return ns;
  });
  // Changing the exam date re-dates only seeded/untaken/unedited checkpoints.
  const onExam = (d) => mutate((s) => seedAssessments(updateSettings(s, { examDate: d }), { force: true }));
  const onLogAssessment = (id, val) => mutate((s) => logAssessment(s, id, val, date));
  const onUpsertAssessment = (a) => mutate((s) => upsertAssessment(s, a));
  const onRemoveAssessment = (id) => mutate((s) => removeAssessment(s, id));
  const onResetSchedule = () => mutate((s) => seedAssessments(s, { force: true }));
  const onLogUworld = (result) => { recordActivity(); mutate((s) => recordUworld(s, units, result, date)); };
  const onAddTask = (text, opts) => { recordActivity(); mutate((s) => addTask(s, text, opts)); };
  const onToggleTask = (id) => {
    recordActivity();
    if (!sched.tasks?.find((t) => t.id === id)?.done) impact("light");
    mutate((s) => toggleTask(s, id));
  };
  const onDeleteTask = (id) => mutate((s) => deleteTask(s, id));

  // 🔄 Re-read the latest exam results + First Aid/deck progress, recompute every
  // unit's weakness, and (if today is already planned) rebuild today's plan around
  // the new priorities. Surfaces what moved so the re-ranking is visible.
  const onRefresh = () => {
    const before = weakRankBySystem(sched.units, units);
    let ns = recomputeWeakness(sched, units, deck, seed);
    const cap = ns.days?.[date]?.capacity;
    if (cap) ns = planDay(ns, units, date, cap);
    setSched(ns);
    const after = weakRankBySystem(ns.units, units);
    setRefreshMsg(diffRanking(before, after));
    setRefreshedAt(Date.now());
    notification("success");
    impact("light");
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshMsg(null), 9000);
  };

  const dedicated = sched.phase === "dedicated";
  const phaseBadge = dedicated ? { label: "Dedicated", cls: "ded" } : { label: "Content", cls: "con" };
  const examPassed = date > sched.settings.examDate;
  const readiness = projectReadiness(sched);
  const pacing = uworldPacing(sched, date);
  // Day progress: planned content blocks + Anki + the daily UWorld block.
  const dayTotal = plannedKeys.length + 1 + (today?.uworld ? 1 : 0);
  const dayDone = plannedKeys.filter((k) => completed.has(k)).length
    + (today?.ankiDone ? 1 : 0) + (today?.uworld?.done ? 1 : 0);
  // Read-only peek at the general (non-study) task store for a cross-link.
  const generalToday = loadGeneralTasks().filter((t) => !t.done && t.date && t.date <= date).length;
  const simToday = today?.assessmentToday
    ? (sched.assessments || []).find((a) => a.id === today.assessmentToday)
    : null;

  const statusStrip = (
    <StatusStrip
      feas={feas} settings={sched.settings} onTriage={runTriage}
      readiness={readiness} goal={sched.settings.goal} assessments={sched.assessments || []} onGoal={onGoal}
      pacing={pacing} onUworldGoal={onUworldGoal}
    />
  );
  const assessCard = (
    <AssessmentsCard
      assessments={sched.assessments || []} dedicated={dedicated} date={date} examISO={sched.settings.examDate}
      onLog={onLogAssessment} onUpsert={onUpsertAssessment} onRemove={onRemoveAssessment} onReset={onResetSchedule}
    />
  );

  const viewTitle = view === "timeline" ? "Timeline" : view === "calendar" ? "Calendar" : "Today";
  const standSection = (
    <section className="pl-section">
      <SectionHead
        title="Where you stand"
        sub="Schedule health, predicted score, and Qbank pace — tap a stat for the full story."
      />
      {statusStrip}
      {assessCard}
    </section>
  );

  return (
    <div className={`page planner ${view === "today" ? "page-narrow" : "pl-wide"}`} dir="ltr">
      {/* ═══ Header ═══ */}
      <header className="pl-head">
        <div className="pl-head-l">
          <p className="page-eyebrow">Step 1 · Adaptive planner</p>
          <h1 className="page-title">{viewTitle}<span className="pl-date">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span></h1>
        </div>
        <div className="pl-head-r">
          <span className={`pl-phase ${phaseBadge.cls}`}>{phaseBadge.label} phase</span>
          <span className="pl-streak"><IconSparkle size={13} /> <b className="num">{streak}</b> day streak</span>
          <button className="pl-refresh-btn" onClick={onRefresh}
            title="Pull in your newest exam scores + First Aid progress and re-order the plan">
            <span className="pl-refresh-ico" aria-hidden="true">🔄</span> Re-prioritize
          </button>
        </div>
      </header>

      {/* ═══ View switcher (Today · Timeline · Calendar) ═══ */}
      <PlannerViewTabs view={view} onView={setView} />

      {/* Transient "what moved" note after a re-prioritize */}
      {refreshMsg && <div className="pl-refresh-toast">{refreshMsg}</div>}

      {view === "timeline" && <GanttView sched={sched} units={units} />}
      {view === "calendar" && <CalendarView sched={sched} units={units} nav={nav} />}

      {/* Terminal state: past the exam date, scheduling output is meaningless. */}
      {view === "today" && examPassed && (
        <div className="pl-card pl-alldone">
          <span className="pl-alldone-ico"><IconCheck size={22} /></span>
          <div>
            <h3>Exam date has passed</h3>
            <p className="muted">
              This plan ended {fmtShort(sched.settings.examDate)}. Set a new exam date in
              Settings &amp; backup below, or export your progress there to archive the plan.
            </p>
          </div>
        </div>
      )}

      {view === "today" && !examPassed && (<>
      {/* In dedicated phase, the scoreboard + checkpoints lead. */}
      {dedicated && standSection}

      {/* ═══ ① Today's plan — the one required action, then the checklist ═══ */}
      {!capacity ? (
        <section className="pl-section">
          <CapacityHero presets={sched.settings.capacityPresets} bias={sched.adaptation.capacityBiasMin} onPick={pickCapacity} />
        </section>
      ) : (
        <section className="pl-section">
          <SectionHead
            title="Today's plan"
            sub={dayTotal > 0
              ? <><b className="num">{dayDone}</b> of <span className="num">{dayTotal}</span> done — Anki first, then content blocks, then UWorld.</>
              : "Anki first, then content blocks, then UWorld."}
            right={<CapacityChips current={capacity} presets={sched.settings.capacityPresets} bias={sched.adaptation.capacityBiasMin} onPick={pickCapacity} />}
          />

          {simToday && <SimDayBanner sim={simToday} onLog={onLogAssessment} />}
          {allDone && <DayComplete streak={streak} />}

          {/* Anki — protected, always first */}
          <AnkiCard
            done={today?.ankiDone}
            reserve={today?.ankiReserveMin}
            newCards={ankiNewCardHint(sched, capacity, date)}
            activeSystem={activeUnit?.system}
            dedicated={dedicated}
            onToggle={flipAnki}
          />

          {/* Transient undo affordance after "Mark done" */}
          {undoable && (
            <div className="pl-done-banner">
              <span className="pl-done-ico"><IconCheck size={16} /></span>
              <span>Done · <button className="btn-ghost btn-xs" onClick={onUndoDone}>Undo</button></span>
            </div>
          )}

          {/* Active task — keyed so Start/reason state never leaks to the next unit */}
          {activeUnit ? (
            <ActiveTask
              key={activeUnit.key}
              unit={activeUnit}
              state={sched.units[activeUnit.key]}
              onDone={(mins) => markDone(activeUnit.key, mins)}
              onMiss={(reason, note) => markMiss(activeUnit.key, reason, note)}
              blockMinutes={sched.settings.blockMinutes}
              dedicated={dedicated}
            />
          ) : (
            <div className="pl-card pl-alldone">
              <span className="pl-alldone-ico"><IconCheck size={22} /></span>
              <div><h3>Content blocks cleared</h3><p className="muted">Every planned unit is done. Add capacity to pull more forward, or rest.</p></div>
            </div>
          )}

          {/* 🎯 Daily UWorld block */}
          <UworldBlock
            uworld={today?.uworld} minutes={today?.uworldMin || 0} phase={sched.phase}
            byKey={byKey} onLog={onLogUworld} pacing={pacing}
          />

          {/* Today's tasks */}
          <TasksCard tasks={sched.tasks || []} date={date} onAdd={onAddTask} onToggle={onToggleTask} onDelete={onDeleteTask} generalCount={generalToday} nav={nav} />

          {/* Up next */}
          <UpNext
            keys={plannedKeys.filter((k) => k !== activeKey && !completed.has(k))}
            byKey={byKey}
            states={sched.units}
          />

          {/* Question practice (bank / tests links) */}
          <PracticeCard nav={nav} />
        </section>
      )}

      {/* ═══ ② Where you stand (content phase: after the plan) ═══ */}
      {!dedicated && standSection}

      {/* ═══ ③ Tune the plan ═══ */}
      <section className="pl-section">
        <SectionHead
          title="Tune the plan"
          sub="Not feeling today's lineup? Swap a topic in, or pull a weak spot forward."
        />
        <SwapPanel units={units} states={sched.units} onSwap={doSwap} plannedKeys={plannedKeys} />
        <WeakSpots units={units} states={sched.units} onFocus={doSwap} plannedKeys={plannedKeys} />
      </section>
      </>)}

      {/* Settings / backup */}
      <PlannerFooter sched={sched} onImport={(s) => setSched(s)} onExam={onExam} onSettings={onSettings} onReset={onResetSchedule} />
    </div>
  );
}

/* ─────────────────────────── inline confirm ─────────────────────────── */
// Two-tap destructive action: first tap arms ("Sure?"), second tap executes.
// Disarms automatically after 3s. `label` may be JSX (e.g. an icon).
function ConfirmButton({ className, label, armedLabel = "Sure?", onConfirm, ...rest }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = () => {
    if (armed) { clearTimeout(timer.current); setArmed(false); onConfirm(); return; }
    setArmed(true);
    impact("medium");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };
  return (
    <button {...rest} className={className} onClick={click}
      style={armed ? { color: "var(--bad)", ...(rest.style || {}) } : rest.style}>
      {armed ? armedLabel : label}
    </button>
  );
}

/* ─────────────────────────── section header ─────────────────────────── */
function SectionHead({ title, sub, right }) {
  return (
    <div className="pl-sec-head">
      <div className="pl-sec-head-l">
        <h2 className="pl-sec-title">{title}</h2>
        {sub && <p className="pl-sec-sub">{sub}</p>}
      </div>
      {right && <div className="pl-sec-head-r">{right}</div>}
    </div>
  );
}

/* ─────────────────────────── where you stand ───────────────────────────
   One strip, three stats — schedule health, predicted score, UWorld pace.
   Each cell expands into a plain-language detail panel with its controls. */
function StatusStrip({ feas, settings, onTriage, readiness, goal, assessments, onGoal, pacing, onUworldGoal }) {
  const [open, setOpen] = useState(null); // 'sched' | 'score' | 'pace' | null
  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const r = readiness;
  const p = pacing;
  const loadPct = Math.round(feas.ratio * 100);
  const schedLabel = { green: "On track", amber: "Slightly behind", red: "Behind", ahead: "Ahead of pace" }[feas.status];

  return (
    <div className="pl-card pl-status">
      <div className="pl-status-row">
        <StatCell k="sched" open={open} onToggle={toggle} label="Schedule">
          <span className={`pl-stat-val pl-stat-sched ${feas.status}`}><span className="pl-stat-dot" />{schedLabel}</span>
          <span className="pl-stat-sub">finish ~{feas.etaLabel} · <span className="num">{loadPct}%</span> loaded</span>
        </StatCell>
        <StatCell k="score" open={open} onToggle={toggle} label="Predicted score">
          <span className="pl-stat-val num">{r.status === "baseline" ? "—" : r.projected}</span>
          <span className="pl-stat-sub">
            {r.status === "baseline" ? "log your first NBME" : <>goal <span className="num">{r.target}</span> · {r.gap >= 0 ? "+" : ""}<span className="num">{r.gap}</span></>}
          </span>
        </StatCell>
        <StatCell k="pace" open={open} onToggle={toggle} label="UWorld pace">
          <span className="pl-stat-val num">{p.goal > 0 ? (p.complete ? "✓" : <>{p.perDay}<small>/day</small></>) : "—"}</span>
          <span className="pl-stat-sub">
            {p.goal > 0
              ? (p.complete ? "Qbank goal reached" : <><span className="num">{p.pct}%</span> of <span className="num">{p.goal.toLocaleString()}</span> Qs</>)
              : "set a Qbank goal"}
          </span>
        </StatCell>
      </div>
      {open === "sched" && <SchedDetail feas={feas} settings={settings} onTriage={onTriage} readiness={readiness} />}
      {open === "score" && <ScoreDetail readiness={readiness} goal={goal} assessments={assessments} onGoal={onGoal} />}
      {open === "pace" && <PaceDetail pacing={pacing} onGoal={onUworldGoal} />}
    </div>
  );
}

function StatCell({ k, open, onToggle, label, children }) {
  const isOpen = open === k;
  return (
    <button className={`pl-stat${isOpen ? " open" : ""}`} onClick={() => onToggle(k)} aria-expanded={isOpen}>
      <span className="pl-stat-lbl">{label}</span>
      {children}
      <span className={`pl-stat-chev${isOpen ? " flip" : ""}`}><IconChevronDown size={13} /></span>
    </button>
  );
}

// Schedule health: workload vs. the time left before the content deadline.
function SchedDetail({ feas, settings, onTriage, readiness }) {
  const loadPct = Math.round(feas.ratio * 100);
  const fillPct = Math.max(4, Math.min(100, loadPct));
  const over = feas.ratio > 1;
  const belowGoal = readiness && readiness.status !== "baseline" && readiness.gap < -5;
  return (
    <div className={`pl-stat-detail pl-sd ${feas.status}`}>
      <p className="pl-stat-explain">
        You have about <b className="num">{Math.round(feas.remainingMin / 60)}h</b> of study left
        (<b className="num">{feas.finishDays}</b> day{feas.finishDays === 1 ? "" : "s"} of work) and{" "}
        <b className="num">{feas.daysLeft}</b> days until the {fmtShort(settings.contentDeadline)} content deadline.
        At your current pace you'd finish around <b>{feas.etaLabel}</b>
        {over ? " — that's more work than time, so trim low-yield topics or add capacity." : "."}
      </p>
      <div className="pl-sd-track" title={`Workload is ${loadPct}% of remaining capacity`}>
        <span className="pl-sd-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <div className="pl-sd-foot">
        <span className="muted">Bar shows workload as a share of the time you have — a full bar means over-committed.</span>
        <span className="pl-sd-foot-actions">
          {belowGoal && <span className="pl-sd-advisory">Trend below goal — weight weak systems</span>}
          {(feas.status === "amber" || feas.status === "red") && (
            <button className="btn-secondary btn-xs" onClick={onTriage}>Auto-triage low-yield</button>
          )}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────── capacity ─────────────────────────── */
const CAP_OPTS = [
  { key: "low", emoji: "🌱", name: "Low", desc: "Anki + one unit" },
  { key: "med", emoji: "🌿", name: "Medium", desc: "a focused set" },
  { key: "high", emoji: "🌳", name: "High", desc: "a full day" },
];

// The hero card shown until the day is sized — the page's one required action.
function CapacityHero({ presets, bias, onPick }) {
  return (
    <div className="pl-card pl-caphero">
      <p className="pl-caphero-eyebrow">Start here</p>
      <h2 className="pl-caphero-t">How much energy do you have today?</h2>
      <p className="pl-caphero-sub">
        Pick a size and I'll build today's checklist — Anki first, then your highest-priority
        topics, then a UWorld block.
        {bias ? <span className="pl-cap-bias">sized −{bias}m from your recent days</span> : null}
      </p>
      <div className="pl-cap-row">
        {CAP_OPTS.map((o) => {
          const mins = presets[o.key] - (bias || 0);
          return (
            <button key={o.key} className="pl-cap-btn" onClick={() => onPick(o.key)}>
              <span className="pl-cap-emoji">{o.emoji}</span>
              <span className="pl-cap-name">{o.name}</span>
              <span className="pl-cap-mins num">~{Math.round(mins / 60 * 10) / 10}h</span>
              <span className="pl-cap-desc">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Once sized, the picker collapses to these chips so the day can be resized.
function CapacityChips({ current, presets, bias, onPick }) {
  return (
    <div className="pl-capchips" title="Resize today's plan">
      {CAP_OPTS.map((o) => {
        const mins = presets[o.key] - (bias || 0);
        return (
          <button key={o.key} className={`pl-capchip${current === o.key ? " on" : ""}`} onClick={() => onPick(o.key)}>
            {o.emoji} {o.name} <span className="num">~{Math.round(mins / 60 * 10) / 10}h</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Anki ─────────────────────────── */
function AnkiCard({ done, reserve, newCards, activeSystem, dedicated, onToggle }) {
  return (
    <div className={`pl-card pl-anki${done ? " done" : ""}`}>
      <button className={`pl-check${done ? " on" : ""}`} onClick={onToggle} aria-label="Toggle Anki done">
        {done ? <IconCheck size={16} /> : null}
      </button>
      <div className="pl-anki-body">
        <div className="pl-anki-head">
          <h3>Anki — due reviews</h3>
          <span className="pl-anki-reserve num">{reserve}m reserved</span>
        </div>
        <p className="muted">
          {done ? "Reviews cleared for today. ✓" : "Clear your due cards first — it's block #1 and can't be crowded out."}
          {dedicated && !done && <> Reviews + UWorld-miss unsuspends.</>}
          {newCards > 0 && !done && <> New cards: <b className="num">~{newCards}</b>{activeSystem && <> · unsuspend <code>#AK_Step1::…::{shortSys(activeSystem)}</code></>}</>}
          {newCards === 0 && !done && <> New cards paused (exam taper).</>}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── active task ─────────────────────────── */
function ActiveTask({ unit, state, onDone, onMiss, blockMinutes, dedicated }) {
  const [asking, setAsking] = useState(false);
  const [started, setStarted] = useState(false);
  const weak = (state?.weaknessScore || 0) >= 0.4;
  const slipped = (state?.postponeCount || 0) >= 3;
  const blocks = Math.max(1, Math.round(unit.estMinutes / blockMinutes));

  const c = colorFor(unit.colorKey || unit.system);
  const trackLabel = unit.track === "basics" ? "🧊 Basics" : "🔥 Anchor";
  return (
    <div className={`pl-card pl-active${weak ? " weak" : ""}`}>
      <div className="pl-active-rail" style={{ background: c.hex }} />
      <div className="pl-active-body">
        <div className="pl-active-top">
          <span className="pl-active-kicker">{dedicated ? "Targeted review" : trackLabel} · <span className="pl-subj-emoji">{c.emoji}</span>{unit.system}</span>
          <YieldStars n={unit.yieldWeight} />
        </div>
        <h2 className="pl-active-title">{unit.chapter.replace(/^\d+\s/, "")} <span className="pl-sep">›</span> {unit.subsection.replace(/^\d+\s/, "")}</h2>

        <div className="pl-active-meta">
          <span className="pl-meta-pill"><IconClock size={12} /> ~{unit.estMinutes}m · {blocks} block{blocks > 1 ? "s" : ""}</span>
          <span className="pl-meta-pill"><IconBox size={12} /> {unit.topicCount} topic{unit.topicCount !== 1 ? "s" : ""}</span>
          {(state?.postponeCount || 0) >= 1 && (
            <span className="pl-meta-pill" title="Rolled over from a previous day">↻ rolled over ×{state.postponeCount}</span>
          )}
          {weak && <span className="pl-meta-pill danger"><IconTarget size={12} /> weak spot · {Math.round(state.weaknessScore * 100)}%</span>}
          {unit.resources.map((r) => <span key={r} className="pl-res">{r}</span>)}
        </div>

        {slipped && (
          <div className="pl-slip">
            <span>⚠ This has slipped {state.postponeCount}× — break it into a smaller piece, or is something blocking it?</span>
            <div className="pl-slip-btns">
              <button className="btn-secondary btn-xs" onClick={() => onDone(Math.round(unit.estMinutes / 2))}>Do half now</button>
              <button className="btn-ghost btn-xs" onClick={() => setAsking(true)}>Something's blocking it</button>
            </div>
          </div>
        )}

        {!asking ? (
          <div className="pl-active-actions">
            {!started
              ? <button className="btn-primary" onClick={() => setStarted(true)}>Start block</button>
              : <button className="btn-primary" onClick={() => onDone(unit.estMinutes)}><IconCheck size={15} /> Mark done</button>}
            <button className="btn-ghost" onClick={() => setAsking(true)}>Can't do this</button>
          </div>
        ) : (
          <div className="pl-reasons">
            <div className="pl-reasons-lbl">What got in the way? <button className="pl-reasons-x" onClick={() => setAsking(false)}><IconClose size={13} /></button></div>
            <div className="pl-reasons-row">
              {REASONS.map((r) => (
                <button key={r.code} className="pl-reason" onClick={() => { onMiss(r.code, ""); setAsking(false); }}>
                  <span className="pl-reason-ico">{r.icon}</span>{r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── up next ─────────────────────────── */
function UpNext({ keys, byKey, states }) {
  const [open, setOpen] = useState(false);
  if (!keys.length) return null;
  return (
    <div className="pl-card pl-upnext">
      <button className="pl-upnext-head" onClick={() => setOpen((o) => !o)}>
        <span className="pl-upnext-t">Up next <span className="pl-upnext-n num">{keys.length}</span></span>
        <span className={`pl-upnext-chev${open ? " open" : ""}`}><IconChevronDown size={16} /></span>
      </button>
      {open && (
        <ul className="pl-upnext-list">
          {keys.map((k) => {
            const u = byKey[k]; if (!u) return null;
            const weak = (states[k]?.weaknessScore || 0) >= 0.4;
            const slips = states[k]?.postponeCount || 0;
            const c = colorFor(u.colorKey || u.system);
            return (
              <li key={k} className="pl-upnext-item">
                <span className="pl-upnext-dot" style={{ background: c.hex }} />
                <span className="pl-subj-emoji">{c.emoji}</span>
                <span className="pl-upnext-name">{u.chapter.replace(/^\d+\s/, "")} <span className="pl-sep">›</span> {u.subsection.replace(/^\d+\s/, "")}</span>
                {slips >= 1 && <span className="pl-upnext-flag" title="Rolled over from a previous day">↻×{slips}</span>}
                {weak && <span className="pl-upnext-flag">weak</span>}
                <span className="pl-upnext-min num">{u.estMinutes}m</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── 🎯 daily UWorld block ─────────────────────────── */
// The reserved, animated (can't-miss) daily UWorld item. Do the block, then log
// correct/total and tap the subject chips you missed — misses raise those units'
// weakness and become tomorrow's "study this miss" targets (§16).
function UworldBlock({ uworld, minutes, phase, byKey, onLog, pacing }) {
  const dedicated = phase === "dedicated";
  const uw = uworld || {};
  const [correct, setCorrect] = useState("");
  const [total, setTotal] = useState(String(uw.targetQ || (dedicated ? 40 : 20)));
  const [missed, setMissed] = useState([]);

  const qCount = uw.targetQ || (dedicated ? 40 : Math.max(10, Math.round(minutes / 1.5)));
  const quota = uw.quotaQ ?? pacing?.perDay;
  const systems = Array.from(new Set(Object.values(byKey).map((u) => u.system))).sort();
  const studyLabels = (uw.studyTargets || []).map((k) => byKey[k]).filter(Boolean);

  const toggleSys = (sys) => setMissed((m) => (m.includes(sys) ? m.filter((x) => x !== sys) : [...m, sys]));
  const submit = () => {
    // Clamp before saving: both >= 0, and correct can never exceed total.
    const t = total === "" ? null : Math.max(0, Math.round(Number(total) || 0));
    let c = correct === "" ? null : Math.max(0, Math.round(Number(correct) || 0));
    if (c != null && t != null && c > t) c = t;
    onLog({ correct: c, total: t, missedSystems: missed });
  };

  return (
    <div className="pl-card pl-uworld-card">
      <div className="pl-uw-top">
        <span className="pl-uw-emoji">{TRACKS.uworld.emoji}</span> Today's UWorld
      </div>
      <p>
        {dedicated
          ? <>Random / timed <b>{qCount}-Q</b> block · review every question.</>
          : <><b>{qCount}</b> questions · {uw.system && uw.system !== "mixed" ? <>focused on <b>{shortSys(uw.system)}</b></> : "mixed"} · tutor mode · study every miss.</>}
      </p>
      {quota > 0 && !pacing?.complete && (
        <div className="pl-uw-pace">📈 Pace to your goal: <b className="num">{quota}</b> Qs/day{pacing?.deadline ? <> to finish the Qbank by {fmtShort(pacing.deadline)}</> : null}.</div>
      )}
      {pacing?.complete && <div className="pl-uw-pace done">✓ Qbank goal reached — keep any extra reps for weak systems.</div>}

      {studyLabels.length > 0 && (
        <div className="pl-uw-study">
          📌 Study yesterday's misses first: {studyLabels.map((u) => cleanChap(u)).join(" · ")}
        </div>
      )}

      {uw.done ? (
        <div className="pl-uw-done">
          ✓ Logged {uw.correct != null && uw.total != null ? `${uw.correct}/${uw.total}` : "block"}
          {uw.missedSystems?.length ? ` · re-testing ${uw.missedSystems.map(shortSys).join(", ")}` : ""}
        </div>
      ) : (
        <>
          <div className="pl-uw-log">
            <input type="number" min="0" placeholder="✓" value={correct} onChange={(e) => setCorrect(e.target.value)} aria-label="Correct" />
            <span className="pl-uw-slash">/</span>
            <input type="number" min="0" placeholder="#" value={total} onChange={(e) => setTotal(e.target.value)} aria-label="Total" />
            <button className="pl-uw-btn" onClick={submit}>Log block</button>
          </div>
          <div className="pl-uw-miss-lbl">Tap the subjects you missed — they resurface tomorrow:</div>
          <div className="pl-uw-chips">
            {systems.map((sys) => (
              <button key={sys} className={`pl-uw-chip${missed.includes(sys) ? " on" : ""}`} onClick={() => toggleSys(sys)}>
                <span>{colorFor(sys).emoji}</span> {shortSys(sys)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── question practice ─────────────────────────── */
function PracticeCard({ nav }) {
  return (
    <div className="pl-card pl-practice">
      <div className="pl-practice-head">
        <span className="pl-practice-t"><IconPulse size={15} /> Question practice</span>
      </div>
      <div className="pl-practice-links">
        <button className="pl-practice-chip" onClick={() => nav("/bank")}><IconBox size={15} /> Question bank <IconArrow size={13} className="mir" /></button>
        <button className="pl-practice-chip" onClick={() => nav("/tests")}><IconClipboard size={15} /> Tests &amp; trajectory <IconArrow size={13} className="mir" /></button>
      </div>
    </div>
  );
}

/* ─────────────────────────── UWorld pace detail ─────────────────────────── */
// Turns a total Qbank goal + your logged progress into a per-day question quota
// that keeps you on pace for the content deadline.
function PaceDetail({ pacing, onGoal }) {
  const [goal, setGoalVal] = useState(String(pacing.goal || ""));
  const [done, setDoneVal] = useState("");
  const p = pacing;
  const save = () => {
    const patch = { uworldGoalTotal: Math.max(0, Math.round(Number(goal) || 0)) };
    if (done !== "") patch.uworldDoneOffset = Math.max(0, Math.round(Number(done) || 0));
    onGoal(patch);
    setDoneVal("");
  };
  return (
    <div className="pl-stat-detail">
      {p.goal > 0 ? (
        <>
          <p className="pl-stat-explain">
            {p.complete
              ? <>Qbank goal reached — put any extra blocks into your weakest systems.</>
              : <><b className="num">{p.remaining.toLocaleString()}</b> questions left over{" "}
                <b className="num">{p.daysLeft}</b> day{p.daysLeft === 1 ? "" : "s"} — that's{" "}
                <b className="num">{p.perDay}</b> a day to finish the Qbank by {fmtShort(p.deadline)}.</>}
          </p>
          <div className="pl-pace-bar"><span style={{ width: `${p.pct}%` }} /></div>
          <div className="pl-pace-sub muted">
            <b className="num">{p.done.toLocaleString()}</b> / <span className="num">{p.goal.toLocaleString()}</span> done · {p.pct}%
          </div>
        </>
      ) : (
        <p className="pl-stat-explain">Set a total Qbank goal to get a daily question quota that keeps you on pace.</p>
      )}
      <div className="pl-pace-edit">
        <label className="pl-set-field sm"><span>Total Qbank Qs</span>
          <input type="number" min="0" value={goal} onChange={(e) => setGoalVal(e.target.value)} /></label>
        <label className="pl-set-field sm"><span>Already done</span>
          <input type="number" min="0" placeholder={String(p.done)} value={done} onChange={(e) => setDoneVal(e.target.value)} /></label>
        <button className="btn-primary btn-xs" onClick={save}>Save</button>
      </div>
    </div>
  );
}

/* ─────────────────────────── score goal + readiness detail ─────────────────────────── */
function ScoreDetail({ readiness, goal, assessments, onGoal }) {
  const [editing, setEditing] = useState(false);
  const r = readiness;
  const takenPts = (assessments || []).filter((a) => a.takenDate && a.actual != null)
    .map((a) => ({ t: a.takenDate, y: toPredicted3(a) }))
    .sort((x, y) => (x.t < y.t ? -1 : 1));

  const statusClass = { on_track: "ok", close: "warn", behind: "warn", at_risk: "bad", baseline: "mut" }[r.status] || "mut";
  const verdict = (() => {
    if (r.status === "baseline") return "Take NBME 26 to unlock a readiness projection — log it under Checkpoints below.";
    const wk = r.slopePerWeek ? `${r.slopePerWeek > 0 ? "+" : ""}${r.slopePerWeek}/wk` : "flat";
    if (r.status === "on_track") return `Trending to ~${r.projected} by exam day — +${r.passMargin} above the 196 pass line. Hold the line.`;
    if (r.status === "at_risk") return `Projecting ~${r.projected}. Focus weak systems and bank your next UWSA.`;
    return `About ${Math.abs(r.gap)} pts from goal; last ${r.n} checkpoints trending ${wk} — +${r.passMargin} above pass.`;
  })();

  return (
    <div className="pl-stat-detail">
      {r.status !== "baseline" && (
        <div className="pl-goal-body">
          <div className="pl-goal-num-wrap">
            <span className={`pl-goal-big num ${statusClass}`}>{r.projected}</span>
            <span className="pl-goal-band num">band {r.band[0]}–{r.band[1]}</span>
            <div className="pl-goal-chips">
              <span className={`pl-goal-chip ${r.gap >= 0 ? "ok" : "bad"}`}>{r.gap >= 0 ? "+" : ""}{r.gap} vs goal {r.target}</span>
              <span className={`pl-goal-chip ${r.passMargin >= 0 ? "ok" : "bad"}`}>{r.passMargin >= 0 ? "+" : ""}{r.passMargin} vs pass 196</span>
            </div>
          </div>
          <ReadinessSpark pts={takenPts} target={r.target} passLine={r.passLine} />
        </div>
      )}
      <p className="pl-stat-explain">{verdict}</p>
      <div className="pl-goal-detail-foot">
        <button className="btn-secondary btn-xs" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Set goal"}</button>
        <span className="pl-goal-foot muted">Step 1 is pass/fail — these are <em>predicted</em> equivalents (±~10), not official scores.</span>
      </div>
      {editing && <GoalEditor goal={goal} onGoal={onGoal} />}
    </div>
  );
}

function GoalEditor({ goal, onGoal }) {
  return (
    <div className="pl-goal-editor">
      <div className="pl-seg">
        <button className={`pl-seg-btn${goal.mode === "pass" ? " on" : ""}`} onClick={() => onGoal({ mode: "pass" })}>Comfortably passing</button>
        <button className={`pl-seg-btn${goal.mode === "predicted" ? " on" : ""}`} onClick={() => onGoal({ mode: "predicted" })}>Aim for a predicted score</button>
      </div>
      {goal.mode === "pass" ? (
        <div className="pl-goal-steppers">
          {[{ k: 8, l: "Slim" }, { k: 14, l: "Comfortable" }, { k: 30, l: "Strong" }].map((o) => (
            <button key={o.k} className={`pl-chipbtn${goal.buffer === o.k ? " on" : ""}`} onClick={() => onGoal({ buffer: o.k })}>
              {o.l} <span className="num">+{o.k}</span>
            </button>
          ))}
          <span className="pl-goal-eff muted">= target <b className="num">{(goal.passLine || 196) + (goal.buffer || 0)}</b></span>
        </div>
      ) : (
        <label className="pl-goal-target">
          <span>Predicted target</span>
          <input type="number" min="196" max="280" value={goal.target}
            onChange={(e) => { const v = Math.max(196, Math.min(280, Number(e.target.value) || 196)); onGoal({ target: v }); }} />
        </label>
      )}
    </div>
  );
}

// Inline sparkline of predicted score over taken assessments, with target + 196 pass lines.
function ReadinessSpark({ pts, target, passLine }) {
  if (!pts.length) return null;
  const W = 240, H = 68, padX = 8, padY = 10;
  const ys = pts.map((p) => p.y).concat([target, passLine]);
  const lo = Math.min(...ys) - 6, hi = Math.max(...ys) + 6;
  const xAt = (i) => padX + (pts.length <= 1 ? (W - 2 * padX) / 2 : (i / (pts.length - 1)) * (W - 2 * padX));
  const yAt = (v) => padY + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - 2 * padY);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)}`).join(" ");
  return (
    <svg className="pl-goal-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={padX} y1={yAt(passLine)} x2={W - padX} y2={yAt(passLine)} stroke="var(--bad)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <line x1={padX} y1={yAt(target)} x2={W - padX} y2={yAt(target)} stroke="var(--gold)" strokeWidth="1" strokeDasharray="4 3" opacity="0.75" />
      {pts.length > 1 && <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r="2.8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.6" />)}
    </svg>
  );
}

/* ─────────────────────────── today's tasks ─────────────────────────── */
function TasksCard({ tasks, date, onAdd, onToggle, onDelete, generalCount = 0, nav }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const visible = tasks.filter((t) =>
    !t.dueISO || t.dueISO === date || (t.dueISO < date && !t.done) ||
    (t.done && t.doneISO === date));
  const openCount = visible.filter((t) => !t.done).length;
  const submit = () => { if (text.trim()) { onAdd(text, { dueISO: due || null }); setText(""); setDue(""); } };

  return (
    <div className="pl-card pl-tasks">
      <div className="pl-tasks-head">
        <span className="pl-tasks-t">Today's tasks {openCount > 0 && <span className="pl-tasks-n num">{openCount}</span>}</span>
      </div>
      <div className="pl-tasks-add">
        <input className="pl-tasks-input" placeholder="Add a study task… (Enter)" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <input className="pl-tasks-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} title="Optional due date" />
        <button className="btn-secondary btn-xs" onClick={submit}>Add</button>
      </div>
      {visible.length > 0 && (
        <ul className="pl-tasks-list">
          {visible.map((t) => {
            const overdue = t.dueISO && t.dueISO < date && !t.done;
            return (
              <li key={t.id} className={`pl-tasks-item${t.done ? " done" : ""}`}>
                <button className={`pl-check sm${t.done ? " on" : ""}`} onClick={() => onToggle(t.id)} aria-label="toggle task">
                  {t.done ? <IconCheck size={13} /> : null}
                </button>
                <span className="pl-tasks-text">{t.text}</span>
                {overdue && <span className="pl-tasks-flag">overdue</span>}
                {t.dueISO && !overdue && !t.done && <span className="pl-tasks-due num">{fmtShort(t.dueISO)}</span>}
                <ConfirmButton className="pl-tasks-del" aria-label="delete task"
                  label={<IconClose size={12} />} onConfirm={() => onDelete(t.id)} />
              </li>
            );
          })}
        </ul>
      )}
      {generalCount > 0 && (
        <button className="btn-ghost btn-xs" style={{ alignSelf: "flex-start", marginTop: 6 }}
          onClick={() => nav && nav("/tasks")}>
          +{generalCount} general task{generalCount > 1 ? "s" : ""} today →
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── assessments / simulations ─────────────────────────── */
function SimDayBanner({ sim, onLog }) {
  const [val, setVal] = useState("");
  const isPct = sim.unit === "percent";
  return (
    <div className="pl-done-banner pl-simday">
      <span className="pl-done-ico"><IconCalendar size={16} /></span>
      <div className="pl-simday-body">
        <span>Sim day: <b>{sim.label}</b>. Take it timed, then log your score.</span>
        <div className="pl-simday-log">
          <input type="number" className="pl-assess-input" placeholder={isPct ? "% correct" : "predicted"} value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn-primary btn-xs" onClick={() => val !== "" && onLog(sim.id, Number(val))}>Log score</button>
        </div>
      </div>
    </div>
  );
}

function AssessmentsCard({ assessments, dedicated, date, examISO, onLog, onUpsert, onRemove, onReset }) {
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const sorted = [...assessments].sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1));
  const nextUp = sorted.find((a) => !a.takenDate && a.plannedDate >= date);
  const logged = sorted.filter((a) => a.takenDate && a.actual != null).length;
  const examDays = examISO ? Math.round((new Date(`${examISO}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000) : null;

  // Collapsed by default: anything overdue plus the next 3 upcoming. The full
  // history (taken + far-future) lives behind "Show all".
  const overdue = sorted.filter((a) => !a.takenDate && a.plannedDate < date);
  const upcoming = sorted.filter((a) => !a.takenDate && a.plannedDate >= date).slice(0, 3);
  const collapsed = sorted.filter((a) => overdue.includes(a) || upcoming.includes(a));
  const visible = showAll ? sorted : collapsed;
  const hidden = sorted.length - collapsed.length;

  // Untaken checkpoints sharing a kind+label usually mean an accidental double-seed.
  const hasDupes = (() => {
    const seen = new Set();
    for (const a of sorted) {
      if (a.takenDate) continue;
      const k = `${a.kind}:${a.label}`;
      if (seen.has(k)) return true;
      seen.add(k);
    }
    return false;
  })();

  return (
    <div className={`pl-card pl-assess${dedicated ? " lead" : ""}`}>
      <div className="pl-assess-head">
        <span className="pl-assess-t">
          <IconCalendar size={15} /> Checkpoints
          <span className="pl-assess-meta num">{logged > 0 ? `${logged} of ${sorted.length} logged` : `${sorted.length} scheduled`}</span>
        </span>
        <span className="pl-assess-actions">
          <button className="btn-ghost btn-xs" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add"}</button>
          <ConfirmButton className="btn-ghost btn-xs" title="Rebuild the standard schedule (keeps logged scores)"
            label="Reset schedule" armedLabel="Sure? Reset" onConfirm={onReset} />
        </span>
      </div>

      {adding && <AddCheckpoint date={date} onAdd={(a) => { onUpsert(a); setAdding(false); }} />}

      <ul className="pl-assess-list">
        {visible.map((a) => (
          <AssessmentRow key={a.id} a={a} date={date} isNext={nextUp?.id === a.id} onLog={onLog} onRemove={onRemove} onUpsert={onUpsert} />
        ))}
        {examISO && (
          <li className="pl-assess-row examday">
            <span className="pl-assess-node exam"><IconSparkle size={9} /></span>
            <div className="pl-assess-main">
              <div className="pl-assess-row-top">
                <span className="pl-assess-label exam">Exam day</span>
                <span className="pl-assess-date num">
                  {fmtShort(examISO)}
                  {examDays != null && examDays >= 0 && <span className="muted"> · {examDays === 0 ? "today" : `in ${examDays}d`}</span>}
                </span>
              </div>
            </div>
          </li>
        )}
      </ul>

      {(hidden > 0 || showAll) && (
        <button className="btn-ghost btn-xs pl-assess-more" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${sorted.length} checkpoints`}
        </button>
      )}
      {hasDupes && (
        <p className="pl-assess-dupes muted">
          Some checkpoints look duplicated — "Reset schedule" rebuilds the standard set (logged scores are kept).
        </p>
      )}
    </div>
  );
}

function AssessmentRow({ a, date, isNext, onLog, onRemove, onUpsert }) {
  const [logging, setLogging] = useState(false);
  const [val, setVal] = useState("");
  const isPct = a.unit === "percent";
  const taken = a.takenDate && a.actual != null;
  const overdue = !taken && a.plannedDate < date;
  const days = Math.round((new Date(`${a.plannedDate}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000);
  const kindCls = { nbme: "nbme", uwsa: "uwsa", free120: "free120" }[a.kind] || "nbme";

  const predicted = taken ? toPredicted3(a) : null;
  const delta = taken ? Math.round(predicted - (isPct ? pctToPredicted3(a.goalScore) : a.goalScore)) : null;
  const nodeCls = taken ? "done" : isNext ? "next" : overdue ? "over" : "";

  return (
    <li className={`pl-assess-row${isNext ? " next" : ""}${taken ? " taken" : ""}`}>
      <span className={`pl-assess-node ${nodeCls}`}>{taken ? <IconCheck size={9} /> : null}</span>
      <div className="pl-assess-main">
        {isNext && <span className="pl-assess-eyebrow">Next up · {fmtShort(a.plannedDate)}</span>}
        <div className="pl-assess-row-top">
          <span className="pl-assess-label">
            {a.label}
            <span className={`pl-assess-badge ${kindCls}`}>{a.kind === "free120" ? "F120" : a.kind === "uwsa" ? "UWSA" : "NBME"}</span>
          </span>
          {!isNext && (
            <span className="pl-assess-date num">
              {fmtShort(a.plannedDate)}
              {!taken && (overdue ? <span className="pl-assess-over"> · overdue — did you take it?</span> : <span className="muted"> · {days === 0 ? "today" : `in ${days}d`}</span>)}
            </span>
          )}
        </div>
        <div className="pl-assess-row-bot">
          {taken ? (
            <>
              <span className="pl-assess-actual num">{a.actual}{isPct ? "%" : ""}{isPct && <span className="pl-assess-eq"> ≈ {predicted}</span>}</span>
              <span className={`pl-assess-delta ${delta >= 0 ? "ok" : "bad"}`}>{delta >= 0 ? "+" : ""}{delta} vs goal</span>
              <ConfirmButton className="pl-assess-relog" label="clear" armedLabel="sure?" onConfirm={() => onLog(a.id, null)} />
            </>
          ) : logging ? (
            <span className="pl-assess-loginline">
              <input type="number" className="pl-assess-input" autoFocus placeholder={isPct ? "% correct" : "predicted 3-digit"} value={val} onChange={(e) => setVal(e.target.value)} />
              <button className="btn-primary btn-xs" onClick={() => { if (val !== "") { onLog(a.id, Number(val)); setLogging(false); } }}>Save</button>
              <button className="btn-ghost btn-xs" onClick={() => setLogging(false)}>×</button>
            </span>
          ) : (
            <>
              <span className="pl-assess-goal num">goal {a.goalScore}{isPct ? "%" : ""}</span>
              <button className="btn-secondary btn-xs" onClick={() => setLogging(true)}>Log score</button>
            </>
          )}
        </div>
      </div>
      {isNext && !taken && (
        <div className="pl-assess-count">
          {days === 0 ? <b className="today">today</b> : <><b className="num">{days}</b><span>days</span></>}
        </div>
      )}
      <ConfirmButton className="pl-assess-del" aria-label="remove"
        label={<IconClose size={12} />} onConfirm={() => onRemove(a.id)} />
    </li>
  );
}

function AddCheckpoint({ date, onAdd }) {
  const [label, setLabel] = useState("");
  const [when, setWhen] = useState(date);
  const [kind, setKind] = useState("nbme");
  const [goalScore, setGoalScore] = useState("");
  const [err, setErr] = useState("");
  const unit = kind === "free120" ? "percent" : "three_digit";

  const submit = () => {
    if (!label.trim()) { setErr("Give the checkpoint a label."); return; }
    if (!when || when < date) { setErr("Pick today or a future date — checkpoints can't be scheduled in the past."); return; }
    const g = goalScore === "" ? null : Number(goalScore);
    if (g != null && (Number.isNaN(g) || (unit === "percent" ? g < 1 || g > 100 : g < 150 || g > 280))) {
      setErr(unit === "percent" ? "Goal must be 1–100%." : "Goal must be a 3-digit score (150–280).");
      return;
    }
    setErr("");
    onAdd({
      id: `a-${Date.now()}`, kind, label: label.trim(), form: "", role: "mid", unit,
      plannedDate: when, goalScore: g ?? (unit === "percent" ? 70 : 220),
    });
  };

  return (
    <div className="pl-assess-add">
      <input className="pl-assess-input grow" placeholder="Label (e.g. NBME 29)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select className="pl-assess-input" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="nbme">NBME</option><option value="uwsa">UWSA</option><option value="free120">Free 120</option>
      </select>
      <input type="date" className="pl-assess-input" value={when} min={date} onChange={(e) => setWhen(e.target.value)} />
      <input type="number" className="pl-assess-input sm" placeholder={unit === "percent" ? "goal %" : "goal"} value={goalScore} onChange={(e) => setGoalScore(e.target.value)} />
      <button className="btn-primary btn-xs" onClick={submit}>Add</button>
      {err && <p className="td-form-err" style={{ flexBasis: "100%", margin: "4px 0 0" }}>{err}</p>}
    </div>
  );
}

/* ─────────────────────────── swap ─────────────────────────── */
function SwapPanel({ units, states, onSwap, plannedKeys }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const pool = units.filter((u) => !["done", "dropped"].includes(states[u.key]?.status));
    return searchUnits(pool, q).slice(0, 8);
  }, [q, units, states]);

  return (
    <div className="pl-card pl-swap">
      <button className="pl-swap-head" onClick={() => setOpen((o) => !o)}>
        <span className="pl-swap-t">🔄 Do a different topic</span>
        <span className={`pl-upnext-chev${open ? " open" : ""}`}><IconChevronDown size={16} /></span>
      </button>
      {open && (
        <div className="pl-swap-body">
          <input className="pl-swap-input" placeholder="Search e.g. anemias, acid-base, cardio physiology…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="pl-swap-list">
            {results.map((u) => (
              <li key={u.key} className="pl-swap-item">
                <span className="pl-upnext-dot" style={{ background: colorFor(u.colorKey || u.system).hex }} />
                <span className="pl-subj-emoji">{colorFor(u.colorKey || u.system).emoji}</span>
                <span className="pl-swap-name">{u.chapter.replace(/^\d+\s/, "")} <span className="pl-sep">›</span> {u.subsection.replace(/^\d+\s/, "")}</span>
                {plannedKeys.includes(u.key)
                  ? <span className="pl-swap-planned">planned</span>
                  : <button className="btn-secondary btn-xs" onClick={() => { onSwap(u.key); setOpen(false); setQ(""); }}>Swap in</button>}
              </li>
            ))}
            {!results.length && <li className="pl-swap-empty muted">No matching topics.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── weak spots ─────────────────────────── */
// Grouped by system so five flagged Biochem subsections read as one Biochem
// problem, not five identical rows. Tapping a topic chip swaps it into today.
function WeakSpots({ units, states, onFocus, plannedKeys }) {
  const groups = useMemo(() => {
    const bySys = new Map();
    for (const u of units) {
      const st = states[u.key];
      const w = st?.weaknessScore || 0;
      if (w <= 0.05 || ["done", "dropped"].includes(st?.status)) continue;
      const g = bySys.get(u.system) || { system: u.system, colorKey: u.colorKey || u.system, max: 0, items: [] };
      g.max = Math.max(g.max, w);
      g.items.push({ u, w });
      bySys.set(u.system, g);
    }
    return [...bySys.values()]
      .sort((a, b) => b.max - a.max)
      .slice(0, 4)
      .map((g) => ({ ...g, items: g.items.sort((a, b) => b.w - a.w).slice(0, 6) }));
  }, [units, states]);
  if (!groups.length) return null;

  return (
    <div className="pl-card pl-weak">
      <div className="pl-weak-head">
        <span className="pl-weak-t"><IconTarget size={15} /> Weak spots</span>
        <p className="pl-weak-sub muted">Your lowest-scoring areas — the planner schedules these sooner. Tap a topic to study it today.</p>
      </div>
      <ul className="pl-weak-list">
        {groups.map((g) => {
          const c = colorFor(g.colorKey);
          return (
            <li key={g.system} className="pl-weak-grp">
              <div className="pl-weak-grp-top">
                <span className="pl-weak-name"><span className="pl-subj-emoji">{c.emoji}</span><b>{g.system}</b></span>
                <span className="pl-weak-val num">{Math.round(g.max * 100)}% weak</span>
              </div>
              <span className="pl-weak-bar"><span className="pl-weak-fill" style={{ width: `${Math.round(g.max * 100)}%`, background: c.hex }} /></span>
              <div className="pl-weak-chips">
                {g.items.map(({ u }) => plannedKeys.includes(u.key)
                  ? <span key={u.key} className="pl-weak-chip planned">{cleanChap(u)} · planned</span>
                  : <button key={u.key} className="pl-weak-chip" onClick={() => onFocus(u.key)} title="Swap into today's plan">{cleanChap(u)} +</button>)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─────────────────────────── day complete / footer ─────────────────────────── */
function DayComplete({ streak }) {
  return (
    <div className="pl-done-banner">
      <span className="pl-done-ico"><IconCheck size={18} /></span>
      <span>Day complete — Anki + every planned block cleared. <b className="num">{streak}</b>-day streak going.</span>
    </div>
  );
}

function PlannerFooter({ sched, onImport, onExam, onSettings, onReset }) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const S = sched.settings;

  function download() {
    const blob = new Blob([exportSched(sched)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `usmle-planner-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function upload(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const s = importSched(String(r.result)); if (s) onImport(s); };
    r.readAsText(f);
  }
  function setDeadline(v) {
    if (v > S.examDate) { setErr("Content deadline must be on or before the exam date."); return; }
    setErr(""); onSettings({ contentDeadline: v });
  }
  function setBlock(v) {
    const n = Math.max(10, Math.min(90, Math.round(Number(v) || 30)));
    onSettings({ blockMinutes: n });
  }
  function setPreset(k, v) {
    const floor = (S.ankiReserveMin[k] || 0) + S.blockMinutes;
    const n = Math.max(floor, Math.min(720, Math.round(Number(v) || floor)));
    onSettings({ capacityPresets: { ...S.capacityPresets, [k]: n } });
  }
  function setReserve(k, v) {
    const n = Math.max(0, Math.min((S.capacityPresets[k] || 90) - 1, Math.round(Number(v) || 0)));
    onSettings({ ankiReserveMin: { ...S.ankiReserveMin, [k]: n } });
  }

  return (
    <div className="pl-footer">
      <button className="pl-footer-toggle" onClick={() => setOpen((o) => !o)}>Settings &amp; backup <IconChevronDown size={13} className={open ? "flip" : ""} /></button>
      {open && (
        <div className="pl-footer-body">
          <div className="pl-set-group">
            <div className="pl-set-glabel">Dates</div>
            <div className="pl-set-row">
              <label className="pl-set-field"><span>Exam date</span><input type="date" value={S.examDate} onChange={(e) => onExam(e.target.value)} /></label>
              <label className="pl-set-field"><span>Content deadline</span><input type="date" value={S.contentDeadline} max={S.examDate} onChange={(e) => setDeadline(e.target.value)} /></label>
            </div>
          </div>

          <div className="pl-set-group">
            <div className="pl-set-glabel">Daily capacity <span className="muted">(min, incl. Anki)</span></div>
            <div className="pl-set-row">
              {["low", "med", "high"].map((k) => (
                <label key={k} className="pl-set-field sm"><span>{k}</span>
                  <input type="number" min="30" max="720" value={S.capacityPresets[k]} onChange={(e) => setPreset(k, e.target.value)} /></label>
              ))}
            </div>
          </div>

          <div className="pl-set-group">
            <div className="pl-set-glabel">Anki reserve <span className="muted">(min, taken first)</span></div>
            <div className="pl-set-row">
              {["low", "med", "high"].map((k) => (
                <label key={k} className="pl-set-field sm"><span>{k}</span>
                  <input type="number" min="0" max="180" value={S.ankiReserveMin[k]} onChange={(e) => setReserve(k, e.target.value)} /></label>
              ))}
            </div>
          </div>

          <div className="pl-set-group">
            <div className="pl-set-glabel">Focus block</div>
            <div className="pl-set-row">
              <label className="pl-set-field sm"><span>minutes</span><input type="number" min="10" max="90" value={S.blockMinutes} onChange={(e) => setBlock(e.target.value)} /></label>
              <ConfirmButton className="btn-ghost btn-xs" label="Reset assessment schedule" armedLabel="Sure? Reset" onConfirm={onReset} />
            </div>
          </div>

          {err && <p className="td-form-err">{err}</p>}
          <p className="muted pl-set-hint">Capacity / Anki / block changes apply to tomorrow's plan — re-pick capacity to apply now.</p>

          <div className="pl-footer-actions">
            <button className="btn-secondary btn-xs" onClick={download}>Export progress</button>
            <button className="btn-secondary btn-xs" onClick={() => fileRef.current?.click()}>Import</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={upload} />
          </div>
          <p className="muted pl-footer-note">All state is local to this device. Report weak areas by running <code>python3 scripts/set_weakness.py</code>.</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── tiny helpers ─────────────────────────── */
function YieldStars({ n }) {
  return (
    <span className="pl-stars" title={`Yield ${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => <span key={i} className={`pl-star${i < n ? " on" : ""}`}>★</span>)}
    </span>
  );
}
function shortSys(s) { return (s || "").split(/[ ,/&]/)[0]; }

// Weak-system ranking (worst first), aggregating each system's units by peak
// weakness and skipping finished ones. Used to describe what a refresh moved.
function weakRankBySystem(states, units) {
  const bySys = {};
  for (const u of units) {
    const st = states[u.key];
    if (["done", "dropped"].includes(st?.status)) continue;
    const w = st?.weaknessScore || 0;
    if (w > (bySys[u.system] || 0)) bySys[u.system] = w;
  }
  return Object.entries(bySys)
    .filter(([, w]) => w > 0.05)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
}

// Human summary of how the weak-list re-ordered after a refresh.
function diffRanking(before, after) {
  if (!after.length) return "Re-ranked — nothing flagged as weak right now. 🎉";
  const top = after[0], prevTop = before[0];
  if (top && top !== prevTop) {
    return `🎯 New top focus: ${shortSys(top)}${prevTop ? ` — overtook ${shortSys(prevTop)}` : ""}. Plan re-ordered.`;
  }
  const beforeIdx = Object.fromEntries(before.map((s, i) => [s, i]));
  let climber = null, jump = 0;
  after.forEach((s, i) => {
    const prev = beforeIdx[s];
    if (prev != null && prev - i > jump) { jump = prev - i; climber = s; }
  });
  if (climber && jump > 0) return `${shortSys(climber)} climbed ${jump} spot${jump > 1 ? "s" : ""} in your weak list. Plan re-ordered.`;
  return `Plan re-ranked from your latest results — top focus still ${shortSys(top)}.`;
}
function cleanChap(u) { return (u?.subsection || "").replace(/^\d+\s/, ""); }
function fmtShort(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
