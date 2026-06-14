import { useState, useMemo, useRef, useEffect } from "react";
import {
  PHASES, GOALS, FRONT_COLORS, FRONT_LABELS, TYPE_ICONS, TYPE_LABELS, URGENCY_COLORS, URGENCY_LABELS,
  loadTimelineEvents, saveTimelineEvents,
  loadGoalsDone, saveGoalsDone, loadEventsDone, saveEventsDone,
} from "../lib/timelineData.js";
import { loadAllWorkstreamTasks, saveCategoryTasks } from "../lib/workstreamData.js";
import { loadGeneralTasks, saveGeneralTasks } from "../lib/storage.js";
import { buildGCalLink } from "../lib/calendarExport.js";

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

function xToDate(x) {
  const clamped = Math.max(PADD, Math.min(x, TRACK_W - PADD));
  const days    = Math.round((clamped - PADD) / DAY_PX);
  return new Date(TL_START.getTime() + days * 86400000).toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

// Tasks-page tasks opt-in to the timeline (addToTimeline + a date).
function generalTaskNodes(tasks) {
  return tasks
    .filter(t => t.addToTimeline && t.date && !t.done)
    .map(t => ({
      id: `gt-derived-${t.id}`, _gtId: t.id,
      title: t.title, date: t.date, tz: t.tz,
      type: t.kind === "event" ? "event" : "task-deadline",
      front: t.category || "personal",
      note: t.notes,
      people: t.contactName ? [{ name: t.contactName, contact: t.contactInfo || "" }] : [],
      reminders: [],
      source: "general",
    }));
}

// ── Add / Edit Event Modal ────────────────────────────────────────────────
const EMPTY_FORM = {
  title: "", date: "", type: "task-deadline", front: "step1",
  note: "", urgency: "Medium",
  contactName: "", contactEmail: "", emailNotifs: false, reminders: "",
};

function EventModal({ initial, defaultDate, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(initial || {}),
    date: initial?.date || defaultDate || "",
    contactName:  initial?.people?.[0]?.name    || "",
    contactEmail: initial?.people?.[0]?.contact || "",
    emailNotifs:  initial?.emailNotifs || false,
    reminders:    (initial?.reminders || []).join(", "),
  }));
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial;

  function save() {
    if (!form.title.trim() || !form.date) return;
    const remArr = form.reminders ? form.reminders.split(",").map(r => r.trim()).filter(Boolean) : [];
    onSave({
      ...(initial || { id: `ev-user-${Date.now()}`, source: "user" }),
      title: form.title.trim(), date: form.date, type: form.type, front: form.front,
      note: form.note, urgency: form.urgency, emailNotifs: form.emailNotifs, reminders: remArr,
      people: form.contactName.trim()
        ? [{ name: form.contactName.trim(), role: "", contact: form.contactEmail.trim() }]
        : (initial?.people || []),
    });
  }

  return (
    <div className="ev-modal-overlay" onClick={onClose}>
      <div className="ev-modal" onClick={e => e.stopPropagation()}>
        <div className="ev-modal-hd">
          <span>{isEdit ? "ערוך אירוע" : "הוסף אירוע חדש"}</span>
          <button className="ev-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="ev-modal-body">
          <div className="ev-modal-grid">
            <label className="ev-modal-lbl">כותרת *</label>
            <input className="ev-modal-inp" value={form.title} onChange={e => upd("title", e.target.value)} placeholder="שם האירוע" autoFocus />
            <label className="ev-modal-lbl">תאריך *</label>
            <input className="ev-modal-inp" type="date" value={form.date} onChange={e => upd("date", e.target.value)} />
            <label className="ev-modal-lbl">סוג</label>
            <select className="ev-modal-sel" value={form.type} onChange={e => upd("type", e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{TYPE_ICONS[k]} {v}</option>)}
            </select>
            <label className="ev-modal-lbl">נושא</label>
            <select className="ev-modal-sel" value={form.front} onChange={e => upd("front", e.target.value)}>
              {Object.entries(FRONT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="ev-modal-lbl">דחיפות</label>
            <select className="ev-modal-sel" value={form.urgency} onChange={e => upd("urgency", e.target.value)}>
              {Object.keys(URGENCY_COLORS).map(u => <option key={u} value={u}>{URGENCY_LABELS[u] || u}</option>)}
            </select>
            <label className="ev-modal-lbl">הערות</label>
            <textarea className="ev-modal-ta" rows={2} value={form.note} onChange={e => upd("note", e.target.value)} placeholder="הוסף הערות..." />
          </div>

          <div className="ev-modal-section-title">📞 איש קשר</div>
          <div className="ev-modal-grid">
            <label className="ev-modal-lbl">שם</label>
            <input className="ev-modal-inp" value={form.contactName} onChange={e => upd("contactName", e.target.value)} placeholder="שם מלא" />
            <label className="ev-modal-lbl">אימייל</label>
            <input className="ev-modal-inp" type="email" value={form.contactEmail} onChange={e => upd("contactEmail", e.target.value)} placeholder="email@example.com" />
          </div>

          <div className="ev-modal-section-title">🔔 תזכורות</div>
          <div className="ev-modal-grid">
            <label className="ev-modal-lbl">תזכורות</label>
            <input className="ev-modal-inp" value={form.reminders} onChange={e => upd("reminders", e.target.value)} placeholder="T-7d, T-1d, T-0@09:00" />
            <label className="ev-modal-lbl">אימייל</label>
            <label className="ev-modal-check">
              <input type="checkbox" checked={form.emailNotifs} onChange={e => upd("emailNotifs", e.target.checked)} />
              <span>שלח התראות לאימייל</span>
            </label>
          </div>
        </div>
        <div className="ev-modal-btns">
          <button className="ev-modal-cancel" onClick={onClose}>ביטול</button>
          <button className="ev-modal-save" onClick={save} disabled={!form.title.trim() || !form.date}>
            {isEdit ? "שמור שינויים" : "הוסף אירוע"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bottom event table ────────────────────────────────────────────────────
function EventTable({ events, eventsDone, onUpdate, onDelete, onToggleDone, onAdd }) {
  const [sortCol,   setSortCol] = useState("date");
  const [editModal, setEditModal] = useState(null); // event being edited

  const sorted = useMemo(() => [...events].sort((a, b) => {
    if (sortCol === "date")    return (a.date || "9999").localeCompare(b.date || "9999");
    if (sortCol === "front")   return (FRONT_LABELS[a.front] || "").localeCompare(FRONT_LABELS[b.front] || "", "he");
    if (sortCol === "urgency") {
      const ord = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (ord[a.urgency] ?? 4) - (ord[b.urgency] ?? 4);
    }
    return 0;
  }), [events, sortCol]);

  const Hd = ({ col, children }) => (
    <th className={`ev-th ev-th-sort${sortCol === col ? " ev-th-active" : ""}`} onClick={() => setSortCol(col)}>
      {children}{sortCol === col ? " ↑" : ""}
    </th>
  );

  return (
    <div className="ev-table-wrap">
      <div className="ev-table-hd">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ev-table-title">📋 ניהול אירועים</span>
          <span className="muted small">{events.length} אירועים</span>
        </div>
        <button className="ev-table-add-btn" onClick={onAdd}>+ הוסף אירוע</button>
      </div>
      <div className="ev-table-scroll">
        <table className="ev-table">
          <thead>
            <tr>
              <th className="ev-th ev-th-check">✓</th>
              <Hd col="date">תאריך</Hd>
              <th className="ev-th">כותרת</th>
              <Hd col="front">נושא</Hd>
              <th className="ev-th">סוג</th>
              <Hd col="urgency">דחיפות</Hd>
              <th className="ev-th">איש קשר</th>
              <th className="ev-th">אימייל</th>
              <th className="ev-th">תזכורות</th>
              <th className="ev-th ev-th-actions">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(ev => {
              const color   = FRONT_COLORS[ev.front] || "#94a3b8";
              const isDone  = !!eventsDone[ev.id];
              const urgColor = URGENCY_COLORS[ev.urgency] || null;
              return (
                <tr key={ev.id} className={`ev-tr${isDone ? " ev-tr-done" : ""}`}>
                  <td className="ev-td-check">
                    <input type="checkbox" checked={isDone} onChange={() => onToggleDone(ev.id)} className="ev-checkbox" />
                  </td>
                  <td className="ev-td-date">{fmtShort(ev.date)}</td>
                  <td className="ev-td-title">{ev.title}</td>
                  <td>
                    <span className="ev-td-front" style={{ background: color + "1a", color, borderColor: color + "44" }}>
                      {FRONT_LABELS[ev.front] || ev.front || "—"}
                    </span>
                  </td>
                  <td className="ev-td-type">{TYPE_ICONS[ev.type]} {TYPE_LABELS[ev.type] || ev.type}</td>
                  <td>
                    {urgColor
                      ? <span className="ev-td-urgency" style={{ color: urgColor }}>{URGENCY_LABELS[ev.urgency] || ev.urgency}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="ev-td-contact">
                    {ev.people?.[0]?.name
                      ? <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{ev.people[0].name}</div>
                          {ev.people[0].contact && <div style={{ fontSize: 10, color: "var(--muted)" }}>{ev.people[0].contact}</div>}
                        </div>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {ev.emailNotifs
                      ? <span className="ev-notif-on">✉ פעיל</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {ev.reminders?.length > 0
                      ? <span className="ev-rem-count">{ev.reminders.length} תז'</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="ev-td-acts">
                    <button className="ev-act-edit" onClick={() => setEditModal(ev)} title="ערוך">✏</button>
                    <button className="ev-act-del"  onClick={() => onDelete(ev.id)}  title="מחק">🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editModal && (
        <EventModal
          initial={editModal}
          onSave={ev => { onUpdate(ev.id, ev); setEditModal(null); }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
}

// ── Event Drawer ──────────────────────────────────────────────────────────
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
            <a className="ev-gcal-btn" href={gcal} target="_blank" rel="noopener noreferrer">📅 הוסף ליומן Google</a>
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
  const today   = new Date().toISOString().slice(0, 10);
  const dated   = events.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const undated = events.filter(e => !e.date);
  const grouped = {};
  dated.forEach(ev => { const m = ev.date.slice(0, 7); (grouped[m] = grouped[m] || []).push(ev); });
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
                <span className="tl-vitem-front" style={{ background: color + "22", color }}>{FRONT_LABELS[ev.front] || ev.front}</span>
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

// ── Main Timeline ─────────────────────────────────────────────────────────
export default function Timeline() {
  const scrollRef = useRef(null);
  const dragRef   = useRef(null);       // mutable drag state (avoids stale closures)
  const today     = useMemo(() => new Date(), []);
  const todayStr  = today.toISOString().slice(0, 10);
  const todayX    = dateToX(todayStr);
  const phase     = currentPhase(today);

  const [tlEvents, setTlEventsRaw] = useState(loadTimelineEvents);
  const [wsTasksAll, setWsTasksAll] = useState(loadAllWorkstreamTasks);
  const [genTasks, setGenTasks] = useState(loadGeneralTasks);
  const [goalsDone,   setGoalsDone]   = useState(loadGoalsDone);
  const [eventsDone,  setEventsDone]  = useState(loadEventsDone);
  const [selectedEv,  setSelectedEv]  = useState(null);
  const [activeF,     setActiveF]     = useState(new Set(ALL_FRONTS));
  const [activeT,     setActiveT]     = useState(new Set(ALL_TYPES));
  const [showTypes,   setShowTypes]   = useState(false);
  const [sortMode,    setSortMode]    = useState("date");
  const [dragState,   setDragState]   = useState(null);  // { evId, currentDate, mouseX, mouseY }
  const [hoveredId,   setHoveredId]   = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [addDate,     setAddDate]     = useState("");

  // Auto-save wrapper
  function setTlEvents(updater) {
    setTlEventsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveTimelineEvents(next);
      return next;
    });
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 360);
  }, [todayX]);

  // Pointer drag — attach once to window
  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const dx = (e.clientX - d.startClientX) + (scroll.scrollLeft - d.startScrollLeft);
      const newDate = xToDate(d.origX + dx);
      dragRef.current = { ...d, currentDate: newDate };
      setDragState({ evId: d.evId, currentDate: newDate, mouseX: e.clientX, mouseY: e.clientY });
    }
    function onUp(e) {
      if (!dragRef.current) return;
      const d = dragRef.current;
      dragRef.current = null;
      setDragState(null);
      if (d.currentDate && d.currentDate !== d.origDate) {
        if (d.wsId) {
          // Workstream-derived node → persist the underlying task's deadline
          setWsTasksAll(prev => {
            const next = prev.map(t => t.id === d.wsId ? { ...t, deadline: d.currentDate } : t);
            if (d.wsCategory) saveCategoryTasks(d.wsCategory, next.filter(t => t.category === d.wsCategory));
            return next;
          });
        } else if (d.gtId) {
          // Tasks-page derived node → persist the underlying task's date
          setGenTasks(prev => {
            const next = prev.map(t => String(t.id) === String(d.gtId) ? { ...t, date: d.currentDate } : t);
            saveGeneralTasks(next);
            return next;
          });
        } else {
          // Regular timeline event
          setTlEvents(prev => prev.map(ev => ev.id === d.evId ? { ...ev, date: d.currentDate } : ev));
        }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  function handleDotDown(e, ev) {
    e.stopPropagation(); e.preventDefault();
    const scroll = scrollRef.current;
    if (!scroll) return;
    dragRef.current = {
      evId: ev.id, origDate: ev.date, origX: dateToX(ev.date),
      startClientX: e.clientX, startScrollLeft: scroll.scrollLeft, currentDate: ev.date,
      wsId: ev._wsId || null, wsCategory: ev._wsId ? (ev.source || ev.front) : null,
      gtId: ev._gtId || null,
    };
    setDragState({ evId: ev.id, currentDate: ev.date, mouseX: e.clientX, mouseY: e.clientY });
  }

  const allEvents = useMemo(() => {
    const nodes = [...workstreamNodes(wsTasksAll), ...generalTaskNodes(genTasks)];
    return [...tlEvents, ...nodes].sort((a, b) => (!a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date)));
  }, [tlEvents, wsTasksAll, genTasks]);

  const filtered = useMemo(() => allEvents.filter(ev => activeF.has(ev.front) && activeT.has(ev.type)), [allEvents, activeF, activeT]);
  const dated    = filtered.filter(ev => ev.date);
  const undated  = filtered.filter(ev => !ev.date);

  const groupedRows = useMemo(() => {
    if (sortMode !== "topic") return null;
    const groups = {};
    for (const ev of dated) { const k = ev.front || "other"; (groups[k] = groups[k] || []).push(ev); }
    return Object.entries(groups).sort(([a], [b]) => (FRONT_LABELS[a] || a).localeCompare(FRONT_LABELS[b] || b, "he"));
  }, [dated, sortMode]);

  function toggleGoal(id)       { const n = { ...goalsDone,  [id]: !goalsDone[id]  }; setGoalsDone(n);  saveGoalsDone(n); }
  function toggleEventDone(id)  { const n = { ...eventsDone, [id]: !eventsDone[id] }; setEventsDone(n); saveEventsDone(n); }
  function toggleFront(f)       { setActiveF(p => { const n = new Set(p); n.has(f) ? n.delete(f) : n.add(f); return n; }); }
  function toggleType(t)        { setActiveT(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }); }
  function handleDelete(id) {
    if (id.startsWith("ws-derived-")) {
      const wsId = id.replace("ws-derived-", "");
      setWsTasksAll(prev => {
        const next = prev.filter(t => t.id !== wsId);
        // persist to the right category store
        const task = prev.find(t => t.id === wsId);
        if (task?.category) {
          const catTasks = next.filter(t => t.category === task.category);
          saveCategoryTasks(task.category, catTasks);
        }
        return next;
      });
    } else if (id.startsWith("gt-derived-")) {
      const gtId = id.replace("gt-derived-", "");
      setGenTasks(prev => {
        const next = prev.filter(t => String(t.id) !== String(gtId));
        saveGeneralTasks(next);
        return next;
      });
    } else {
      setTlEvents(prev => {
        const next = prev.filter(ev => ev.id !== id);
        saveTimelineEvents(next);
        return next;
      });
    }
  }
  function handleAdd(ev)        { setTlEvents(prev => [...prev, ev]); setShowAdd(false); }
  function handleUpdate(id, patch) { setTlEvents(prev => prev.map(ev => ev.id === id ? { ...ev, ...patch } : ev)); }

  const topicGroupCount = groupedRows ? groupedRows.length : 0;
  const totalHeight = BAND_H + AXIS_H + (dated.length + topicGroupCount + (undated.length ? undated.length + 1 : 0)) * ROW_H;

  // ── Gantt row renderer ─────────────────────────────────────────────────
  function renderRow(ev, i) {
    const color       = FRONT_COLORS[ev.front] || "#94a3b8";
    const isDone      = !!eventsDone[ev.id];
    const isDragging  = dragState?.evId === ev.id;
    const displayDate = isDragging ? dragState.currentDate : ev.date;
    const x           = dateToX(displayDate);
    const isHovered   = hoveredId === ev.id;
    const bg          = isDone ? "rgba(22,163,74,0.04)" : i % 2 === 1 ? "var(--surface-2)" : "var(--surface)";

    return (
      <div key={ev.id}
        style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", cursor: isDragging ? "grabbing" : "pointer", background: bg, opacity: isDone ? 0.65 : 1, position: "relative", userSelect: isDragging ? "none" : "auto" }}
        onClick={() => !isDragging && setSelectedEv(ev)}
        className="tl-ev-row"
        onMouseEnter={() => setHoveredId(ev.id)}
        onMouseLeave={() => setHoveredId(null)}>

        {/* Label column */}
        <div style={{ position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10, background: bg, borderRight: "1.5px solid var(--line)", display: "flex", alignItems: "center", gap: 0 }}>
          <div style={{ width: 10, alignSelf: "stretch", background: isDone ? "#16a34a" : color, flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 4px 0 6px", overflow: "hidden" }}>
            <span style={{ fontSize: 11, flexShrink: 0 }}>{TYPE_ICONS[ev.type] || "📌"}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "var(--muted)" : "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isDone ? "line-through" : "none" }}>{ev.title}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: isDragging ? "#ef4444" : color, flexShrink: 0, transition: "color 0.1s" }}>
              {isDone ? "✓" : fmtShort(displayDate)}
            </span>
          </div>
          {isHovered && !isDragging && (
            <button
              style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", border: "none", background: "rgba(220,38,38,0.12)", color: "#dc2626", borderRadius: 5, width: 20, height: 20, cursor: "pointer", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}
              onClick={e => { e.stopPropagation(); handleDelete(ev.id); }}
              title="מחק אירוע">✕</button>
          )}
        </div>

        {/* Track */}
        <div style={{ position: "relative", width: TRACK_W, flexShrink: 0, height: ROW_H }}>
          <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1, background: i % 2 === 1 ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.04)", transform: "translateY(-0.5px)", pointerEvents: "none" }} />
          {/* Draggable dot */}
          <div
            style={{
              position: "absolute",
              left: x - DOT_R, top: "50%",
              transform: `translateY(-50%) scale(${isDragging ? 1.8 : isHovered ? 1.35 : 1})`,
              width: DOT_R * 2, height: DOT_R * 2, borderRadius: "50%",
              background: isDone ? "#16a34a" : color,
              border: `2.5px solid white`,
              boxShadow: isDragging
                ? `0 0 0 3px ${color}, 0 6px 18px rgba(0,0,0,0.28)`
                : `0 0 0 1.5px ${isDone ? "#16a34a" : color}`,
              cursor: isDragging ? "grabbing" : "grab",
              zIndex: isDragging ? 30 : 5,
              transition: isDragging ? "none" : "transform 0.15s, box-shadow 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onPointerDown={e => handleDotDown(e, ev)}>
            {isDone && <span style={{ color: "white", fontSize: 6, fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
      </div>
    );
  }

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

      {/* Front filters */}
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
        <button className="tl-type-toggle" onClick={() => setShowTypes(s => !s)}>
          <span className="tl-filter-lbl">סוג</span>
          <span className={`tl-type-caret${showTypes ? " open" : ""}`}>›</span>
          {!showTypes && <span className="tl-type-summary">{activeT.size === ALL_TYPES.length ? "הכל" : `${activeT.size}/${ALL_TYPES.length}`}</span>}
        </button>
        {showTypes && (
          <div className="tl-filter-chips">
            {ALL_TYPES.map(t => (
              <button key={t} className={`tl-chip${activeT.has(t) ? " tl-chip-on tl-chip-type-on" : ""}`} onClick={() => toggleType(t)}>
                {TYPE_ICONS[t]} {TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls: jump | sort | add | count */}
      <div className="tl-jump-row">
        <button className="tl-jump-btn" onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 360); }}>
          ↩ קפוץ להיום
        </button>
        <div className="tl-sort-tabs">
          <button className={`tl-sort-tab${sortMode === "date"  ? " active" : ""}`} onClick={() => setSortMode("date")}>📅 תאריך</button>
          <button className={`tl-sort-tab${sortMode === "topic" ? " active" : ""}`} onClick={() => setSortMode("topic")}>🏷 נושא</button>
        </div>
        <button className="tl-add-ev-btn" onClick={() => { setAddDate(""); setShowAdd(true); }}>
          + הוסף אירוע
        </button>
        <span className="muted small">{todayStr} · {filtered.length} אירועים · גרור נקודה לשינוי תאריך</span>
      </div>

      {/* Gantt */}
      <div className="tl-rows-wrap" ref={scrollRef}>
        <div style={{ width: TOTAL_W, height: totalHeight, position: "relative" }}>

          {/* Grid lines */}
          {WEEK_TICKS.map((wk, i) => (
            <div key={i} style={{ position: "absolute", left: LABEL_W + wk.x, top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.04)", pointerEvents: "none" }} />
          ))}
          {MONTHS.map(({ str }) => (
            <div key={str} style={{ position: "absolute", left: LABEL_W + dateToX(str), top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.09)", pointerEvents: "none" }} />
          ))}
          <div style={{ position: "absolute", left: LABEL_W + todayX, top: 0, bottom: 0, width: 2, background: "rgba(239,68,68,0.7)", pointerEvents: "none", zIndex: 8 }} />

          {/* Phase band */}
          <div style={{ display: "flex", height: BAND_H, borderBottom: "1.5px solid var(--line)" }}>
            <div style={{ position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 20, background: "var(--surface-2)", borderRight: "1.5px solid var(--line)", display: "flex", alignItems: "center", padding: "0 12px" }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)" }}>אירוע</span>
            </div>
            <div style={{ position: "relative", width: TRACK_W, height: BAND_H }}>
              {PHASES.map(ph => {
                const x1 = dateToX(ph.start), x2 = dateToX(ph.end) + DAY_PX;
                const isNow = phase?.id === ph.id;
                return (
                  <div key={ph.id} style={{ position: "absolute", left: x1, width: x2 - x1, top: 0, height: BAND_H, background: ph.color + (isNow ? "2a" : "16"), borderLeft: `2px solid ${ph.color}88`, borderTop: isNow ? `2px solid ${ph.color}` : "none", overflow: "hidden" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: ph.color, padding: "3px 5px", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isNow ? "▶ " : ""}{ph.name}</span>
                    <span style={{ fontSize: 8, color: ph.color + "99", padding: "0 5px", display: "block" }}>{ph.start.slice(5)} → {ph.end.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Axis — click to add at date */}
          <div style={{ display: "flex", height: AXIS_H, borderBottom: "1.5px solid var(--line)", background: "var(--surface)" }}>
            <div style={{ position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 20, background: "var(--surface)", borderRight: "1.5px solid var(--line)", display: "flex", alignItems: "center", padding: "0 12px" }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8" }}>{todayStr}</span>
            </div>
            <div style={{ position: "relative", width: TRACK_W, height: AXIS_H, cursor: "crosshair" }}
              onClick={e => {
                const rect   = e.currentTarget.getBoundingClientRect();
                const scroll = scrollRef.current?.scrollLeft || 0;
                setAddDate(xToDate(e.clientX - rect.left + scroll));
                setShowAdd(true);
              }}
              title="לחץ כדי להוסיף אירוע בתאריך זה">
              {WEEK_TICKS.map((wk, i) => (
                <div key={i} style={{ position: "absolute", left: wk.x, top: 0 }}>
                  <div style={{ width: 1, height: 5, background: "rgba(0,0,0,0.15)", marginTop: 2 }} />
                  <div style={{ fontSize: 8, color: "#b0b8c8", fontWeight: 600, whiteSpace: "nowrap", marginTop: 1, marginLeft: 2 }}>{wk.label}</div>
                </div>
              ))}
              {MONTHS.map(({ str, label }) => (
                <div key={str} style={{ position: "absolute", left: dateToX(str) + 4, top: 2, fontSize: 12, fontWeight: 800, color: "#64748b", zIndex: 2 }}>{label}</div>
              ))}
              <div style={{ position: "absolute", left: todayX - 14, top: 3, fontSize: 9, fontWeight: 900, color: "#ef4444", background: "#fff", padding: "1px 4px", borderRadius: 4, border: "1.5px solid #ef4444", zIndex: 10, whiteSpace: "nowrap" }}>עכשיו</div>
            </div>
          </div>

          {/* Event rows */}
          {sortMode === "topic" && groupedRows
            ? groupedRows.flatMap(([front, evs]) => {
                const gc = FRONT_COLORS[front] || "#94a3b8";
                const hdr = (
                  <div key={`hdr-${front}`} style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", background: gc + "14" }}>
                    <div style={{ position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10, background: gc + "14", borderRight: "1.5px solid var(--line)", display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: gc, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, fontWeight: 900, color: gc, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{FRONT_LABELS[front] || front}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: gc + "99", flexShrink: 0 }}>{evs.length}</span>
                    </div>
                    <div style={{ width: TRACK_W }} />
                  </div>
                );
                return [hdr, ...evs.map((ev, i) => renderRow(ev, i))];
              })
            : dated.map((ev, i) => renderRow(ev, i))
          }

          {/* Undated */}
          {undated.length > 0 && (
            <>
              <div style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", background: "var(--surface-3)" }}>
                <div style={{ position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10, background: "var(--surface-3)", borderRight: "1.5px solid var(--line)", display: "flex", alignItems: "center", padding: "0 12px" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)" }}>ללא תאריך</span>
                </div>
                <div style={{ width: TRACK_W }} />
              </div>
              {undated.map((ev, i) => {
                const color = FRONT_COLORS[ev.front] || "#94a3b8";
                const bg    = i % 2 === 0 ? "var(--surface-2)" : "var(--surface)";
                return (
                  <div key={ev.id}
                    style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--line)", cursor: "pointer", background: bg }}
                    onClick={() => setSelectedEv(ev)} className="tl-ev-row"
                    onMouseEnter={() => setHoveredId(ev.id)} onMouseLeave={() => setHoveredId(null)}>
                    <div style={{ position: "sticky", left: 0, width: LABEL_W, flexShrink: 0, zIndex: 10, background: bg, borderRight: "1.5px solid var(--line)", display: "flex", alignItems: "center", gap: 0 }}>
                      <div style={{ width: 10, alignSelf: "stretch", background: color + "55", flexShrink: 0 }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 4px 0 6px", overflow: "hidden" }}>
                        <span style={{ fontSize: 11, flexShrink: 0 }}>{TYPE_ICONS[ev.type] || "📌"}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", flexShrink: 0 }}>TBD</span>
                      </div>
                      {hoveredId === ev.id && (
                        <button style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", border: "none", background: "rgba(220,38,38,0.12)", color: "#dc2626", borderRadius: 5, width: 20, height: 20, cursor: "pointer", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}
                          onClick={e => { e.stopPropagation(); handleDelete(ev.id); }}>✕</button>
                      )}
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

      {/* Drag tooltip */}
      {dragState && (
        <div className="tl-drag-tooltip" style={{ left: dragState.mouseX + 16, top: dragState.mouseY - 36 }}>
          📅 {fmtDate(dragState.currentDate)}
        </div>
      )}

      <div className="tl-vlist-wrap">
        <VerticalList events={filtered} onSelect={setSelectedEv} />
      </div>

      <GoalsPanel done={goalsDone} onToggle={toggleGoal} />

      {/* Bottom management table */}
      <EventTable
        events={tlEvents}
        eventsDone={eventsDone}
        onUpdate={(id, patch) => handleUpdate(id, patch)}
        onDelete={handleDelete}
        onToggleDone={toggleEventDone}
        onAdd={() => { setAddDate(""); setShowAdd(true); }}
      />

      {showAdd && (
        <EventModal defaultDate={addDate} onSave={handleAdd} onClose={() => setShowAdd(false)} />
      )}

      {selectedEv && (
        <EventDrawer
          event={selectedEv}
          onClose={() => setSelectedEv(null)}
          done={!!eventsDone[selectedEv.id]}
          onToggleDone={() => toggleEventDone(selectedEv.id)}
        />
      )}
    </div>
  );
}
