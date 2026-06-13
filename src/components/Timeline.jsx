import { useState, useMemo, useRef, useEffect } from "react";
import {
  PHASES, GOALS, FRONT_COLORS, FRONT_LABELS, TYPE_ICONS, TYPE_LABELS,
  loadTimelineEvents, loadGoalsDone, saveGoalsDone, loadEventsDone, saveEventsDone,
} from "../lib/timelineData.js";
import { loadAllWorkstreamTasks } from "../lib/workstreamData.js";
import { buildGCalLink } from "../lib/calendarExport.js";

// ── Layout constants ───────────────────────────────────────────────────────
const TL_START   = new Date("2026-06-10T00:00:00Z");
const TL_END     = new Date("2026-10-12T00:00:00Z");
const TOTAL_DAYS = Math.round((TL_END - TL_START) / 86400000);
const DAY_PX     = 16;
const PADD       = 20;
const TRACK_W    = TOTAL_DAYS * DAY_PX + PADD * 2;
const LABEL_W    = 206;
const TOTAL_W    = LABEL_W + TRACK_W;
const BAND_H     = 38;
const AXIS_H     = 28;
const ROW_H      = 34;
const DOT_R      = 5;

const MONTHS = [
  { str: "2026-06-10", label: "יוני" },
  { str: "2026-07-01", label: "יולי" },
  { str: "2026-08-01", label: "אוג'" },
  { str: "2026-09-01", label: "ספט'" },
  { str: "2026-10-01", label: "אוק'" },
];

// Week ticks — every 7 days from TL_START
const WEEK_TICKS = (() => {
  const ticks = [];
  for (let d = 0; d < TOTAL_DAYS; d += 7) {
    const date = new Date(TL_START.getTime() + d * 86400000);
    ticks.push({ x: d * DAY_PX + PADD, label: `${date.getDate()}/${date.getMonth() + 1}` });
  }
  return ticks;
})();

function dateToX(dateStr) {
  if (!dateStr) return -1;
  const days = Math.max(0, Math.round((new Date(dateStr + "T12:00:00Z") - TL_START) / 86400000));
  return Math.min(days * DAY_PX + PADD, TRACK_W - PADD);
}

function fmtDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
function fmtShort(dateStr) {
  if (!dateStr) return "TBD";
  return dateStr.slice(5).replace("-", "/");
}

function currentPhase(today) {
  const t = today.toISOString().slice(0, 10);
  return PHASES.find(p => t >= p.start && t <= p.end) || null;
}

const ALL_FRONTS = Object.keys(FRONT_LABELS);
const ALL_TYPES  = ["deadline", "event", "landmark", "task-deadline", "aims", "blocker"];

function workstreamNodes(tasks) {
  return tasks
    .filter(t => t.addToTimeline && t.deadline && t.status === "Active" && !t.recurring)
    .map(t => ({
      id: `ws-derived-${t.id}`, _wsId: t.id,
      title: t.title, date: t.deadline, tz: t.tz,
      type: "aims", front: t.category || "aims",
      note: t.notes, people: t.people || [], reminders: t.reminders || [],
      source: t.category || "aims",
    }));
}

