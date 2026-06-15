import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { loadFATopics, saveFATopics, loadTasks, saveTasks, touchFASection } from "../lib/storage.js";
import { chaptersFromText } from "../lib/faMap.js";
import ReviewCharts from "./ReviewCharts.jsx";

const BASE = import.meta.env.BASE_URL;

// Resolve which FA chapters a "Read FA" task targets (new tasks carry faChapters;
// older ones are matched from their text/body).
function taskChapterFiles(t) {
  if (Array.isArray(t.faChapters) && t.faChapters.length) return t.faChapters.map(c => c.file);
  return chaptersFromText(`${t.text || ""} ${t.body || ""}`).map(c => c.file);
}

const FA_REVIEW_INTERVALS = {
  1: [14],
  2: [10],
  3: [5, 14],
  4: [3, 10],
  5: [2, 7, 14],
};

const DIFF_COLORS = ["", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

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

function DifficultyStars({ value, onChange }) {
  const color = DIFF_COLORS[value || 0];
  return (
    <span className="fa-diff-stars" onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(i => {
        const on = i <= (value || 0);
        return (
          <button
            key={i}
            className={`fa-diff-star${on ? " fa-diff-star-on" : ""}`}
            style={on ? { color } : {}}
            onClick={e => { e.stopPropagation(); onChange(i === value ? 0 : i); }}
            title={`Difficulty ${i}`}
          >{on ? "●" : "○"}</button>
        );
      })}
    </span>
  );
}

function ReviewBadge({ reviews, total, nextDueAt }) {
  const count = reviews?.length || 0;
  if (count >= total && total > 0) {
    return <span className="fa-rev-badge fa-rev-done">✓ {count}× done</span>;
  }
  const isDue = nextDueAt && new Date(nextDueAt) <= new Date();
  return (
    <span className={`fa-rev-badge${isDue ? " fa-rev-due" : ""}`}>
      {isDue ? "⚡ " : ""}Rev {count}/{total}
    </span>
  );
}

function ProgressChart({ lsTopics, chapterStats }) {
  const { showDates, maxTotal, chFileToColor } = useMemo(() => {
    const byDate = {};
    for (const [key, val] of Object.entries(lsTopics)) {
      if (!val.done || !val.doneAt) continue;
      const chFile = key.split("::")[0];
      const date = val.doneAt.slice(0, 10);
      if (!byDate[date]) byDate[date] = {};
      byDate[date][chFile] = (byDate[date][chFile] || 0) + 1;
    }
    const now = new Date();
    const dates = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      dates.push({
        date: iso,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        counts: byDate[iso] || {},
        total: Object.values(byDate[iso] || {}).reduce((a, b) => a + b, 0),
      });
    }
    const maxTotal = Math.max(...dates.map(d => d.total), 1);
    const chFileToColor = {};
    chapterStats.forEach(ch => { chFileToColor[ch.file] = ch.color; });
    return { showDates: dates, maxTotal, chFileToColor };
  }, [lsTopics, chapterStats]);

  const hasData = showDates.some(d => d.total > 0);
  if (!hasData) return null;

  const W = 600, H = 120;
  const n = showDates.length;
  const slotW = W / n;
  const barW = Math.max(3, Math.floor(slotW) - 2);

  return (
    <div className="fad-chart-card">
      <div className="fad-chart-head">
        <span className="fad-section-label">Daily progress</span>
        <span className="muted small">last 30 days</span>
      </div>
      <div className="fad-chart-wrap">
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="fad-chart-svg" preserveAspectRatio="xMidYMid meet">
          {showDates.map((d, i) => {
            if (d.total === 0) return null;
            const x = Math.floor(i * slotW + (slotW - barW) / 2);
            let y = H;
            return (
              <g key={d.date}>
                {Object.entries(d.counts).sort().map(([chFile, count]) => {
                  const barH = Math.max(2, Math.round((count / maxTotal) * H));
                  y -= barH;
                  const color = chFileToColor[chFile] || "#94a3b8";
                  const yPos = y;
                  return <rect key={chFile} x={x} y={yPos} width={barW} height={barH} fill={color} rx="1" />;
                })}
              </g>
            );
          })}
          {showDates
            .map((d, i) => ({ d, i }))
            .filter(({ i }) => i % 5 === 0 || i === n - 1)
            .map(({ d, i }) => (
              <text key={i} x={Math.floor(i * slotW + slotW / 2)} y={H + 13}
                textAnchor="middle" fontSize="7.5" fill="#94a3b8">
                {d.label}
              </text>
            ))}
        </svg>
      </div>
    </div>
  );
}

