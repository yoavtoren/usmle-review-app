import { useEffect, useState, useMemo, useCallback } from "react";
import { loadFATopics, saveFATopics } from "../lib/storage.js";

const BASE = import.meta.env.BASE_URL;

const CHAPTER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f43f5e", "#84cc16", "#6366f1",
  "#f59e0b", "#10b981", "#a855f7", "#0ea5e9",
];

const CHAPTER_SOFT = [
  "#fee2e2", "#ffedd5", "#fef9c3", "#dcfce7",
  "#cffafe", "#dbeafe", "#ede9fe", "#fce7f3",
  "#ccfbf1", "#ffe4e6", "#ecfccb", "#e0e7ff",
  "#fef3c7", "#d1fae5", "#f3e8ff", "#e0f2fe",
];

function parseChapterMd(text) {
  const sections = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      const match = line.match(/^## (.+?) — \d+\/\d+/);
      if (match) {
        current = { title: match[1].replace(/^\d+ /, ""), rawTitle: match[1], topics: [] };
        sections.push(current);
      }
    } else if (current && line.match(/^- \[[ x]\]/)) {
      const done = line.startsWith("- [x]");
      const rawTitle = line.replace(/^- \[[ x]\] /, "").trim();
      const title = rawTitle.replace(/^\d+ /, "");
      current.topics.push({ title, rawTitle, markdownDone: done });
    }
  }
  return sections;
}

function topicKey(chFile, sectionRawTitle, topicRawTitle) {
  return `${chFile}::${sectionRawTitle}::${topicRawTitle}`;
}

function ProgressRing({ pct, color = "var(--accent)", size = 110 }) {
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{pct}%</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="9" fill="var(--muted)">covered</text>
    </svg>
  );
}

