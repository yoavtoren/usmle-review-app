import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconClock, IconCheck, IconClose, IconTarget, IconSparkle,
  IconChevronDown, IconArrow, IconBox, IconPulse, IconCalendar, IconClipboard,
} from "./icons.jsx";
import { GanttView, CalendarView, PlannerViewTabs } from "./PlannerViews.jsx";
import { getStreak, recordActivity } from "../lib/storage.js";
import {
  loadSched, ensureUnits, ensurePlanExtras, applyProfile, recomputeWeakness, planDay, rollover,
  recordDone, recordMiss, toggleAnki, swapIn, searchUnits, feasibility,
  applyTriage, ankiNewCardHint, updateSettings, exportSched, importSched,
  setGoal, seedAssessments, upsertAssessment, logAssessment, removeAssessment,
  addTask, toggleTask, deleteTask, projectReadiness, effectiveTarget,
  pctToPredicted3, predicted3ToPct, toPredicted3,
  todayISO, REASONS,
} from "../lib/scheduler.js";

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
  const markDone = (key, mins) => { recordActivity(); mutate((s) => recordDone(s, key, mins, date)); };
  const markMiss = (key, reason, note) => mutate((s) => recordMiss(s, key, reason, note, date));
  const doSwap = (key) => mutate((s) => swapIn(s, units, key, date));
  const flipAnki = () => mutate((s) => toggleAnki(s, date));
  const runTriage = () => mutate((s) => applyTriage(s, units, date).state);
  const onGoal = (patch) => mutate((s) => setGoal(s, patch));
  const onSettings = (patch) => mutate((s) => updateSettings(s, patch));
  // Changing the exam date re-dates only seeded/untaken/unedited checkpoints.
  const onExam = (d) => mutate((s) => seedAssessments(updateSettings(s, { examDate: d }), { force: true }));
  const onLogAssessment = (id, val) => mutate((s) => logAssessment(s, id, val, date));
  const onUpsertAssessment = (a) => mutate((s) => upsertAssessment(s, a));
  const onRemoveAssessment = (id) => mutate((s) => removeAssessment(s, id));
  const onResetSchedule = () => mutate((s) => seedAssessments(s, { force: true }));
  const onAddTask = (text, opts) => { recordActivity(); mutate((s) => addTask(s, text, opts)); };
  const onToggleTask = (id) => { recordActivity(); mutate((s) => toggleTask(s, id)); };
  const onDeleteTask = (id) => mutate((s) => deleteTask(s, id));

  const dedicated = sched.phase === "dedicated";
  const phaseBadge = dedicated ? { label: "Dedicated", cls: "ded" } : { label: "Content", cls: "con" };
  const readiness = projectReadiness(sched);
  const allDone = capacity && plannedKeys.length > 0 && plannedKeys.every((k) => completed.has(k)) && today?.ankiDone;
  const simToday = today?.assessmentToday
    ? (sched.assessments || []).find((a) => a.id === today.assessmentToday)
    : null;

  const goalCard = <ScoreGoalCard readiness={readiness} goal={sched.settings.goal} assessments={sched.assessments} onGoal={onGoal} />;
  const assessCard = (
    <AssessmentsCard
      assessments={sched.assessments || []} dedicated={dedicated} date={date} examISO={sched.settings.examDate}
      onLog={onLogAssessment} onUpsert={onUpsertAssessment} onRemove={onRemoveAssessment} onReset={onResetSchedule}
    />
  );

  const viewTitle = view === "timeline" ? "Timeline" : view === "calendar" ? "Calendar" : "Today";

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
        </div>
      </header>

      {/* ═══ View switcher (Today · Timeline · Calendar) ═══ */}
      <PlannerViewTabs view={view} onView={setView} />

      {view === "timeline" && <GanttView sched={sched} units={units} />}
      {view === "calendar" && <CalendarView sched={sched} units={units} nav={nav} />}

      {view === "today" && (<>
      {/* In dedicated phase, readiness + checkpoints lead. */}
      {dedicated && goalCard}
      {dedicated && assessCard}

      {/* ═══ Feasibility / ETA ═══ */}
      <FeasibilityBar feas={feas} onTriage={runTriage} settings={sched.settings} readiness={readiness} />

      {/* Score goal + readiness (content phase: under feasibility) */}
      {!dedicated && goalCard}

      {/* ═══ Capacity picker ═══ */}
      <CapacityPicker current={capacity} onPick={pickCapacity} presets={sched.settings.capacityPresets} bias={sched.adaptation.capacityBiasMin} />

      {!capacity ? (
        <div className="pl-empty">
          <span className="pl-empty-ico"><IconClock size={26} /></span>
          <p>Pick how much energy you have today and I'll size the plan to fit.</p>
        </div>
      ) : (
        <>
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

          {/* Active task */}
          {activeUnit ? (
            <ActiveTask
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

          {/* Today's tasks */}
          <TasksCard tasks={sched.tasks || []} date={date} onAdd={onAddTask} onToggle={onToggleTask} onDelete={onDeleteTask} />

          {/* Up next */}
          <UpNext
            keys={plannedKeys.filter((k) => k !== activeKey && !completed.has(k))}
            byKey={byKey}
            states={sched.units}
          />

          {/* Question practice (folds the UWorld block + bank/tests links) */}
          <PracticeCard
            minutes={today?.uworldMin || 0} phase={sched.phase}
            weakSystem={topWeakSystem(sched, units)} nav={nav}
          />
        </>
      )}

      {/* Swap */}
      <SwapPanel units={units} states={sched.units} onSwap={doSwap} plannedKeys={plannedKeys} />

      {/* Weak spots */}
      <WeakSpots units={units} states={sched.units} byKey={byKey} onFocus={doSwap} plannedKeys={plannedKeys} />

      {/* Assessment checkpoints (content phase: lower down) */}
      {!dedicated && assessCard}
      </>)}

      {/* Settings / backup */}
      <PlannerFooter sched={sched} onImport={(s) => setSched(s)} onExam={onExam} onSettings={onSettings} onReset={onResetSchedule} />
    </div>
  );
}

