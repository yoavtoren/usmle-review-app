// FA chapters + subsections (chapter-level lookup for autocomplete)
export const FA_SECTIONS = [
  { chapter: "Biochemistry", subsections: [
    "Molecular Biology Basics","Amino Acids & Proteins","Enzyme Kinetics",
    "Vitamins & Nutrition","Glycolysis & Pyruvate Metabolism","TCA Cycle",
    "Oxidative Phosphorylation","Gluconeogenesis","Glycogen Metabolism",
    "HMP Shunt & Sugar Metabolism","Fatty Acid Synthesis & Oxidation",
    "Lipid Transport","Cholesterol & Bile Acids","Amino Acid Metabolism",
    "Urea Cycle","Nucleotide Metabolism","Heme Synthesis & Porphyrias",
    "Glycogen Storage Diseases","Lysosomal Storage Diseases","Metabolic Disorders",
  ]},
  { chapter: "Immunology", subsections: [
    "Innate Immunity","Adaptive Immunity Overview","T Lymphocytes",
    "B Lymphocytes & Immunoglobulins","MHC & Antigen Presentation",
    "Complement System","Type I Hypersensitivity","Type II Hypersensitivity",
    "Type III Hypersensitivity","Type IV Hypersensitivity",
    "Autoimmune Diseases","Immunodeficiencies — B Cell",
    "Immunodeficiencies — T Cell","Immunodeficiencies — Combined",
    "Transplant Rejection","Vaccines & Immunization",
  ]},
  { chapter: "Microbiology", subsections: [
    "Bacterial Structure & Virulence","Bacterial Genetics",
    "Gram-Positive Cocci","Gram-Positive Rods","Gram-Negative Cocci",
    "Gram-Negative Rods — Enteric","Gram-Negative Rods — Non-enteric",
    "Atypical Bacteria","Spirochetes","Mycobacteria",
    "Obligate Intracellular Pathogens","Anaerobes","Zoonoses",
    "DNA Viruses","RNA Viruses","HIV & AIDS","Hepatitis Viruses",
    "Fungi — Systemic","Fungi — Opportunistic","Fungi — Superficial",
    "Protozoa","Helminths",
    "Antibiotics — Cell Wall","Antibiotics — Protein Synthesis",
    "Antibiotics — DNA / Cell Membrane","Antivirals","Antifungals","Antiparasitics",
  ]},
  { chapter: "Pathology", subsections: [
    "Cellular Injury & Adaptation","Apoptosis & Necrosis",
    "Acute Inflammation","Chronic Inflammation",
    "Wound Healing & Repair","Neoplasia — Characteristics",
    "Neoplasia — Carcinogenesis","Tumor Markers & Grading",
    "Vascular Pathology","Genetic Pathology","Environmental Pathology",
  ]},
  { chapter: "Pharmacology", subsections: [
    "Pharmacokinetics","Pharmacodynamics","Drug Interactions & Toxicity",
    "Autonomic Pharmacology","Cholinergic Drugs","Adrenergic Drugs",
    "Cardiovascular — Rate & Rhythm","Cardiovascular — HTN & Heart Failure",
    "Lipid-Lowering Drugs","Pulmonary Pharmacology","GI Pharmacology",
    "Diuretics","Anticoagulants & Antiplatelets",
    "Endocrine Pharmacology","Reproductive Pharmacology",
    "CNS — Sedation & Anesthesia","CNS — Pain & Analgesics",
    "Psychiatric Pharmacology","Antiepileptics",
    "Anti-infective Agents","Immunosuppressants",
    "Cancer Pharmacology","Toxicology",
  ]},
  { chapter: "Behavioral Science & Biostatistics", subsections: [
    "Biostatistics — Study Designs","Biostatistics — Statistical Tests",
    "Biostatistics — Bias & Error","Epidemiology",
    "Ethics & Informed Consent","Healthcare Systems",
    "Substance Use Disorders","Sleep Disorders",
    "Developmental Milestones","Learning & Conditioning",
    "Defense Mechanisms","Grief & Bereavement",
  ]},
  { chapter: "Cardiovascular", subsections: [
    "Cardiac Embryology","Cardiac Anatomy & Physiology",
    "Cardiac Action Potentials","Congenital Heart Disease",
    "Coronary Artery Disease","Heart Failure","Cardiomyopathies",
    "Arrhythmias","Valvular Heart Disease","Pericardial Disease",
    "Hypertension","Vascular Disease","Shock",
  ]},
  { chapter: "Endocrine", subsections: [
    "Hypothalamus & Pituitary","Thyroid — Physiology",
    "Thyroid — Pathology","Adrenal Cortex — Physiology",
    "Adrenal Cortex — Pathology","Adrenal Medulla",
    "Pancreas & Diabetes","Parathyroid & Calcium",
    "MEN Syndromes","Endocrine Tumors",
  ]},
  { chapter: "Gastrointestinal", subsections: [
    "GI Anatomy & Histology","GI Physiology — Secretion",
    "GI Physiology — Motility","Esophagus",
    "Stomach Pathology","Small Intestine — Malabsorption",
    "Small Intestine — Other","Colon — IBD",
    "Colon — Other Pathology","Liver — Hepatitis",
    "Liver — Cirrhosis & Portal HTN","Liver — Other",
    "Biliary System","Pancreas Pathology","GI Tumors","Hernias",
  ]},
  { chapter: "Hematology & Oncology", subsections: [
    "Hematopoiesis","Anemia — Overview","Microcytic Anemias",
    "Macrocytic Anemias","Hemolytic Anemias","Aplastic Anemia",
    "Platelet Disorders","Coagulation Cascade","Coagulation Disorders",
    "Thrombophilias","Acute Leukemias","Chronic Leukemias",
    "Lymphomas — Hodgkin","Lymphomas — Non-Hodgkin",
    "Myeloma & Plasma Cell Disorders","Myeloproliferative Disorders",
    "Transfusion Medicine",
  ]},
  { chapter: "MSK, Skin & Connective Tissue", subsections: [
    "Bone Physiology & Metabolic Bone Disease","Bone Tumors",
    "Osteoarthritis & Non-inflammatory Joint","Inflammatory Arthritis",
    "Crystal Arthropathies","Seronegative Spondyloarthropathies",
    "Myopathies & Muscular Dystrophies","Connective Tissue Disorders",
    "Skin Infections & Inflammation","Skin Autoimmune","Skin Tumors",
    "Soft Tissue Tumors",
  ]},
  { chapter: "Neurology & Special Senses", subsections: [
    "Neuroanatomy Overview","Cranial Nerves",
    "Spinal Cord Anatomy & Lesions","Brainstem Lesions",
    "Stroke — Ischemic","Stroke — Hemorrhagic",
    "Dementia & Neurodegeneration","Seizure Disorders",
    "Headache Disorders","Movement Disorders",
    "Demyelinating Diseases","Peripheral Neuropathy",
    "Brain & Spinal Tumors","Eye Pathology","Ear Pathology","Pediatric Neurology",
  ]},
  { chapter: "Psychiatry", subsections: [
    "Psychotic Disorders","Mood Disorders — Depression",
    "Mood Disorders — Bipolar","Anxiety Disorders",
    "OCD & Related Disorders","Trauma & Stressor-Related",
    "Somatic & Functional Disorders","Eating Disorders",
    "Personality Disorders","Child & Adolescent Psychiatry",
    "Substance Use Disorders",
    "Antipsychotics","Antidepressants & Mood Stabilizers","Anxiolytics & Hypnotics",
  ]},
  { chapter: "Renal", subsections: [
    "Renal Anatomy & Embryology","GFR & Clearance",
    "Proximal Tubule Physiology","Loop Physiology",
    "Distal & Collecting Duct Physiology","Acid-Base Physiology",
    "Acid-Base Disorders","Fluid & Electrolyte Disorders",
    "Glomerular Disease — Nephritic","Glomerular Disease — Nephrotic",
    "Tubulointerstitial Disorders","Acute Kidney Injury",
    "Chronic Kidney Disease","Renal Tumors",
    "Urinary Tract Infections","Urolithiasis",
  ]},
  { chapter: "Reproductive", subsections: [
    "Embryology — Genitourinary","Male Reproductive Anatomy",
    "Female Reproductive Anatomy","Menstrual Cycle Physiology",
    "Contraception","Infertility","Normal Pregnancy",
    "Pregnancy Complications","Labor & Delivery",
    "Postpartum Complications","STIs",
    "Ovarian Pathology","Uterine & Cervical Pathology",
    "Male Reproductive Pathology","Breast Pathology",
  ]},
];

