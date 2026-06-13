import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loadMedSchool, saveMedSchool, YEAR_META, yearStats } from "../lib/medSchoolData.js";

const COLOR_PALETTE = [
  "#4f46e5","#ef4444","#f97316","#eab308","#10b981","#06b6d4","#8b5cf6","#ec4899",
  "#0891b2","#16a34a","#dc2626","#7c3aed","#0e7490","#64748b","#db2777","#d97706",
];

const EMPTY_NEW = { name: "", subtitle: "", color: "#4f46e5", year: 4 };

function GradeChip({ score, maxScore }) {
  if (score == null || !maxScore) return null;
  const pct = Math.round((score / maxScore) * 100);
  const cls = pct >= 85 ? "ms-grade-high" : pct >= 70 ? "ms-grade-mid" : "ms-grade-low";
  return <span className={`ms-grade-chip ${cls}`}>{pct}%</span>;
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SubjectCard({ subject, onOpen }) {
  const syllabus     = subject.syllabus || [];
  const done         = syllabus.filter(t => t.done).length;
  const pct          = syllabus.length > 0 ? Math.round((done / syllabus.length) * 100) : 0;
  const scoredExams  = (subject.exams || []).filter(e => e.score != null && e.maxScore);
  const avgGrade     = scoredExams.length > 0
    ? Math.round(scoredExams.reduce((a, e) => a + (e.score / e.maxScore) * 100, 0) / scoredExams.length)
    : null;
  const today        = new Date().toISOString().slice(0, 10);
  const nextExam     = (subject.exams || [])
    .filter(e => e.date && e.date >= today && e.score == null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const pendingTasks = (subject.tasks || []).filter(t => !t.done).length;
  const c            = subject.color || "#4f46e5";
  const daysToExam   = nextExam
    ? Math.ceil((new Date(nextExam.date + "T12:00:00Z") - new Date()) / 86400000)
    : null;
  const urgent       = daysToExam != null && daysToExam <= 7;

  return (
    <button className={`ms-subj-card2${urgent ? " ms-subj-urgent" : ""}`} onClick={onOpen}
      style={{ "--c": c }}>
      <div className="ms-subj2-strip" />
      <div className="ms-subj2-body">
        <div className="ms-subj2-top">
          <div>
            <div className="ms-subj2-name">{subject.name}</div>
            {subject.subtitle && <div className="ms-subj2-sub">{subject.subtitle}</div>}
          </div>
          <div className="ms-subj2-badges">
            {avgGrade != null && (
              <span className={`ms-grade-chip ${avgGrade >= 85 ? "ms-grade-high" : avgGrade >= 70 ? "ms-grade-mid" : "ms-grade-low"}`}>
                Ø {avgGrade}%
              </span>
            )}
          </div>
        </div>

        {syllabus.length > 0 && (
          <div className="ms-subj2-syl">
            <div className="ms-subj2-syl-bar">
              <div className="ms-subj2-syl-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="ms-subj2-syl-label">{done}/{syllabus.length} topics · {pct}%</span>
          </div>
        )}

        <div className="ms-subj2-footer">
          <div className="ms-subj2-chips">
            <span className="ms-meta-chip">📋 {(subject.exams || []).length} exam{(subject.exams || []).length !== 1 ? "s" : ""}</span>
            <span className="ms-meta-chip">📁 {(subject.materials || []).length}</span>
            {pendingTasks > 0 && <span className="ms-meta-chip ms-meta-chip-task">✓ {pendingTasks} tasks</span>}
          </div>
          {nextExam && (
            <span className={`ms-next-exam-chip${urgent ? " ms-next-exam-urgent" : ""}`}>
              {urgent ? "⚠ " : "📅 "}{fmtDate(nextExam.date)}{daysToExam === 0 ? " TODAY" : daysToExam === 1 ? " tomorrow" : ` (${daysToExam}d)`}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function AddSubjectModal({ defaultYear, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_NEW, year: defaultYear });
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: `y${form.year}-${form.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: form.name.trim(),
      subtitle: form.subtitle.trim(),
      notes: "", exams: [], syllabus: [], materials: [], tasks: [],
      gradeTarget: 75,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  }

  return (
    <div className="ms-modal-overlay" onClick={onClose}>
      <div className="ms-modal" onClick={e => e.stopPropagation()}>
        <div className="ms-modal-hd">
          <span>New Subject</span>
          <button className="ev-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="ms-modal-body">
          <label className="ms-modal-lbl">Subject name *</label>
          <input className="ms-modal-inp" value={form.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. Neurology" autoFocus />
          <label className="ms-modal-lbl">Subtitle / specialties</label>
          <input className="ms-modal-inp" value={form.subtitle} onChange={e => upd("subtitle", e.target.value)} placeholder="e.g. Clinical Neurology & Neurosurgery" />
          <label className="ms-modal-lbl">Year</label>
          <div className="ms-modal-year-row">
            {[3, 4, 5, 6].map(y => (
              <button key={y} className={`ms-modal-year-btn${form.year === y ? " active" : ""}`}
                onClick={() => upd("year", y)} style={{ "--yc": YEAR_META[y].color }}>
                {YEAR_META[y].shortLabel}
              </button>
            ))}
          </div>
          <label className="ms-modal-lbl">Color</label>
          <div className="ms-color-palette">
            {COLOR_PALETTE.map(c => (
              <button key={c} className={`ms-color-swatch${form.color === c ? " selected" : ""}`}
                style={{ background: c }} onClick={() => upd("color", c)} />
            ))}
          </div>
          <div className="ms-modal-preview" style={{ "--c": form.color }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: form.color }}>{form.name || "Subject name"}</div>
            {form.subtitle && <div style={{ fontSize: 11, color: "var(--muted)" }}>{form.subtitle}</div>}
          </div>
        </div>
        <div className="ms-modal-btns">
          <button className="ev-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="ev-modal-save" onClick={save} disabled={!form.name.trim()}>Create Subject</button>
        </div>
      </div>
    </div>
  );
}

export default function MedSchoolHub() {
  const nav          = useNavigate();
  const [subjects, setSubjects] = useState(() => loadMedSchool());
  const [activeYear, setActiveYear] = useState(4);
  const [showAdd,    setShowAdd]    = useState(false);

  const meta  = YEAR_META[activeYear];
  const stats = yearStats(subjects, activeYear);
  const ys    = subjects.filter(s => s.year === activeYear).sort((a, b) => {
    // Urgent (upcoming exam within 7 days) first
    const today = new Date().toISOString().slice(0, 10);
    const nextA = (a.exams || []).filter(e => e.date >= today && e.score == null).sort((x,y) => x.date.localeCompare(y.date))[0];
    const nextB = (b.exams || []).filter(e => e.date >= today && e.score == null).sort((x,y) => x.date.localeCompare(y.date))[0];
    if (nextA && !nextB) return -1;
    if (!nextA && nextB) return 1;
    if (nextA && nextB) return nextA.date.localeCompare(nextB.date);
    return (a.name || "").localeCompare(b.name || "");
  });

  function addSubject(newS) {
    const next = [...subjects, newS];
    setSubjects(next);
    saveMedSchool(next);
    setShowAdd(false);
    nav(`/medschool/subject/${newS.id}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="ms-hub2">
      {/* ── Hero ── */}
      <div className="ms-hub2-hero" style={{ "--c": meta.color }}>
        <div className="ms-hub2-hero-left">
          <span className="ms-hub2-emoji">{meta.emoji}</span>
          <div>
            <h1 className="ms-hub2-title">Med School</h1>
            <p className="ms-hub2-sub">Academic workspace — notes, exams, syllabus, materials</p>
          </div>
        </div>
        <button className="ms-hub2-add-btn" onClick={() => setShowAdd(true)}>+ New Subject</button>
      </div>

      {/* ── Year tabs ── */}
      <div className="ms-hub2-years">
        {[3, 4, 5, 6].map(y => {
          const ym  = YEAR_META[y];
          const cnt = subjects.filter(s => s.year === y).length;
          return (
            <button key={y} className={`ms-hub2-year-tab${activeYear === y ? " active" : ""}`}
              style={{ "--yc": ym.color }} onClick={() => setActiveYear(y)}>
              <span className="ms-hub2-year-emoji">{ym.emoji}</span>
              <span className="ms-hub2-year-label">{ym.label}</span>
              {cnt > 0 && <span className="ms-hub2-year-count">{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Year stats bar ── */}
      {meta.active && ys.length > 0 && (
        <div className="ms-stats-bar" style={{ "--c": meta.color }}>
          <div className="ms-stat-tile">
            <span className="ms-stat-tile-val">{stats.count}</span>
            <span className="ms-stat-tile-lbl">Subjects</span>
          </div>
          <div className="ms-stat-divider" />
          <div className="ms-stat-tile">
            <span className="ms-stat-tile-val" style={{ color: stats.avgGrade != null ? (stats.avgGrade >= 85 ? "#16a34a" : stats.avgGrade >= 70 ? "#d97706" : "#dc2626") : "var(--muted)" }}>
              {stats.avgGrade != null ? `${stats.avgGrade}%` : "—"}
            </span>
            <span className="ms-stat-tile-lbl">Avg Grade</span>
          </div>
          <div className="ms-stat-divider" />
          <div className="ms-stat-tile">
            <span className="ms-stat-tile-val">{stats.syllabusPct}%</span>
            <span className="ms-stat-tile-lbl">Syllabus</span>
          </div>
          <div className="ms-stat-divider" />
          <div className="ms-stat-tile">
            <span className="ms-stat-tile-val" style={{ color: stats.upcoming.length > 0 ? "#ef4444" : "var(--text)" }}>
              {stats.upcoming.length > 0 ? stats.upcoming.length : "0"}
            </span>
            <span className="ms-stat-tile-lbl">Upcoming Exams</span>
          </div>
          {stats.pendingTasks.length > 0 && (
            <>
              <div className="ms-stat-divider" />
              <div className="ms-stat-tile">
                <span className="ms-stat-tile-val">{stats.pendingTasks.length}</span>
                <span className="ms-stat-tile-lbl">Pending Tasks</span>
              </div>
            </>
          )}
          <div style={{ flex: 1 }} />
          <div className="ms-stats-syl-bar-wrap">
            <div className="ms-stats-syl-bar">
              <div className="ms-stats-syl-fill" style={{ width: `${stats.syllabusPct}%` }} />
            </div>
            <span className="ms-stats-syl-label">{stats.doneTopics}/{stats.totalTopics} topics covered</span>
          </div>
        </div>
      )}

      {/* ── Upcoming exams alert ── */}
      {stats.upcoming.length > 0 && (
        <div className="ms-upcoming-strip">
          <span className="ms-upcoming-icon">📅</span>
          <span className="ms-upcoming-label">Upcoming exams: </span>
          {stats.upcoming.slice(0, 3).map((e, i) => {
            const subj = subjects.find(s => (s.exams || []).some(ex => ex.id === e.id));
            const days = Math.ceil((new Date(e.date + "T12:00:00Z") - new Date()) / 86400000);
            return (
              <span key={i} className="ms-upcoming-chip" style={{ "--c": subj?.color || "#4f46e5" }}>
                {subj?.name}: {fmtDate(e.date)} ({days === 0 ? "TODAY!" : days === 1 ? "tomorrow" : `${days}d`})
              </span>
            );
          })}
        </div>
      )}

      {/* ── Subjects grid ── */}
      <div className="ms-hub2-content">
        {meta.active ? (
          ys.length > 0 ? (
            <div className="ms-subjects-grid2">
              {ys.map(s => (
                <SubjectCard key={s.id} subject={s} onOpen={() => nav(`/medschool/subject/${s.id}`)} />
              ))}
              <button className="ms-add-subj-card" onClick={() => setShowAdd(true)}>
                <span className="ms-add-subj-plus">+</span>
                <span>Add Subject</span>
              </button>
            </div>
          ) : (
            <div className="ms-year-empty">
              <div style={{ fontSize: 48 }}>{meta.emoji}</div>
              <h3>{meta.label} — No subjects yet</h3>
              <p>Add your first subject to start tracking notes, exams, and syllabus.</p>
              <button className="ms-hub2-add-btn" onClick={() => setShowAdd(true)}>+ Add First Subject</button>
            </div>
          )
        ) : (
          <div className="ms-year-empty">
            <div style={{ fontSize: 48 }}>🔒</div>
            <h3>{meta.label} — Coming Soon</h3>
            <p>This year's workspace will be available when you advance.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <AddSubjectModal defaultYear={activeYear} onSave={addSubject} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
