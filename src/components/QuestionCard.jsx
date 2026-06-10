import { useState } from "react";
import { rate, setDifficulty, getCard } from "../lib/storage.js";

const TABS = [
  ["q", "📖 Question"],
  ["e", "🚫 Eliminate"],
  ["a", "🎯 Answer"],
  ["k", "🔑 Keywords"],
  ["f", "📚 First Aid"],
];

const CLUE_COLORS = {
  red: "#b3261e",
  orange: "#8a5a00",
  blue: "#0c447c",
  green: "#27500a",
  purple: "#72243e",
};
const CLUE_BG = {
  red: "#fdeceb",
  orange: "#fbf0da",
  blue: "#e6f1fb",
  green: "#eaf3de",
  purple: "#fbeaf0",
};

const DIFF_OPTIONS = [
  ["knowledge", "📚 Pure knowledge gap"],
  ["comprehension", "🧭 Understanding the question"],
  ["vocab", "🔤 Vocabulary"],
  ["imaging", "🖼️ Imaging / diagram"],
  ["distractor", "🧲 Pulled by a distractor"],
  ["other", "✍️ Something else"],
];

export default function QuestionCard({ q, onProgress, progress }) {
  const [tab, setTab] = useState("q");
  const [openClue, setOpenClue] = useState(null);
  const [openElim, setOpenElim] = useState(null);
  const [locked, setLocked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [steps, setSteps] = useState(0);
  const [flipped, setFlipped] = useState({});
  const card = getCard(progress, q.id);

  const wrongOptions = q.options.filter((o) => !o.correct);
  const correctOption = q.options.find((o) => o.correct);

  function handleRate(r) {
    onProgress(rate(q.id, r));
  }
  function handleDifficulty(d) {
    onProgress(setDifficulty(q.id, d));
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="pill">#{q.item}</span>
          <span className="pill ghost">{q.system}</span>
          <span className="pill ghost">{q.topic}</span>
          {q.percentCorrect != null && (
            <span className="pill ghost">{q.percentCorrect}% got it right</span>
          )}
        </div>
        <h2>{q.title}</h2>
      </div>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "tab active" : "tab"}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* QUESTION */}
      {tab === "q" && (
        <section>
          <p className="vignette">{q.vignette}</p>

          {q.clues?.length > 0 && (
            <>
              <p className="hint">👆 Tap a clue to see why it matters</p>
              <div className="clues">
                {q.clues.map((c, i) => (
                  <div key={i}>
                    <button
                      className="clue"
                      style={{ background: CLUE_BG[c.type] || "#eee", color: CLUE_COLORS[c.type] || "#333" }}
                      onClick={() => setOpenClue(openClue === i ? null : i)}
                    >
                      {c.text}
                    </button>
                    {openClue === i && <div className="panel">{c.note}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="callout">
            <strong>🧩 What actually matters:</strong> {q.whatMatters}
          </div>
          <div className="callout info">
            <strong>🧠 In these kinds of questions:</strong> {q.strategy}
          </div>

          <div className="options">
            {q.options.map((o) => (
              <button
                key={o.letter}
                className={"option" + (locked === o.letter ? " locked" : "")}
                onClick={() => setLocked(o.letter)}
              >
                <b>{o.letter}</b> {o.text}
              </button>
            ))}
          </div>
          {locked && (
            <p className="lockmsg">🔒 Locked in {locked}. Head to the Answer tab to check it.</p>
          )}
        </section>
      )}

      {/* ELIMINATE */}
      {tab === "e" && (
        <section>
          <p className="hint">👆 Tap each wrong answer — what it is, then why it fails</p>
          {wrongOptions.map((o) => {
            const elim = q.eliminations?.find((e) => e.letter === o.letter);
            return (
              <div key={o.letter} className="elim" onClick={() => setOpenElim(openElim === o.letter ? null : o.letter)}>
                <div><b>{o.letter}</b> {o.text}{elim ? ` — ${elim.what}` : ""}</div>
                {openElim === o.letter && elim && (
                  <div className="panel">❌ {elim.why}</div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ANSWER */}
      {tab === "a" && (
        <section>
          {!revealed ? (
            <button className="reveal" onClick={() => setRevealed(true)}>
              🎯 Reveal answer
            </button>
          ) : (
            <>
              <div className="answer-banner">
                ✅ {correctOption.letter} · {correctOption.text}
              </div>
              {locked && (
                <p className={locked === q.correct ? "ok" : "bad"}>
                  {locked === q.correct
                    ? `🎉 Your locked guess ${locked} is correct.`
                    : `Your locked guess was ${locked} — correct answer is ${q.correct}.`}
                </p>
              )}
              {q.yourAnswer && q.yourAnswer !== q.correct && (
                <p className="muted">On the real test you picked {q.yourAnswer}.</p>
              )}

              <h3>🧩 Reasoning chain</h3>
              <div className="chain">
                {q.reasoning.slice(0, steps).map((s, i) => (
                  <div key={i} className="chain-step">{i + 1}. {s}</div>
                ))}
                {steps < q.reasoning.length && (
                  <button className="chain-next" onClick={() => setSteps(steps + 1)}>
                    👆 Reveal step {steps + 1}
                  </button>
                )}
              </div>

              <div className="callout">
                <strong>⚙️ Mechanism:</strong> {q.mechanism}
              </div>

              <div className="memhook">🧠 {q.memoryHook}</div>

              <div className="review-box">
                <h3>🤔 What made this hard for you?</h3>
                <div className="diffgrid">
                  {DIFF_OPTIONS.map(([key, label]) => (
                    <button
                      key={key}
                      className={card.difficulty === key ? "diff active" : "diff"}
                      onClick={() => handleDifficulty(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <h3>Schedule next review</h3>
                <div className="rate-row">
                  <button className="rate again" onClick={() => handleRate("again")}>
                    🔁 Review again soon
                  </button>
                  <button className="rate got" onClick={() => handleRate("got")}>
                    ✅ Got it — push it out
                  </button>
                </div>
                {card.dueAt && (
                  <p className="muted">
                    Next due: {new Date(card.dueAt).toLocaleDateString()} · status: {card.status}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* KEYWORDS */}
      {tab === "k" && (
        <section>
          <p className="hint">👆 Tap a card to flip · “If you see…” → “think…”</p>
          <div className="cardgrid">
            {q.keywords.map((kw, i) => (
              <button
                key={i}
                className={"flip" + (flipped[i] ? " on" : "")}
                onClick={() => setFlipped({ ...flipped, [i]: !flipped[i] })}
              >
                {flipped[i] ? <span>→ <b>{kw.back}</b></span> : <span>If you see:<br /><b>{kw.front}</b></span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* FIRST AID */}
      {tab === "f" && (
        <section>
          {q.firstAid.map((fa, i) => (
            <div key={i} className="fa">
              <div className="fa-topic">{fa.topic}</div>
              <div className="fa-loc">{fa.location}</div>
            </div>
          ))}
          <div className="memhook">🧠 {q.memoryHook}</div>
        </section>
      )}
    </div>
  );
}
