import { useState, useMemo } from "react";
import { loadAimsTasks, saveAimsTasks, URGENCY_COLORS, FRONT_COLORS } from "../lib/timelineData.js";
import { buildGCalLink } from "../lib/calendarExport.js";

const URGENCIES = ["Critical", "High", "Medium", "Low"];

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function urgencyScore(u) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[u] ?? 4;
}

function PersonChip({ person }) {
  const isEmail = person.contact?.includes("@");
  function handleContact() {
    if (isEmail) window.open(`mailto:${person.contact}`);
    else if (person.contact) navigator.clipboard?.writeText(person.contact);
  }
  return (
    <div className="aims-person-chip">
      <span className="aims-person-name">{person.name}</span>
      {person.role && <span className="aims-person-role">{person.role}</span>}
      {person.contact && (
        <button className="aims-person-contact" onClick={handleContact} title={person.contact}>
          {isEmail ? "✉" : "Copy"}
        </button>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  title: "", urgency: "High", deadline: "", tz: "Asia/Jerusalem",
  notes: "", status: "Active", addToTimeline: true,
  people: [],
};

function TaskForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [personInput, setPersonInput] = useState({ name: "", role: "", contact: "" });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addPerson() {
    if (!personInput.name.trim()) return;
    set("people", [...(form.people || []), { ...personInput }]);
    setPersonInput({ name: "", role: "", contact: "" });
  }

  function removePerson(i) { set("people", form.people.filter((_, idx) => idx !== i)); }

  return (
    <div className="aims-form-card">
      <div className="aims-form-title">{initial?.id ? "Edit task" : "New AIMS task"}</div>

      <div className="aims-form-grid">
        <div className="aims-form-field aims-form-full">
          <label className="aims-lbl">Title <span className="i-req">*</span></label>
          <input className="intake-inp" value={form.title} onChange={e => set("title", e.target.value)}
            placeholder="What needs to happen?" />
        </div>
        <div className="aims-form-field">
          <label className="aims-lbl">Urgency</label>
          <select className="intake-sel" value={form.urgency} onChange={e => set("urgency", e.target.value)}>
            {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="aims-form-field">
          <label className="aims-lbl">Deadline <span className="i-opt">(optional)</span></label>
          <input className="intake-inp" type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} />
        </div>
        <div className="aims-form-field">
          <label className="aims-lbl">Status</label>
          <select className="intake-sel" value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="Active">Active</option>
            <option value="Done">Done</option>
          </select>
        </div>
        <div className="aims-form-field">
          <label className="aims-lbl" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.addToTimeline} onChange={e => set("addToTimeline", e.target.checked)} />
            Add to Timeline
          </label>
        </div>
        <div className="aims-form-field aims-form-full">
          <label className="aims-lbl">Notes</label>
          <textarea className="intake-ta" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="Context, blockers, next action…" />
        </div>
      </div>

      {/* People */}
      <div className="aims-form-section">
        <div className="aims-lbl" style={{ marginBottom: 6 }}>People</div>
        <div className="aims-form-people-row">
          <input className="intake-inp" style={{ flex: 2 }} placeholder="Name" value={personInput.name}
            onChange={e => setPersonInput(p => ({ ...p, name: e.target.value }))} />
          <input className="intake-inp" style={{ flex: 1 }} placeholder="Role" value={personInput.role}
            onChange={e => setPersonInput(p => ({ ...p, role: e.target.value }))} />
          <input className="intake-inp" style={{ flex: 2 }} placeholder="Email / handle" value={personInput.contact}
            onChange={e => setPersonInput(p => ({ ...p, contact: e.target.value }))} />
          <button className="aims-add-person-btn" onClick={addPerson}>+ Add</button>
        </div>
        {form.people?.length > 0 && (
          <div className="aims-people-list">
            {form.people.map((p, i) => (
              <div key={i} className="aims-person-chip aims-person-chip-edit">
                <PersonChip person={p} />
                <button className="aims-person-remove" onClick={() => removePerson(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="intake-ft">
        <button className="intake-back" onClick={onCancel}>Cancel</button>
        <button className="intake-save" onClick={() => onSave(form)} disabled={!form.title.trim()}>
          Save →
        </button>
      </div>
    </div>
  );
}

// ── Main AIMS page ────────────────────────────────────────────────────────
export default function AIMSDashboard() {
  const [tasks, setTasks]   = useState(loadAimsTasks);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterU, setFilterU] = useState(new Set(["Critical","High","Medium","Low"]));
  const [filterS, setFilterS] = useState("active");

  function persist(next) { setTasks(next); saveAimsTasks(next); }

  function handleSave(form) {
    if (editingTask) {
      persist(tasks.map(t => t.id === editingTask.id ? { ...editingTask, ...form } : t));
      setEditingTask(null);
    } else {
      const newTask = { ...form, id: `aims-${Date.now()}` };
      persist([...tasks, newTask]);
    }
    setShowForm(false);
  }

  function handleDelete(id) { persist(tasks.filter(t => t.id !== id)); }

  function toggleStatus(id) {
    persist(tasks.map(t => t.id === id ? { ...t, status: t.status === "Active" ? "Done" : "Active" } : t));
  }

  function startEdit(task) { setEditingTask(task); setShowForm(true); }

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (!filterU.has(t.urgency)) return false;
        if (filterS === "active" && t.status !== "Active") return false;
        if (filterS === "done"   && t.status !== "Done")   return false;
        return true;
      })
      .sort((a, b) => {
        const sd = urgencyScore(a.urgency) - urgencyScore(b.urgency);
        if (sd !== 0) return sd;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
  }, [tasks, filterU, filterS]);

  // "Waiting on" roll-up — all people across active tasks
  const waitingOn = useMemo(() => {
    const people = [];
    for (const t of tasks.filter(t => t.status === "Active")) {
      for (const p of (t.people || [])) {
        if (p.name) people.push({ ...p, taskTitle: t.title });
      }
    }
    return people;
  }, [tasks]);

  const activeCount = tasks.filter(t => t.status === "Active").length;
  const doneCount   = tasks.filter(t => t.status === "Done").length;

  return (
    <div className="aims-page">
      {/* Header */}
      <div className="aims-header">
        <div>
          <h1 className="aims-title">AIMS</h1>
          <p className="muted aims-sub">Student org command page · {activeCount} active · {doneCount} done</p>
        </div>
        <button className="dash-cta-btn" onClick={() => { setEditingTask(null); setShowForm(s => !s); }}>
          {showForm && !editingTask ? "✕ Cancel" : "+ New task"}
        </button>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <TaskForm
          initial={editingTask || null}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingTask(null); }}
        />
      )}

      {/* Waiting on roll-up */}
      {waitingOn.length > 0 && (
        <div className="aims-waiting-card">
          <div className="aims-section-label">Waiting on</div>
          <div className="aims-waiting-chips">
            {waitingOn.map((p, i) => (
              <div key={i} className="aims-waiting-chip">
                <span className="aims-waiting-name">{p.name}</span>
                <span className="aims-waiting-task muted">re: {p.taskTitle}</span>
                {p.contact && (
                  <a className="aims-person-contact"
                    href={p.contact.includes("@") ? `mailto:${p.contact}` : undefined}
                    onClick={p.contact.includes("@") ? undefined : e => { e.preventDefault(); navigator.clipboard?.writeText(p.contact); }}>
                    {p.contact.includes("@") ? "✉" : "Copy"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="aims-filters">
        <div className="aims-filter-group">
          {URGENCIES.map(u => {
            const color = URGENCY_COLORS[u];
            const on = filterU.has(u);
            return (
              <button key={u} className={`aims-uchip${on ? " aims-uchip-on" : ""}`}
                style={on ? { background: color + "22", color, borderColor: color + "66" } : {}}
                onClick={() => setFilterU(prev => {
                  const next = new Set(prev);
                  next.has(u) ? next.delete(u) : next.add(u);
                  return next;
                })}>
                {u}
              </button>
            );
          })}
        </div>
        <div className="aims-filter-group">
          {[["active","Active"],["all","All"],["done","Done"]].map(([k,l]) => (
            <button key={k} className={`aims-schip${filterS === k ? " aims-schip-on" : ""}`}
              onClick={() => setFilterS(k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="aims-task-list">
        {filteredTasks.length === 0 && (
          <div className="aims-empty muted">No tasks match the current filter.</div>
        )}
        {filteredTasks.map(task => {
          const uColor = URGENCY_COLORS[task.urgency] || "#94a3b8";
          const gcal   = task.deadline ? buildGCalLink({ ...task, title: `[AIMS] ${task.title}`, date: task.deadline, note: task.notes }) : null;
          const isDone = task.status === "Done";
          const isOverdue = task.deadline && task.deadline < new Date().toISOString().slice(0,10) && !isDone;

          return (
            <div key={task.id} className={`aims-task-card${isDone ? " aims-task-done" : ""}${isOverdue ? " aims-task-overdue" : ""}`}
              style={{ borderLeftColor: uColor }}>
              <div className="aims-task-top">
                <button
                  className={`aims-task-check${isDone ? " aims-check-done" : ""}`}
                  style={{ borderColor: uColor, background: isDone ? uColor : "transparent" }}
                  onClick={() => toggleStatus(task.id)}
                  title={isDone ? "Mark active" : "Mark done"}
                >{isDone ? "✓" : ""}</button>
                <div className="aims-task-body">
                  <div className="aims-task-title">{task.title}</div>
                  {task.notes && <div className="aims-task-notes muted">{task.notes}</div>}
                </div>
                <div className="aims-task-actions">
                  <button className="aims-action-btn" onClick={() => startEdit(task)} title="Edit">✎</button>
                  <button className="aims-action-btn aims-del-btn" onClick={() => handleDelete(task.id)} title="Delete">✕</button>
                </div>
              </div>

              <div className="aims-task-meta">
                <span className="aims-urgency-badge" style={{ background: uColor + "22", color: uColor, borderColor: uColor + "66" }}>
                  {task.urgency}
                </span>
                {task.deadline && (
                  <span className={`aims-deadline-badge${isOverdue ? " aims-overdue-badge" : ""}`}>
                    {isOverdue ? "⚠ " : "📅 "}{fmtDate(task.deadline)}
                  </span>
                )}
                {task.addToTimeline && task.deadline && (
                  <span className="aims-tl-badge">Timeline</span>
                )}
                {gcal && (
                  <a className="aims-gcal-link" href={gcal} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar">
                    📅 GCal
                  </a>
                )}
              </div>

              {task.people?.length > 0 && (
                <div className="aims-task-people">
                  {task.people.map((p, i) => <PersonChip key={i} person={p} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="aims-footer muted small">
        AIMS tasks with a deadline and "Add to Timeline" checked auto-appear on the Timeline page. Export all to .ics from the Timeline page for Google Calendar reminders.
      </div>
    </div>
  );
}
