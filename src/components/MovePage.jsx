import { useState, useMemo } from "react";
import { loadGeneralTasks, saveGeneralTasks } from "../lib/storage.js";
import { TaskForm, TaskRow } from "./TasksPage.jsx";

/* מעבר area — a focused view over the Tasks-page store, filtered to the
   "move" category and grouped by subtopic. Edits write back to the same
   general-tasks store, so they stay in sync with the Tasks page and the
   Timeline (tasks flagged addToTimeline appear there automatically). */

const SUB_ORDER = ["פראג", "ישראל", "אריזה", "Freemovers"];
const OTHER = "כללי";

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function MovePage() {
  const [tasks, setTasks]   = useState(() => loadGeneralTasks());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);

  function persist(next) { setTasks(next); saveGeneralTasks(next); }
  function add(data) {
    persist([...tasks, { ...data, category: "move", id: Date.now(), done: false, createdAt: Date.now() }]);
    setAdding(false);
  }
  function update(id, data) { persist(tasks.map(t => t.id === id ? { ...t, ...data } : t)); setEditing(null); }
  function toggle(id) { persist(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function remove(id) { persist(tasks.filter(t => t.id !== id)); }

  const moveTasks = useMemo(() => tasks.filter(t => t.category === "move"), [tasks]);
  const active = moveTasks.filter(t => !t.done);
  const doneCount = moveTasks.length - active.length;
  const onTimeline = active.filter(t => t.addToTimeline && t.date).length;

  // Group active tasks by subtopic, in a stable order.
  const groups = useMemo(() => {
    const map = {};
    for (const t of active) {
      const key = SUB_ORDER.includes(t.subtopic) ? t.subtopic : OTHER;
      (map[key] = map[key] || []).push(t);
    }
    const order = [...SUB_ORDER, OTHER].filter(k => map[k]?.length);
    return order.map(name => ({
      name,
      items: map[name].sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return b.createdAt - a.createdAt;
      }),
    }));
  }, [active]);

  const doneTasks = showDone ? moveTasks.filter(t => t.done) : [];

  return (
    <div className="tk-page page mv-page">
      <header className="tk-header">
        <div>
          <h1 className="tk-title">מעבר</h1>
          <p className="tk-sub">פראג → ישראל · משימות, אריזה ולוגיסטיקה — מסונכרן עם המשימות וציר הזמן</p>
        </div>
        {!adding && (
          <button className="tk-add-main" onClick={() => setAdding(true)}>+ הוסף למעבר</button>
        )}
      </header>

      <div className="mv-stats">
        <span className="mv-stat"><strong>{active.length}</strong> פתוחות</span>
        <span className="mv-stat"><strong>{onTimeline}</strong> בציר הזמן</span>
        <span className="mv-stat"><strong>{doneCount}</strong> הושלמו</span>
      </div>

      {adding && (
        <div className="tk-form-card">
          <TaskForm initial={{ category: "move" }} onSave={add} onCancel={() => setAdding(false)} />
        </div>
      )}

      {groups.length === 0 && !adding && (
        <div className="tk-empty">
          <div className="tk-empty-icon">📦</div>
          <p>אין עדיין משימות מעבר — הוסף אחת, או תייג משימה בנושא "מעבר" בעמוד המשימות.</p>
        </div>
      )}

      {groups.map(g => (
        <section key={g.name} className="mv-group">
          <div className="mv-group-hd">
            <span className="mv-group-name">{g.name}</span>
            <span className="mv-group-count">{g.items.length}</span>
          </div>
          <div className="tk-list">
            {g.items.map(t => (
              editing && editing.id === t.id ? (
                <div key={t.id} className="tk-form-card">
                  <TaskForm initial={editing} onSave={d => update(t.id, d)} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                <TaskRow key={t.id} task={t} onToggle={toggle} onEdit={setEditing} onDelete={remove} />
              )
            ))}
          </div>
        </section>
      ))}

      {doneCount > 0 && (
        <button className="mv-done-toggle" onClick={() => setShowDone(s => !s)}>
          {showDone ? "הסתר שהושלמו" : `הצג ${doneCount} שהושלמו`}
        </button>
      )}
      {showDone && (
        <div className="tk-list">
          {doneTasks.map(t => (
            <TaskRow key={t.id} task={t} onToggle={toggle} onEdit={setEditing} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