// ── Event drawer ─────────────────────────────────────────────────────────
function EventDrawer({ event, onClose, done, onToggleDone }) {
  if (!event) return null;
  const color = FRONT_COLORS[event.front] || "#94a3b8";
  const gcal  = buildGCalLink(event);
  return (
    <div className="ev-drawer-overlay" onClick={onClose}>
      <div className={`ev-drawer${done ? " ev-drawer-done" : ""}`} onClick={e => e.stopPropagation()} style={{ "--ev-c": color }}>
        <div className="ev-drawer-band">
          <div className="ev-drawer-band-inner">
            <div className="ev-drawer-type-row">
              <span className="ev-drawer-type-icon">{TYPE_ICONS[event.type] || "📌"}</span>
              <span className="ev-drawer-type-lbl">{TYPE_LABELS[event.type] || event.type}</span>
            </div>
            <h2 className="ev-drawer-title">{event.title}</h2>
            <div className="ev-drawer-date">
              {fmtDate(event.date)}{event.endDate ? ` – ${fmtDate(event.endDate)}` : ""}
            </div>
          </div>
          <button className="ev-close-btn" onClick={onClose}>✕</button>
        </div>
        {event.note && <p className="ev-drawer-note">{event.note}</p>}
        {event.people?.length > 0 && (
          <div className="ev-drawer-people">
            <div className="ev-drawer-lbl">אנשים</div>
            <div className="ev-people-chips">
              {event.people.map((p, i) => (
                <div key={i} className="ev-person-chip">
                  <span className="ev-person-name">{p.name}</span>
                  <span className="ev-person-role">{p.role}</span>
                  {p.contact && (
                    <a className="ev-person-contact"
                      href={p.contact.includes("@") ? `mailto:${p.contact}` : undefined}
                      onClick={p.contact.includes("@") ? undefined : () => navigator.clipboard?.writeText(p.contact)}>
                      {p.contact.includes("@") ? "אימייל" : "העתק"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {event.reminders?.length > 0 && (
          <div className="ev-drawer-reminders">
            <div className="ev-drawer-lbl">תזכורות</div>
            <div className="ev-rem-chips">
              {event.reminders.map((r, i) => <span key={i} className="ev-rem-chip">{r}</span>)}
            </div>
          </div>
        )}
        <div className="ev-drawer-btns">
          <button className={`ev-done-btn${done ? " ev-done-btn-on" : ""}`} onClick={onToggleDone}>
            {done ? "✓ הושלם" : "סמן כהושלם"}
          </button>
          {gcal && (
            <a className="ev-gcal-btn" href={gcal} target="_blank" rel="noopener noreferrer">
              📅 הוסף ליומן Google
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Goals panel ───────────────────────────────────────────────────────────
function GoalsPanel({ done, onToggle }) {
  return (
    <div className="goals-panel">
      <div className="goals-hd">
        <span className="goals-title">קו הסיום — אוקטובר</span>
        <span className="goals-sub muted small">{Object.values(done).filter(Boolean).length}/{GOALS.length} הושלמו</span>
      </div>
      <div className="goals-list">
        {GOALS.map(g => {
          const color = FRONT_COLORS[g.front] || "#94a3b8";
          return (
            <label key={g.id} className={`goal-item${done[g.id] ? " goal-done" : ""}`}>
              <input type="checkbox" checked={!!done[g.id]} onChange={() => onToggle(g.id)} style={{ accentColor: color }} />
              <span className="goal-dot" style={{ background: color }} />
              <span className="goal-label">{g.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Vertical list (mobile) ────────────────────────────────────────────────
function VerticalList({ events, onSelect }) {
  const today = new Date().toISOString().slice(0, 10);
  const dated   = events.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const undated = events.filter(e => !e.date);
  const grouped = {};
  dated.forEach(ev => {
    const m = ev.date.slice(0, 7);
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(ev);
  });
  return (
    <div className="tl-vlist">
      {Object.entries(grouped).map(([month, evs]) => (
        <div key={month} className="tl-vmonth">
          <div className="tl-vmonth-label">
            {new Date(month + "-15T12:00:00Z").toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
          </div>
          {evs.map(ev => {
            const color = FRONT_COLORS[ev.front] || "#94a3b8";
            return (
              <button key={ev.id} className={`tl-vitem${ev.date === today ? " tl-vitem-today" : ""}`}
                style={{ borderLeftColor: color }} onClick={() => onSelect(ev)}>
                <span className="tl-vitem-icon">{TYPE_ICONS[ev.type] || "📌"}</span>
                <span className="tl-vitem-body">
                  <span className="tl-vitem-title">{ev.title}</span>
                  <span className="tl-vitem-meta" style={{ color }}>{fmtDate(ev.date)}</span>
                </span>
                <span className="tl-vitem-front" style={{ background: color + "22", color }}>
                  {FRONT_LABELS[ev.front] || ev.front}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {undated.length > 0 && (
        <div className="tl-vmonth">
          <div className="tl-vmonth-label">ללא תאריך</div>
          {undated.map(ev => {
            const color = FRONT_COLORS[ev.front] || "#94a3b8";
            return (
              <button key={ev.id} className="tl-vitem" style={{ borderLeftColor: color }} onClick={() => onSelect(ev)}>
                <span className="tl-vitem-icon">{TYPE_ICONS[ev.type] || "📌"}</span>
                <span className="tl-vitem-body">
                  <span className="tl-vitem-title">{ev.title}</span>
                  <span className="tl-vitem-meta muted">TBD</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Timeline page ────────────────────────────────────────────────────
export default function Timeline() {
  const scrollRef = useRef(null);
  const today     = useMemo(() => new Date(), []);
  const todayStr  = today.toISOString().slice(0, 10);
  const todayX    = dateToX(todayStr);
  const phase     = currentPhase(today);

  const [tlEvents]       = useState(loadTimelineEvents);
  const [wsTasksAll]     = useState(loadAllWorkstreamTasks);
  const [goalsDone, setGoalsDone]     = useState(loadGoalsDone);
  const [eventsDone, setEventsDone]   = useState(loadEventsDone);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeF, setActiveF] = useState(new Set(ALL_FRONTS));
  const [activeT, setActiveT] = useState(new Set(ALL_TYPES));
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [sortMode, setSortMode] = useState("date"); // "date" | "topic"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayX - 360);
    }
  }, [todayX]);

  const allEvents = useMemo(() => {
    const nodes = workstreamNodes(wsTasksAll);
    return [...tlEvents, ...nodes].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  }, [tlEvents, wsTasksAll]);

  const filtered = useMemo(() =>
    allEvents.filter(ev => activeF.has(ev.front) && activeT.has(ev.type)),
    [allEvents, activeF, activeT]
  );

  const dated   = filtered.filter(ev => ev.date);
  const undated = filtered.filter(ev => !ev.date);

  // Grouped rows for topic sort mode
  const groupedRows = useMemo(() => {
    if (sortMode !== "topic") return null;
    const groups = {};
    for (const ev of dated) {
      const k = ev.front || "other";
      if (!groups[k]) groups[k] = [];
      groups[k].push(ev);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      (FRONT_LABELS[a] || a).localeCompare(FRONT_LABELS[b] || b, "he")
    );
  }, [dated, sortMode]);

  function toggleGoal(id) {
    const next = { ...goalsDone, [id]: !goalsDone[id] };
    setGoalsDone(next); saveGoalsDone(next);
  }
  function toggleEventDone(id) {
    const next = { ...eventsDone, [id]: !eventsDone[id] };
    setEventsDone(next); saveEventsDone(next);
  }
  function toggleFront(f) {
    setActiveF(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });
  }
  function toggleType(t) {
    setActiveT(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }

  const topicGroupCount = groupedRows ? groupedRows.length : 0;
  const totalHeight = BAND_H + AXIS_H + (dated.length + topicGroupCount + (undated.length ? undated.length + 1 : 0)) * ROW_H;

  return (
    <div className="tl-page">
      {/* Header */}
      <div className="tl-header">
        <div>
          <h1 className="tl-title">ציר זמן</h1>
          <p className="muted tl-sub">יוני → אוקטובר 2026 · כל הנתיב שלך במבט אחד</p>
        </div>
        {phase && (
          <div className="tl-phase-badge" style={{ background: phase.color + "18", color: phase.color, border: `1.5px solid ${phase.color}44` }}>
            עכשיו: {phase.name}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="tl-filters">
        <span className="tl-filter-lbl">נושא</span>
        <div className="tl-filter-chips">
          {ALL_FRONTS.map(f => (
            <button key={f} className={`tl-chip${activeF.has(f) ? " tl-chip-on" : ""}`}
              style={activeF.has(f) ? { background: FRONT_COLORS[f] + "22", color: FRONT_COLORS[f], borderColor: FRONT_COLORS[f] + "66" } : {}}
              onClick={() => toggleFront(f)}>
              {FRONT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="tl-filters tl-filters-types">
        <button className="tl-type-toggle" onClick={() => setShowTypeFilter(s => !s)}>
          <span className="tl-filter-lbl">סוג</span>
          <span className={`tl-type-caret${showTypeFilter ? " open" : ""}`}>›</span>
          {!showTypeFilter && (
            <span className="tl-type-summary">
              {activeT.size === ALL_TYPES.length ? "הכל" : `${activeT.size}/${ALL_TYPES.length}`}
            </span>
          )}
        </button>
        {showTypeFilter && (
          <div className="tl-filter-chips">
            {ALL_TYPES.map(t => (
              <button key={t} className={`tl-chip${activeT.has(t) ? " tl-chip-on tl-chip-type-on" : ""}`}
                onClick={() => toggleType(t)}>
                {TYPE_ICONS[t]} {TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Jump to today + sort toggle */}
      <div className="tl-jump-row">
        <button className="tl-jump-btn" onClick={() => {
          if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 360);
        }}>↩ קפוץ להיום</button>
        <div className="tl-sort-tabs">
          <button
            className={`tl-sort-tab${sortMode === "date" ? " active" : ""}`}
            onClick={() => setSortMode("date")}
          >📅 תאריך</button>
          <button
            className={`tl-sort-tab${sortMode === "topic" ? " active" : ""}`}
            onClick={() => setSortMode("topic")}
          >🏷 נושא</button>
        </div>
        <span className="muted small">{todayStr} · {filtered.length} אירועים</span>
      </div>

      {/* ── Gantt track (desktop) ──────────────────────────────────────── */}
      <div className="tl-rows-wrap" ref={scrollRef}>
        <div style={{ width: TOTAL_W, height: totalHeight, position: "relative" }}>

          {/* Week grid lines — span full height */}
          {WEEK_TICKS.map((wk, i) => (
            <div key={i} style={{
              position: "absolute", left: LABEL_W + wk.x,
              top: 0, bottom: 0, width: 1,
              background: "rgba(0,0,0,0.04)", pointerEvents: "none",
            }} />
          ))}

          {/* Vertical month grid lines — span full height (stronger) */}
          {MONTHS.map(({ str }) => (
            <div key={str} style={{
              position: "absolute", left: LABEL_W + dateToX(str),
              top: 0, bottom: 0, width: 1,
              background: "rgba(0,0,0,0.09)", pointerEvents: "none",
            }} />
          ))}

          {/* Today vertical line — span full height */}
          <div style={{
            position: "absolute", left: LABEL_W + todayX,
            top: 0, bottom: 0, width: 2,
            background: "rgba(239,68,68,0.7)",
            pointerEvents: "none", zIndex: 8,
          }} />

          {/* Phase bands row */}
          <div style={{ display: "flex", height: BAND_H, borderBottom: "1.5px solid var(--line)" }}>
            <div style={{
              position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 20,
              background: "var(--surface-2)", borderRight: "1.5px solid var(--line)",
              display: "flex", alignItems: "center", padding: "0 12px",
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)" }}>אירוע</span>
            </div>
            <div style={{ position: "relative", width: TRACK_W, height: BAND_H }}>
              {PHASES.map(ph => {
                const x1 = dateToX(ph.start);
                const x2 = dateToX(ph.end) + DAY_PX;
                const isNow = phase?.id === ph.id;
                return (
                  <div key={ph.id} style={{
                    position: "absolute", left: x1, width: x2 - x1, top: 0, height: BAND_H,
                    background: ph.color + (isNow ? "2a" : "16"),
                    borderLeft: `2px solid ${ph.color}88`,
                    borderTop: isNow ? `2px solid ${ph.color}` : "none",
                    overflow: "hidden",
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: ph.color, padding: "3px 5px", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {isNow ? "▶ " : ""}{ph.name}
                    </span>
                    <span style={{ fontSize: 8, color: ph.color + "99", padding: "0 5px", display: "block" }}>
                      {ph.start.slice(5)} → {ph.end.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month axis row */}
          <div style={{ display: "flex", height: AXIS_H, borderBottom: "1.5px solid var(--line)", background: "var(--surface)" }}>
            <div style={{
              position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 20,
              background: "var(--surface)", borderRight: "1.5px solid var(--line)",
              display: "flex", alignItems: "center", padding: "0 12px",
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8" }}>{todayStr}</span>
            </div>
            <div style={{ position: "relative", width: TRACK_W, height: AXIS_H }}>
              {/* Week ticks */}
              {WEEK_TICKS.map((wk, i) => (
                <div key={i} style={{ position: "absolute", left: wk.x, top: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{ width: 1, height: 5, background: "rgba(0,0,0,0.15)", marginTop: 2 }} />
                  <div style={{ fontSize: 8, color: "#b0b8c8", fontWeight: 600, whiteSpace: "nowrap", marginTop: 1, marginLeft: 2 }}>
                    {wk.label}
                  </div>
                </div>
              ))}
              {/* Month labels — larger, on top */}
              {MONTHS.map(({ str, label }) => (
                <div key={str} style={{ position: "absolute", left: dateToX(str) + 4, top: 2, fontSize: 12, fontWeight: 800, color: "#64748b", zIndex: 2 }}>{label}</div>
              ))}
              <div style={{
                position: "absolute", left: todayX - 14, top: 3,
                fontSize: 9, fontWeight: 900, color: "#ef4444",
                background: "#fff", padding: "1px 4px", borderRadius: 4, border: "1.5px solid #ef4444",
                zIndex: 10, whiteSpace: "nowrap",
              }}>עכשיו</div>
            </div>
          </div>

          {/* One row per dated event (or grouped by topic) */}
          {(sortMode === "topic" && groupedRows ? groupedRows.flatMap(([front, evs]) => {
            const groupColor = FRONT_COLORS[front] || "#94a3b8";
            const header = (
              <div key={`hdr-${front}`} style={{
                display: "flex", height: ROW_H,
                borderBottom: "1px solid var(--line)",
                background: groupColor + "14",
              }}>
                <div style={{
                  position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10,
                  background: groupColor + "14",
                  borderRight: "1.5px solid var(--line)",
                  display: "flex", alignItems: "center", gap: 8, padding: "0 10px",
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: groupColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: groupColor, letterSpacing: 0.1, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {FRONT_LABELS[front] || front}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: groupColor + "99", flexShrink: 0 }}>{evs.length}</span>
                </div>
                <div style={{ width: TRACK_W }} />
              </div>
            );
            const rows = evs.map((ev, i) => {
              const color  = FRONT_COLORS[ev.front] || "#94a3b8";
              const x      = dateToX(ev.date);
              const odd    = i % 2 === 1;
              const isDone = !!eventsDone[ev.id];
              const bg     = isDone ? "rgba(22,163,74,0.04)" : odd ? "var(--surface-2)" : "var(--surface)";
              return (
                <div key={ev.id}
                  style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", cursor: "pointer", background: bg, opacity: isDone ? 0.7 : 1 }}
                  onClick={() => setSelectedEvent(ev)}
                  className="tl-ev-row">
                  <div style={{
                    position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10,
                    background: bg, borderRight: "1.5px solid var(--line)",
                    display: "flex", alignItems: "center", gap: 0,
                  }}>
                    <div style={{ width: 10, alignSelf: "stretch", background: isDone ? "#16a34a" : color, flexShrink: 0 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 6px", overflow: "hidden" }}>
                      <span style={{ fontSize: 11, flexShrink: 0 }}>{TYPE_ICONS[ev.type] || "📌"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "var(--muted)" : "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isDone ? "line-through" : "none" }}>{ev.title}</span>
                      {isDone
                        ? <span style={{ fontSize: 9, fontWeight: 900, color: "#16a34a", flexShrink: 0 }}>✓</span>
                        : <span style={{ fontSize: 9, fontWeight: 800, color, flexShrink: 0 }}>{fmtShort(ev.date)}</span>
                      }
                    </div>
                  </div>
                  <div style={{ position: "relative", width: TRACK_W, flexShrink: 0, height: ROW_H }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1, background: "rgba(0,0,0,0.05)", transform: "translateY(-0.5px)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", left: x - DOT_R, top: "50%", transform: "translateY(-50%)", width: DOT_R * 2, height: DOT_R * 2, borderRadius: "50%", background: isDone ? "#16a34a" : color, border: "2.5px solid white", boxShadow: `0 0 0 1.5px ${isDone ? "#16a34a" : color}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
                      {isDone && <span style={{ color: "white", fontSize: 6, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                  </div>
                </div>
              );
            });
            return [header, ...rows];
          }) : dated).map((node, i) => {
            if (node.type !== undefined || node.key?.startsWith("hdr-")) return node;
            const ev     = node;
            const color  = FRONT_COLORS[ev.front] || "#94a3b8";
            const x      = dateToX(ev.date);
            const odd    = i % 2 === 1;
            const isDone = !!eventsDone[ev.id];
            const bg     = isDone ? "rgba(22,163,74,0.04)" : odd ? "var(--surface-2)" : "var(--surface)";

            return (
              <div key={ev.id}
                style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", cursor: "pointer", background: bg, opacity: isDone ? 0.7 : 1 }}
                onClick={() => setSelectedEvent(ev)}
                className="tl-ev-row">

                {/* Sticky label with colored topic box */}
                <div style={{
                  position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10,
                  background: bg, borderRight: "1.5px solid var(--line)",
                  display: "flex", alignItems: "center", gap: 0,
                }}>
                  {/* Colored topic strip */}
                  <div style={{ width: 10, alignSelf: "stretch", background: isDone ? "#16a34a" : color, flexShrink: 0 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 6px", overflow: "hidden" }}>
                    <span style={{ fontSize: 11, flexShrink: 0 }}>{TYPE_ICONS[ev.type] || "📌"}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "var(--muted)" : "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3, textDecoration: isDone ? "line-through" : "none" }}>{ev.title}</span>
                    {isDone
                      ? <span style={{ fontSize: 9, fontWeight: 900, color: "#16a34a", flexShrink: 0 }}>✓</span>
                      : <span style={{ fontSize: 9, fontWeight: 800, color, flexShrink: 0 }}>{fmtShort(ev.date)}</span>
                    }
                  </div>
                </div>

                {/* Track */}
                <div style={{ position: "relative", width: TRACK_W, flexShrink: 0, height: ROW_H }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1, background: odd ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.05)", transform: "translateY(-0.5px)", pointerEvents: "none" }} />
                  <div style={{
                    position: "absolute",
                    left: x - DOT_R, top: "50%", transform: "translateY(-50%)",
                    width: DOT_R * 2, height: DOT_R * 2, borderRadius: "50%",
                    background: isDone ? "#16a34a" : color, border: "2.5px solid white",
                    boxShadow: `0 0 0 1.5px ${isDone ? "#16a34a" : color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 5,
                  }}>
                    {isDone && <span style={{ color: "white", fontSize: 6, fontWeight: 900, lineHeight: 1, marginTop: 0.5 }}>✓</span>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Undated events section */}
          {undated.length > 0 && (
            <>
              <div style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", background: "var(--surface-3)" }}>
                <div style={{
                  position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10,
                  background: "var(--surface-3)", borderRight: "1.5px solid var(--line)",
                  display: "flex", alignItems: "center", padding: "0 12px",
                }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)" }}>ללא תאריך</span>
                </div>
                <div style={{ width: TRACK_W }} />
              </div>
              {undated.map((ev, i) => {
                const color = FRONT_COLORS[ev.front] || "#94a3b8";
                const odd   = i % 2 === 0;
                const bg    = odd ? "var(--surface-2)" : "var(--surface)";
                return (
                  <div key={ev.id}
                    style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", cursor: "pointer", background: bg }}
                    onClick={() => setSelectedEvent(ev)}
                    className="tl-ev-row">
                    <div style={{
                      position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10,
                      background: bg, borderRight: "1.5px solid var(--line)",
                      display: "flex", alignItems: "center", gap: 0,
                    }}>
                      <div style={{ width: 10, alignSelf: "stretch", background: color + "55", flexShrink: 0 }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 6px", overflow: "hidden" }}>
                        <span style={{ fontSize: 11, flexShrink: 0 }}>{TYPE_ICONS[ev.type] || "📌"}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", flexShrink: 0 }}>TBD</span>
                      </div>
                    </div>
                    <div style={{ position: "relative", width: TRACK_W, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: color + "88" }}>🚧 no date</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Vertical list (mobile) */}
      <div className="tl-vlist-wrap">
        <VerticalList events={filtered} onSelect={setSelectedEvent} />
      </div>

      {/* Goals panel */}
      <GoalsPanel done={goalsDone} onToggle={toggleGoal} />

      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          done={!!eventsDone[selectedEvent.id]}
          onToggleDone={() => toggleEventDone(selectedEvent.id)}
        />
      )}
    </div>
  );
}
