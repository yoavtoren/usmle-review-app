import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  loadProgress, getCard, isDue, rate,
  processWizardComplete, saveQuestionIntake, getQIntakeMeta,
  loadTasks, saveTasks, bumpTopicMiss, loadTopicCounters, resetQuestions,
} from "../lib/storage.js";
import IntakeWizard from "./IntakeWizard.jsx";

const BASE = import.meta.env.BASE_URL;

export default function TestReview({ onBack }) {
  const location = useLocation();
  const deckFile     = location.state?.deckFile || "questions/deck.json";
  const initialBlock = location.state?.block    || "all";

  const [deck, setDeck]             = useState(null);
  const [error, setError]           = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter]         = useState(location.state?.filter || "missed");
  const [block, setBlock]           = useState(initialBlock);
  const [query, setQuery]           = useState("");
  const [progress, setProgress]     = useState(loadProgress);
  const [wizardId, setWizardId]     = useState(null);
  const [wizardFull, setWizardFull] = useState(null); // full question JSON (firstAid + keywords)
  const [noteShown, setNoteShown]   = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Question ids belonging to a given test block.
  function blockIds(blk) {
    if (!deck) return [];
    return deck.questions
      .filter(q =>
        blk === "test1" ? q.block === undefined : q.block === `UWORLD test ${blk.slice(-1)}`)
      .map(q => q.id);
  }

  function doResetBlock() {
    const ids = block === "all" ? deck.questions.map(q => q.id) : blockIds(block);
    resetQuestions(ids);
    setProgress(loadProgress());
    setConfirmReset(false);
  }

  useEffect(() => { setNoteShown(false); }, [selectedId]);

  // Load the full question JSON for the wizard so FA + Anki tasks can be
  // auto-built from the question's own content.
  useEffect(() => {
    if (!wizardId) { setWizardFull(null); return; }
    const meta = deck?.questions.find(q => q.id === wizardId);
    if (!meta?.file) { setWizardFull(null); return; }
    let live = true;
    fetch(`${BASE}questions/${meta.file}`)
      .then(r => r.json())
      .then(j => { if (live) setWizardFull(j); })
      .catch(() => { if (live) setWizardFull(null); });
    return () => { live = false; };
  }, [wizardId, deck]);

  useEffect(() => {
    setDeck(null); setSelectedId(null);
    fetch(`${BASE}${deckFile}`)
      .then(r => r.json())
      .then(d => {
        setDeck(d);
        const first = d.questions.find(q => q.missed) || d.questions[0];
        if (first) setSelectedId(first.id);
      })
      .catch(e => setError(String(e)));
  }, [deckFile]);

  const filtered = useMemo(() => {
    if (!deck) return [];
    return deck.questions.filter(q => {
      const card = getCard(progress, q.id);
      if (block === "test1" && q.block !== undefined)           return false;
      if (block === "test2" && q.block !== "UWORLD test 2")     return false;
      if (block === "test3" && q.block !== "UWORLD test 3")     return false;
      if (block === "test4" && q.block !== "UWORLD test 4")     return false;
      if (filter === "missed"   && !q.missed)                                return false;
      if (filter === "due"      && !(card.status === "review" && isDue(card))) return false;
      if (filter === "mastered" && card.status !== "mastered")               return false;
      if (query) {
        const hay = `${q.title} ${q.system} ${q.topic}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [deck, filter, block, query, progress]);

  const stats = useMemo(() => {
    if (!deck) return { total: 0, missed: 0, mastered: 0, due: 0 };
    let mastered = 0, due = 0;
    for (const q of deck.questions) {
      const c = getCard(progress, q.id);
      if (c.status === "mastered") mastered++;
      if (c.status === "review" && isDue(c)) due++;
    }
    return { total: deck.questions.length, missed: deck.questions.filter(q => q.missed).length, mastered, due };
  }, [deck, progress]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || wizardId) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (!filtered.length) return;
      const idx = filtered.findIndex(q => q.id === selectedId);
      const next = e.key === "ArrowDown"
        ? Math.min(idx + 1, filtered.length - 1)
        : Math.max(idx - 1, 0);
      setSelectedId(filtered[next].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, wizardId]);

  // ── Mark Done button: opens wizard if not done, toggles off if already done ──
  function handleMarkDone(meta) {
    if (progress[meta.id]?.done) {
      // Un-mark done: write directly (save() is private; key is stable)
      const prog = loadProgress();
      prog[meta.id] = { ...getCard(prog, meta.id), done: false };
      localStorage.setItem("usmle-review-progress-v1", JSON.stringify(prog));
      setProgress({ ...prog });
    } else {
      setWizardId(meta.id);
    }
  }

  function handleWizardComplete(form, actions) {
    const qId = wizardId;

    // 1. Atomic: update SR schedule + mark done
    const nextProgress = processWizardComplete(qId, actions.schedule);
    setProgress({ ...nextProgress });

    // 2. Save intake metadata
    const selectedMeta = deck?.questions.find(q => q.id === qId);
    saveQuestionIntake(qId, { ...form, questionTitle: selectedMeta?.title });

    // 3. Build tasks to add
    let newTasks = [...actions.tasks];

    // 4. Topic miss counter + consolidation task
    if (form.outcome === "incorrect" && form.subject && form.system) {
      const missCount = bumpTopicMiss(form.subject, form.system, qId);
      if (missCount >= 2) {
        const topicKey = `${form.subject}::${form.system}`;
        const existing = loadTasks();
        const hasConsol = existing.some(t => t.type === "consolidation" && t.topicKey === topicKey);
        if (!hasConsol) {
          newTasks.push({
            id: `consol-${Date.now()}`, type: "consolidation", priority: "high",
            subject: form.subject, system: form.system,
            text: `🔗 Consolidate: ${form.subject} — ${form.system} (${missCount} misses)`,
            body: "Recurring weak spot — review all questions on this topic in one session.",
            topicKey, done: false, createdAt: Date.now(),
          });
        } else {
          // Update existing consolidation task text with new count
          const updated = existing.map(t =>
            t.type === "consolidation" && t.topicKey === topicKey
              ? { ...t, text: `🔗 Consolidate: ${form.subject} — ${form.system} (${missCount} misses)` }
              : t
          );
          saveTasks(updated);
        }
      }
    }

    // 5. Persist new tasks — replace any prior auto-tasks for this question
    //    (other than the cross-topic consolidation task) so re-running the
    //    wizard refreshes rather than duplicates.
    if (newTasks.length > 0) {
      const existing = loadTasks().filter(
        t => !(t.linkedQuestionId === qId && t.type !== "consolidation")
      );
      saveTasks([...existing, ...newTasks]);
    }

    setWizardId(null);
  }

  if (error) return (
    <div className="boot error">
      Could not load questions: {error}
      <p>Run <code>npm run dev</code> from the project folder.</p>
    </div>
  );
  if (!deck) return <div className="boot">Loading deck…</div>;

  const selectedMeta = selectedId ? deck.questions.find(q => q.id === selectedId) : null;
  const selectedCard = selectedMeta ? getCard(progress, selectedMeta.id) : null;
  const hasMeta      = selectedMeta ? !!getQIntakeMeta(selectedMeta.id) : false;

  return (
    <>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <button className="back-btn" onClick={onBack}>← Dashboard</button>
            <h1>Test Review</h1>
            <p className="muted">
              {stats.total} questions · {stats.missed} missed · {stats.mastered} mastered
            </p>
          </div>

          <div className="filters">
            {[["all","All tests"],["test1","Test 1"],["test2","Test 2"],["test3","Test 3"],["test4","Test 4"]].map(([key, label]) => (
              <button key={key} className={block === key ? "chip active" : "chip"} onClick={() => setBlock(key)}>{label}</button>
            ))}
          </div>

          <div className="reset-test-row">
            {!confirmReset ? (
              <button className="reset-test-btn" onClick={() => setConfirmReset(true)}>
                ↺ Reset {block === "all" ? "all tests" : `Test ${block.slice(-1)}`} for re-review
              </button>
            ) : (
              <div className="reset-test-confirm">
                <span>Clear progress, tags & linked tasks for {block === "all" ? "all tests" : `Test ${block.slice(-1)}`}?</span>
                <div className="reset-test-actions">
                  <button className="reset-test-cancel" onClick={() => setConfirmReset(false)}>Cancel</button>
                  <button className="reset-test-go" onClick={doResetBlock}>Reset</button>
                </div>
              </div>
            )}
          </div>

          <div className="filters">
            {[
              ["missed",   `Missed (${stats.missed})`],
              ["due",      `Due (${stats.due})`],
              ["all",      `All (${stats.total})`],
              ["mastered", `Mastered (${stats.mastered})`],
            ].map(([key, label]) => (
              <button key={key} className={filter === key ? "chip active" : "chip"} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>

          <input className="search" placeholder="Search topic / system…" value={query} onChange={e => setQuery(e.target.value)} />

          <ul className="qlist">
            {filtered.map(q => {
              const card = getCard(progress, q.id);
              const meta = getQIntakeMeta(q.id);
              return (
                <li key={q.id}>
                  <button className={selectedId === q.id ? "qitem active" : "qitem"} onClick={() => setSelectedId(q.id)}>
                    <span className={`dot ${card.status}${card.done ? " dot-done" : ""}`} />
                    <span className="qitem-text">
                      <span className="qitem-title">{q.title}</span>
                      <span className="qitem-meta">
                        {q.block === "UWORLD test 4" ? "T4" : q.block === "UWORLD test 3" ? "T3" : q.block === "UWORLD test 2" ? "T2" : "T1"} #{q.item} · {q.system}
                        {q.missed && <span className="tag-missed"> missed</span>}
                        {card.done && <span className="tag-done"> ✓</span>}
                        {meta && <span className="tag-intake"> ·{meta.subject || "?"}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="empty muted">Nothing here — try another filter.</li>}
          </ul>

          <p className="footnote muted">100% local · progress stays in this browser.</p>
        </aside>

        <main className="main">
          {selectedMeta ? (
            <div className="widget-wrap">
              <iframe
                key={selectedMeta.id}
                src={`${BASE}questions/${selectedMeta.file.replace(".json", ".html")}`}
                title={selectedMeta.title}
                className="widget-frame"
              />
              <div className="sr-bar">
                <span className="sr-status">
                  {selectedCard?.status === "mastered" ? "✓ Mastered" :
                   selectedCard?.status === "review"   ? `Streak ${selectedCard.streak}` : "New"}
                </span>
                <button
                  className={`sr-btn sr-done${selectedCard?.done ? " sr-done-on" : ""}`}
                  onClick={() => handleMarkDone(selectedMeta)}
                  title={selectedCard?.done ? "Un-mark done" : "Mark done — opens intake wizard"}
                >
                  {selectedCard?.done ? "✓ Done" : hasMeta ? "✎ Re-intake" : "Mark done ✦"}
                </button>
                <button className="sr-btn sr-again" onClick={() => { const n = rate(selectedMeta.id, "again"); setProgress({ ...n }); }}>
                  🔁 Review again
                </button>
                <button className="sr-btn sr-got" onClick={() => { const n = rate(selectedMeta.id, "got"); setProgress({ ...n }); }}>
                  ✓ Got it
                </button>
              </div>

              {/* Re-attempt-first: reveal mechanism note only on demand */}
              {hasMeta && (() => {
                const intake = getQIntakeMeta(selectedMeta.id);
                const hasNote = intake?.mechanismNote;
                if (!hasNote) return null;
                return (
                  <div className="sr-note-wrap">
                    <button
                      className={`sr-note-toggle${noteShown ? " sr-note-open" : ""}`}
                      onClick={() => setNoteShown(n => !n)}
                    >
                      {noteShown ? "Hide my note ▲" : "Show my note ▼"}
                    </button>
                    {noteShown && (
                      <div className="sr-note-body">
                        <div className="sr-note-tags">
                          {intake.subject && <span className="sr-note-tag">{intake.subject}</span>}
                          {intake.system  && <span className="sr-note-tag">{intake.system}</span>}
                          {intake.outcome === "incorrect" && <span className="sr-note-tag sr-note-missed">missed</span>}
                          {intake.whyMissed && (
                            <span className="sr-note-tag sr-note-why">
                              {intake.whyMissed === "A" ? "fact gap" :
                               intake.whyMissed === "B" ? "reasoning error" :
                               intake.whyMissed === "C" ? "concept gap" :
                               intake.whyMissed === "D" ? "misread" :
                               intake.whyMissed === "shaky" ? "shaky" : "knew cold"}
                            </span>
                          )}
                        </div>
                        <div className="sr-note-text">{intake.mechanismNote}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="boot">Select a question from the list.</div>
          )}
        </main>
      </div>

      {/* Wizard overlay */}
      {wizardId && (
        <IntakeWizard
          questionId={wizardId}
          questionMeta={deck?.questions.find(q => q.id === wizardId)}
          questionFull={wizardFull}
          existingIntake={getQIntakeMeta(wizardId)}
          onComplete={handleWizardComplete}
          onDismiss={() => setWizardId(null)}
        />
      )}
    </>
  );
}
