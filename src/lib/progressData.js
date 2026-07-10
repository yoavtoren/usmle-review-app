// Performance analytics — derived from the unified test log (storage.js).
// Every logged UWorld/NBME test carries its per-Subject and per-System stat
// breakdown, so a "snapshot" here is simply the stats slice of one test entry.
// This module draws the trend lines and surfaces weak spots from those entries;
// nothing is stored separately, so logging a test once feeds every screen.

import { loadTestLog } from "./storage.js";

// Canonical UWorld Step 1 taxonomy (matches the Create-Test / Performance pages).
export const SUBJECTS = [
  "Anatomy",
  "Behavioral science",
  "Biochemistry",
  "Biostatistics",
  "Embryology",
  "Genetics",
  "Histology",
  "Immunology",
  "Microbiology",
  "Pathology",
  "Pathophysiology",
  "Pharmacology",
  "Physiology",
];

export const SYSTEMS = [
  "Biochemistry (General Principles)",
  "Genetics (General Principles)",
  "Microbiology (General Principles)",
  "Pathology (General Principles)",
  "Pharmacology (General Principles)",
  "Biostatistics & Epidemiology",
  "Poisoning & Environmental Exposure",
  "Psychiatric/Behavioral & Substance Use Disorder",
  "Social Sciences (Ethics/Legal/Professional)",
  "Miscellaneous (Multisystem)",
  "Allergy & Immunology",
  "Cardiovascular System",
  "Dermatology",
  "Ear, Nose & Throat (ENT)",
  "Endocrine, Diabetes & Metabolism",
  "Female Reproductive System & Breast",
  "Gastrointestinal & Nutrition",
  "Hematology & Oncology",
  "Infectious Diseases",
  "Male Reproductive System",
  "Nervous System",
  "Ophthalmology",
  "Pregnancy, Childbirth & Puerperium",
  "Pulmonary & Critical Care",
  "Renal, Urinary Systems & Electrolytes",
  "Rheumatology/Orthopedics & Sports",
];

// Snapshots are the stat slices of test-log entries that actually carry a
// subject or system breakdown, chronological (oldest → newest) for trend math.
export function loadSnapshots() {
  return loadTestLog()
    .filter((t) => {
      const s = Object.keys(t.subjects || {}).some((k) => t.subjects[k]?.total);
      const y = Object.keys(t.systems || {}).some((k) => t.systems[k]?.total);
      return s || y;
    })
    .map((t) => ({
      id: t.id, date: t.date, note: t.testNum || t.note || "",
      subjects: t.subjects || {}, systems: t.systems || {},
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// A row is { total, correct, omitted }. Only rows with total > 0 count.
export function pct(row) {
  if (!row || !row.total) return null;
  return Math.round((row.correct / row.total) * 100);
}

export function latestSnapshot() {
  const list = loadSnapshots();
  return list.length ? list[list.length - 1] : null;
}

// Callers use both "subject"/"system" (Home) and "subjects"/"systems"
// (Progress page). Normalise to the plural keys stored on each snapshot.
function normKind(kind) {
  if (kind === "subject") return "subjects";
  if (kind === "system") return "systems";
  return kind;
}

// Trend for one topic: [{ date, pct }] across every snapshot that scored it.
export function trendFor(kind, name) {
  kind = normKind(kind);
  return loadSnapshots()
    .map((s) => {
      const row = (s[kind] || {})[name];
      const p = pct(row);
      return p == null ? null : { date: s.date, pct: p, total: row.total };
    })
    .filter(Boolean);
}

// Least-squares slope of a topic's pct across its snapshots, in points gained
// per test. null when there are fewer than two scored snapshots.
export function trendSlope(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = (n - 1) / 2; // mean of indices 0..n-1
  const my = points.reduce((a, p) => a + p.pct, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (points[i].pct - my);
    den += (i - mx) ** 2;
  }
  return den ? num / den : null;
}

// Per-topic aggregate stats across every scored snapshot:
//   avg    — mean % across snapshots (the ranking key for best/worst)
//   slope  — trend of that %, in points per test
//   volume — cumulative questions answered in the topic (across all tests)
//   last   — most recent %
//   focus  — "most important focus for now": expected wrong answers if nothing
//            changes = volume × (100 − avg). A big, low-scoring topic outranks a
//            tiny one you happen to bomb, so ENT@0% over 5 Q sits below
//            GI@30% over 50 Q.
export function topicStats(kind) {
  kind = normKind(kind);
  const names = kind === "systems" ? SYSTEMS : SUBJECTS;
  return names.map((name) => {
    const trend = trendFor(kind, name);
    const n = trend.length;
    const avg = n ? Math.round(trend.reduce((a, p) => a + p.pct, 0) / n) : null;
    const volume = trend.reduce((a, p) => a + (p.total || 0), 0);
    const last = n ? trend[n - 1].pct : null;
    return {
      name, trend, avg, volume, last,
      slope: trendSlope(trend),
      focus: avg == null ? -1 : volume * (100 - avg),
    };
  });
}

// Weak spots = the highest-focus topics (biggest gap × volume), so the panel
// surfaces where fixing questions buys the most, not just the lowest single %.
export function weakSpots(kind, n = 6) {
  return topicStats(kind)
    .filter((r) => r.avg != null && r.volume > 0)
    .sort((a, b) => b.focus - a.focus)
    .map((r) => ({ name: r.name, pct: r.avg, total: r.volume, focus: r.focus }))
    .slice(0, n);
}

// Overall correct/total across a snapshot for a given kind.
export function overall(snap, kind) {
  const rows = (snap && snap[normKind(kind)]) || {};
  let total = 0, correct = 0;
  for (const r of Object.values(rows)) {
    if (r?.total) { total += r.total; correct += r.correct || 0; }
  }
  return { total, correct, pct: total ? Math.round((correct / total) * 100) : null };
}
