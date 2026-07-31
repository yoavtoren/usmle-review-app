import { useMemo } from "react";
import { localISODate } from "../lib/config.js";

/* ── Coverage-progress charts ───────────────────────────────────────────────
   Props:
     events   — [{ at: "YYYY-MM-DD", rank: number|null, topicId: string }]
                ONE event per topic (its first-time completion) — repeats are
                never fed in, so nothing here double-counts
     baseline — done topics that carry no usable date; added as a constant
                floor so the cumulative line matches the "Topics done" stat
     color    — accent color for the bars/area (the subject/area color)
     target   — how many topics the whole book holds;
                enables the finish-date projection on the cumulative chart
     deadline — "YYYY-MM-DD" hard date (exam day) the projection is compared to
   Renders two charts in one card:
     1. Daily — bars = topics first completed that day (left count axis),
        line = avg difficulty that day (right 1–5 axis, gold)
     2. Cumulative — area = topics done so far, dashed line = projection to
        `target` at the recent pace, with the projected date
   Renders nothing without data. */

const DAY = 86400000;
const RANK_COLOR = "#A26A12";
const GRID = "#F0ECE1";
const TICK = "#DDD6C4";
const MUTED = "#A39B88";
const INK = "#5C5546";
const EXAM_COLOR = "#9C3B2C";

// Local calendar day — callers hand us `at` values built with localISODate, so
// the axis has to bucket and label on the same boundary or the newest events
// land one column off after midnight in +TZ zones.
function isoDay(ms) { return localISODate(new Date(ms)); }
function labelFor(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
// Calendar-date offset (never fixed 24h steps — DST-safe).
function isoPlusDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localISODate(d);
}
function daysBetween(isoA, isoB) {
  return Math.round((new Date(isoB + "T00:00:00") - new Date(isoA + "T00:00:00")) / DAY);
}

function buildDays(events, baseline = 0) {
  if (!events.length) return null;
  // Anchor on LOCAL midnight and walk the window with calendar-date arithmetic
  // rather than fixed 24h steps — an Israel DST change would otherwise shift the
  // cursor by an hour and duplicate or skip a column.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const first = new Date(events.map(e => e.at).sort()[0] + "T00:00:00");
  const spanDays = Math.round((today - first) / DAY);
  const back = Math.min(119, Math.max(29, Number.isFinite(spanDays) ? spanDays : 29));

  const days = [];
  const idx = {};
  for (let i = back; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = isoDay(d.getTime());
    idx[date] = days.length;
    days.push({ date, count: 0, topics: new Set(), rankSum: 0, rankN: 0 });
  }
  for (const e of events) {
    const i = idx[e.at];
    if (i === undefined) continue;
    const d = days[i];
    d.count++;
    d.topics.add(e.topicId);
    if (e.rank != null) { d.rankSum += e.rank; d.rankN++; }
  }

  // Cumulative pass. The window is capped at 120 days — topics completed
  // before it starts pre-seed the set so the running total never loses them;
  // `baseline` covers done topics with no date at all.
  const seen = new Set();
  for (const e of events) if (idx[e.at] === undefined && e.at < days[0].date) seen.add(e.topicId);
  for (const d of days) {
    d.dailyAvg = d.rankN ? d.rankSum / d.rankN : null;
    d.topics.forEach(t => seen.add(t));
    d.cumTopics = baseline + seen.size;
  }
  return days;
}

/* ── Shared axis helpers (also used by the FA dashboard's daily chart) ───── */

export function niceStep(max) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) if (max / s <= 4) return s;
  return Math.ceil(max / 4);
}
export function niceMax(max) {
  const s = niceStep(max);
  return Math.max(s, Math.ceil(max / s) * s);
}
export function countTicks(yMax) {
  const s = niceStep(yMax);
  const out = [];
  for (let v = s; v <= yMax; v += s) out.push(v);
  return out;
}