function DueReviewsPanel({ dueTopics, chapterStats, onMarkReviewed, onSetDifficulty }) {
  if (dueTopics.length === 0) return null;
  const chMap = {};
  chapterStats.forEach(ch => { chMap[ch.file] = ch; });

  return (
    <div className="fad-due-card">
      <div className="fad-due-head">
        <span className="fad-section-label">⚡ Due reviews</span>
        <span className="fad-due-count">{dueTopics.length} topic{dueTopics.length !== 1 ? "s" : ""} due</span>
      </div>
      <div className="fad-due-list">
        {dueTopics.map(({ key, topicTitle, chFile, reviews, totalReviewsTarget, difficulty }) => {
          const ch = chMap[chFile];
          const color = ch?.color || "#94a3b8";
          const chName = ch?.name || chFile;
          return (
            <div key={key} className="fad-due-item">
              <div className="fad-due-item-left">
                <span className="fad-due-dot" style={{ background: color }} />
                <div className="fad-due-info">
                  <span className="fad-due-topic">{topicTitle}</span>
                  <span className="fad-due-ch" style={{ color }}>{chName}</span>
                </div>
              </div>
              <div className="fad-due-item-right">
                <DifficultyStars value={difficulty} onChange={d => onSetDifficulty(key, d)} />
                <ReviewBadge reviews={reviews} total={totalReviewsTarget} nextDueAt={null} />
                <button className="fad-due-mark-btn" onClick={() => onMarkReviewed(key)}>
                  Reviewed ✓
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FADashboard({ onBack, onTrack }) {
  const [data, setData] = useState(null);
  const [allTopics, setAllTopics] = useState({});
  const [lsTopics, setLsTopics] = useState(loadFATopics);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);
  const [tasks, setTasks] = useState(loadTasks);

  // Pending "Read FA" tasks (from missed questions), grouped by FA chapter file.
  const faReviewsByChapter = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (t.type !== "read-fa" || t.done) continue;
      for (const file of taskChapterFiles(t)) {
        (map[file] = map[file] || []).push(t);
      }
    }
    return map;
  }, [tasks]);

  const totalFAReviews = useMemo(
    () => tasks.filter(t => t.type === "read-fa" && !t.done).length,
    [tasks]
  );

  function completeFAReview(taskId) {
    const next = tasks.map(t => {
      if (t.id !== taskId) return t;
      if (t.linkedFaSectionId) touchFASection(t.linkedFaSectionId);
      return { ...t, done: true };
    });
    setTasks(next);
    saveTasks(next);
  }

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
      let updated;
      if (wasDone) {
        updated = {
          done: false,
          doneAt: null,
          ...(cur?.difficulty ? { difficulty: cur.difficulty } : {}),
          reviews: [],
          nextDueAt: null,
          totalReviewsTarget: null,
        };
      } else {
        updated = { ...(cur || {}), done: true, doneAt: new Date().toISOString() };
      }
      const next = { ...prev, [key]: updated };
      saveFATopics(next);
      return next;
    });
  }, []);

  const handleSetDifficulty = useCallback((key, difficulty) => {
    setLsTopics(prev => {
      const cur = prev[key] || {};
      let updated;
      if (!difficulty) {
        const { difficulty: _d, reviews: _r, nextDueAt: _n, totalReviewsTarget: _t, ...rest } = cur;
        updated = rest;
      } else {
        const intervals = FA_REVIEW_INTERVALS[difficulty];
        const doneAtMs = cur.doneAt ? new Date(cur.doneAt).getTime() : Date.now();
        const nextDueAt = new Date(doneAtMs + intervals[0] * 86400000).toISOString();
        updated = {
          ...cur,
          difficulty,
          reviews: cur.reviews || [],
          nextDueAt,
          totalReviewsTarget: intervals.length,
        };
      }
      const next = { ...prev, [key]: updated };
      saveFATopics(next);
      return next;
    });
  }, []);

  const handleMarkReviewed = useCallback((key) => {
    setLsTopics(prev => {
      const cur = prev[key] || {};
      const difficulty = cur.difficulty || 1;
      const intervals = FA_REVIEW_INTERVALS[difficulty];
      const reviews = [
        ...(cur.reviews || []),
        { completedAt: new Date().toISOString(), reviewIndex: (cur.reviews || []).length },
      ];
      const nextIdx = reviews.length;
      const nextDueAt = nextIdx < intervals.length
        ? new Date(Date.now() + intervals[nextIdx] * 86400000).toISOString()
        : null;
      const next = {
        ...prev,
        [key]: { ...cur, reviews, nextDueAt, totalReviewsTarget: intervals.length },
      };
      saveFATopics(next);
      return next;
    });
  }, []);

  // Flatten FA reviews into chart events; rank = the topic's difficulty.
  const reviewEvents = useMemo(() => {
    const evs = [];
    for (const [key, val] of Object.entries(lsTopics)) {
      const rank = val.difficulty ?? null;
      for (const rev of (val.reviews || [])) {
        if (rev.completedAt) evs.push({ at: rev.completedAt.slice(0, 10), rank, topicId: key });
      }
    }
    return evs;
  }, [lsTopics]);

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

  // Expand + scroll to a chapter (used by FA-review links and arriving navigation).
  const focusChapter = useCallback((file) => {
    const ch = chapterStats.find(c => c.file === file);
    if (!ch) return;
    setSearch("");
    setExpanded(ch.idx);
    setTimeout(() => {
      const el = document.getElementById(`fad-ch-${ch.idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("fad-ch-flash");
        setTimeout(() => el.classList.remove("fad-ch-flash"), 1500);
      }
    }, 80);
  }, [chapterStats]);

  // Arriving from a "Read FA" task elsewhere → jump straight to that chapter.
  const location = useLocation();
  const focusFile = location.state?.focusChapter;
  useEffect(() => {
    if (focusFile && chapterStats.length) focusChapter(focusFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFile, chapterStats.length]);

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

  const dueReviews = useMemo(() => {
    const now = new Date();
    const result = [];
    for (const [key, val] of Object.entries(lsTopics)) {
      if (!val.done || !val.nextDueAt || !val.difficulty) continue;
      const reviews = val.reviews || [];
      const target = val.totalReviewsTarget || FA_REVIEW_INTERVALS[val.difficulty]?.length || 1;
      if (reviews.length >= target) continue;
      if (new Date(val.nextDueAt) > now) continue;
      const parts = key.split("::");
      const rawTitle = parts[2] || "";
      result.push({
        key,
        topicTitle: rawTitle.replace(/^\d+ /, ""),
        chFile: parts[0],
        reviews,
        totalReviewsTarget: target,
        difficulty: val.difficulty,
        nextDueAt: val.nextDueAt,
      });
    }
    return result.sort((a, b) => b.difficulty - a.difficulty || new Date(a.nextDueAt) - new Date(b.nextDueAt));
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
              ch, chIdx, sec, topic: t, key, isDone, ls,
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
            <span className="fad-hero-num">{dueReviews.length > 0 ? dueReviews.length : activityLog.length}</span>
            <span className="fad-hero-label">{dueReviews.length > 0 ? "Due reviews" : "Active days"}</span>
          </div>
        </div>
      </div>

      {/* Stacked progress bar */}
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

      {/* Progress chart */}
      <ProgressChart lsTopics={lsTopics} chapterStats={chapterStats} />

      {/* Review-progress charts (whole First Aid) */}
      <ReviewCharts events={reviewEvents} color="#4f46e5" />

      {/* Due reviews panel */}
      <DueReviewsPanel
        dueTopics={dueReviews}
        chapterStats={chapterStats}
        onMarkReviewed={handleMarkReviewed}
        onSetDifficulty={handleSetDifficulty}
      />

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
              const hasDiff = r.isDone && ls?.difficulty > 0;
              return (
                <div key={i} className={`fad-result-item-wrap${r.isDone ? " fad-result-done" : ""}`}>
                  <button
                    className="fad-result-item"
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
                  {r.isDone && (
                    <div className="fad-topic-meta">
                      <DifficultyStars
                        value={ls?.difficulty || 0}
                        onChange={d => handleSetDifficulty(r.key, d)}
                      />
                      {hasDiff && (
                        <ReviewBadge
                          reviews={ls?.reviews || []}
                          total={ls?.totalReviewsTarget || FA_REVIEW_INTERVALS[ls.difficulty]?.length || 1}
                          nextDueAt={ls?.nextDueAt}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Targeted FA reviews queued from missed questions */}
      {!search && totalFAReviews > 0 && (
        <div className="fad-review-panel">
          <div className="fad-review-head">
            <span className="fad-review-title">🔔 From your missed questions</span>
            <span className="fad-review-count">{totalFAReviews} to read</span>
          </div>
          <div className="fad-review-list">
            {chapterStats
              .filter(ch => faReviewsByChapter[ch.file]?.length)
              .map(ch => (
                <div key={ch.file} className="fad-review-group">
                  <button className="fad-review-ch" style={{ "--c": ch.color }}
                    onClick={() => focusChapter(ch.file)}>
                    <span className="fad-review-ch-dot" style={{ background: ch.color }} />
                    {ch.name}
                    <span className="fad-review-ch-n">{faReviewsByChapter[ch.file].length}</span>
                  </button>
                  {faReviewsByChapter[ch.file].map(t => (
                    <div key={t.id} className="fad-review-item">
                      <button className="fad-review-item-txt" title="Open this chapter in the list below"
                        onClick={() => focusChapter(ch.file)}>
                        {t.body || t.text} <span className="fad-review-go">→</span>
                      </button>
                      <button className="fad-review-done" onClick={() => completeFAReview(t.id)}>
                        ✓ Read
                      </button>
                    </div>
                  ))}
                </div>
              ))}
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
                <div key={idx} id={`fad-ch-${idx}`} className={`fad-ch-card${isOpen ? " fad-ch-open" : ""}`}>
                  <button className="fad-ch-header" onClick={() => setExpanded(isOpen ? null : idx)}>
                    <span className="fad-ch-accent" style={{ background: ch.color }} />
                    <span className="fad-ch-name">{ch.name}</span>
                    {faReviewsByChapter[ch.file]?.length > 0 && (
                      <span className="fad-ch-bell" title={`${faReviewsByChapter[ch.file].length} review${faReviewsByChapter[ch.file].length > 1 ? "s" : ""} waiting from missed questions`}>
                        🔔 {faReviewsByChapter[ch.file].length}
                      </span>
                    )}
                    <div className="fad-ch-bar-wrap">
                      <div className="fad-ch-bar-fill" style={{ width: `${ch.pct}%`, background: ch.color }} />
                    </div>
                    <span className="fad-ch-pct" style={{ color: ch.color }}>{ch.pct}%</span>
                    <span className="fad-ch-count">{ch.done}/{ch.total}</span>
                    <span className="fad-ch-chev" style={{ color: ch.color }}>{isOpen ? "▲" : "▼"}</span>
                  </button>

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
                                const hasDiff = isDone && (ls?.difficulty > 0);
                                return (
                                  <div key={ti} className={`fad-topic-item${isDone ? " fad-topic-done" : ""}`}>
                                    <button
                                      className="fad-topic-toggle"
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
                                    {isDone && (
                                      <div className="fad-topic-meta">
                                        <DifficultyStars
                                          value={ls?.difficulty || 0}
                                          onChange={d => handleSetDifficulty(key, d)}
                                        />
                                        {hasDiff && (
                                          <>
                                            <ReviewBadge
                                              reviews={ls?.reviews || []}
                                              total={ls?.totalReviewsTarget || FA_REVIEW_INTERVALS[ls.difficulty]?.length || 1}
                                              nextDueAt={ls?.nextDueAt}
                                            />
                                            <button className="fad-rev-log" title="Log a review (+1)"
                                              onClick={() => handleMarkReviewed(key)}>
                                              🔁 +
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
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
