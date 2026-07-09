// Subject color system — the single source of truth for subject → {color, emoji}.
// See CLAUDE_CODE_BUILD_SPEC.md §15. Every surface that shows a subject imports
// `colorFor` from here; never hardcode a subject color elsewhere. The emoji is a
// mandatory redundant channel so subjects stay distinguishable without color.

export const SUBJECTS = {
  // 🔥 anchors — lead the schedule
  cardio:  { label: "Cardiovascular",      emoji: "❤️", hex: "#E11D48", tint: "#FFE4EC" },
  neuro:   { label: "Neurology",           emoji: "🧠", hex: "#7C3AED", tint: "#EDE7FD" },
  renal:   { label: "Renal",               emoji: "🫘", hex: "#F59E0B", tint: "#FEF1D6" },
  resp:    { label: "Respiratory",         emoji: "🫁", hex: "#0EA5E9", tint: "#DDF2FE" },
  heme:    { label: "Hematology/Oncology", emoji: "🩸", hex: "#9D174D", tint: "#FBE3EC" },
  endo:    { label: "Endocrine",           emoji: "🦋", hex: "#0D9488", tint: "#D6F5F0" },
  gi:      { label: "Gastrointestinal",    emoji: "🍽️", hex: "#EA580C", tint: "#FDE7D8" },
  repro:   { label: "Reproductive",        emoji: "🍼", hex: "#DB2777", tint: "#FCE3EF" },
  micro:   { label: "Microbiology",        emoji: "🦠", hex: "#16A34A", tint: "#DCF6E4" },
  msk:     { label: "MSK/Skin",            emoji: "🦴", hex: "#A16207", tint: "#F5EBD5" },
  psych:   { label: "Psychiatry",          emoji: "🧩", hex: "#4F46E5", tint: "#E5E4FB" },
  // 🧊 basics — interleaved daily
  patho:   { label: "Pathology",           emoji: "🔬", hex: "#334155", tint: "#E2E8F0" },
  pharm:   { label: "Pharmacology",        emoji: "💊", hex: "#0891B2", tint: "#D6F1F7" },
  immuno:  { label: "Immunology",          emoji: "🛡️", hex: "#65A30D", tint: "#E8F5D3" },
  biochem: { label: "Biochemistry",        emoji: "🧬", hex: "#C026D3", tint: "#F9DDFB" },
  publichealth: { label: "Public Health",  emoji: "📊", hex: "#64748B", tint: "#E7EBF0" },
};

// Reserved animated tracks — NEVER used for a subject, so they always stand out.
export const TRACKS = {
  uworld:     { emoji: "🎯", from: "#FF3D81", to: "#FF9F1C" },
  assessment: { emoji: "🧪", from: "#7C3AED", to: "#EC4899" },
  anki:       { emoji: "🟢", hex: "#10B981" },
};

// Map the app's messier `system` vocabulary (deck.json + FA chapter names) onto
// the color tokens above. topic-plan units already carry `colorKey`, so this is
// the fallback path for surfaces that only have a raw system string.
export const KEY_FOR = {
  // deck / plan-unit short vocab
  "Cardiovascular": "cardio",
  "Neurology": "neuro", "Neuro & Special Senses": "neuro",
  "Renal": "renal",
  "Respiratory": "resp",
  "Heme / Onc": "heme", "Hematology/Oncology": "heme", "Hematology / Oncology": "heme",
  "Endocrine": "endo", "Endocrine/Anatomy": "endo",
  "Gastrointestinal": "gi",
  "Repro": "repro", "Reproductive": "repro",
  "Microbiology": "micro",
  "MSK, Skin & Connective": "msk", "MSK/Skin": "msk", "Musculoskeletal": "msk",
  "Psychiatry": "psych",
  "Pathology": "patho",
  "Pharmacology": "pharm",
  "Immunology": "immuno",
  "Biochemistry": "biochem",
  "Public Health": "publichealth",
  // FA chapter names ("07 Cardio", …)
  "07 Cardio": "cardio", "12 Neuro": "neuro", "14 Renal": "renal",
  "16 Respiratory": "resp", "10 Heme": "heme", "08 Endocrine": "endo",
  "09 GI": "gi", "15 Repro": "repro", "03 Micro": "micro", "11 MSK": "msk",
  "13 Psychiatry": "psych", "04 Pathology": "patho", "05 Pharm": "pharm",
  "02 Immunology": "immuno", "01 Biochem": "biochem", "06 Public Health": "publichealth",
};

const FALLBACK = { label: "—", emoji: "•", hex: "#94A3B8", tint: "#EEEEEE" };

// FA chapter numbers → color token (the FA chapter titles vary — "10 Heme Onc",
// "11 MSK, Skin, & Connective" — so match on the stable leading number too).
const NUM_FOR = {
  "01": "biochem", "02": "immuno", "03": "micro", "04": "patho", "05": "pharm",
  "06": "publichealth", "07": "cardio", "08": "endo", "09": "gi", "10": "heme",
  "11": "msk", "12": "neuro", "13": "psych", "14": "renal", "15": "repro", "16": "resp",
};

// Resolve a subject (color token, system string, or FA chapter name) → color record.
export function colorFor(s) {
  if (!s) return FALLBACK;
  if (SUBJECTS[s]) return SUBJECTS[s];
  if (KEY_FOR[s]) return SUBJECTS[KEY_FOR[s]];
  const num = String(s).match(/^\s*(\d{2})\b/);
  if (num && NUM_FOR[num[1]]) return SUBJECTS[NUM_FOR[num[1]]];
  return FALLBACK;
}
