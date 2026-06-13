const MS_KEY = "medschool-v5";

export const YEAR_META = {
  3: { label: "Year 3",  shortLabel: "Y3", color: "#64748b", emoji: "📗", active: false },
  4: { label: "Year 4",  shortLabel: "Y4", color: "#4f46e5", emoji: "📘", active: true  },
  5: { label: "Year 5",  shortLabel: "Y5", color: "#0891b2", emoji: "📙", active: false },
  6: { label: "Year 6",  shortLabel: "Y6", color: "#7c3aed", emoji: "📕", active: false },
};

// ─── ENT 54 official exam topics ─────────────────────────────────────────────
const ENT_TOPICS = [
  // External Ear
  { num:  1, topic: "External otitis, foreign body of the external auditory meatus", section: "External Ear" },
  { num:  2, topic: "Congenital malformations of the ear", section: "External Ear" },
  { num:  3, topic: "Ear injuries", section: "External Ear" },
  // Middle Ear
  { num:  4, topic: "Secretory otitis (Otitis media with effusion)", section: "Middle Ear" },
  { num:  5, topic: "Acute otitis media", section: "Middle Ear" },
  { num:  6, topic: "Chronic otitis media", section: "Middle Ear" },
  { num:  7, topic: "Surgical treatment of chronic otitis", section: "Middle Ear" },
  { num:  8, topic: "Tympanoplasty and myringoplasty", section: "Middle Ear" },
  { num:  9, topic: "Mastoiditis", section: "Middle Ear" },
  { num: 10, topic: "Otosclerosis", section: "Middle Ear" },
  { num: 11, topic: "Complications of otitis media", section: "Middle Ear" },
  // Hearing & Balance
  { num: 12, topic: "Prosthetics and surgical therapy of hearing loss and deafness", section: "Hearing & Balance" },
  { num: 13, topic: "Differential diagnosis of hypacusis", section: "Hearing & Balance" },
  { num: 14, topic: "Tinnitus", section: "Hearing & Balance" },
  { num: 15, topic: "Classification of hearing impairment, hearing examination", section: "Hearing & Balance" },
  { num: 16, topic: "ENT aspects of facial nerve paralysis", section: "Hearing & Balance" },
  { num: 17, topic: "Peripheral vertigo, vestibular examination", section: "Hearing & Balance" },
  { num: 18, topic: "Ménière disease", section: "Hearing & Balance" },
  // Pharynx & Tonsils
  { num: 19, topic: "Tonsillitis — classification, symptoms, treatment", section: "Pharynx & Tonsils" },
  { num: 20, topic: "Chronic tonsillitis and adenoid vegetation", section: "Pharynx & Tonsils" },
  { num: 21, topic: "Tonsillitis complications", section: "Pharynx & Tonsils" },
  { num: 22, topic: "Differential diagnosis of swallowing disorders", section: "Pharynx & Tonsils" },
  { num: 23, topic: "ENT aspects of oesophageal diseases and injuries", section: "Pharynx & Tonsils" },
  { num: 24, topic: "Non-tumorous diseases of salivary glands", section: "Pharynx & Tonsils" },
  // Larynx & Airway
  { num: 25, topic: "Laryngeal injuries and innervation disorders", section: "Larynx & Airway" },
  { num: 26, topic: "Acute laryngitis", section: "Larynx & Airway" },
  { num: 27, topic: "Suffocation — causes, symptoms, treatment, tracheotomy and coniotomy", section: "Larynx & Airway" },
  { num: 28, topic: "Foreign bodies of the upper respiratory and digestive tract", section: "Larynx & Airway" },
  { num: 29, topic: "Voice and speech disorders, laryngectomy rehabilitation", section: "Larynx & Airway" },
  // Nose & Sinuses
  { num: 30, topic: "Acute and chronic rhinosinusitis", section: "Nose & Sinuses" },
  { num: 31, topic: "Complications of rhinosinusitis", section: "Nose & Sinuses" },
  { num: 32, topic: "Epistaxis", section: "Nose & Sinuses" },
  { num: 33, topic: "Nasal obstruction — differential diagnosis", section: "Nose & Sinuses" },
  { num: 34, topic: "Nose, paranasal sinuses and facial skeleton injuries", section: "Nose & Sinuses" },
  { num: 35, topic: "Concept of functional endoscopic surgery", section: "Nose & Sinuses" },
  { num: 36, topic: "Sleep apnea syndrome — ENT aspects", section: "Nose & Sinuses" },
  // Head & Neck Oncology
  { num: 37, topic: "Tumors of the upper respiratory and digestive tract — classification, risk factors, general principles of diagnosis and treatment", section: "Head & Neck Oncology" },
  { num: 38, topic: "Tumors of the epipharynx", section: "Head & Neck Oncology" },
  { num: 39, topic: "Oropharyngeal and oral cavity tumors", section: "Head & Neck Oncology" },
  { num: 40, topic: "Treatment of oropharyngeal and oral cavity tumors", section: "Head & Neck Oncology" },
  { num: 41, topic: "Hypopharyngeal tumors", section: "Head & Neck Oncology" },
  { num: 42, topic: "Nose and paranasal sinuses tumors", section: "Head & Neck Oncology" },
  { num: 43, topic: "Laryngeal tumors", section: "Head & Neck Oncology" },
  { num: 44, topic: "Treatment of laryngeal tumors", section: "Head & Neck Oncology" },
  { num: 45, topic: "Chronic laryngitis and premalignant lesions", section: "Head & Neck Oncology" },
  { num: 46, topic: "Regional metastasis of head and neck cancer", section: "Head & Neck Oncology" },
  { num: 47, topic: "Differential diagnosis of a neck mass", section: "Head & Neck Oncology" },
  { num: 48, topic: "Thyroid gland tumors", section: "Head & Neck Oncology" },
  { num: 49, topic: "Surgical treatment of the thyroid gland and its complications", section: "Head & Neck Oncology" },
  { num: 50, topic: "Salivary gland tumors", section: "Head & Neck Oncology" },
  { num: 51, topic: "Ear tumors", section: "Head & Neck Oncology" },
  { num: 52, topic: "Vestibular schwannoma", section: "Head & Neck Oncology" },
  { num: 53, topic: "ENT and skull base surgery", section: "Head & Neck Oncology" },
  { num: 54, topic: "Nasopharyngeal angiofibroma", section: "Head & Neck Oncology" },
];

