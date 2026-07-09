// Manual performance tracking — decoupled from the app's own question deck.
// You log dated snapshots of your UWorld (or any QBank) stats per Subject and
// per System; the app draws trend lines and surfaces weak spots. 100% local,
// mirrored to iCloud like the rest of your progress.

const KEY = "usmle-perf-snapshots-v1";

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

export function loadSnapshots() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY)) || [];
    // Always chronological (oldest → newest) so trend math is order-safe.
    return arr.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// A row is { total, correct, omitted }. Only rows with total > 0 count.
export function pct(row) {
  if (!row || !row.total) return null;
  return Math.round((row.correct / row.total) * 100);
}

export function saveSnapshot(snap) {
  const list = loadSnapshots();
  const idx = list.findIndex((s) => s.id === snap.id);
  if (idx >= 0) list[idx] = snap;
  else list.push(snap);
  save(list);
  return list;
}

export function deleteSnapshot(id) {
  save(loadSnapshots().filter((s) => s.id !== id));
}

export function latestSnapshot() {
  const list = loadSnapshots();
  return list.length ? list[list.length - 1] : null;
}

// Trend for one topic: [{ date, pct }] across every snapshot that scored it.
export function trendFor(kind, name) {
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
  const rows = (snap && snap[kind]) || {};
  let total = 0, correct = 0;
  for (const r of Object.values(rows)) {
    if (r?.total) { total += r.total; correct += r.correct || 0; }
  }
  return { total, correct, pct: total ? Math.round((correct / total) * 100) : null };
}
