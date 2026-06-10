import { useState } from "react";
import { rate, setDifficulty, getCard } from "../lib/storage.js";

// CLUE COLOR CODE per the guide
// 🔴 fatal/critical | 🟠 demographic/risk | 🔵 key context | 🟢 confirmatory | 🟣 trap
const CLUE = {
  red:    { bg: "#fee2e2", text: "#991b1b", emoji: "🔴", label: "Critical" },
  orange: { bg: "#fff7ed", text: "#9a3412", emoji: "🟠", label: "Risk factor" },
  blue:   { bg: "#dbeafe", text: "#1e40af", emoji: "🔵", label: "Key context" },
  green:  { bg: "#dcfce7", text: "#166534", emoji: "🟢", label: "Confirms" },
  purple: { bg: "#f3e8ff", text: "#7e22ce", emoji: "🟣", label: "Trap" },
};

const DIFF_OPTIONS = [
  ["knowledge",    "📚 Knowledge gap"],
  ["comprehension","🧭 Misread the question"],
  ["vocab",        "🔤 Vocabulary"],
  ["imaging",      "🖼️ Imaging/diagram"],
  ["distractor",   "🧲 Pulled by a distractor"],
  ["other",        "✍️ Something else"],
];

// ── Inline highlight helpers ────────────────────────────────────────────────

function findInText(text, search) {
  const lower = text.toLowerCase();
  let idx = lower.indexOf(search.toLowerCase());
  if (idx !== -1) return { start: idx, end: idx + search.length };
  // try first part before " + " or ","
  const parts = search.split(/\s*[+,]\s*/);
  for (const p of parts) {
    const t = p.trim();
    if (t.length < 5) continue;
    idx = lower.indexOf(t.toLowerCase());
    if (idx !== -1) return { start: idx, end: idx + t.length };
  }
  return null;
}

function buildSegments(vignette, clues) {
  let segs = [{ type: "text", val: vignette }];
  const inlined = new Set();
  for (let ci = 0; ci < clues.length; ci++) {
    let hit = false;
    const next = [];
    for (const seg of segs) {
      if (seg.type !== "text" || hit) { next.push(seg); continue; }
      const m = findInText(seg.val, clues[ci].text);
      if (m) {
        hit = true;
        if (m.start > 0) next.push({ type: "text", val: seg.val.slice(0, m.start) });
        next.push({ type: "clue", ci, val: seg.val.slice(m.start, m.end) });
        if (m.end < seg.val.length) next.push({ type: "text", val: seg.val.slice(m.end) });
      } else {
        next.push(seg);
      }
    }
    if (hit) { segs = next; inlined.add(ci); }
  }
  const unmatched = clues.map((_, i) => i).filter(i => !inlined.has(i));
  return { segs, unmatched };
}

// ── Main component ───────────────────────────────────────────────────────────

