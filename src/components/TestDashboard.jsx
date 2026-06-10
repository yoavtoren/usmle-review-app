import { useState, useMemo } from "react";
import { loadTestLog, saveTestLog } from "../lib/storage.js";

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

  const linePath = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = pts => {
    if (pts.length < 2) return "";
    const base = toY(0);
    return `${linePath(pts)} L${pts[pts.length - 1][0].toFixed(1)},${base.toFixed(1)} L${pts[0][0].toFixed(1)},${base.toFixed(1)} Z`;
  };

  const gridYs = [0, 25, 50, 60, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid */}
      {gridYs.map(y => (
        <g key={y}>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={toY(y)} y2={toY(y)}
            stroke="var(--line)" strokeWidth={y === 60 ? "1.5" : "1"}
            strokeDasharray={y === 60 ? "4 3" : undefined}
          />
          <text x={PAD.left - 6} y={toY(y)} textAnchor="end" dominantBaseline="middle" fontSize="9.5" fill="var(--muted)">
            {y}%
          </text>
        </g>
      ))}

      {/* 60% label */}
      <text x={W - PAD.right + 4} y={toY(60)} dominantBaseline="middle" fontSize="8.5" fill="#f59e0b" fontWeight="700">
        target
      </text>

      {/* UWorld area + line */}
      {uwPts.length >= 2 && (
        <>
          <path d={areaPath(uwPts)} fill="#f59e0b" opacity="0.07" />
          <path d={linePath(uwPts)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        </>
      )}

      {/* Score area + line */}
      {scorePts.length >= 2 && (
        <>
          <path d={areaPath(scorePts)} fill="var(--accent)" opacity="0.09" />
          <path d={linePath(scorePts)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* UWorld dots */}
      {uwPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#f59e0b" stroke="var(--surface)" strokeWidth="2" />
      ))}

      {/* Score dots */}
      {scorePts.map(([x, y, t], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5" />
          <text x={x} y={y - 11} textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="700">
            {t.score}%
          </text>
        </g>
      ))}

      {/* X-axis labels */}
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

export default function TestDashboard({ onBack, onStudy }) {
  const [tests, setTests] = useState(loadTestLog);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    testNum: "",
    score: "",
    date: new Date().toISOString().split("T")[0],
    uworldAvg: "",
  });
  const [formErr, setFormErr] = useState("");

  const sorted = useMemo(
    () => [...tests].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [tests]
  );

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
      avgGap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
      avgUW: withUW.length ? Math.round(withUW.reduce((a, t) => a + t.uworldAvg, 0) / withUW.length) : null,
    };
  }, [tests, sorted]);

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setFormErr("");
  }

  function handleAdd() {
    const score = Number(form.score);
    if (!form.score || isNaN(score) || score < 0 || score > 100) {
      setFormErr("Enter a valid score between 0 and 100.");
      return;
    }
    const newTest = {
      id: Date.now(),
      testNum: form.testNum.trim() || `Test ${tests.length + 1}`,
      score: Math.round(score),
      date: form.date || new Date().toISOString().split("T")[0],
      uworldAvg: form.uworldAvg !== "" ? Math.round(Number(form.uworldAvg)) : null,
    };
    const next = [...tests, newTest];
    setTests(next);
    saveTestLog(next);
    setShowForm(false);
    setForm({ testNum: "", score: "", date: new Date().toISOString().split("T")[0], uworldAvg: "" });
  }

  function handleDelete(id) {
    const next = tests.filter(t => t.id !== id);
    setTests(next);
    saveTestLog(next);
  }

  const hasTrend = stats?.trend != null;
  const trendUp = hasTrend && stats.trend > 0;
  const trendFlat = hasTrend && stats.trend === 0;

  return (
    <div className="td-page">
      <button className="back-btn" onClick={onBack}>← Home</button>

      {/* Header */}
      <div className="td-header">
        <div>
          <h1 className="td-title">Test Progress</h1>
          <p className="muted td-sub">Track NBME · UWorld · practice scores over time</p>
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
              <input
                className="td-input"
                placeholder="e.g. NBME 30"
                value={form.testNum}
                onChange={e => setField("testNum", e.target.value)}
              />
            </div>
            <div className="td-form-field">
              <label className="td-label">Your score (%)</label>
              <input
                className="td-input"
                type="number" min="0" max="100"
                placeholder="e.g. 65"
                value={form.score}
                onChange={e => setField("score", e.target.value)}
              />
            </div>
            <div className="td-form-field">
              <label className="td-label">Date</label>
              <input
                className="td-input"
                type="date"
                value={form.date}
                onChange={e => setField("date", e.target.value)}
              />
            </div>
            <div className="td-form-field">
              <label className="td-label">
                UWorld avg <span className="td-optional">(optional)</span>
              </label>
              <input
                className="td-input"
                type="number" min="0" max="100"
                placeholder="e.g. 72"
                value={form.uworldAvg}
                onChange={e => setField("uworldAvg", e.target.value)}
              />
            </div>
          </div>
          {formErr && <p className="td-form-err">{formErr}</p>}
          <button className="td-submit-btn" onClick={handleAdd}>Save test →</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
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
          {stats.avgUW != null && (
            <div className="td-stat-card">
              <span className="td-stat-num td-uw-num">{stats.avgUW}%</span>
              <span className="td-stat-label">UWorld avg</span>
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
      )}

      {/* Chart */}
      {tests.length > 0 && (
        <div className="td-chart-card">
          <div className="td-chart-head">
            <span className="td-chart-title">Score over time</span>
            <div className="td-legend">
              <span className="td-legend-item">
                <span className="td-legend-line td-legend-score-line" />
                My score
              </span>
              <span className="td-legend-item">
                <span className="td-legend-line td-legend-uw-line" />
                UWorld avg
              </span>
              <span className="td-legend-item td-legend-target">
                <span className="td-legend-dash" />
                60% target
              </span>
            </div>
          </div>
          <div className="td-chart-body">
            <LineChart tests={sorted} />
          </div>
        </div>
      )}

      {/* Table */}
      {tests.length > 0 ? (
        <div className="td-table-card">
          <div className="td-table-head">
            <span className="td-chart-title">All tests</span>
            <span className="muted small">{tests.length} recorded</span>
          </div>
          <div className="td-table-wrap">
            <table className="td-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>UWorld avg</th>
                  <th>Gap</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => {
                  const gap = t.uworldAvg != null ? t.score - t.uworldAvg : null;
                  return (
                    <tr key={t.id}>
                      <td className="td-col-name">{t.testNum}</td>
                      <td className="td-col-date">{fmt(t.date)}</td>
                      <td>
                        <span className={`td-score-badge ${t.score >= 60 ? "td-score-ok" : t.score >= 50 ? "td-score-mid" : "td-score-low"}`}>
                          {t.score}%
                        </span>
                      </td>
                      <td>
                        {t.uworldAvg != null
                          ? <span className="td-uw-badge">{t.uworldAvg}%</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td><GapBadge gap={gap} /></td>
                      <td>
                        <button className="td-del-btn" onClick={() => handleDelete(t.id)} title="Delete">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="td-empty">
          <div className="td-empty-icon">📊</div>
          <p className="td-empty-msg">No tests recorded yet</p>
          <p className="muted small">Click "+ Add test" above to log your first score.</p>
        </div>
      )}

      {onStudy && (
        <div className="dash-footer-cta" style={{ marginTop: 16 }}>
          <button className="dash-cta-btn dash-cta-full" onClick={onStudy}>
            📝 Study missed questions →
          </button>
        </div>
      )}
    </div>
  );
}
