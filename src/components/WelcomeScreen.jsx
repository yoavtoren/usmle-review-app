import { useState } from "react";
import { loadTasks, saveTasks } from "../lib/storage.js";

const PRIOS = [
  { key: "high",   label: "High",   color: "#ef4444", bg: "#fef2f2" },
  { key: "medium", label: "Medium", color: "#d97706", bg: "#fffbeb" },
  { key: "low",    label: "Low",    color: "#059669", bg: "#f0fdf4" },
];

function TaskManager() {
  const [tasks, setTasks]   = useState(() => loadTasks());
  const [input, setInput]   = useState("");
  const [prio, setPrio]     = useState("medium");
  const [filter, setFilter] = useState("active");

  function add() {
    const text = input.trim();
    if (!text) return;
    const next = [
      ...tasks,
      { id: Date.now(), text, priority: prio, done: false, createdAt: Date.now() },
    ];
    setTasks(next); saveTasks(next); setInput("");
  }

  function toggle(id) {
    const next = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(next); saveTasks(next);
  }

  function remove(id) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next); saveTasks(next);
  }

  function clearDone() {
    const next = tasks.filter(t => !t.done);
    setTasks(next); saveTasks(next);
  }

  const prioOrder = { high: 0, medium: 1, low: 2 };
  const shown = tasks
    .filter(t => filter === "all" ? true : filter === "done" ? t.done : !t.done)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (prioOrder[a.priority] ?? 1) - (prioOrder[b.priority] ?? 1);
    });

  const activeCount = tasks.filter(t => !t.done).length;
  const doneCount   = tasks.filter(t => t.done).length;

  return (
    <div className="task-manager">
      <div className="task-hd">
        <div className="task-hd-left">
          <span className="task-hd-title">Tasks</span>
          {activeCount > 0 && <span className="task-badge">{activeCount}</span>}
        </div>
        <div className="task-tabs">
          {[["active","Active"],["all","All"],["done","Done"]].map(([k,l]) => (
            <button key={k} className={`task-tab${filter===k?" selected":""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="task-compose">
        <div className="task-prios">
          {PRIOS.map(p => (
            <button
              key={p.key}
              className={`task-prio${prio===p.key?" prio-sel":""}`}
              style={prio===p.key ? { background: p.bg, color: p.color, borderColor: p.color } : {}}
              onClick={() => setPrio(p.key)}
            >{p.label}</button>
          ))}
        </div>
        <div className="task-row">
          <input
            className="task-input"
            placeholder="Add a task…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
          />
          <button className="task-add" onClick={add} disabled={!input.trim()}>Add</button>
        </div>
      </div>

      <ul className="task-list">
        {shown.length === 0 && (
          <li className="task-empty">
            {filter === "done" ? "Nothing completed yet." : "No active tasks — add one above."}
          </li>
        )}
        {shown.map(t => {
          const p = PRIOS.find(p => p.key === t.priority) || PRIOS[1];
          return (
            <li key={t.id} className={`task-item${t.done ? " task-done" : ""}`}>
              <button
                className="task-check"
                style={{ borderColor: p.color, background: t.done ? p.color : "transparent" }}
                onClick={() => toggle(t.id)}
                aria-label={t.done ? "Mark incomplete" : "Mark complete"}
              >
                {t.done && <span className="task-check-mark">✓</span>}
              </button>
              <span className="task-text">{t.text}</span>
              <span className="task-dot" style={{ background: p.color }} title={p.label} />
              <button className="task-del" onClick={() => remove(t.id)} aria-label="Delete task">×</button>
            </li>
          );
        })}
      </ul>

      {doneCount > 0 && (
        <button className="task-clear" onClick={clearDone}>
          Clear {doneCount} completed
        </button>
      )}
    </div>
  );
}

function CaduceusIcon() {
  return (
    <svg viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="30" y="4" width="4" height="72" rx="2" fill="rgba(255,255,255,0.90)" />
      <path d="M32 18 C18 12 8 18 12 26 C16 34 28 30 32 26" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M32 18 C46 12 56 18 52 26 C48 34 36 30 32 26" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M32 28 C20 30 16 38 24 42 C32 46 36 52 28 56 C22 59 20 64 24 68"
        stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M32 28 C44 30 48 38 40 42 C32 46 28 52 36 56 C42 59 44 64 40 68"
        stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <circle cx="22" cy="70" r="3" fill="rgba(255,255,255,0.80)" />
      <circle cx="42" cy="70" r="3" fill="rgba(255,255,255,0.80)" />
    </svg>
  );
}

export default function WelcomeScreen({ onNav, testStats, faStats, streak }) {
  const faPct     = faStats.total  > 0 ? Math.round((faStats.seen    / faStats.total)  * 100) : 0;
  const testPct   = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;
  const remaining = Math.max(0, testStats.missed - testStats.mastered);

  return (
    <div className="welcome">

      {/* ── Hero banner ── */}
      <div className="welcome-banner">
        <div className="welcome-logo"><CaduceusIcon /></div>
        <h1 className="welcome-title">USMLE Step 1</h1>
        <p className="welcome-sub">Personal Review Dashboard</p>
        {streak > 0 && <div className="streak-badge">🔥 {streak}-day streak</div>}
      </div>

      {/* ── Body ── */}
      <div className="welcome-body">

        {/* Floating stats bar */}
        <div className="quick-stats">
          <div className="qs-item">
            <span className={`qs-num${testStats.due > 0 ? " qs-due" : ""}`}>{testStats.due}</span>
            <span className="qs-label">due today</span>
          </div>
          <div className="qs-divider" />
          <div className="qs-item">
            <span className="qs-num">{testStats.mastered}</span>
            <span className="qs-label">mastered</span>
          </div>
          <div className="qs-divider" />
          <div className="qs-item">
            <span className="qs-num">{remaining}</span>
            <span className="qs-label">remaining</span>
          </div>
          <div className="qs-divider" />
          <div className="qs-item">
            <span className="qs-num">{faPct}%</span>
            <span className="qs-label">FA covered</span>
          </div>
        </div>

        {/* ── 2-column main area: cards | task manager ── */}
        <div className="welcome-main-grid">

          <div className="welcome-left">

            <button className="welcome-card wcard-blue" onClick={() => onNav("/tests")}>
              <div className="wcard-top">
                <div className="wcard-icon-wrap">📝</div>
                <span className="wcard-arrow">→</span>
              </div>
              <div className="wcard-body">
                <h2>Tests</h2>
                <p className="wcard-desc">
                  Review every missed question with spaced repetition — the app tracks
                  what needs re-study and surfaces it at the right time.
                </p>
                <div className="wcard-stats">
                  <div className="wstat-block">
                    <span className="wstat-big">{testStats.missed}</span>
                    <span className="wstat-lbl">missed</span>
                  </div>
                  <div className="wstat-block wstat-ok">
                    <span className="wstat-big">{testStats.mastered}</span>
                    <span className="wstat-lbl">mastered</span>
                  </div>
                  {testStats.due > 0 && (
                    <div className="wstat-block wstat-warn">
                      <span className="wstat-big">{testStats.due}</span>
                      <span className="wstat-lbl">due now</span>
                    </div>
                  )}
                </div>
                <div className="wcard-prog">
                  <div className="wcard-prog-bar" style={{ width: `${testPct || 2}%` }} />
                </div>
                <span className="wcard-cta">Open dashboard →</span>
              </div>
            </button>

            <button className="welcome-card wcard-green" onClick={() => onNav("/fa")}>
              <div className="wcard-top">
                <div className="wcard-icon-wrap">📖</div>
                <span className="wcard-arrow">→</span>
              </div>
              <div className="wcard-body">
                <h2>First Aid Tracker</h2>
                <p className="wcard-desc">
                  Track your coverage across all 16 First Aid chapters. Mark topics
                  as you study and see exactly where you stand.
                </p>
                <div className="wcard-stats">
                  <div className="wstat-block">
                    <span className="wstat-big">{faStats.seen}</span>
                    <span className="wstat-lbl">topics done</span>
                  </div>
                  <div className="wstat-block">
                    <span className="wstat-big">{faStats.total}</span>
                    <span className="wstat-lbl">total topics</span>
                  </div>
                  <div className="wstat-block wstat-ok">
                    <span className="wstat-big">{faPct}%</span>
                    <span className="wstat-lbl">covered</span>
                  </div>
                </div>
                <div className="wcard-prog">
                  <div className="wcard-prog-bar" style={{ width: `${faPct || 2}%` }} />
                </div>
                <span className="wcard-cta">Open tracker →</span>
              </div>
            </button>

          </div>

          <TaskManager />

        </div>

        <p className="welcome-footer">100% offline · progress saved in this browser</p>
      </div>
    </div>
  );
}
