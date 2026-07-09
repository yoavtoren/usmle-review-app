import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadProgress, getCard, isDue, stampQuestionsSeen } from "../lib/storage.js";
import { IconBox } from "./icons.jsx";

// Map a deck question to the TestReview block key ("test1".."test6").
function blockKey(q) {
  if (!q.block) return "test1";
  const n = q.block.replace(/\D/g, "");
  return `test${n}`;
}
function blockLabel(q) {
  if (!q.block) return "T1";
  return "T" + q.block.replace(/\D/g, "");
}

function agoLabel(ms) {
  if (!ms) return null;
  const days = Math.floor((Date.now() - ms) / 86400000);
  const date = new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days <= 0) return `today · ${date}`;
  if (days === 1) return `1 day ago · ${date}`;
  if (days < 30) return `${days} days ago · ${date}`;
  return date;
}
function addedLabel(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_META = {
  new:      { label: "New",      cls: "qb-st-new" },
  review:   { label: "Reviewing", cls: "qb-st-review" },
  mastered: { label: "Mastered", cls: "qb-st-mastered" },
};

export default function QuestionBank({ questions = [] }) {
  const nav = useNavigate();
  const [progress] = useState(loadProgress);

  const [result, setResult] = useState("all");   // all | correct | incorrect
  const [status, setStatus] = useState("all");   // all | new | review | mastered | due
  const [system, setSystem] = useState("all");
  const [query, setQuery]   = useState("");
  const [sort, setSort]     = useState("added");  // added | addedOld | reviewed | system | pct

  const systems = useMemo(
    () => [...new Set(questions.map((q) => q.system))].sort(),
    [questions]
  );

  // Stamp every question with its first-seen ("imported to the app") time so the
  // bank can order by when questions entered the app, not by which test they came
  // from. New imports get later stamps → they sort to the top under "Newest".
  const seen = useMemo(() => stampQuestionsSeen(questions.map((q) => q.id)), [questions]);

  const rows = useMemo(() => {
    let list = questions.map((q) => {
      const card = getCard(progress, q.id);
      return {
        q,
        card,
        reviewedAt: card.lastReviewed || 0,
        addedAt: seen[q.id] || 0,
        qidNum: Number(q.qid) || 0,
      };
    });

    list = list.filter(({ q, card }) => {
      if (system !== "all" && q.system !== system) return false;
      if (result === "correct" && q.missed) return false;
      if (result === "incorrect" && !q.missed) return false;
      if (status === "due" && !(card.status === "review" && isDue(card))) return false;
      if (status !== "all" && status !== "due" && card.status !== status) return false;
      if (query) {
        const hay = `${q.qid} ${q.title} ${q.system} ${q.topic}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });

    const cmp = {
      added:    (a, b) => b.addedAt - a.addedAt || b.qidNum - a.qidNum,
      addedOld: (a, b) => a.addedAt - b.addedAt || a.qidNum - b.qidNum,
      reviewed: (a, b) => b.reviewedAt - a.reviewedAt,
      system:   (a, b) => a.q.system.localeCompare(b.q.system) || b.addedAt - a.addedAt,
      // Hardest first; questions with no known % are unknown, not 0 → sort last.
      pct:      (a, b) => {
        const ap = a.q.percentCorrect, bp = b.q.percentCorrect;
        if (ap == null && bp == null) return 0;
        if (ap == null) return 1;
        if (bp == null) return -1;
        return ap - bp;
      },
    }[sort];
    return list.sort(cmp);
  }, [questions, progress, seen, system, result, status, query, sort]);

  const tally = useMemo(() => {
    let correct = 0, incorrect = 0, reviewed = 0, mastered = 0;
    for (const q of questions) {
      if (q.missed) incorrect++; else correct++;
      const c = getCard(progress, q.id);
      if (c.lastReviewed) reviewed++;
      if (c.status === "mastered") mastered++;
    }
    return { total: questions.length, correct, incorrect, reviewed, mastered };
  }, [questions, progress]);

  return (
    <div className="page qb-page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow"><IconBox size={13} /> Question Bank</div>
          <h1 className="td-title">Question Bank</h1>
          <p className="td-sub">
            Every question you've imported, newest first by when it was added to the app. Filter by
            topic, result, and review recency.
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="qb-tiles">
        <Tile n={tally.total} label="questions" />
        <Tile n={tally.correct} label="correct" tone="ok" />
        <Tile n={tally.incorrect} label="incorrect" tone="bad" />
        <Tile n={tally.reviewed} label="reviewed" tone="accent" />
        <Tile n={tally.mastered} label="mastered" tone="gold" />
      </div>

      {/* Controls */}
      <div className="qb-controls">
        <input
          className="td-input qb-search"
          placeholder="Search Q#, title, system, topic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select label="Subject / system" value={system} onChange={setSystem}
          options={[["all", "All subjects"], ...systems.map((s) => [s, s])]} />
        <Select label="Result" value={result} onChange={setResult}
          options={[["all", "Correct + incorrect"], ["incorrect", "Incorrect only"], ["correct", "Correct only"]]} />
        <Select label="Review status" value={status} onChange={setStatus}
          options={[["all", "Any status"], ["new", "New"], ["review", "Reviewing"], ["due", "Due now"], ["mastered", "Mastered"]]} />
        <Select label="Sort by" value={sort} onChange={setSort}
          options={[["added", "Newest added"], ["addedOld", "Oldest added"], ["reviewed", "Last reviewed"], ["system", "Subject"], ["pct", "% correct (hardest)"]]} />
      </div>

      <p className="qb-count muted">{rows.length} of {tally.total} shown</p>

      {/* Table */}
      <div className="qb-table-wrap">
        <table className="qb-table">
          <thead>
            <tr>
              <th className="qb-th-num">Q#</th>
              <th>Question</th>
              <th>Subject / system</th>
              <th>Topic</th>
              <th>Result</th>
              <th>Review status</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ q, card, addedAt }) => {
              const st = STATUS_META[card.status] || STATUS_META.new;
              const rev = agoLabel(card.lastReviewed);
              const due = card.status === "review" && isDue(card);
              const open = () => nav("/tests/review", { state: { block: blockKey(q), filter: "all", focusId: q.id } });
              return (
                <tr
                  key={q.id}
                  className="qb-row"
                  tabIndex={0}
                  role="link"
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
                  }}
                  title="Open in Test Review"
                >
                  <td className="qb-td-num">{q.qid}</td>
                  <td className="qb-td-title">
                    <span className="qb-block">{blockLabel(q)}·{q.item}</span>
                    {q.title}
                  </td>
                  <td className="qb-td-sys">{q.system}</td>
                  <td className="qb-td-topic">{q.topic}</td>
                  <td>
                    {q.missed
                      ? <span className="qb-badge qb-bad">✗ Incorrect</span>
                      : <span className="qb-badge qb-ok">✓ Correct</span>}
                  </td>
                  <td>
                    <span className={`qb-badge ${st.cls}`}>{st.label}</span>
                    {due && <span className="qb-badge qb-due">Due</span>}
                    {card.done && <span className="qb-done">✓</span>}
                  </td>
                  <td className="qb-td-rev">
                    {addedLabel(addedAt) || <span className="muted">—</span>}
                    {rev && <span className="qb-rev-sub muted"> · reviewed {rev}</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="qb-empty muted">No questions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="footnote muted qb-foot">
        {questions.length === 0
          ? "No questions loaded yet. New question sets are added with app updates."
          : "100% local · new question sets are added with app updates and appear here at the top, ordered by when they were added to the app."}
      </p>
    </div>
  );
}

function Tile({ n, label, tone }) {
  return (
    <div className={`qb-tile${tone ? " qb-tile-" + tone : ""}`}>
      <span className="qb-tile-n">{n}</span>
      <span className="qb-tile-l">{label}</span>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="qb-select">
      <span className="qb-select-lbl">{label}</span>
      <select className="td-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
