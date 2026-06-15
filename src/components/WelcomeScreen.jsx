import { useRef, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadTasks, saveTasks, loadProgress, computeInsights,
  getWeakSubjects, getLightMode, setLightMode,
  touchFASection, getFAIntakeCoverage,
  exportAllData, importAllData,
  resetScheduleToDate, getMasteredThisWeek,
} from "../lib/storage.js";
import { SUBJECT_SORT_WEIGHT, FRONT_LOAD_SUBJECTS } from "../lib/intakeData.js";
import { chaptersFromText } from "../lib/faMap.js";

const PRIOS = [
  { key: "high",   label: "High",   color: "#ef4444", bg: "rgba(239,68,68,0.09)" },
  { key: "medium", label: "Medium", color: "#d97706", bg: "rgba(217,119,6,0.09)" },
  { key: "low",    label: "Low",    color: "#059669", bg: "rgba(5,150,105,0.09)" },
];

const TYPE_META = {
  "anki-todo":     { icon: "🃏", label: "Anki",    cls: "tbadge-anki"    },
  "read-fa":       { icon: "📖", label: "FA",      cls: "tbadge-fa"      },
  "redo-qs":       { icon: "🔁", label: "Redo",    cls: "tbadge-redo"    },
  "learn-concept": { icon: "🧠", label: "Concept", cls: "tbadge-concept" },
  "consolidation": { icon: "🔗", label: "Consolidate", cls: "tbadge-consol" },
};

const TEST_DATE = "2026-10-11";

function taskSortScore(t) {
  if (t.type === "consolidation") return -9999;
  const p = { high: 0, medium: 1000, low: 2000 }[t.priority] ?? 1000;
  const w = (SUBJECT_SORT_WEIGHT[t.subject] || 99) * 10;
  return p + w;
}

