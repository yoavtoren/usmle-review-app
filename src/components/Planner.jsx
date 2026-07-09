import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconClock, IconCheck, IconClose, IconTarget, IconSparkle,
  IconChevronDown, IconArrow, IconBox, IconPulse,
} from "./icons.jsx";
import { getStreak, recordActivity } from "../lib/storage.js";
import {
  loadSched, ensureUnits, recomputeWeakness, planDay, rollover,
  recordDone, recordMiss, toggleAnki, swapIn, searchUnits, feasibility,
  applyTriage, ankiNewCardHint, updateSettings, exportSched, importSched,
  todayISO, REASONS, CAPACITY_LABELS,
} from "../lib/scheduler.js";

const BASE = import.meta.env.BASE_URL;

/* ─── data loading ─────────────────────────────────────────────────────────── */
function usePlanData() {
  const [plan, setPlan] = useState(null);
  const [deck, setDeck] = useState(null);
  const [seed, setSeed] = useState(null);
  useEffect(() => {
    fetch(`${BASE}topic-plan.json`).then((r) => r.json()).then(setPlan).catch(() => setPlan({ units: [] }));
    fetch(`${BASE}questions/deck.json`).then((r) => r.json()).then(setDeck).catch(() => setDeck({ questions: [] }));
    fetch(`${BASE}weakness-seed.json`).then((r) => r.json()).then(setSeed).catch(() => setSeed({ weak: [] }));
  }, []);
  return { plan, deck, seed };
}

export default function Planner() {
  const { plan, deck, seed } = usePlanData();
  const units = plan?.units || [];
  const [sched, setSched] = useState(null);
  const [ready, setReady] = useState(false);
  const date = todayISO();

  // One-time bootstrap: seed state, register units, ingest weakness, roll forward.
  useEffect(() => {
    if (!plan || !deck || !seed) return;
    let s = loadSched({ examDate: plan.examDate, contentDeadline: plan.contentDeadline });
    s = ensureUnits(s, units);
    s = recomputeWeakness(s, units, deck, seed);
    s = rollover(s, date);
    setSched(s);
    setReady(true);
  }, [plan, deck, seed]); // eslint-disable-line

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

  const phaseBadge = sched.phase === "dedicated"
    ? { label: "Dedicated", cls: "ded" }
    : { label: "Content", cls: "con" };

  const allDone = capacity && plannedKeys.length > 0 && plannedKeys.every((k) => completed.has(k)) && today?.ankiDone;

  return (
    <div className="page page-narrow planner" dir="ltr">
      {/* ═══ Header ═══ */}
      <header className="pl-head">
        <div className="pl-head-l">
          <p className="page-eyebrow">Step 1 · Adaptive planner</p>
          <h1 className="page-title">Today<span className="pl-date">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span></h1>
        </div>
        <div className="pl-head-r">
          <span className={`pl-phase ${phaseBadge.cls}`}>{phaseBadge.label} phase</span>
          <span className="pl-streak"><IconSparkle size={13} /> <b className="num">{streak}</b> day streak</span>
        </div>
      </header>

      {/* ═══ Feasibility / ETA ═══ */}
      <FeasibilityBar feas={feas} onTriage={runTriage} settings={sched.settings} />

      {/* ═══ Capacity picker ═══ */}
      <CapacityPicker current={capacity} onPick={pickCapacity} presets={sched.settings.capacityPresets} bias={sched.adaptation.capacityBiasMin} />

      {!capacity ? (
        <div className="pl-empty">
          <span className="pl-empty-ico"><IconClock size={26} /></span>
          <p>Pick how much energy you have today and I'll size the plan to fit.</p>
        </div>
      ) : (
        <>
          {allDone && <DayComplete streak={streak} />}

          {/* Anki — protected, always first */}
          <AnkiCard
            done={today?.ankiDone}
            reserve={today?.ankiReserveMin}
            newCards={ankiNewCardHint(sched, capacity, date)}
            activeSystem={activeUnit?.system}
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
            />
          ) : (
            <div className="pl-card pl-alldone">
              <span className="pl-alldone-ico"><IconCheck size={22} /></span>
              <div><h3>Content blocks cleared</h3><p className="muted">Every planned unit is done. Add capacity to pull more forward, or rest.</p></div>
            </div>
          )}

          {/* Up next */}
          <UpNext
            keys={plannedKeys.filter((k) => k !== activeKey && !completed.has(k))}
            byKey={byKey}
            states={sched.units}
          />

          {/* UWorld block */}
          {today?.uworldMin > 0 && (
            <UWorldBlock minutes={today.uworldMin} phase={sched.phase} weakSystem={topWeakSystem(sched, units)} />
          )}
        </>
      )}

      {/* Swap */}
      <SwapPanel units={units} states={sched.units} onSwap={doSwap} plannedKeys={plannedKeys} />

      {/* Weak spots */}
      <WeakSpots units={units} states={sched.units} byKey={byKey} onFocus={doSwap} plannedKeys={plannedKeys} />

      {/* Settings / backup */}
      <PlannerFooter sched={sched} onImport={(s) => setSched(s)} onExam={(d) => mutate((st) => updateSettings(st, { examDate: d }))} />
    </div>
  );
}

