import { useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadMedSchool, saveMedSchool, patchSubject } from "../lib/medSchoolData.js";

const TABS = [
  { id: "review",    icon: "🔁", label: "Review"    },
  { id: "overview",  icon: "📊", label: "Overview"  },
  { id: "notes",     icon: "📝", label: "Notes"     },
  { id: "exams",     icon: "🏆", label: "Exams"     },
  { id: "syllabus",  icon: "📚", label: "Syllabus"  },
  { id: "materials", icon: "📁", label: "Materials" },
  { id: "tasks",     icon: "✅", label: "Tasks"     },
];

const MAT_TYPES = { pdf: "📄", link: "🔗", book: "📖", video: "🎬", other: "📎" };

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtShort(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function gradeColor(pct) {
  return pct >= 85 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
}

/* ── Study Notes Iframe Modal ── */
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function StudyNotesModal({ htmlFile, topicTitle, onClose }) {
  const src = `${BASE}/ent/${htmlFile}`;
  return (
    <div className="sn-overlay" onClick={onClose}>
      <div className="sn-modal" onClick={e => e.stopPropagation()}>
        <div className="sn-modal-hd">
          <span className="sn-modal-title">{topicTitle}</span>
          <button className="sn-close-btn" onClick={onClose}>✕ Close</button>
        </div>
        <iframe className="sn-iframe" src={src} title={topicTitle} />
      </div>
    </div>
  );
}

/* ── Review Tab ── */
const RATINGS = [
  { key: 0, emoji: "❌", label: "Blank",  sub: "No recall",   color: "#dc2626", bg: "#fef2f2", days: 1  },
  { key: 2, emoji: "😐", label: "Fuzzy",  sub: "Bits missing", color: "#f97316", bg: "#fff7ed", days: 2  },
  { key: 4, emoji: "✅", label: "Know it", sub: "Solid",        color: "#16a34a", bg: "#f0fdf4", days: 7  },
  { key: 5, emoji: "⭐", label: "Nailed",  sub: "Effortless",   color: "#4f46e5", bg: "#eef2ff", days: 14 },
];

const SECTION_COLORS = {
  "External Ear":        "#f97316",
  "Middle Ear":          "#eab308",
  "Hearing & Balance":   "#06b6d4",
  "Pharynx & Tonsils":   "#ec4899",
  "Larynx & Airway":     "#8b5cf6",
  "Nose & Sinuses":      "#10b981",
  "Head & Neck Oncology":"#ef4444",
};

function addDaysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function ReviewTab({ subject, update }) {
  const today    = new Date().toISOString().slice(0, 10);
  const syllabus = subject.syllabus || [];
  const rs       = subject.reviewState || {};
  const c        = subject.color || "#eab308";

  const [mode,        setMode]      = useState("dashboard");
  const [queue,       setQueue]     = useState([]);
  const [idx,         setIdx]       = useState(0);
  const [showNotes,   setShowNotes] = useState(false);
  const [editingNote, setEditNote]  = useState(false);
  const [noteDraft,   setNoteDraft] = useState("");
  const [fadeOut,     setFadeOut]   = useState(false);
  const [lastRating,  setLastRating] = useState(null);
  const [showHtml,    setShowHtml]  = useState(false);

  // ── Stats ──
  const stats = useMemo(() => {
    const mastered   = syllabus.filter(t => (rs[t.id]?.confidence || 0) >= 5).length;
    const confident  = syllabus.filter(t => { const cf = rs[t.id]?.confidence || 0; return cf >= 3 && cf < 5; }).length;
    const struggling = syllabus.filter(t => { const cf = rs[t.id]?.confidence || 0; return cf > 0 && cf < 3; }).length;
    const notStarted = syllabus.filter(t => !rs[t.id]).length;
    const due        = syllabus.filter(t => !rs[t.id] || rs[t.id].nextReview <= today).length;
    const masteredPct = syllabus.length > 0 ? Math.round((mastered / syllabus.length) * 100) : 0;
    return { mastered, confident, struggling, notStarted, due, total: syllabus.length, masteredPct };
  }, [syllabus, rs, today]);

  const sections = useMemo(() => {
    const m = {};
    syllabus.forEach(t => {
      const sec = t.section || "General";
      if (!m[sec]) m[sec] = { total: 0, mastered: 0, known: 0, due: 0 };
      m[sec].total++;
      const r = rs[t.id];
      if (r?.confidence >= 5) m[sec].mastered++;
      if (r?.confidence >= 3) m[sec].known++;
      if (!r || r.nextReview <= today) m[sec].due++;
    });
    return Object.entries(m).map(([name, v]) => ({
      name, ...v,
      color: SECTION_COLORS[name] || c,
      pct: v.total > 0 ? Math.round((v.mastered / v.total) * 100) : 0,
    }));
  }, [syllabus, rs, today, c]);

  function startSession(all = false) {
    const pool = all
      ? [...syllabus]
      : syllabus.filter(t => !rs[t.id] || rs[t.id].nextReview <= today);
    // Sort: not started first, then lowest confidence, then shuffle within
    const sorted = [...pool].sort((a, b) => {
      const ca = rs[a.id]?.confidence ?? -1;
      const cb = rs[b.id]?.confidence ?? -1;
      if (ca !== cb) return ca - cb;
      return Math.random() - 0.5;
    });
    setQueue(sorted);
    setIdx(0);
    setShowNotes(false);
    setEditNote(false);
    setLastRating(null);
    setFadeOut(false);
    setMode("session");
  }

  function rate(rating) {
    const topic = queue[idx];
    if (!topic || fadeOut) return;
    setLastRating(rating.key);
    setFadeOut(true);
    const newRs = {
      ...rs,
      [topic.id]: {
        confidence:  rating.key,
        lastReview:  today,
        nextReview:  addDaysFromToday(rating.days),
        reviewCount: (rs[topic.id]?.reviewCount || 0) + 1,
      },
    };
    let newSyl = syllabus;
    if (rating.key >= 5) {
      newSyl = syllabus.map(t => t.id === topic.id ? { ...t, done: true } : t);
    }
    update({ reviewState: newRs, syllabus: newSyl });
    setTimeout(() => {
      setFadeOut(false);
      setLastRating(null);
      setShowNotes(false);
      setEditNote(false);
      setShowHtml(false);
      if (idx + 1 >= queue.length) setMode("complete");
      else setIdx(i => i + 1);
    }, 400);
  }

  function saveTopicNote(topicId, text) {
    update({ syllabus: syllabus.map(t => t.id === topicId ? { ...t, notes: text } : t) });
  }

  // ── Dashboard ──
  if (mode === "dashboard") {
    return (
      <div className="rv-dash">
        {/* Hero stats */}
        <div className="rv-hero" style={{ "--c": c }}>
          <div className="rv-hero-left">
            <div className="rv-hero-num" style={{ color: stats.masteredPct >= 80 ? "#16a34a" : stats.masteredPct >= 50 ? "#d97706" : c }}>
              {stats.masteredPct}%
            </div>
            <div className="rv-hero-lbl">Mastered</div>
          </div>
          <div className="rv-hero-grid">
            <div className="rv-kpi"><span className="rv-kpi-val" style={{ color: stats.due > 0 ? "#ef4444" : "#16a34a" }}>{stats.due}</span><span className="rv-kpi-lbl">Due Today</span></div>
            <div className="rv-kpi"><span className="rv-kpi-val">{stats.mastered}</span><span className="rv-kpi-lbl">Mastered</span></div>
            <div className="rv-kpi"><span className="rv-kpi-val">{stats.confident}</span><span className="rv-kpi-lbl">Know It</span></div>
            <div className="rv-kpi"><span className="rv-kpi-val">{stats.struggling}</span><span className="rv-kpi-lbl">Struggling</span></div>
            <div className="rv-kpi"><span className="rv-kpi-val">{stats.notStarted}</span><span className="rv-kpi-lbl">Not Started</span></div>
          </div>
          <div className="rv-hero-bar-wrap">
            <div className="rv-hero-bar">
              <div className="rv-bar-mastered" style={{ width: `${(stats.mastered / stats.total) * 100}%` }} />
              <div className="rv-bar-known"    style={{ width: `${(stats.confident / stats.total) * 100}%` }} />
              <div className="rv-bar-struggling" style={{ width: `${(stats.struggling / stats.total) * 100}%` }} />
            </div>
            <div className="rv-bar-legend">
              <span><span style={{ color: "#4f46e5" }}>■</span> Mastered</span>
              <span><span style={{ color: "#16a34a" }}>■</span> Know it</span>
              <span><span style={{ color: "#f97316" }}>■</span> Struggling</span>
              <span><span style={{ color: "#e5e7eb" }}>■</span> Not started</span>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="rv-cta-row">
          {stats.due > 0 ? (
            <button className="rv-start-btn" style={{ background: c }} onClick={() => startSession(false)}>
              ▶ Study Due ({stats.due} topics)
            </button>
          ) : (
            <div className="rv-all-done">✓ All caught up! Next review scheduled.</div>
          )}
          <button className="rv-start-btn rv-start-ghost" onClick={() => startSession(true)}>
            Study All ({stats.total})
          </button>
        </div>

        {/* Section table */}
        <div className="rv-sec-table">
          <div className="rv-sec-table-hd">
            <span>Section</span>
            <span>Progress</span>
            <span>Due</span>
            <span>Mastered</span>
          </div>
          {sections.map(sec => (
            <div key={sec.name} className="rv-sec-row">
              <div className="rv-sec-name-cell">
                <div className="rv-sec-dot" style={{ background: sec.color }} />
                <span className="rv-sec-name-txt">{sec.name}</span>
                <span className="rv-sec-total">({sec.total})</span>
              </div>
              <div className="rv-sec-bar-cell">
                <div className="rv-sec-bar">
                  <div className="rv-sec-fill" style={{ width: `${(sec.known / sec.total) * 100}%`, background: sec.color + "66" }} />
                  <div className="rv-sec-fill rv-sec-fill-master" style={{ width: `${(sec.mastered / sec.total) * 100}%`, background: sec.color }} />
                </div>
                <span className="rv-sec-pct">{sec.known}/{sec.total}</span>
              </div>
              <span className={`rv-sec-due${sec.due > 0 ? " hot" : ""}`}>{sec.due > 0 ? sec.due : "—"}</span>
              <span className="rv-sec-master">{sec.mastered > 0 ? `${sec.mastered} ⭐` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Session ──
  if (mode === "session") {
    const topic = queue[idx];
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (!topic) { setMode("complete"); return null; }
    const prevRs   = rs[topic.id];
    const secColor = SECTION_COLORS[topic.section] || c;
    const progPct  = Math.round(((idx) / queue.length) * 100);

    return (
      <>
      <div className={`rv-session${fadeOut ? " rv-fade-out" : ""}`}>
        {/* Session header */}
        <div className="rv-sess-hd">
          <button className="rv-exit-btn" onClick={() => setMode("dashboard")}>← Exit</button>
          <div className="rv-sess-prog">
            <div className="rv-sess-bar"><div className="rv-sess-fill" style={{ width: `${progPct}%`, background: c }} /></div>
            <span className="rv-sess-count">{idx}/{queue.length}</span>
          </div>
          <span className="rv-sect-badge" style={{ background: secColor + "22", color: secColor }}>
            {topic.section}
          </span>
        </div>

        {/* Topic card */}
        <div className="rv-topic-card">
          {topic.num && <div className="rv-topic-num">Topic #{topic.num}</div>}
          <div className="rv-topic-title">{topic.topic}</div>
          {prevRs && (
            <div className="rv-topic-prev">
              {prevRs.confidence >= 5 ? "⭐ Previously: Mastered" :
               prevRs.confidence >= 4 ? "✅ Previously: Know it" :
               prevRs.confidence >= 2 ? "😐 Previously: Fuzzy" : "❌ Previously: Blank"}
              {" · "}{prevRs.reviewCount}× reviewed
            </div>
          )}

          {/* Open interactive HTML study notes */}
          {topic.htmlFile && (
            <button className="rv-open-html-btn" style={{ "--c": secColor }}
              onClick={() => setShowHtml(true)}>
              📖 Open Study Notes
            </button>
          )}

          {/* Notes area */}
          <div className="rv-notes-area">
            {editingNote ? (
              <div className="rv-note-edit">
                <textarea className="rv-note-textarea" value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  placeholder="Write key points, mnemonics, or notes for this topic…"
                  autoFocus rows={4} />
                <div className="rv-note-edit-btns">
                  <button className="rv-note-cancel" onClick={() => { setEditNote(false); setShowNotes(!!topic.notes); }}>Cancel</button>
                  <button className="rv-note-save" style={{ background: c }} onClick={() => { saveTopicNote(topic.id, noteDraft); setEditNote(false); setShowNotes(true); }}>Save Notes</button>
                </div>
              </div>
            ) : topic.notes && showNotes ? (
              <div className="rv-note-view">
                <div className="rv-note-text">{topic.notes}</div>
                <button className="rv-note-edit-btn" onClick={() => { setNoteDraft(topic.notes); setEditNote(true); }}>✏ Edit</button>
              </div>
            ) : (
              <div className="rv-note-toggle-row">
                {topic.notes
                  ? <button className="rv-show-notes-btn" onClick={() => setShowNotes(true)}>📝 Show my notes</button>
                  : <button className="rv-show-notes-btn rv-add-note-btn" onClick={() => { setNoteDraft(""); setEditNote(true); }}>+ Add notes for this topic</button>
                }
              </div>
            )}
          </div>
        </div>

        {/* Rating prompt */}
        <div className="rv-rate-prompt">How well did you recall this topic?</div>

        {/* Rating buttons */}
        <div className="rv-ratings">
          {RATINGS.map(r => (
            <button key={r.key} className={`rv-rate-btn${lastRating === r.key ? " selected" : ""}`}
              style={{ "--rb": r.color, "--rbb": r.bg }}
              onClick={() => rate(r)}>
              <span className="rv-rate-emoji">{r.emoji}</span>
              <span className="rv-rate-label">{r.label}</span>
              <span className="rv-rate-sub">{r.sub}</span>
              <span className="rv-rate-interval">+{r.days}d</span>
            </button>
          ))}
        </div>
      </div>
      {showHtml && topic.htmlFile && (
        <StudyNotesModal
          htmlFile={topic.htmlFile}
          topicTitle={`#${topic.num} — ${topic.topic}`}
          onClose={() => setShowHtml(false)}
        />
      )}
      </>
    );
  }

  // ── Complete ──
  const reviewed    = queue.length;
  const nowMastered = queue.filter(t => rs[t.id]?.confidence >= 5).length;
  const nextDue     = Object.values({ ...rs })
    .map(r => r.nextReview).filter(Boolean).sort()[0];

  return (
    <div className="rv-complete">
      <div className="rv-complete-icon">🎉</div>
      <h2 className="rv-complete-title">Session Complete!</h2>
      <div className="rv-complete-stats">
        <div className="rv-cs"><span className="rv-cs-val">{reviewed}</span><span className="rv-cs-lbl">Reviewed</span></div>
        <div className="rv-cs"><span className="rv-cs-val" style={{ color: "#4f46e5" }}>{nowMastered}</span><span className="rv-cs-lbl">Mastered</span></div>
        <div className="rv-cs"><span className="rv-cs-val">{stats.mastered}</span><span className="rv-cs-lbl">Total ⭐</span></div>
      </div>
      {nextDue && <p className="rv-next-due">Next review: <strong>{nextDue}</strong></p>}
      <button className="rv-start-btn" style={{ background: c }} onClick={() => setMode("dashboard")}>Back to Dashboard</button>
    </div>
  );
}

/* ── Overview Tab ── */
function OverviewTab({ subject, setTab }) {
  const exams       = subject.exams || [];
  const syllabus    = subject.syllabus || [];
  const scored      = exams.filter(e => e.score != null && e.maxScore);
  const avgGrade    = scored.length > 0
    ? Math.round(scored.reduce((a, e) => a + (e.score / e.maxScore) * 100, 0) / scored.length) : null;
  const done        = syllabus.filter(t => t.done).length;
  const sylPct      = syllabus.length > 0 ? Math.round((done / syllabus.length) * 100) : 0;
  const today       = new Date().toISOString().slice(0, 10);
  const nextExam    = exams.filter(e => e.date >= today && e.score == null).sort((a, b) => a.date.localeCompare(b.date))[0];
  const daysToExam  = nextExam ? Math.ceil((new Date(nextExam.date + "T12:00:00Z") - new Date()) / 86400000) : null;
  const pendingTasks = (subject.tasks || []).filter(t => !t.done);
  const overdueTasks = pendingTasks.filter(t => t.deadline && t.deadline < today);
  const c = subject.color || "#4f46e5";

  const sections = useMemo(() => {
    const m = {};
    syllabus.forEach(t => { const k = t.section || "General"; (m[k] = m[k] || { total: 0, done: 0 }).total++; if (t.done) m[k].done++; });
    return Object.entries(m).map(([name, v]) => ({ name, ...v, pct: Math.round((v.done / v.total) * 100) }));
  }, [syllabus]);

  return (
    <div className="ms-overview">
      {/* KPI cards */}
      <div className="ms-kpi-row">
        <div className="ms-kpi-card" onClick={() => setTab("exams")} style={{ cursor: "pointer" }}>
          <div className="ms-kpi-val" style={{ color: avgGrade != null ? gradeColor(avgGrade) : "var(--muted)" }}>
            {avgGrade != null ? `${avgGrade}%` : "—"}
          </div>
          <div className="ms-kpi-lbl">Avg Grade</div>
          {subject.gradeTarget && avgGrade != null && (
            <div className="ms-kpi-target" style={{ color: avgGrade >= subject.gradeTarget ? "#16a34a" : "#ef4444" }}>
              Target: {subject.gradeTarget}% {avgGrade >= subject.gradeTarget ? "✓" : "↑"}
            </div>
          )}
        </div>
        <div className="ms-kpi-card" onClick={() => setTab("syllabus")} style={{ cursor: "pointer" }}>
          <div className="ms-kpi-val" style={{ color: c }}>{sylPct}%</div>
          <div className="ms-kpi-lbl">Syllabus Done</div>
          <div className="ms-kpi-target">{done}/{syllabus.length} topics</div>
        </div>
        <div className="ms-kpi-card" onClick={() => setTab("materials")} style={{ cursor: "pointer" }}>
          <div className="ms-kpi-val">{(subject.materials || []).length}</div>
          <div className="ms-kpi-lbl">Materials</div>
        </div>
        <div className="ms-kpi-card" onClick={() => setTab("tasks")} style={{ cursor: "pointer" }}>
          <div className="ms-kpi-val" style={{ color: overdueTasks.length > 0 ? "#ef4444" : "var(--text)" }}>
            {pendingTasks.length}
          </div>
          <div className="ms-kpi-lbl">Pending Tasks</div>
          {overdueTasks.length > 0 && <div className="ms-kpi-target" style={{ color: "#ef4444" }}>⚠ {overdueTasks.length} overdue</div>}
        </div>
      </div>

      <div className="ms-overview-grid">
        {/* Syllabus sections */}
        <div className="ms-overview-card">
          <div className="ms-overview-card-hd">
            <span>📚 Syllabus by Section</span>
            <button className="ms-link-btn" onClick={() => setTab("syllabus")}>View all →</button>
          </div>
          {sections.length === 0
            ? <p className="ms-empty-state">No syllabus items yet.</p>
            : sections.map(sec => (
              <div key={sec.name} className="ms-sec-row">
                <div className="ms-sec-row-top">
                  <span className="ms-sec-name">{sec.name}</span>
                  <span className="ms-sec-pct" style={{ color: gradeColor(sec.pct) }}>{sec.pct}%</span>
                </div>
                <div className="ms-sec-bar">
                  <div className="ms-sec-fill" style={{ width: `${sec.pct}%`, background: c }} />
                </div>
                <span className="ms-sec-count">{sec.done}/{sec.total}</span>
              </div>
            ))
          }
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Upcoming exam */}
          {nextExam && (
            <div className="ms-next-exam-card" style={{ "--c": c }}>
              <div className="ms-next-exam-hd">📅 Next Exam</div>
              <div className="ms-next-exam-name">{nextExam.name}</div>
              <div className="ms-next-exam-date">{fmtDate(nextExam.date)}</div>
              <div className="ms-next-exam-countdown" style={{ color: daysToExam <= 3 ? "#ef4444" : daysToExam <= 7 ? "#f97316" : c }}>
                {daysToExam === 0 ? "🔴 TODAY!" : daysToExam === 1 ? "🟡 Tomorrow" : `${daysToExam} days away`}
              </div>
            </div>
          )}

          {/* Notes preview */}
          <div className="ms-overview-card">
            <div className="ms-overview-card-hd">
              <span>📝 Notes Preview</span>
              <button className="ms-link-btn" onClick={() => setTab("notes")}>Edit →</button>
            </div>
            {subject.notes
              ? <div className="ms-notes-preview">
                  {subject.notes.slice(0, 280)}{subject.notes.length > 280 ? "…" : ""}
                </div>
              : <p className="ms-empty-state">No notes yet. <button className="ms-link-btn" onClick={() => setTab("notes")}>Start writing →</button></p>
            }
          </div>

          {/* Grade history */}
          {scored.length > 0 && (
            <div className="ms-overview-card">
              <div className="ms-overview-card-hd">
                <span>🏆 Exam Grades</span>
                <button className="ms-link-btn" onClick={() => setTab("exams")}>View all →</button>
              </div>
              {scored.map(e => {
                const pct = Math.round((e.score / e.maxScore) * 100);
                return (
                  <div key={e.id} className="ms-mini-grade-row">
                    <span className="ms-mini-grade-name">{e.name}</span>
                    <div className="ms-mini-grade-bar">
                      <div className="ms-mini-grade-fill" style={{ width: `${pct}%`, background: gradeColor(pct) }} />
                    </div>
                    <span className="ms-mini-grade-pct" style={{ color: gradeColor(pct) }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Notes Tab ── */
function NotesTab({ subject, update }) {
  const [editing, setEditing] = useState(!subject.notes);
  const [draft, setDraft]     = useState(subject.notes || "");
  const [saved, setSaved]     = useState(true);
  const timer                 = useRef(null);

  function onChange(val) {
    setDraft(val);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { update({ notes: val }); setSaved(true); }, 900);
  }

  function saveNow() {
    clearTimeout(timer.current);
    update({ notes: draft });
    setSaved(true);
    setEditing(false);
  }

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="ms-notes2">
      <div className="ms-notes2-toolbar">
        <div className="ms-notes2-meta">
          <span className="ms-notes2-wc">{wordCount} words</span>
          <span className={`ms-notes2-saved${saved ? " saved" : ""}`}>{saved ? "✓ Saved" : "Saving…"}</span>
        </div>
        {editing
          ? <button className="ms-btn ms-btn-primary" onClick={saveNow}>Done</button>
          : <button className="ms-btn ms-btn-ghost" onClick={() => { setEditing(true); setSaved(true); }}>Edit</button>}
      </div>
      {editing ? (
        <textarea className="ms-notes2-editor" value={draft} onChange={e => onChange(e.target.value)}
          placeholder={"Write your study notes here...\n\nOrganize by section, add mnemonics, paste key facts — anything you need to review.\n\nTip: Keep it scannable. Short bullets beat long paragraphs for recall."}
          autoFocus />
      ) : (
        <div className="ms-notes2-view" onClick={() => setEditing(true)}>
          {subject.notes
            ? subject.notes.split("\n").map((line, i) =>
                line
                  ? <p key={i} className={line.startsWith("#") ? "ms-note-heading" : line.startsWith("-") ? "ms-note-bullet" : "ms-note-para"}>{line}</p>
                  : <div key={i} style={{ height: 6 }} />
              )
            : <div className="ms-notes2-empty">No notes yet. Click to start writing.</div>}
        </div>
      )}
    </div>
  );
}

/* ── Exams Tab ── */
function ExamsTab({ subject, update }) {
  const empty   = { name: "", date: "", score: "", maxScore: "100", notes: "" };
  const [form, setForm]   = useState(empty);
  const [adding, setAdd]  = useState(false);
  const upd = (k, v)      => setForm(f => ({ ...f, [k]: v }));
  const exams             = subject.exams || [];
  const scored            = exams.filter(e => e.score != null && e.maxScore);
  const avg               = scored.length > 0
    ? Math.round(scored.reduce((a, e) => a + (e.score / e.maxScore) * 100, 0) / scored.length) : null;

  function add() {
    if (!form.name.trim()) return;
    update({ exams: [...exams, { ...form, id: Date.now(), score: form.score !== "" ? Number(form.score) : null, maxScore: form.maxScore !== "" ? Number(form.maxScore) : null }] });
    setForm(empty); setAdd(false);
  }
  function remove(id) { update({ exams: exams.filter(e => e.id !== id) }); }

  return (
    <div className="ms-list-tab2">
      <div className="ms-list-toolbar2">
        <div>
          <span className="ms-list-title2">Exams ({exams.length})</span>
          {avg != null && (
            <span className="ms-avg-badge" style={{ color: gradeColor(avg), background: gradeColor(avg) + "18" }}>
              Average: {avg}%
            </span>
          )}
        </div>
        <button className="ms-btn ms-btn-primary" onClick={() => setAdd(true)}>+ Add Exam</button>
      </div>

      {adding && (
        <div className="ms-form-card2">
          <div className="ms-form-grid2">
            <label className="ms-form-lbl">Name *</label>
            <input className="ms-inp2" value={form.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. Oral Final" autoFocus />
            <label className="ms-form-lbl">Date</label>
            <input className="ms-inp2" type="date" value={form.date} onChange={e => upd("date", e.target.value)} />
            <label className="ms-form-lbl">Score</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="ms-inp2" type="number" style={{ flex: 1 }} value={form.score} onChange={e => upd("score", e.target.value)} placeholder="e.g. 87" />
              <span style={{ color: "var(--muted)", fontWeight: 700 }}>/</span>
              <input className="ms-inp2" type="number" style={{ flex: 1 }} value={form.maxScore} onChange={e => upd("maxScore", e.target.value)} />
            </div>
            <label className="ms-form-lbl">Notes</label>
            <textarea className="ms-inp2 ms-ta2" rows={2} value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder="Optional notes about this exam" />
          </div>
          <div className="ms-form-row-btns">
            <button className="ms-btn ms-btn-ghost" onClick={() => { setAdd(false); setForm(empty); }}>Cancel</button>
            <button className="ms-btn ms-btn-primary" onClick={add}>Save Exam</button>
          </div>
        </div>
      )}

      {exams.length === 0 && !adding && <div className="ms-empty-state">No exams logged yet.</div>}

      <div className="ms-exam-list2">
        {exams.map(e => {
          const pct      = e.score != null && e.maxScore ? Math.round((e.score / e.maxScore) * 100) : null;
          const today    = new Date().toISOString().slice(0, 10);
          const upcoming = !pct && e.date && e.date >= today;
          const days     = upcoming ? Math.ceil((new Date(e.date + "T12:00:00Z") - new Date()) / 86400000) : null;
          return (
            <div key={e.id} className={`ms-exam-item2${upcoming ? " ms-exam-upcoming" : ""}`}>
              <div className="ms-exam-left2">
                <div className="ms-exam-name2">{e.name}</div>
                {e.date && <div className="ms-exam-date2">{fmtDate(e.date)}</div>}
                {e.notes && <div className="ms-exam-note2">{e.notes}</div>}
              </div>
              <div className="ms-exam-right2">
                {pct != null && (
                  <>
                    <span className="ms-exam-pct2" style={{ color: gradeColor(pct) }}>{pct}%</span>
                    <span className="ms-exam-raw2">{e.score}/{e.maxScore}</span>
                    <div className="ms-exam-bar2">
                      <div className="ms-exam-bar-fill2" style={{ width: `${pct}%`, background: gradeColor(pct) }} />
                    </div>
                  </>
                )}
                {upcoming && (
                  <span className="ms-exam-upcoming-chip">
                    {days === 0 ? "TODAY" : days === 1 ? "Tomorrow" : `${days}d`}
                  </span>
                )}
                <button className="ms-remove-btn2" onClick={() => remove(e.id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Confidence helpers (shared with Review tab) ── */
function confMeta(conf) {
  if (conf == null)  return { emoji: "·",  label: "Not started", color: "#94a3b8", bg: "#f1f5f9" };
  if (conf >= 5)     return { emoji: "⭐", label: "Mastered",    color: "#4f46e5", bg: "#eef2ff" };
  if (conf >= 4)     return { emoji: "✅", label: "Know it",      color: "#16a34a", bg: "#f0fdf4" };
  if (conf >= 2)     return { emoji: "😐", label: "Fuzzy",        color: "#f97316", bg: "#fff7ed" };
  return                    { emoji: "❌", label: "Blank",        color: "#dc2626", bg: "#fef2f2" };
}

/* Inline rating pills used in the syllabus list */
function InlineRater({ current, onRate }) {
  return (
    <div className="ms-inline-rate" onClick={e => e.stopPropagation()}>
      {RATINGS.map(r => (
        <button key={r.key}
          className={`ms-ir-btn${current === r.key ? " active" : ""}`}
          style={{ "--rb": r.color, "--rbb": r.bg }}
          title={`${r.label} · review +${r.days}d`}
          onClick={() => onRate(r)}>
          {r.emoji}
        </button>
      ))}
    </div>
  );
}

/* ── Syllabus Tab ── */
function SyllabusTab({ subject, update }) {
  const [htmlModal, setHtmlModal] = useState(null); // { htmlFile, title }
  const [newTopic,   setNewTopic]   = useState("");
  const [newSection, setNewSection] = useState("");
  const [sectionFilter, setSF]      = useState("all");
  const [statusFilter,  setStF]     = useState("all"); // all | due | weak | mastered | unrated
  const syllabus = subject.syllabus || [];
  const rs       = subject.reviewState || {};
  const today    = new Date().toISOString().slice(0, 10);
  const c        = subject.color || "#4f46e5";

  // ── Stats ──
  const stats = useMemo(() => {
    const total      = syllabus.length;
    const mastered   = syllabus.filter(t => (rs[t.id]?.confidence ?? -1) >= 5).length;
    const known      = syllabus.filter(t => { const cf = rs[t.id]?.confidence ?? -1; return cf >= 3 && cf < 5; }).length;
    const weak       = syllabus.filter(t => { const cf = rs[t.id]?.confidence ?? -1; return cf >= 0 && cf < 3; }).length;
    const unrated    = syllabus.filter(t => !rs[t.id]).length;
    const due        = syllabus.filter(t => rs[t.id] && rs[t.id].nextReview <= today).length;
    const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, known, weak, unrated, due, masteredPct };
  }, [syllabus, rs, today]);

  function add() {
    if (!newTopic.trim()) return;
    update({ syllabus: [...syllabus, { id: Date.now(), topic: newTopic.trim(), section: newSection.trim(), done: false, notes: "" }] });
    setNewTopic("");
  }
  function remove(id) { update({ syllabus: syllabus.filter(t => t.id !== id) }); }

  function rateTopic(id, rating) {
    const newRs = {
      ...rs,
      [id]: {
        confidence:  rating.key,
        lastReview:  today,
        nextReview:  addDaysFromToday(rating.days),
        reviewCount: (rs[id]?.reviewCount || 0) + 1,
      },
    };
    const newSyl = syllabus.map(t => t.id === id ? { ...t, done: rating.key >= 5 } : t);
    update({ reviewState: newRs, syllabus: newSyl });
  }

  function matchStatus(t) {
    const cf = rs[t.id]?.confidence ?? -1;
    if (statusFilter === "all")      return true;
    if (statusFilter === "due")      return rs[t.id] && rs[t.id].nextReview <= today;
    if (statusFilter === "weak")     return cf >= 0 && cf < 3;
    if (statusFilter === "mastered") return cf >= 5;
    if (statusFilter === "unrated")  return !rs[t.id];
    return true;
  }

  const sections = [...new Set(syllabus.map(t => t.section || "General"))];
  const visibleSecs = sectionFilter === "all" ? sections : [sectionFilter];

  return (
    <>
    <div className="ms-list-tab2">
      {/* ── Mini dashboard ── */}
      {syllabus.length > 0 && (
        <div className="ms-syl-dash" style={{ "--c": c }}>
          <div className="ms-syl-dash-hero">
            <div className="ms-syl-dash-pct" style={{ color: stats.masteredPct >= 80 ? "#16a34a" : stats.masteredPct >= 50 ? "#d97706" : c }}>
              {stats.masteredPct}%
            </div>
            <div className="ms-syl-dash-pct-lbl">Mastered</div>
          </div>
          <div className="ms-syl-dash-tiles">
            <button className={`ms-syl-dtile${statusFilter === "due" ? " active" : ""}`} onClick={() => setStF(statusFilter === "due" ? "all" : "due")}>
              <span className="ms-syl-dtile-val" style={{ color: stats.due > 0 ? "#ef4444" : "var(--muted)" }}>{stats.due}</span>
              <span className="ms-syl-dtile-lbl">Due</span>
            </button>
            <button className={`ms-syl-dtile${statusFilter === "mastered" ? " active" : ""}`} onClick={() => setStF(statusFilter === "mastered" ? "all" : "mastered")}>
              <span className="ms-syl-dtile-val" style={{ color: "#4f46e5" }}>{stats.mastered}</span>
              <span className="ms-syl-dtile-lbl">⭐ Mastered</span>
            </button>
            <div className="ms-syl-dtile ms-syl-dtile-static">
              <span className="ms-syl-dtile-val" style={{ color: "#16a34a" }}>{stats.known}</span>
              <span className="ms-syl-dtile-lbl">✅ Know it</span>
            </div>
            <button className={`ms-syl-dtile${statusFilter === "weak" ? " active" : ""}`} onClick={() => setStF(statusFilter === "weak" ? "all" : "weak")}>
              <span className="ms-syl-dtile-val" style={{ color: "#f97316" }}>{stats.weak}</span>
              <span className="ms-syl-dtile-lbl">Weak</span>
            </button>
            <button className={`ms-syl-dtile${statusFilter === "unrated" ? " active" : ""}`} onClick={() => setStF(statusFilter === "unrated" ? "all" : "unrated")}>
              <span className="ms-syl-dtile-val" style={{ color: "var(--muted)" }}>{stats.unrated}</span>
              <span className="ms-syl-dtile-lbl">Not started</span>
            </button>
          </div>
          <div className="ms-syl-dash-bar-col">
            <div className="ms-syl-dash-bar">
              <div style={{ width: `${(stats.mastered / stats.total) * 100}%`, background: "#4f46e5" }} />
              <div style={{ width: `${(stats.known / stats.total) * 100}%`, background: "#16a34a" }} />
              <div style={{ width: `${(stats.weak / stats.total) * 100}%`, background: "#f97316" }} />
            </div>
          </div>
        </div>
      )}

      {/* Section + status filters */}
      <div className="ms-syl-filter-row">
        {sections.length > 1 && (
          <div className="ms-sec-filter">
            <button className={`ms-sec-chip${sectionFilter === "all" ? " active" : ""}`} onClick={() => setSF("all")}>All sections</button>
            {sections.map(s => (
              <button key={s} className={`ms-sec-chip${sectionFilter === s ? " active" : ""}`} onClick={() => setSF(s)}>{s}</button>
            ))}
          </div>
        )}
        {statusFilter !== "all" && (
          <button className="ms-clear-filter" onClick={() => setStF("all")}>
            Showing: {statusFilter} ✕
          </button>
        )}
      </div>

      {/* Add row */}
      <div className="ms-add-row2">
        {sections.length > 0 && (
          <select className="ms-inp2 ms-sel2" value={newSection} onChange={e => setNewSection(e.target.value)} style={{ flex: "0 0 150px" }}>
            <option value="">New section…</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <input className="ms-inp2" value={newTopic} onChange={e => setNewTopic(e.target.value)}
          placeholder="Add topic…" onKeyDown={e => e.key === "Enter" && add()} style={{ flex: 1 }} />
        <button className="ms-btn ms-btn-primary" onClick={add}>Add</button>
      </div>

      {syllabus.length === 0 && <div className="ms-empty-state">No syllabus topics yet.</div>}

      {visibleSecs.map(sec => {
        const allItems = syllabus.filter(t => (t.section || "General") === sec);
        const items    = allItems.filter(matchStatus);
        if (items.length === 0) return null;
        const secMastered = allItems.filter(t => (rs[t.id]?.confidence ?? -1) >= 5).length;
        const secPct      = Math.round((secMastered / allItems.length) * 100);
        return (
          <div key={sec} className="ms-syl-sec2">
            <div className="ms-syl-sec-hd ms-syl-sec-hd-static">
              <div className="ms-syl-sec-left">
                <div className="ms-syl-sec-dot" style={{ background: c }} />
                <span className="ms-syl-sec-name">{sec}</span>
                <span className="ms-syl-sec-count">{secMastered}/{allItems.length} mastered</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: gradeColor(secPct) }}>{secPct}%</span>
            </div>
            <div className="ms-syl-items2">
              {items.map(t => {
                const conf = rs[t.id]?.confidence;
                const cm   = confMeta(conf);
                const isDue = rs[t.id] && rs[t.id].nextReview <= today;
                return (
                  <div key={t.id} className="ms-syl-item3">
                    <span className="ms-conf-dot" style={{ background: cm.bg, color: cm.color, borderColor: cm.color + "55" }} title={cm.label}>
                      {cm.emoji}
                    </span>
                    <span className="ms-syl-topic3">
                      {t.num ? <span className="ms-syl-num">#{t.num}</span> : null}
                      {t.topic}
                      {isDue && <span className="ms-due-tag">due</span>}
                    </span>
                    <InlineRater current={conf} onRate={r => rateTopic(t.id, r)} />
                    {t.htmlFile && (
                      <button className="ms-syl-html-btn" title="Open study notes"
                        onClick={e => { e.stopPropagation(); setHtmlModal({ htmlFile: t.htmlFile, title: `#${t.num} — ${t.topic}` }); }}>
                        📖
                      </button>
                    )}
                    <button className="ms-syl-del" onClick={() => remove(t.id)}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    {htmlModal && (
      <StudyNotesModal
        htmlFile={htmlModal.htmlFile}
        topicTitle={htmlModal.title}
        onClose={() => setHtmlModal(null)}
      />
    )}
    </>
  );
}

/* ── Materials Tab ── */
function MaterialsTab({ subject, update }) {
  const empty   = { title: "", type: "link", url: "", notes: "" };
  const [form, setForm] = useState(empty);
  const [adding, setAdd] = useState(false);
  const upd    = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const mats   = subject.materials || [];

  function add() {
    if (!form.title.trim()) return;
    update({ materials: [...mats, { ...form, id: Date.now() }] });
    setForm(empty); setAdd(false);
  }
  function remove(id) { update({ materials: mats.filter(m => m.id !== id) }); }

  const byType = useMemo(() => {
    const m = {};
    mats.forEach(mat => { const k = mat.type || "other"; (m[k] = m[k] || []).push(mat); });
    return m;
  }, [mats]);

  return (
    <div className="ms-list-tab2">
      <div className="ms-list-toolbar2">
        <span className="ms-list-title2">Materials ({mats.length})</span>
        <button className="ms-btn ms-btn-primary" onClick={() => setAdd(true)}>+ Add</button>
      </div>

      {adding && (
        <div className="ms-form-card2">
          <div className="ms-form-grid2">
            <label className="ms-form-lbl">Title *</label>
            <input className="ms-inp2" value={form.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Lecture slides" autoFocus />
            <label className="ms-form-lbl">Type</label>
            <select className="ms-inp2" value={form.type} onChange={e => upd("type", e.target.value)}>
              {Object.entries(MAT_TYPES).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
            <label className="ms-form-lbl">URL / Path</label>
            <input className="ms-inp2" value={form.url} onChange={e => upd("url", e.target.value)} placeholder="https://..." />
            <label className="ms-form-lbl">Notes</label>
            <textarea className="ms-inp2 ms-ta2" rows={2} value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="ms-form-row-btns">
            <button className="ms-btn ms-btn-ghost" onClick={() => { setAdd(false); setForm(empty); }}>Cancel</button>
            <button className="ms-btn ms-btn-primary" onClick={add}>Save</button>
          </div>
        </div>
      )}

      {mats.length === 0 && !adding && <div className="ms-empty-state">No materials added yet.</div>}

      {Object.entries(byType).map(([type, items]) => (
        <div key={type} className="ms-mat-section">
          <div className="ms-mat-sec-hd">{MAT_TYPES[type] || "📎"} {type.charAt(0).toUpperCase() + type.slice(1)} ({items.length})</div>
          <div className="ms-mat-grid">
            {items.map(m => (
              <div key={m.id} className="ms-mat-card">
                <div className="ms-mat-card-icon">{MAT_TYPES[m.type] || "📎"}</div>
                <div className="ms-mat-card-body">
                  {m.url
                    ? <a className="ms-mat-title2" href={m.url} target="_blank" rel="noreferrer">{m.title}</a>
                    : <span className="ms-mat-title2">{m.title}</span>}
                  {m.notes && <div className="ms-mat-notes2">{m.notes}</div>}
                </div>
                <button className="ms-remove-btn2" onClick={() => remove(m.id)}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tasks Tab ── */
function TasksTab({ subject, update }) {
  const [newTitle, setNewTitle] = useState("");
  const [newDue,   setNewDue]   = useState("");
  const tasks = subject.tasks || [];
  const today = new Date().toISOString().slice(0, 10);
  const c     = subject.color || "#4f46e5";

  function add() {
    if (!newTitle.trim()) return;
    update({ tasks: [...tasks, { id: `t-${Date.now()}`, title: newTitle.trim(), done: false, deadline: newDue }] });
    setNewTitle(""); setNewDue("");
  }
  function toggle(id) { update({ tasks: tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }); }
  function remove(id) { update({ tasks: tasks.filter(t => t.id !== id) }); }

  const pending = tasks.filter(t => !t.done).sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1; if (b.deadline) return 1; return 0;
  });
  const done = tasks.filter(t => t.done);

  return (
    <div className="ms-list-tab2">
      <div className="ms-list-toolbar2">
        <span className="ms-list-title2">Tasks</span>
        <span className="ms-list-sub"> — {pending.length} pending</span>
      </div>
      <div className="ms-task-add-row">
        <input className="ms-inp2" style={{ flex: 1 }} value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="New task…" onKeyDown={e => e.key === "Enter" && add()} />
        <input className="ms-inp2" type="date" style={{ flex: "0 0 140px" }} value={newDue} onChange={e => setNewDue(e.target.value)} />
        <button className="ms-btn ms-btn-primary" onClick={add}>Add</button>
      </div>

      {tasks.length === 0 && <div className="ms-empty-state">No tasks yet.</div>}

      {pending.length > 0 && (
        <div className="ms-task-group">
          <div className="ms-task-group-hd">Pending</div>
          {pending.map(t => {
            const overdue = t.deadline && t.deadline < today;
            return (
              <div key={t.id} className={`ms-task-item${overdue ? " ms-task-overdue" : ""}`}>
                <button className="ms-task-check" style={{ borderColor: c }} onClick={() => toggle(t.id)} />
                <span className="ms-task-title">{t.title}</span>
                {t.deadline && (
                  <span className={`ms-task-due${overdue ? " overdue" : ""}`}>
                    {overdue ? "⚠ " : ""}{t.deadline.slice(5).replace("-", "/")}
                  </span>
                )}
                <button className="ms-remove-btn2" onClick={() => remove(t.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="ms-task-group">
          <div className="ms-task-group-hd" style={{ color: "#16a34a" }}>Done ({done.length})</div>
          {done.map(t => (
            <div key={t.id} className="ms-task-item ms-task-done">
              <button className="ms-task-check ms-task-check-done" style={{ background: c, borderColor: c }} onClick={() => toggle(t.id)}>✓</button>
              <span className="ms-task-title">{t.title}</span>
              <button className="ms-remove-btn2" onClick={() => remove(t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Subject Page ── */
export default function MedSchoolSubject() {
  const { subjectId } = useParams();
  const nav           = useNavigate();
  const [subjects, setSubjects] = useState(() => loadMedSchool());
  const [tab, setTab]           = useState("overview");
  const [editName, setEditName] = useState(false);
  const nameRef                 = useRef(null);

  const subject = subjects.find(s => s.id === subjectId);

  const update = useCallback((patch) => {
    setSubjects(prev => {
      const next = patchSubject(prev, subjectId, patch);
      saveMedSchool(next);
      return next;
    });
  }, [subjectId]);

  if (!subject) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>Subject not found.</p>
        <button className="ms-back-btn2" onClick={() => nav("/medschool")}>← Back to Med School</button>
      </div>
    );
  }

  const c = subject.color || "#4f46e5";
  const exams = subject.exams || [];
  const scored = exams.filter(e => e.score != null && e.maxScore);
  const avgGrade = scored.length > 0
    ? Math.round(scored.reduce((a, e) => a + (e.score / e.maxScore) * 100, 0) / scored.length) : null;
  const syllabus = subject.syllabus || [];
  const sylPct   = syllabus.length > 0 ? Math.round(syllabus.filter(t => t.done).length / syllabus.length * 100) : 0;

  function deleteSubject() {
    if (!window.confirm(`Delete "${subject.name}"? This cannot be undone.`)) return;
    const next = subjects.filter(s => s.id !== subjectId);
    saveMedSchool(next);
    nav("/medschool");
  }

  return (
    <div className="ms-subject2">
      {/* Header */}
      <div className="ms-subj2-header" style={{ "--c": c }}>
        <div className="ms-subj2-header-top">
          <button className="ms-back-btn2" onClick={() => nav("/medschool")}>← Med School</button>
          <button className="ms-del-btn" onClick={deleteSubject} title="Delete subject">🗑 Delete</button>
        </div>
        <div className="ms-subj2-header-body">
          <div className="ms-subj2-name-row">
            {editName ? (
              <input ref={nameRef} className="ms-subj2-name-input" defaultValue={subject.name}
                onBlur={e => { update({ name: e.target.value || subject.name }); setEditName(false); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditName(false); }}
                autoFocus />
            ) : (
              <h1 className="ms-subj2-name" onClick={() => setEditName(true)}>
                {subject.name} <span className="ms-edit-hint">✏</span>
              </h1>
            )}
            <span className="ms-subj2-year-badge">Year {subject.year}</span>
          </div>
          {subject.subtitle && <p className="ms-subj2-subtitle">{subject.subtitle}</p>}
          <div className="ms-subj2-header-stats">
            {avgGrade != null && (
              <span className="ms-hdr-stat" style={{ color: gradeColor(avgGrade) }}>🏆 Avg {avgGrade}%</span>
            )}
            <span className="ms-hdr-stat">📚 {sylPct}% covered</span>
            <span className="ms-hdr-stat">📋 {exams.length} exam{exams.length !== 1 ? "s" : ""}</span>
            {subject.gradeTarget && (
              <span className="ms-hdr-stat" style={{ opacity: 0.7 }}>Target: {subject.gradeTarget}%</span>
            )}
          </div>
          {syllabus.length > 0 && (
            <div className="ms-subj2-hdr-bar">
              <div className="ms-subj2-hdr-fill" style={{ width: `${sylPct}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="ms-tabs2">
        {TABS.map(t => (
          <button key={t.id} className={`ms-tab2${tab === t.id ? " active" : ""}`}
            style={{ "--tc": c }} onClick={() => setTab(t.id)}>
            <span className="ms-tab2-icon">{t.icon}</span>
            <span className="ms-tab2-label">{t.label}</span>
            {t.id === "tasks" && (subject.tasks || []).filter(x => !x.done).length > 0 && (
              <span className="ms-tab2-badge">{(subject.tasks || []).filter(x => !x.done).length}</span>
            )}
            {t.id === "review" && (() => {
              const today = new Date().toISOString().slice(0, 10);
              const rs = subject.reviewState || {};
              const due = (subject.syllabus || []).filter(t => !rs[t.id] || rs[t.id].nextReview <= today).length;
              return due > 0 ? <span className="ms-tab2-badge">{due}</span> : null;
            })()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="ms-tab2-body">
        {tab === "review"    && <ReviewTab    subject={subject} update={update} />}
        {tab === "overview"  && <OverviewTab  subject={subject} setTab={setTab} />}
        {tab === "notes"     && <NotesTab     subject={subject} update={update} />}
        {tab === "exams"     && <ExamsTab     subject={subject} update={update} />}
        {tab === "syllabus"  && <SyllabusTab  subject={subject} update={update} />}
        {tab === "materials" && <MaterialsTab subject={subject} update={update} />}
        {tab === "tasks"     && <TasksTab     subject={subject} update={update} />}
      </div>
    </div>
  );
}
