import { useMemo, useState } from "react";
import { SUBJECTS, SYSTEMS, pct } from "../lib/progressData.js";
import { localISODate } from "../lib/config.js";

// Single entry form for one UWorld / NBME sitting. Captures the overall result,
// its date, how you felt that day, and the full per-subject / per-system stat
// breakdown. Saving writes one test-log entry that feeds the Tests dashboard,
// the Progress page, the Home dashboard, and the planner's weakness engine.

export const MOODS = [
  { v: 1, emoji: "😞", label: "Rough" },
  { v: 2, emoji: "😕", label: "Off" },
  { v: 3, emoji: "😐", label: "OK" },
  { v: 4, emoji: "🙂", label: "Good" },
  { v: 5, emoji: "😄", label: "Great" },
];

const KINDS = [["subjects", "Subjects", SUBJECTS], ["systems", "Systems", SYSTEMS]];
const NAMES = { subjects: SUBJECTS, systems: SYSTEMS };

export function emptyEntry() {
  return {
    id: Date.now(),
    testNum: "",
    date: localISODate(),
    score: "",
    uworldAvg: "",
    questionCount: "",
    feeling: { mood: 0, note: "" },
    subjects: {},
    systems: {},
  };
}

// Overall % across a stat kind, for the live "computed score" hint.
function overallPct(rows = {}) {
  let total = 0, correct = 0;
  for (const r of Object.values(rows)) {
    if (r?.total) { total += Number(r.total) || 0; correct += Number(r.correct) || 0; }
  }
  return total ? Math.round((correct / total) * 100) : null;
}

function toneFor(p) {
  if (p == null) return "";
  if (p >= 70) return "ok";
  if (p >= 55) return "warn";
  return "bad";
}

