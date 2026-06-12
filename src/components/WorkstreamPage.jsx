import { useState, useMemo } from "react";
import { CATEGORIES, loadCategoryTasks, saveCategoryTasks,
         loadRhythms, saveRhythms, isRhythmDone, markRhythm } from "../lib/workstreamData.js";
import { URGENCY_COLORS, FRONT_COLORS } from "../lib/timelineData.js";
import { buildGCalLink } from "../lib/calendarExport.js";

const URGENCIES = ["Critical", "High", "Medium", "Low"];
const URGENCY_HE = { Critical: "קריטי", High: "גבוה", Medium: "בינוני", Low: "נמוך" };
const CAT_ICONS  = { aims: "🎯", medcross: "🏥", selfcare: "💚" };

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00Z").toLocaleDateString("he-IL", { month: "short", day: "numeric", year: "numeric" });
}
function urgencyScore(u) { return { Critical: 0, High: 1, Medium: 2, Low: 3 }[u] ?? 4; }

// ── Person chip ────────────────────────────────────────────────────────────
function PersonChip({ person }) {
  const isEmail = person.contact?.includes("@");
  function handle() {
    if (isEmail) window.open(`mailto:${person.contact}`);
    else if (person.contact) navigator.clipboard?.writeText(person.contact);
  }
  return (
    <div className="ws-person-chip">
      <span className="ws-person-name">{person.name}</span>
      {person.role && <span className="ws-person-role">{person.role}</span>}
      {person.contact && (
        <button className="ws-person-contact" onClick={handle} title={person.contact}>
          {isEmail ? "✉" : "העתק"}
        </button>
      )}
    </div>
  );
}

// ── Task form ──────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: "", urgency: "High", deadline: "", tz: "Asia/Jerusalem",
  notes: "", status: "Active", addToTimeline: true, stream: "", recurring: "",
  people: [],
};

