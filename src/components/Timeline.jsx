import { useState, useMemo, useRef, useEffect } from "react";
import {
  PHASES, GOALS, FRONT_COLORS, FRONT_LABELS, TYPE_ICONS,
  loadTimelineEvents, saveTimelineEvents, loadAimsTasks,
  loadGoalsDone, saveGoalsDone,
} from "../lib/timelineData.js";
import { buildGCalLink } from "../lib/calendarExport.js";

// ── Layout constants ───────────────────────────────────────────────────────
const TL_START  = new Date("2026-06-10T00:00:00Z");
const TL_END    = new Date("2026-10-12T00:00:00Z");
const TOTAL_DAYS = Math.round((TL_END - TL_START) / 86400000);
const DAY_PX     = 9;
const PADD       = 24;          // left/right padding px
const TOTAL_W    = TOTAL_DAYS * DAY_PX + PADD * 2;

// Y positions
const BAND_H     = 50;          // phase bands
const AXIS_H     = 22;          // month labels
const ABOVE_H    = 82;          // card space above spine
const SPINE_Y    = BAND_H + AXIS_H + ABOVE_H;   // = 154
const BELOW_H    = 80;          // card space below spine
const TOTAL_H    = SPINE_Y + 2 + BELOW_H + 10;  // = 246

const MONTHS = [
  { str: "2026-06-10", label: "Jun" },
  { str: "2026-07-01", label: "Jul" },
  { str: "2026-08-01", label: "Aug" },
  { str: "2026-09-01", label: "Sep" },
  { str: "2026-10-01", label: "Oct" },
];

function dateToX(dateStr) {
  if (!dateStr) return -1;
  const d = new Date(dateStr + "T12:00:00Z");
  const days = Math.max(0, Math.round((d.getTime() - TL_START.getTime()) / 86400000));
  return Math.min(days * DAY_PX + PADD, TOTAL_W - PADD);
}

function fmtDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function currentPhase(today) {
  const t = today.toISOString().slice(0, 10);
  return PHASES.find(p => t >= p.start && t <= p.end) || null;
}

// ── Filter config ─────────────────────────────────────────────────────────
const ALL_FRONTS = Object.keys(FRONT_LABELS);
const ALL_TYPES  = ["deadline","event","landmark","task-deadline","aims","blocker"];

// ── Derive AIMS-sourced nodes ─────────────────────────────────────────────
function aimsNodes(tasks) {
  return tasks
    .filter(t => t.addToTimeline && t.deadline && t.status === "Active")
    .map(t => ({
      id:       `aims-derived-${t.id}`,
      _aimsId:  t.id,
      title:    t.title,
      date:     t.deadline,
      tz:       t.tz,
      type:     "aims",
      front:    "aims",
      note:     t.notes,
      people:   t.people || [],
      reminders: t.reminders || [],
      source:   "aims",
    }));
}

// Assign above/below row to avoid cards overlapping.
function assignRows(events) {
  let lastAboveX = -999;
  let lastBelowX = -999;
  const GAP = 122;
  return events.map(ev => {
    if (!ev.date) return { ...ev, row: null, x: -1 };
    const x = dateToX(ev.date);
    let row;
    if (x - lastAboveX >= GAP) {
      row = "above"; lastAboveX = x;
    } else if (x - lastBelowX >= GAP) {
      row = "below"; lastBelowX = x;
    } else {
      // Both conflict — put below, accept slight overlap
      row = "below"; lastBelowX = x;
    }
    return { ...ev, row, x };
  });
}

