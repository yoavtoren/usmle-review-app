#!/usr/bin/env python3
"""
Adds 'correctIf' to every elimination entry across all question JSON files.
Run: python3 scripts/patch_correct_if.py
"""
import json, os, glob

HERE = os.path.dirname(os.path.abspath(__file__))
QDIR = os.path.normpath(os.path.join(HERE, "..", "public", "questions"))

# correctIf keyed by (question_id, elimination_letter)
CORRECT_IF = {
  # q01 — Lagging strand / Okazaki fragments
  ("q01","A"): "Question asked for a feature common to BOTH daughter strands",
  ("q01","B"): "Never — 3'→5' DNA synthesis does not exist in any organism",
  ("q01","C"): "Question asked about a feature shared by both daughter strands (not unique to lagging)",
  ("q01","D"): "Question asked which strand needs FEWER primers (the leading strand needs only one)",
  # q02 — Adrenal medulla activated by ACh
  ("q02","B"): "Arrow pointed to zona fasciculata (adrenal cortex, cortisol zone)",
  ("q02","C"): "Arrow pointed to zona glomerulosa (outermost cortex, aldosterone zone)",
  ("q02","D"): "Question asked what the adrenal medulla RELEASES (its main product, ~80% epinephrine)",
  ("q02","E"): "Question asked about catecholamine OUTPUT from the medulla, not the activating input",
  # q03 — NF1 neurofibroma: neural crest origin
  ("q03","A"): "Tumor involved hepatocytes or pulmonary epithelium (endodermal, not neural crest)",
  ("q03","B"): "Tumor was rhabdomyosarcoma (mesoderm) or Wilms tumor (metanephric mesoderm)",
  ("q03","D"): "Tumor involved CNS astrocytes or oligodendrocytes (neural tube, not neural crest)",
  ("q03","E"): "Tumor was a chordoma (nucleus pulposus/notochord remnant)",
  ("q03","F"): "Question asked specifically about the melanocyte (café-au-lait pigment origin), not the neurofibromas themselves",
  # q04 — Pancreatic ductal adenocarcinoma
  ("q04","A"): "CT showed a biliary duct (CBD) mass, not a pancreatic head lesion",
  ("q04","B"): "Patient had cirrhosis, elevated AFP, and a hepatic mass on imaging",
  ("q04","C"): "Patient had elevated serum lipase and subcutaneous fat necrosis (acinar cell)",
  ("q04","E"): "Imaging showed a multilocular, enhancing vascular lesion (hemangioma on MRI)",
  # q05 — Croup = parainfluenza
  ("q05","A"): "Child was drooling, sitting in tripod position, and refused to swallow (epiglottitis)",
  ("q05","C"): "Auscultation revealed diffuse expiratory wheeze, not inspiratory stridor",
  ("q05","D"): "Child had only nasal congestion and mild rhinorrhea without cough or stridor",
  ("q05","E"): "Child appeared toxic/septic with purulent tracheal secretions and high fever",
  # q06 — Campylobacter (puppy, bloody diarrhea)
  ("q06","A"): "Child had watery vomiting within 1–6 hrs of eating reheated rice, no blood",
  ("q06","C"): "Child had fatty, pale, nonbloody diarrhea and O&P was positive for cysts",
  ("q06","D"): "Multiple people affected by watery vomiting/diarrhea with no blood (outbreak setting)",
  ("q06","E"): "Vomiting began within 1–6 hrs of eating, no bloody diarrhea, no leukocytes",
  # q07 — Child abuse: report to CPS
  ("q07","A"): "Child was in immediate physical danger requiring emergency protective custody",
  ("q07","B"): "Abuse was not yet suspected and thorough history-taking was the appropriate initial step",
  ("q07","C"): "A forensic interview (by trained examiner) was explicitly requested in a controlled setting",
  ("q07","E"): "Never — accusing a caregiver outside forensic protocol endangers the child and is never correct",
  # q08 — Intercostobrachial nerve (post-ALND)
  ("q08","B"): "Patient had weakness with arm adduction rather than sensory loss in the axilla/medial arm",
  ("q08","C"): "Patient had weakness of shoulder abduction and external rotation (suprascapular nerve)",
  ("q08","D"): "Patient had weakness of shoulder extension/adduction without any sensory loss (thoracodorsal nerve)",
  # q09 — Vaccine hesitancy: open dialogue first
  ("q09","B"): "Parent had already agreed to vaccination and the visit was purely for scheduling",
  ("q09","C"): "Parent had low health literacy and specifically requested written educational materials",
  ("q09","D"): "Never — declining to engage with a hesitant parent is never the recommended approach",
  ("q09","E"): "Response expressed genuine empathy WITHOUT a negating 'but' (e.g., 'I understand, and here's what data shows…')",
  # q10 — Ebstein anomaly → lithium → bipolar
  ("q10","A"): "Mother had significant alcohol use and neonate had thin vermillion, smooth philtrum, microcephaly (FAS features)",
  ("q10","C"): "Mother had placental abruption and baby had documented intrauterine growth restriction",
  ("q10","D"): "Baby had trisomy 21 features (not a teratogenic drug exposure question)",
  ("q10","E"): "Mother took valproate or phenytoin and baby had a neural tube defect (spina bifida)",
  ("q10","F"): "Mother had poorly controlled gestational diabetes and baby was macrosomic with a cardiac septal defect",
  ("q10","G"): "Mother took a medication specifically associated with neurodevelopmental delay (not Ebstein anomaly)",
  ("q10","H"): "Neonate had yawning, poor feeding, tremors, and a high Finnegan score (opioid withdrawal, not structural defect)",
  ("q10","I"): "Mother had schizophrenia treated with antipsychotics (not bipolar on lithium)",
  # q11 — Porphyria cutanea tarda (UROD)
  ("q11","A"): "Patient had neurologic symptoms and microcytic anemia with basophilic stippling (lead poisoning)",
  ("q11","B"): "Patient had sideroblastic anemia with ringed sideroblasts on bone marrow biopsy",
  ("q11","C"): "Patient had jaundice from hemolysis or hepatic disease (heme breakdown pathway)",
  ("q11","D"): "Patient had abdominal pain, port-wine urine, and neuropsychiatric symptoms WITHOUT photosensitive blistering (AIP)",
  # q12 — Benzodiazepine overdose ABG
  ("q12","A"): "Patient was hyperventilating due to anxiety, aspirin toxicity, or pulmonary embolism",
  ("q12","B"): "Patient had tachypnea, hypoxia, and widened A-a gradient (pulmonary embolism pattern)",
  ("q12","C"): "Known COPD patient had diffuse wheezing and worsening O2 saturation during an acute flare",
  ("q12","E"): "Patient had pneumonia or pulmonary edema (lung disease explaining widened A-a gradient)",
  # q13 — Glucagon → Gs → cAMP → PKA
  ("q13","A"): "Hormone was ANP, nitric oxide, or a phosphodiesterase-5 target (cGMP pathway)",
  ("q13","B"): "Hormone was growth hormone, prolactin, EPO, or a cytokine (JAK-STAT pathway)",
  ("q13","C"): "Question asked which enzyme TERMINATES glucagon signaling (PDE degrades cAMP)",
  ("q13","E"): "Hormone was insulin, IGF-1, or another growth factor (receptor tyrosine kinase pathway)",
  # q14 — Neonatal abstinence syndrome
  ("q14","A"): "Neonate had thin vermillion lip, absent philtrum, and microcephaly (FAS dysmorphic features)",
  ("q14","B"): "Neonate was sedated, hypotonic, with respiratory depression (opioid intoxication, not withdrawal)",
  ("q14","D"): "Baby had hypoplastic nails, cleft palate, and cardiac defects (fetal hydantoin teratogenic malformations)",
  ("q14","E"): "Baby had spina bifida or anencephaly (teratogen-induced structural neural tube defect)",
  # q15 — Refeeding hypophosphatemia
  ("q15","A"): "Patient had hyperparathyroidism or Fanconi syndrome causing chronic renal phosphate wasting",
  ("q15","B"): "Patient had chronic diarrhea or was taking phosphate-binding antacids causing GI losses",
  ("q15","C"): "Patient received massive IV phosphate infusion and developed precipitating hypocalcemia",
  ("q15","D"): "Patient underwent parathyroidectomy and was developing rapid bone remineralization (hungry bone)",
  # q16 — Chronic pancreatitis: fecal elastase
  ("q16","A"): "Patient had jaundice, elevated bilirubin, and normal fecal elastase (biliary obstruction)",
  ("q16","C"): "Patient had macrocytic anemia, elevated MCV, and positive Schilling test (B12 deficiency)",
  ("q16","D"): "Question asked which pancreatic secretion DECREASES (bicarbonate also decreases — but elastase is the direct test)",
  ("q16","E"): "Patient had positive anti-tTG antibodies and duodenal villous atrophy on biopsy (celiac disease)",
  # q17 — Pituitary stalk lesion → high prolactin
  ("q17","A"): "Question asked which anterior pituitary hormone UNIQUELY RISES with stalk section (only prolactin does)",
  ("q17","B"): "Same as ACTH — GH decreases with stalk section due to loss of GHRH",
  ("q17","D"): "Question asked about the secondary hypothyroidism that develops from stalk damage (TSH falls)",
  ("q17","E"): "Question asked which condition develops from stalk damage (central DI from ADH deficiency is also correct)",
  # q18 — Temporal lobe abscess from mastoid
  ("q18","A"): "Source was frontal sinusitis (not otitis) spreading intracranially to the frontal lobe",
  ("q18","B"): "Source was frontal sinusitis with direct frontal lobe extension (frontal, not temporal)",
  ("q18","D"): "Infection was periorbital/preseptal cellulitis from ethmoid sinusitis (not intracranial)",
  ("q18","E"): "Source was a furuncle in the facial danger triangle (upper lip/nose) causing cavernous sinus thrombosis",
  ("q18","F"): "Source was a mandibular/dental infection tracking down fascial planes toward the mediastinum",
  # q19 — Acute diverticulitis (LLQ)
  ("q19","B"): "Patient had 6 months of weight loss, melena, strong family history, and age >50 (colorectal cancer)",
  ("q19","C"): "Patient had a reducible groin mass that enlarged with Valsalva (inguinal hernia)",
  ("q19","D"): "Patient had sudden-onset hematochezia at the watershed area after a hypotensive episode (ischemic colitis)",
  ("q19","E"): "Patient was a young sexually active woman with bilateral adnexal tenderness and cervical motion tenderness (PID)",
  ("q19","F"): "Patient had years of bloody diarrhea, cramping, and skip lesions on colonoscopy (IBD)",
  # q20 — Resistance to thyroid hormone
  ("q20","A"): "Patient had low T4, elevated TSH, and positive anti-TPO antibodies (Hashimoto hypothyroidism)",
  ("q20","B"): "Patient on OCPs had elevated total T4 with normal free T4 and normal TSH (increased TBG)",
  ("q20","C"): "TSH were >10 with a pituitary MRI showing an adenoma (TSH-secreting pituitary tumor)",
  ("q20","D"): "Patient had low free T4, elevated TSH, and lived in an iodine-deficient region",
  # q21 — Malignant otitis externa (Pseudomonas)
  ("q21","A"): "Patient had seawater exposure or ate raw oysters and developed rapidly spreading necrotizing cellulitis (Vibrio)",
  ("q21","B"): "Organism was a lactose-fermenting Gram-negative rod in a UTI or pneumonia context",
  ("q21","D"): "Organism was non-motile AND lactose-negative (Acinetobacter or Stenotrophomonas scenario)",
  ("q21","E"): "Child had acute otitis media or an unvaccinated adult had epiglottitis (Haemophilus influenzae)",
  # q22 — SVC = common cardinal veins
  ("q22","B"): "Question asked about an aortic arch anomaly (vascular ring, persistent right aortic arch)",
  ("q22","C"): "Question asked about truncus arteriosus defect or pulmonary trunk development",
  ("q22","D"): "Question asked about a structure derived from foregut endoderm (esophagus, stomach)",
  ("q22","E"): "Question asked about a posterior mediastinal vessel derived from the paired dorsal aortae",
  # q23 — Pseudocholinesterase deficiency
  ("q23","A"): "Drug was an aminoglycoside or vancomycin (renally cleared, renal failure prolongs effect)",
  ("q23","B"): "Drug was propofol (anesthetic hypnotic; offset by redistribution, not metabolism)",
  ("q23","D"): "Patient had severe liver failure AND received a drug metabolized by the liver (not plasma cholinesterase)",
  ("q23","E"): "Myasthenic patient was RESISTANT to succinylcholine (not prolonged paralysis — opposite scenario)",
  # q24 — Ovarian cancer prevention: OCPs
  ("q24","A"): "Question asked about cervical cancer prevention (barrier methods + HPV vaccine are correct)",
  ("q24","B"): "Question asked about screening for cervical dysplasia (Pap smear is appropriate, not ovarian cancer)",
  ("q24","C"): "Question asked about endometrial cancer prevention (progestin-releasing IUD is protective)",
  ("q24","D"): "Question asked what INCREASES ovarian cancer risk (ovulation and nulliparity increase risk)",
  # q25 — Acute gout: first-line NSAID
  ("q25","B"): "Patient had aspirin-exacerbated asthma and the question was about leukotriene pathway blockade",
  ("q25","C"): "Patient had rheumatoid arthritis or psoriatic arthritis (not acute crystalline gout)",
  ("q25","D"): "Patient was in gout remission and the question asked about PREVENTING future attacks via urate lowering",
  ("q25","E"): "Patient was already stable on chronic allopurinol (continuation during acute flare may be acceptable)",
  # q26 — Eosinophilic esophagitis (biopsy)
  ("q26","B"): "Manometry showed absent peristalsis and failed LES relaxation, with both solids AND liquids impacted (achalasia)",
  ("q26","C"): "Adult had chronic GERD and biopsy showed columnar metaplasia with goblet cells (Barrett esophagus)",
  ("q26","D"): "Patient had Raynaud phenomenon and skin thickening with dilated esophagus (scleroderma)",
  ("q26","E"): "Immunocompromised patient had esophageal ulcers with eosinophilic intranuclear inclusions (HSV Cowdry A bodies)",
  # q27 — Pyogenic liver abscess (S. aureus hematogenous)
  ("q27","A"): "Patient had Charcot's triad (RUQ pain, fever, jaundice) from a bile duct stone (ascending cholangitis, enteric GNRs)",
  ("q27","B"): "Immunocompromised post-transplant patient had CMV hepatitis or viral liver lesion",
  ("q27","C"): "Patient traveled to an endemic area, had bloody diarrhea, and had a single large right-lobe abscess (amebic — E. histolytica via portal vein)",
  ("q27","E"): "Patient had diverticulitis or appendicitis with bacteremia spreading via portal vein (enteric flora: E. coli/Klebsiella, not S. aureus)",
  # q28 — Cystic fibrosis = obstructive PFTs
  ("q28","A"): "PFTs showed normal or elevated FEV1/FVC ratio (non-obstructive or hyperventilation pattern)",
  ("q28","B"): "Patient had pulmonary fibrosis, sarcoidosis, or a neuromuscular disease causing true restrictive pattern",
  ("q28","C"): "Patient was acutely hyperventilating (washing out air, transiently low RV) — not obstructive air trapping",
  ("q28","E"): "PFTs were entirely normal (early/mild CF without airflow obstruction yet)",
  # q29 — Urge incontinence: beta-3 agonist
  ("q29","A"): "Patient had STRESS incontinence from urethral hypermobility (alpha-1 agonist to tighten sphincter is correct there)",
  ("q29","B"): "Patient had heart failure or sinus bradycardia requiring cardiac beta-1 receptor intervention",
  ("q29","C"): "Patient had OVERFLOW incontinence from detrusor underactivity (contracting the muscle, not relaxing it, is needed)",
  ("q29","D"): "Patient had symptomatic bradycardia or low cardiac output (beta-1 cardiac question, not urologic)",
  ("q29","F"): "Patient had urinary RETENTION from neurogenic bladder underactivity (bethanechol contracts detrusor — needed there)",
}

def patch_file(path):
    with open(path) as f:
        q = json.load(f)
    changed = False
    for elim in q.get("eliminations", []):
        key = (q["id"], elim["letter"])
        if key in CORRECT_IF and "correctIf" not in elim:
            elim["correctIf"] = CORRECT_IF[key]
            changed = True
    if changed:
        with open(path, "w") as f:
            json.dump(q, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  patched {os.path.basename(path)}")
    else:
        print(f"  skipped {os.path.basename(path)} (no changes)")

if __name__ == "__main__":
    files = sorted(glob.glob(os.path.join(QDIR, "q*.json")))
    print(f"Patching {len(files)} question files…")
    for path in files:
        patch_file(path)
    print("Done.")