const now = Date.now();

export const DEFAULT_SUBJECTS = [
  {
    id: "y4-ent",
    year: 4,
    name: "ENT / ORL",
    subtitle: "Otorhinolaryngology — 54 Official Exam Topics",
    color: "#eab308",
    notes: "Oral exam format. Study with Angela.\n\nKey high-yield topics:\n- Vertigo differential: BPPV (Dix-Hallpike +, self-limiting) vs Ménière's (episodic, tinnitus, hearing loss) vs central (nystagmus doesn't fatigue)\n- Conductive vs SNHL: Weber lateralizes to bad ear (conductive) or good ear (SNHL)\n- Epistaxis: Kiesselbach's plexus (anterior) — 90% of cases. Posterior = arterial, elderly, dangerous\n- Peritonsillar abscess: trismus + uvular deviation + hot potato voice\n- Acute otitis media: S. pneumoniae, H. influenzae, M. catarrhalis → amoxicillin",
    exams: [
      { id: 1, name: "Oral Final", date: "2026-06-22", score: null, maxScore: null, notes: "Clinical presentation format. 54 official topics." },
    ],
    syllabus: ENT_TOPICS.map(t => ({
      id: `ent-t-${t.num}`,
      num: t.num,
      topic: t.topic,
      section: t.section,
      done: false,
      notes: "",
      htmlFile: `${String(t.num).padStart(2, "0")}.html`,
    })),
    reviewState: {},
    materials: [
      { id: 1, title: "ENT Oral Prep Cards", type: "pdf",  url: "", notes: "Clinical case flash cards" },
      { id: 2, title: "ENT Final Questions PDF", type: "pdf", url: "", notes: "Official 54 exam questions" },
    ],
    tasks: [
      { id: "t1", title: "Cover all 54 topics at least once", done: false, deadline: "2026-06-19" },
      { id: "t2", title: "Practice 5 clinical cases out loud with Angela", done: false, deadline: "2026-06-20" },
      { id: "t3", title: "Second pass — focus on Oncology section", done: false, deadline: "2026-06-21" },
    ],
    gradeTarget: 85,
    createdAt: now, updatedAt: now,
  },
  {
    id: "y4-internal",
    year: 4,
    name: "Internal Medicine I",
    subtitle: "Cardiology · Pulmonology · Gastroenterology",
    color: "#ef4444",
    notes: "",
    exams: [
      { id: 1, name: "Midterm", date: "2026-03-10", score: 78, maxScore: 100, notes: "Strong on cardio, weaker on hepatology" },
    ],
    syllabus: [
      { id: "im-1",  topic: "12-lead ECG interpretation",              section: "Cardiology",       done: true,  notes: "" },
      { id: "im-2",  topic: "Heart failure — HFrEF vs HFpEF",          section: "Cardiology",       done: true,  notes: "" },
      { id: "im-3",  topic: "ACS: STEMI, NSTEMI, UA — management",     section: "Cardiology",       done: true,  notes: "" },
      { id: "im-4",  topic: "Hypertension — stages & pharmacotherapy", section: "Cardiology",       done: false, notes: "" },
      { id: "im-5",  topic: "Atrial fibrillation — rate vs rhythm control", section: "Cardiology",  done: false, notes: "" },
      { id: "im-6",  topic: "Chest X-ray systematic reading",           section: "Pulmonology",     done: false, notes: "" },
      { id: "im-7",  topic: "COPD — GOLD criteria & inhalers",          section: "Pulmonology",     done: false, notes: "" },
      { id: "im-8",  topic: "Asthma — stepwise management",             section: "Pulmonology",     done: false, notes: "" },
      { id: "im-9",  topic: "Pulmonary embolism — Wells score & Rx",    section: "Pulmonology",     done: false, notes: "" },
      { id: "im-10", topic: "Peptic ulcer disease — H. pylori",         section: "Gastroenterology", done: false, notes: "" },
      { id: "im-11", topic: "Inflammatory bowel disease: CD vs UC",     section: "Gastroenterology", done: false, notes: "" },
      { id: "im-12", topic: "Liver enzymes pattern interpretation",     section: "Gastroenterology", done: false, notes: "" },
      { id: "im-13", topic: "Cirrhosis complications — ascites, HE, varices", section: "Gastroenterology", done: false, notes: "" },
    ],
    reviewState: {},
    materials: [
      { id: 1, title: "Harrison's Principles — key chapters", type: "book", url: "", notes: "" },
      { id: 2, title: "Internal Medicine lecture pack", type: "pdf", url: "", notes: "Full year slides" },
    ],
    tasks: [],
    gradeTarget: 80,
    createdAt: now, updatedAt: now,
  },
  {
    id: "y4-surgery",
    year: 4,
    name: "Surgery I",
    subtitle: "General & Emergency Surgery",
    color: "#f97316",
    notes: "",
    exams: [],
    syllabus: [
      { id: "sx-1", topic: "Acute abdomen — differential diagnosis",            section: "Emergency", done: false, notes: "" },
      { id: "sx-2", topic: "Appendicitis — Alvarado score & management",        section: "Emergency", done: false, notes: "" },
      { id: "sx-3", topic: "Bowel obstruction — small vs large",                section: "Emergency", done: false, notes: "" },
      { id: "sx-4", topic: "Peritonitis — causes & surgical principles",        section: "Emergency", done: false, notes: "" },
      { id: "sx-5", topic: "Inguinal hernia — direct vs indirect",              section: "Elective",  done: false, notes: "" },
      { id: "sx-6", topic: "Cholelithiasis & cholecystitis — acute management", section: "Elective",  done: false, notes: "" },
      { id: "sx-7", topic: "Wound healing — primary, secondary, tertiary",      section: "Basics",    done: false, notes: "" },
      { id: "sx-8", topic: "Surgical infections & prophylaxis",                 section: "Basics",    done: false, notes: "" },
      { id: "sx-9", topic: "Pre-op assessment & anesthesia basics",             section: "Basics",    done: false, notes: "" },
    ],
    reviewState: {},
    materials: [],
    tasks: [],
    gradeTarget: 75,
    createdAt: now, updatedAt: now,
  },
  {
    id: "y4-neurology",
    year: 4,
    name: "Neurology",
    subtitle: "Clinical Neurology",
    color: "#8b5cf6",
    notes: "",
    exams: [],
    syllabus: [
      { id: "nr-1",  topic: "Stroke — ischemic vs hemorrhagic imaging",   section: "Vascular",       done: false, notes: "" },
      { id: "nr-2",  topic: "tPA criteria — inclusion & exclusion",        section: "Vascular",       done: false, notes: "" },
      { id: "nr-3",  topic: "TIA — ABCD2 score & urgent workup",           section: "Vascular",       done: false, notes: "" },
      { id: "nr-4",  topic: "Headache — tension vs migraine vs cluster",   section: "Pain",           done: false, notes: "" },
      { id: "nr-5",  topic: "SAH — thunderclap headache & LP",             section: "Pain",           done: false, notes: "" },
      { id: "nr-6",  topic: "Seizures — classification & first-line AED",  section: "Epilepsy",       done: false, notes: "" },
      { id: "nr-7",  topic: "Status epilepticus — management protocol",    section: "Epilepsy",       done: false, notes: "" },
      { id: "nr-8",  topic: "Multiple sclerosis — McDonald criteria",      section: "Demyelinating",  done: false, notes: "" },
      { id: "nr-9",  topic: "Parkinson's — dopaminergic pathways & Rx",   section: "Movement",       done: false, notes: "" },
      { id: "nr-10", topic: "Cranial nerve palsy patterns",                section: "Cranial Nerves", done: false, notes: "" },
    ],
    reviewState: {},
    materials: [],
    tasks: [],
    gradeTarget: 80,
    createdAt: now, updatedAt: now,
  },
  {
    id: "y4-derm",
    year: 4,
    name: "Dermatovenerology",
    subtitle: "Skin diseases & STIs",
    color: "#ec4899",
    notes: "",
    exams: [],
    syllabus: [
      { id: "dv-1", topic: "Morphological description of skin lesions",       section: "Basics",     done: false, notes: "" },
      { id: "dv-2", topic: "Eczema & atopic dermatitis — ladder",             section: "Inflammatory", done: false, notes: "" },
      { id: "dv-3", topic: "Psoriasis — types & biologics",                   section: "Inflammatory", done: false, notes: "" },
      { id: "dv-4", topic: "Acne vulgaris — pathogenesis & management",       section: "Acne",       done: false, notes: "" },
      { id: "dv-5", topic: "BCC, SCC, melanoma — ABCDE rule",                 section: "Oncology",   done: false, notes: "" },
      { id: "dv-6", topic: "Syphilis — primary/secondary/tertiary + Rx",      section: "STIs",       done: false, notes: "" },
      { id: "dv-7", topic: "Gonorrhea & chlamydia — presentation & Rx",       section: "STIs",       done: false, notes: "" },
      { id: "dv-8", topic: "Urticaria & angioedema — management",             section: "Allergic",   done: false, notes: "" },
    ],
    reviewState: {},
    materials: [],
    tasks: [],
    gradeTarget: 75,
    createdAt: now, updatedAt: now,
  },
  {
    id: "y4-ophthal",
    year: 4,
    name: "Ophthalmology",
    subtitle: "Eye diseases & Emergencies",
    color: "#06b6d4",
    notes: "",
    exams: [],
    syllabus: [
      { id: "op-1", topic: "Acute red eye — systematic differential",       section: "Emergencies", done: false, notes: "" },
      { id: "op-2", topic: "Acute angle-closure glaucoma — emergency Rx",   section: "Emergencies", done: false, notes: "" },
      { id: "op-3", topic: "Open-angle glaucoma — screening & Rx",          section: "Chronic",     done: false, notes: "" },
      { id: "op-4", topic: "Cataract — risk factors & surgical indications",section: "Lens",        done: false, notes: "" },
      { id: "op-5", topic: "Diabetic retinopathy — NPDR vs PDR staging",    section: "Retina",      done: false, notes: "" },
      { id: "op-6", topic: "Age-related macular degeneration",               section: "Retina",      done: false, notes: "" },
      { id: "op-7", topic: "Retinal detachment — symptoms & urgency",       section: "Retina",      done: false, notes: "" },
    ],
    reviewState: {},
    materials: [],
    tasks: [],
    gradeTarget: 75,
    createdAt: now, updatedAt: now,
  },
  {
    id: "y4-pharmacology",
    year: 4,
    name: "Pharmacology I",
    subtitle: "Mechanisms, kinetics & pharmacodynamics",
    color: "#10b981",
    notes: "",
    exams: [],
    syllabus: [
      { id: "ph-1", topic: "Drug absorption, distribution, metabolism, excretion", section: "PK",           done: false, notes: "" },
      { id: "ph-2", topic: "First-pass effect & bioavailability",                   section: "PK",           done: false, notes: "" },
      { id: "ph-3", topic: "Receptor pharmacology — agonists & antagonists",        section: "PD",           done: false, notes: "" },
      { id: "ph-4", topic: "Autonomic pharmacology — ANS drugs",                    section: "Autonomic",    done: false, notes: "" },
      { id: "ph-5", topic: "Cardiovascular drugs — antihypertensives",              section: "CVS",          done: false, notes: "" },
      { id: "ph-6", topic: "Anticoagulants — heparin, warfarin, NOACs",            section: "CVS",          done: false, notes: "" },
      { id: "ph-7", topic: "Antibiotics — mechanism of action by class",            section: "Antimicrobials", done: false, notes: "" },
      { id: "ph-8", topic: "NSAIDs & opioids — mechanism & ADEs",                  section: "Analgesics",   done: false, notes: "" },
    ],
    reviewState: {},
    materials: [],
    tasks: [],
    gradeTarget: 80,
    createdAt: now, updatedAt: now,
  },
];