// Subject → best resources (shown in "didn't understand mechanism" tasks)
export const RESOURCE_GUIDANCE = {
  Pharm:      ["First Aid — Pharmacology chapter", "Sketchy Pharm"],
  Biochem:    ["First Aid — Biochemistry chapter", "Sketchy Biochem"],
  Immuno:     ["First Aid — Immunology chapter"],
  Micro:      ["First Aid — Microbiology chapter", "Sketchy Micro"],
  Path:       ["First Aid — Pathology chapter", "Pathoma"],
  Physio:     ["First Aid — relevant system chapter"],
  Behavioral: ["First Aid — Behavioral Science", "Randy Neil — Biostatistics"],
  Biostats:   ["Randy Neil — Biostatistics videos", "First Aid — Biostatistics"],
  Psych:      ["First Aid — Psychiatry chapter"],
  Anatomy:    ["First Aid — relevant anatomy section"],
};

export const SUBJECTS = [
  "Pharm","Biochem","Immuno","Micro","Path","Physio","Behavioral","Biostats","Psych","Anatomy",
];

export const SYSTEMS = [
  "Cardio","Resp","GI","Renal","Endo","Repro","Heme/Onc","MSK/Skin","Neuro","General",
];

// Subjects to front-load (spec: show first regardless of mood)
export const FRONT_LOAD_SUBJECTS = new Set(["Pharm","Biochem","Immuno","Biostats","Behavioral","Psych"]);

// Lower number = surfaces first
export const SUBJECT_SORT_WEIGHT = {
  Pharm: 1, Biochem: 2, Immuno: 3, Biostats: 4, Behavioral: 5, Psych: 6,
  Path: 7, Micro: 8, Physio: 9, Anatomy: 10,
};

export function makeFASectionId(chapter, subsection) {
  if (!chapter) return null;
  return subsection ? `${chapter} › ${subsection}` : chapter;
}