export default function QuestionCard({ q, onProgress, progress }) {
  const [tab, setTab]           = useState("q");
  const [openClue, setOpenClue] = useState(null);
  const [locked, setLocked]     = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [step, setStep]         = useState(0);
  const [flipped, setFlipped]   = useState({});
  const [openElim, setOpenElim] = useState(null);
  const card = getCard(progress, q.id);

  const clues       = q.clues || [];
  const correctOpt  = q.options.find(o => o.correct);
  const wrongOpts   = q.options.filter(o => !o.correct);
  const { segs, unmatched } = buildSegments(q.vignette, clues);

  const activeClue = openClue !== null
    ? (openClue.startsWith("ci-") ? clues[parseInt(openClue.split("-")[1])]
      : clues[parseInt(openClue.split("-")[1])])
    : null;

  function toggleClue(key) { setOpenClue(openClue === key ? null : key); }
  function handleRate(r)  { onProgress(rate(q.id, r)); }
  function handleDiff(d)  { onProgress(setDifficulty(q.id, d)); }

  const TABS = [
    ["q", "📖 Question"],
    ["e", "🚫 Eliminate"],
    ["a", "🎯 Answer"],
    ["k", "🔑 Keywords"],
    ["f", "📚 First Aid"],
  ];

  return (
    <div className="qcard">

      {/* ── Header ── */}
      <div className="qcard-head">
        <div className="qcard-pills">
          <span className="qpill accent">{q.system}</span>
          <span className="qpill ghost">{q.topic}</span>
          {q.percentCorrect != null && (
            <span className="qpill ghost">🎯 {q.percentCorrect}% got it right</span>
          )}
          {q.missed && <span className="qpill danger">❌ Missed</span>}
        </div>
        <h2 className="qcard-title">#{q.item} · {q.title}</h2>
      </div>

      {/* ── Tabs ── */}
      <div className="qtabs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "qtab active" : "qtab"}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          TAB 1 — QUESTION
      ══════════════════════════════════════════════ */}
      {tab === "q" && (
        <div className="qtab-body">

          {/* Vignette with inline clue highlights */}
          <div className="vignette-block">
            <div className="vignette-text">
              {segs.map((seg, i) => {
                if (seg.type === "text") return <span key={i}>{seg.val}</span>;
                const c = CLUE[clues[seg.ci].type] || CLUE.blue;
                const key = `ci-${seg.ci}`;
                return (
                  <button
                    key={i}
                    className="iclue"
                    style={{ background: c.bg, color: c.text }}
                    onClick={() => toggleClue(key)}
                  >
                    {c.emoji} {seg.val}
                  </button>
                );
              })}
            </div>

            {/* Inline clue reveal panel */}
            {openClue && openClue.startsWith("ci-") && (() => {
              const ci = parseInt(openClue.split("-")[1]);
              const c = CLUE[clues[ci].type] || CLUE.blue;
              return (
                <div className="clue-panel" style={{ background: c.bg, borderColor: c.text, color: c.text }}>
                  <strong>{c.emoji} {c.label}:</strong> {clues[ci].note}
                </div>
              );
            })()}
          </div>

          {/* Unmatched clues as tags */}
          {unmatched.length > 0 && (
            <div className="clue-tags">
              {unmatched.map(ci => {
                const c = CLUE[clues[ci].type] || CLUE.blue;
                const key = `uc-${ci}`;
                const isOpen = openClue === key;
                return (
                  <div key={ci}>
                    <button
                      className="clue-tag"
                      style={{ background: c.bg, color: c.text }}
                      onClick={() => toggleClue(key)}
                    >
                      {c.emoji} {clues[ci].text}
                    </button>
                    {isOpen && (
                      <div className="clue-panel" style={{ background: c.bg, borderColor: c.text, color: c.text }}>
                        {clues[ci].note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* What matters + strategy */}
          <div className="callout-block important">
            <span className="ci">🧩</span>
            <div><strong>What actually matters:</strong> {q.whatMatters}</div>
          </div>
          <div className="callout-block info">
            <span className="ci">🧠</span>
            <div><strong>Strategy:</strong> {q.strategy}</div>
          </div>

          {/* Answer options */}
          <div className="options-list">
            {q.options.map(o => (
              <button
                key={o.letter}
                className={`opt${locked === o.letter ? " locked" : ""}`}
                onClick={() => setLocked(o.letter)}
              >
                <span className={`opt-ltr${locked === o.letter ? " locked" : ""}`}>{o.letter}</span>
                <span className="opt-txt">{o.text}</span>
                {locked === o.letter && <span className="opt-lock-badge">🔒</span>}
              </button>
            ))}
          </div>

          {locked && (
            <div className="lock-msg">
              Locked in <strong>{locked}</strong> · head to 🎯 Answer to check
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2 — ELIMINATE
      ══════════════════════════════════════════════ */}
      {tab === "e" && (
        <div className="qtab-body">
          <p className="tab-hint">👆 Tap each wrong answer — why it fails, and when it would be right</p>
          {wrongOpts.map(o => {
            const elim = (q.eliminations || []).find(e => e.letter === o.letter);
            const isOpen = openElim === o.letter;
            return (
              <div
                key={o.letter}
                className={`elim-row${isOpen ? " open" : ""}`}
                onClick={() => setOpenElim(isOpen ? null : o.letter)}
              >
                <div className="elim-top">
                  <span className="elim-ltr">{o.letter}</span>
                  <span className="elim-txt">{o.text}</span>
                  <span className="elim-chev">{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && elim && (
                  <div className="elim-panel">
                    <p>❌ <strong>What it is:</strong> {elim.what}</p>
                    <p>🚫 <strong>Eliminated because:</strong> {elim.why}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 3 — ANSWER
      ══════════════════════════════════════════════ */}
      {tab === "a" && (
        <div className="qtab-body">
          {!revealed ? (
            <button className="reveal-btn" onClick={() => { setRevealed(true); setStep(0); }}>
              🎯 Reveal answer
            </button>
          ) : (
            <>
              <div className="answer-banner">
                ✅ <strong>{correctOpt.letter}</strong> — {correctOpt.text}
              </div>

              {locked && (
                <div className={locked === q.correct ? "guess-ok" : "guess-bad"}>
                  {locked === q.correct
                    ? `🎉 Correct! Your guess (${locked}) was right.`
                    : `Your locked guess was ${locked} — correct is ${q.correct}.`}
                </div>
              )}
              {q.yourAnswer && q.yourAnswer !== q.correct && (
                <p className="muted small">On the real exam you picked <strong>{q.yourAnswer}</strong>.</p>
              )}

              <h3 className="sec-head">🧩 Reasoning chain</h3>
              <div className="chain">
                {q.reasoning.slice(0, step + 1).map((s, i) => {
                  const match = clues.find(c =>
                    c.text.split(/\s*[+,]\s*/)[0] &&
                    s.toLowerCase().includes(c.text.split(/\s*[+,]\s*/)[0].toLowerCase().slice(0, 8))
                  );
                  const c = match ? (CLUE[match.type] || CLUE.blue) : null;
                  return (
                    <div key={i} className="chain-step" style={c ? { borderLeftColor: c.text } : {}}>
                      <span className="chain-num">{i + 1}</span>
                      {c && <span style={{ marginRight: 4 }}>{c.emoji}</span>}
                      <span>{s}</span>
                    </div>
                  );
                })}
                {step < q.reasoning.length - 1 && (
                  <button className="chain-next" onClick={() => setStep(step + 1)}>
                    👆 Reveal step {step + 2} / {q.reasoning.length}
                  </button>
                )}
              </div>

              <div className="callout-block important" style={{ marginTop: 16 }}>
                <span className="ci">⚙️</span>
                <div><strong>Mechanism:</strong> {q.mechanism}</div>
              </div>

              <div className="memhook">🧠 {q.memoryHook}</div>

              {/* Difficulty + rate */}
              <div className="review-box">
                <h3 className="sec-head">🤔 What made this hard?</h3>
                <div className="diffgrid">
                  {DIFF_OPTIONS.map(([key, label]) => (
                    <button
                      key={key}
                      className={`diff${card.difficulty === key ? " active" : ""}`}
                      onClick={() => handleDiff(key)}
                    >{label}</button>
                  ))}
                </div>

                <h3 className="sec-head">📅 Schedule next review</h3>
                <div className="rate-row">
                  <button className="rate again" onClick={() => handleRate("again")}>
                    🔁 Again soon
                  </button>
                  <button className="rate got" onClick={() => handleRate("got")}>
                    ✅ Got it — push out
                  </button>
                </div>
                {card.dueAt && (
                  <p className="muted small">
                    Next due: {new Date(card.dueAt).toLocaleDateString()} · {card.status}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 4 — KEYWORDS
      ══════════════════════════════════════════════ */}
      {tab === "k" && (
        <div className="qtab-body">
          <p className="tab-hint">👆 Tap to flip · "If you see…" → "Think…"</p>
          <div className="cardgrid">
            {(q.keywords || []).map((kw, i) => (
              <button
                key={i}
                className={`flip${flipped[i] ? " on" : ""}`}
                onClick={() => setFlipped({ ...flipped, [i]: !flipped[i] })}
              >
                {flipped[i]
                  ? <span>→ <strong>{kw.back}</strong></span>
                  : <span>If you see:<br /><strong>{kw.front}</strong></span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 5 — FIRST AID
      ══════════════════════════════════════════════ */}
      {tab === "f" && (
        <div className="qtab-body">
          <p className="tab-hint">📚 Exact First Aid locations — go read these</p>
          {(q.firstAid || []).map((fa, i) => (
            <div key={i} className="fa-loc-card">
              <div className="fa-loc-topic">📖 {fa.topic}</div>
              <div className="fa-loc-path">{fa.location}</div>
            </div>
          ))}
          <div className="memhook" style={{ marginTop: 16 }}>🧠 {q.memoryHook}</div>
        </div>
      )}
    </div>
  );
}