export default function FADashboard({ onBack, onTrack }) {
  const [data, setData] = useState(null);
  const [allTopics, setAllTopics] = useState({});
  const [lsTopics, setLsTopics] = useState(loadFATopics);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BASE}fa/fa-progress.json`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        Promise.all(
          d.chapters.map(ch =>
            fetch(`${BASE}fa/${ch.file}`)
              .then(r => r.text())
              .then(text => [ch.file, parseChapterMd(text)])
              .catch(() => [ch.file, []])
          )
        ).then(results => {
          const map = {};
          results.forEach(([file, sections]) => { map[file] = sections; });
          setAllTopics(map);
          setChaptersLoaded(true);
        });
      })
      .catch(() => setChaptersLoaded(true));
  }, []);

  const toggle = useCallback((key, markdownDone) => {
    setLsTopics(prev => {
      const cur = prev[key];
      const wasDone = cur !== undefined ? cur.done : markdownDone;
      const next = {
        ...prev,
        [key]: { done: !wasDone, doneAt: !wasDone ? new Date().toISOString() : null },
      };
      saveFATopics(next);
      return next;
    });
  }, []);

  const chapterStats = useMemo(() => {
    if (!data) return [];
    return data.chapters.map((ch, idx) => {
      const sections = allTopics[ch.file] || [];
      let done = 0, total = 0;
      for (const sec of sections) {
        for (const t of sec.topics) {
          total++;
          const ls = lsTopics[topicKey(ch.file, sec.rawTitle, t.rawTitle)];
          if (ls !== undefined ? ls.done : t.markdownDone) done++;
        }
      }
      if (total === 0) { total = ch.total; done = ch.seen; }
      return {
        ...ch,
        idx,
        done,
        total,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        color: CHAPTER_COLORS[idx % CHAPTER_COLORS.length],
        soft: CHAPTER_SOFT[idx % CHAPTER_SOFT.length],
        name: ch.chapter.replace(/^\d+ /, ""),
      };
    });
  }, [data, allTopics, lsTopics]);

  const overallStats = useMemo(() => {
    const done = chapterStats.reduce((s, c) => s + c.done, 0);
    const total = chapterStats.reduce((s, c) => s + c.total, 0);
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [chapterStats]);

  const activityLog = useMemo(() => {
    const byDate = {};
    for (const val of Object.values(lsTopics)) {
      if (val.done && val.doneAt) {
        const d = new Date(val.doneAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        byDate[d] = (byDate[d] || 0) + 1;
      }
    }
    return Object.entries(byDate)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 10);
  }, [lsTopics]);

  const searchResults = useMemo(() => {
    if (!search.trim() || !data) return [];
    const q = search.toLowerCase();
    const results = [];
    for (let chIdx = 0; chIdx < data.chapters.length; chIdx++) {
      const ch = data.chapters[chIdx];
      const sections = allTopics[ch.file] || [];
      for (const sec of sections) {
        for (const t of sec.topics) {
          if (t.title.toLowerCase().includes(q) || sec.title.toLowerCase().includes(q)) {
            const key = topicKey(ch.file, sec.rawTitle, t.rawTitle);
            const ls = lsTopics[key];
            const isDone = ls !== undefined ? ls.done : t.markdownDone;
            results.push({
              ch, chIdx, sec, topic: t, key, isDone,
              color: CHAPTER_COLORS[chIdx % CHAPTER_COLORS.length],
              soft: CHAPTER_SOFT[chIdx % CHAPTER_SOFT.length],
              chName: ch.chapter.replace(/^\d+ /, ""),
            });
          }
        }
      }
    }
    return results.slice(0, 50);
  }, [search, data, allTopics, lsTopics]);

  if (!data) return <div className="boot">Loading dashboard…</div>;

  return (
    <div className="fad-page">
      <button className="back-btn" onClick={onBack}>← Home</button>

      {/* Header */}
      <div className="fad-header">
        <div>
          <h1 className="fad-title">First Aid Progress</h1>
          <p className="muted fad-sub">First Aid for USMLE Step 1 · 2026 — auto-saved to this browser</p>
        </div>
        {onTrack && (
          <button className="dash-cta-btn" onClick={onTrack} style={{ flexShrink: 0 }}>
            Markdown view →
          </button>
        )}
      </div>

      {/* Hero */}
      <div className="fad-hero">
        <ProgressRing pct={overallStats.pct} size={118} />
        <div className="fad-hero-stats">
          <div className="fad-hero-stat">
            <span className="fad-hero-num" style={{ color: "var(--ok)" }}>{overallStats.done}</span>
            <span className="fad-hero-label">Topics done</span>
          </div>
          <div className="fad-vdiv" />
          <div className="fad-hero-stat">
            <span className="fad-hero-num fad-muted-num">{overallStats.total - overallStats.done}</span>
            <span className="fad-hero-label">Remaining</span>
          </div>
          <div className="fad-vdiv" />
          <div className="fad-hero-stat">
            <span className="fad-hero-num">{chapterStats.length}</span>
            <span className="fad-hero-label">Chapters</span>
          </div>
          <div className="fad-vdiv" />
          <div className="fad-hero-stat">
            <span className="fad-hero-num">{activityLog.length}</span>
            <span className="fad-hero-label">Active days</span>
          </div>
        </div>
      </div>

      {/* Multi-segment stacked progress bar */}
      <div className="fad-stack-wrap">
        <div className="fad-stack-bar">
          {chapterStats.map((ch, i) => ch.done > 0 && (
            <div
              key={i}
              className="fad-stack-seg"
              style={{ flex: ch.done, background: ch.color }}
              title={`${ch.name}: ${ch.done} done`}
            />
          ))}
          {overallStats.total - overallStats.done > 0 && (
            <div className="fad-stack-seg fad-stack-rem" style={{ flex: overallStats.total - overallStats.done }} />
          )}
        </div>
        <div className="fad-stack-legend">
          {chapterStats.filter(c => c.done > 0).map((ch, i) => (
            <span key={i} className="fad-legend-chip" style={{ borderColor: ch.color, color: ch.color }}>
              <span className="fad-legend-dot" style={{ background: ch.color }} />
              {ch.name}
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="fad-search-wrap">
        <span className="fad-search-icon">⌕</span>
        <input
          className="fad-search"
          placeholder={chaptersLoaded ? "Search topics across all chapters…" : "Loading topics for search…"}
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={!chaptersLoaded}
        />
        {search && (
          <button className="fad-search-clear" onClick={() => setSearch("")}>✕</button>
        )}
      </div>

      {/* Search results */}
      {search && (
        <div className="fad-results-card">
          <div className="fad-results-head">
            <span className="fad-results-label">
              {searchResults.length === 0
                ? `No topics match "${search}"`
                : `${searchResults.length} topic${searchResults.length !== 1 ? "s" : ""} found`}
            </span>
            {searchResults.length > 0 && (
              <span className="muted small">click to toggle done</span>
            )}
          </div>
          <div className="fad-result-list">
            {searchResults.map((r, i) => {
              const ls = lsTopics[r.key];
              const doneAt = ls?.doneAt
                ? new Date(ls.doneAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              return (
                <button
                  key={i}
                  className={`fad-result-item${r.isDone ? " fad-result-done" : ""}`}
                  onClick={() => toggle(r.key, r.topic.markdownDone)}
                >
                  <span
                    className="fad-result-check-box"
                    style={r.isDone ? { background: r.color, borderColor: r.color } : {}}
                  >
                    {r.isDone ? "✓" : ""}
                  </span>
                  <span className="fad-result-body">
                    <span className="fad-result-topic-name">{r.topic.title}</span>
                    <span className="fad-result-path">
                      <span style={{ color: r.color, fontWeight: 700 }}>{r.chName}</span>
                      {" · "}{r.sec.title}
                      {doneAt && <span className="fad-result-doneAt"> · done {doneAt}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chapter grid */}
      {!search && (
        <div className="fad-chapters">
          <div className="fad-chapters-head">
            <span className="fad-section-label">Chapters</span>
            {!chaptersLoaded && <span className="fad-loading-pill">Loading topics…</span>}
          </div>

          <div className="fad-ch-list">
            {chapterStats.map((ch, idx) => {
              const isOpen = expanded === idx;
              const sections = allTopics[ch.file] || [];
              return (
                <div key={idx} className={`fad-ch-card${isOpen ? " fad-ch-open" : ""}`}>
                  {/* Chapter header row */}
                  <button className="fad-ch-header" onClick={() => setExpanded(isOpen ? null : idx)}>
                    <span className="fad-ch-accent" style={{ background: ch.color }} />
                    <span className="fad-ch-name">{ch.name}</span>
                    <div className="fad-ch-bar-wrap">
                      <div
                        className="fad-ch-bar-fill"
                        style={{ width: `${ch.pct}%`, background: ch.color }}
                      />
                    </div>
                    <span className="fad-ch-pct" style={{ color: ch.color }}>{ch.pct}%</span>
                    <span className="fad-ch-count">{ch.done}/{ch.total}</span>
                    <span className="fad-ch-chev" style={{ color: ch.color }}>{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded topic list */}
                  {isOpen && (
                    <div className="fad-ch-body">
                      {sections.length === 0 && !chaptersLoaded && (
                        <p className="muted small" style={{ padding: "12px 16px" }}>Loading…</p>
                      )}
                      {sections.length === 0 && chaptersLoaded && (
                        <p className="muted small" style={{ padding: "12px 16px" }}>No topics found.</p>
                      )}
                      {sections.map((sec, si) => {
                        const secDoneCount = sec.topics.filter(t => {
                          const key = topicKey(ch.file, sec.rawTitle, t.rawTitle);
                          const ls = lsTopics[key];
                          return ls !== undefined ? ls.done : t.markdownDone;
                        }).length;
                        return (
                          <div key={si} className="fad-sec-block">
                            <div className="fad-sec-head">
                              <span className="fad-sec-title">{sec.title}</span>
                              <span
                                className="fad-sec-count"
                                style={{ background: ch.soft, color: ch.color, border: `1px solid ${ch.color}33` }}
                              >
                                {secDoneCount}/{sec.topics.length}
                              </span>
                            </div>
                            <div className="fad-topic-list">
                              {sec.topics.map((t, ti) => {
                                const key = topicKey(ch.file, sec.rawTitle, t.rawTitle);
                                const ls = lsTopics[key];
                                const isDone = ls !== undefined ? ls.done : t.markdownDone;
                                const doneAt = ls?.doneAt
                                  ? new Date(ls.doneAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                  : null;
                                return (
                                  <button
                                    key={ti}
                                    className={`fad-topic-item${isDone ? " fad-topic-done" : ""}`}
                                    onClick={() => toggle(key, t.markdownDone)}
                                  >
                                    <span
                                      className="fad-topic-check"
                                      style={isDone ? { background: ch.color, borderColor: ch.color, color: "#fff" } : {}}
                                    >
                                      {isDone ? "✓" : ""}
                                    </span>
                                    <span className="fad-topic-name">{t.title}</span>
                                    {doneAt && (
                                      <span className="fad-topic-date" style={{ color: ch.color }}>{doneAt}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity log */}
      {activityLog.length > 0 && !search && (
        <div className="fad-activity-card">
          <div className="fad-activity-head">
            <span className="fad-section-label">Recent activity</span>
            <span className="muted small">auto-recorded when you toggle topics</span>
          </div>
          <div className="fad-activity-list">
            {activityLog.map(([date, count], i) => (
              <div key={i} className="fad-activity-row">
                <span className="fad-activity-date">{date}</span>
                <div className="fad-activity-bar-wrap">
                  <div
                    className="fad-activity-bar"
                    style={{ width: `${Math.min(100, (count / Math.max(...activityLog.map(([, n]) => n))) * 100)}%` }}
                  />
                </div>
                <span className="fad-activity-count">+{count} topic{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
