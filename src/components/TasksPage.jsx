import { useState, useMemo } from "react";
import { loadGeneralTasks, saveGeneralTasks } from "../lib/storage.js";
import { IconCheck, IconCalendar, IconClose } from "./icons.jsx";

const PRIOS = {
  high:   { label: "גבוה",  color: "#C0392B", bg: "rgba(192,57,43,0.10)" },
  medium: { label: "בינוני", color: "#B5710A", bg: "rgba(181,113,10,0.10)" },
  low:    { label: "נמוך",  color: "#1F7A52", bg: "rgba(31,122,82,0.10)" },
};
const PRIO_ORDER = { high: 0, medium: 1, low: 2 };

// Topic categories with colors + subtopic suggestions (free text still allowed)
const CATEGORIES = [
  { id: "step1",    label: "Step 1",       color: "#4F46E5",
    subs: ["Biochemistry","Immunology","Microbiology","Pathology","Pharmacology","Public Health",
           "Cardiovascular","Endocrine","Gastrointestinal","Heme/Onc","MSK & Skin","Neurology",
           "Psychiatry","Renal","Reproductive","Respiratory"] },
  { id: "medschool", label: "Med School",  color: "#0E7C86",
    subs: ["3rd year","4th year","5th year","6th year","ENT","Internal Medicine","Surgery",
           "Neurology","Dermatology","Ophthalmology","Pharmacology"] },
  { id: "aims",      label: "AIMS",        color: "#6D4AC2", subs: [] },
  { id: "medcross",  label: "MedCross",    color: "#C2185B", subs: ["תוכן","שיווק","פיתוח","הכנסות"] },
  { id: "selfcare",  label: "טיפול עצמי",  color: "#1F7A52", subs: ["כושר","תזונה","שינה","מנטלי"] },
  { id: "move",      label: "מעבר",        color: "#D97706", subs: ["פראג","ישראל","אריזה","Freemovers"] },
  { id: "personal",  label: "אישי",        color: "#565660", subs: [] },
];
const catMeta = (id) => CATEGORIES.find(c => c.id === id) || null;
export { CATEGORIES, catMeta };

const EMPTY = {
  title: "", kind: "task", date: "", endDate: "", time: "", priority: "medium", notes: "",
  category: "", subtopic: "", detail: "", contactName: "", contactInfo: "",
  addToTimeline: false,
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "long" });
}
function contactHref(info) {
  if (!info) return null;
  if (info.includes("@")) return `mailto:${info}`;
  if (/[\d+]/.test(info)) return `tel:${info.replace(/[^\d+]/g, "")}`;
  return null;
}