// Which day indices get an x-label — every day when it fits, and the month name
// only where the month changes so daily labels stay short.
export function dayLabels(isoList, maxLabels) {
  const n = isoList.length;
  const every = Math.max(1, Math.ceil(n / maxLabels));
  const out = [];
  let lastMonth = null;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const take = i % every === 0 || (isLast && (n - 1) % every >= every / 2);
    if (!take) continue;
    const d = new Date(isoList[i] + "T00:00:00");
    const label = d.getMonth() !== lastMonth
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : String(d.getDate());
    lastMonth = d.getMonth();
    out.push({ i, label });
  }
  return out;
}

// Rounded data-end (top), square at the baseline.
export function barPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

// Baseline + a tick per day + rotated day labels.
export function XAxis({ isoList, x0, slotW, bottom, maxLabels }) {
  const labels = dayLabels(isoList, maxLabels);
  return (
    <>
      <line x1={x0} x2={x0 + slotW * isoList.length} y1={bottom} y2={bottom} stroke={GRID} strokeWidth="1" />
      {isoList.map((iso, i) => (
        <line key={iso} x1={x0 + i * slotW + slotW / 2} x2={x0 + i * slotW + slotW / 2}
          y1={bottom} y2={bottom + 2.5} stroke={TICK} strokeWidth="1" />
      ))}
      {labels.map(({ i, label }) => {
        const x = x0 + i * slotW + slotW / 2;
        const y = bottom + 9;
        return (
          <text key={i} x={x} y={y} transform={`rotate(-45 ${x} ${y})`}
            textAnchor="end" fontSize="6.5" fill={MUTED}>{label}</text>
        );
      })}
    </>
  );
}

// Hairline gridlines + clean-number labels for the count axis.
export function YAxis({ yMax, y, x0, x1 }) {
  return countTicks(yMax).map(v => (
    <g key={v}>
      <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
      <text x={x0 - 3} y={y(v) + 2} textAnchor="end" fontSize="6.5" fill={MUTED}>{v}</text>
    </g>
  ));
}

/* ── Chart geometry (shared so the two charts align in the card) ─────────── */

const W = 580, H = 128, PT = 9, PB = 30, PL = 22, PR = 14;
const plotH = H - PT - PB;
const bottom = PT + plotH;
const rankY = r => PT + (1 - (r - 1) / 4) * plotH;

function rankLinePath(days, valueKey, slotW, x0) {
  const pts = days
    .map((d, i) => (d[valueKey] != null ? `${x0 + i * slotW + slotW / 2},${rankY(d[valueKey])}` : null))
    .filter(Boolean);
  return pts.length ? "M" + pts.join(" L") : "";
}

