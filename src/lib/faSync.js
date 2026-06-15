// ── Sync between "Read FA" tasks and the First Aid tracker / book ───────────
// Completing a Read-FA task marks the matching topic as done in the FA tracker
// (fa-topics-v2), and we can resolve a precise First Aid page number for a topic
// from the book's own index (fa-index.json).

import { loadFATopics, saveFATopics } from "./storage.js";
import { FA_CHAPTER_BY_FILE } from "./faMap.js";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ── Chapter markdown (sections → topics), cached per file ───────────────────
function parseChapterMd(text) {
  const sections = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      const m = line.match(/^## (.+?) — \d+\/\d+/);
      if (m) { current = { rawTitle: m[1], topics: [] }; sections.push(current); }
    } else if (current && line.match(/^- \[[ x]\]/)) {
      const rawTitle = line.replace(/^- \[[ x]\] /, "").trim();
      current.topics.push({ rawTitle, title: rawTitle.replace(/^\d+ /, "") });
    }
  }
  return sections;
}

const chapterCache = {};
async function loadChapter(file) {
  if (chapterCache[file]) return chapterCache[file];
  try {
    const text = await fetch(`${BASE}/fa/${file}`).then(r => r.text());
    const sections = parseChapterMd(text);
    chapterCache[file] = sections;
    return sections;
  } catch {
    chapterCache[file] = [];
    return [];
  }
}

function topicKey(chFile, sectionRawTitle, topicRawTitle) {
  return `${chFile}::${sectionRawTitle}::${topicRawTitle}`;
}

// ── Fuzzy matching ──────────────────────────────────────────────────────────
const STOP = new Set(["the", "a", "an", "of", "and", "in", "to", "for", "with", "&", "vs", "or", "on", "system", "disease", "syndrome", "first", "aid"]);
function tokens(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}
function score(aTokens, bStr) {
  const b = new Set(tokens(bStr));
  if (!b.size) return 0;
  let hit = 0;
  for (const t of aTokens) if (b.has(t) || [...b].some(x => x.startsWith(t) || t.startsWith(x))) hit++;
  return hit;
}

// Mark the FA-tracker topic(s) that best match a Read-FA task as done.
// Returns [{ file, topic }] of what got marked.
export async function markTaskInFA(task) {
  if (!task) return [];
  const chapters = (task.faChapters && task.faChapters.length)
    ? task.faChapters
    : [];
  const needle = `${task.faTopic || ""} ${task.body || ""} ${task.text || ""}`;
  const need = tokens(needle);
  if (!need.length || !chapters.length) return [];

  const ls = loadFATopics();
  const marked = [];

  for (const ch of chapters) {
    const sections = await loadChapter(ch.file);
    let best = null, bestScore = 0;
    for (const sec of sections) {
      for (const t of sec.topics) {
        const sc = score(need, t.title);
        if (sc > bestScore) { bestScore = sc; best = { sec, t }; }
      }
    }
    if (best && bestScore >= 1) {
      const key = topicKey(ch.file, best.sec.rawTitle, best.t.rawTitle);
      if (!ls[key]?.done) {
        ls[key] = { ...(ls[key] || {}), done: true, doneAt: new Date().toISOString(), fromQuestion: true };
      }
      marked.push({ file: ch.file, topic: best.t.title });
    }
  }

  if (marked.length) saveFATopics(ls);
  return marked;
}

// ── First Aid page lookup (from the book's index) ───────────────────────────
let _index = null;
let _indexPromise = null;
async function loadIndex() {
  if (_index) return _index;
  if (!_indexPromise) {
    _indexPromise = fetch(`${BASE}/firstaid/fa-index.json`)
      .then(r => r.json())
      .then(list => { _index = Array.isArray(list) ? list : []; return _index; })
      .catch(() => { _index = []; return _index; });
  }
  return _indexPromise;
}

// Best-effort precise page for a topic name; falls back to the chapter page.
export async function lookupPage(topicName, chapterFile) {
  const fallback = FA_CHAPTER_BY_FILE[chapterFile]?.page ?? null;
  const idx = await loadIndex();
  if (!idx.length || !topicName) return fallback;
  const need = tokens(topicName);
  if (!need.length) return fallback;
  // Require at least one strong token match; prefer concise index entries that
  // cover more of the needle.
  let best = null, bestScore = 0.9;
  for (const e of idx) {
    const sc = score(need, e.t);
    if (sc < 1) continue;
    const norm = sc - Math.max(0, tokens(e.t).length - need.length) * 0.2;
    if (norm > bestScore) { bestScore = norm; best = e; }
  }
  return best ? best.p : fallback;
}

export function chapterPage(chapterFile) {
  return FA_CHAPTER_BY_FILE[chapterFile]?.page ?? null;
}
