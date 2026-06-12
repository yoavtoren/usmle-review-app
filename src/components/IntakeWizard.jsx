import { useState, useEffect } from "react";
import { FA_SECTIONS, RESOURCE_GUIDANCE, SUBJECTS, SYSTEMS, makeFASectionId } from "../lib/intakeData.js";

function buildActions(form, questionId) {
  const { subject, system, faChapter, faSubsection, outcome, whyMissed, mechanismNote } = form;
  const sid = makeFASectionId(faChapter, faSubsection);
  const topic = [subject, system].filter(Boolean).join(" — ");
  const stamp = Date.now();
  const tasks = [];
  let schedule = "unchanged";

  if (outcome === "incorrect") {
    if (whyMissed === "A") {
      tasks.push({
        id: `t-${stamp}-a`, type: "anki-todo", priority: "high", subject, system,
        text: `🃏 Anki: make/find card — ${topic}`,
        body: mechanismNote || "Locate or make the AnKing card for this atomic fact.",
        linkedQuestionId: questionId, done: false, createdAt: stamp,
      });
      if (sid) tasks.push({
        id: `t-${stamp}-fa`, type: "read-fa", priority: "high", subject, system,
        text: `📖 Read FA: ${sid}`,
        body: `First Aid — ${topic}`,
        linkedQuestionId: questionId, linkedFaSectionId: sid, done: false, createdAt: stamp,
      });
      schedule = "again";
    } else if (whyMissed === "B") {
      tasks.push({
        id: `t-${stamp}-b`, type: "redo-qs", priority: "medium", subject, system,
        text: `🔁 Re-do 3 similar Qs — ${topic}`,
        body: mechanismNote ? `Reasoning trap: ${mechanismNote}` : "Practice elimination on 3 similar question stems.",
        linkedQuestionId: questionId, done: false, createdAt: stamp,
      });
      schedule = "again";
    } else if (whyMissed === "C") {
      const resources = RESOURCE_GUIDANCE[subject] || ["First Aid — relevant section"];
      tasks.push({
        id: `t-${stamp}-c`, type: "learn-concept", priority: "high", subject, system,
        text: `🧠 Learn concept — ${topic}`,
        body: resources.join(" · "),
        linkedQuestionId: questionId, done: false, createdAt: stamp,
      });
      if (sid) tasks.push({
        id: `t-${stamp}-cfa`, type: "read-fa", priority: "high", subject, system,
        text: `📖 Read FA: ${sid}`,
        body: `Understand mechanism — ${topic}`,
        linkedQuestionId: questionId, linkedFaSectionId: sid, done: false, createdAt: stamp,
      });
      schedule = "again";
    } else if (whyMissed === "D") {
      schedule = "again"; // no tasks, just log
    }
  } else {
    if (whyMissed === "shaky") schedule = "got";
    else if (whyMissed === "cold") schedule = "mastered";
  }

  return { tasks, schedule, faSectionId: sid };
}

const WHY_WRONG = [
  { key: "A", icon: "📚", label: "Didn't know the fact",      desc: "Knowledge gap → Anki card + FA reading" },
  { key: "B", icon: "🔀", label: "Knew fact, reasoning error",desc: "Trap → re-do 3 similar Qs" },
  { key: "C", icon: "🧠", label: "Didn't understand mechanism",desc: "Concept gap → resource guidance" },
  { key: "D", icon: "😅", label: "Misread / silly error",     desc: "Log only — keeps queue clean" },
];
const WHY_RIGHT = [
  { key: "shaky", icon: "🤔", label: "Shaky / guessed",  desc: "One light review scheduled" },
  { key: "cold",  icon: "🏆", label: "Knew it cold",     desc: "Marked mastered — retires" },
];

const SCHEDULE_LABELS = {
  mastered:  "🏆 Marked mastered — retired from review queue.",
  got:       "📅 One light review scheduled.",
  again:     "🔄 Schedule reset to Day 1.",
  unchanged: "📌 Logged.",
};

