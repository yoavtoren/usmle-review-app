import { useState, useMemo } from "react";
import { loadGeneralTasks, saveGeneralTasks } from "../lib/storage.js";
import { IconCheck, IconCalendar, IconClock, IconTarget, IconClose } from "./icons.jsx";

const PRIOS = {
  high:   { label: "גבוה",  color: "#C0392B", bg: "rgba(192,57,43,0.10)" },
  medium: { label: "בינוני", color: "#B5710A", bg: "rgba(181,113,10,0.10)" },
  low:    { label: "נמוך",  color: "#1F7A52", bg: "rgba(31,122,82,0.10)" },
};
const PRIO_ORDER = { high: 0, medium: 1, low: 2 };

const EMPTY = { title: "", kind: "task", date: "", time: "", priority: "medium", notes: "" };

function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "long" });
}

function TaskForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ ...EMPTY, ...(initial || {}) });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const isEvent = f.kind === "event";

  function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    onSave({
      ...f,
      title: f.title.trim(),
      date: isEvent ? f.date : "",
      time: isEvent ? f.time : "",
    });
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

      <div className="tk-form-row">
        {isEvent && (
          <>
            <label className="tk-field">
              <span className="tk-field-lbl">תאריך</span>
              <input className="tk-input" type="date" value={f.date} onChange={e => upd("date", e.target.value)} />
            </label>
            <label className="tk-field">
              <span className="tk-field-lbl">שעה</span>
              <input className="tk-input" type="time" value={f.time} onChange={e => upd("time", e.target.value)} />
            </label>
          </>
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

      <textarea
        className="tk-input tk-textarea" rows={2}
        value={f.notes} onChange={e => upd("notes", e.target.value)}
        placeholder="הערות (אופציונלי)…"
      />

      <div className="tk-form-btns">
        {onCancel && <button type="button" className="tk-btn-ghost" onClick={onCancel}>ביטול</button>}
        <button type="submit" className="tk-btn-primary" disabled={!f.title.trim()}>
          {initial ? "שמור" : "הוסף"}
        </button>
      </div>
    </form>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete }) {
  const prio = PRIOS[task.priority] || PRIOS.medium;
  const isEvent = task.kind === "event";
  const overdue = isEvent && task.date && task.date < todayStr() && !task.done;

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
          {isEvent && task.date && (
            <span className={`tk-date${overdue ? " overdue" : ""}`}>
              <IconCalendar size={11} /> {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ""}
              {overdue && " · באיחור"}
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

  const shown = useMemo(() => {
    let list = tasks.filter(t => {
      if (filter === "done") return t.done;
      if (filter === "task") return !t.done && t.kind !== "event";
      if (filter === "event") return !t.done && t.kind === "event";
      return !t.done; // all (active)
    });
    return list.sort((a, b) => {
      // events with dates first (by date), then by priority, then newest
      const ad = a.kind === "event" && a.date, bd = b.kind === "event" && b.date;
      if (ad && bd) return (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
      if (ad && !bd) return -1;
      if (!ad && bd) return 1;
      const pa = PRIO_ORDER[a.priority] ?? 1, pb = PRIO_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return b.createdAt - a.createdAt;
    });
  }, [tasks, filter]);

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
          <p className="tk-sub">צור, ערוך ומחק משימות כלליות ואירועים עם תאריך</p>
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
