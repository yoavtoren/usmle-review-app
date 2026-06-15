// ── First Aid chapter mapping ───────────────────────────────────────────────
// Maps a question's free-form `firstAid` location / topic / system text onto the
// 16 real First-Aid chapters the FA tracker is organized by. This makes the
// "Read FA" review tasks point at the actual chapter, and lets the FA tracker
// light up chapters that have pending reviews waiting on them.

// `page` = First Aid 2025 PDF page where the chapter starts (from firstAidData.js).
export const FA_CHAPTERS = [
  { file: "chapters/01_Biochem.md",                name: "Biochem", page: 52,
    kw: ["biochem", "dna", "rna", "okazaki", "enzyme", "metabol", "molecular", "cell biology", "genetic", "vitamin", "nutrition", "lysosom", "mitochond", "porphyr", "glycogen", "amino acid"] },
  { file: "chapters/02_Immunology.md",             name: "Immunology", page: 114,
    kw: ["immun", "antibody", "complement", "hypersensitiv", "cytokine", "hla", "mhc", "t cell", "b cell", "vaccine"] },
  { file: "chapters/03_Micro.md",                  name: "Micro", page: 142,
    kw: ["micro", "bacteri", "virus", "viral", "fungal", "fungus", "parasit", "infectious", "leprae", "pseudomonas", "campylobacter", "listeria", "adenovirus", "west nile", "plague"] },
  { file: "chapters/04_Pathology.md",              name: "Pathology", page: 222,
    kw: ["pathology", "neoplas", "inflammat", "apoptos", "necros", "carcinoma", "tumor", "wound heal", "fibrosis"] },
  { file: "chapters/05_Pharm.md",                  name: "Pharm", page: 248,
    kw: ["pharm", "drug", "toxic", "teratogen", "agonist", "antagonist", "inhibitor", "overdose", "nsaid", "opioid", "beta", "mao", "ppi", "lithium", "succinylcholine", "leuprolide", "isoproterenol", "montelukast"] },
  { file: "chapters/06_Public_Health.md",          name: "Public Health", page: 276,
    kw: ["public health", "ethics", "communicat", "biostat", "statistic", "epidemiolog", "patient safety", "quality", "confidence interval", "meta-analysis", "medicare", "consent", "error", "root cause", "abuse", "end-of-life", "chaperone", "substituted"] },
  { file: "chapters/07_Cardio.md",                 name: "Cardiovascular", page: 304,
    kw: ["cardio", "heart", "vascular", "ebstein", "valve", "aortic", "mitral", "pericard", "myocard", "cardiomyopathy", "svc", "subclavian", "venous return", "athlete", "pacemaker", "transposition"] },
  { file: "chapters/08_Endocrine.md",              name: "Endocrine", page: 350,
    kw: ["endocrine", "thyroid", "adrenal", "diabet", "pituitary", "prolactin", "hormone", "glucagon", "cortisol", "medullary thyroid", "hypothyroid", "congenital hypothyroid"] },
  { file: "chapters/09_GI.md",                     name: "Gastrointestinal", page: 384,
    kw: ["gastro", "\\bgi\\b", "liver", "hepat", "pancrea", "bowel", "esophag", "diverticul", "cholecystitis", "cholangi", "gallstone", "celiac", "crohn", "rifaximin", "varice", "appendicitis", "ascites", "cirrhosis"] },
  { file: "chapters/10_Heme_Onc.md",               name: "Heme / Onc", page: 430,
    kw: ["heme", "hematolog", "oncolog", "blood", "anemia", "leukemia", "lymphoma", "thalassemia", "sickle", "hepcidin", "enoxaparin", "promyelocytic", "fanconi", "clubbing"] },
  { file: "chapters/11_MSK_Skin_Connective.md",    name: "MSK, Skin & Connective", page: 470,
    kw: ["musculoskeletal", "\\bmsk\\b", "skin", "derm", "bone", "joint", "rheum", "connective", "gout", "osteo", "paget", "lichen", "dystonia", "collagen", "scurvy", "folliculitis"] },
  { file: "chapters/12_Neuro_Special_Senses.md",   name: "Neuro & Special Senses", page: 520,
    kw: ["neuro", "brain", "nerve", "ophth", "\\beye\\b", "\\bear\\b", "special senses", "spinal", "glaucoma", "neural crest", "neural tube", "anisocoria", "oculomotor", "abscess", "neurofibroma", "acoustic neuroma", "brown-sequard", "scotoma", "cn "] },
  { file: "chapters/13_Psychiatry.md",             name: "Psychiatry", page: 590,
    kw: ["psych", "bipolar", "depress", "schizo", "phobia", "dysmorphic", "schizoid", "conduct disorder", "motivational interview", "substance", "abstinence"] },
  { file: "chapters/14_Renal.md",                  name: "Renal", page: 616,
    kw: ["renal", "kidney", "nephro", "urinary", "incontinence", "oxalate", "stone", "dka urine", "esrd", "hypophosphat", "uropathy"] },
  { file: "chapters/15_Repro.md",                  name: "Repro", page: 650,
    kw: ["repro", "ovar", "testis", "testicular", "pregnan", "obgyn", "gynec", "mullerian", "adenomyosis", "ocp", "prostate", "uterine"] },
  { file: "chapters/16_Respiratory.md",            name: "Respiratory", page: 698,
    kw: ["respirator", "lung", "pulmonar", "airway", "pneumonia", "asthma", "copd", "emphysema", "ards", "cystic fibrosis", "ild", "fibrosis", "bronchiol", "croup", "pleural"] },
];