function TaskForm({ initial, cat, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(initial || {}) }));
  const [personInput, setPersonInput] = useState({ name: "", role: "", contact: "" });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addPerson() {
    if (!personInput.name.trim()) return;
    set("people", [...(form.people || []), { ...personInput }]);
    setPersonInput({ name: "", role: "", contact: "" });
  }
  function removePerson(i) { set("people", form.people.filter((_, idx) => idx !== i)); }

  return (
    <div className="ws-form-card">
      <div className="ws-form-title" style={{ color: cat.accent }}>
        {initial?.id ? "ערוך משימה" : `משימה חדשה ב-${cat.title}`}
      </div>
      <div className="ws-form-grid">
        <div className="ws-form-field ws-form-full">
          <label className="ws-lbl">כותרת *</label>
          <input className="intake-inp" value={form.title}
            onChange={e => set("title", e.target.value)} placeholder="מה צריך לקרות?" />
        </div>
        <div className="ws-form-field">
          <label className="ws-lbl">דחיפות</label>
          <select className="intake-sel" value={form.urgency} onChange={e => set("urgency", e.target.value)}>
            {URGENCIES.map(u => <option key={u} value={u}>{URGENCY_HE[u]}</option>)}
          </select>
        </div>
        <div className="ws-form-field">
          <label className="ws-lbl">מועד אחרון</label>
          <input className="intake-inp" type="date" value={form.deadline || ""}
            onChange={e => set("deadline", e.target.value)} />
        </div>
        <div className="ws-form-field">
          <label className="ws-lbl">סטטוס</label>
          <select className="intake-sel" value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="Active">פעיל</option>
            <option value="Done">הושלם</option>
          </select>
        </div>
        {cat.streams && (
          <div className="ws-form-field">
            <label className="ws-lbl">זרם</label>
            <select className="intake-sel" value={form.stream || ""}
              onChange={e => set("stream", e.target.value)}>
              <option value="">— ללא —</option>
              {cat.streams.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}
        <div className="ws-form-field">
          <label className="ws-lbl">חוזר</label>
          <select className="intake-sel" value={form.recurring || ""}
            onChange={e => set("recurring", e.target.value)}>
            <option value="">חד פעמי</option>
            <option value="daily">יומי</option>
            <option value="weekly">שבועי</option>
          </select>
        </div>
        <div className="ws-form-field ws-form-full" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" id="ws-tl-cb" checked={!!form.addToTimeline}
            onChange={e => set("addToTimeline", e.target.checked)} />
          <label htmlFor="ws-tl-cb" className="ws-lbl" style={{ cursor: "pointer", marginBottom: 0 }}>
            הוסף לציר זמן (רק אם נקבע מועד)
          </label>
        </div>
        <div className="ws-form-field ws-form-full">
          <label className="ws-lbl">הערות</label>
          <textarea className="intake-ta" rows={2} value={form.notes || ""}
            onChange={e => set("notes", e.target.value)}
            placeholder="הקשר, חסמים, פעולה הבאה…" />
        </div>
      </div>

      <div className="ws-form-section">
        <div className="ws-lbl" style={{ marginBottom: 6 }}>אנשים</div>
        <div className="ws-form-people-row">
          <input className="intake-inp" style={{ flex: 2 }} placeholder="שם"
            value={personInput.name} onChange={e => setPersonInput(p => ({ ...p, name: e.target.value }))} />
          <input className="intake-inp" style={{ flex: 1 }} placeholder="תפקיד"
            value={personInput.role} onChange={e => setPersonInput(p => ({ ...p, role: e.target.value }))} />
          <input className="intake-inp" style={{ flex: 2 }} placeholder="אימייל / ידית"
            value={personInput.contact} onChange={e => setPersonInput(p => ({ ...p, contact: e.target.value }))} />
          <button className="ws-add-person-btn" onClick={addPerson}>+ הוסף</button>
        </div>
        {form.people?.length > 0 && (
          <div className="ws-people-list">
            {form.people.map((p, i) => (
              <div key={i} className="ws-person-chip ws-person-chip-edit">
                <PersonChip person={p} />
                <button className="ws-person-remove" onClick={() => removePerson(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="intake-ft">
        <button className="intake-back" onClick={onCancel}>ביטול</button>
        <button className="intake-save" style={{ background: cat.accent }}
          onClick={() => onSave(form)} disabled={!form.title.trim()}>
          שמור ←
        </button>
      </div>
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────────────
function TaskCard({ task, cat, onEdit, onDelete, onToggleStatus }) {
  const uColor   = URGENCY_COLORS[task.urgency] || "#94a3b8";
  const isDone   = task.status === "Done";
  const isOverdue = task.deadline && task.deadline < new Date().toISOString().slice(0,10) && !isDone;
  const gcalItem = task.deadline
    ? { ...task, title: `[${cat.title}] ${task.title}`, date: task.deadline, note: task.notes }
    : null;
  const gcal = gcalItem ? buildGCalLink(gcalItem) : null;
  const showGCalTip = cat.frontKey === "selfcare" && gcal;

  return (
    <div className={`ws-task-card${isDone ? " ws-task-done" : ""}${isOverdue ? " ws-task-overdue" : ""}`}
      style={{ borderRightColor: uColor }}>
      <div className="ws-task-top">
        <button
          className={`ws-task-check${isDone ? " ws-check-done" : ""}`}
          style={{ borderColor: uColor, background: isDone ? uColor : "transparent" }}
          onClick={() => onToggleStatus(task.id)}
          title={isDone ? "סמן פעיל" : "סמן הושלם"}
        >{isDone ? "✓" : ""}</button>
        <div className="ws-task-body">
          <div className="ws-task-title">{task.title}</div>
          {task.notes && <div className="ws-task-notes muted">{task.notes}</div>}
        </div>
        <div className="ws-task-actions">
          <button className="ws-action-btn" onClick={() => onEdit(task)} title="ערוך">✎</button>
          <button className="ws-action-btn ws-del-btn" onClick={() => onDelete(task.id)} title="מחק">✕</button>
        </div>
      </div>
      <div className="ws-task-meta">
        <span className="ws-urgency-badge" style={{ background: uColor+"22", color: uColor, borderColor: uColor+"66" }}>
          {URGENCY_HE[task.urgency] || task.urgency}
        </span>
        {task.deadline && (
          <span className={`ws-deadline-badge${isOverdue ? " ws-overdue-badge" : ""}`}>
            {isOverdue ? "⚠ " : "📅 "}{fmtDate(task.deadline)}
          </span>
        )}
        {task.addToTimeline && task.deadline && (
          <span className="ws-tl-badge" style={{ background: cat.accent+"18", color: cat.accent, borderColor: cat.accent+"44" }}>
            ציר זמן
          </span>
        )}
        {gcal && (
          <a className="ws-gcal-link" href={gcal} target="_blank" rel="noopener noreferrer">📅 GCal</a>
        )}
      </div>
      {showGCalTip && (
        <div className="ws-gcal-tip muted">טיפ: ביומן Google הגדר כירוק (Basil).</div>
      )}
      {task.people?.length > 0 && (
        <div className="ws-task-people">
          {task.people.map((p, i) => <PersonChip key={i} person={p} />)}
        </div>
      )}
    </div>
  );
}

// ── Rhythms strip ──────────────────────────────────────────────────────────
function RhythmsStrip({ tasks, rhythms, onMark, accent }) {
  const daily  = tasks.filter(t => t.recurring === "daily");
  const weekly = tasks.filter(t => t.recurring === "weekly");

  return (
    <div className="ws-rhythms">
      <div className="ws-rhythms-hd">
        <span className="ws-section-label">שגרות</span>
        <span className="muted small">מחויבויות יומיות ושבועיות — סמן כשסיימת</span>
      </div>
      {["daily","weekly"].map(period => {
        const items = period === "daily" ? daily : weekly;
        if (!items.length) return null;
        return (
          <div key={period} className="ws-rhythm-group">
            <div className="ws-rhythm-period muted small">{period === "daily" ? "כל יום" : "כל שבוע"}</div>
            {items.map(t => {
              const done = isRhythmDone(rhythms, t.id, period);
              return (
                <div key={t.id} className={`ws-rhythm-item${done ? " ws-rhythm-done" : ""}`}>
                  <button
                    className="ws-rhythm-check"
                    style={{ borderColor: accent, background: done ? accent : "transparent" }}
                    onClick={() => onMark(t.id)}
                    title={done ? "הושלם ✓" : "סמן כהושלם"}
                  >{done ? "✓" : ""}</button>
                  <div className="ws-rhythm-body">
                    <span className="ws-rhythm-title">{t.title}</span>
                    {t.notes && <span className="ws-rhythm-note muted">{t.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Stream group (collapsible) ─────────────────────────────────────────────
function StreamGroup({ stream, tasks, cat, collapsed, onToggle, onEdit, onDelete, onToggleStatus }) {
  return (
    <div className="ws-stream-group">
      <button className="ws-stream-hd" onClick={onToggle}
        style={{ borderRightColor: cat.accent }}>
        <span className="ws-stream-label">{stream.label}</span>
        <span className="ws-stream-count" style={{ background: cat.accent+"22", color: cat.accent }}>
          {tasks.length}
        </span>
        <span className={`ws-stream-caret${collapsed ? "" : " ws-caret-open"}`}>›</span>
      </button>
      {!collapsed && (
        <div className="ws-stream-tasks">
          {tasks.length === 0
            ? <div className="ws-empty"><span className="ws-empty-icon">📋</span><span className="ws-empty-text">אין משימות כאן</span><span className="ws-empty-hint">הוסף משימה חדשה ↑</span></div>
            : tasks.map(t => (
                <TaskCard key={t.id} task={t} cat={cat}
                  onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── Main WorkstreamPage ────────────────────────────────────────────────────
export default function WorkstreamPage({ categoryId }) {
  const cat = CATEGORIES[categoryId];

  const [allTasks, setAllTasks]   = useState(() => loadCategoryTasks(categoryId));
  const [rhythms,  setRhythms]    = useState(loadRhythms);
  const [showForm, setShowForm]   = useState(false);
  const [editingTask, setEditing] = useState(null);
  const [filterU, setFilterU]     = useState(new Set(URGENCIES));
  const [filterS, setFilterS]     = useState("active");
  const [activeStream, setActiveStream] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());

  function persist(next) { setAllTasks(next); saveCategoryTasks(categoryId, next); }

  function handleSave(form) {
    const task = editingTask
      ? { ...editingTask, ...form }
      : { ...form, id: `${categoryId}-${Date.now()}`, category: categoryId };
    persist(editingTask
      ? allTasks.map(t => t.id === editingTask.id ? task : t)
      : [...allTasks, task]);
    setShowForm(false); setEditing(null);
  }
  function handleDelete(id) { persist(allTasks.filter(t => t.id !== id)); }
  function toggleStatus(id) {
    persist(allTasks.map(t => t.id === id ? { ...t, status: t.status === "Active" ? "Done" : "Active" } : t));
  }
  function startEdit(task) { setEditing(task); setShowForm(true); }

  function handleMarkRhythm(id) {
    const next = markRhythm(rhythms, id);
    setRhythms(next); saveRhythms(next);
  }

  const recurring    = useMemo(() => allTasks.filter(t => t.recurring && t.status === "Active"), [allTasks]);
  const nonRecurring = useMemo(() => allTasks.filter(t => !t.recurring), [allTasks]);

  const filteredTasks = useMemo(() => {
    return nonRecurring
      .filter(t => {
        if (!filterU.has(t.urgency)) return false;
        if (filterS === "active" && t.status !== "Active") return false;
        if (filterS === "done"   && t.status !== "Done")   return false;
        if (activeStream && t.stream !== activeStream) return false;
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
  }, [nonRecurring, filterU, filterS, activeStream]);

  const groupedTasks = useMemo(() => {
    if (!cat.streams || activeStream) return null;
    const g = {};
    cat.streams.forEach(s => { g[s.id] = []; });
    filteredTasks.forEach(t => {
      const k = t.stream || cat.streams[0].id;
      if (g[k]) g[k].push(t);
    });
    return g;
  }, [cat.streams, filteredTasks, activeStream]);

  const waitingOn = useMemo(() => {
    const out = [];
    for (const t of allTasks.filter(t => t.status === "Active" && !t.recurring)) {
      for (const p of (t.people || [])) {
        if (p.name) out.push({ ...p, taskTitle: t.title });
      }
    }
    return out;
  }, [allTasks]);

  const activeCount = allTasks.filter(t => t.status === "Active").length;
  const doneCount   = allTasks.filter(t => t.status === "Done").length;

  return (
    <div className="ws-page" style={{ "--ws-accent": cat.accent }}>

      {/* Colored band header */}
      <div className="ws-band" style={{ "--ws-band-c": cat.accent }}>
        <div className="ws-band-left">
          <span className="ws-band-icon">{CAT_ICONS[categoryId] || "📋"}</span>
          <div>
            <h1 className="ws-band-title">{cat.title}</h1>
            <p className="ws-band-sub">{cat.subtitle}</p>
          </div>
        </div>
        <div className="ws-band-right">
          <div className="ws-band-count">
            <span>{activeCount}</span>
            <small>פעיל</small>
          </div>
          <button className="ws-band-btn"
            onClick={() => { setEditing(null); setShowForm(f => !f); }}>
            {showForm && !editingTask ? "✕" : "+ חדש"}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <TaskForm
          initial={editingTask}
          cat={cat}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Rhythms — moved to top so daily/weekly habits are seen first */}
      {recurring.length > 0 && (
        <RhythmsStrip tasks={recurring} rhythms={rhythms} onMark={handleMarkRhythm} accent={cat.accent} />
      )}

      {/* Waiting on */}
      {waitingOn.length > 0 && (
        <div className="ws-waiting-card">
          <div className="ws-waiting-hd">
            <span className="ws-section-label">ממתין ל</span>
            <span className="ws-waiting-count">{waitingOn.length}</span>
          </div>
          <div className="ws-waiting-chips">
            {waitingOn.map((p, i) => (
              <div key={i} className="ws-waiting-chip">
                <span className="ws-waiting-avatar">{p.name[0]}</span>
                <div className="ws-waiting-info">
                  <span className="ws-waiting-name">{p.name}</span>
                  <span className="ws-waiting-task">{p.taskTitle}</span>
                </div>
                {p.contact && (
                  <a className="ws-person-contact"
                    href={p.contact.includes("@") ? `mailto:${p.contact}` : undefined}
                    onClick={p.contact.includes("@") ? undefined : e => { e.preventDefault(); navigator.clipboard?.writeText(p.contact); }}>
                    {p.contact.includes("@") ? "✉" : "העתק"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="ws-filters">
        <div className="ws-filter-group">
          {URGENCIES.map(u => {
            const color = URGENCY_COLORS[u];
            const on = filterU.has(u);
            return (
              <button key={u} className={`ws-uchip${on ? " ws-uchip-on" : ""}`}
                style={on ? { background: color+"22", color, borderColor: color+"66" } : {}}
                onClick={() => setFilterU(prev => {
                  const n = new Set(prev); n.has(u) ? n.delete(u) : n.add(u); return n;
                })}>
                {URGENCY_HE[u]}
              </button>
            );
          })}
        </div>
        <div className="ws-filter-group">
          {[["active","פעיל"],["all","הכל"],["done","הושלם"]].map(([k,l]) => (
            <button key={k} className={`ws-schip${filterS === k ? " ws-schip-on" : ""}`}
              style={filterS === k ? { background: cat.accent+"18", color: cat.accent, borderColor: cat.accent+"44" } : {}}
              onClick={() => setFilterS(k)}>{l}</button>
          ))}
        </div>
        {cat.streams && (
          <div className="ws-filter-group">
            <button className={`ws-schip${!activeStream ? " ws-schip-on" : ""}`}
              style={!activeStream ? { background: cat.accent+"18", color: cat.accent, borderColor: cat.accent+"44" } : {}}
              onClick={() => setActiveStream(null)}>כל הזרמים</button>
            {cat.streams.map(s => (
              <button key={s.id} className={`ws-schip${activeStream === s.id ? " ws-schip-on" : ""}`}
                style={activeStream === s.id ? { background: cat.accent+"18", color: cat.accent, borderColor: cat.accent+"44" } : {}}
                onClick={() => setActiveStream(s.id)}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="ws-task-list">
        {groupedTasks ? (
          cat.streams.map(s => (
            <StreamGroup key={s.id}
              stream={s}
              tasks={groupedTasks[s.id] || []}
              cat={cat}
              collapsed={collapsed.has(s.id)}
              onToggle={() => setCollapsed(prev => {
                const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n;
              })}
              onEdit={startEdit}
              onDelete={handleDelete}
              onToggleStatus={toggleStatus}
            />
          ))
        ) : (
          filteredTasks.length === 0
            ? <div className="ws-empty"><span className="ws-empty-icon">🔍</span><span className="ws-empty-text">אין תוצאות</span><span className="ws-empty-hint">נסה לשנות את הסינון</span></div>
            : filteredTasks.map(t => (
                <TaskCard key={t.id} task={t} cat={cat}
                  onEdit={startEdit} onDelete={handleDelete} onToggleStatus={toggleStatus} />
              ))
        )}
      </div>


      {/* Footer */}
      <div className="ws-footer muted small">
        משימות עם מועד + "הוסף לציר זמן" מופיעות אוטומטית בציר הזמן.
        ייצא .ics מציר הזמן לתזכורות ביומן Google.
        {categoryId === "selfcare" && " · פריטים ירוקים: הגדר ל-Basil ביומן Google לעקביות צבע."}
      </div>
    </div>
  );
}