function DailyChart({ days, color }) {
  const n = days.length;
  const slotW = (W - PL - PR) / n;
  const barW = Math.max(2, Math.min(18, slotW - 2));
  const yMax = niceMax(Math.max(...days.map(d => d.count), 1));
  const yOf = v => bottom - (v / yMax) * plotH;
  const isoList = days.map(d => d.date);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg">
      <YAxis yMax={yMax} y={yOf} x0={PL} x1={W - PR} />
      <XAxis isoList={isoList} x0={PL} slotW={slotW} bottom={bottom} maxLabels={Math.min(n, 26)} />
      {/* rank axis (right, gold) — labels only, so it never fights the count grid */}
      {[1, 3, 5].map(r => (
        <text key={r} x={W - 2} y={rankY(r) + 2} textAnchor="end" fontSize="6.5" fill={RANK_COLOR}>{r}</text>
      ))}
      {days.map((d, i) => {
        if (!d.count) return null;
        const h = Math.max(2, (d.count / yMax) * plotH);
        const x = PL + i * slotW + (slotW - barW) / 2;
        return (
          <path key={d.date} d={barPath(x, bottom - h, barW, h, 2)} fill={color} fillOpacity="0.78">
            <title>{`${labelFor(d.date)} — ${d.count} new topic${d.count !== 1 ? "s" : ""}${d.dailyAvg != null ? ` · avg difficulty ${d.dailyAvg.toFixed(1)}` : ""}`}</title>
          </path>
        );
      })}
      <path d={rankLinePath(days, "dailyAvg", slotW, PL)} fill="none" stroke={RANK_COLOR}
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {days.map((d, i) => d.dailyAvg != null && (
        <circle key={d.date} cx={PL + i * slotW + slotW / 2} cy={rankY(d.dailyAvg)} r="2.4"
          fill={RANK_COLOR} stroke="var(--surface)" strokeWidth="1.2">
          <title>{`${labelFor(d.date)} — avg rank ${d.dailyAvg.toFixed(1)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function CumulativeChart({ days, color, target, deadline }) {
  const n = days.length;
  const maxCum = days[n - 1].cumTopics;
  const goal = Math.max(target || 0, maxCum);
  const remaining = goal - maxCum;

  // Pace = distinct new topics reviewed per day over the last two weeks.
  const look = Math.min(14, n - 1);
  const gained = look > 0 ? maxCum - days[n - 1 - look].cumTopics : 0;
  const pace = look > 0 ? gained / look : 0;
  const daysLeft = remaining > 0 && pace > 0 ? Math.ceil(remaining / pace) : null;

  // Show the projection inline: extend the x-domain into the future, capped so
  // history never shrinks below ~60% of the plot.
  const future = daysLeft != null ? Math.min(daysLeft, Math.max(10, Math.round(n * 0.6)), 60) : 0;
  const total = n + future;
  const slotW = (W - PL - PR) / total;
  // Scale to what is actually visible in the window, not the full goal — a
  // whole-book target far beyond the plotted horizon would squash the history
  // into a flat line at the bottom.
  const visMax = daysLeft != null && daysLeft <= future ? goal
    : daysLeft != null ? maxCum + pace * future
    : maxCum;
  const yMax = niceMax(Math.max(visMax, 1));
  const yOf = v => bottom - (v / yMax) * plotH;
  const cx = i => PL + i * slotW + slotW / 2;

  const todayIso = days[n - 1].date;
  const isoList = days.map(d => d.date);
  for (let i = 1; i <= future; i++) isoList.push(isoPlusDays(todayIso, i));

  const areaPts = days.map((d, i) => `${cx(i)},${yOf(d.cumTopics)}`);
  const areaPath = `M${cx(0)},${bottom} L` + areaPts.join(" L") + ` L${cx(n - 1)},${bottom} Z`;

  const finishIso = daysLeft != null ? isoPlusDays(todayIso, daysLeft) : null;
  // A projection can land years out — show the year whenever it isn't this one.
  const finishLabel = finishIso
    ? new Date(finishIso + "T00:00:00").toLocaleDateString("en-US",
        new Date(finishIso + "T00:00:00").getFullYear() === new Date().getFullYear()
          ? { month: "short", day: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" })
    : null;
  const reached = daysLeft != null && daysLeft <= future;
  const projEnd = daysLeft == null ? null : reached
    ? { x: cx(n - 1 + daysLeft), y: yOf(goal) }
    : { x: cx(total - 1), y: yOf(maxCum + pace * future) };

  let deadlineNote = "";
  if (deadline && finishIso) {
    const diff = daysBetween(finishIso, deadline);
    deadlineNote = diff >= 0 ? ` · ${diff}d before exam` : ` · ${-diff}d AFTER exam`;
  }
  const annot = daysLeft != null
    ? `~${pace.toFixed(1)}/day → all ${goal} by ${finishLabel}${deadlineNote}`
    : remaining <= 0
      ? `all ${goal} topics covered ✓`
      : "no new topics in the last 2 weeks — no pace to project";

  const examIdx = deadline ? daysBetween(days[0].date, deadline) : -1;
  const showExam = examIdx > 0 && examIdx <= total - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg">
      <YAxis yMax={yMax} y={yOf} x0={PL} x1={W - PR} />
      <XAxis isoList={isoList} x0={PL} slotW={slotW} bottom={bottom} maxLabels={Math.min(total, 26)} />

      {/* target line (dashed = threshold, not grid) — only when it fits the scale */}
      {goal > maxCum && goal <= yMax && (
        <>
          <line x1={PL} x2={W - PR} y1={yOf(goal)} y2={yOf(goal)} stroke="#C4BCA6" strokeWidth="1" strokeDasharray="4 3" />
          <text x={W - PR - 2} y={yOf(goal) - 3} textAnchor="end" fontSize="6.5" fill={MUTED}>target {goal}</text>
        </>
      )}

      {/* history */}
      <path d={areaPath} fill={color} fillOpacity="0.11" />
      <path d={"M" + areaPts.join(" L")} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* today divider between history and projection */}
      {future > 0 && (
        <>
          <line x1={PL + n * slotW} x2={PL + n * slotW} y1={PT + 4} y2={bottom} stroke={TICK} strokeWidth="1" />
          <text x={PL + n * slotW} y={bottom - 3} textAnchor="middle" fontSize="6" fill={MUTED}>today</text>
        </>
      )}

      {/* projection at current pace */}
      {projEnd && (
        <path d={`M${cx(n - 1)},${yOf(maxCum)} L${projEnd.x},${projEnd.y}`} fill="none"
          stroke={color} strokeWidth="1.8" strokeDasharray="5 4" strokeOpacity="0.75" />
      )}
      {projEnd && reached && (
        <>
          <circle cx={projEnd.x} cy={projEnd.y} r="2.6" fill="var(--surface)" stroke={color} strokeWidth="1.6" />
          <text x={Math.min(projEnd.x, W - PR - 16)} y={projEnd.y - 5} textAnchor="middle"
            fontSize="7" fontWeight="700" fill={INK}>{finishLabel}</text>
        </>
      )}
      {projEnd && !reached && (
        <text x={W - PR - 2} y={projEnd.y - 5} textAnchor="end" fontSize="6.8" fontWeight="700" fill={INK}>
          → {finishLabel}
        </text>
      )}

      {/* exam day, when it falls inside the window */}
      {showExam && (
        <>
          <line x1={cx(examIdx)} x2={cx(examIdx)} y1={PT + 4} y2={bottom}
            stroke={EXAM_COLOR} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.6" />
          <text x={cx(examIdx)} y={PT + 6} textAnchor="middle" fontSize="6" fontWeight="700"
            fill={EXAM_COLOR}>exam</text>
        </>
      )}

      {/* current position: end dot + direct label */}
      <circle cx={cx(n - 1)} cy={yOf(maxCum)} r="2.6" fill={color} stroke="var(--surface)" strokeWidth="1.2">
        <title>{`${labelFor(todayIso)} — ${maxCum} topics done`}</title>
      </circle>
      <text x={cx(n - 1)} y={yOf(maxCum) - 5} textAnchor="middle" fontSize="7" fontWeight="700" fill={INK}>{maxCum}</text>

      {/* pace / finish annotation */}
      <text x={PL + 3} y={PT + 7} fontSize="6.8" fontWeight="600" fill={INK}>{annot}</text>
    </svg>
  );
}

export default function ReviewCharts({ events, baseline = 0, color = "#1E4D38", target = 0, deadline = null }) {
  const days = useMemo(() => buildDays(events || [], baseline), [events, baseline]);
  if (!days) return null;
  const topicsDone = days[days.length - 1].cumTopics;

  return (
    <div className="rc-card">
      <div className="rc-head">
        <span className="rc-title">📈 Coverage progress</span>
        <span className="rc-legend">
          <span className="rc-leg"><span className="rc-swatch" style={{ background: color }} /> new topics</span>
          <span className="rc-leg"><span className="rc-swatch" style={{ background: RANK_COLOR }} /> avg difficulty</span>
          <span className="rc-sub">{topicsDone} topics done · repeats excluded</span>
        </span>
      </div>
      <div className="rc-grid">
        <div className="rc-chart">
          <div className="rc-chart-lbl">New topics per day</div>
          <DailyChart days={days} color={color} />
        </div>
        <div className="rc-chart">
          <div className="rc-chart-lbl">Cumulative topics done</div>
          <CumulativeChart days={days} color={color} target={target} deadline={deadline} />
        </div>
      </div>
    </div>
  );
}