export const FA_CHAPTER_BY_FILE = Object.fromEntries(FA_CHAPTERS.map(c => [c.file, c]));

const SYSTEM_TO_CHAPTER = {
  Cardio: "chapters/07_Cardio.md",
  Resp: "chapters/16_Respiratory.md",
  GI: "chapters/09_GI.md",
  Renal: "chapters/14_Renal.md",
  Endo: "chapters/08_Endocrine.md",
  Repro: "chapters/15_Repro.md",
  "Heme/Onc": "chapters/10_Heme_Onc.md",
  "MSK/Skin": "chapters/11_MSK_Skin_Connective.md",
  Neuro: "chapters/12_Neuro_Special_Senses.md",
};
const SUBJECT_TO_CHAPTER = {
  Pharm: "chapters/05_Pharm.md",
  Biochem: "chapters/01_Biochem.md",
  Immuno: "chapters/02_Immunology.md",
  Micro: "chapters/03_Micro.md",
  Path: "chapters/04_Pathology.md",
  Behavioral: "chapters/06_Public_Health.md",
  Biostats: "chapters/06_Public_Health.md",
  Psych: "chapters/13_Psychiatry.md",
};

const byFile = Object.fromEntries(FA_CHAPTERS.map(c => [c.file, c]));

// Resolve chapters from an arbitrary text blob (location + topic + system).
export function chaptersFromText(text) {
  if (!text) return [];
  const s = text.toLowerCase();
  const hits = [];
  for (const ch of FA_CHAPTERS) {
    if (ch.kw.some(k => (k.startsWith("\\b") ? new RegExp(k).test(s) : s.includes(k)))) {
      hits.push({ file: ch.file, name: ch.name, page: ch.page });
    }
  }
  return hits;
}

// Best-effort chapters for a full question object (firstAid + topic + system + inferred tags).
export function resolveFAChapters(qFull, inferred) {
  const out = [];
  const seen = new Set();
  const push = (file) => {
    if (file && byFile[file] && !seen.has(file)) { seen.add(file); out.push({ file, name: byFile[file].name, page: byFile[file].page }); }
  };

  const faText = (qFull?.firstAid || []).map(f => `${f.topic || ""} ${f.location || f.detail || ""}`).join(" ");
  const blob = `${faText} ${qFull?.topic || ""} ${qFull?.title || ""} ${qFull?.system || ""}`;
  chaptersFromText(blob).forEach(c => push(c.file));

  // Fall back to the inferred system/subject taxonomy if nothing keyword-matched.
  if (out.length === 0 && inferred) {
    push(SYSTEM_TO_CHAPTER[inferred.system]);
    push(SUBJECT_TO_CHAPTER[inferred.subject]);
  }
  return out;
}

// Chapters for a single firstAid entry (used per-task).
export function chaptersForFA(fa, fallbackBlob) {
  const hits = chaptersFromText(`${fa?.topic || ""} ${fa?.location || fa?.detail || ""}`);
  if (hits.length) return hits;
  return chaptersFromText(fallbackBlob || "");
}