function SmartInsights({ insights, tasks, onAdd }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="insights-panel">
      <div className="insights-hd">
        <span className="insights-title">💡 Study Insights</span>
        <span className="insights-sub">From your difficulty ratings</span>
      </div>
      <div className="insights-list">
        {insights.map(ins => {
          const added = tasks.some(t => t.insightId === ins.id);
          return (
            <div key={ins.id} className={`insight-item insight-${ins.type}`}>
              <div className="insight-body">
                <span className="insight-icon">{ins.icon}</span>
                <div className="insight-text">
                  <span className="insight-title">{ins.title}</span>
                  <span className="insight-detail">{ins.detail}</span>
                </div>
              </div>
              <button className={`insight-add-btn${added ? " insight-added" : ""}`}
                onClick={() => !added && onAdd(ins)} disabled={added}
                title={added ? "Already in tasks" : "Add to tasks"}>
                {added ? "✓ Added" : "+ Task"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeakSubjectsStrip({ data }) {
  if (!data || data.length === 0) return null;
  const max = data[0].count;
  return (
    <div className="weak-strip">
      <span className="weak-strip-lbl">Recurring weak spots</span>
      <div className="weak-chips">
        {data.map(({ subject, count }) => (
          <div key={subject} className="weak-chip">
            <span className="weak-chip-subj">{subject}</span>
            <div className="weak-chip-bar">
              <div className="weak-chip-fill" style={{ width: `${Math.round((count / max) * 100)}%` }} />
            </div>
            <span className="weak-chip-count">{count} misses</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskManager({ tasks, setTasks }) {
  const nav = useNavigate();
  const [input, setInput]       = useState("");
  const [prio, setPrio]         = useState("medium");
  const [filter, setFilter]     = useState("active");
  const [importError, setImportError] = useState("");
  const importRef = useRef(null);

  // Open the FA tracker focused on the chapter a "Read FA" task targets.
  function openFA(t) {
    const file = t.faChapters?.[0]?.file
      || chaptersFromText(`${t.text || ""} ${t.body || ""}`)[0]?.file;
    nav("/fa", { state: file ? { focusChapter: file } : undefined });
  }

  function add() {
    const text = input.trim();
    if (!text) return;
    const next = [...tasks, { id: Date.now(), text, priority: prio, done: false, createdAt: Date.now() }];
    setTasks(next); saveTasks(next); setInput("");
  }

  function toggle(id) {
    const task = tasks.find(t => t.id === id);
    if (task && task.type === "read-fa" && !task.done && task.linkedFaSectionId) {
      touchFASection(task.linkedFaSectionId);
    }
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

  function handleExport() {
    const data = exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `usmle-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    const reader = new FileReader();
    reader.onload = ev => {
      const ok = importAllData(ev.target.result);
      if (ok) window.location.reload();
      else setImportError("Import failed — invalid file.");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const shown = tasks
    .filter(t => filter === "all" ? true : filter === "done" ? t.done : !t.done)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return taskSortScore(a) - taskSortScore(b);
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
            <button key={p.key} className={`task-prio${prio===p.key?" prio-sel":""}`}
              style={prio===p.key ? { background: p.bg, color: p.color, borderColor: p.color } : {}}
              onClick={() => setPrio(p.key)}>{p.label}</button>
          ))}
        </div>
        <div className="task-row">
          <input className="task-input" placeholder="Add a task…" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
          <button className="task-add" onClick={add} disabled={!input.trim()}>Add</button>
        </div>
      </div>

      <ul className="task-list">
        {shown.length === 0 && (
          <li className="task-empty">
            {filter === "done" ? "Nothing completed yet." : "No active tasks — add one…"}
          </li>
        )}
        {shown.map(t => {
          const p = PRIOS.find(p => p.key === t.priority) || PRIOS[1];
          const tm = TYPE_META[t.type];
          return (
            <li key={t.id} className={`task-item${t.done ? " task-done" : ""}${t.type === "consolidation" ? " task-consolidation" : ""}`}>
              <button className="task-check"
                style={{ borderColor: p.color, background: t.done ? p.color : "transparent" }}
                onClick={() => toggle(t.id)} aria-label={t.done ? "Mark incomplete" : "Mark complete"}>
                {t.done && <span className="task-check-mark">✓</span>}
              </button>
              <span className="task-text">
                {t.type === "read-fa"
                  ? <button className="task-fa-link" onClick={() => openFA(t)} title="פתח את הפרק ב‑First Aid">
                      {t.text}<span className="task-fa-go"> →</span>
                    </button>
                  : t.text}
                {t.body && <span className="task-body-hint"> — {t.body}</span>}
              </span>
              {tm && <span className={`task-type-badge ${tm.cls}`}>{tm.label}</span>}
              <span className="task-dot" style={{ background: p.color }} title={p.label} />
              <button className="task-del" onClick={() => remove(t.id)} aria-label="Delete task">×</button>
            </li>
          );
        })}
      </ul>

      {doneCount > 0 && (
        <button className="task-clear" onClick={clearDone}>Clear {doneCount} completed</button>
      )}

      <div className="task-io">
        <button className="task-io-btn" onClick={handleExport}>↓ Export data</button>
        <button className="task-io-btn" onClick={() => importRef.current?.click()}>↑ Import data</button>
        <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
      </div>
      {importError && (
        <div className="task-import-error">⚠ {importError}</div>
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
      <path d="M32 28 C20 30 16 38 24 42 C32 46 36 52 28 56 C22 59 20 64 24 68" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M32 28 C44 30 48 38 40 42 C32 46 28 52 36 56 C42 59 44 64 40 68" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <circle cx="22" cy="70" r="3" fill="rgba(255,255,255,0.80)" />
      <circle cx="42" cy="70" r="3" fill="rgba(255,255,255,0.80)" />
    </svg>
  );
}

export default function WelcomeScreen({ onNav, testStats, faStats, streak, questions }) {
  const faPct     = faStats.total  > 0 ? Math.round((faStats.seen    / faStats.total)  * 100) : 0;
  const testPct   = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;
  const remaining = Math.max(0, testStats.missed - testStats.mastered);

  const [tasks, setTasks]       = useState(() => loadTasks());
  const [lightMode, setLightModeState] = useState(() => getLightMode().paused);
  const [showReset, setShowReset] = useState(false);
  const [importError, setImportError] = useState("");

  const insights = useMemo(() => {
    if (!questions?.length) return [];
    return computeInsights(questions, loadProgress());
  }, [questions]);

  const weakSubjects = useMemo(() => getWeakSubjects(3), [tasks]);
  const faSectionsRead = getFAIntakeCoverage();
  const masteredThisWeek = getMasteredThisWeek();

  function addInsightAsTask(ins) {
    if (tasks.some(t => t.insightId === ins.id)) return;
    const next = [...tasks, { id: Date.now(), text: ins.taskText, priority: ins.priority, done: false, createdAt: Date.now(), insightId: ins.id }];
    setTasks(next); saveTasks(next);
  }

  function toggleLightMode() {
    const next = !lightMode;
    setLightModeState(next);
    setLightMode(next);
  }

  function handleResetSchedule() {
    resetScheduleToDate(TEST_DATE);
    setShowReset(false);
    window.location.reload();
  }

  const dueDisplay = lightMode
    ? <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 700 }}>⏸</span>
    : <span className={`qs-num${testStats.due > 0 ? " qs-due" : ""}`}>{testStats.due}</span>;

  return (
    <div className="welcome">

      {/* ── Hero banner ── */}
      <div className="welcome-banner">
        <div className="welcome-logo"><CaduceusIcon /></div>
        <h1 className="welcome-title">USMLE Step 1</h1>
        <p className="welcome-sub">Personal review dashboard</p>
        {streak > 0 && <div className="streak-badge">🔥 {streak} day streak</div>}

        {/* Light mode toggle — Step 1 tool, keep in English */}
        <div className="lm-row">
          <button className={`lm-btn${lightMode ? " lm-on" : ""}`} onClick={toggleLightMode}
            title={lightMode ? "SR paused — click to resume" : "Pause SR counter (light mode)"}>
            {lightMode ? "⏸ SR paused" : "▶ SR active"}
          </button>
          <button className="lm-reset-btn" onClick={() => setShowReset(true)} title="Redistribute review schedule toward test date">
            ↺ Reset to test date
          </button>
        </div>
      </div>

      {showReset && (
        <div className="reset-confirm-overlay" onClick={() => setShowReset(false)}>
          <div className="reset-confirm" onClick={e => e.stopPropagation()}>
            <div className="reset-confirm-title">Reset schedule to Oct 11 2026?</div>
            <div className="reset-confirm-body">All review cards will be redistributed evenly between now and your test date. Mastered cards are untouched.</div>
            <div className="reset-confirm-btns">
              <button className="intake-back" onClick={() => setShowReset(false)}>Cancel</button>
              <button className="intake-save" onClick={handleResetSchedule}>Reset schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="welcome-body">

        {/* Floating stats bar */}
        <div className="quick-stats">
          <div className="qs-item">{dueDisplay}<span className="qs-label">Due today</span></div>
          <div className="qs-divider" />
          <div className="qs-item">
            <span className="qs-num">{testStats.mastered}</span>
            <span className="qs-label">Mastered{masteredThisWeek > 0 && <span className="qs-week-badge"> +{masteredThisWeek} this week</span>}</span>
          </div>
          <div className="qs-divider" />
          <div className="qs-item"><span className="qs-num">{remaining}</span><span className="qs-label">Remaining</span></div>
          <div className="qs-divider" />
          <div className="qs-item"><span className="qs-num">{faPct}%</span><span className="qs-label">FA coverage</span></div>
          {faSectionsRead > 0 && <>
            <div className="qs-divider" />
            <div className="qs-item"><span className="qs-num">{faSectionsRead}</span><span className="qs-label">FA sections read</span></div>
          </>}
        </div>

        {/* Weak subjects strip */}
        <WeakSubjectsStrip data={weakSubjects} />

        {/* ── 2-column main area ── */}
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
                  Review every missed question with spaced repetition. Mark complete → the intake wizard fills tasks, FA coverage, and the review schedule automatically.
                </p>
                <div className="wcard-stats">
                  <div className="wstat-block">
                    <span className="wstat-big">{testStats.missed}</span>
                    <span className="wstat-lbl">Missed</span>
                  </div>
                  <div className="wstat-block wstat-ok">
                    <span className="wstat-big">{testStats.mastered}</span>
                    <span className="wstat-lbl">Mastered</span>
                  </div>
                  {testStats.due > 0 && !lightMode && (
                    <div className="wstat-block wstat-warn">
                      <span className="wstat-big">{testStats.due}</span>
                      <span className="wstat-lbl">Due now</span>
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
                  Track your coverage across every First Aid section. Completing "Read FA" tasks marks sections automatically.
                </p>
                <div className="wcard-stats">
                  <div className="wstat-block">
                    <span className="wstat-big">{faStats.seen}</span>
                    <span className="wstat-lbl">Topics done</span>
                  </div>
                  <div className="wstat-block">
                    <span className="wstat-big">{faStats.total}</span>
                    <span className="wstat-lbl">Total topics</span>
                  </div>
                  <div className="wstat-block wstat-ok">
                    <span className="wstat-big">{faPct}%</span>
                    <span className="wstat-lbl">Covered</span>
                  </div>
                </div>
                <div className="wcard-prog">
                  <div className="wcard-prog-bar" style={{ width: `${faPct || 2}%` }} />
                </div>
                <span className="wcard-cta">Open tracker →</span>
              </div>
            </button>

          </div>

          <div className="welcome-right">
            <SmartInsights insights={insights} tasks={tasks} onAdd={addInsightAsTask} />
            <TaskManager tasks={tasks} setTasks={setTasks} />
          </div>
        </div>

        <p className="welcome-footer">100% offline · Progress saved in your browser · Oct 11 2026</p>
      </div>
    </div>
  );
}
