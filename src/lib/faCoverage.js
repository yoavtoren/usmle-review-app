// ── First Aid coverage bridge (markdown [x] ⇆ tracker localStorage) ──────────
// The planner's weakness/auto-complete engine and the calendar both need to know
// which First Aid TOPICS are "done". The tracker (fa-topics-v2) stores manual
// toggles, but a chapter's markdown also ships with topics pre-checked ([x]).
// The FA Tracker UI treats a topic as done when the localStorage entry says so,
// and otherwise falls back to the markdown checkbox (see FADashboard.itemDone).
// This module reproduces that exact rule so the calendar and scheduler agree with
// what the user sees in the tracker.

import { loadFATopics } from "./storage.js";

const BASE = import.meta.env.BASE_URL || "/";

// Parse a chapter markdown into { `${file}::${section}::${topic}`: markdownDone }
// for the TOP-LEVEL topics only — that is the granularity of a plan unit's
// faItemIds (generate_topic_plan.py emits one id per top-level group).
function parseTopLevel(text, file) {
  const out = {};
  let section = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^## (.+?) — \d+\/\d+/);
    if (h) { section = h[1]; continue; }
    if (!section) continue;
    const t = line.match(/^- \[([ x])\] (.+)$/); // top-level topic, no indent
    if (t) out[`${file}::${section}::${t[2].trim()}`] = t[1] === "x";
  }
  return out;
}

// Fetch every chapter markdown and build the markdown-baseline done map. Returns
// {} on any failure so the caller can still fall back to localStorage-only.
export async function loadFABaseline() {
  try {
    const prog = await fetch(`${BASE}fa/fa-progress.json`).then((r) => r.json());
    const maps = await Promise.all(
      (prog.chapters || []).map((ch) =>
        fetch(`${BASE}fa/${ch.file}`)
          .then((r) => r.text())
          .then((text) => parseTopLevel(text, ch.file))
          .catch(() => ({}))
      )
    );
    return Object.assign({}, ...maps);
  } catch {
    return {};
  }
}

// Effective set of DONE topic ids, applying the tracker's own precedence:
// a localStorage entry (done true OR explicitly false) always wins; only when a
// topic was never touched does the markdown [x] baseline decide. Returns a Set of
// `file::section::topic` ids for O(1) membership checks.
export function mergeFADone(baseline = {}, ls = loadFATopics()) {
  const done = new Set();
  const ids = new Set([...Object.keys(baseline), ...Object.keys(ls)]);
  for (const id of ids) {
    const entry = ls[id];
    const isDone = entry !== undefined ? !!entry.done : !!baseline[id];
    if (isDone) done.add(id);
  }
  return done;
}
