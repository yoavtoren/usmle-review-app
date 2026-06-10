#!/usr/bin/env python3
"""
Generate one JSON file per USMLE review question into public/questions/,
plus a deck.json index. Re-run any time you add questions to QUESTIONS below.

Usage:  python3 scripts/generate_questions.py
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "questions"))
os.makedirs(OUT, exist_ok=True)

# Clue color code (matches the study widgets):
#   red = fatal/critical | orange = demographic/risk | blue = key context
#   green = confirmatory | purple = trap/distractor
QUESTIONS = [
 {
  "id":"q01","item":1,"qid":"1418","title":"Lagging strand: Okazaki fragments",
  "system":"Biochemistry","topic":"DNA replication","correct":"E","yourAnswer":"E","percentCorrect":65,
  "vignette":"A 4-year-old with ALL (fatigue, bone pain, lymphadenopathy, purpura, anemia/thrombocytopenia, blasts on smear) starts doxorubicin, which intercalates DNA and blocks replication at the fork. Which feature is unique to the daughter strand synthesized OPPOSITE the growing fork (the lagging strand)?",
  "clues":[
    {"text":"opposite direction of the growing fork","type":"purple","note":"= the lagging strand; built 5'->3' away from the fork, so it must be discontinuous."},
    {"text":"doxorubicin intercalates DNA","type":"blue","note":"Anthracycline; key toxicity = dilated cardiomyopathy (prevent with dexrazoxane)."}],
  "whatMatters":"The clinical ALL story is window dressing. The testable point: lagging strand = discontinuous synthesis = Okazaki fragments.",
  "strategy":"For replication questions, separate leading (continuous) vs lagging (discontinuous). DNA pol only builds 5'->3'.",
  "options":[
    {"letter":"A","text":"3'->5' exonuclease activity (proofreading)","correct":False},
    {"letter":"B","text":"3'->5' polymerase activity","correct":False},
    {"letter":"C","text":"5'->3' exonuclease activity","correct":False},
    {"letter":"D","text":"RNA primer synthesis before DNA","correct":False},
    {"letter":"E","text":"Synthesis of multiple, short DNA fragments","correct":True}],
  "eliminations":[
    {"letter":"A","what":"Proofreading exonuclease.","why":"Occurs on BOTH strands, not unique to lagging."},
    {"letter":"B","what":"No polymerase synthesizes 3'->5'.","why":"Doesn't exist."},
    {"letter":"C","what":"Removes RNA primers.","why":"Happens on both strands."},
    {"letter":"D","what":"Primer needed to start synthesis.","why":"Both strands need a primer (leading: one; lagging: many)."}],
  "reasoning":["Doxorubicin blocks replication -> 2 daughter strands","'Opposite direction of fork' = lagging strand","DNA pol only 5'->3' -> lagging built discontinuously","Discontinuous = multiple short Okazaki fragments -> E"],
  "mechanism":"DNA polymerase extends only 5'->3'. The lagging strand template runs 5'->3' toward the fork, so its new strand grows AWAY from the fork as short Okazaki fragments, each primed by RNA; RNase H/FEN1 remove primers and DNA ligase seals nicks.",
  "keywords":[
    {"front":"Synthesized away from the replication fork","back":"Lagging strand"},
    {"front":"Multiple short DNA fragments","back":"Okazaki fragments"},
    {"front":"Joins Okazaki fragments","back":"DNA ligase"},
    {"front":"Removes RNA primer","back":"5'->3' exonuclease (RNase H / FEN1)"}],
  "firstAid":[{"topic":"DNA replication","location":"Biochemistry > Molecular > replication fork diagram, Okazaki fragments, enzymes table"}],
  "memoryHook":"LAGging makes baGs of fraGments — lagging strand = Okazaki pieces."
 },
 {
  "id":"q02","item":2,"qid":"8424","title":"Adrenal medulla activated by acetylcholine",
  "system":"Endocrine/Anatomy","topic":"Adrenal medulla / ANS","correct":"A","yourAnswer":"E","percentCorrect":40,
  "vignette":"Histology of an adrenal gland; the arrow points to the deep, basophilic (blue-purple) layer = adrenal medulla. Which substance directly activates these cells?",
  "clues":[
    {"text":"arrow at deep basophilic layer","type":"red","note":"= adrenal medulla (chromaffin cells). The pink cortex sits above it."},
    {"text":"directly activated","type":"purple","note":"Asks for the INPUT to the cell, not its output."}],
  "whatMatters":"Identify the layer (medulla), then recall its physiologic input. Chromaffin cells = modified postganglionic sympathetic neurons.",
  "strategy":"'Directly activated by' = the neurotransmitter arriving at the cell, never the substance the cell secretes.",
  "options":[
    {"letter":"A","text":"Acetylcholine","correct":True},
    {"letter":"B","text":"ACTH","correct":False},
    {"letter":"C","text":"Angiotensin II","correct":False},
    {"letter":"D","text":"Epinephrine","correct":False},
    {"letter":"E","text":"Norepinephrine","correct":False}],
  "eliminations":[
    {"letter":"B","what":"Drives the cortex (cortisol).","why":"Arrow is on the medulla."},
    {"letter":"C","what":"Drives zona glomerulosa (aldosterone).","why":"Wrong layer (outermost cortex)."},
    {"letter":"D","what":"Medulla's main product (~80%).","why":"Output, not the activator."},
    {"letter":"E","what":"Also a product/secretion.","why":"Output, not input; the cell IS the postganglionic neuron."}],
  "reasoning":["Arrow = adrenal medulla","Chromaffin cells = modified postganglionic sympathetic neurons","Their input is the preganglionic fiber (cholinergic)","Direct activator = ACh on nicotinic receptors -> A"],
  "mechanism":"The adrenal medulla is a 'giant sympathetic ganglion': preganglionic splanchnic fibers synapse directly on chromaffin cells and release ACh onto nicotinic receptors, triggering epinephrine/NE release.",
  "keywords":[
    {"front":"Deep basophilic adrenal layer","back":"Medulla (chromaffin cells)"},
    {"front":"Directly activates adrenal medulla","back":"Acetylcholine -> nicotinic receptors"},
    {"front":"Chromaffin cell identity","back":"Modified postganglionic sympathetic neuron"},
    {"front":"Zona glomerulosa stimulator","back":"Angiotensin II"}],
  "firstAid":[{"topic":"Adrenal gland","location":"Endocrine > Anatomy/Physiology > cortex zones (GFR) + medulla"},
              {"topic":"Autonomic NS","location":"Neuro/Physio > preganglionic fibers cholinergic; medulla = sympathetic exception"}],
  "memoryHook":"The medulla is a giant sympathetic ganglion — preganglionic ACh fires it."
 },
 {
  "id":"q03","item":3,"qid":"1534","title":"NF1 neurofibroma: neural crest origin",
  "system":"Embryology","topic":"Neural crest derivatives","correct":"C","yourAnswer":None,"percentCorrect":61,
  "vignette":"22-year-old with cafe-au-lait macules and multiple soft cutaneous neurofibromas (NF1). The predominant tumor cell originated from which structure?",
  "clues":[
    {"text":"cafe-au-lait spots + neurofibromas","type":"red","note":"Neurofibromatosis type 1 (NF1; chr 17, neurofibromin/Ras-GAP)."},
    {"text":"headaches, no deficits","type":"purple","note":"Decoy toward a CNS/neural-tube answer."}],
  "whatMatters":"Neurofibroma's predominant cell = Schwann cell, a neural crest derivative.",
  "strategy":"Origin questions = 2-step chain: disease -> cell of origin -> germ layer. Memorize neural crest derivatives cold.",
  "options":[
    {"letter":"A","text":"Endoderm","correct":False},
    {"letter":"B","text":"Mesoderm","correct":False},
    {"letter":"C","text":"Neural crest","correct":True},
    {"letter":"D","text":"Neural tube","correct":False},
    {"letter":"E","text":"Notochord","correct":False},
    {"letter":"F","text":"Surface ectoderm","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Gut, liver, lungs.","why":"No Schwann cells."},
    {"letter":"B","what":"Muscle, bone, blood, kidney.","why":"'Soft fleshy' tempts but predominant cell is Schwann (neural crest)."},
    {"letter":"D","what":"CNS, retina, CNS glia.","why":"Schwann cells are PERIPHERAL = neural crest, not neural tube."},
    {"letter":"E","what":"Nucleus pulposus only.","why":"Chordoma, not neurofibroma."},
    {"letter":"F","text":"","what":"Epidermis, lens, anterior pituitary.","why":"Cafe-au-lait pigment is melanocytes (also neural crest), but tumor cell is Schwann."}],
  "reasoning":["Cafe-au-lait + neurofibromas = NF1","Neurofibroma predominant cell = Schwann cell","Schwann cells arise from neural crest","Origin = neural crest -> C"],
  "mechanism":"Loss of neurofibromin (Ras-GAP) removes inhibition of Ras, driving Schwann-cell proliferation. Schwann cells, melanocytes, and the adrenal medulla all arise from neural crest.",
  "keywords":[
    {"front":"Cafe-au-lait + neurofibromas","back":"NF1 (chr 17, neurofibromin)"},
    {"front":"Neurofibroma predominant cell","back":"Schwann cell"},
    {"front":"Schwann cell origin","back":"Neural crest"},
    {"front":"Bilateral acoustic schwannomas","back":"NF2 (chr 22)"}],
  "firstAid":[{"topic":"Neural crest derivatives","location":"Embryology > neural crest table (MOTEL PASS)"},
              {"topic":"NF1","location":"Neuro/Genetics > neurocutaneous disorders"}],
  "memoryHook":"Schwann cells live in a MOTEL — neural crest derivative."
 },
 {
  "id":"q04","item":4,"qid":"21994","title":"Pancreatic ductal adenocarcinoma origin",
  "system":"GI/Pathology","topic":"Pancreatic cancer","correct":"D","yourAnswer":"B","percentCorrect":54,
  "vignette":"62-year-old smoker with back-radiating epigastric pain, weight loss, jaundice; CT shows a pancreatic mass. The lesion originated from which cell?",
  "clues":[
    {"text":"back-radiating epigastric pain + weight loss + jaundice","type":"red","note":"Classic pancreatic cancer triad."},
    {"text":"smoked most of his life","type":"orange","note":"#1 modifiable risk factor for PDAC."},
    {"text":"CT pancreatic mass","type":"blue","note":"Localizes to pancreas, excluding biliary tree/liver."}],
  "whatMatters":"~85% of pancreatic cancers are ductal adenocarcinoma -> ductal epithelium. Default to ductal unless acinar clues given.",
  "strategy":"'Originated from which cell' = name the tumor, then its default cell of origin (common > rare variant).",
  "options":[
    {"letter":"A","text":"Bile duct epithelium","correct":False},
    {"letter":"B","text":"Hepatocyte","correct":False},
    {"letter":"C","text":"Pancreatic acinar cell","correct":False},
    {"letter":"D","text":"Pancreatic duct epithelium","correct":True},
    {"letter":"E","text":"Vascular endothelium","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Cholangiocarcinoma.","why":"CT shows pancreatic, not biliary, mass."},
    {"letter":"B","what":"HCC (cirrhosis, AFP).","why":"No liver mass/cirrhosis; jaundice is obstructive."},
    {"letter":"C","what":"Acinar cell carcinoma (rare).","why":"Much rarer; no fat necrosis/high lipase clues."},
    {"letter":"E","what":"Hemangioma/angiosarcoma.","why":"Benign vascular; doesn't cause this picture."}],
  "reasoning":["Back pain + weight loss + jaundice + smoking + pancreatic mass = PDAC","Most pancreatic cancer (~85%) is ductal","Cell of origin = pancreatic duct epithelium -> D"],
  "mechanism":"PDAC arises from ductal epithelium with dense desmoplasia; drivers KRAS, CDKN2A, TP53, SMAD4. Markers/associations: CA 19-9, Trousseau migratory thrombophlebitis, Courvoisier sign.",
  "keywords":[
    {"front":"Back-radiating epigastric pain + weight loss","back":"Pancreatic cancer"},
    {"front":"Most common pancreatic cancer cell","back":"Ductal epithelium (PDAC)"},
    {"front":"Migratory thrombophlebitis","back":"Trousseau sign"},
    {"front":"Pancreatic cancer marker","back":"CA 19-9"}],
  "firstAid":[{"topic":"Pancreatic adenocarcinoma","location":"GI > pancreatic cancer (ductal, risk factors, Courvoisier, Trousseau)"}],
  "memoryHook":"Pancreatic cancer is a DUCT problem — default = Ductal adenocarcinoma."
 },
 {
  "id":"q05","item":5,"qid":"1667","title":"Croup = parainfluenza virus",
  "system":"Pediatrics/Micro","topic":"Pediatric respiratory infections","correct":"B","yourAnswer":"B","percentCorrect":51,
  "vignette":"18-month-old with URI prodrome then barking cough, inspiratory stridor worse with crying, mild distress, CLEAR lungs. Which pathogen?",
  "clues":[
    {"text":"barking cough + inspiratory stridor (worse with agitation)","type":"red","note":"Hallmark of croup (laryngotracheitis), subglottic narrowing."},
    {"text":"lungs clear","type":"green","note":"Upper-airway problem; excludes bronchiolitis/pneumonia."}],
  "whatMatters":"Toddler + barking cough + inspiratory stridor + clear lungs = croup = parainfluenza.",
  "strategy":"Stridor = upper airway (croup); wheeze + abnormal lungs = lower airway (bronchiolitis/RSV).",
  "options":[
    {"letter":"A","text":"Haemophilus influenzae","correct":False},
    {"letter":"B","text":"Parainfluenza virus","correct":True},
    {"letter":"C","text":"Respiratory syncytial virus","correct":False},
    {"letter":"D","text":"Rhinovirus","correct":False},
    {"letter":"E","text":"Staphylococcus aureus","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Epiglottitis (drooling, tripod).","why":"No drooling/dysphagia; rare post-Hib vaccine."},
    {"letter":"C","what":"Bronchiolitis (wheeze).","why":"Lungs clear; sign is stridor, not wheeze."},
    {"letter":"D","what":"Common cold.","why":"Explains prodrome, not barking cough/stridor."},
    {"letter":"E","what":"Bacterial tracheitis (toxic).","why":"Child only mildly ill; not toxic/purulent."}],
  "reasoning":["Barking cough + inspiratory stridor + clear lungs = croup","Most common cause = parainfluenza -> B"],
  "mechanism":"Parainfluenza infects nasopharynx then larynx/trachea -> subglottic edema -> barking cough, stridor (steeple sign on X-ray). Tx: humidified air, corticosteroids, racemic epi if severe.",
  "keywords":[
    {"front":"Barking cough + inspiratory stridor","back":"Croup -> parainfluenza"},
    {"front":"Steeple sign","back":"Croup"},
    {"front":"Expiratory wheeze, infant <2","back":"Bronchiolitis -> RSV"},
    {"front":"Drooling, tripod, thumbprint sign","back":"Epiglottitis -> H. influenzae b"}],
  "firstAid":[{"topic":"Croup / parainfluenza","location":"Micro/Peds > viral respiratory infections; paramyxovirus"}],
  "memoryHook":"A seal walks into a STEEPLE — barking cough + steeple sign = croup."
 },
 {
  "id":"q06","item":6,"qid":"1422","title":"Campylobacter (puppy, bloody diarrhea)",
  "system":"GI/Micro","topic":"Acute infectious diarrhea","correct":"B","yourAnswer":"B","percentCorrect":64,
  "vignette":"8-year-old with fever, abdominal pain, diarrhea; new puppy from a kennel. Stool: occult blood + numerous leukocytes, NEGATIVE ova and parasites. Cause?",
  "clues":[
    {"text":"fever + bloody, leukocyte-positive stool","type":"red","note":"Inflammatory (invasive) diarrhea."},
    {"text":"new puppy from a kennel","type":"red","note":"Classic Campylobacter exposure."},
    {"text":"negative ova and parasites","type":"blue","note":"Argues against parasites; favors invasive bacterium."}],
  "whatMatters":"Inflammatory diarrhea (blood + leukocytes, O&P negative) + puppy = Campylobacter jejuni.",
  "strategy":"Classify diarrhea: inflammatory (invasive bacteria) vs noninflammatory (viruses/toxins). Then use exposure to name the bug.",
  "options":[
    {"letter":"A","text":"Bacillus cereus","correct":False},
    {"letter":"B","text":"Campylobacter jejuni","correct":True},
    {"letter":"C","text":"Giardia lamblia","correct":False},
    {"letter":"D","text":"Norovirus","correct":False},
    {"letter":"E","text":"Staphylococcus aureus","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Toxin, watery (reheated rice).","why":"Noninflammatory; no blood/leukocytes."},
    {"letter":"C","what":"Parasite, fatty nonbloody.","why":"O&P negative; noninflammatory."},
    {"letter":"D","what":"Virus, watery, outbreaks.","why":"No fecal blood/leukocytes."},
    {"letter":"E","what":"Preformed toxin, rapid vomiting.","why":"Noninflammatory, short incubation."}],
  "reasoning":["Fever + bloody/leukocyte stool = inflammatory diarrhea","O&P negative -> invasive bacterium","Puppy/kennel exposure -> Campylobacter -> B"],
  "mechanism":"Campylobacter jejuni: curved/comma-shaped, oxidase+, microaerophilic, grows at 42C; invades mucosa -> bloody diarrhea. Antecedent of Guillain-Barre and reactive arthritis.",
  "keywords":[
    {"front":"Bloody diarrhea + puppy exposure","back":"Campylobacter jejuni"},
    {"front":"Comma-shaped, 42C, oxidase+","back":"Campylobacter"},
    {"front":"Ascending paralysis weeks after diarrhea","back":"Guillain-Barre (post-Campylobacter)"},
    {"front":"Fecal blood + leukocytes","back":"Inflammatory (invasive) diarrhea"}],
  "firstAid":[{"topic":"Campylobacter","location":"Micro > GI bacteria; inflammatory vs noninflammatory diarrhea table"}],
  "memoryHook":"Campylobacter = a CAMPER's comma from puppies & poultry; can trigger GBS."
 },
 {
  "id":"q07","item":7,"qid":"1107","title":"Suspected child abuse: report to CPS",
  "system":"Ethics","topic":"Mandated reporting","correct":"D","yourAnswer":"B","percentCorrect":78,
  "vignette":"4-year-old with a healing round cigarette burn on the back, inconsistent caregiver explanation, and the child says 'that happens when I'm bad.' Best next step?",
  "clues":[
    {"text":"round burn + inconsistent history","type":"red","note":"Patterned inflicted injury + mechanism that doesn't match = suspected abuse."},
    {"text":"'that happens when I'm bad'","type":"red","note":"Child disclosure suggesting inflicted injury."}],
  "whatMatters":"Reasonable suspicion of child abuse -> document + report to CPS. You don't need proof.",
  "strategy":"Suspected abuse = the physician REPORTS; CPS investigates. Avoid options that interrogate, accuse, or delay.",
  "options":[
    {"letter":"A","text":"Hospitalize for safety","correct":False},
    {"letter":"B","text":"Ask about daytime supervision","correct":False},
    {"letter":"C","text":"Call security, interview alone","correct":False},
    {"letter":"D","text":"Notify child protective services","correct":True},
    {"letter":"E","text":"Tell mother burn is non-accidental","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Admission for safety.","why":"Not the mandated step; reporting comes first."},
    {"letter":"B","what":"Gathering social history.","why":"Delays the required report; CPS's job."},
    {"letter":"C","what":"Separate to interview.","why":"Confrontational; not the physician's role."},
    {"letter":"E","what":"Accusing the caregiver.","why":"Endangers child, damages rapport; stay nonjudgmental."}],
  "reasoning":["Patterned burn + inconsistent history + child statement = reasonable suspicion","Physician is a mandated reporter","Document objective findings + report to CPS -> D"],
  "mechanism":"Physicians are mandated reporters; reasonable suspicion (not proof) triggers the duty. Good-faith reporting is protected; CPS investigates and arranges protection.",
  "keywords":[
    {"front":"Round burn + inconsistent explanation","back":"Suspect child abuse -> report CPS"},
    {"front":"Threshold to report abuse","back":"Reasonable suspicion (not proof)"},
    {"front":"Who investigates abuse","back":"CPS / law enforcement, not the physician"},
    {"front":"Injuries in different healing stages","back":"Classic abuse red flag"}],
  "firstAid":[{"topic":"Child abuse / mandated reporting","location":"Ethics/Peds > abuse features, reporting"}],
  "memoryHook":"Suspect -> Document -> Report. The doctor reports; CPS investigates."
 },
 {
  "id":"q08","item":8,"qid":"19291","title":"Intercostobrachial nerve (post-ALND sensory loss)",
  "system":"Anatomy","topic":"Nerves at risk in axillary surgery","correct":"A","yourAnswer":"D","percentCorrect":44,
  "vignette":"Woman a month after mastectomy + axillary lymph node dissection has burning/aching and decreased sensation of the medial upper arm; normal shoulder ROM, no weakness. Injured nerve?",
  "clues":[
    {"text":"axillary lymph node dissection","type":"red","note":"Intercostobrachial nerve is the most frequently injured nerve in ALND."},
    {"text":"burning/aching, decreased sensation","type":"red","note":"Sensory deficit -> a sensory nerve."},
    {"text":"normal shoulder ROM","type":"green","note":"No motor deficit -> rules out motor nerves."}],
  "whatMatters":"Pure sensory deficit of the medial upper arm after ALND = intercostobrachial nerve (T2).",
  "strategy":"Classify deficit as sensory vs motor first. Burning/numbness = sensory nerve; weakness/winging = motor nerve.",
  "options":[
    {"letter":"A","text":"Intercostobrachial","correct":True},
    {"letter":"B","text":"Medial pectoral","correct":False},
    {"letter":"C","text":"Suprascapular","correct":False},
    {"letter":"D","text":"Thoracodorsal","correct":False}],
  "eliminations":[
    {"letter":"B","what":"Motor to pectoralis (adduction).","why":"No cutaneous sensation; no weakness here."},
    {"letter":"C","what":"Motor to supra/infraspinatus.","why":"Doesn't traverse axilla; causes weak abduction/ER."},
    {"letter":"D","what":"Motor to latissimus dorsi.","why":"Purely motor; can't cause sensory loss."}],
  "reasoning":["Burning + decreased sensation = sensory deficit","Normal ROM rules out motor nerves","Territory = medial upper arm/axilla after ALND","Pure sensory medial-arm nerve = intercostobrachial -> A"],
  "mechanism":"The intercostobrachial nerve (lateral cutaneous branch of T2) is purely sensory to the axilla and medial upper arm and crosses the surgical field in ALND, the most commonly injured nerve there.",
  "keywords":[
    {"front":"Burning/numb medial arm after ALND","back":"Intercostobrachial nerve"},
    {"front":"Intercostobrachial nerve root/modality","back":"T2; pure sensory"},
    {"front":"Scapular winging, can't abduct >90","back":"Long thoracic -> serratus anterior"},
    {"front":"Sensory symptom -> pick","back":"A sensory nerve"}],
  "firstAid":[{"topic":"Nerves at risk in breast/axillary surgery","location":"Anatomy > brachial plexus branches"}],
  "memoryHook":"Match modality before fame — sensory deficit = sensory nerve, not the famous motor one."
 },
 {
  "id":"q09","item":9,"qid":"21742","title":"Vaccine hesitancy: open dialogue first",
  "system":"Ethics/Communication","topic":"Vaccine hesitancy","correct":"A","yourAnswer":"B","percentCorrect":56,
  "vignette":"Mother of a healthy 2-month-old is vaccine-hesitant (older son had a 'bad reaction'), expects disagreement. Most appropriate response?",
  "clues":[
    {"text":"vaccine-hesitant, wants to defer","type":"red","note":"Communication/counseling scenario; child is well, no urgency."},
    {"text":"'I know you won't agree with me'","type":"red","note":"Expects confrontation; build trust, don't argue."}],
  "whatMatters":"First step with a hesitant parent = open, nonconfrontational dialogue establishing trust and a shared goal.",
  "strategy":"Pick the empathic option that acknowledges concern + names a shared goal first; defer facts/persuasion.",
  "options":[
    {"letter":"A","text":"'I understand your concern; our shared goal is your children's health'","correct":True},
    {"letter":"B","text":"'Immunizations are safe; we should vaccinate today'","correct":False},
    {"letter":"C","text":"Provide a list of vaccine-safety resources","correct":False},
    {"letter":"D","text":"Defer the discussion to the next visit","correct":False},
    {"letter":"E","text":"'This is hard, BUT disease risk is far greater'","correct":False}],
  "eliminations":[
    {"letter":"B","what":"Pushes action.","why":"Skips trust-building; entrenches a hesitant parent."},
    {"letter":"C","what":"Offers resources.","why":"Good but passive; active dialogue first."},
    {"letter":"D","what":"Defers the relationship.","why":"Avoids the conversation; missed opportunity."},
    {"letter":"E","what":"Empathy + 'but' rebuttal.","why":"The 'but' negates empathy; leads with facts."}],
  "reasoning":["Vaccine-hesitant parent expecting conflict; child well","First step = open nonconfrontational dialogue","Acknowledge concern + name shared goal (child's health)","Only option that does this first -> A"],
  "mechanism":"Approach: open dialogue -> acknowledge concern -> dispel specific misconceptions -> explain risks/benefits. Don't override an informed parent for routine vaccines; keep the relationship open.",
  "keywords":[
    {"front":"Vaccine-hesitant parent: first step","back":"Open nonconfrontational dialogue (trust + shared goal)"},
    {"front":"Answer contains a 'but' rebuttal","back":"Wrong this early — empathy undone"},
    {"front":"Cough weeks after shots","back":"Likely coincidental illness, not vaccine harm"},
    {"front":"Persistent refusal steps","back":"Document, alternate schedule, dismissal (last resort)"}],
  "firstAid":[{"topic":"Vaccine hesitancy / communication","location":"Ethics > patient-centered communication"}],
  "memoryHook":"Trust before facts; no 'but'."
 },
 {
  "id":"q10","item":10,"qid":"1490","title":"Ebstein anomaly -> lithium -> bipolar",
  "system":"Cardio/Pharm","topic":"Teratogens","correct":"B","yourAnswer":"I","percentCorrect":72,
  "vignette":"7-year-old; echo shows apical displacement of tricuspid leaflets, atrialized RV, tricuspid regurgitation (Ebstein anomaly). If due to a drug in pregnancy, the mother most likely had which condition?",
  "clues":[
    {"text":"apical tricuspid displacement + atrialized RV + TR","type":"red","note":"Pathognomonic triad of Ebstein anomaly."}],
  "whatMatters":"Ebstein anomaly's classic teratogen is lithium, used for bipolar disorder. The answer is the maternal diagnosis.",
  "strategy":"Malformation -> teratogen -> disease the drug treats. The answer is the maternal disease, not the drug.",
  "options":[
    {"letter":"A","text":"Alcohol use disorder","correct":False},
    {"letter":"B","text":"Bipolar disorder","correct":True},
    {"letter":"C","text":"Cocaine use disorder","correct":False},
    {"letter":"D","text":"Down syndrome","correct":False},
    {"letter":"E","text":"Epilepsy","correct":False},
    {"letter":"F","text":"Gestational diabetes","correct":False},
    {"letter":"G","text":"Hypothyroidism","correct":False},
    {"letter":"H","text":"Opioid use disorder","correct":False},
    {"letter":"I","text":"Schizophrenia","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Fetal alcohol syndrome.","why":"Facial dysmorphism/VSD, not Ebstein."},
    {"letter":"C","what":"Abruption/IUGR.","why":"Not linked to Ebstein."},
    {"letter":"D","what":"AV septal defect.","why":"Not a drug; chromosomal."},
    {"letter":"E","what":"Valproate/phenytoin NTDs.","why":"Antiepileptics cause structural defects, not Ebstein."},
    {"letter":"F","what":"TGA/VSD, macrosomia.","why":"Maternal condition, not a drug."},
    {"letter":"G","what":"Neurodevelopmental delay.","why":"Not a teratogenic drug."},
    {"letter":"H","what":"Neonatal abstinence.","why":"Withdrawal, not Ebstein."},
    {"letter":"I","what":"Antipsychotics, not lithium.","why":"Lithium treats bipolar, not schizophrenia."}],
  "reasoning":["Echo triad = Ebstein anomaly","Classic teratogen = lithium","Lithium treats bipolar disorder","Mother most likely had bipolar -> B"],
  "mechanism":"Lithium (1st-trimester) is the classic teratogen for Ebstein anomaly (apical tricuspid displacement, atrialized RV, TR; associations: ASD, WPW). Lithium is a mood stabilizer for bipolar disorder.",
  "keywords":[
    {"front":"Apical tricuspid displacement + atrialized RV","back":"Ebstein anomaly"},
    {"front":"Teratogen causing Ebstein","back":"Lithium"},
    {"front":"Lithium's main indication","back":"Bipolar disorder"},
    {"front":"Schizophrenia drug class","back":"Antipsychotics (not lithium)"}],
  "firstAid":[{"topic":"Teratogens / lithium","location":"Pharm > teratogens; Cardio > Ebstein anomaly"}],
  "memoryHook":"Li in the womb -> Ebstein; drug -> disease it treats = bipolar."
 },
 {
  "id":"q11","item":11,"qid":"1337","title":"Porphyria cutanea tarda (UROD)",
  "system":"Biochemistry","topic":"Heme synthesis / porphyrias","correct":"E","yourAnswer":"D","percentCorrect":53,
  "vignette":"22-year-old with chronic photosensitive blistering on the backs of hands/forearms, healing with hyperpigmentation; drinks 2-3 beers daily. Deficient enzyme?",
  "clues":[
    {"text":"photosensitive blistering of sun-exposed skin","type":"red","note":"Signature of porphyria cutanea tarda (PCT)."},
    {"text":"alcohol use","type":"red","note":"Major PCT precipitant (with HCV, iron, estrogen)."}],
  "whatMatters":"Photosensitive blistering + alcohol = PCT = uroporphyrinogen decarboxylase (UROD) deficiency.",
  "strategy":"Porphyrias: skin blistering -> PCT (UROD); neurovisceral attacks (no rash) -> AIP (PBG deaminase).",
  "options":[
    {"letter":"A","text":"d-Aminolevulinate dehydratase","correct":False},
    {"letter":"B","text":"d-Aminolevulinate synthase","correct":False},
    {"letter":"C","text":"Bilirubin glucuronyl transferase","correct":False},
    {"letter":"D","text":"Porphobilinogen deaminase","correct":False},
    {"letter":"E","text":"Uroporphyrinogen decarboxylase","correct":True}],
  "eliminations":[
    {"letter":"A","what":"Lead target; neuro/GI.","why":"Not photosensitive blistering."},
    {"letter":"B","what":"Rate-limiting step.","why":"Upregulated in PCT; deficiency = sideroblastic anemia."},
    {"letter":"C","what":"Bilirubin/jaundice.","why":"Heme breakdown, not synthesis; causes jaundice."},
    {"letter":"D","what":"AIP (neurovisceral).","why":"5 P's, NO skin blistering; tempting trap."}],
  "reasoning":["Photosensitive blistering + hyperpigmentation = PCT","Plus alcohol -> PCT","PCT = UROD deficiency -> E"],
  "mechanism":"UROD deficiency backs up water-soluble uroporphyrinogens that deposit in skin and absorb light -> photosensitive bullae. Urine uroporphyrins elevated (pink-orange under Wood lamp). Tx: sun protection, stop alcohol, phlebotomy, hydroxychloroquine.",
  "keywords":[
    {"front":"Photosensitive blistering + alcohol","back":"Porphyria cutanea tarda (PCT)"},
    {"front":"PCT deficient enzyme","back":"Uroporphyrinogen decarboxylase"},
    {"front":"Painful abdomen + neuro/psych, no rash","back":"Acute intermittent porphyria (PBG deaminase)"},
    {"front":"Lead inhibits","back":"ALA dehydratase + ferrochelatase"}],
  "firstAid":[{"topic":"Porphyrias / heme synthesis","location":"Biochem > heme pathway, porphyria table"}],
  "memoryHook":"PCT: blisters on the back of a drinker's hands = UROD (UV-sensitive)."
 },
 {
  "id":"q12","item":12,"qid":"19075","title":"Benzodiazepine overdose ABG (normal A-a)",
  "system":"Pulmonary","topic":"Acid-base / hypoxemia","correct":"D","yourAnswer":"C","percentCorrect":67,
  "vignette":"20-year-old found obtunded; tox screen positive for benzodiazepines; lungs clear. Which ABG set (PaO2 / PaCO2 / A-a gradient)?",
  "clues":[
    {"text":"obtunded on benzodiazepines","type":"red","note":"CNS respiratory depression -> hypoventilation."},
    {"text":"lungs clear","type":"green","note":"Gas-transfer surface intact -> normal A-a gradient."}],
  "whatMatters":"Hypoventilation -> high PaCO2, low PaO2, NORMAL A-a gradient (lungs are fine).",
  "strategy":"A-a gradient is the discriminator: hypoventilation/altitude = normal A-a; diffusion/V-Q/shunt = increased A-a.",
  "options":[
    {"letter":"A","text":"PaO2 45 / PaCO2 30 / A-a 10","correct":False},
    {"letter":"B","text":"PaO2 45 / PaCO2 30 / A-a 30","correct":False},
    {"letter":"C","text":"PaO2 55 / PaCO2 60 / A-a 25","correct":False},
    {"letter":"D","text":"PaO2 55 / PaCO2 60 / A-a 10","correct":True},
    {"letter":"E","text":"PaO2 65 / PaCO2 70 / A-a 35","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Respiratory alkalosis.","why":"Low CO2; benzo OD raises CO2."},
    {"letter":"B","what":"Low CO2 + widened A-a (PE/pneumonia).","why":"Wrong CO2 direction + lung disease."},
    {"letter":"C","what":"High CO2 + widened A-a (COPD).","why":"Right CO2, but clear lungs -> A-a should be normal. (Trap.)"},
    {"letter":"E","what":"Widened A-a (lung disease).","why":"Increased A-a inconsistent with clear lungs."}],
  "reasoning":["Benzo OD -> CNS depression -> hypoventilation","High PaCO2 + low PaO2 = acute respiratory acidosis","Lungs clear -> A-a normal (~10)","High CO2 + low O2 + normal A-a = D"],
  "mechanism":"Hypoventilation raises PaCO2 and lowers alveolar/arterial O2, but gas transfer is intact so the A-a gradient stays normal. Acute = minimal renal compensation (HCO3 ~24).",
  "keywords":[
    {"front":"Benzo/opioid overdose ABG","back":"High CO2, low O2, NORMAL A-a"},
    {"front":"Hypoxemia with normal A-a","back":"Hypoventilation or high altitude"},
    {"front":"Hypoxemia with increased A-a","back":"Diffusion defect, V/Q mismatch, shunt"},
    {"front":"A-a gradient formula","back":"PAO2 - PaO2 (PAO2 ~ 150 - PaCO2/0.8)"}],
  "firstAid":[{"topic":"Hypoxemia / A-a gradient","location":"Pulmonary > causes of hypoxemia table; acid-base"}],
  "memoryHook":"Clear lungs = clear A-a."
 },
 {
  "id":"q13","item":13,"qid":"994","title":"Glucagon -> Gs -> cAMP -> PKA",
  "system":"Cell biology","topic":"Second messengers","correct":"D","yourAnswer":"A","percentCorrect":59,
  "vignette":"Hypoglycemic diabetic given IM glucagon; it binds a receptor that promotes intracellular GTP binding to a receptor-associated protein, driving glycogenolysis. Mediator?",
  "clues":[
    {"text":"GTP binds a receptor-associated protein","type":"red","note":"= activation of a heterotrimeric G protein (Gs)."},
    {"text":"propofol mention (other Qs)","type":"purple","note":"N/A here — glucagon uses Gs/cAMP."}],
  "whatMatters":"'GTP-binding protein' = Gs-coupled GPCR -> adenylate cyclase -> cAMP -> protein kinase A.",
  "strategy":"ID the second-messenger system first (Gs/Gi->cAMP/PKA; Gq->IP3/DAG/PKC; GC->cGMP/PKG; cytokine->JAK/STAT; RTK->insulin/GF), then name the kinase.",
  "options":[
    {"letter":"A","text":"cGMP-dependent protein kinase","correct":False},
    {"letter":"B","text":"Janus tyrosine kinase (JAK)","correct":False},
    {"letter":"C","text":"Phosphodiesterase","correct":False},
    {"letter":"D","text":"Protein kinase A","correct":True},
    {"letter":"E","text":"Tyrosine-specific protein kinase","correct":False}],
  "eliminations":[
    {"letter":"A","what":"cGMP/NO pathway.","why":"Glucagon uses cAMP, not cGMP."},
    {"letter":"B","what":"Cytokine receptors (GH, EPO).","why":"Not GPCRs."},
    {"letter":"C","what":"Degrades cAMP.","why":"Terminates the signal, doesn't mediate it."},
    {"letter":"E","what":"Insulin/growth-factor RTKs.","why":"Glucagon is a GPCR hormone (ironically insulin's pathway)."}],
  "reasoning":["'GTP binds receptor-associated protein' = G protein (Gs)","Ga-GTP -> adenylate cyclase -> cAMP","cAMP activates PKA","PKA drives glycogenolysis -> D"],
  "mechanism":"Glucagon binds a Gs-GPCR; Ga swaps GDP for GTP, activates adenylate cyclase -> cAMP -> PKA -> glycogenolysis/gluconeogenesis. Same pathway: epinephrine (beta), ACTH, PTH.",
  "keywords":[
    {"front":"Glucagon hepatocyte signaling","back":"Gs -> adenylate cyclase -> cAMP -> PKA"},
    {"front":"cAMP activates which kinase","back":"Protein kinase A"},
    {"front":"GH, prolactin, EPO, IL signaling","back":"JAK/STAT"},
    {"front":"Degrades cAMP","back":"Phosphodiesterase"}],
  "firstAid":[{"topic":"Second messengers","location":"Cell biology > signaling pathways; FLAT ChAMP cAMP hormones"}],
  "memoryHook":"G protein -> cAMP -> PKA."
 },
 {
  "id":"q14","item":14,"qid":"106226","title":"Neonatal abstinence syndrome (heroin)",
  "system":"Pediatrics","topic":"Prenatal drug exposure","correct":"C","yourAnswer":"B","percentCorrect":51,
  "vignette":"2-day-old with irritability, high-pitched cry, poor feeding, vomiting/loose stools, sweating, sneezing, tachypnea; NO dysmorphic features. Prenatal exposure to which drug?",
  "clues":[
    {"text":"neuro + GI + autonomic signs, first days of life","type":"red","note":"Neonatal abstinence syndrome (opioid withdrawal)."},
    {"text":"no dysmorphic features","type":"green","note":"Rules out fetal alcohol syndrome; withdrawal, not malformation."}],
  "whatMatters":"Neuro+GI+autonomic hyperactivity in a non-dysmorphic newborn = NAS = opioid withdrawal (heroin among options).",
  "strategy":"Separate WITHDRAWAL (opioids -> NAS) from intoxication/teratogenesis (cocaine, alcohol, antiepileptics).",
  "options":[
    {"letter":"A","text":"Alcohol","correct":False},
    {"letter":"B","text":"Cocaine","correct":False},
    {"letter":"C","text":"Heroin","correct":True},
    {"letter":"D","text":"Phenytoin","correct":False},
    {"letter":"E","text":"Valproic acid","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Fetal alcohol syndrome.","why":"Defined by dysmorphism (absent here)."},
    {"letter":"B","what":"IUGR/jittery (intoxication).","why":"No full opioid-withdrawal triad."},
    {"letter":"D","what":"Fetal hydantoin (malformations).","why":"Structural defects, not withdrawal."},
    {"letter":"E","what":"Neural tube defects.","why":"Teratogenic structural defects, not withdrawal."}],
  "reasoning":["Neuro + GI + autonomic signs, days 1-3","No dysmorphism -> withdrawal, not malformation","Withdrawal = opioid","Opioid among options = heroin -> C"],
  "mechanism":"NAS = withdrawal from transplacental opioids (heroin/methadone/buprenorphine). Neuro (high-pitched cry, tremor), GI (vomiting/diarrhea), autonomic (sweating, sneezing, tachypnea). Supportive care + morphine/methadone if severe; Finnegan scoring.",
  "keywords":[
    {"front":"High-pitched cry + sweating + diarrhea, day 1-3","back":"Neonatal abstinence syndrome (opioids)"},
    {"front":"Smooth philtrum + thin lip + VSD","back":"Fetal alcohol syndrome"},
    {"front":"Abruption + IUGR + jittery newborn","back":"Prenatal cocaine"},
    {"front":"Neural tube defect","back":"Valproate / carbamazepine"}],
  "firstAid":[{"topic":"Neonatal abstinence syndrome","location":"Peds/Psych > prenatal substance exposure"}],
  "memoryHook":"Withdrawal = opioid; dysmorphism = something else."
 },
 {
  "id":"q15","item":15,"qid":"18867","title":"Refeeding hypophosphatemia (redistribution)",
  "system":"Nutrition/Renal","topic":"Hypophosphatemia / refeeding","correct":"E","yourAnswer":"C","percentCorrect":40,
  "vignette":"Malnourished alcoholic given dextrose IV fluids develops marked muscle weakness; serum phosphate 0.5 (normal 2.5-4.5). Cause of low phosphate?",
  "clues":[
    {"text":"malnourished + dextrose","type":"red","note":"Dextrose -> insulin surge -> phosphate into cells = refeeding syndrome."},
    {"text":"phosphate 0.5","type":"green","note":"Profound hypophosphatemia confirms the shift."}],
  "whatMatters":"Insulin drives phosphate (+K, Mg) into cells; glycolysis consumes phosphate (ATP/2,3-BPG) = redistribution, not loss.",
  "strategy":"Hypophosphatemia buckets: internal redistribution (insulin/refeeding, alkalosis, hungry bone) vs decreased gut absorption vs increased urinary loss.",
  "options":[
    {"letter":"A","text":"Decreased renal proximal reabsorption","correct":False},
    {"letter":"B","text":"Increased colonic excretion","correct":False},
    {"letter":"C","text":"Increased extracellular binding with calcium","correct":False},
    {"letter":"D","text":"Increased uptake by bone cells","correct":False},
    {"letter":"E","text":"Redistribution into hepatic and muscle cells","correct":True}],
  "eliminations":[
    {"letter":"A","what":"Renal wasting (HPT/Fanconi).","why":"No PTH/Fanconi; this is an intracellular shift."},
    {"letter":"B","what":"GI loss (diarrhea/antacids).","why":"No diarrhea/antacids; acute drop after dextrose."},
    {"letter":"C","what":"Ca-phosphate binding.","why":"Lowers calcium and needs HIGH phosphate, opposite here."},
    {"letter":"D","what":"Hungry bone (post-parathyroidectomy).","why":"No parathyroid surgery; shift is into soft tissue."}],
  "reasoning":["Malnourished + dextrose -> insulin surge","Insulin drives phosphate into cells; glycolysis consumes it","Profound hypophosphatemia -> weakness = refeeding syndrome","Mechanism = redistribution -> E"],
  "mechanism":"Carbohydrate refeeding spikes insulin, shifting phosphate/K/Mg intracellularly and accelerating glycolysis (ATP, 2,3-BPG). Result: refeeding syndrome -> weakness, arrhythmia, CHF. Prevent: slow calories + replete electrolytes + thiamine.",
  "keywords":[
    {"front":"Malnourished + dextrose -> weakness, low phosphate","back":"Refeeding syndrome"},
    {"front":"Refeeding mechanism","back":"Insulin shifts PO4/K/Mg into cells"},
    {"front":"Hypophosphatemia after parathyroidectomy","back":"Hungry bone syndrome"},
    {"front":"Why thiamine first in alcoholics","back":"Prevent Wernicke encephalopathy"}],
  "firstAid":[{"topic":"Refeeding syndrome / hypophosphatemia","location":"Nutrition/Renal > electrolyte shifts"}],
  "memoryHook":"Feed a starved patient -> phosphate dives into cells."
 },
 {
  "id":"q16","item":16,"qid":"14939","title":"Chronic pancreatitis: low fecal elastase",
  "system":"GI","topic":"Pancreatic exocrine insufficiency","correct":"B","yourAnswer":"A","percentCorrect":39,
  "vignette":"54-year-old heavy drinker with steatorrhea (bulky foul stools, Sudan+), epigastric pain worse with meals, weight loss; occult blood negative, normal Hgb. Pathophysiologic change?",
  "clues":[
    {"text":"steatorrhea (Sudan+) + epigastric pain + alcohol","type":"red","note":"Chronic pancreatitis with exocrine insufficiency."},
    {"text":"occult blood negative","type":"green","note":"Argues against mucosal/inflammatory disease or cancer."}],
  "whatMatters":"Chronic pancreatitis destroys acinar cells -> low digestive enzymes -> fecal elastase falls (marker of pancreatic function).",
  "strategy":"Classify steatorrhea: pancreatic (low enzymes/elastase) vs biliary (cholestasis) vs mucosal (celiac/villous atrophy).",
  "options":[
    {"letter":"A","text":"Decreased bile acid synthesis","correct":False},
    {"letter":"B","text":"Decreased levels of fecal elastase","correct":True},
    {"letter":"C","text":"Impaired production of intrinsic factor","correct":False},
    {"letter":"D","text":"Increased pancreatic bicarbonate secretion","correct":False},
    {"letter":"E","text":"Small bowel villous atrophy","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Liver/biliary problem.","why":"Causes cholestasis/jaundice, not pancreatic steatorrhea."},
    {"letter":"C","what":"B12/macrocytic anemia.","why":"Causes anemia; Hgb normal here."},
    {"letter":"D","what":"Wrong direction.","why":"Bicarbonate DECREASES in chronic pancreatitis."},
    {"letter":"E","what":"Celiac/mucosal.","why":"No celiac clues; this is pancreatic maldigestion."}],
  "reasoning":["Alcohol + epigastric pain + steatorrhea = chronic pancreatitis","Acinar cell loss -> exocrine insufficiency","Marker = LOW fecal elastase -> B"],
  "mechanism":"Chronic pancreatitis destroys acinar cells -> loss of lipase/elastase etc. -> fat/protein malabsorption (steatorrhea, fat-soluble vitamin deficiency). Fecal elastase-1 resists transit, so stool level tracks pancreatic output (low in insufficiency).",
  "keywords":[
    {"front":"Alcoholic + epigastric pain + greasy stools","back":"Chronic pancreatitis"},
    {"front":"Marker of pancreatic exocrine insufficiency","back":"Low fecal elastase-1"},
    {"front":"Sudan stain positive","back":"Steatorrhea (fecal fat)"},
    {"front":"Late chronic pancreatitis endocrine failure","back":"Diabetes mellitus"}],
  "firstAid":[{"topic":"Chronic pancreatitis","location":"GI > pancreatitis; malabsorption tests"}],
  "memoryHook":"Alcoholic + greasy stools + epigastric pain = pancreas failing -> low fecal elastase."
 },
 {
  "id":"q17","item":17,"qid":"214","title":"Pituitary stalk lesion -> high prolactin",
  "system":"Endocrine","topic":"Hypothalamic-pituitary axis","correct":"C","yourAnswer":"A","percentCorrect":61,
  "vignette":"29-year-old with sarcoidosis, headaches, bitemporal hemianopia; MRI shows a mass involving the hypothalamus and pituitary stalk. Which pituitary hormone is most likely elevated?",
  "clues":[
    {"text":"mass involving the pituitary stalk","type":"red","note":"Stalk carries dopamine that tonically inhibits prolactin."},
    {"text":"bitemporal hemianopia","type":"green","note":"Optic chiasm compression by a sellar/suprasellar mass."}],
  "whatMatters":"Prolactin is the only anterior pituitary hormone under tonic INHIBITION (dopamine); cut the stalk -> prolactin rises (stalk effect). All others fall.",
  "strategy":"Stalk lesion: releasing-hormone-dependent hormones drop; the inhibited one (prolactin) rises. ADH falls -> central DI.",
  "options":[
    {"letter":"A","text":"ACTH","correct":False},
    {"letter":"B","text":"Growth hormone","correct":False},
    {"letter":"C","text":"Prolactin","correct":True},
    {"letter":"D","text":"Thyrotropin (TSH)","correct":False},
    {"letter":"E","text":"Vasopressin (ADH)","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Needs CRH.","why":"Stalk loss -> ACTH falls (central adrenal insufficiency)."},
    {"letter":"B","what":"Needs GHRH.","why":"Falls."},
    {"letter":"D","what":"Needs TRH.","why":"Falls (central hypothyroidism)."},
    {"letter":"E","what":"Made in hypothalamus.","why":"Falls -> central diabetes insipidus."}],
  "reasoning":["Sarcoid mass on hypothalamus + pituitary stalk","Stalk carries dopamine that inhibits prolactin","Stalk interruption -> disinhibition","Prolactin rises (stalk effect) -> C"],
  "mechanism":"The pituitary stalk conveys hypothalamic control. Prolactin is uniquely under tonic dopamine inhibition; a stalk lesion blocks dopamine -> hyperprolactinemia. Differential: TSH-secreting adenoma (up alpha-subunit, MRI).",
  "keywords":[
    {"front":"Pituitary stalk lesion","back":"High prolactin (stalk effect)"},
    {"front":"Only anterior pituitary hormone tonically inhibited","back":"Prolactin (by dopamine)"},
    {"front":"Lowers prolactin drug class","back":"Dopamine agonists (cabergoline, bromocriptine)"},
    {"front":"Hypothalamic ADH lost","back":"Central diabetes insipidus"}],
  "firstAid":[{"topic":"Prolactin / stalk effect","location":"Endocrine > hypothalamic-pituitary axis"}],
  "memoryHook":"Cut the stalk -> only prolactin climbs."
 },
 {
  "id":"q18","item":18,"qid":"14898","title":"Temporal lobe abscess from mastoid",
  "system":"Neuro/ID","topic":"Brain abscess spread","correct":"C","yourAnswer":"C","percentCorrect":42,
  "vignette":"3-year-old with otitis media (ear-pulling), now seizure; CT shows a single ring-enhancing lesion in the left temporal lobe. The pathogen entered the brain via which structure?",
  "clues":[
    {"text":"ear-pulling/otitis media","type":"red","note":"Otitis media is the source; spreads to mastoid then temporal lobe."},
    {"text":"single ring-enhancing temporal-lobe lesion","type":"green","note":"Single abscess = contiguous spread; location names the source."}],
  "whatMatters":"Single (contiguous) abscess -> match the lobe to its neighbor: temporal lobe <- otitis/mastoid air cells.",
  "strategy":"Single abscess = local spread (use location); multiple = hematogenous from heart/lungs.",
  "options":[
    {"letter":"A","text":"Ethmoid air cells","correct":False},
    {"letter":"B","text":"Frontal sinus","correct":False},
    {"letter":"C","text":"Mastoid air cells","correct":True},
    {"letter":"D","text":"Maxillary sinus","correct":False},
    {"letter":"E","text":"Nose and upper lips","correct":False},
    {"letter":"F","text":"Peritonsillar space","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Frontal-lobe/orbital spread.","why":"Wrong lobe; clue is otitis, not sinusitis."},
    {"letter":"B","what":"Frontal-lobe spread.","why":"Wrong lobe and source."},
    {"letter":"D","what":"Orbit, not brain-adjacent.","why":"Doesn't seed temporal lobe."},
    {"letter":"E","what":"Cavernous sinus thrombosis.","why":"Facial danger triangle; no facial-infection clue."},
    {"letter":"F","what":"Deep neck/mediastinum.","why":"No throat clue; doesn't track to temporal lobe."}],
  "reasoning":["Otitis media + single ring-enhancing temporal abscess","Single = contiguous spread; location = source","Otitis -> adjacent mastoid air cells","Mastoid invades temporal lobe -> C"],
  "mechanism":"Otitis media extends into adjacent mastoid air cells (mastoiditis), then invades the neighboring temporal lobe -> abscess (ring-enhancing). Organisms: viridans strep, S. aureus, anaerobes.",
  "keywords":[
    {"front":"Otitis -> temporal-lobe abscess via","back":"Mastoid air cells"},
    {"front":"Single vs multiple abscesses","back":"Single = local; multiple = hematogenous"},
    {"front":"Frontal lobe abscess source","back":"Frontal/ethmoid sinusitis"},
    {"front":"Facial danger triangle infection","back":"Cavernous sinus thrombosis"}],
  "firstAid":[{"topic":"Brain abscess","location":"Neuro/ID > brain abscess spread routes"}],
  "memoryHook":"Ear -> mastoid -> temporal lobe."
 },
 {
  "id":"q19","item":19,"qid":"14907","title":"Acute diverticulitis (LLQ)",
  "system":"GI","topic":"Diverticulitis","correct":"A","yourAnswer":"B","percentCorrect":63,
  "vignette":"73-year-old with 10 days of LLQ pain, fever, leukocytosis (WBC 15k), palpable LLQ mass; aunt had colon cancer. Most likely cause of pain?",
  "clues":[
    {"text":"LLQ tenderness + palpable mass","type":"red","note":"Sigmoid diverticulitis with inflammatory phlegmon/abscess."},
    {"text":"fever + leukocytosis","type":"red","note":"Acute infectious/inflammatory process, not indolent tumor."},
    {"text":"aunt with colon cancer","type":"purple","note":"Weak family history; bait toward cancer."}],
  "whatMatters":"Elderly + LLQ pain + fever + leukocytosis + mass = acute diverticulitis ('left-sided appendicitis').",
  "strategy":"Acute + febrile = infection (diverticulitis); chronic + weight loss/anemia = cancer. Confirm with CT, not acute colonoscopy.",
  "options":[
    {"letter":"A","text":"Acute diverticulitis","correct":True},
    {"letter":"B","text":"Colon cancer","correct":False},
    {"letter":"C","text":"Incarcerated direct inguinal hernia","correct":False},
    {"letter":"D","text":"Ischemic colitis","correct":False},
    {"letter":"E","text":"Tubo-ovarian abscess","correct":False},
    {"letter":"F","text":"Ulcerative colitis","correct":False}],
  "eliminations":[
    {"letter":"B","what":"Too acute/inflammatory.","why":"Cancer is chronic (weight loss, anemia); one aunt is weak FH."},
    {"letter":"C","what":"Groin obstruction.","why":"Mass is LLQ, no groin bulge."},
    {"letter":"D","what":"Bloody diarrhea, watershed.","why":"Hematochezia/acute onset; no inflammatory mass."},
    {"letter":"E","what":"PID in young women.","why":"73-year-old; localizes to sigmoid."},
    {"letter":"F","what":"Chronic bloody diarrhea, young.","why":"Not a new focal mass in elderly."}],
  "reasoning":["Elderly + LLQ pain + palpable mass","Fever + leukocytosis = acute inflammation","LLQ + mass in older adult = acute diverticulitis -> A"],
  "mechanism":"Diverticula obstruct -> microperforation and inflammation (sigmoid). LLQ pain, fever, leukocytosis, +/- mass. CT diagnosis; complications: abscess, colovesical fistula (pneumaturia), obstruction, perforation.",
  "keywords":[
    {"front":"Elderly + LLQ pain + fever + mass","back":"Acute diverticulitis"},
    {"front":"Diverticulitis diagnostic test","back":"CT abdomen (oral + IV contrast)"},
    {"front":"Avoid acutely in diverticulitis","back":"Colonoscopy (perforation risk)"},
    {"front":"Colovesical fistula sign","back":"Pneumaturia"}],
  "firstAid":[{"topic":"Diverticulitis","location":"GI > diverticular disease"}],
  "memoryHook":"Left-sided appendicitis — acute + febrile = infection, not cancer."
 },
 {
  "id":"q20","item":20,"qid":"19750","title":"Resistance to thyroid hormone",
  "system":"Endocrine","topic":"Thyroid function tests","correct":"E","yourAnswer":"C","percentCorrect":42,
  "vignette":"7-year-old with ADHD-like behavior, goiter; TSH 7, total T4 16 (high), T3 210 (high). Etiology?",
  "clues":[
    {"text":"high T4/T3 with non-suppressed (high) TSH","type":"red","note":"'Inappropriate TSH' -> resistance or TSH-secreting adenoma."},
    {"text":"ADHD-like + goiter","type":"blue","note":"Classic for resistance to thyroid hormone in a child."}],
  "whatMatters":"High thyroid hormones that fail to suppress TSH = thyroid hormone resistance (defective THRB receptor).",
  "strategy":"Read the TSH-T4 relationship: high T4 + suppressed TSH = Graves; high T4 + non-suppressed TSH = resistance/TSHoma.",
  "options":[
    {"letter":"A","text":"Chronic autoimmune thyroiditis","correct":False},
    {"letter":"B","text":"Elevated thyroxine-binding globulin","correct":False},
    {"letter":"C","text":"Graves disease","correct":False},
    {"letter":"D","text":"Organification defect","correct":False},
    {"letter":"E","text":"Resistance to thyroid hormone","correct":True}],
  "eliminations":[
    {"letter":"A","what":"Hashimoto -> hypothyroid (low T4).","why":"Wrong direction; T4 is high."},
    {"letter":"B","what":"High total T4 only, normal TSH.","why":"Doesn't raise TSH or cause goiter."},
    {"letter":"C","what":"Would SUPPRESS TSH.","why":"TSH is 7 (not suppressed). Trap."},
    {"letter":"D","what":"Causes hypothyroidism (low T4).","why":"T4 is high here."}],
  "reasoning":["High T4/T3 + non-suppressed TSH = 'inappropriate TSH'","Pituitary insensitive -> keeps making TSH -> goiter (THRB defect)","ADHD-like child + goiter + this pattern = resistance -> E"],
  "mechanism":"Mutation in thyroid hormone receptor beta (THRB) makes tissues (incl. pituitary) insensitive, so TSH stays high and drives more T4/T3 + goiter. Often near-euthyroid with ADHD-like behavior. Differential: TSHoma.",
  "keywords":[
    {"front":"High T4/T3 + non-suppressed TSH","back":"Resistance to thyroid hormone (or TSHoma)"},
    {"front":"RTH gene","back":"Thyroid hormone receptor beta (THRB)"},
    {"front":"High T4/T3 + SUPPRESSED TSH","back":"Graves disease"},
    {"front":"High total T4, normal free T4 & TSH","back":"Elevated TBG (estrogen/pregnancy)"}],
  "firstAid":[{"topic":"Thyroid function tests","location":"Endocrine > TFT interpretation; inappropriate TSH"}],
  "memoryHook":"High hormones + TSH that won't quit = resistance."
 },
 {
  "id":"q21","item":21,"qid":"8342","title":"Malignant otitis externa (Pseudomonas)",
  "system":"Micro/ID","topic":"Pseudomonas aeruginosa","correct":"C","yourAnswer":"C","percentCorrect":42,
  "vignette":"Elderly diabetic with severe otitis externa, granulation tissue in the canal, Gram-negative rod on culture. Best microbiological description of the organism?",
  "clues":[
    {"text":"diabetic + granulation tissue otitis externa","type":"red","note":"Malignant (necrotizing) otitis externa = Pseudomonas aeruginosa."},
    {"text":"Gram-negative rod","type":"red","note":"Confirms Pseudomonas in this setting."}],
  "whatMatters":"Pseudomonas = aerobic, motile, oxidase-positive, NON-lactose-fermenting GNR (pyocyanin, grape odor).",
  "strategy":"Name the bug from the script, then recall its lab fingerprint; when an answer has two clauses, BOTH must fit.",
  "options":[
    {"letter":"A","text":"Comma-shaped, grows in high pH","correct":False},
    {"letter":"B","text":"Fast lactose fermenter","correct":False},
    {"letter":"C","text":"Motile and oxidase positive","correct":True},
    {"letter":"D","text":"Nonmotile, lactose nonfermenter","correct":False},
    {"letter":"E","text":"Requires factors V and X","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Vibrio.","why":"Wrong organism/scenario (cholera/seawater)."},
    {"letter":"B","what":"E. coli/Klebsiella.","why":"Pseudomonas is NON-lactose fermenting."},
    {"letter":"D","what":"Right on lactose, wrong on motility.","why":"Pseudomonas IS motile. Top trap."},
    {"letter":"E","what":"Haemophilus influenzae.","why":"Causes otitis media/epiglottitis, not this."}],
  "reasoning":["Diabetic + necrotizing otitis externa + GNR = Pseudomonas","Pseudomonas: aerobic, motile, oxidase+, non-lactose fermenter","Motile and oxidase positive -> C"],
  "mechanism":"Pseudomonas aeruginosa: aerobic, motile, oxidase+, non-lactose-fermenting GNR; pyocyanin (blue-green), grape odor, exotoxin A (inactivates EF-2). Untreated MOE can erode into skull-base osteomyelitis + cranial nerve palsies.",
  "keywords":[
    {"front":"Diabetic + necrotizing otitis externa","back":"Pseudomonas aeruginosa"},
    {"front":"Pseudomonas lab fingerprint","back":"Aerobic, motile, oxidase+, non-lactose fermenter"},
    {"front":"Blue-green pigment","back":"Pyocyanin"},
    {"front":"Pseudomonas exotoxin A","back":"Inactivates EF-2"}],
  "firstAid":[{"topic":"Pseudomonas aeruginosa","location":"Micro > gram-negative rods; malignant otitis externa"}],
  "memoryHook":"AERuginosa = AERobic, oxidase-positive, blue-green and fruity."
 },
 {
  "id":"q22","item":22,"qid":"2023","title":"SVC = common cardinal veins (chest CT)",
  "system":"Embryology/Anatomy","topic":"Venous development","correct":"A","yourAnswer":None,"percentCorrect":None,
  "vignette":"Septic patient gets a central line into a structure embryonically derived from the common cardinal veins. On axial chest CT, which labeled structure (A=SVC)?",
  "clues":[
    {"text":"central line into a structure from the common cardinal veins","type":"red","note":"Central lines terminate in the SVC; SVC derives from the common cardinal veins."}],
  "whatMatters":"Central line tip = SVC; SVC = adult derivative of the (right) common cardinal vein. Pure CT-ID task.",
  "strategy":"On axial CT, patient's right = image left. SVC sits anterior + to the patient's right of the ascending aorta.",
  "options":[
    {"letter":"A","text":"Superior vena cava","correct":True},
    {"letter":"B","text":"Ascending aorta","correct":False},
    {"letter":"C","text":"Pulmonary trunk","correct":False},
    {"letter":"D","text":"Esophagus","correct":False},
    {"letter":"E","text":"Descending aorta","correct":False}],
  "eliminations":[
    {"letter":"B","what":"From truncus arteriosus.","why":"Arterial; not a cardinal-vein derivative."},
    {"letter":"C","what":"From truncus arteriosus.","why":"Arterial; not a central-line endpoint."},
    {"letter":"D","what":"Foregut.","why":"GI tube, not vascular."},
    {"letter":"E","what":"From dorsal aorta.","why":"Posterior arterial vessel."}],
  "reasoning":["Central line tip terminates in the SVC","SVC = right common + right anterior cardinal veins","On CT, SVC is anterior + patient's right of ascending aorta","That is label A -> A"],
  "mechanism":"Central venous catheters advance until the tip is in the SVC. The SVC forms from the right common cardinal and right anterior cardinal veins (cardinal system also -> brachiocephalic, azygos).",
  "keywords":[
    {"front":"Central venous catheter tip location","back":"Superior vena cava"},
    {"front":"SVC embryologic origin","back":"Right common + right anterior cardinal veins"},
    {"front":"Aorta & pulmonary trunk origin","back":"Truncus arteriosus"},
    {"front":"Patient's right on axial CT","back":"Left side of the image"}],
  "firstAid":[{"topic":"Venous development","location":"Embryology > cardinal/vitelline/umbilical veins; great-vessel CT"}],
  "memoryHook":"Central line ends in the SVC; the SVC comes from the cardinal veins."
 },
 {
  "id":"q23","item":23,"qid":"18666","title":"Pseudocholinesterase deficiency (succinylcholine)",
  "system":"Pharmacology/Genetics","topic":"Neuromuscular blockers","correct":"C","yourAnswer":"B","percentCorrect":48,
  "vignette":"Patient given succinylcholine (and propofol) before surgery has prolonged paralysis for hours postoperatively. Underlying cause?",
  "clues":[
    {"text":"prolonged paralysis after succinylcholine","type":"red","note":"Failure to metabolize succinylcholine."}],
  "whatMatters":"Succinylcholine is cleared by plasma pseudocholinesterase; hereditary deficiency (BCHE polymorphism) -> hours of paralysis.",
  "strategy":"Match the drug to its inactivation route. Succinylcholine/mivacurium -> plasma pseudocholinesterase (not liver/kidney/redistribution).",
  "options":[
    {"letter":"A","text":"Decreased renal clearance","correct":False},
    {"letter":"B","text":"Drug redistribution to other tissues","correct":False},
    {"letter":"C","text":"Genetic polymorphism","correct":True},
    {"letter":"D","text":"Impaired hepatic function","correct":False},
    {"letter":"E","text":"Neuromuscular junction autoantibodies","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Renal elimination.","why":"Wrong route; not renally cleared."},
    {"letter":"B","what":"That's propofol's offset.","why":"Propofol is a hypnotic, doesn't paralyze."},
    {"letter":"D","what":"Liver synthesizes the enzyme.","why":"No liver disease; wouldn't last hours."},
    {"letter":"E","what":"Myasthenia gravis.","why":"Myasthenics are RESISTANT to succinylcholine."}],
  "reasoning":["Prolonged paralysis after succinylcholine","Normally cleared by plasma pseudocholinesterase (<10 min)","Hereditary deficiency (BCHE) -> drug lingers at NMJ","Underlying cause = genetic polymorphism -> C"],
  "mechanism":"Pseudocholinesterase (butyrylcholinesterase, BCHE; autosomal recessive) normally degrades ~90% of succinylcholine. Deficiency -> more reaches the NMJ -> prolonged paralysis (hours). Check dibucaine number. Supportive: sedate + ventilate.",
  "keywords":[
    {"front":"Prolonged paralysis (hours) after succinylcholine","back":"Pseudocholinesterase deficiency"},
    {"front":"Gene & inheritance","back":"BCHE, autosomal recessive"},
    {"front":"Propofol offset mechanism","back":"Redistribution (brain -> tissues)"},
    {"front":"Anti-AChR antibodies","back":"Myasthenia gravis (resistant to sux)"}],
  "firstAid":[{"topic":"Succinylcholine / pseudocholinesterase","location":"Pharm > neuromuscular blockers"}],
  "memoryHook":"Succinylcholine won't quit = pseudocholinesterase can't split."
 },
 {
  "id":"q24","item":24,"qid":"578","title":"Ovarian cancer prevention: OCPs",
  "system":"Repro/Oncology","topic":"Epithelial ovarian cancer","correct":"E","yourAnswer":"B","percentCorrect":56,
  "vignette":"55-year-old with ovarian mass, ascites, elevated CA-125 (epithelial ovarian cancer). She had abnormal Paps + cervical conization. Which would most likely have reduced the risk of THIS condition?",
  "clues":[
    {"text":"ovarian mass + ascites + CA-125","type":"green","note":"Epithelial ovarian cancer (EOC)."},
    {"text":"abnormal Paps + conization, no HPV vaccine","type":"purple","note":"Cervical decoy steering toward HPV vaccine."}],
  "whatMatters":"EOC is driven by repeated ovulation. Protective = anything that suppresses ovulation (combined OCPs).",
  "strategy":"Confirm which cancer first (ovarian), then choose its protective factor (ovulation suppression). Ignore cervical bait.",
  "options":[
    {"letter":"A","text":"Consistent condom use","correct":False},
    {"letter":"B","text":"Human papillomavirus vaccination","correct":False},
    {"letter":"C","text":"Long-term antioxidant supplementation","correct":False},
    {"letter":"D","text":"Nulliparity","correct":False},
    {"letter":"E","text":"Use of combined oral contraceptive pills","correct":True}],
  "eliminations":[
    {"letter":"A","what":"Prevents STIs/cervical.","why":"Ovarian cancer isn't infection-driven."},
    {"letter":"B","what":"Cervical, not ovarian.","why":"HPV-unrelated tumor; the Pap history is bait."},
    {"letter":"C","what":"No proven benefit.","why":"Not a recognized protective factor."},
    {"letter":"D","what":"A RISK factor.","why":"More lifetime ovulations -> increases EOC risk."}],
  "reasoning":["Ovarian mass + ascites + CA-125 = EOC","EOC driven by repeated ovulation injuring surface epithelium","Reduce risk by reducing ovulations","Combined OCPs suppress ovulation -> E"],
  "mechanism":"EOC arises from repeated injury-repair of ovarian surface epithelium with each ovulation. Combined OCPs suppress ovulation (also lower endometrial cancer). Other protective: multiparity, breastfeeding, salpingo-oophorectomy/tubal ligation.",
  "keywords":[
    {"front":"Ovarian mass + ascites + CA-125","back":"Epithelial ovarian cancer"},
    {"front":"OCPs effect on ovarian/endometrial cancer","back":"Protective (suppress ovulation)"},
    {"front":"HPV vaccine prevents","back":"Cervical/anal/oropharyngeal cancer (not ovarian)"},
    {"front":"Nulliparity","back":"RISK factor (more ovulations)"}],
  "firstAid":[{"topic":"Epithelial ovarian cancer","location":"Repro/Onc > ovarian cancer risk/protective factors, CA-125"}],
  "memoryHook":"Fewer ovulations, fewer ovarian cancers."
 },
 {
  "id":"q25","item":25,"qid":"860","title":"Acute gout: first-line is NSAID",
  "system":"Rheumatology/Pharm","topic":"Gout treatment","correct":"A","yourAnswer":"E","percentCorrect":65,
  "vignette":"Obese diabetic with sudden nocturnal first-MTP pain; synovial fluid shows needle-shaped, negatively birefringent crystals; normal creatinine. Best initial treatment?",
  "clues":[
    {"text":"needle-shaped, negatively birefringent crystals","type":"green","note":"Monosodium urate = acute gout."},
    {"text":"normal creatinine","type":"blue","note":"NSAIDs not contraindicated."}],
  "whatMatters":"Acute gout flare = anti-inflammatory (NSAID first-line). Urate-lowering drugs are for chronic prevention and can worsen a flare.",
  "strategy":"Acute = put out the fire (NSAID/colchicine/steroids); chronic = lower urate (allopurinol/febuxostat/probenecid).",
  "options":[
    {"letter":"A","text":"Cyclooxygenase inhibitor","correct":True},
    {"letter":"B","text":"Lipoxygenase inhibitor","correct":False},
    {"letter":"C","text":"TNF-alpha inhibitor","correct":False},
    {"letter":"D","text":"Uricosuric agent","correct":False},
    {"letter":"E","text":"Xanthine oxidase inhibitor","correct":False}],
  "eliminations":[
    {"letter":"B","what":"Asthma/leukotrienes.","why":"Not a gout therapy."},
    {"letter":"C","what":"RA/autoimmune.","why":"Not used for acute gout."},
    {"letter":"D","what":"Chronic urate-lowering (probenecid).","why":"Preventive; can worsen acute flare."},
    {"letter":"E","what":"Chronic (allopurinol).","why":"Doesn't treat acute attack; can prolong it. Trap."}],
  "reasoning":["Needle-shaped negatively birefringent crystals + first-MTP = acute gout","Acute flare = anti-inflammatory","First-line = NSAID (COX inhibitor); normal creatinine makes it safe -> A"],
  "mechanism":"Urate crystals -> neutrophil-driven inflammation. First-line acute Tx: NSAIDs (inhibit COX); alternatives colchicine, glucocorticoids. Don't start urate-lowering therapy during a flare.",
  "keywords":[
    {"front":"Acute gout first-line treatment","back":"NSAID (COX inhibitor)"},
    {"front":"NSAID alternatives in acute gout","back":"Colchicine, glucocorticoids"},
    {"front":"Needle-shaped, negatively birefringent","back":"Monosodium urate (gout)"},
    {"front":"Rhomboid, positively birefringent","back":"CPPD (pseudogout)"}],
  "firstAid":[{"topic":"Gout","location":"Rheum/Pharm > acute vs chronic gout therapy; crystal ID"}],
  "memoryHook":"Put out the FIRE first, lower the URATE later."
 },
 {
  "id":"q26","item":26,"qid":"14892","title":"Eosinophilic esophagitis (biopsy)",
  "system":"GI/Immunology","topic":"Eosinophilic esophagitis","correct":"A","yourAnswer":"A","percentCorrect":65,
  "vignette":"Atopic 10-year-old (eczema) with solid-food impaction; endoscopy shows stacked ring-like indentations, longitudinal furrows, whitish papules. Biopsy finding?",
  "clues":[
    {"text":"atopy + solid-food impaction","type":"red","note":"Eosinophilic esophagitis (EoE)."},
    {"text":"stacked rings + furrows + white plaques","type":"green","note":"Classic EoE endoscopy (trachealization)."}],
  "whatMatters":"EoE -> biopsy shows eosinophilic infiltration of the mucosa (>=15 eos/hpf).",
  "strategy":"Identify the disease from endoscopy + atopy, then recall its histology. Match each option to its disease.",
  "options":[
    {"letter":"A","text":"Eosinophilic infiltration of esophageal mucosa","correct":True},
    {"letter":"B","text":"Ganglionic degeneration of myenteric plexus","correct":False},
    {"letter":"C","text":"Intestinal metaplasia of esophageal epithelium","correct":False},
    {"letter":"D","text":"Replacement of esophagus with fibrous tissue","correct":False},
    {"letter":"E","text":"Squamous cells with eosinophilic intranuclear inclusions","correct":False}],
  "eliminations":[
    {"letter":"B","what":"Achalasia.","why":"Bird-beak, solids+liquids; no rings/furrows."},
    {"letter":"C","what":"Barrett esophagus (GERD).","why":"Adult chronic reflux, goblet cells."},
    {"letter":"D","what":"Scleroderma esophagus.","why":"Systemic sclerosis fibrosis, not pediatric EoE."},
    {"letter":"E","what":"HSV esophagitis (Cowdry A).","why":"Word trap: 'inclusions' (viral) vs 'infiltration' (EoE)."}],
  "reasoning":["Atopic kid + solid-food impaction + stacked rings/furrows/plaques = EoE","EoE is Th2/IL-5/IL-13, food-antigen driven","Biopsy = eosinophilic infiltration (>=15 eos/hpf) -> A"],
  "mechanism":"EoE: Th2 cells release IL-5/IL-13 -> eosinophils infiltrate the esophageal mucosa (>=15/hpf, white plaques). Chronic inflammation -> rings + furrows -> solid-food dysphagia/impaction. Tx: PPI, swallowed steroids, elimination diet.",
  "keywords":[
    {"front":"Atopic kid + food impaction + stacked rings","back":"Eosinophilic esophagitis"},
    {"front":"EoE biopsy","back":"Eosinophilic infiltration (>=15 eos/hpf)"},
    {"front":"Bird-beak + loss of ganglion cells","back":"Achalasia"},
    {"front":"Punched-out ulcers + Cowdry A inclusions","back":"HSV esophagitis"}],
  "firstAid":[{"topic":"Eosinophilic esophagitis","location":"GI > esophageal disorders"}],
  "memoryHook":"Atopic kid + food stuck + stacked rings = eosinophils in the wall (infiltration, not inclusions)."
 },
 {
  "id":"q27","item":27,"qid":"62","title":"Pyogenic liver abscess (S. aureus, hematogenous)",
  "system":"GI/ID","topic":"Liver abscess","correct":"D","yourAnswer":None,"percentCorrect":39,
  "vignette":"57-year-old in Wisconsin, no travel, with fever/RUQ pain and a hypodense liver cavity on CT (pyogenic abscess). Which organism/route combination?",
  "clues":[
    {"text":"no international travel","type":"green","note":"Argues against amebic abscess -> pyogenic (bacterial)."},
    {"text":"hypodense liver cavity","type":"green","note":"Hepatic abscess on contrast CT."}],
  "whatMatters":"Pick the organism+route combination that's actually valid. S. aureus seeds the liver hematogenously (bacteremia/endocarditis).",
  "strategy":"'Organism + route' = BOTH halves must be true. Match the microbe to how it reaches the liver.",
  "options":[
    {"letter":"A","text":"Chlamydia trachomatis - ascending cholangitis","correct":False},
    {"letter":"B","text":"Cytomegalovirus - direct invasion","correct":False},
    {"letter":"C","text":"Entamoeba histolytica - penetrating stab wound","correct":False},
    {"letter":"D","text":"Staphylococcus aureus - hematogenous route","correct":True},
    {"letter":"E","text":"Streptococcus pneumoniae - portal vein","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Perihepatitis, not abscess.","why":"Wrong organism + ascending cholangitis = enteric GNRs."},
    {"letter":"B","what":"Viral, immunocompromised.","why":"Not a pyogenic abscess by direct invasion."},
    {"letter":"C","what":"Right bug, WRONG route.","why":"Amebic spreads via portal vein after intestinal infection; no travel."},
    {"letter":"E","what":"Not a gut/portal organism.","why":"Portal-vein abscess comes from enteric flora."}],
  "reasoning":["Fever + RUQ pain + hypodense liver cavity, no travel = pyogenic abscess","Match organism to a valid route","S. aureus seeds the liver hematogenously","Only valid pairing -> D"],
  "mechanism":"Pyogenic liver abscess routes: biliary (cholangitis), portal vein (appendicitis/diverticulitis), hematogenous via hepatic artery (bacteremia/endocarditis -> S. aureus), direct extension, trauma. Enteric GNRs (E. coli, Klebsiella) most common overall. Tx: drainage + antibiotics.",
  "keywords":[
    {"front":"Liver abscess, no travel","back":"Pyogenic (bacterial), not amebic"},
    {"front":"S. aureus liver abscess route","back":"Hematogenous (bacteremia/endocarditis)"},
    {"front":"'Anchovy paste' right-lobe abscess + travel","back":"Entamoeba histolytica (portal route)"},
    {"front":"PID + violin-string adhesions on liver","back":"Fitz-Hugh-Curtis (perihepatitis)"}],
  "firstAid":[{"topic":"Liver abscess","location":"GI/ID > pyogenic vs amebic; spread routes"}],
  "memoryHook":"Match the bug to its road to the liver — a right bug on the wrong road still fails."
 },
 {
  "id":"q28","item":28,"qid":"19379","title":"Cystic fibrosis = obstructive PFTs",
  "system":"Pulmonary","topic":"PFT interpretation","correct":"D","yourAnswer":"B","percentCorrect":57,
  "vignette":"25-year-old with cystic fibrosis and recurrent pulmonary exacerbations. PFTs (TLC / FEV1:FVC / FVC / RV)?",
  "clues":[
    {"text":"cystic fibrosis","type":"red","note":"CFTR defect -> bronchiectasis -> obstructive lung disease."}],
  "whatMatters":"CF is obstructive: low FEV1/FVC, air trapping (high RV, high TLC), low FVC.",
  "strategy":"Classify by FEV1/FVC ratio: down = obstructive (then check air trapping); normal/up = restrictive (small lungs).",
  "options":[
    {"letter":"A","text":"TLC up / ratio up / FVC normal / RV up","correct":False},
    {"letter":"B","text":"TLC down / ratio up / FVC down / RV down","correct":False},
    {"letter":"C","text":"TLC up / ratio down / FVC down / RV down","correct":False},
    {"letter":"D","text":"TLC up / ratio down / FVC down / RV up","correct":True},
    {"letter":"E","text":"TLC up / ratio normal / FVC up / RV normal","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Ratio not low.","why":"Not obstructive."},
    {"letter":"B","what":"Restrictive pattern.","why":"Everything small; opposite of CF. Trap."},
    {"letter":"C","what":"Low RV.","why":"Contradicts air trapping in obstruction."},
    {"letter":"E","what":"Normal ratio.","why":"Not obstructive."}],
  "reasoning":["CF -> bronchiectasis = obstructive lung disease","Obstruction -> low FEV1/FVC","Air trapping -> high RV and TLC; FVC falls","TLC up, ratio down, FVC down, RV up -> D"],
  "mechanism":"CF obstruction limits expiratory flow (low FEV1/FVC); trapped air raises RV and TLC (hyperinflation) and reduces FVC. Restrictive disease is the opposite (low TLC/RV, preserved ratio).",
  "keywords":[
    {"front":"Cystic fibrosis PFT pattern","back":"Obstructive: TLC up, FEV1/FVC down, FVC down, RV up"},
    {"front":"Hallmark of obstruction","back":"Low FEV1/FVC ratio"},
    {"front":"Air trapping","back":"High RV and TLC"},
    {"front":"Restrictive pattern","back":"Low TLC, low RV, normal/high ratio"}],
  "firstAid":[{"topic":"PFTs","location":"Pulmonary > obstructive vs restrictive; DLCO"}],
  "memoryHook":"Can't get air out -> it gets trapped (RV and TLC go up)."
 },
 {
  "id":"q29","item":29,"qid":"18866","title":"Urge incontinence: beta-3 agonist",
  "system":"Renal/Pharm","topic":"Urinary incontinence","correct":"E","yourAnswer":"F","percentCorrect":40,
  "vignette":"80-year-old with urgency -> immediate leakage, nocturia, mild cognitive impairment; no leak with cough/Valsalva, normal postvoid residual. Which pharmacodynamic effect helps?",
  "clues":[
    {"text":"urgency -> immediate leakage, normal PVR","type":"red","note":"Urge incontinence (overactive bladder)."},
    {"text":"cognitive impairment","type":"blue","note":"Avoid antimuscarinics (worsen cognition) -> prefer beta-3 agonist."},
    {"text":"no leak with cough/Valsalva","type":"green","note":"Rules out stress incontinence."}],
  "whatMatters":"Urge incontinence = relax the detrusor. Options: antimuscarinic or beta-3 agonist. With cognitive impairment, prefer beta-3 stimulation (mirabegron).",
  "strategy":"Bladder wiring: M3 contracts detrusor, beta-3 relaxes detrusor, alpha-1 contracts internal sphincter. Watch the verb (stimulation vs antagonism).",
  "options":[
    {"letter":"A","text":"Antagonism of alpha-1 adrenergic receptors","correct":False},
    {"letter":"B","text":"Antagonism of beta-1 adrenergic receptors","correct":False},
    {"letter":"C","text":"Antagonism of beta-3 adrenergic receptors","correct":False},
    {"letter":"D","text":"Stimulation of beta-1 adrenergic receptors","correct":False},
    {"letter":"E","text":"Stimulation of beta-3 adrenergic receptors","correct":True},
    {"letter":"F","text":"Stimulation of muscarinic cholinergic receptors","correct":False}],
  "eliminations":[
    {"letter":"A","what":"Relaxes sphincter (BPH).","why":"Would worsen leakage."},
    {"letter":"B","what":"Cardiac.","why":"No bladder role."},
    {"letter":"C","what":"Backwards.","why":"Blocking beta-3 promotes contraction."},
    {"letter":"D","what":"Cardiac inotrope.","why":"No bladder effect."},
    {"letter":"F","what":"Contracts detrusor (bethanechol).","why":"Opposite of what you want; worsens urge. Trap."}],
  "reasoning":["Urgency -> immediate leak, normal PVR, no Valsalva leak = urge incontinence","Goal = relax the detrusor","Options: antimuscarinic OR beta-3 agonist; cognitive impairment -> avoid antimuscarinics","Best effect = beta-3 stimulation (mirabegron) -> E"],
  "mechanism":"Urge incontinence = involuntary detrusor contractions. Beta-3 agonists (mirabegron) relax detrusor; antimuscarinics block M3 contraction but worsen cognition in the elderly. M3 contracts (void), beta-3 relaxes (store), alpha-1 contracts sphincter (store).",
  "keywords":[
    {"front":"Urgency -> immediate leak, normal PVR","back":"Urge incontinence (overactive bladder)"},
    {"front":"Beta-3 agonist for urge incontinence","back":"Mirabegron (relaxes detrusor)"},
    {"front":"Avoid in elderly/cognitive impairment","back":"Antimuscarinics (oxybutynin) -> confusion"},
    {"front":"Leak with cough/Valsalva","back":"Stress incontinence"}],
  "firstAid":[{"topic":"Urinary incontinence","location":"Renal/Pharm > incontinence types; bladder autonomic pharmacology"}],
  "memoryHook":"Beta-3 Brakes the Bladder."
 },
]

def write_files():
    deck = []
    for q in QUESTIONS:
        # normalize a stray field if present
        for e in q.get("eliminations", []):
            e.pop("text", None)
        slug = re.sub(r"[^a-z0-9]+", "-", q["title"].lower()).strip("-")
        fname = f"{q['id']}_{slug}.json"
        with open(os.path.join(OUT, fname), "w") as f:
            json.dump(q, f, indent=2, ensure_ascii=False)
        deck.append({
            "id": q["id"], "item": q["item"], "qid": q["qid"], "title": q["title"],
            "system": q["system"], "topic": q["topic"], "correct": q["correct"],
            "yourAnswer": q.get("yourAnswer"), "percentCorrect": q.get("percentCorrect"),
            "missed": (q.get("yourAnswer") is not None and q.get("yourAnswer") != q["correct"]),
            "file": fname,
        })
    deck.sort(key=lambda d: d["item"])
    with open(os.path.join(OUT, "deck.json"), "w") as f:
        json.dump({"count": len(deck), "questions": deck}, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(deck)} question files + deck.json to {OUT}")

if __name__ == "__main__":
    write_files()