export default function TestEntryForm({ draft, onCancel, onSave, defaultName }) {
  const [d, setD] = useState(draft);
  const [tab, setTab] = useState("subjects");
  // Starts expanded: this grid is the only place per-subject/system scores get
  // logged, and collapsed-by-default made it undiscoverable.
  const [showStats, setShowStats] = useState(true);
  const [err, setErr] = useState("");

  function set(k, v) { setD((p) => ({ ...p, [k]: v })); setErr(""); }
  function setFeeling(patch) { setD((p) => ({ ...p, feeling: { ...(p.feeling || {}), ...patch } })); }
  function setCell(kind, name, field, value) {
    setD((p) => {
      const rows = { ...(p[kind] || {}) };
      const row = { ...(rows[name] || {}) };
      row[field] = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);
      rows[name] = row;
      return { ...p, [kind]: rows };
    });
  }

  const subjPct = useMemo(() => overallPct(d.subjects), [d.subjects]);
  const sysPct = useMemo(() => overallPct(d.systems), [d.systems]);
  const computedScore = subjPct ?? sysPct;
  const filled =
    Object.keys(d.subjects || {}).filter((n) => d.subjects[n]?.total).length +
    Object.keys(d.systems || {}).filter((n) => d.systems[n]?.total).length;

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
    // Overall score: explicit entry wins, else derive from the stat breakdown.
    out.score = d.score !== "" && d.score != null ? Math.round(Number(d.score)) : (computedScore ?? null);
    out.uworldAvg = d.uworldAvg !== "" && d.uworldAvg != null ? Math.round(Number(d.uworldAvg)) : null;
    out.questionCount = d.questionCount !== "" && d.questionCount != null ? Math.round(Number(d.questionCount)) : null;
    // Blank name → auto-number from the existing log ("UWorld test 3").
    out.testNum = (d.testNum || "").trim() || defaultName || "UWorld test";
    if (!out.feeling?.mood && !out.feeling?.note) out.feeling = null;
    out.createdAt = d.createdAt || Date.now();
    return out;
  }

  function submit() {
    const score = d.score !== "" && d.score != null ? Number(d.score) : computedScore;
    if (score == null || isNaN(score)) {
      setErr("Enter an overall score, or fill in the stat breakdown so it can be computed.");
      return;
    }
    if (score < 0 || score > 100) { setErr("Score must be between 0 and 100."); return; }
    onSave(clean());
  }

  const names = NAMES[tab];

  return (
    <div className="td-form-card te-form">
      <div className="td-form-title">{draft.createdAt ? "Edit test" : "Log a UWorld / NBME test"}</div>

      {/* ── Result + date ── */}
      <div className="td-form-grid">
        <div className="td-form-field">
          <label className="td-label">Test name</label>
          <input className="td-input" placeholder="e.g. UWorld test 7 / NBME 30"
            value={d.testNum} onChange={(e) => set("testNum", e.target.value)} />
        </div>
        <div className="td-form-field">
          <label className="td-label">Date</label>
          <input className="td-input" type="date" value={d.date} max={localISODate()} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="td-form-field">
          <label className="td-label">
            Your score (%){computedScore != null && (d.score === "" || d.score == null) &&
              <span className="td-optional"> · auto {computedScore}%</span>}
          </label>
          <input className="td-input" type="number" min="0" max="100"
            placeholder={computedScore != null ? String(computedScore) : "e.g. 62"}
            value={d.score} onChange={(e) => set("score", e.target.value)} />
        </div>
        <div className="td-form-field">
          <label className="td-label">UWorld avg <span className="td-optional">(optional)</span></label>
          <input className="td-input" type="number" min="0" max="100" placeholder="e.g. 58"
            value={d.uworldAvg} onChange={(e) => set("uworldAvg", e.target.value)} />
        </div>
        <div className="td-form-field">
          <label className="td-label"># Questions <span className="td-optional">(optional)</span></label>
          <input className="td-input" type="number" min="1" placeholder="e.g. 40"
            value={d.questionCount} onChange={(e) => set("questionCount", e.target.value)} />
        </div>
      </div>

      {/* ── Feeling that day ── */}
      <div className="te-feeling">
        <label className="td-label">How did you feel that day?</label>
        <div className="te-mood-row">
          {MOODS.map((m) => (
            <button key={m.v} type="button"
              className={`te-mood${d.feeling?.mood === m.v ? " on" : ""}`}
              onClick={() => setFeeling({ mood: d.feeling?.mood === m.v ? 0 : m.v })}
              title={m.label}>
              <span className="te-mood-emoji">{m.emoji}</span>
              <span className="te-mood-lbl">{m.label}</span>
            </button>
          ))}
        </div>
        <input className="td-input te-mood-note" placeholder="A note about today (energy, focus, life) — optional"
          value={d.feeling?.note || ""} onChange={(e) => setFeeling({ note: e.target.value })} />
      </div>

      {/* ── Stats breakdown (optional, collapsible) ── */}
      <div className="te-stats">
        <button type="button" className="te-stats-toggle" onClick={() => setShowStats((s) => !s)}>
          <span>Scores by subject &amp; system — powers Progress &amp; weak spots {filled > 0 && <span className="te-stats-count">{filled} filled</span>}</span>
          <span className={`te-stats-chev${showStats ? " open" : ""}`}>▾</span>
        </button>
        {showStats && (
          <>
            <div className="prog-tabs prog-editor-tabs">
              {KINDS.map(([k, label]) => (
                <button key={k} type="button" className={`chip${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>
                  {label}{k === "subjects" && subjPct != null ? ` · ${subjPct}%` : k === "systems" && sysPct != null ? ` · ${sysPct}%` : ""}
                </button>
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
          </>
        )}
      </div>

      {err && <p className="td-form-err" role="alert">{err}</p>}
      <div className="te-form-foot">
        <span className="muted">{filled} topic{filled === 1 ? "" : "s"} filled</span>
        <div className="te-form-actions">
          <button className="td-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="td-submit-btn" onClick={submit}>{draft.createdAt ? "Save changes" : "Save test →"}</button>
        </div>
      </div>
    </div>
  );
}
