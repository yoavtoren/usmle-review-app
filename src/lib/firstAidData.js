// First Aid for the USMLE Step 1 2025 — navigation data.
// PDF page = printed page + 21 (verified constant across the book body).
// The PDF itself is local-only (public/firstaid/FA2025.pdf, gitignored).

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
export const FA_PDF_URL   = `${BASE}/firstaid/FA2025.pdf`;
export const FA_INDEX_URL = `${BASE}/firstaid/fa-index.json`;
export const FA_TOTAL_PAGES = 865;

// Browsable contents — sections → chapters, with real PDF page numbers.
export const FA_CONTENTS = [
  {
    id: "s1", title: "Section I · Guide to Efficient Exam Preparation", page: 22, color: "#6D4AC2",
    children: [
      { title: "Introduction", page: 23 },
      { title: "USMLE Step 1 — The Basics", page: 23 },
      { title: "Learning Strategies", page: 31 },
      { title: "Timeline for Study", page: 35 },
      { title: "Study Materials", page: 38 },
      { title: "Test-Taking Strategies", page: 41 },
      { title: "Clinical Vignette Strategies", page: 42 },
      { title: "If You Think You Failed", page: 43 },
      { title: "Special Situations (Supplement)", page: 46 },
    ],
  },
  {
    id: "s2", title: "Section II · High-Yield General Principles", page: 48, color: "#0E7C86",
    children: [
      { title: "How to Use the Database", page: 49 },
      { title: "Biochemistry", page: 52 },
      { title: "Immunology", page: 114 },
      { title: "Microbiology", page: 142 },
      { title: "Pathology", page: 222 },
      { title: "Pharmacology", page: 248 },
      { title: "Public Health Sciences", page: 276 },
    ],
  },
  {
    id: "s3", title: "Section III · High-Yield Organ Systems", page: 300, color: "#4F46E5",
    children: [
      { title: "Approaching the Organ Systems", page: 301 },
      { title: "Cardiovascular", page: 304 },
      { title: "Endocrine", page: 350 },
      { title: "Gastrointestinal", page: 384 },
      { title: "Hematology and Oncology", page: 430 },
      { title: "Musculoskeletal, Skin & Connective Tissue", page: 470 },
      { title: "Neurology and Special Senses", page: 520 },
      { title: "Psychiatry", page: 590 },
      { title: "Renal", page: 616 },
      { title: "Reproductive", page: 650 },
      { title: "Respiratory", page: 698 },
      { title: "Rapid Review", page: 728 },
    ],
  },
  {
    id: "s4", title: "Section IV · Top-Rated Review Resources", page: 760, color: "#9A6B1F",
    children: [
      { title: "How to Use the Database", page: 761 },
      { title: "Question Banks & Apps", page: 762 },
      { title: "Comprehensive / Subject Resources", page: 763 },
    ],
  },
  {
    id: "back", title: "Reference", page: 776, color: "#565660",
    children: [
      { title: "Abbreviations and Symbols", page: 776 },
      { title: "Image Acknowledgments", page: 776 },
      { title: "Index", page: 794 },
    ],
  },
];