/* ─────────────────────────── feasibility ─────────────────────────── */
function FeasibilityBar({ feas, onTriage, settings }) {
  const pct = Math.min(100, Math.round((1 / Math.max(feas.ratio, 0.01)) * 100));
  const label = {
    green: "On track", amber: "Slightly behind", red: "Behind — triage needed", ahead: "Ahead of pace",
  }[feas.status];
  const msg = feas.status === "green" || feas.status === "ahead"
    ? `On track to finish content by ${feas.etaLabel} · ${settings.contentDeadline} deadline`
    : `${feas.finishDays} study-days of work left · ${feas.daysLeft} days to the ${settings.contentDeadline} deadline`;
  return (
    <div className={`pl-feas ${feas.status}`}>
      <div className="pl-feas-top">
        <span className="pl-feas-status"><span className="pl-feas-dot" /> {label}</span>
        <span className="pl-feas-eta num">{Math.round(feas.remainingMin / 60)}h left · ETA {feas.etaLabel}</span>
      </div>
      <div className="pl-feas-track"><span className="pl-feas-fill" style={{ width: `${Math.max(6, pct)}%` }} /></div>
      <div className="pl-feas-foot">
        <span className="muted">{msg}</span>
        {(feas.status === "amber" || feas.status === "red") && (
          <button className="btn-secondary btn-xs" onClick={onTriage}>Auto-triage low-yield</button>
        )}
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
function AnkiCard({ done, reserve, newCards, activeSystem, onToggle }) {
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
          {newCards > 0 && !done && <> New cards: <b className="num">~{newCards}</b>{activeSystem && <> · unsuspend <code>#AK_Step1::…::{shortSys(activeSystem)}</code></>}</>}
          {newCards === 0 && !done && <> New cards paused (exam taper).</>}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── active task ─────────────────────────── */
function ActiveTask({ unit, state, onDone, onMiss, blockMinutes }) {
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
          <span className="pl-active-kicker">Now · {unit.system}</span>
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

/* ─────────────────────────── UWorld ─────────────────────────── */
function UWorldBlock({ minutes, phase, weakSystem }) {
  const qCount = phase === "dedicated" ? 40 : Math.max(10, Math.round(minutes / 1.5));
  return (
    <div className="pl-card pl-uworld">
      <span className="pl-uworld-ico"><IconPulse size={18} /></span>
      <div className="pl-uworld-body">
        <h3>Today's UWorld</h3>
        <p className="muted">
          {phase === "dedicated"
            ? <>Random / timed <b className="num">40-Q</b> block · then review every one.</>
            : <><b className="num">{qCount}</b> questions {weakSystem ? <>focused on <b>{shortSys(weakSystem)}</b></> : "mixed"} · ~{minutes}m.</>}
        </p>
      </div>
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

function PlannerFooter({ sched, onImport, onExam }) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
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
  return (
    <div className="pl-footer">
      <button className="pl-footer-toggle" onClick={() => setOpen((o) => !o)}>Settings & backup <IconChevronDown size={13} /></button>
      {open && (
        <div className="pl-footer-body">
          <label className="pl-footer-field">
            <span>Exam date</span>
            <input type="date" value={sched.settings.examDate} onChange={(e) => onExam(e.target.value)} />
          </label>
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
function topWeakSystem(sched, units) {
  let best = null, bw = 0;
  for (const u of units) {
    const w = sched.units[u.key]?.weaknessScore || 0;
    if (w > bw) { bw = w; best = u.system; }
  }
  return bw >= 0.3 ? best : null;
}
