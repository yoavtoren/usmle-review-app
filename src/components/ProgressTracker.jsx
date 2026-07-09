import { useMemo, useState } from "react";
import {
  SUBJECTS, SYSTEMS, loadSnapshots, saveSnapshot, deleteSnapshot,
  latestSnapshot, trendFor, weakSpots, overall, pct,
} from "../lib/progressData.js";
import { IconPulse } from "./icons.jsx";

const KINDS = [
  ["subjects", "Subjects", SUBJECTS],
  ["systems", "Systems", SYSTEMS],
];
const NAMES = { subjects: SUBJECTS, systems: SYSTEMS };

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toneFor(p) {
  if (p == null) return "";
  if (p >= 70) return "ok";
  if (p >= 55) return "warn";
  return "bad";
}
function newDraft() {
  return { id: "snap-" + Date.now(), date: today(), note: "", subjects: {}, systems: {} };
}

export default function ProgressTracker() {
  const [snaps, setSnaps] = useState(loadSnapshots);
  const [kind, setKind]   = useState("subjects");
  const [sort, setSort]   = useState("worst"); // worst | best | name
  const [editing, setEditing] = useState(null); // draft object or null

  function refresh() { setSnaps(loadSnapshots()); }

  const latest = useMemo(() => (snaps.length ? snaps[snaps.length - 1] : null), [snaps]);
  const names = NAMES[kind];

  // Overall trend across snapshots for the active kind.
  const overallPoints = useMemo(
    () => snaps.map((s) => ({ date: s.date, pct: overall(s, kind).pct })).filter((p) => p.pct != null),
    [snaps, kind]
  );
  const overallNow = latest ? overall(latest, kind) : { total: 0, correct: 0, pct: null };

  const weak = useMemo(() => weakSpots(kind, 6), [snaps, kind]);

  // Per-topic rows for the list.
  const topicRows = useMemo(() => {
    const rows = names.map((name) => {
      const trend = trendFor(kind, name);
      const cur = trend.length ? trend[trend.length - 1] : null;
      const prev = trend.length > 1 ? trend[trend.length - 2] : null;
      return {
        name,
        trend,
        pct: cur ? cur.pct : null,
        total: cur ? cur.total : 0,
        delta: cur && prev ? cur.pct - prev.pct : null,
      };
    });
    const withData = rows.filter((r) => r.pct != null);
    const noData = rows.filter((r) => r.pct == null);
    const cmp = {
      worst: (a, b) => a.pct - b.pct,
      best:  (a, b) => b.pct - a.pct,
      name:  (a, b) => a.name.localeCompare(b.name),
    }[sort];
    if (sort === "name") return [...withData, ...noData].sort((a, b) => a.name.localeCompare(b.name));
    return [...withData.sort(cmp), ...noData];
  }, [names, kind, snaps, sort]);

  return (
    <div className="page prog-page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow"><IconPulse size={13} /> Progress</div>
          <h1 className="td-title">Progress & Weak Spots</h1>
          <p className="td-sub">
            Log your QBank stats over time. Track each subject &amp; system, watch the trend, focus the worst.
          </p>
        </div>
        <button className="td-submit-btn prog-add" onClick={() => setEditing(newDraft())}>
          + Log snapshot
        </button>
      </div>

      {editing && (
        <SnapshotEditor
          key={editing.id}
          draft={editing}
          onCancel={() => setEditing(null)}
          onSave={(d) => { saveSnapshot(d); refresh(); setEditing(null); }}
        />
      )}

      {snaps.length === 0 && !editing && (
        <div className="prog-empty">
          <p className="prog-empty-h">No snapshots yet</p>
          <p className="muted">
            Open your UWorld performance page, then log a snapshot with your Total / Correct per subject
            and system. Log another after your next test and the trend appears here.
          </p>
          <button className="td-submit-btn" onClick={() => setEditing(newDraft())}>+ Log your first snapshot</button>
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
              <span className="prog-weak-lbl">⚠ Weak spots — focus here</span>
              <div className="prog-weak-list">
                {weak.length === 0 && <span className="muted">Log a snapshot to see weak spots.</span>}
                {weak.map((w) => (
                  <div key={w.name} className="prog-weak-item">
                    <div className="prog-weak-bar-wrap">
                      <div className={`prog-weak-bar prog-bg-${toneFor(w.pct)}`} style={{ width: w.pct + "%" }} />
                    </div>
                    <span className="prog-weak-name">{w.name}</span>
                    <span className={`prog-weak-pct prog-${toneFor(w.pct)}`}>{w.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Topic trend list */}
          <div className="prog-list-head">
            <span className="prog-list-title">{kind === "subjects" ? "Subjects" : "Systems"} — trend</span>
            <div className="prog-sort">
              {[["worst", "Worst first"], ["best", "Best first"], ["name", "A–Z"]].map(([v, l]) => (
                <button key={v} className={`chip chip-sm${sort === v ? " active" : ""}`} onClick={() => setSort(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div className="prog-rows">
            {topicRows.map((r) => (
              <div key={r.name} className={`prog-row${r.pct == null ? " prog-row-empty" : ""}`}>
                <span className="prog-row-name">{r.name}</span>
                <span className="prog-row-spark"><Sparkline points={r.trend} w={130} h={30} /></span>
                <span className="prog-row-total muted">{r.total ? `${r.total} Q` : ""}</span>
                <span className={`prog-row-delta ${r.delta > 0 ? "prog-up" : r.delta < 0 ? "prog-down" : ""}`}>
                  {r.delta != null && r.delta !== 0 ? `${r.delta > 0 ? "▲" : "▼"} ${Math.abs(r.delta)}` : ""}
                </span>
                <span className={`prog-row-pct prog-${toneFor(r.pct)}`}>
                  {r.pct != null ? r.pct + "%" : "—"}
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
                  <button className="prog-hist-btn" onClick={() => setEditing(JSON.parse(JSON.stringify(s)))}>Edit</button>
                  <button className="prog-hist-btn prog-hist-del"
                    onClick={() => { if (confirm(`Delete snapshot from ${fmtDate(s.date)}?`)) { deleteSnapshot(s.id); refresh(); } }}>
                    Delete
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

// ── Snapshot editor ─────────────────────────────────────────────────────────
function SnapshotEditor({ draft, onCancel, onSave }) {
  const [d, setD] = useState(draft);
  const [tab, setTab] = useState("subjects");

  function setField(k, v) { setD((p) => ({ ...p, [k]: v })); }
  function setCell(kind, name, field, value) {
    setD((p) => {
      const rows = { ...(p[kind] || {}) };
      const row = { ...(rows[name] || {}) };
      const num = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);
      row[field] = num;
      rows[name] = row;
      return { ...p, [kind]: rows };
    });
  }

  function clean() {
    const out = JSON.parse(JSON.stringify(d));
    for (const kind of ["subjects", "systems"]) {
      const rows = out[kind] || {};
      for (const [name, row] of Object.entries(rows)) {
        const total = Number(row.total) || 0;
        const correct = Number(row.correct) || 0;
        const omitted = Number(row.omitted) || 0;
        if (!total && !correct && !omitted) { delete rows[name]; continue; }
        rows[name] = { total, correct, omitted };
      }
      out[kind] = rows;
    }
    return out;
  }

  const names = NAMES[tab];
  const filled = Object.keys(d.subjects || {}).filter((n) => d.subjects[n]?.total).length
    + Object.keys(d.systems || {}).filter((n) => d.systems[n]?.total).length;

  return (
    <div className="td-form-card prog-editor">
      <div className="prog-editor-head">
        <span className="td-form-title">Log snapshot</span>
        <div className="prog-editor-meta">
          <label className="qb-select">
            <span className="qb-select-lbl">Date</span>
            <input className="td-input" type="date" value={d.date} onChange={(e) => setField("date", e.target.value)} />
          </label>
          <label className="qb-select prog-note">
            <span className="qb-select-lbl">Note (optional)</span>
            <input className="td-input" placeholder="e.g. after UWorld test 7" value={d.note} onChange={(e) => setField("note", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="prog-tabs prog-editor-tabs">
        {KINDS.map(([k, label]) => (
          <button key={k} className={`chip${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
        <span className="prog-editor-hint muted">Enter Total &amp; Correct — % is computed. Leave blank to skip.</span>
      </div>

      <div className="prog-entry-grid">
        <div className="prog-entry-headrow">
          <span>Topic</span><span>Total</span><span>Correct</span><span>Omitted</span><span>%</span>
        </div>
        {names.map((name) => {
          const row = (d[tab] || {})[name] || {};
          const p = pct({ total: Number(row.total) || 0, correct: Number(row.correct) || 0 });
          return (
            <div key={name} className="prog-entry-row">
              <span className="prog-entry-name">{name}</span>
              <input className="td-input prog-num" type="number" min="0" inputMode="numeric"
                value={row.total ?? ""} onChange={(e) => setCell(tab, name, "total", e.target.value)} />
              <input className="td-input prog-num" type="number" min="0" inputMode="numeric"
                value={row.correct ?? ""} onChange={(e) => setCell(tab, name, "correct", e.target.value)} />
              <input className="td-input prog-num" type="number" min="0" inputMode="numeric"
                value={row.omitted ?? ""} onChange={(e) => setCell(tab, name, "omitted", e.target.value)} />
              <span className={`prog-entry-pct prog-${toneFor(p)}`}>{p != null ? p + "%" : "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="prog-editor-foot">
        <span className="muted">{filled} topic{filled === 1 ? "" : "s"} filled</span>
        <div className="prog-editor-actions">
          <button className="td-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="td-submit-btn" onClick={() => onSave(clean())}>Save snapshot</button>
        </div>
      </div>
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
