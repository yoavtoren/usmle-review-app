import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  SUBJECTS, SYSTEMS, loadSnapshots, topicStats, weakSpots, overall,
} from "../lib/progressData.js";
import { deleteTest } from "../lib/storage.js";
import { IconPulse } from "./icons.jsx";

const KINDS = [
  ["subjects", "Subjects", SUBJECTS],
  ["systems", "Systems", SYSTEMS],
];
const NAMES = { subjects: SUBJECTS, systems: SYSTEMS };

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toneFor(p) {
  if (p == null) return "";
  if (p >= 70) return "ok";
  if (p >= 55) return "warn";
  return "bad";
}

export default function ProgressTracker() {
  const nav = useNavigate();
  const [snaps, setSnaps] = useState(loadSnapshots);
  const [kind, setKind]   = useState("subjects");
  const [sort, setSort]   = useState("focus"); // focus | worst | best | name
  const [confirmDelId, setConfirmDelId] = useState(null); // armed delete (inline "Sure?" confirm)
  const confirmTimer = useRef(null);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  function refresh() { setSnaps(loadSnapshots()); }
  // Two-tap inline confirm (same pattern as the Tests page): first tap arms
  // "Sure?", second tap deletes, disarms after ~3s. The delete itself goes
  // through storage.deleteTest, which snapshots first (recoverable from /account).
  function armDelete(id) {
    if (confirmDelId !== id) {
      setConfirmDelId(id);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelId(null), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmDelId(null);
    deleteTest(id);
    refresh();
  }

  const latest = useMemo(() => (snaps.length ? snaps[snaps.length - 1] : null), [snaps]);
  const names = NAMES[kind];

  // Overall trend across snapshots for the active kind.
  const overallPoints = useMemo(
    () => snaps.map((s) => ({ date: s.date, pct: overall(s, kind).pct })).filter((p) => p.pct != null),
    [snaps, kind]
  );
  const overallNow = latest ? overall(latest, kind) : { total: 0, correct: 0, pct: null };

  const weak = useMemo(() => weakSpots(kind, 6), [snaps, kind]);

  // Per-topic rows for the list. Ranking keys are the *average* across every
  // snapshot (not just the latest), plus a combined "focus" priority.
  const topicRows = useMemo(() => {
    const rows = topicStats(kind);
    const withData = rows.filter((r) => r.avg != null);
    const noData = rows.filter((r) => r.avg == null);
    const cmp = {
      focus: (a, b) => b.focus - a.focus,
      worst: (a, b) => a.avg - b.avg,
      best:  (a, b) => b.avg - a.avg,
      name:  (a, b) => a.name.localeCompare(b.name),
    }[sort];
    if (sort === "name") return [...withData, ...noData].sort((a, b) => a.name.localeCompare(b.name));
    return [...withData.sort(cmp), ...noData];
  }, [kind, snaps, sort]);

  return (
    <div className="page prog-page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow"><IconPulse size={13} /> Progress</div>
          <h1 className="td-title">Progress & Weak Spots</h1>
          <p className="td-sub">
            Trends from the stat breakdown you enter with each test. Track every subject &amp; system,
            watch the trajectory, focus the worst.
          </p>
        </div>
        <button className="td-submit-btn prog-add" onClick={() => nav("/tests", { state: { openForm: true } })}>
          + Log a test
        </button>
      </div>

      {snaps.length === 0 && (
        <div className="prog-empty">
          <p className="prog-empty-h">No stats yet</p>
          <p className="muted">
            Press "+ Log a test" and fill in the Total / Correct per subject &amp; system
            (copy them from your UWorld performance page). Your scores, trends and weak
            spots per topic appear here automatically.
          </p>
          <button className="td-submit-btn" onClick={() => nav("/tests", { state: { openForm: true } })}>+ Log a test</button>
        </div>
      )}

      {snaps.length > 0 && (
        <>
          {/* Kind toggle */}
          <div className="prog-tabs">
            {KINDS.map(([k, label]) => (
              <button key={k} className={`chip${kind === k ? " active" : ""}`} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>

          {/* Overall + weak spots */}
          <div className="prog-top">
            <div className="prog-overall">
              <span className="prog-overall-lbl">Overall {kind === "subjects" ? "by subject" : "by system"}</span>
              <div className="prog-overall-row">
                <span className={`prog-big prog-${toneFor(overallNow.pct)}`}>
                  {overallNow.pct != null ? overallNow.pct + "%" : "—"}
                </span>
                <Sparkline points={overallPoints} w={160} h={44} />
              </div>
              <span className="prog-overall-sub muted">
                {overallNow.correct}/{overallNow.total} correct · {snaps.length} snapshot{snaps.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="prog-weak">
              <span className="prog-weak-lbl">⚠ Most important focus now</span>
              <div className="prog-weak-list">
                {weak.length === 0 && <span className="muted">Log a snapshot to see weak spots.</span>}
                {weak.map((w) => (
                  <div key={w.name} className="prog-weak-item">
                    <div className="prog-weak-bar-wrap">
                      <div className={`prog-weak-bar prog-bg-${toneFor(w.pct)}`} style={{ width: w.pct + "%" }} />
                    </div>
                    <span className="prog-weak-name">{w.name}<span className="muted"> · {w.total} Q</span></span>
                    <span className={`prog-weak-pct prog-${toneFor(w.pct)}`}>{w.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Topic trend list */}
          <div className="prog-list-head">
            <span className="prog-list-title">{kind === "subjects" ? "Subjects" : "Systems"} — average, trend &amp; volume</span>
            <div className="prog-sort">
              {[["focus", "Top focus"], ["worst", "Worst avg"], ["best", "Best avg"], ["name", "A–Z"]].map(([v, l]) => (
                <button key={v} className={`chip chip-sm${sort === v ? " active" : ""}`} onClick={() => setSort(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div className="prog-rows">
            <div className="prog-row prog-row-head">
              <span className="prog-row-name">{kind === "subjects" ? "Subject" : "System"}</span>
              <span className="prog-row-spark">Trend</span>
              <span className="prog-row-total">Volume</span>
              <span className="prog-row-delta">Slope</span>
              <span className="prog-row-pct">Avg</span>
            </div>
            {topicRows.map((r) => (
              <div key={r.name} className={`prog-row${r.avg == null ? " prog-row-empty" : ""}`}>
                <span className="prog-row-name">{r.name}</span>
                <span className="prog-row-spark"><Sparkline points={r.trend} w={130} h={30} /></span>
                <span className="prog-row-total muted">{r.volume ? `${r.volume} Q` : ""}</span>
                <span className={`prog-row-delta ${r.slope > 0.05 ? "prog-up" : r.slope < -0.05 ? "prog-down" : ""}`}
                  title="Average trend — points gained per test">
                  {r.slope != null
                    ? `${r.slope > 0.05 ? "▲" : r.slope < -0.05 ? "▼" : "•"} ${r.slope >= 0 ? "+" : "−"}${Math.abs(r.slope).toFixed(1)}`
                    : ""}
                </span>
                <span className={`prog-row-pct prog-${toneFor(r.avg)}`}>
                  {r.avg != null ? r.avg + "%" : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Snapshot history */}
          <div className="prog-hist">
            <span className="prog-list-title">History</span>
            {snaps.slice().reverse().map((s) => {
              const o = overall(s, kind);
              return (
                <div key={s.id} className="prog-hist-row">
                  <span className="prog-hist-date">{fmtDate(s.date)}</span>
                  <span className="prog-hist-meta muted">
                    {o.pct != null ? `${o.pct}% ${kind}` : "—"}{s.note ? ` · ${s.note}` : ""}
                  </span>
                  <button className="prog-hist-btn" onClick={() => nav("/tests", { state: { editId: s.id } })}>Edit in Tests</button>
                  <button className="prog-hist-btn prog-hist-del"
                    onClick={() => armDelete(s.id)}
                    title={confirmDelId === s.id ? "Tap again to delete — removes this test's result and stats" : "Delete this test"}
                    style={confirmDelId === s.id ? { borderColor: "var(--bad)", color: "var(--bad)", background: "var(--bad-soft)", fontWeight: 700 } : undefined}>
                    {confirmDelId === s.id ? "Sure?" : "Delete"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


// ── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ points, w = 130, h = 30 }) {
  if (!points || points.length === 0) {
    return <svg width={w} height={h} className="spark" aria-hidden="true" />;
  }
  const pad = 3;
  const n = points.length;
  const xs = (i) => (n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const ys = (p) => h - pad - (p / 100) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.pct).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const tone = toneFor(last.pct);
  return (
    <svg width={w} height={h} className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line x1={pad} y1={ys(50)} x2={w - pad} y2={ys(50)} className="spark-mid" />
      {n > 1 && <path d={path} className={`spark-line spark-${tone}`} fill="none" />}
      {points.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p.pct)} r={i === n - 1 ? 2.6 : 1.6} className={`spark-dot spark-${i === n - 1 ? tone : "mut"}`} />
      ))}
    </svg>
  );
}
