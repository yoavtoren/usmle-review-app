import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadTestLog, saveTestLog, loadProgress, testScore, deleteTest } from "../lib/storage.js";
import TestEntryForm, { emptyEntry, MOODS } from "./TestEntryForm.jsx";
import { useLongPress } from "../lib/longPress.js";
import { impact, notification } from "../lib/haptics.js";
import { QBANK_TOTAL, EXAM_DATE_ISO } from "../lib/config.js";

const BASE = import.meta.env.BASE_URL;
const DEFAULT_BLOCK = 40;   // standard UWorld block size when count not given
const DAY_MS = 86400000;
const PASS_SCORE = 60;      // UWorld % that correlates with a comfortable pass
const READY_SCORE = 65;     // walk-in-ready benchmark — safely above the pass line

const dateMs = iso => new Date(iso + "T12:00:00").getTime();
const shortDay = m => new Date(m).toLocaleDateString("en-US", { month: "short", day: "numeric" });

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
  return block === "test1" ? q.block === undefined : q.block === `UWORLD test ${block.slice(4)}`;
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

// Score history extended forward to exam day: regression trend projected to its
// 60% crossing, the "needed pace" line to walk in ready, and a hover tooltip.
function LineChart({ tests, traj }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  if (!tests || tests.length === 0) return null;

  const W = 660, H = 300;
  const PAD = { top: 30, right: 40, bottom: 30, left: 40 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const sorted = [...tests].sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastMs = dateMs(sorted.at(-1).date);
  const minMs = dateMs(sorted[0].date);
  const examMs = traj ? traj.examMs : lastMs;
  const maxMs = Math.max(examMs, lastMs) + 3 * DAY_MS;
  const span = maxMs - minMs || DAY_MS;

  const vals = sorted.flatMap(t => [t.score, ...(t.uworldAvg != null ? [t.uworldAvg] : [])]);
  const lo = Math.min(20, Math.floor((Math.min(...vals) - 4) / 10) * 10);
  // Cap the top just above the ready benchmark so the lines use the vertical
  // space instead of huddling in the middle of a 20–80 band.
  const hi = Math.max(READY_SCORE + 5, Math.ceil((Math.max(...vals) + 4) / 10) * 10);

  const toX = m => PAD.left + ((m - minMs) / span) * CW;
  const toY = v => PAD.top + CH - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * CH;

  const scorePts = sorted.map(t => [toX(dateMs(t.date)), toY(t.score), t]);
  const uwPts = sorted.filter(t => t.uworldAvg != null).map(t => [toX(dateMs(t.date)), toY(t.uworldAvg)]);
  const linePath = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // First-of-month ticks along the extended timeline
  const ticks = (() => {
    const out = [];
    const d = new Date(minMs);
    d.setDate(1);
    if (d.getTime() < minMs) d.setMonth(d.getMonth() + 1);
    while (d.getTime() <= maxMs) { out.push(d.getTime()); d.setMonth(d.getMonth() + 1); }
    return out;
  })();

  const todayMs = Date.now();
  const examX = traj ? toX(traj.examMs) : null;
  const trendSeg = traj && {
    x1: toX(minMs), y1: toY(traj.valAtMs(minMs)),
    x2: toX(maxMs), y2: toY(traj.valAtMs(maxMs)),
  };
  const crossMs = traj?.cross60;
  const showCross = crossMs != null && crossMs > minMs + DAY_MS && crossMs < maxMs - DAY_MS;
  const showNeeded = traj && traj.lastScore < READY_SCORE && traj.examMs > lastMs;

  // Label first & last points; intermediates only when far enough apart in px.
  const LABEL_GAP = 64;
  const labeledIdx = (() => {
    const keep = new Set([0, scorePts.length - 1]);
    let prevX = scorePts[0][0];
    for (let i = 1; i < scorePts.length - 1; i++) {
      const [x] = scorePts[i];
      if (x - prevX > LABEL_GAP && scorePts.at(-1)[0] - x > LABEL_GAP) { keep.add(i); prevX = x; }
    }
    return keep;
  })();

  function handleMove(e) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = null, bd = 26;
    scorePts.forEach(([x], i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  const hoverT = hover != null ? sorted[hover] : null;
  const hoverGap = hoverT?.uworldAvg != null ? hoverT.score - hoverT.uworldAvg : null;

  return (
    <div className="td-chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", touchAction: "pan-y" }}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="tdPlot">
            <rect x={PAD.left} y={PAD.top - 8} width={CW + 14} height={CH + 8} />
          </clipPath>
        </defs>

        {/* grid */}
        {[20, 40, 60, 80].filter(v => v >= lo && v <= hi).map(y => (
          <g key={y}>
            <line x1={PAD.left} x2={W - PAD.right} y1={toY(y)} y2={toY(y)}
              stroke={y === PASS_SCORE ? "var(--warn-mid)" : "var(--line)"}
              strokeWidth={y === PASS_SCORE ? "1.5" : "1"}
              strokeDasharray={y === PASS_SCORE ? "4 3" : undefined} />
            <text x={PAD.left - 6} y={toY(y)} textAnchor="end" dominantBaseline="middle" fontSize="9.5" fill="var(--muted)">
              {y}%
            </text>
          </g>
        ))}
        <text x={(examX ?? W - PAD.right) - 6} y={toY(PASS_SCORE) + 12} textAnchor="end" fontSize="8.5" fill="var(--warn)" fontWeight="700">
          60% pass line
        </text>

        {/* exam day */}
        {examX != null && (
          <g>
            <line x1={examX} x2={examX} y1={PAD.top - 6} y2={PAD.top + CH} stroke="var(--line-hover)" strokeWidth="1.2" />
            <text x={examX - 5} y={PAD.top - 12} textAnchor="end" fontSize="9" fill="var(--text-2)" fontWeight="700">
              Exam · Oct 6
            </text>
          </g>
        )}

        {/* today */}
        {todayMs > minMs && todayMs < maxMs - DAY_MS && (
          <g>
            <line x1={toX(todayMs)} x2={toX(todayMs)} y1={PAD.top + 6} y2={PAD.top + CH}
              stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
            <text x={toX(todayMs)} y={PAD.top - 1} textAnchor="middle" fontSize="8.5" fill="var(--muted)">
              today
            </text>
          </g>
        )}

        {/* trend, projected through exam day */}
        {trendSeg && (
          <line clipPath="url(#tdPlot)"
            x1={trendSeg.x1.toFixed(1)} y1={trendSeg.y1.toFixed(1)}
            x2={trendSeg.x2.toFixed(1)} y2={trendSeg.y2.toFixed(1)}
            stroke="var(--muted)" opacity="0.55" strokeWidth="1.6" strokeDasharray="7 5" strokeLinecap="round" />
        )}

        {/* needed pace: latest result → ready on exam day */}
        {showNeeded && (
          <g>
            <line clipPath="url(#tdPlot)"
              x1={toX(lastMs)} y1={toY(traj.lastScore)} x2={toX(traj.examMs)} y2={toY(READY_SCORE)}
              stroke="var(--text-2)" strokeWidth="1.4" strokeDasharray="2 4" strokeLinecap="round" />
            <text x={toX(traj.examMs) - 5} y={toY(READY_SCORE) - 6} textAnchor="end" fontSize="8.5"
              fill="var(--text-2)" fontWeight="700">
              ready {READY_SCORE}%
            </text>
          </g>
        )}

        {/* series */}
        {uwPts.length >= 2 && (
          <path d={linePath(uwPts)} fill="none" stroke="var(--warn)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        )}
        {scorePts.length >= 2 && (
          <path d={linePath(scorePts)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* 60% crossing on the trend */}
        {showCross && (
          <g>
            <path
              d={`M${toX(crossMs).toFixed(1)},${(toY(PASS_SCORE) - 6).toFixed(1)} l6,6 l-6,6 l-6,-6 Z`}
              fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
            <text x={toX(crossMs)} y={toY(PASS_SCORE) - 13} textAnchor="middle" fontSize="9.5"
              fill="var(--accent-ink)" fontWeight="750">
              60% ≈ {shortDay(crossMs)}
            </text>
          </g>
        )}

        {/* hover crosshair */}
        {hover != null && (
          <line x1={scorePts[hover][0]} x2={scorePts[hover][0]} y1={PAD.top} y2={PAD.top + CH}
            stroke="var(--line-hover)" strokeWidth="1" />
        )}

        {uwPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.8" fill="var(--warn)" stroke="var(--surface)" strokeWidth="1.5" />
        ))}
        {scorePts.map(([x, y, t], i) => (
          <g key={i}>
            {hover === i && <circle cx={x} cy={y} r="9" fill="none" stroke="var(--accent-mid)" strokeWidth="2" />}
            <circle cx={x} cy={y} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5" />
            {labeledIdx.has(i) && hover !== i && (
              <text x={x} y={y - 11} textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="700">
                {t.score}%
              </text>
            )}
          </g>
        ))}

        {/* month ticks */}
        {ticks.map(m => (
          <g key={m}>
            <line x1={toX(m)} x2={toX(m)} y1={PAD.top + CH} y2={PAD.top + CH + 4} stroke="var(--line)" strokeWidth="1" />
            <text x={toX(m)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
              {new Date(m).toLocaleDateString("en-US", { month: "short" })}
            </text>
          </g>
        ))}
      </svg>

      {hoverT && (
        <div
          className={`td-tip${scorePts[hover][1] < 90 ? " td-tip-below" : ""}`}
          style={{ left: `${(scorePts[hover][0] / W) * 100}%`, top: `${(scorePts[hover][1] / H) * 100}%` }}
        >
          <div className="td-tip-date">{hoverT.testNum ? `${hoverT.testNum} · ` : ""}{shortDay(dateMs(hoverT.date))}</div>
          <div className="td-tip-row"><i className="td-tip-dot td-tip-dot-me" />You <b>{hoverT.score}%</b></div>
          {hoverT.uworldAvg != null && (
            <div className="td-tip-row"><i className="td-tip-dot td-tip-dot-uw" />UWorld <b>{hoverT.uworldAvg}%</b>
              {hoverGap != null && (
                <span className={hoverGap >= 0 ? "td-tip-gap-pos" : "td-tip-gap-neg"}>
                  {hoverGap >= 0 ? "+" : ""}{hoverGap}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const scoreBand = s => (s >= 60 ? "ok" : s >= 50 ? "mid" : "low");

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
      avgGap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
    };
  }, [sorted]);

  // Overall trajectory: least-squares regression over ALL results in date
  // space, so every logged test reshapes the slope and the 60% projection.
  const traj = useMemo(() => {
    if (sorted.length < 2) return null;
    const t0 = dateMs(sorted[0].date);
    const xs = sorted.map(t => (dateMs(t.date) - t0) / DAY_MS);
    const ys = sorted.map(t => t.score);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    if (!den) return null;   // all tests on the same day — no slope to fit
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den;
    const intercept = my - slope * mx;
    const valAtMs = m => slope * ((m - t0) / DAY_MS) + intercept;
    const last = sorted.at(-1);
    return {
      slope,
      slopeWeek: slope * 7,
      valAtMs,
      examMs: dateMs(EXAM_DATE_ISO),
      lastMs: dateMs(last.date),
      lastScore: last.score,
      cross60: slope > 0.005 ? t0 + ((PASS_SCORE - intercept) / slope) * DAY_MS : null,
    };
  }, [sorted]);

  // Human wording for the projected 60% crossing.
  const proj = useMemo(() => {
    if (!traj) return null;
    if (traj.cross60 == null) {
      return {
        tone: "bad", num: "—",
        sub: traj.slope < -0.005 ? "Trend is falling — it never crosses 60%" : "Trend is flat — no crossing in sight",
      };
    }
    if (traj.cross60 <= traj.lastMs) {
      return { tone: "ok", num: "Now", sub: "Your trend line is already above 60%" };
    }
    const margin = Math.round((traj.examMs - traj.cross60) / DAY_MS);
    return margin >= 0
      ? { tone: "ok", num: `≈ ${shortDay(traj.cross60)}`, sub: `${margin} days of margin before the exam` }
      : { tone: "bad", num: `≈ ${shortDay(traj.cross60)}`, sub: `${-margin} days after exam day — pace up` };
  }, [traj]);

  // Landmarks on the road to Oct 6: the score needed at each checkpoint to
  // reach READY_SCORE on exam day (linear pace from the latest result), next
  // to where the current trend actually puts you on that date.
  const roadmap = useMemo(() => {
    if (!traj) return null;
    const span = traj.examMs - traj.lastMs;
    if (span <= 0) return null;
    const marks = [
      ["2026-08-15", "Aug 15"], ["2026-09-01", "Sep 1"], ["2026-09-15", "Sep 15"],
      ["2026-10-01", "Oct 1"], [EXAM_DATE_ISO, "Oct 6", true],
    ];
    return marks
      .map(([iso, label, exam]) => {
        const m = dateMs(iso);
        if (m <= traj.lastMs) return null;
        const needed = Math.round(traj.lastScore + (READY_SCORE - traj.lastScore) * ((m - traj.lastMs) / span));
        const onTrend = Math.round(traj.valAtMs(m));
        const d = onTrend - needed;
        return { label, exam: !!exam, needed, onTrend, diff: d, status: d >= 0 ? "ok" : d >= -3 ? "close" : "behind" };
      })
      .filter(Boolean);
  }, [traj]);

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
    setTests(deleteTest(id));   // snapshots first — recoverable from /account
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
                      <div className="td-test-id">
                        <div className="td-test-name">{t.testNum}</div>
                        <div className="td-test-date">
                          {fmt(t.date)}
                          {t.uworldAvg != null && <span className="td-test-uw"> · UWorld {t.uworldAvg}%</span>}
                          {statCount > 0 && <span className="td-test-topics" title={`${statCount} topics scored`}> · {statCount} topics</span>}
                          {mood && <span className="td-test-mood" title={`Felt: ${mood.label}`}>{mood.emoji}</span>}
                        </div>
                      </div>
                      <div className={`td-test-tools${confirmDelId === t.id ? " td-tools-armed" : ""}`}>
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
                      <div className="td-test-result">
                        {sc != null
                          ? <span className={`td-test-score td-sc-${scoreBand(sc)}`}>{sc}%</span>
                          : <span className="muted small">no score</span>}
                        {gap != null && (
                          <span className={`td-test-gap ${gap >= 0 ? "pos" : "neg"}`}>
                            {gap >= 0 ? "+" : "−"}{Math.abs(gap)} vs UW
                          </span>
                        )}
                      </div>
                    </div>

                    {t.feeling?.note && <div className="td-test-note">“{t.feeling.note}”</div>}

                    {(qTotal != null || (bq && bq.length > 0 && onStudy)) && (
                      <div className="td-test-foot">
                        {qTotal != null && (
                          <>
                            <div className="td-done-bar-wrap">
                              <div
                                className="td-done-bar-fill"
                                style={{ width: `${Math.round((doneCount / qTotal) * 100)}%` }}
                              />
                            </div>
                            <span className="td-done-label">{doneCount} / {qTotal}</span>
                          </>
                        )}
                        {bq && bq.length > 0 && onStudy && (
                          <button className="td-review-btn" onClick={() => onStudy(deckFileOf(t), blockOf(t))}>
                            Review questions →
                          </button>
                        )}
                      </div>
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
              {/* Trajectory summary: trend + 60% crossing over a hairline-divided stat row */}
              <div className="td-summary">
                {traj && proj && (
                  <div className="td-hero">
                    <div className="td-hero-cell">
                      <span className="td-stat-label">Overall trend</span>
                      <span className={`td-hero-num ${traj.slopeWeek > 0.05 ? "td-up" : traj.slopeWeek < -0.05 ? "td-dn" : ""}`}>
                        {traj.slopeWeek > 0.05 ? "▲ " : traj.slopeWeek < -0.05 ? "▼ " : "→ "}
                        {traj.slopeWeek >= 0 ? "+" : ""}{traj.slopeWeek.toFixed(1)}%<span className="td-hero-unit">/wk</span>
                      </span>
                      <span className="td-hero-sub">all {sorted.length} tests shape this line</span>
                    </div>
                    <div className="td-hero-div" />
                    <div className="td-hero-cell">
                      <span className="td-stat-label">Crossing 60%</span>
                      <span className={`td-hero-num ${proj.tone === "ok" ? "td-up" : "td-dn"}`}>{proj.num}</span>
                      <span className="td-hero-sub">{proj.sub}</span>
                    </div>
                  </div>
                )}

                <div className="td-strip">
                  <div className="td-strip-cell">
                    <span className="td-strip-label">Latest</span>
                    <span className="td-strip-num">
                      {stats.latest}%
                      {hasTrend && (
                        <span className={`td-trend ${trendFlat ? "" : trendUp ? "td-trend-up" : "td-trend-dn"}`}>
                          {trendFlat ? "→" : trendUp ? `▲ ${stats.trend}` : `▼ ${Math.abs(stats.trend)}`}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="td-strip-cell">
                    <span className="td-strip-label">Average</span>
                    <span className="td-strip-num">{stats.avg}%</span>
                  </div>
                  <div className="td-strip-cell">
                    <span className="td-strip-label">Best</span>
                    <span className="td-strip-num td-best">{stats.best}%</span>
                  </div>
                  {stats.avgGap != null && (
                    <div className="td-strip-cell">
                      <span className="td-strip-label">vs UWorld</span>
                      <span className={`td-strip-num ${stats.avgGap >= 0 ? "td-gap-pos-num" : "td-gap-neg-num"}`}>
                        {stats.avgGap >= 0 ? "+" : ""}{stats.avgGap}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Forward-looking chart */}
              <div className="td-chart-card">
                <div className="td-chart-head">
                  <span className="td-chart-title">Score → exam day</span>
                  <div className="td-legend">
                    <span className="td-legend-item">
                      <span className="td-legend-line td-legend-score-line" /> My score
                    </span>
                    <span className="td-legend-item">
                      <span className="td-legend-line td-legend-uw-line" /> UWorld avg
                    </span>
                    <span className="td-legend-item td-legend-trend">
                      <span className="td-legend-dash td-legend-trend-dash" /> Trend
                    </span>
                    <span className="td-legend-item">
                      <span className="td-legend-dash td-legend-need-dash" /> Needed pace
                    </span>
                  </div>
                </div>
                <div className="td-chart-body">
                  <LineChart tests={sorted} traj={traj} />
                </div>
              </div>

              {/* Road to exam day: landmark scores */}
              {roadmap && roadmap.length > 0 && (
                <div className="td-road">
                  <div className="td-road-head">
                    <span className="td-chart-title">Road to exam day</span>
                    <span className="td-road-target">ready = {READY_SCORE}%</span>
                  </div>
                  <p className="td-road-sub">
                    Aim for = the pace to reach {READY_SCORE}% by Oct 6 · on trend = where today’s line puts you.
                  </p>
                  <div className="td-road-row td-road-headrow" aria-hidden="true">
                    <span />
                    <span>Aim for</span>
                    <span>On trend</span>
                  </div>
                  {roadmap.map(r => (
                    <div key={r.label} className={`td-road-row${r.exam ? " td-road-examrow" : ""}`}>
                      <span className="td-road-date">{r.exam ? "Oct 6 · Exam" : r.label}</span>
                      <span className="td-road-need">{r.needed}%</span>
                      <span className={`td-road-trendv td-road-${r.status}`}>
                        <i className="td-road-dot" />
                        {r.onTrend}%
                        <em className="td-road-diff">{r.diff >= 0 ? "+" : ""}{r.diff}</em>
                      </span>
                    </div>
                  ))}
                  <p className="td-road-foot">Pass line {PASS_SCORE}% · recalculated after every logged test</p>
                </div>
              )}

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