/* ─────────────────────────── feasibility ─────────────────────────── */
function FeasibilityBar({ feas, onTriage, settings, readiness }) {
  const pct = Math.min(100, Math.round((1 / Math.max(feas.ratio, 0.01)) * 100));
  const label = {
    green: "On track", amber: "Slightly behind", red: "Behind — triage needed", ahead: "Ahead of pace",
  }[feas.status];
  const msg = feas.status === "green" || feas.status === "ahead"
    ? `On track to finish content by ${feas.etaLabel} · ${settings.contentDeadline} deadline`
    : `${feas.finishDays} study-days of work left · ${feas.daysLeft} days to the ${settings.contentDeadline} deadline`;
  const belowGoal = readiness && readiness.status !== "baseline" && readiness.gap < -5;
  return (
    <div className={`pl-feas ${feas.status}`}>
      <div className="pl-feas-top">
        <span className="pl-feas-status"><span className="pl-feas-dot" /> {label}</span>
        <span className="pl-feas-eta num">{Math.round(feas.remainingMin / 60)}h left · ETA {feas.etaLabel}</span>
      </div>
      <div className="pl-feas-track"><span className="pl-feas-fill" style={{ width: `${Math.max(6, pct)}%` }} /></div>
      <div className="pl-feas-foot">
        <span className="muted">{msg}</span>
        <span className="pl-feas-foot-actions">
          {belowGoal && <span className="pl-feas-advisory">Trend below goal — weight weak systems</span>}
          {(feas.status === "amber" || feas.status === "red") && (
            <button className="btn-secondary btn-xs" onClick={onTriage}>Auto-triage low-yield</button>
          )}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────── capacity picker ─────────────────────────── */
function CapacityPicker({ current, onPick, presets, bias }) {
  const opts = [
    { key: "low", emoji: "🌱", name: "Low", desc: "Anki + one unit" },
    { key: "med", emoji: "🌿", name: "Medium", desc: "a focused set" },
    { key: "high", emoji: "🌳", name: "High", desc: "a full day" },
  ];
  return (
    <div className="pl-cap">
      <div className="pl-cap-lbl">How much do you have today?{bias ? <span className="pl-cap-bias">adjusted −{bias}m from your history</span> : null}</div>
      <div className="pl-cap-row">
        {opts.map((o) => {
          const mins = presets[o.key] - (bias || 0);
          return (
            <button key={o.key} className={`pl-cap-btn${current === o.key ? " on" : ""}`} onClick={() => onPick(o.key)}>
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

  return (
    <div className={`pl-card pl-active${weak ? " weak" : ""}`}>
      <div className="pl-active-rail" style={{ background: yieldColor(unit.yieldWeight) }} />
      <div className="pl-active-body">
        <div className="pl-active-top">
          <span className="pl-active-kicker">{dedicated ? "Targeted review" : "Now"} · {unit.system}</span>
          <YieldStars n={unit.yieldWeight} />
        </div>
        <h2 className="pl-active-title">{unit.chapter.replace(/^\d+\s/, "")} <span className="pl-sep">›</span> {unit.subsection.replace(/^\d+\s/, "")}</h2>

        <div className="pl-active-meta">
          <span className="pl-meta-pill"><IconClock size={12} /> ~{unit.estMinutes}m · {blocks} block{blocks > 1 ? "s" : ""}</span>
          <span className="pl-meta-pill"><IconBox size={12} /> {unit.topicCount} topics</span>
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
            return (
              <li key={k} className="pl-upnext-item">
                <span className="pl-upnext-dot" style={{ background: yieldColor(u.yieldWeight) }} />
                <span className="pl-upnext-name">{u.chapter.replace(/^\d+\s/, "")} <span className="pl-sep">›</span> {u.subsection.replace(/^\d+\s/, "")}</span>
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

/* ─────────────────────────── question practice ─────────────────────────── */
function PracticeCard({ minutes, phase, weakSystem, nav }) {
  const dedicated = phase === "dedicated";
  const qCount = dedicated ? 40 : Math.max(10, Math.round(minutes / 1.5));
  return (
    <div className="pl-card pl-practice">
      <div className="pl-practice-head">
        <span className="pl-practice-t"><IconPulse size={15} /> Question practice</span>
      </div>
      <div className="pl-uworld">
        <span className="pl-uworld-ico"><IconPulse size={18} /></span>
        <div className="pl-uworld-body">
          <h3>Today's UWorld</h3>
          <p className="muted">
            {dedicated
              ? <>Random / timed <b className="num">40-Q</b> block · then review every one.</>
              : <><b className="num">{qCount}</b> questions {weakSystem ? <>focused on <b>{shortSys(weakSystem)}</b></> : "mixed"} · ~{minutes}m.</>}
          </p>
        </div>
      </div>
      <div className="pl-practice-links">
        <button className="pl-practice-chip" onClick={() => nav("/bank")}><IconBox size={15} /> Question bank <IconArrow size={13} className="mir" /></button>
        <button className="pl-practice-chip" onClick={() => nav("/tests")}><IconClipboard size={15} /> Tests &amp; trajectory <IconArrow size={13} className="mir" /></button>
      </div>
    </div>
  );
}

/* ─────────────────────────── score goal + readiness ─────────────────────────── */
function ScoreGoalCard({ readiness, goal, assessments, onGoal }) {
  const [editing, setEditing] = useState(false);
  const r = readiness;
  const takenPts = (assessments || []).filter((a) => a.takenDate && a.actual != null)
    .map((a) => ({ t: a.takenDate, y: toPredicted3(a) }))
    .sort((x, y) => (x.t < y.t ? -1 : 1));

  const statusClass = { on_track: "ok", close: "warn", behind: "warn", at_risk: "bad", baseline: "mut" }[r.status] || "mut";
  const verdict = (() => {
    if (r.status === "baseline") return "Take NBME 26 to unlock a readiness projection.";
    const wk = r.slopePerWeek ? `${r.slopePerWeek > 0 ? "+" : ""}${r.slopePerWeek}/wk` : "flat";
    if (r.status === "on_track") return `Trending to ~${r.projected} by exam day — +${r.passMargin} above the 196 pass line. Hold the line.`;
    if (r.status === "at_risk") return `Projecting ~${r.projected}. Focus weak systems and bank your next UWSA.`;
    return `About ${Math.abs(r.gap)} pts from goal; last ${r.n} checkpoints trending ${wk} — +${r.passMargin} above pass.`;
  })();

  return (
    <div className={`pl-card pl-goal ${statusClass}`}>
      <div className="pl-goal-head">
        <span className="page-eyebrow">Readiness · predicted</span>
        <button className="btn-ghost btn-xs" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Set goal"}</button>
      </div>

      {r.status === "baseline" ? (
        <div className="pl-goal-empty">
          <span className="pl-goal-big num">—</span>
          <p className="muted">{verdict}</p>
        </div>
      ) : (
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
      <p className="pl-goal-verdict">{verdict}</p>

      {editing && <GoalEditor goal={goal} onGoal={onGoal} />}
      <p className="pl-goal-foot muted">Step 1 is pass/fail — these are <em>predicted</em> equivalents (±~10), not official scores.</p>
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
function TasksCard({ tasks, date, onAdd, onToggle, onDelete }) {
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
                <button className="pl-tasks-del" onClick={() => onDelete(t.id)} aria-label="delete task"><IconClose size={12} /></button>
              </li>
            );
          })}
        </ul>
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
  const sorted = [...assessments].sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1));
  const nextUp = sorted.find((a) => !a.takenDate && a.plannedDate >= date);
  const logged = sorted.filter((a) => a.takenDate && a.actual != null).length;
  const examDays = examISO ? Math.round((new Date(`${examISO}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000) : null;

  return (
    <div className={`pl-card pl-assess${dedicated ? " lead" : ""}`}>
      <div className="pl-assess-head">
        <span className="pl-assess-t">
          <IconCalendar size={15} /> Assessment checkpoints
          <span className="pl-assess-meta num">{logged > 0 ? `${logged} of ${sorted.length} logged` : `${sorted.length} scheduled`}</span>
        </span>
        <span className="pl-assess-actions">
          <button className="btn-ghost btn-xs" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add"}</button>
          <button className="btn-ghost btn-xs" onClick={onReset} title="Rebuild the standard schedule (keeps logged scores)">Reset schedule</button>
        </span>
      </div>

      {adding && <AddCheckpoint date={date} onAdd={(a) => { onUpsert(a); setAdding(false); }} />}

      <ul className="pl-assess-list">
        {sorted.map((a) => (
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
              <button className="pl-assess-relog" onClick={() => onLog(a.id, null)}>clear</button>
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
      <button className="pl-assess-del" onClick={() => onRemove(a.id)} aria-label="remove"><IconClose size={12} /></button>
    </li>
  );
}

function AddCheckpoint({ date, onAdd }) {
  const [label, setLabel] = useState("");
  const [when, setWhen] = useState(date);
  const [kind, setKind] = useState("nbme");
  const [goalScore, setGoalScore] = useState("");
  const unit = kind === "free120" ? "percent" : "three_digit";
  return (
    <div className="pl-assess-add">
      <input className="pl-assess-input grow" placeholder="Label (e.g. NBME 29)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select className="pl-assess-input" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="nbme">NBME</option><option value="uwsa">UWSA</option><option value="free120">Free 120</option>
      </select>
      <input type="date" className="pl-assess-input" value={when} onChange={(e) => setWhen(e.target.value)} />
      <input type="number" className="pl-assess-input sm" placeholder={unit === "percent" ? "goal %" : "goal"} value={goalScore} onChange={(e) => setGoalScore(e.target.value)} />
      <button className="btn-primary btn-xs" onClick={() => label.trim() && onAdd({
        id: `a-${Date.now()}`, kind, label: label.trim(), form: "", role: "mid", unit,
        plannedDate: when, goalScore: Number(goalScore) || (unit === "percent" ? 70 : 220),
      })}>Add</button>
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
                <span className="pl-upnext-dot" style={{ background: yieldColor(u.yieldWeight) }} />
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
function WeakSpots({ units, states, byKey, onFocus, plannedKeys }) {
  const top = useMemo(() => {
    return units
      .map((u) => ({ u, w: states[u.key]?.weaknessScore || 0 }))
      .filter((x) => x.w > 0.05 && !["done", "dropped"].includes(states[x.u.key]?.status))
      .sort((a, b) => b.w - a.w)
      .slice(0, 5);
  }, [units, states]);
  if (!top.length) return null;
  return (
    <div className="pl-card pl-weak">
      <div className="pl-weak-head"><span className="pl-weak-t"><IconTarget size={15} /> Weak spots pulling forward</span></div>
      <ul className="pl-weak-list">
        {top.map(({ u, w }) => (
          <li key={u.key} className="pl-weak-row">
            <div className="pl-weak-info">
              <span className="pl-weak-name">{u.chapter.replace(/^\d+\s/, "")} <span className="pl-sep">›</span> {u.subsection.replace(/^\d+\s/, "")}</span>
              <span className="pl-weak-bar"><span className="pl-weak-fill" style={{ width: `${Math.round(w * 100)}%` }} /></span>
            </div>
            <span className="pl-weak-val num">{Math.round(w * 100)}%</span>
            {!plannedKeys.includes(u.key) && <button className="btn-ghost btn-xs" onClick={() => onFocus(u.key)}>Focus</button>}
          </li>
        ))}
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
              <button className="btn-ghost btn-xs" onClick={onReset}>Reset assessment schedule</button>
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
function yieldColor(y) {
  if (y >= 5) return "var(--bad)";
  if (y >= 4) return "var(--gold)";
  return "var(--accent-2)";
}
function shortSys(s) { return (s || "").split(/[ ,/&]/)[0]; }
function fmtShort(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function topWeakSystem(sched, units) {
  let best = null, bw = 0;
  for (const u of units) {
    const w = sched.units[u.key]?.weaknessScore || 0;
    if (w > bw) { bw = w; best = u.system; }
  }
  return bw >= 0.3 ? best : null;
}
