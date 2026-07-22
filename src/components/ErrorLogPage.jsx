import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  WHY, FIX, SELF_MADE_CAP, loadErrors, addError, deleteError,
  whyCounts, selfMadeToday, isoDaysAgo,
} from "../lib/errorLog.js";
import { PLAN_SYSTEMS } from "../lib/scheduler.js";
import { localISODate } from "../lib/config.js";
import { IconNote, IconPlus, IconTarget } from "./icons.jsx";

const WINDOWS = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["all", "All time"],
];

function fmt(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const byCode = (list) => Object.fromEntries(list.map((x) => [x.code, x]));
const WHY_BY = byCode(WHY);
const FIX_BY = byCode(FIX);

export default function ErrorLogPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState(loadErrors);
  const [win, setWin] = useState("7");
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const delTimer = useRef(null);

  // Draft entry — one line per miss, exactly the five columns from the plan.
  const [draft, setDraft] = useState({
    system: PLAN_SYSTEMS[0], topic: "", why: "gap", fix: "unsuspend", note: "", date: localISODate(),
  });

  useEffect(() => () => clearTimeout(delTimer.current), []);

  const since = win === "all" ? null : isoDaysAgo(Number(win));
  const visible = useMemo(
    () => (since ? rows.filter((r) => r.date >= since) : rows),
    [rows, since]
  );
  const tally = useMemo(() => whyCounts(rows, since), [rows, since]);
  const madeToday = selfMadeToday(rows);

  // Systems ranked by misses in the window — this is what the planner pulls forward.
  const topSystems = useMemo(() => {
    const per = {};
    for (const r of visible) if (r.system) per[r.system] = (per[r.system] || 0) + 1;
    return Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [visible]);

  function submit(e) {
    e.preventDefault();
    if (!draft.topic.trim()) return;
    setRows(addError(draft));
    setDraft((d) => ({ ...d, topic: "", note: "" }));
  }

  function remove(id) {
    if (confirmDel !== id) {
      setConfirmDel(id);
      clearTimeout(delTimer.current);
      delTimer.current = setTimeout(() => setConfirmDel(null), 3000);
      return;
    }
    clearTimeout(delTimer.current);
    setConfirmDel(null);
    setRows(deleteError(id));
  }

  return (
    <div className="page elog-page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow"><IconNote size={13} /> Error log</div>
          <h1 className="td-title">Why I missed it</h1>
          <p className="td-sub">
            One line per miss — and per "right but unsure". The <em>why</em> column is the gold: review it before
            every NBME, and feed misconceptions back into next week's LEARN pass.
          </p>
        </div>
        <button className="td-submit-btn" onClick={() => setOpen((o) => !o)}>
          <IconPlus size={13} /> {open ? "Close" : "Log a miss"}
        </button>
      </div>

      {open && (
        <form className="elog-form" onSubmit={submit}>
          <div className="elog-form-grid">
            <label className="elog-field">
              <span>System</span>
              <select value={draft.system} onChange={(e) => setDraft({ ...draft, system: e.target.value })}>
                {PLAN_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="elog-field elog-field-wide">
              <span>Topic / question-stem cue</span>
              <input
                autoFocus value={draft.topic} placeholder="e.g. lead-time bias · β-blocker in variant angina"
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />
            </label>
            <label className="elog-field">
              <span>Date</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
          </div>

          <div className="elog-pickers">
            <div className="elog-picker">
              <span className="elog-picker-lbl">Why did I miss it?</span>
              <div className="elog-chips">
                {WHY.map((w) => (
                  <button
                    key={w.code} type="button"
                    className={`chip${draft.why === w.code ? " active" : ""}`}
                    onClick={() => setDraft({ ...draft, why: w.code })}
                  >
                    {w.icon} {w.label}
                  </button>
                ))}
              </div>
              <p className="strat-note">{WHY_BY[draft.why].implies}</p>
            </div>
            <div className="elog-picker">
              <span className="elog-picker-lbl">What did I do about it?</span>
              <div className="elog-chips">
                {FIX.map((f) => (
                  <button
                    key={f.code} type="button"
                    className={`chip${draft.fix === f.code ? " active" : ""}`}
                    onClick={() => setDraft({ ...draft, fix: f.code })}
                  >
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
              {draft.fix === "cloze" && (
                <p className={`strat-note${madeToday >= SELF_MADE_CAP ? " bad" : ""}`}>
                  {madeToday} / {SELF_MADE_CAP} self-made cards today
                  {madeToday >= SELF_MADE_CAP ? " — cap reached. Unsuspend an AnKing card instead." : ""}
                </p>
              )}
            </div>
          </div>

          <label className="elog-field">
            <span>Note (optional) — the mechanism, in your own words</span>
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>

          <button className="td-submit-btn" type="submit" disabled={!draft.topic.trim()}>Add to the log</button>
        </form>
      )}

      <div className="elog-tabs">
        {WINDOWS.map(([k, label]) => (
          <button key={k} className={`chip${win === k ? " active" : ""}`} onClick={() => setWin(k)}>{label}</button>
        ))}
      </div>

      {/* The weekly review: why-tally + which systems it's pushing forward */}
      <div className="elog-summary">
        <div className="elog-tally">
          {WHY.map((w) => {
            const n = tally.counts[w.code] || 0;
            const pct = tally.total ? Math.round((n / tally.total) * 100) : 0;
            return (
              <div key={w.code} className={`elog-tally-card why-${w.code}`}>
                <span className="elog-tally-ico" aria-hidden="true">{w.icon}</span>
                <span className="elog-tally-num num">{n}</span>
                <span className="elog-tally-lbl">{w.label}</span>
                <span className="elog-tally-bar"><span style={{ width: `${pct}%` }} /></span>
                <span className="elog-tally-implies">{w.implies}</span>
              </div>
            );
          })}
        </div>

        <div className="elog-systems">
          <h3 className="strat-h"><IconTarget size={14} /> Pushing forward in the planner</h3>
          {topSystems.length === 0 ? (
            <p className="strat-p muted">Nothing logged in this window yet.</p>
          ) : (
            <ul className="elog-sys-list">
              {topSystems.map(([sys, n]) => (
                <li key={sys}>
                  <span>{sys}</span>
                  <span className="num">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="strat-note">
            Misses from the last 21 days feed the planner's weakness engine, so the systems you actually get wrong
            surface earlier in the schedule.
          </p>
          <button className="btn-secondary strat-inline-btn" onClick={() => nav("/planner")}>Open the planner →</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="prog-empty">
          <p className="prog-empty-h">No misses logged in this window</p>
          <p className="muted">
            Every miss — and every "right but unsure" — gets exactly one encode action and one line here.
            Without it, questions stay superficial and the % crawls.
          </p>
          <button className="td-submit-btn" onClick={() => setOpen(true)}>Log the first one</button>
        </div>
      ) : (
        <div className="strat-table-wrap">
          <table className="strat-table elog-table">
            <thead>
              <tr><th>Date</th><th>System</th><th>Topic</th><th>Why</th><th>Fix</th><th /></tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="num">{fmt(r.date)}</td>
                  <td className="strat-td-key">{r.system}</td>
                  <td>
                    {r.topic}
                    {r.note && <span className="elog-note">{r.note}</span>}
                  </td>
                  <td><span className={`elog-pill why-${r.why}`}>{WHY_BY[r.why]?.icon} {WHY_BY[r.why]?.label}</span></td>
                  <td><span className="elog-pill">{FIX_BY[r.fix]?.icon} {FIX_BY[r.fix]?.label}</span></td>
                  <td>
                    <button className="elog-del" onClick={() => remove(r.id)}>
                      {confirmDel === r.id ? "Sure?" : "✕"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
