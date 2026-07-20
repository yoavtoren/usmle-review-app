import { useEffect, useMemo, useRef, useState } from "react";
import { loadGeneralTasks, saveGeneralTasks, loadRailNotes, saveRailNotes } from "../lib/storage.js";
import { localISODate } from "../lib/config.js";
import { impact } from "../lib/haptics.js";
import { IconCheck, IconPlus, IconClipboard, IconNote, IconArrow } from "./icons.jsx";

const PANEL_TAB_KEY = "usmle-app:rail-panel-tab";

// Compact "Tasks & Notes" section that lives in the sidebar. Tasks share the
// same `general-tasks-v1` store as the full /tasks page — anything added or
// checked here shows up there and vice-versa. Notes are a free-form scratch pad.
export default function RailPanel({ onNavigate }) {
  const [tab, setTab] = useState(() => localStorage.getItem(PANEL_TAB_KEY) || "tasks");
  useEffect(() => { localStorage.setItem(PANEL_TAB_KEY, tab); }, [tab]);

  return (
    <section className="rail-panel" aria-label="משימות ופתקים">
      <div className="rail-panel-tabs">
        <button className={`rail-panel-tab${tab === "tasks" ? " on" : ""}`} onClick={() => setTab("tasks")}>
          <IconClipboard size={13} /> משימות
        </button>
        <button className={`rail-panel-tab${tab === "notes" ? " on" : ""}`} onClick={() => setTab("notes")}>
          <IconNote size={13} /> פתקים
        </button>
      </div>
      {tab === "tasks" ? <TasksMini onNavigate={onNavigate} /> : <NotesMini />}
    </section>
  );
}

function TasksMini({ onNavigate }) {
  const [tasks, setTasks] = useState(() => loadGeneralTasks());
  const [title, setTitle] = useState("");

  function persist(next) { setTasks(next); saveGeneralTasks(next); }

  function add(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    persist([
      ...tasks,
      { id: Date.now(), title: t, kind: "task", priority: "medium", done: false, createdAt: Date.now() },
    ]);
    setTitle("");
    impact("light");
  }
  function toggle(id) {
    const cur = tasks.find((t) => t.id === id);
    if (cur && !cur.done) impact("light");
    persist(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  const today = localISODate();
  // Active tasks first, earliest deadline / overdue on top; show a handful.
  const active = useMemo(() => {
    return tasks
      .filter((t) => !t.done)
      .sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [tasks]);

  const shown = active.slice(0, 4);
  const more = active.length - shown.length;

  return (
    <div className="rail-panel-body">
      <form className="rail-task-add" onSubmit={add}>
        <input
          className="rail-task-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="הוסף משימה מהירה…"
          aria-label="הוסף משימה"
        />
        <button type="submit" className="rail-task-addbtn" disabled={!title.trim()} aria-label="הוסף">
          <IconPlus size={14} />
        </button>
      </form>

      {active.length === 0 ? (
        <p className="rail-panel-empty">אין משימות פתוחות ✨</p>
      ) : (
        <ul className="rail-task-list">
          {shown.map((t) => {
            const overdue = t.date && t.date < today;
            return (
              <li key={t.id} className={`rail-task${overdue ? " overdue" : ""}`}>
                <button className="rail-task-check" onClick={() => toggle(t.id)} aria-label="סמן כבוצע">
                  {t.done && <IconCheck size={11} />}
                </button>
                <span className="rail-task-title">{t.title}</span>
              </li>
            );
          })}
        </ul>
      )}

      <button className="rail-panel-link" onClick={() => onNavigate("/tasks")}>
        {more > 0 ? `עוד ${more} · כל המשימות` : "כל המשימות"}
        <IconArrow size={13} />
      </button>
    </div>
  );
}

function NotesMini() {
  const [text, setText] = useState(() => loadRailNotes());
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);
  const savedTimer = useRef(null);

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(savedTimer.current); }, []);

  function onChange(v) {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveRailNotes(v);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1400);
    }, 500);
  }

  return (
    <div className="rail-panel-body">
      <textarea
        className="rail-notes"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="פתק מהיר — נשמר אוטומטית…"
        aria-label="פתקים"
      />
      <span className={`rail-notes-saved${saved ? " show" : ""}`}>נשמר ✓</span>
    </div>
  );
}