// ── Detail drawer ─────────────────────────────────────────────────────────
function EventDrawer({ event, onClose }) {
  if (!event) return null;
  const color = FRONT_COLORS[event.front] || "#94a3b8";
  const gcal  = buildGCalLink(event);
  return (
    <div className="ev-drawer-overlay" onClick={onClose}>
      <div className="ev-drawer" onClick={e => e.stopPropagation()} style={{ borderTopColor: color }}>
        <div className="ev-drawer-hd">
          <div>
            <span className="ev-drawer-type" style={{ color }}>{TYPE_ICONS[event.type] || "📌"} {event.type}</span>
            <h2 className="ev-drawer-title">{event.title}</h2>
            <div className="ev-drawer-date" style={{ color }}>{fmtDate(event.date)}{event.endDate ? ` – ${fmtDate(event.endDate)}` : ""}</div>
          </div>
          <button className="intake-close" onClick={onClose}>✕</button>
        </div>
        {event.note && <p className="ev-drawer-note">{event.note}</p>}
        {event.people?.length > 0 && (
          <div className="ev-drawer-people">
            <div className="ev-drawer-lbl">People</div>
            <div className="ev-people-chips">
              {event.people.map((p, i) => (
                <div key={i} className="ev-person-chip">
                  <span className="ev-person-name">{p.name}</span>
                  <span className="ev-person-role">{p.role}</span>
                  {p.contact && (
                    <a className="ev-person-contact" href={p.contact.includes("@") ? `mailto:${p.contact}` : undefined}
                       onClick={p.contact.includes("@") ? undefined : () => navigator.clipboard?.writeText(p.contact)}>
                      {p.contact.includes("@") ? "Email" : "Copy"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {event.reminders?.length > 0 && (
          <div className="ev-drawer-reminders">
            <div className="ev-drawer-lbl">Reminders</div>
            <div className="ev-rem-chips">
              {event.reminders.map((r, i) => <span key={i} className="ev-rem-chip">{r}</span>)}
            </div>
          </div>
        )}
        <div className="ev-drawer-btns">
          {gcal && (
            <a className="ev-gcal-btn" href={gcal} target="_blank" rel="noopener noreferrer">
              📅 Add to Google Calendar
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
        <span className="goals-title">October finish line</span>
        <span className="goals-sub muted small">{Object.values(done).filter(Boolean).length}/{GOALS.length} done</span>
      </div>
      <div className="goals-list">
        {GOALS.map(g => {
          const color = FRONT_COLORS[g.front] || "#94a3b8";
          return (
            <label key={g.id} className={`goal-item${done[g.id] ? " goal-done" : ""}`}>
              <input type="checkbox" checked={!!done[g.id]} onChange={() => onToggle(g.id)}
                style={{ accentColor: color }} />
              <span className="goal-dot" style={{ background: color }} />
              <span className="goal-label">{g.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Vertical list view (mobile / fallback) ────────────────────────────────
function VerticalList({ events, onSelect }) {
  const today = new Date().toISOString().slice(0, 10);
  const undated = events.filter(e => !e.date);
  const dated   = events.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
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
          <div className="tl-vmonth-label">{new Date(month + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          {evs.map(ev => {
            const color = FRONT_COLORS[ev.front] || "#94a3b8";
            const isToday = ev.date === today;
            return (
              <button key={ev.id} className={`tl-vitem${isToday ? " tl-vitem-today" : ""}`}
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
          <div className="tl-vmonth-label">No date yet</div>
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

  const [tlEvents, setTlEvents]   = useState(loadTimelineEvents);
  const [aimsTasks]               = useState(loadAimsTasks);
  const [goalsDone, setGoalsDone] = useState(loadGoalsDone);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeF, setActiveF] = useState(new Set(ALL_FRONTS));
  const [activeT, setActiveT] = useState(new Set([...ALL_TYPES, "blocker"]));

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayX - 240);
    }
  }, [todayX]);

  const allEvents = useMemo(() => {
    const nodes = aimsNodes(aimsTasks);
    return [...tlEvents, ...nodes].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  }, [tlEvents, aimsTasks]);

  const filtered = useMemo(() =>
    allEvents.filter(ev => activeF.has(ev.front) && activeT.has(ev.type)),
    [allEvents, activeF, activeT]
  );

  const assigned = useMemo(() => assignRows(filtered), [filtered]);

  function toggleGoal(id) {
    const next = { ...goalsDone, [id]: !goalsDone[id] };
    setGoalsDone(next); saveGoalsDone(next);
  }

  function toggleFront(f) {
    setActiveF(prev => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  function toggleType(t) {
    setActiveT(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  return (
    <div className="tl-page">
      {/* Header */}
      <div className="tl-header">
        <div>
          <h1 className="tl-title">Timeline</h1>
          <p className="muted tl-sub">Jun → Oct 2026 · your full arc at a glance</p>
        </div>
        {phase && (
          <div className="tl-phase-badge" style={{ background: phase.color + "18", color: phase.color, border: `1.5px solid ${phase.color}44` }}>
            NOW: {phase.name}
          </div>
        )}
      </div>

      {/* Filter: fronts */}
      <div className="tl-filters">
        <span className="tl-filter-lbl">Front</span>
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

      {/* Filter: types */}
      <div className="tl-filters tl-filters-types">
        <span className="tl-filter-lbl">Type</span>
        <div className="tl-filter-chips">
          {ALL_TYPES.map(t => (
            <button key={t} className={`tl-chip${activeT.has(t) ? " tl-chip-on tl-chip-type-on" : ""}`}
              onClick={() => toggleType(t)}>
              {TYPE_ICONS[t]} {t}
            </button>
          ))}
        </div>
      </div>

      {/* Jump to today */}
      <div className="tl-jump-row">
        <button className="tl-jump-btn" onClick={() => {
          if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 240);
        }}>
          ↩ Jump to today
        </button>
        <span className="muted small">{todayStr} · {filtered.length} events shown</span>
      </div>

      {/* ── Horizontal scroll track (desktop) ─────────────────────────── */}
      <div className="tl-scroll-wrap" ref={scrollRef}>
        <div className="tl-inner" style={{ width: TOTAL_W, height: TOTAL_H }}>

          {/* Phase bands */}
          {PHASES.map(ph => {
            const x1 = dateToX(ph.start);
            const x2 = dateToX(ph.end) + DAY_PX;
            const isNow = phase?.id === ph.id;
            return (
              <div key={ph.id} style={{
                position: "absolute", top: 0, left: x1, width: x2 - x1, height: BAND_H,
                background: ph.color + (isNow ? "30" : "18"),
                borderLeft: `2px solid ${ph.color}`,
                borderTop: isNow ? `3px solid ${ph.color}` : "none",
                overflow: "hidden",
              }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: ph.color, padding: "4px 5px", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isNow ? "▶ " : ""}{ph.name}
                </span>
                <span style={{ fontSize: 8, color: ph.color + "99", padding: "0 5px", display: "block" }}>
                  {ph.start.slice(5)} → {ph.end.slice(5)}
                </span>
              </div>
            );
          })}

          {/* Month grid lines + labels */}
          {MONTHS.map(({ str, label }) => {
            const x = dateToX(str);
            return (
              <g key={str}>
                <div style={{ position: "absolute", top: BAND_H, left: x, height: TOTAL_H - BAND_H, width: 1, background: "#e2e8f0", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: BAND_H + 4, left: x + 4, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{label}</div>
              </g>
            );
          })}

          {/* TODAY marker */}
          <div style={{ position: "absolute", top: 0, left: todayX, width: 2, height: TOTAL_H, background: "#ef4444", opacity: 0.85, zIndex: 20 }}>
            <div style={{ position: "absolute", top: BAND_H - 18, left: -12, fontSize: 9, fontWeight: 900, color: "#ef4444", background: "#fff", padding: "1px 4px", borderRadius: 4, border: "1.5px solid #ef4444", whiteSpace: "nowrap" }}>NOW</div>
          </div>

          {/* Spine */}
          <div style={{ position: "absolute", top: SPINE_Y, left: 0, width: TOTAL_W, height: 2, background: "#e2e8f0", zIndex: 5 }} />

          {/* Event nodes */}
          {assigned.map(ev => {
            if (!ev.date) return null;
            const color = FRONT_COLORS[ev.front] || "#94a3b8";
            const above = ev.row === "above";
            const cardTop = above ? SPINE_Y - ABOVE_H + 4 : SPINE_Y + 12;
            return (
              <div key={ev.id} style={{ position: "absolute", left: ev.x, top: 0, zIndex: 10 }}>
                {/* Dot on spine */}
                <button
                  className="tl-dot"
                  style={{
                    position: "absolute", top: SPINE_Y - 5, left: -5,
                    background: color, border: "2.5px solid white",
                    boxShadow: `0 0 0 1.5px ${color}`,
                  }}
                  onClick={() => setSelectedEvent(ev)}
                  title={ev.title}
                />

                {/* Card */}
                <button
                  className="tl-card"
                  style={{
                    position: "absolute",
                    top: cardTop,
                    left: -56,
                    borderColor: color + "55",
                    borderTopColor: color,
                  }}
                  onClick={() => setSelectedEvent(ev)}
                >
                  <span className="tl-card-icon">{TYPE_ICONS[ev.type] || "📌"}</span>
                  <span className="tl-card-title">{ev.title}</span>
                  <span className="tl-card-date" style={{ color }}>{ev.date.slice(5).replace("-", "/")}</span>
                </button>
              </div>
            );
          })}

          {/* Undated blocker nodes at the right edge */}
          {filtered.filter(ev => !ev.date).map((ev, i) => {
            const color = FRONT_COLORS[ev.front] || "#94a3b8";
            return (
              <button key={ev.id}
                className="tl-card tl-card-undated"
                style={{ position: "absolute", top: BAND_H + AXIS_H + 4 + i * 28, right: 4, borderColor: color, color }}
                onClick={() => setSelectedEvent(ev)}>
                🚧 {ev.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Vertical list (mobile / always visible) ──────────────────── */}
      <div className="tl-vlist-wrap">
        <VerticalList events={filtered} onSelect={setSelectedEvent} />
      </div>

      {/* Goals panel */}
      <GoalsPanel done={goalsDone} onToggle={toggleGoal} />

      {/* Event detail drawer */}
      {selectedEvent && (
        <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
