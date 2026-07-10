import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadTestLog, saveTestLog, loadProgress, testScore } from "../lib/storage.js";
import TestEntryForm, { emptyEntry, MOODS } from "./TestEntryForm.jsx";
import { useLongPress } from "../lib/longPress.js";
import { impact, notification } from "../lib/haptics.js";

const BASE = import.meta.env.BASE_URL;
const QBANK_TOTAL = 3400;   // UWorld Step 1 Qbank (~3,400 questions)
const DEFAULT_BLOCK = 40;   // standard UWorld block size when count not given

// Resolve which deck block a logged test maps to. Prefer explicit fields, else
// infer from the test name ("UWORLD test 5" → "test5") so manually-added tests
// still link to their questions.
function blockOf(test) {
  if (test.block) return test.block;
  const m = String(test.testNum || "").match(/test\s*(\d+)/i);
  return m ? `test${m[1]}` : null;
}
function deckFileOf(test) {
  return test.deckFile || (blockOf(test) ? "questions/deck.json" : null);
}
// Does a deck question belong to the given block? Test 1 = no block field.
function qInBlock(q, block) {
  return block === "test1" ? q.block === undefined : q.block === `UWORLD test ${block.slice(-1)}`;
}

function fmt(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Long-press / right-click popover for a test card: Edit · Delete.
function CtxMenu({ x, y, onEdit, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - 110);
  return (
    <div className="ctx-menu" ref={ref} role="menu" style={{ left, top }}>
      <button className="ctx-item" role="menuitem" onClick={onEdit}>✎ Edit</button>
      <div className="ctx-sep" />
      <button className="ctx-item danger" role="menuitem" onClick={onDelete}>✕ Delete…</button>
    </div>
  );
}

function LineChart({ tests }) {
  if (!tests || tests.length === 0) return null;

  const W = 660, H = 232;
  const PAD = { top: 20, right: 30, bottom: 44, left: 42 };
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

  // When tests cluster within days their labels overprint. Always label the
  // first and last points; label intermediates only when they sit far enough
  // (in px) from the previous labeled point AND from the last point's label.
  const LABEL_GAP = 28;
  const labeledIdx = (() => {
    const xs = sorted.map(t => toX(t.date));
    const keep = new Set();
    if (!xs.length) return keep;
    keep.add(0);
    keep.add(xs.length - 1);
    let lastX = xs[0];
    for (let i = 1; i < xs.length - 1; i++) {
      if (xs[i] - lastX > LABEL_GAP && xs[xs.length - 1] - xs[i] > LABEL_GAP) {
        keep.add(i);
        lastX = xs[i];
      }
    }
    return keep;
  })();

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
      <text x={W - PAD.right + 4} y={toY(60)} dominantBaseline="middle" fontSize="8.5" fill="#A26A12" fontWeight="700">
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
          <path d={areaPath(uwPts)} fill="#A26A12" opacity="0.07" />
          <path d={linePath(uwPts)} fill="none" stroke="#A26A12" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        </>
      )}
      {scorePts.length >= 2 && (
        <>
          <path d={areaPath(scorePts)} fill="var(--accent)" opacity="0.09" />
          <path d={linePath(scorePts)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {uwPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#A26A12" stroke="var(--surface)" strokeWidth="2" />
      ))}
      {scorePts.map(([x, y, t], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5" />
          {labeledIdx.has(i) && (
            <text x={x} y={y - 11} textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="700">
              {t.score}%
            </text>
          )}
        </g>
      ))}
      {sorted.map((t, i) => labeledIdx.has(i) && (
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

function moodOf(t) {
  return t?.feeling?.mood ? MOODS.find((m) => m.v === t.feeling.mood) : null;
}

export default function TestDashboard({ onBack, onStudy }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [tests, setTests] = useState(loadTestLog);
  const [progress] = useState(loadProgress);
  // Map of deckFile → question IDs (only loaded for tests that have a deckFile)
  const [deckQuestions, setDeckQuestions] = useState({});
  const [editing, setEditing] = useState(null);   // entry draft being added/edited, or null
  const [confirmDelId, setConfirmDelId] = useState(null); // armed delete (inline "Sure?" confirm)
  const confirmTimer = useRef(null);
  const [savedId, setSavedId] = useState(null);   // just-saved entry → brief "Saved ✓" + card flash
  const savedTimer = useRef(null);
  const [ctx, setCtx] = useState(null);           // { id, x, y } — long-press context menu

  // One shared long-press handler for every card; the card is resolved from
  // the pressed element (hooks can't be called per list item).
  const cardPress = useLongPress((e) => {
    const el = e.target?.closest?.("[data-test-id]");
    if (!el) return;
    impact("medium");
    setCtx({ id: el.dataset.testId, x: e.clientX, y: e.clientY });
  });

  useEffect(() => () => {
    clearTimeout(confirmTimer.current);
    clearTimeout(savedTimer.current);
  }, []);

  // Other pages (Progress, Home) navigate here with an intent in router state:
  // { openForm: true } opens a fresh entry form, { editId } opens that test's
  // editor. Consume the state (replace) so refresh/back doesn't re-trigger it.
  useEffect(() => {
    const st = loc.state;
    if (!st?.openForm && st?.editId == null) return;
    if (st.editId != null) {
      const t = tests.find((x) => x.id === st.editId);
      if (t) setEditing(draftFrom(t));
    } else {
      setEditing(emptyEntry());
    }
    window.scrollTo(0, 0);
    nav(loc.pathname, { replace: true, state: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state]);

  // Load the deck for every test that has a deckFile
  useEffect(() => {
    const files = [...new Set(tests.map(deckFileOf).filter(Boolean))];
    files.forEach(f => {
      if (deckQuestions[f]) return;
      fetch(`${BASE}${f}`)
        .then(r => r.json())
        .then(d => setDeckQuestions(prev => ({ ...prev, [f]: d.questions || [] })))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests]);

  // Ascending by date, each with a resolved overall score (explicit or derived
  // from its stat breakdown) — used by the chart and "latest/trend" stats.
  const sorted = useMemo(
    () => [...tests]
      .map((t) => ({ ...t, score: testScore(t) }))
      .filter((t) => t.score != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [tests]
  );
  // Descending — newest test at the head of the list (raw entries, unfiltered).
  const listSorted = useMemo(
    () => [...tests].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [tests]
  );

  // Total UWorld questions completed (counts entered per test; standard block as fallback).
  const totalQs = useMemo(
    () => tests.reduce((s, t) => s + (t.questionCount ?? DEFAULT_BLOCK), 0),
    [tests]
  );
  // Tests without an explicit question count contribute an assumed 40 — mark
  // the completion figures as estimates when any such entry exists.
  const estimatedCount = useMemo(
    () => tests.filter(t => t.questionCount == null).length,
    [tests]
  );
  const isEstimate = estimatedCount > 0;
  const qbankPct = Math.min(100, Math.round((totalQs / QBANK_TOTAL) * 100));

  // Default name for a new entry: next number after the highest existing
  // "UWorld test N" so a blank name auto-numbers instead of colliding.
  const nextName = useMemo(() => {
    const nums = tests.map(t => {
      const m = String(t.testNum || "").match(/uworld\s*test\s*(\d+)/i);
      return m ? Number(m[1]) : 0;
    });
    return `UWorld test ${Math.max(0, ...nums) + 1}`;
  }, [tests]);

  const stats = useMemo(() => {
    if (!sorted.length) return null;
    const scores = sorted.map(t => t.score);
    const gaps = sorted.filter(t => t.uworldAvg != null).map(t => t.score - t.uworldAvg);
    return {
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
      latest: sorted.at(-1)?.score,
      trend: sorted.length >= 2 ? sorted.at(-1).score - sorted.at(-2).score : null,
      // Net change from the first recorded test to the latest — the real trajectory.
      net: sorted.length >= 2 ? sorted.at(-1).score - sorted[0].score : null,
      avgGap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
    };
  }, [sorted]);

  // Questions belonging to a test's block (from its resolved deck).
  function blockQuestions(test) {
    const df = deckFileOf(test), bl = blockOf(test);
    const all = df && deckQuestions[df];
    if (!all || !bl) return null;
    return all.filter(q => qInBlock(q, bl));
  }
  // Done count per test (only that test's own block questions).
  function getDoneCount(test) {
    const qs = blockQuestions(test);
    return qs ? qs.filter(q => progress[q.id]?.done).length : 0;
  }

  // Prefill the editor from an existing entry (numbers → strings for inputs).
  function draftFrom(t) {
    return {
      ...emptyEntry(), ...t,
      score: t.score ?? "", uworldAvg: t.uworldAvg ?? "", questionCount: t.questionCount ?? "",
      feeling: t.feeling || { mood: 0, note: "" },
      subjects: t.subjects || {}, systems: t.systems || {},
    };
  }

  function handleSave(entry) {
    const idx = tests.findIndex(t => t.id === entry.id);
    const next = idx >= 0
      ? tests.map(t => (t.id === entry.id ? entry : t))
      : [...tests, entry];
    setTests(next);
    saveTestLog(next);
    setEditing(null);
    notification("success");
    // Brief acknowledgment: "Saved ✓" by the list header + flash the card.
    setSavedId(entry.id);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedId(null), 2500);
  }

  // Two-tap inline confirm (same pattern as the reset-test confirm in
  // TestReview): first tap arms "Sure?", second tap deletes, disarms after ~3s.
  function handleDelete(id) {
    if (confirmDelId !== id) {
      setConfirmDelId(id);
      impact("medium");
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelId(null), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmDelId(null);
    const next = tests.filter(t => t.id !== id);
    setTests(next);
    saveTestLog(next);
  }

  const hasTrend = stats?.trend != null;
  const trendUp  = hasTrend && stats.trend > 0;
  const trendFlat = hasTrend && stats.trend === 0;

  return (
    <div className="td-page">
      <button className="back-btn" onClick={onBack}>← Step 1</button>

      {ctx && (
        <CtxMenu
          x={ctx.x}
          y={ctx.y}
          onClose={() => setCtx(null)}
          onEdit={() => {
            const t = tests.find((x) => String(x.id) === String(ctx.id));
            setCtx(null);
            if (t) { setEditing(draftFrom(t)); window.scrollTo({ top: 0, behavior: "smooth" }); }
          }}
          onDelete={() => {
            const id = ctx.id;
            setCtx(null);
            // arm the same two-tap confirm the ✕ button uses — the card's
            // button turns into "Sure?" so behavior stays consistent
            const t = tests.find((x) => String(x.id) === String(id));
            if (t) handleDelete(t.id);
          }}
        />
      )}

      {/* Header */}
      <div className="td-header">
        <div>
          <h1 className="td-title">Tests</h1>
          <p className="muted td-sub">Log each UWorld / NBME sitting — result, stats &amp; how you felt</p>
        </div>
        <button
          className={`dash-cta-btn${editing ? " td-cancel-btn" : ""}`}
          onClick={() => setEditing(editing ? null : emptyEntry())}
        >
          {editing ? "✕ Cancel" : "+ Log test"}
        </button>
      </div>

      {/* Unified entry form (add / edit) */}
      {editing && (
        <TestEntryForm
          key={editing.id}
          draft={editing}
          defaultName={nextName}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* ── Two-column layout ── */}
      <div className="td-layout">

        {/* LEFT: test list */}
        <div className="td-col-list">
          <div className="td-list-head">
            <span className="td-list-title">Your tests</span>
            {savedId != null && (
              <span className="small" role="status" style={{ color: "var(--ok, #2E7D32)", fontWeight: 700 }}>
                Saved ✓
              </span>
            )}
            {tests.length > 0 && <span className="muted small">{tests.length} recorded</span>}
          </div>

          {tests.length > 0 ? (
            <div className="td-test-list">
              {listSorted.map((t, i) => {
                const sc       = testScore(t);
                const gap      = t.uworldAvg != null && sc != null ? sc - t.uworldAvg : null;
                const isLatest = i === 0;
                const bq       = blockQuestions(t);
                const qTotal   = t.questionCount ?? (bq ? bq.length : null);
                const doneCount = getDoneCount(t);
                const mood     = moodOf(t);
                const statCount = Object.keys(t.subjects || {}).length + Object.keys(t.systems || {}).length;

                return (
                  <div
                    key={t.id}
                    data-test-id={t.id}
                    className={`td-test-card${isLatest ? " td-test-latest" : ""}${savedId === t.id ? " fad-ch-flash" : ""}`}
                    {...cardPress}
                  >
                    <div className="td-test-top-row">
                      <div className="td-test-name">{t.testNum}</div>
                      <div className="td-test-tools">
                        <button className="td-edit-btn" onClick={() => setEditing(draftFrom(t))} title="Edit">✎</button>
                        <button
                          className="td-del-btn"
                          onClick={() => handleDelete(t.id)}
                          title={confirmDelId === t.id ? "Tap again to delete" : "Remove"}
                          aria-label={confirmDelId === t.id ? "Tap again to delete this test" : "Remove test"}
                          style={confirmDelId === t.id ? { color: "var(--bad)", background: "var(--bad-soft)", fontWeight: 700 } : undefined}
                        >
                          {confirmDelId === t.id ? "Sure?" : "✕"}
                        </button>
                      </div>
                    </div>
                    <div className="td-test-date">
                      {fmt(t.date)}
                      {mood && <span className="td-test-mood" title={`Felt: ${mood.label}`}>{mood.emoji}</span>}
                      {statCount > 0 && <span className="td-test-statflag" title={`${statCount} topics scored`}>▦ stats</span>}
                    </div>
                    <div className="td-test-badges">
                      {sc != null ? <ScoreBadge score={sc} /> : <span className="muted small">no score</span>}
                      {t.uworldAvg != null && (
                        <span className="td-uw-badge">{t.uworldAvg}% UWorld</span>
                      )}
                      <GapBadge gap={gap} />
                    </div>
                    {t.feeling?.note && <div className="td-test-note">“{t.feeling.note}”</div>}

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

                    {bq && bq.length > 0 && onStudy && (
                      <button className="td-review-btn" onClick={() => onStudy(deckFileOf(t), blockOf(t))}>
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
              <p className="td-empty-msg">No tests logged yet</p>
              <p className="muted small">Click "+ Log test" above to record your first sitting — result, stats &amp; how you felt.</p>
              <button className="td-submit-btn" style={{ marginTop: 12 }} onClick={() => setEditing(emptyEntry())}>+ Log your first test</button>
            </div>
          )}
        </div>

        {/* RIGHT: dashboard */}
        <div className="td-col-dash">
          {stats ? (
            <>
              {/* UWorld Qbank completion */}
              <div
                className="td-qbank"
                title={isEstimate ? `Includes estimated counts (${DEFAULT_BLOCK} Qs assumed) for ${estimatedCount} test${estimatedCount === 1 ? "" : "s"} logged without a question count` : undefined}
              >
                <div className="td-qbank-head">
                  <span className="td-qbank-title">UWorld Qbank progress</span>
                  <span className="td-qbank-count">
                    {isEstimate && "~"}{totalQs.toLocaleString()} / {QBANK_TOTAL.toLocaleString()} Qs
                  </span>
                </div>
                <div className="td-qbank-bar">
                  <div className="td-qbank-fill" style={{ width: `${Math.max(qbankPct, 1)}%` }} />
                </div>
                <span className="td-qbank-sub">
                  {isEstimate && "~"}{qbankPct}% of the Qbank · {isEstimate && "~"}{(QBANK_TOTAL - totalQs).toLocaleString()} left
                </span>
              </div>

              <div className="td-stats-row">
                <div className="td-stat-card">
                  <span className="td-stat-label">Avg score</span>
                  <span className="td-stat-num">{stats.avg}%</span>
                </div>
                <div className="td-stat-card">
                  <span className="td-stat-label">Personal best</span>
                  <span className="td-stat-num td-best">{stats.best}%</span>
                </div>
                <div className="td-stat-card">
                  <span className="td-stat-label">Latest</span>
                  <span className="td-stat-num">
                    {stats.latest}%
                    {hasTrend && (
                      <span className={`td-trend ${trendFlat ? "" : trendUp ? "td-trend-up" : "td-trend-dn"}`}>
                        {trendFlat ? "→" : trendUp ? `▲ ${stats.trend}` : `▼ ${Math.abs(stats.trend)}`}
                      </span>
                    )}
                  </span>
                </div>
                {stats.net != null && (
                  <div className="td-stat-card">
                    <span className="td-stat-label">Trend since first</span>
                    <span className={`td-stat-num ${stats.net > 0 ? "td-gap-pos-num" : stats.net < 0 ? "td-gap-neg-num" : ""}`}>
                      {stats.net !== 0 && <span className="td-stat-arrow">{stats.net > 0 ? "▲" : "▼"}</span>}
                      {stats.net > 0 ? "+" : stats.net < 0 ? "−" : ""}{stats.net === 0 ? "0" : Math.abs(stats.net)}%
                    </span>
                  </div>
                )}
                {stats.avgGap != null && (
                  <div className="td-stat-card">
                    <span className="td-stat-label">Avg gap vs UWorld</span>
                    <span className={`td-stat-num ${stats.avgGap >= 0 ? "td-gap-pos-num" : "td-gap-neg-num"}`}>
                      {stats.avgGap >= 0 ? "+" : ""}{stats.avgGap}%
                    </span>
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
