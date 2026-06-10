import { useState, useEffect } from "react";
import { rate, setDifficulty, getCard, recordActivity } from "../lib/storage.js";

// 🔴 fatal/critical | 🟠 demographic/risk | 🔵 key context | 🟢 confirmatory | 🟣 trap
const CLUE = {
  red:    { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5", emoji: "🔴", label: "Critical" },
  orange: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", emoji: "🟠", label: "Risk factor" },
  blue:   { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd", emoji: "🔵", label: "Key context" },
  green:  { bg: "#dcfce7", text: "#166534", border: "#86efac", emoji: "🟢", label: "Confirms" },
  purple: { bg: "#f3e8ff", text: "#7e22ce", border: "#d8b4fe", emoji: "🟣", label: "Trap" },
};

const DIFF_OPTIONS = [
  ["knowledge",    "📚 Knowledge gap"],
  ["comprehension","🧭 Misread question"],
  ["vocab",        "🔤 Vocabulary"],
  ["imaging",      "🖼️ Imaging/diagram"],
  ["distractor",   "🧲 Pulled by distractor"],
  ["other",        "✍️ Something else"],
];

// ── Inline highlight helpers ─────────────────────────────────────────────────

function findInText(text, search) {
  const lower = text.toLowerCase();
  let idx = lower.indexOf(search.toLowerCase());
  if (idx !== -1) return { start: idx, end: idx + search.length };
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

// ── FA breadcrumb parser ─────────────────────────────────────────────────────
function FABreadcrumb({ location }) {
  const parts = location.split(/\s*[>›]\s*/);
  return (
    <div className="fa-breadcrumb">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="fa-sep"> › </span>}
          <span className={i === parts.length - 1 ? "fa-bc-leaf" : "fa-bc-node"}>{p.trim()}</span>
        </span>
      ))}
    </div>
  );
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

  const clues      = q.clues || [];
  const correctOpt = q.options.find(o => o.correct);
  const wrongOpts  = q.options.filter(o => !o.correct);
  const { segs, unmatched } = buildSegments(q.vignette, clues);

  function toggleClue(key) { setOpenClue(openClue === key ? null : key); }
  function handleRate(r)   { recordActivity(); onProgress(rate(q.id, r)); }
  function handleDiff(d)   { onProgress(setDifficulty(q.id, d)); }

  const TAB_KEYS = { "1": "q", "2": "e", "3": "a", "4": "k", "5": "f" };
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (TAB_KEYS[e.key]) { setTab(TAB_KEYS[e.key]); return; }
      if (tab === "a") {
        if ((e.key === " " || e.key === "Enter") && !revealed) {
          e.preventDefault(); setRevealed(true); setStep(0); return;
        }
        if (revealed) {
          if ((e.key === "ArrowRight" || e.key === "n") && step < q.reasoning.length - 1) {
            e.preventDefault(); setStep(s => s + 1); return;
          }
          if (e.key === "g" || e.key === "G") { handleRate("got"); return; }
          if (e.key === "r" || e.key === "R") { handleRate("again"); return; }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, revealed, step, q.id]);

  const TABS = [
    ["q", "📖 Question"],
    ["e", "🚫 Eliminate"],
    ["a", "🎯 Answer"],
    ["k", "🔑 Keywords"],
    ["f", "📚 First Aid"],
  ];

  return (
    <div className="qcard">

      {/* ── Keyboard hint bar ── */}
      <div className="kbd-hint">
        <span><kbd>1</kbd>–<kbd>5</kbd> tabs</span>
        {tab === "a" && !revealed && <span><kbd>Space</kbd> reveal</span>}
        {tab === "a" && revealed && step < q.reasoning.length - 1 && <span><kbd>→</kbd> next step</span>}
        {tab === "a" && revealed && <span><kbd>G</kbd> got it · <kbd>R</kbd> again</span>}
      </div>

      {/* ── Header ── */}
      <div className="qcard-head">
        <div className="qcard-pills">
          <span className="qpill accent">{q.system}</span>
          <span className="qpill ghost">{q.topic}</span>
          {q.percentCorrect != null && (
            <span className={`qpill ${q.percentCorrect < 50 ? "danger" : "ghost"}`}>
              🎯 {q.percentCorrect}% correct nationally
            </span>
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
          Spec: vignette with inline clue highlights →
          answer choices → lock-in guess. No passive text.
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
                const isOpen = openClue === key;
                return (
                  <span key={i}>
                    <button
                      className={`iclue${isOpen ? " iclue-open" : ""}`}
                      style={{ background: c.bg, color: c.text, borderColor: c.border }}
                      onClick={() => toggleClue(key)}
                    >
                      {c.emoji} {seg.val}
                    </button>
                    {isOpen && (
                      <span className="clue-inline-panel" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
                        <strong>{c.emoji} {c.label}:</strong> {clues[seg.ci].note}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Unmatched clues (inferred, not in vignette text) */}
          {unmatched.length > 0 && (
            <div className="clue-tags">
              {unmatched.map(ci => {
                const c = CLUE[clues[ci].type] || CLUE.blue;
                const key = `uc-${ci}`;
                const isOpen = openClue === key;
                return (
                  <div key={ci}>
                    <button
                      className={`clue-tag${isOpen ? " clue-tag-open" : ""}`}
                      style={{ background: c.bg, color: c.text, borderColor: c.border }}
                      onClick={() => toggleClue(key)}
                    >
                      {c.emoji} {clues[ci].text}
                    </button>
                    {isOpen && (
                      <div className="clue-panel" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
                        {clues[ci].note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* What's actually relevant + Strategy — always visible in Question tab */}
          {q.whatMatters && (
            <div className="callout-wm">
              <span className="ci">🧩</span>
              <div><strong>What's actually relevant:</strong> {q.whatMatters}</div>
            </div>
          )}
          {q.strategy && (
            <div className="callout-strat">
              <span className="ci">🧠</span>
              <div><strong>In these kinds of questions, think about:</strong> {q.strategy}</div>
            </div>
          )}

          {/* Answer options */}
          <p className="tab-hint">👆 Lock in your guess before checking the answer</p>
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
              🔒 Locked: <strong>{locked}</strong>
              <button className="lock-go-btn" onClick={() => setTab("a")}>
                → Check answer
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2 — ELIMINATE
          Spec: "Eliminated because [reason]. ✅ Correct if: [trigger]."
      ══════════════════════════════════════════════ */}
      {tab === "e" && (
        <div className="qtab-body">
          <p className="tab-hint">👆 Tap each wrong answer to see why it fails</p>
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
                    <div className="elim-why">
                      <span className="elim-why-icon">🚫</span>
                      <div>
                        <span className="elim-why-label">Eliminated because</span>
                        <span className="elim-why-text">{elim.why}</span>
                      </div>
                    </div>
                    {elim.correctIf ? (
                      <div className="elim-correct-if">
                        <span className="elim-ci-icon">✅</span>
                        <div>
                          <span className="elim-ci-label">Correct if</span>
                          <span className="elim-ci-text">{elim.correctIf}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="elim-what">
                        <span className="elim-what-icon">📋</span>
                        <span className="elim-what-text">{elim.what}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 3 — ANSWER
          Spec: hidden reveal → reasoning chain on tap →
          mechanism. whatMatters + strategy shown here
          (after commit) not in question tab.
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
                    ? `🎉 Correct! You locked in ${locked}.`
                    : `You locked ${locked} — correct is ${q.correct}.`}
                </div>
              )}
              {q.yourAnswer && q.yourAnswer !== q.correct && (
                <p className="muted small">On the real exam you picked <strong>{q.yourAnswer}</strong>.</p>
              )}

              {q.whatMatters && (
                <div className="callout-wm">
                  <span className="ci">🧩</span>
                  <div><strong>What's actually relevant:</strong> {q.whatMatters}</div>
                </div>
              )}
              {q.strategy && (
                <div className="callout-strat">
                  <span className="ci">🧠</span>
                  <div><strong>In these kinds of questions, think about:</strong> {q.strategy}</div>
                </div>
              )}

              {/* Reasoning chain — builds on tap */}
              <h3 className="sec-head">🔗 Reasoning chain</h3>
              <div className="chain">
                {q.reasoning.slice(0, step + 1).map((s, i) => {
                  const match = clues.find(c =>
                    c.text.split(/\s*[+,]\s*/)[0] &&
                    s.toLowerCase().includes(c.text.split(/\s*[+,]\s*/)[0].toLowerCase().slice(0, 8))
                  );
                  const c = match ? (CLUE[match.type] || CLUE.blue) : null;
                  const isLast = i === q.reasoning.length - 1;
                  return (
                    <div
                      key={i}
                      className={`chain-step${isLast ? " chain-step-final" : ""}`}
                      style={c ? { borderLeftColor: c.text } : {}}
                    >
                      <span className="chain-num">{i + 1}</span>
                      {c && <span className="chain-clue-emoji">{c.emoji}</span>}
                      <span>{s}</span>
                    </div>
                  );
                })}
                {step < q.reasoning.length - 1 && (
                  <button className="chain-next" onClick={() => setStep(step + 1)}>
                    👆 Step {step + 2} / {q.reasoning.length}
                  </button>
                )}
              </div>

              {/* Mechanism */}
              <div className="callout-block important" style={{ marginTop: 16 }}>
                <span className="ci">⚙️</span>
                <div><strong>Mechanism:</strong> {q.mechanism}</div>
              </div>

              {/* Memory hook */}
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

                <h3 className="sec-head">📅 Next review</h3>
                <div className="rate-row">
                  <button className="rate again" onClick={() => handleRate("again")}>
                    🔁 Again soon
                  </button>
                  <button className="rate got" onClick={() => handleRate("got")}>
                    ✅ Got it
                  </button>
                </div>
                {card.dueAt && (
                  <p className="muted small">
                    Next: {new Date(card.dueAt).toLocaleDateString()} · {card.status}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 4 — KEYWORDS
          Spec: flip-on-tap "If you see X" → "think Y"
      ══════════════════════════════════════════════ */}
      {tab === "k" && (
        <div className="qtab-body">
          <p className="tab-hint">👆 Tap to flip — "If you see…" → "Think…"</p>
          <div className="cardgrid">
            {(q.keywords || []).map((kw, i) => (
              <button
                key={i}
                className={`flip${flipped[i] ? " on" : ""}`}
                onClick={() => setFlipped({ ...flipped, [i]: !flipped[i] })}
              >
                {flipped[i]
                  ? <><span className="flip-arrow">→</span> <strong>{kw.back}</strong></>
                  : <><span className="flip-prompt">If you see:</span><br /><strong>{kw.front}</strong></>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 5 — FIRST AID
          Spec: "Chapter › Section › What to read" +
          one best mnemonic as memory hook.
      ══════════════════════════════════════════════ */}
      {tab === "f" && (
        <div className="qtab-body">
          <p className="tab-hint">📚 Go read these exact sections</p>
          {(q.firstAid || []).map((fa, i) => (
            <div key={i} className="fa-loc-card">
              <div className="fa-loc-topic">📖 {fa.topic}</div>
              <FABreadcrumb location={fa.location} />
            </div>
          ))}
          <div className="memhook fa-memhook">
            <div className="memhook-label">🧠 Mnemonic</div>
            <div className="memhook-text">{q.memoryHook}</div>
          </div>
        </div>
      )}
    </div>
  );
}
