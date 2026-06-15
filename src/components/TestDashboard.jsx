import { useState, useMemo, useEffect } from "react";
import { loadTestLog, saveTestLog, loadProgress } from "../lib/storage.js";

const BASE = import.meta.env.BASE_URL;
const QBANK_TOTAL = 3400;   // UWorld Step 1 Qbank (~3,400 questions)
const DEFAULT_BLOCK = 40;   // standard UWorld block size when count not given

function fmt(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function LineChart({ tests }) {
  if (!tests || tests.length === 0) return null;

  const W = 580, H = 220;
  const PAD = { top: 20, right: 24, bottom: 44, left: 42 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const sorted = [...tests].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates = sorted.map(t => new Date(t.date + "T12:00:00").getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const span = maxDate - minDate || 86400000;

  const toX = d => PAD.left + ((new Date(d + "T12:00:00").getTime() - minDate) / span) * CW;
  const toY = v => PAD.top + CH - (Math.max(0, Math.min(100, v)) / 100) * CH;

  const scorePts = sorted.map(t => [toX(t.date), toY(t.score), t]);
  const uwPts = sorted.filter(t => t.uworldAvg != null).map(t => [toX(t.date), toY(t.uworldAvg), t]);

  // Linear regression trend line over score points
  const trendLine = (() => {
    if (scorePts.length < 2) return null;
    const xs = scorePts.map(([x]) => x);
    const ys = scorePts.map(([, y]) => y);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b) / n;
    const my = ys.reduce((a, b) => a + b) / n;
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
                  xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const intercept = my - slope * mx;
    const x1 = xs[0], x2 = xs[xs.length - 1];
    return { x1, y1: slope * x1 + intercept, x2, y2: slope * x2 + intercept };
  })();

  const linePath = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = pts => {
    if (pts.length < 2) return "";
    const base = toY(0);
    return `${linePath(pts)} L${pts[pts.length - 1][0].toFixed(1)},${base.toFixed(1)} L${pts[0][0].toFixed(1)},${base.toFixed(1)} Z`;
  };

  const gridYs = [0, 25, 50, 60, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {gridYs.map(y => (
        <g key={y}>
          <line x1={PAD.left} x2={W - PAD.right} y1={toY(y)} y2={toY(y)}
            stroke="var(--line)" strokeWidth={y === 60 ? "1.5" : "1"}
            strokeDasharray={y === 60 ? "4 3" : undefined} />
          <text x={PAD.left - 6} y={toY(y)} textAnchor="end" dominantBaseline="middle" fontSize="9.5" fill="var(--muted)">
            {y}%
          </text>
        </g>
      ))}
      <text x={W - PAD.right + 4} y={toY(60)} dominantBaseline="middle" fontSize="8.5" fill="#f59e0b" fontWeight="700">
        target
      </text>

      {trendLine && (
        <line
          x1={trendLine.x1.toFixed(1)} y1={trendLine.y1.toFixed(1)}
          x2={trendLine.x2.toFixed(1)} y2={trendLine.y2.toFixed(1)}
          stroke="rgba(148,163,184,0.55)" strokeWidth="1.5" strokeDasharray="6 4" strokeLinecap="round"
        />
      )}
      {uwPts.length >= 2 && (
        <>
          <path d={areaPath(uwPts)} fill="#f59e0b" opacity="0.07" />
          <path d={linePath(uwPts)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        </>
      )}
      {scorePts.length >= 2 && (
        <>
          <path d={areaPath(scorePts)} fill="var(--accent)" opacity="0.09" />
          <path d={linePath(scorePts)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {uwPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#f59e0b" stroke="var(--surface)" strokeWidth="2" />
      ))}
      {scorePts.map(([x, y, t], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5" />
          <text x={x} y={y - 11} textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="700">
            {t.score}%
          </text>
        </g>
      ))}
      {sorted.map((t, i) => (
        <text key={i} x={toX(t.date)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
          {new Date(t.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </text>
      ))}
    </svg>
  );
}

function GapBadge({ gap }) {
  if (gap == null) return <span className="muted">—</span>;
  const cls = gap >= 0 ? "td-gap-pos" : "td-gap-neg";
  return <span className={`td-gap-badge ${cls}`}>{gap >= 0 ? "+" : ""}{gap}%</span>;
}

function ScoreBadge({ score }) {
  const cls = score >= 60 ? "td-score-ok" : score >= 50 ? "td-score-mid" : "td-score-low";
  return <span className={`td-score-badge ${cls}`}>{score}%</span>;
}

export default function TestDashboard({ onBack, onStudy }) {
  const [tests, setTests] = useState(loadTestLog);
  const [progress] = useState(loadProgress);
  // Map of deckFile → question IDs (only loaded for tests that have a deckFile)
  const [deckQuestions, setDeckQuestions] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    testNum: "",
    score: "",
    date: new Date().toISOString().split("T")[0],
    uworldAvg: "",
    questionCount: "",
  });
  const [formErr, setFormErr] = useState("");

  // Load the deck for every test that has a deckFile
  useEffect(() => {
    const files = [...new Set(tests.filter(t => t.deckFile).map(t => t.deckFile))];
    files.forEach(f => {
      if (deckQuestions[f]) return;
      fetch(`${BASE}${f}`)
        .then(r => r.json())
        .then(d => setDeckQuestions(prev => ({ ...prev, [f]: d.questions || [] })))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests]);

  // Ascending by date — used by the chart and "latest/trend" stats.
  const sorted = useMemo(
    () => [...tests].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [tests]
  );
  // Descending — newest test at the head of the list.
  const listSorted = useMemo(() => [...sorted].reverse(), [sorted]);

  // Total UWorld questions completed (counts entered per test; standard block as fallback).
  const totalQs = useMemo(
    () => tests.reduce((s, t) => s + (t.questionCount ?? DEFAULT_BLOCK), 0),
    [tests]
  );
  const qbankPct = Math.min(100, Math.round((totalQs / QBANK_TOTAL) * 100));

  const stats = useMemo(() => {
    if (!tests.length) return null;
    const scores = tests.map(t => t.score);
    const withUW = tests.filter(t => t.uworldAvg != null);
    const gaps = withUW.map(t => t.score - t.uworldAvg);
    return {
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
      latest: sorted.at(-1)?.score,
      trend: sorted.length >= 2 ? sorted.at(-1).score - sorted.at(-2).score : null,
      // Net change from the first recorded test to the latest — the real trajectory.
      net: sorted.length >= 2 ? sorted.at(-1).score - sorted[0].score : null,
      avgGap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
    };
  }, [tests, sorted]);

  // Done count per test (using that test's own deck questions)
  function getDoneCount(test) {
    if (!test.deckFile) return 0;
    const qs = deckQuestions[test.deckFile];
    if (!qs) return 0;
    return qs.filter(q => progress[q.id]?.done).length;
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); setFormErr(""); }

  function handleAdd() {
    const score = Number(form.score);
    if (!form.score || isNaN(score) || score < 0 || score > 100) {
      setFormErr("Enter a valid score between 0 and 100.");
      return;
    }
    const qCount = form.questionCount !== "" ? Math.round(Number(form.questionCount)) : null;
    const newTest = {
      id: Date.now(),
      testNum: form.testNum.trim() || `Test ${tests.length + 1}`,
      score: Math.round(score),
      date: form.date || new Date().toISOString().split("T")[0],
      uworldAvg: form.uworldAvg !== "" ? Math.round(Number(form.uworldAvg)) : null,
      hasQuestions: false,
      questionCount: qCount,
    };
    const next = [...tests, newTest];
    setTests(next);
    saveTestLog(next);
    setShowForm(false);
    setForm({ testNum: "", score: "", date: new Date().toISOString().split("T")[0], uworldAvg: "", questionCount: "" });
  }

  function handleDelete(id) {
    const next = tests.filter(t => t.id !== id);
    setTests(next);
    saveTestLog(next);
  }

  const hasTrend = stats?.trend != null;
  const trendUp  = hasTrend && stats.trend > 0;
  const trendFlat = hasTrend && stats.trend === 0;

  return (
    <div className="td-page">
      <button className="back-btn" onClick={onBack}>← Home</button>

      {/* Header */}
      <div className="td-header">
        <div>
          <h1 className="td-title">Tests</h1>
          <p className="muted td-sub">Track NBME · UWorld · practice blocks over time</p>
        </div>
        <button
          className={`dash-cta-btn${showForm ? " td-cancel-btn" : ""}`}
          onClick={() => { setShowForm(s => !s); setFormErr(""); }}
        >
          {showForm ? "✕ Cancel" : "+ Add test"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="td-form-card">
          <div className="td-form-title">Record a new test</div>
          <div className="td-form-grid">
            <div className="td-form-field">
              <label className="td-label">Test name</label>
              <input className="td-input" placeholder="e.g. NBME 30"
                value={form.testNum} onChange={e => setField("testNum", e.target.value)} />
            </div>
            <div className="td-form-field">
              <label className="td-label">Your score (%)</label>
              <input className="td-input" type="number" min="0" max="100" placeholder="e.g. 65"
                value={form.score} onChange={e => setField("score", e.target.value)} />
            </div>
            <div className="td-form-field">
              <label className="td-label">Date</label>
              <input className="td-input" type="date"
                value={form.date} onChange={e => setField("date", e.target.value)} />
            </div>
            <div className="td-form-field">
              <label className="td-label">UWorld avg <span className="td-optional">(optional)</span></label>
              <input className="td-input" type="number" min="0" max="100" placeholder="e.g. 72"
                value={form.uworldAvg} onChange={e => setField("uworldAvg", e.target.value)} />
            </div>
            <div className="td-form-field">
              <label className="td-label"># Questions <span className="td-optional">(optional)</span></label>
              <input className="td-input" type="number" min="1" placeholder="e.g. 40"
                value={form.questionCount} onChange={e => setField("questionCount", e.target.value)} />
            </div>
          </div>
          {formErr && <p className="td-form-err">{formErr}</p>}
          <button className="td-submit-btn" onClick={handleAdd}>Save test →</button>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="td-layout">

        {/* LEFT: test list */}
        <div className="td-col-list">
          <div className="td-list-head">
            <span className="td-list-title">Your tests</span>
            {tests.length > 0 && <span className="muted small">{tests.length} recorded</span>}
          </div>

          {tests.length > 0 ? (
            <div className="td-test-list">
              {listSorted.map((t, i) => {
                const gap      = t.uworldAvg != null ? t.score - t.uworldAvg : null;
                const isLatest = i === 0;
                const qTotal   = t.questionCount ?? null;
                const doneCount = getDoneCount(t);

                return (
                  <div key={t.id} className={`td-test-card${isLatest ? " td-test-latest" : ""}`}>
                    <div className="td-test-top-row">
                      <div className="td-test-name">{t.testNum}</div>
                      <button className="td-del-btn" onClick={() => handleDelete(t.id)} title="Remove">✕</button>
                    </div>
                    <div className="td-test-date">{fmt(t.date)}</div>
                    <div className="td-test-badges">
                      <ScoreBadge score={t.score} />
                      {t.uworldAvg != null && (
                        <span className="td-uw-badge">{t.uworldAvg}% UWorld</span>
                      )}
                      <GapBadge gap={gap} />
                    </div>

                    {qTotal != null && (
                      <div className="td-done-progress">
                        <div className="td-done-bar-wrap">
                          <div
                            className="td-done-bar-fill"
                            style={{ width: `${Math.round((doneCount / qTotal) * 100)}%` }}
                          />
                        </div>
                        <span className="td-done-label">
                          {doneCount} / {qTotal} reviewed
                        </span>
                      </div>
                    )}

                    {t.hasQuestions && onStudy && (
                      <button className="td-review-btn" onClick={() => onStudy(t.deckFile, t.block)}>
                        Review questions →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="td-empty">
              <div className="td-empty-icon">📊</div>
              <p className="td-empty-msg">No tests recorded yet</p>
              <p className="muted small">Click "+ Add test" above to log your first score.</p>
            </div>
          )}
        </div>

        {/* RIGHT: dashboard */}
        <div className="td-col-dash">
          {stats ? (
            <>
              {/* UWorld Qbank completion */}
              <div className="td-qbank">
                <div className="td-qbank-head">
                  <span className="td-qbank-title">UWorld Qbank progress</span>
                  <span className="td-qbank-count">
                    {totalQs.toLocaleString()} / {QBANK_TOTAL.toLocaleString()} Qs
                  </span>
                </div>
                <div className="td-qbank-bar">
                  <div className="td-qbank-fill" style={{ width: `${Math.max(qbankPct, 1)}%` }} />
                </div>
                <span className="td-qbank-sub">
                  {qbankPct}% of the Qbank · {(QBANK_TOTAL - totalQs).toLocaleString()} left
                </span>
              </div>

              <div className="td-stats-row">
                <div className="td-stat-card">
                  <span className="td-stat-num">{stats.avg}%</span>
                  <span className="td-stat-label">Avg score</span>
                </div>
                <div className="td-stat-card">
                  <span className="td-stat-num td-best">{stats.best}%</span>
                  <span className="td-stat-label">Personal best</span>
                </div>
                <div className="td-stat-card">
                  <span className="td-stat-num">
                    {stats.latest}%{" "}
                    {hasTrend && (
                      <span className={`td-trend ${trendFlat ? "" : trendUp ? "td-trend-up" : "td-trend-dn"}`}>
                        {trendFlat ? "→" : trendUp ? `▲${stats.trend}` : `▼${Math.abs(stats.trend)}`}
                      </span>
                    )}
                  </span>
                  <span className="td-stat-label">Latest</span>
                </div>
                {stats.net != null && (
                  <div className="td-stat-card">
                    <span className={`td-stat-num ${stats.net > 0 ? "td-gap-pos-num" : stats.net < 0 ? "td-gap-neg-num" : ""}`}>
                      {stats.net > 0 ? "▲ +" : stats.net < 0 ? "▼ −" : ""}{stats.net === 0 ? "0" : Math.abs(stats.net)}%
                    </span>
                    <span className="td-stat-label">Trend since first</span>
                  </div>
                )}
                {stats.avgGap != null && (
                  <div className="td-stat-card">
                    <span className={`td-stat-num ${stats.avgGap >= 0 ? "td-gap-pos-num" : "td-gap-neg-num"}`}>
                      {stats.avgGap >= 0 ? "+" : ""}{stats.avgGap}%
                    </span>
                    <span className="td-stat-label">Avg gap vs UWorld</span>
                  </div>
                )}
              </div>

              <div className="td-chart-card">
                <div className="td-chart-head">
                  <span className="td-chart-title">Score over time</span>
                  <div className="td-legend">
                    <span className="td-legend-item">
                      <span className="td-legend-line td-legend-score-line" /> My score
                    </span>
                    <span className="td-legend-item">
                      <span className="td-legend-line td-legend-uw-line" /> UWorld avg
                    </span>
                    <span className="td-legend-item td-legend-target">
                      <span className="td-legend-dash" /> 60% target
                    </span>
                    <span className="td-legend-item td-legend-trend">
                      <span className="td-legend-dash td-legend-trend-dash" /> Trend
                    </span>
                  </div>
                </div>
                <div className="td-chart-body">
                  <LineChart tests={sorted} />
                </div>
              </div>
            </>
          ) : (
            <div className="td-dash-empty">
              <p className="muted">Add a test to see your dashboard.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
