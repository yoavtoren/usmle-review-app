import { useMemo } from "react";
import { localISODate } from "../lib/config.js";

/* ── Shared review-progress charts ──────────────────────────────────────────
   Props:
     events  — [{ at: "YYYY-MM-DD", rank: number|null, topicId: string }]
     color   — accent color for the bars/area (the subject/area color)
   Renders two charts in one card:
     1. Daily reviews   — bars = topics reviewed that day, line = avg rank that day
     2. Cumulative      — area = cumulative distinct topics reviewed, line = running avg rank
   The rank line is on a fixed 1–5 right axis. Renders nothing without data. */

const DAY = 86400000;
const RANK_COLOR = "#A26A12";

// Local calendar day — callers hand us `at` values built with localISODate, so
// the axis has to bucket and label on the same boundary or the newest events
// land one column off after midnight in +TZ zones.
function isoDay(ms) { return localISODate(new Date(ms)); }
function labelFor(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildDays(events) {
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

  // Cumulative pass
  const seen = new Set();
  let runSum = 0, runN = 0;
  for (const d of days) {
    d.dailyAvg = d.rankN ? d.rankSum / d.rankN : null;
    d.topics.forEach(t => seen.add(t));
    runSum += d.rankSum; runN += d.rankN;
    d.cumTopics = seen.size;
    d.cumAvg = runN ? runSum / runN : null;
  }
  return days;
}

const W = 580, H = 120, PT = 10, PB = 18;
const chartH = H - PT - PB;
const rankY = r => PT + (1 - (r - 1) / 4) * chartH;

function Axis({ n, slotW, days }) {
  const ticks = days.map((d, i) => ({ d, i })).filter(({ i }) => i % Math.ceil(n / 6) === 0 || i === n - 1);
  return (
    <>
      {/* rank guide ticks (right) */}
      {[1, 3, 5].map(r => (
        <g key={r}>
          <line x1="0" x2={W} y1={rankY(r)} y2={rankY(r)} stroke="#F0ECE1" strokeWidth="1" />
          <text x={W - 1} y={rankY(r) - 2} textAnchor="end" fontSize="7" fill={RANK_COLOR}>{r}</text>
        </g>
      ))}
      {ticks.map(({ d, i }) => (
        <text key={i} x={i * slotW + slotW / 2} y={H - 5} textAnchor="middle" fontSize="7.5" fill="#A39B88">
          {labelFor(d.date)}
        </text>
      ))}
    </>
  );
}

function rankLinePath(days, valueKey, slotW) {
  const pts = days.map((d, i) => (d[valueKey] != null ? `${i * slotW + slotW / 2},${rankY(d[valueKey])}` : null)).filter(Boolean);
  return pts.length ? "M" + pts.join(" L") : "";
}

function DailyChart({ days, color }) {
  const n = days.length;
  const slotW = W / n;
  const barW = Math.max(2, Math.min(18, slotW - 2));
  const maxCount = Math.max(...days.map(d => d.count), 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg" preserveAspectRatio="none">
      <Axis n={n} slotW={slotW} days={days} />
      {days.map((d, i) => {
        if (!d.count) return null;
        const barH = Math.max(2, (d.count / maxCount) * chartH);
        const x = i * slotW + (slotW - barW) / 2;
        return <rect key={d.date} x={x} y={PT + chartH - barH} width={barW} height={barH} rx="1.5"
          fill={color} fillOpacity="0.78"><title>{`${labelFor(d.date)}: ${d.count} review${d.count !== 1 ? "s" : ""}`}</title></rect>;
      })}
      <path d={rankLinePath(days, "dailyAvg", slotW)} fill="none" stroke={RANK_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {days.map((d, i) => d.dailyAvg != null && (
        <circle key={d.date} cx={i * slotW + slotW / 2} cy={rankY(d.dailyAvg)} r="2.2" fill={RANK_COLOR} />
      ))}
    </svg>
  );
}

function CumulativeChart({ days, color }) {
  const n = days.length;
  const slotW = W / n;
  const maxTopics = Math.max(...days.map(d => d.cumTopics), 1);
  const cumY = v => PT + (1 - v / maxTopics) * chartH;
  const cx = i => i * slotW + slotW / 2;
  const areaPts = days.map((d, i) => `${cx(i)},${cumY(d.cumTopics)}`);
  const areaPath = `M${cx(0)},${PT + chartH} L` + areaPts.join(" L") + ` L${cx(n - 1)},${PT + chartH} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg" preserveAspectRatio="none">
      <Axis n={n} slotW={slotW} days={days} />
      <path d={areaPath} fill={color} fillOpacity="0.13" />
      <path d={"M" + areaPts.join(" L")} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <text x="2" y={PT + 7} fontSize="7.5" fill={color} fontWeight="700">{maxTopics} topics</text>
      <path d={rankLinePath(days, "cumAvg", slotW)} fill="none" stroke={RANK_COLOR} strokeWidth="1.8" strokeDasharray="3 2" strokeLinejoin="round" />
    </svg>
  );
}

export default function ReviewCharts({ events, color = "#1E4D38" }) {
  const days = useMemo(() => buildDays(events || []), [events]);
  if (!days) return null;
  const totalReviews = events.length;
  const distinctTopics = days[days.length - 1].cumTopics;

  return (
    <div className="rc-card">
      <div className="rc-head">
        <span className="rc-title">📈 Review progress</span>
        <span className="rc-legend">
          <span className="rc-leg"><span className="rc-swatch" style={{ background: color }} /> topics</span>
          <span className="rc-leg"><span className="rc-swatch" style={{ background: RANK_COLOR }} /> avg rank</span>
          <span className="rc-sub">{totalReviews} reviews · {distinctTopics} topics</span>
        </span>
      </div>
      <div className="rc-grid">
        <div className="rc-chart">
          <div className="rc-chart-lbl">Reviews per day</div>
          <DailyChart days={days} color={color} />
        </div>
        <div className="rc-chart">
          <div className="rc-chart-lbl">Cumulative topics reviewed</div>
          <CumulativeChart days={days} color={color} />
        </div>
      </div>
    </div>
  );
}
