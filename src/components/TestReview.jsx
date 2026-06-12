import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { loadProgress, getCard, isDue, rate, toggleDone } from "../lib/storage.js";

const BASE = import.meta.env.BASE_URL;

export default function TestReview({ onBack }) {
  const location = useLocation();
  const deckFile    = location.state?.deckFile || "questions/deck.json";
  const initialBlock = location.state?.block   || "all";

  const [deck, setDeck]             = useState(null);
  const [error, setError]           = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter]         = useState("missed");
  const [block, setBlock]           = useState(initialBlock);
  const [query, setQuery]           = useState("");
  const [progress, setProgress]     = useState(loadProgress);

  useEffect(() => {
    setDeck(null);
    setSelectedId(null);
    fetch(`${BASE}${deckFile}`)
      .then((r) => r.json())
      .then((d) => {
        setDeck(d);
        const first = d.questions.find((q) => q.missed) || d.questions[0];
        if (first) setSelectedId(first.id);
      })
      .catch((e) => setError(String(e)));
  }, [deckFile]);

  const filtered = useMemo(() => {
    if (!deck) return [];
    return deck.questions.filter((q) => {
      const card = getCard(progress, q.id);
      if (block === "test1" && q.block !== undefined)       return false;
      if (block === "test2" && q.block !== "UWORLD test 2") return false;
      if (block === "test3" && q.block !== "UWORLD test 3") return false;
      if (block === "test4" && q.block !== "UWORLD test 4") return false;
      if (filter === "missed"   && !q.missed)                               return false;
      if (filter === "due"      && !(card.status !== "new" && isDue(card))) return false;
      if (filter === "mastered" && card.status !== "mastered")              return false;
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
      if (c.status !== "new" && isDue(c)) due++;
    }
    return {
      total: deck.questions.length,
      missed: deck.questions.filter((q) => q.missed).length,
      mastered,
      due,
    };
  }, [deck, progress]);

  // Arrow key sidebar navigation
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((q) => q.id === selectedId);
      const next = e.key === "ArrowDown"
        ? Math.min(idx + 1, filtered.length - 1)
        : Math.max(idx - 1, 0);
      setSelectedId(filtered[next].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId]);

  function handleRate(id, rating) {
    const next = rate(id, rating);
    setProgress({ ...next });
  }

  function handleDone(id) {
    const next = toggleDone(id);
    setProgress({ ...next });
  }

  if (error) return (
    <div className="boot error">
      Could not load questions: {error}
      <p>Run <code>npm run dev</code> from the project folder.</p>
    </div>
  );
  if (!deck) return <div className="boot">Loading deck…</div>;

  const selectedMeta = selectedId ? deck.questions.find((q) => q.id === selectedId) : null;
  const selectedCard = selectedMeta ? getCard(progress, selectedMeta.id) : null;

  return (
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

        <div className="filters">
          {[
            ["missed",   `Missed (${stats.missed})`],
            ["due",      `Due (${stats.due})`],
            ["all",      `All (${stats.total})`],
            ["mastered", `Mastered (${stats.mastered})`],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "chip active" : "chip"}
              onClick={() => setFilter(key)}
            >{label}</button>
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
                      {q.block === "UWORLD test 4" ? "T4" : q.block === "UWORLD test 3" ? "T3" : q.block === "UWORLD test 2" ? "T2" : "T1"} #{q.item} · {q.system}
                      {q.missed && <span className="tag-missed"> missed</span>}
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
                 selectedCard?.status === "review"   ? `Streak ${selectedCard.streak}` :
                 "New"}
              </span>
              <button
                className={`sr-btn sr-done${selectedCard?.done ? " sr-done-on" : ""}`}
                onClick={() => handleDone(selectedMeta.id)}
              >
                {selectedCard?.done ? "✓ Done" : "Mark done"}
              </button>
              <button className="sr-btn sr-again" onClick={() => handleRate(selectedMeta.id, "again")}>
                🔁 Review again
              </button>
              <button className="sr-btn sr-got" onClick={() => handleRate(selectedMeta.id, "got")}>
                ✓ Got it
              </button>
            </div>
          </div>
        ) : (
          <div className="boot">Select a question from the list.</div>
        )}
      </main>
    </div>
  );
}
