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

// Weak spots from the latest snapshot: lowest % first. Ties broken by volume.
export function weakSpots(kind, n = 6) {
  kind = normKind(kind);
  const snap = latestSnapshot();
  if (!snap) return [];
  const rows = snap[kind] || {};
  return Object.entries(rows)
    .map(([name, row]) => ({ name, pct: pct(row), total: row.total }))
    .filter((r) => r.pct != null)
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
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