export function loadMedSchool() {
  try {
    const raw = localStorage.getItem(MS_KEY);
    if (raw !== null) return JSON.parse(raw) || DEFAULT_SUBJECTS;
    localStorage.setItem(MS_KEY, JSON.stringify(DEFAULT_SUBJECTS));
    return DEFAULT_SUBJECTS;
  } catch { return DEFAULT_SUBJECTS; }
}

export function saveMedSchool(subjects) {
  localStorage.setItem(MS_KEY, JSON.stringify(subjects));
}

export function patchSubject(subjects, id, patch) {
  return subjects.map(s => s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s);
}

export function yearStats(subjects, year) {
  const ys = subjects.filter(s => s.year === year);
  const allExams    = ys.flatMap(s => s.exams || []);
  const scoredExams = allExams.filter(e => e.score != null && e.maxScore);
  const avgGrade    = scoredExams.length > 0
    ? Math.round(scoredExams.reduce((acc, e) => acc + (e.score / e.maxScore) * 100, 0) / scoredExams.length)
    : null;
  const allTopics   = ys.flatMap(s => s.syllabus || []);
  const doneTopics  = allTopics.filter(t => t.done).length;
  const pct         = allTopics.length > 0 ? Math.round((doneTopics / allTopics.length) * 100) : 0;
  const today       = new Date().toISOString().slice(0, 10);
  const upcoming    = allExams
    .filter(e => e.date && e.date >= today && e.score == null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const pendingTasks = ys.flatMap(s => (s.tasks || []).filter(t => !t.done));
  return { count: ys.length, avgGrade, syllabusPct: pct, doneTopics, totalTopics: allTopics.length, upcoming, pendingTasks };
}