export function TaskForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ ...EMPTY, ...(initial || {}) });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const isEvent = f.kind === "event";
  const cat = catMeta(f.category);
  const subListId = "subs-" + (f.category || "none");

  function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    // endDate only applies to multi-day events and must not precede the start.
    const endDate = isEvent && f.endDate && f.endDate >= f.date ? f.endDate : "";
    onSave({ ...f, title: f.title.trim(), time: isEvent ? f.time : "", endDate, addToTimeline: !!f.date && !!f.addToTimeline });
  }

  return (
    <form className="tk-form" onSubmit={submit}>
      <div className="tk-kind-toggle">
        <button type="button" className={`tk-kind${f.kind === "task" ? " on" : ""}`} onClick={() => upd("kind", "task")}>
          <IconCheck size={15} /> משימה
        </button>
        <button type="button" className={`tk-kind${f.kind === "event" ? " on" : ""}`} onClick={() => upd("kind", "event")}>
          <IconCalendar size={15} /> אירוע
        </button>
      </div>

      <input
        className="tk-input tk-input-title" autoFocus
        value={f.title} onChange={e => upd("title", e.target.value)}
        placeholder={isEvent ? "שם האירוע…" : "מה צריך לעשות?"}
      />

      {/* Date / time / priority */}
      <div className="tk-form-row">
        <label className="tk-field">
          <span className="tk-field-lbl">{isEvent ? "תאריך התחלה" : "תאריך יעד (דדליין)"}</span>
          <input className="tk-input" type="date" value={f.date} onChange={e => upd("date", e.target.value)} />
        </label>
        {isEvent && (
          <label className="tk-field">
            <span className="tk-field-lbl">תאריך סיום <span className="tk-field-opt">(אופציונלי)</span></span>
            <input className="tk-input" type="date" value={f.endDate} min={f.date || undefined}
              onChange={e => upd("endDate", e.target.value)} />
          </label>
        )}
        {isEvent && (
          <label className="tk-field">
            <span className="tk-field-lbl">שעה <span className="tk-field-opt">(כל היום אם ריק)</span></span>
            <input className="tk-input" type="time" value={f.time} onChange={e => upd("time", e.target.value)} />
          </label>
        )}
        <label className="tk-field">
          <span className="tk-field-lbl">עדיפות</span>
          <select className="tk-input" value={f.priority} onChange={e => upd("priority", e.target.value)}>
            <option value="high">גבוה</option>
            <option value="medium">בינוני</option>
            <option value="low">נמוך</option>
          </select>
        </label>
      </div>

      {/* Topic: category → subtopic → detail */}
      <div className="tk-form-row">
        <label className="tk-field">
          <span className="tk-field-lbl">נושא</span>
          <select className="tk-input" value={f.category} onChange={e => upd("category", e.target.value)}>
            <option value="">— ללא —</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="tk-field">
          <span className="tk-field-lbl">תת-נושא</span>
          <input
            className="tk-input" list={subListId}
            value={f.subtopic} onChange={e => upd("subtopic", e.target.value)}
            placeholder={cat?.subs?.length ? "בחר או הקלד…" : "אופציונלי…"}
            disabled={!f.category}
          />
          <datalist id={subListId}>
            {(cat?.subs || []).map(s => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="tk-field">
          <span className="tk-field-lbl">פירוט</span>
          <input
            className="tk-input"
            value={f.detail} onChange={e => upd("detail", e.target.value)}
            placeholder="למשל: Genetics"
            disabled={!f.subtopic}
          />
        </label>
      </div>

      {/* Contact */}
      <div className="tk-form-row">
        <label className="tk-field">
          <span className="tk-field-lbl">איש קשר</span>
          <input className="tk-input" value={f.contactName} onChange={e => upd("contactName", e.target.value)} placeholder="שם…" />
        </label>
        <label className="tk-field">
          <span className="tk-field-lbl">טלפון / אימייל</span>
          <input className="tk-input" value={f.contactInfo} onChange={e => upd("contactInfo", e.target.value)} placeholder="050… / email@…" />
        </label>
      </div>

      <textarea
        className="tk-input tk-textarea" rows={2}
        value={f.notes} onChange={e => upd("notes", e.target.value)}
        placeholder="הערות (אופציונלי)…"
      />

      <label className={`tk-timeline-toggle${f.date ? "" : " disabled"}`}>
        <input type="checkbox" checked={!!f.addToTimeline && !!f.date} disabled={!f.date}
          onChange={e => upd("addToTimeline", e.target.checked)} />
        <IconCalendar size={14} />
        <span>הוסף לציר הזמן{!f.date && <span className="tk-timeline-hint"> — דורש תאריך</span>}</span>
      </label>

      <div className="tk-form-btns">
        {onCancel && <button type="button" className="tk-btn-ghost" onClick={onCancel}>ביטול</button>}
        <button type="submit" className="tk-btn-primary" disabled={!f.title.trim()}>
          {initial ? "שמור" : "הוסף"}
        </button>
      </div>
    </form>
  );
}

function Breadcrumb({ task }) {
  const cat = catMeta(task.category);
  if (!cat && !task.subtopic) return null;
  const parts = [cat?.label, task.subtopic, task.detail].filter(Boolean);
  const color = cat?.color || "var(--muted)";
  return (
    <span className="tk-topic" style={{ "--tc": color }}>
      <span className="tk-topic-dot" />
      {parts.map((p, i) => (
        <span key={i} className="tk-topic-part">
          {i > 0 && <span className="tk-topic-sep">›</span>}
          {p}
        </span>
      ))}
    </span>
  );
}

export function TaskRow({ task, onToggle, onEdit, onDelete }) {
  const prio = PRIOS[task.priority] || PRIOS.medium;
  const isEvent = task.kind === "event";
  const overdue = task.date && task.date < todayStr() && !task.done;
  const href = contactHref(task.contactInfo);

  return (
    <div className={`tk-row${task.done ? " done" : ""}${overdue ? " overdue" : ""}`}>
      <button className="tk-check" onClick={() => onToggle(task.id)} aria-label="toggle">
        {task.done && <IconCheck size={13} />}
      </button>

      <div className="tk-row-main" onClick={() => onEdit(task)}>
        <div className="tk-row-top">
          <span className="tk-row-title">{task.title}</span>
          {isEvent
            ? <span className="tk-kind-badge event"><IconCalendar size={11} /> אירוע</span>
            : <span className="tk-kind-badge task">משימה</span>}
        </div>
        <div className="tk-row-meta">
          <span className="tk-prio" style={{ color: prio.color, background: prio.bg }}>{prio.label}</span>
          {task.date && (
            <span className={`tk-date${overdue ? " overdue" : ""}`}>
              <IconCalendar size={11} /> {isEvent ? "" : "יעד: "}{fmtDate(task.date)}
              {task.endDate && task.endDate !== task.date ? ` – ${fmtDate(task.endDate)}` : ""}
              {task.time ? ` · ${task.time}` : ""}
              {overdue && " · באיחור"}
            </span>
          )}
          <Breadcrumb task={task} />
          {task.addToTimeline && task.date && (
            <span className="tk-timeline-badge"><IconCalendar size={10} /> ציר זמן</span>
          )}
          {task.contactName && (
            <span className="tk-contact">
              👤 {href
                ? <a href={href} onClick={e => e.stopPropagation()}>{task.contactName}</a>
                : task.contactName}
            </span>
          )}
          {task.notes && <span className="tk-note-preview">{task.notes}</span>}
        </div>
      </div>

      <div className="tk-row-actions">
        <button className="tk-act" onClick={() => onEdit(task)} title="ערוך">✎</button>
        <button className="tk-act tk-act-del" onClick={() => onDelete(task.id)} title="מחק"><IconClose size={13} /></button>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(() => loadGeneralTasks());
  const [filter, setFilter] = useState("all"); // all | task | event | done
  const [catFilter, setCatFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  function persist(next) { setTasks(next); saveGeneralTasks(next); }

  function add(data) {
    persist([...tasks, { ...data, id: Date.now(), done: false, createdAt: Date.now() }]);
    setAdding(false);
  }
  function update(id, data) {
    persist(tasks.map(t => t.id === id ? { ...t, ...data } : t));
    setEditing(null);
  }
  function toggle(id) { persist(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function remove(id) { persist(tasks.filter(t => t.id !== id)); }
  function clearDone() { persist(tasks.filter(t => !t.done)); }

  const counts = useMemo(() => ({
    all:   tasks.filter(t => !t.done).length,
    task:  tasks.filter(t => !t.done && t.kind !== "event").length,
    event: tasks.filter(t => !t.done && t.kind === "event").length,
    done:  tasks.filter(t => t.done).length,
  }), [tasks]);

  const usedCats = useMemo(() => {
    const ids = new Set(tasks.map(t => t.category).filter(Boolean));
    return CATEGORIES.filter(c => ids.has(c.id));
  }, [tasks]);

  const shown = useMemo(() => {
    let list = tasks.filter(t => {
      if (filter === "done") return t.done;
      if (filter === "task") return !t.done && t.kind !== "event";
      if (filter === "event") return !t.done && t.kind === "event";
      return !t.done;
    });
    if (catFilter) list = list.filter(t => t.category === catFilter);
    return list.sort((a, b) => {
      if (a.date && b.date) return (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      const pa = PRIO_ORDER[a.priority] ?? 1, pb = PRIO_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return b.createdAt - a.createdAt;
    });
  }, [tasks, filter, catFilter]);

  const TABS = [
    ["all", "הכל", counts.all],
    ["task", "משימות", counts.task],
    ["event", "אירועים", counts.event],
    ["done", "הושלמו", counts.done],
  ];

  return (
    <div className="tk-page page">
      <header className="tk-header">
        <div>
          <h1 className="tk-title">משימות ואירועים</h1>
          <p className="tk-sub">צור, ערוך ומחק משימות ואירועים — עם דדליין, נושא ואיש קשר</p>
        </div>
        {!adding && !editing && (
          <button className="tk-add-main" onClick={() => setAdding(true)}>+ הוסף חדש</button>
        )}
      </header>

      {adding && (
        <div className="tk-form-card">
          <TaskForm onSave={add} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="tk-tabs">
        {TABS.map(([k, l, n]) => (
          <button key={k} className={`tk-tab${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>
            {l}{n > 0 && <span className="tk-tab-count">{n}</span>}
          </button>
        ))}
        {counts.done > 0 && filter === "done" && (
          <button className="tk-clear-done" onClick={clearDone}>נקה שהושלמו</button>
        )}
      </div>

      {/* Category filter chips */}
      {usedCats.length > 0 && (
        <div className="tk-catbar">
          <button className={`tk-catchip${!catFilter ? " on" : ""}`} onClick={() => setCatFilter("")}>כל הנושאים</button>
          {usedCats.map(c => (
            <button key={c.id} className={`tk-catchip${catFilter === c.id ? " on" : ""}`}
              style={{ "--tc": c.color }} onClick={() => setCatFilter(catFilter === c.id ? "" : c.id)}>
              <span className="tk-catchip-dot" />{c.label}
            </button>
          ))}
        </div>
      )}

      <div className="tk-list">
        {shown.length === 0 && (
          <div className="tk-empty">
            <div className="tk-empty-icon">🗒️</div>
            <p>{filter === "done" ? "אין משימות שהושלמו עדיין." : "אין כאן כלום עדיין — הוסף משימה או אירוע."}</p>
          </div>
        )}
        {shown.map(t => (
          editing && editing.id === t.id ? (
            <div key={t.id} className="tk-form-card">
              <TaskForm initial={editing} onSave={d => update(t.id, d)} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <TaskRow key={t.id} task={t} onToggle={toggle} onEdit={setEditing} onDelete={remove} />
          )
        ))}
      </div>
    </div>
  );
}