export default function IntakeWizard({ questionId, questionMeta, existingIntake, onComplete, onDismiss }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    subject:       existingIntake?.subject       || "",
    system:        existingIntake?.system        || questionMeta?.system || "",
    faChapter:     existingIntake?.faChapter     || "",
    faSubsection:  existingIntake?.faSubsection  || "",
    uworldQId:     existingIntake?.uworldQId     || "",
    outcome:       existingIntake?.outcome       || "",
    whyMissed:     existingIntake?.whyMissed     || "",
    mechanismNote: existingIntake?.mechanismNote || "",
  });
  const [actions, setActions] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedChapter = FA_SECTIONS.find(f => f.chapter === form.faChapter);
  const canNext0 = form.subject && form.system;

  function pickOutcome(o) {
    setForm(f => ({ ...f, outcome: o, whyMissed: "" }));
    setTimeout(() => setStep(2), 130);
  }

  function pickWhy(key) {
    const updated = { ...form, whyMissed: key };
    setForm(updated);
    const needsNote = updated.outcome === "incorrect" && (key === "B" || key === "C");
    if (needsNote) {
      setTimeout(() => setStep(3), 130);
    } else {
      const a = buildActions(updated, questionId);
      setActions(a);
      setTimeout(() => setStep(4), 130);
    }
  }

  function next() {
    if (step === 0 && canNext0) { setStep(1); return; }
    if (step === 3) {
      const a = buildActions(form, questionId);
      setActions(a);
      setStep(4);
    }
  }

  function back() {
    if (step === 0) { onDismiss(); return; }
    if (step === 4) {
      const needsNote = form.outcome === "incorrect" && (form.whyMissed === "B" || form.whyMissed === "C");
      setActions(null);
      setStep(needsNote ? 3 : 2);
      return;
    }
    setStep(s => s - 1);
  }

  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") { onDismiss(); return; }
      if (e.key === "Enter") {
        if (step === 0 && canNext0) next();
        else if (step === 3) next();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const dotStep = Math.min(step, 3);
  const topicLabel = [form.subject, form.system].filter(Boolean).join(" — ");

  return (
    <div className="intake-overlay" onClick={e => e.target === e.currentTarget && onDismiss()}>
      <div className="intake-modal" role="dialog" aria-modal="true" aria-label="Question Intake Wizard">

        {/* ── Header ── */}
        <div className="intake-hd">
          <div className="intake-hd-left">
            <span className="intake-title">Question Intake</span>
            {step < 4 && (
              <div className="intake-dots">
                {["Tag","Outcome","Why","Note"].map((lbl, i) => (
                  <span key={i} title={lbl} className={`intake-dot${i === dotStep ? " i-active" : i < dotStep ? " i-done" : ""}`} />
                ))}
              </div>
            )}
          </div>
          <button className="intake-close" onClick={onDismiss} aria-label="Close">✕</button>
        </div>

        {/* ── Body ── */}
        <div className="intake-body">

          {/* Step 0 — Metadata */}
          {step === 0 && (
            <div className="intake-step">
              <h3 className="intake-step-h">Tag this question</h3>
              <p className="intake-step-p">Takes 10 seconds. This routes everything downstream.</p>

              <div className="intake-row-2">
                <div className="intake-field">
                  <label className="intake-lbl">Subject <span className="i-req">*</span></label>
                  <select className="intake-sel" value={form.subject} onChange={e => set("subject", e.target.value)}>
                    <option value="">Select…</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="intake-field">
                  <label className="intake-lbl">System <span className="i-req">*</span></label>
                  <select className="intake-sel" value={form.system} onChange={e => set("system", e.target.value)}>
                    <option value="">Select…</option>
                    {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="intake-row-2">
                <div className="intake-field">
                  <label className="intake-lbl">FA Chapter <span className="i-opt">(optional)</span></label>
                  <select className="intake-sel" value={form.faChapter} onChange={e => { set("faChapter", e.target.value); set("faSubsection", ""); }}>
                    <option value="">No FA section</option>
                    {FA_SECTIONS.map(c => <option key={c.chapter} value={c.chapter}>{c.chapter}</option>)}
                  </select>
                </div>
                {selectedChapter && (
                  <div className="intake-field">
                    <label className="intake-lbl">FA Subsection</label>
                    <select className="intake-sel" value={form.faSubsection} onChange={e => set("faSubsection", e.target.value)}>
                      <option value="">Whole chapter</option>
                      {selectedChapter.subsections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="intake-field">
                <label className="intake-lbl">UWorld Q-ID / notes <span className="i-opt">(optional)</span></label>
                <input className="intake-inp" type="text" placeholder="e.g. Q-12345 · Block 3"
                  value={form.uworldQId} onChange={e => set("uworldQId", e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 1 — Outcome */}
          {step === 1 && (
            <div className="intake-step">
              <h3 className="intake-step-h">How did it go?</h3>
              <p className="intake-step-p">{topicLabel || "Question"}</p>
              <div className="outcome-btns">
                <button className={`outcome-btn o-bad${form.outcome === "incorrect" ? " o-sel" : ""}`} onClick={() => pickOutcome("incorrect")}>
                  <span className="outcome-ico">✗</span>
                  <span className="outcome-lbl">Incorrect</span>
                </button>
                <button className={`outcome-btn o-ok${form.outcome === "correct" ? " o-sel" : ""}`} onClick={() => pickOutcome("correct")}>
                  <span className="outcome-ico">✓</span>
                  <span className="outcome-lbl">Correct</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Why */}
          {step === 2 && (
            <div className="intake-step">
              <h3 className="intake-step-h">{form.outcome === "incorrect" ? "Why did you miss it?" : "How solid was it?"}</h3>
              <p className="intake-step-p">{topicLabel} · {form.outcome}</p>
              <div className="why-grid">
                {(form.outcome === "incorrect" ? WHY_WRONG : WHY_RIGHT).map(opt => (
                  <button key={opt.key} className={`why-btn${form.whyMissed === opt.key ? " why-sel" : ""}`} onClick={() => pickWhy(opt.key)}>
                    <span className="why-ico">{opt.icon}</span>
                    <div className="why-txt">
                      <span className="why-lbl">{opt.label}</span>
                      <span className="why-dsc">{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Mechanism note */}
          {step === 3 && (
            <div className="intake-step">
              <h3 className="intake-step-h">Mechanism note <span className="i-opt">(optional)</span></h3>
              <p className="intake-step-p">
                {form.whyMissed === "B" ? "What reasoning trap caught you?" : "What is the actual biological process?"}
              </p>
              <textarea className="intake-ta" rows={5} autoFocus
                placeholder={form.whyMissed === "B"
                  ? "Describe the confusion — no metaphors. This resurfaces on review."
                  : "Describe the actual mechanism — no metaphors. Resurfaces on review."}
                value={form.mechanismNote} onChange={e => set("mechanismNote", e.target.value)}
              />
            </div>
          )}

          {/* Step 4 — Result */}
          {step === 4 && actions && (
            <div className="intake-step">
              <div className="result-hd">
                <span className="result-chk">✓</span>
                <div>
                  <div className="result-title">All set</div>
                  <div className="result-sub">
                    {topicLabel || "Question"} ·{" "}
                    {form.outcome === "incorrect"
                      ? `missed · why: ${form.whyMissed}`
                      : form.whyMissed === "cold" ? "knew it cold" : "shaky"}
                  </div>
                </div>
              </div>

              {actions.tasks.length > 0 && (
                <div className="result-tasks">
                  <div className="result-lbl">TASKS CREATED</div>
                  {actions.tasks.map((t, i) => (
                    <div key={i} className={`result-task result-task-${t.type}`}>
                      <div className="result-task-txt">{t.text}</div>
                      {t.body && <div className="result-task-body">{t.body}</div>}
                    </div>
                  ))}
                </div>
              )}

              {actions.tasks.length === 0 && form.whyMissed === "D" && (
                <div className="result-logonly">📝 Misread logged. No task created — keeps the queue clean.</div>
              )}

              <div className="result-schedule">{SCHEDULE_LABELS[actions.schedule] || SCHEDULE_LABELS.unchanged}</div>

              {form.faChapter && (
                <div className="result-fa">
                  📚 FA: {makeFASectionId(form.faChapter, form.faSubsection) || form.faChapter}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="intake-ft">
          <button className="intake-back" onClick={back}>{step === 0 ? "Cancel" : "← Back"}</button>
          <div className="intake-ft-right">
            {step === 0 && (
              <button className="intake-next" onClick={next} disabled={!canNext0}>Next →</button>
            )}
            {(step === 1 || step === 2) && (
              <span className="intake-hint">Click an option to continue</span>
            )}
            {step === 3 && (
              <button className="intake-next" onClick={next}>See result →</button>
            )}
            {step === 4 && (
              <button className="intake-save" onClick={() => onComplete(form, actions)}>Save & close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
