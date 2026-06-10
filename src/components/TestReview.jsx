import { useEffect, useMemo, useState, useCallback } from "react";
import QuestionCard from "./QuestionCard.jsx";
import { loadProgress, getCard, isDue } from "../lib/storage.js";

const BASE = import.meta.env.BASE_URL;

export default function TestReview({ onBack }) {
  const [deck, setDeck] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [filter, setFilter] = useState("missed");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(loadProgress());

  useEffect(() => {
    fetch(`${BASE}questions/deck.json`)
      .then((r) => r.json())
      .then((d) => {
        setDeck(d);
        const first = d.questions.find((q) => q.missed) || d.questions[0];
        if (first) setSelectedId(first.id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!selectedId || !deck) return;
    const meta = deck.questions.find((q) => q.id === selectedId);
    if (!meta) return;
    setQuestion(null);
    fetch(`${BASE}questions/${meta.file}`)
      .then((r) => r.json())
      .then(setQuestion)
      .catch((e) => setError(String(e)));
  }, [selectedId, deck]);

  const filtered = useMemo(() => {
    if (!deck) return [];
    return deck.questions.filter((q) => {
      const card = getCard(progress, q.id);
      if (filter === "missed" && !q.missed) return false;
      if (filter === "due" && !(card.status !== "new" && isDue(card))) return false;
      if (filter === "mastered" && card.status !== "mastered") return false;
      if (query) {
        const hay = `${q.title} ${q.system} ${q.topic}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [deck, filter, query, progress]);

  const stats = useMemo(() => {
    if (!deck) return { total: 0, missed: 0, mastered: 0, due: 0 };
    let mastered = 0, due = 0;
    for (const q of deck.questions) {
      const c = getCard(progress, q.id);
      if (c.status === "mastered") mastered++;
      if (c.status !== "new" && isDue(c)) due++;
    }
    return {
      total: deck.questions.length,
      missed: deck.questions.filter((q) => q.missed).length,
      mastered,
      due,
    };
  }, [deck, progress]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (filtered.length === 0) return;
      const idx = filtered.findIndex(q => q.id === selectedId);
      const next = e.key === "ArrowDown"
        ? Math.min(idx + 1, filtered.length - 1)
        : Math.max(idx - 1, 0);
      setSelectedId(filtered[next].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId]);

  if (error)
    return (
      <div className="boot error">
        Could not load questions: {error}
        <p>Run the app with <code>npm run dev</code> from the project folder.</p>
      </div>
    );
  if (!deck) return <div className="boot">Loading deck…</div>;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <button className="back-btn" onClick={onBack}>← Dashboard</button>
          <h1>Test Review</h1>
          <p className="test-badge">May 18, 2026 · <span className="score-bad">28%</span></p>
          <p className="muted">{stats.total} questions · {stats.missed} missed · {stats.mastered} mastered</p>
        </div>

        <div className="filters">
          {[
            ["missed", `Missed (${stats.missed})`],
            ["due", `Due (${stats.due})`],
            ["all", `All (${stats.total})`],
            ["mastered", `Mastered (${stats.mastered})`],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "chip active" : "chip"}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          className="search"
          placeholder="Search topic / system…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <ul className="qlist">
          {filtered.map((q) => {
            const card = getCard(progress, q.id);
            return (
              <li key={q.id}>
                <button
                  className={selectedId === q.id ? "qitem active" : "qitem"}
                  onClick={() => setSelectedId(q.id)}
                >
                  <span className={`dot ${card.status}`} />
                  <span className="qitem-text">
                    <span className="qitem-title">{q.title}</span>
                    <span className="qitem-meta">
                      #{q.item} · {q.system}
                      {q.missed && <span className="tag-missed">missed</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="empty muted">Nothing here — try another filter.</li>
          )}
        </ul>
        <p className="footnote muted">100% local · your progress stays in this browser.</p>
      </aside>

      <main className="main">
        {question ? (
          <QuestionCard
            key={question.id}
            q={question}
            onProgress={setProgress}
            progress={progress}
          />
        ) : (
          <div className="boot">Loading question…</div>
        )}
      </main>
    </div>
  );
}
