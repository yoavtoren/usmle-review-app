import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

function parseChapterMd(text) {
  const sections = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      const match = line.match(/^## (.+?) — (\d+)\/(\d+)/);
      if (match) {
        current = { title: match[1], seen: parseInt(match[2]), total: parseInt(match[3]), topics: [] };
        sections.push(current);
      }
    } else if (current && line.match(/^- \[[ x]\]/)) {
      const done = line.startsWith("- [x]");
      const title = line.replace(/^- \[[ x]\] /, "").trim();
      current.topics.push({ title, done });
    }
  }
  return sections;
}

function ChapterRow({ ch, onToggle }) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState(null);
  const pct = ch.total > 0 ? Math.round((ch.seen / ch.total) * 100) : 0;
  const fileName = ch.file.replace("chapters/", "");

  function handleExpand() {
    if (!open && !sections) {
      fetch(`${BASE}fa/chapters/${fileName}`)
        .then((r) => r.text())
        .then((t) => setSections(parseChapterMd(t)));
    }
    setOpen(!open);
  }

  return (
    <div className={`ch-row${open ? " ch-open" : ""}`}>
      <button className="ch-header" onClick={handleExpand}>
        <span className="ch-name">{ch.chapter.replace(/^\d+ /, "")}</span>
        <span className="ch-counts">
          {ch.seen}/{ch.total}
        </span>
        <div className="ch-bar-wrap">
          <div className="ch-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="ch-pct">{pct}%</span>
        <span className="ch-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && sections && (
        <div className="ch-detail">
          {sections.map((sec, si) => (
            <div key={si} className="sec-block">
              <div className="sec-title">
                {sec.title}
                <span className="sec-counts">{sec.seen}/{sec.total}</span>
              </div>
              <div className="topic-list">
                {sec.topics.map((t, ti) => (
                  <div
                    key={ti}
                    className={`topic-item${t.done ? " done" : ""}`}
                  >
                    <span className="topic-check">{t.done ? "✓" : "○"}</span>
                    <span className="topic-name">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FATracker({ onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE}fa/fa-progress.json`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="boot error">Could not load FA data: {error}</div>;
  if (!data) return <div className="boot">Loading First Aid data…</div>;

  const overallPct = Math.round((data.seen / data.totalTopics) * 100);

  return (
    <div className="fa-tracker">
      <div className="fa-header">
        <button className="back-btn" onClick={onBack}>← Dashboard</button>
        <div className="fa-title-row">
          <h1>First Aid Tracker</h1>
          <p className="muted">First Aid for USMLE Step 1 · 2026</p>
        </div>
      </div>

      <div className="fa-overview">
        <div className="fa-big-stat">
          <span className="fa-big-num">{data.seen}</span>
          <span className="fa-big-den"> / {data.totalTopics} topics covered</span>
        </div>
        <div className="fa-overall-bar-wrap">
          <div className="fa-overall-bar-fill" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="fa-pct-label">{overallPct}% overall coverage</p>
      </div>

      <div className="ch-list">
        {data.chapters.map((ch, i) => (
          <ChapterRow key={i} ch={ch} />
        ))}
      </div>

      <p className="footnote muted fa-footnote">
        To update counts: edit checkboxes in the .md files then run <code>python3 update_progress.py</code>.
      </p>
    </div>
  );
}
