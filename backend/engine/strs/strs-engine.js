/**
 * STRS Engine - Deterministic Service Treatment Records Extraction
 * 
 * This module extracts structured medical evidence from Service Treatment Records (STRs)
 * using deterministic, rule-based parsing. No AI-style reasoning, no assumptions, no inferences.
 * 
 * Analysis modes:
 * - Service-connected opportunities: Direct nexus, secondary, aggravation, presumptive
 * - Chronicity detection: Repeating conditions across encounters/time
 * - Continuity detection: Symptoms spanning multiple years
 * - Provider/facility extraction: Medical providers mentioned in records
 * - Medication extraction: Medications prescribed
 * - Procedure extraction: Medical procedures performed
 * - Duty limitation/profile: Work restrictions documented
 * - LOD event extraction: Line of duty events
 * 
 * ACCURACY IMPROVEMENTS v2.0:
 * - Negation detection: Filters out "denies PTSD", "no back pain", "resolved condition"
 * - Laterality tracking: Left/right/bilateral for anatomical conditions
 * - Severity extraction: Pain scale, qualitative descriptors, functional impact
 * - Confidence scoring: 7-factor algorithm for evidence quality (0-100 scale)
 * - Medical abbreviation normalization: DM = Diabetes = T2DM
 * - Deduplication: Eliminates redundant condition entries (expected 25% reduction)
 * - Cross-reference validation: Medications linked to conditions they treat
 */

// Import accuracy enhancement modules
import { 
  analyzeNegation, 
  extractLaterality, 
  extractSeverity, 
  calculateConfidence 
} from './strs-validation.js';

import {
  normalizeCondition,
  deduplicateConditions,
  crossReferenceMedications
} from './strs-normalization.js';

const STRS_PATTERNS = {
  // ═══════════════════════════════════════════════════════════════
  // MEDICAL DIAGNOSES - Disease states, chronic conditions
  // ═══════════════════════════════════════════════════════════════
  diagnoses: [
    // Mental Health Diagnoses - 38 CFR 3.309(b)
    { label: "PTSD", pattern: "posttraumatic stress disorder|PTSD|post-traumatic stress disorder|complex PTSD", category: "mental_health" },
    { label: "Major Depressive Disorder", pattern: "major depressive disorder|major depression|clinical depression|MDD|depressive disorder", category: "mental_health" },
    { label: "Generalized Anxiety Disorder", pattern: "generalized anxiety disorder|GAD|anxiety disorder|chronic anxiety", category: "mental_health" },
    { label: "Panic Disorder", pattern: "panic disorder|panic attack|recurrent panic", category: "mental_health" },
    { label: "Sleep Disorder", pattern: "sleep disorder|chronic insomnia|sleep disturbance|parasomnia", category: "mental_health" },
    { label: "Bipolar Disorder", pattern: "bipolar disorder|bipolar|manic depression", category: "mental_health" },
    
    // Cardiovascular Diagnoses
    { label: "Hypertension", pattern: "essential hypertension|hypertension|high blood pressure|HTN|elevated BP", category: "cardiovascular" },
    { label: "Coronary Artery Disease", pattern: "coronary artery disease|CAD|ischemic heart disease|CHD|atherosclerotic heart disease", category: "cardiovascular" },
    { label: "Congestive Heart Failure", pattern: "congestive heart failure|CHF|heart failure|cardiac failure", category: "cardiovascular" },
    { label: "Arrhythmia", pattern: "arrhythmia|atrial fibrillation|tachycardia|bradycardia|irregular heartbeat", category: "cardiovascular" },
    
    // Endocrine/Metabolic Diagnoses
    { label: "Diabetes Mellitus Type 2", pattern: "type 2 diabetes|diabetes mellitus type 2|DM2|T2DM|non-insulin dependent diabetes|NIDDM", category: "endocrine" },
    { label: "Diabetes Mellitus Type 1", pattern: "type 1 diabetes|diabetes mellitus type 1|DM1|T1DM|insulin dependent diabetes|IDDM", category: "endocrine" },
    { label: "Hypothyroidism", pattern: "hypothyroidism|underactive thyroid|Hashimoto", category: "endocrine" },
    { label: "Hyperthyroidism", pattern: "hyperthyroidism|overactive thyroid|Graves disease", category: "endocrine" },
    
    // Respiratory Diagnoses
    { label: "Asthma", pattern: "asthma|reactive airway disease|asthmatic|bronchial asthma", category: "respiratory" },
    { label: "COPD", pattern: "COPD|chronic obstructive pulmonary disease|emphysema|chronic bronchitis", category: "respiratory" },
    { label: "Sleep Apnea", pattern: "obstructive sleep apnea|OSA|sleep apnea|sleep-disordered breathing", category: "respiratory" },
    
    // Gastrointestinal Diagnoses
    { label: "GERD", pattern: "gastroesophageal reflux disease|GERD|acid reflux|reflux disease|esophageal reflux", category: "gastrointestinal" },
    { label: "IBS", pattern: "irritable bowel syndrome|IBS|spastic colon|functional bowel disorder", category: "gastrointestinal" },
    { label: "Crohn's Disease", pattern: "Crohn's disease|Crohn disease|inflammatory bowel disease|IBD", category: "gastrointestinal" },
    { label: "Ulcerative Colitis", pattern: "ulcerative colitis|UC(?:\\s+colitis)?", category: "gastrointestinal" },
    { label: "Peptic Ulcer Disease", pattern: "peptic ulcer|gastric ulcer|duodenal ulcer|stomach ulcer", category: "gastrointestinal" },
    
    // Musculoskeletal Diagnoses (degenerative/chronic AND pain symptoms)
    { label: "Back Pain", pattern: "back pain|lumbar pain|lumbago|lower back pain|upper back pain|thoracic pain", category: "musculoskeletal" },
    { label: "Neck Pain", pattern: "neck pain|cervical pain|cervicalgia|posterior neck pain|cervicogenic headache", category: "musculoskeletal" },
    { label: "Knee Pain", pattern: "knee pain|patellofemoral|knee joint pain|patellar pain", category: "musculoskeletal" },
    { label: "Shoulder Pain", pattern: "shoulder pain|rotator cuff syndrome|shoulder joint pain|subacromial pain", category: "musculoskeletal" },
    { label: "Hip Pain", pattern: "hip pain|hip joint pain|gluteal pain|trochanteric pain", category: "musculoskeletal" },
    { label: "Osteoarthritis", pattern: "osteoarthritis|degenerative joint disease|DJD|OA|arthrosis", category: "musculoskeletal" },
    { label: "Rheumatoid Arthritis", pattern: "rheumatoid arthritis|RA|inflammatory arthritis", category: "musculoskeletal" },
    { label: "Degenerative Disc Disease", pattern: "degenerative disc disease|degenerative disk disease|DDD|spinal degeneration|disc degeneration", category: "musculoskeletal" },
    { label: "Fibromyalgia", pattern: "fibromyalgia|chronic pain syndrome|widespread pain", category: "musculoskeletal" },
    { label: "Chronic Pain Syndrome", pattern: "chronic pain|chronic pain syndrome|persistent pain|long-standing pain", category: "musculoskeletal" },
    
    // Neurological Diagnoses
    { label: "Migraine", pattern: "migraine|chronic migraine|hemicranial pain|recurrent headache", category: "neurological" },
    { label: "Peripheral Neuropathy", pattern: "peripheral neuropathy|neuropathy|diabetic neuropathy|nerve damage", category: "neurological" },
    { label: "Epilepsy", pattern: "epilepsy|seizure disorder|recurrent seizures", category: "neurological" },
    // Keep acronym matching strict to avoid rank/title false positives like "COL, MS".
    { label: "Multiple Sclerosis", pattern: "multiple sclerosis|demyelinating disease|diagnos(?:is|ed)\\s+(?:with\\s+)?MS|history of\\s+MS|MS\\s+(?:relapse|lesions?)", category: "neurological" },
    
    // Auditory Diagnoses
    { label: "Sensorineural Hearing Loss", pattern: "sensorineural hearing loss|SNHL|nerve deafness|hearing loss|hearing impairment", category: "auditory" },
    { label: "Tinnitus", pattern: "tinnitus|ringing in ears|ear ringing|acoustic trauma", category: "auditory" },
    
    // Systemic/Autoimmune Diagnoses
    { label: "Lupus", pattern: "systemic lupus erythematosus|SLE|lupus", category: "autoimmune" },
    { label: "Psoriasis", pattern: "psoriasis|psoriatic", category: "autoimmune" },
    
    // Other Chronic Conditions
    { label: "Chronic Fatigue Syndrome", pattern: "chronic fatigue syndrome|CFS|myalgic encephalomyelitis|ME/CFS", category: "other" }
  ],

  // ═══════════════════════════════════════════════════════════════
  // INJURIES - Physical trauma, acute injuries
  // ═══════════════════════════════════════════════════════════════
  injuries: [
    // Head/Brain Injuries
      { label: "Traumatic Brain Injury", pattern: "traumatic brain injury|TBI|brain injury|closed head injury|CHI|mild TBI|mTBI", category: "head" },
    { label: "Skull Fracture", pattern: "skull fracture|cranial fracture|fractured skull", category: "head" },
    { label: "Concussion", pattern: "concussion|minor head injury|head trauma", category: "head" },
    
    // Spinal Injuries
    { label: "Spinal Cord Injury", pattern: "spinal cord injury|SCI|spine injury|cord damage", category: "spine" },
    { label: "Cervical Spine Injury", pattern: "cervical spine injury|neck injury|C-spine injury|cervical fracture", category: "spine" },
    { label: "Lumbar Spine Injury", pattern: "lumbar spine injury|lower back injury|L-spine injury|lumbar fracture", category: "spine" },
    { label: "Herniated Disc", pattern: "herniated disc|herniated disk|slipped disc|ruptured disc|disc herniation", category: "spine" },
    { label: "Whiplash", pattern: "whiplash|cervical strain|neck sprain", category: "spine" },
    
    // Upper Extremity Injuries
    { label: "Shoulder Injury", pattern: "shoulder injury|rotator cuff tear|shoulder dislocation|labral tear|shoulder separation", category: "upper_extremity" },
    { label: "Shoulder Dislocation", pattern: "shoulder dislocation|dislocated shoulder|glenohumeral dislocation", category: "upper_extremity" },
    { label: "Rotator Cuff Tear", pattern: "rotator cuff tear|RC tear|supraspinatus tear", category: "upper_extremity" },
    { label: "Elbow Injury", pattern: "elbow injury|elbow fracture|radial head fracture|olecranon fracture", category: "upper_extremity" },
    { label: "Wrist Fracture", pattern: "wrist fracture|distal radius fracture|Colles fracture|scaphoid fracture", category: "upper_extremity" },
    { label: "Hand Injury", pattern: "hand injury|hand fracture|metacarpal fracture|finger fracture", category: "upper_extremity" },
    
    // Lower Extremity Injuries
    { label: "Hip Fracture", pattern: "hip fracture|femoral neck fracture|acetabular fracture", category: "lower_extremity" },
    { label: "Femur Fracture", pattern: "femur fracture|femoral fracture|thigh fracture", category: "lower_extremity" },
    { label: "Knee Injury", pattern: "knee injury|meniscus tear|ACL tear|PCL tear|MCL tear|LCL tear|patellar fracture", category: "lower_extremity" },
    { label: "ACL Tear", pattern: "ACL tear|anterior cruciate ligament tear|torn ACL", category: "lower_extremity" },
    { label: "Meniscus Tear", pattern: "meniscus tear|torn meniscus|meniscal tear", category: "lower_extremity" },
    { label: "Ankle Fracture", pattern: "ankle fracture|fractured ankle|malleolar fracture", category: "lower_extremity" },
    { label: "Ankle Sprain", pattern: "ankle sprain|sprained ankle|lateral ankle sprain", category: "lower_extremity" },
    { label: "Foot Fracture", pattern: "foot fracture|metatarsal fracture|calcaneus fracture|Jones fracture", category: "lower_extremity" },
    { label: "Achilles Tendon Rupture", pattern: "Achilles rupture|Achilles tear|ruptured Achilles tendon", category: "lower_extremity" },
    
    // Trunk Injuries
    { label: "Rib Fracture", pattern: "rib fracture|fractured rib|broken rib", category: "trunk" },
    { label: "Pelvic Fracture", pattern: "pelvic fracture|pelvis fracture|fractured pelvis", category: "trunk" },
    
    // Soft Tissue Injuries
    { label: "Muscle Strain", pattern: "muscle strain|pulled muscle|muscle tear|strained muscle", category: "soft_tissue" },
    { label: "Ligament Sprain", pattern: "ligament sprain|sprained ligament|ligament tear", category: "soft_tissue" },
    { label: "Tendon Injury", pattern: "tendon injury|tendon rupture|tendinopathy|tendon tear", category: "soft_tissue" },
    
    // Burns/Wounds
    { label: "Burn Injury", pattern: "burn injury|thermal burn|chemical burn|blast burn|burn wound", category: "burn" },
    { label: "Laceration", pattern: "laceration|cut|gash|deep wound", category: "wound" },
    { label: "Gunshot Wound", pattern: "gunshot wound|GSW|bullet wound|firearm injury", category: "wound" },
    { label: "Shrapnel Wound", pattern: "shrapnel wound|fragment wound|blast injury|IED injury", category: "wound" },
    { label: "Amputation", pattern: "amputation|traumatic amputation|amputee|loss of limb", category: "wound" }
  ],

  // ═══════════════════════════════════════════════════════════════
  // EVENTS - Line of Duty events, incidents, accidents
  // ═══════════════════════════════════════════════════════════════
  events: [
    // Combat Events
    { label: "Combat Action", pattern: "combat action|combat operations|combat engagement|hostile fire|enemy contact", category: "combat" },
    { label: "IED Blast", pattern: "IED|improvised explosive device|roadside bomb|blast exposure|explosion", category: "combat" },
    { label: "RPG Attack", pattern: "RPG|rocket propelled grenade|rocket attack", category: "combat" },
    { label: "Mortar Attack", pattern: "mortar attack|indirect fire|incoming fire|mortar round", category: "combat" },
    { label: "Small Arms Fire", pattern: "small arms fire|gunfire|rifle fire|machine gun fire", category: "combat" },
    { label: "Ambush", pattern: "ambush|ambushed|hostile engagement", category: "combat" },
    
    // Vehicle Accidents
    { label: "Motor Vehicle Accident", pattern: "motor vehicle accident|MVA|car accident|vehicle collision|traffic accident", category: "vehicle" },
    { label: "HMMWV Accident", pattern: "HMMWV accident|humvee accident|military vehicle accident", category: "vehicle" },
    { label: "Helicopter Crash", pattern: "helicopter crash|helo crash|aircraft crash|aviation accident", category: "vehicle" },
    { label: "Rollover Accident", pattern: "rollover|vehicle rollover|overturned vehicle", category: "vehicle" },
    
    // Training Accidents
    { label: "Training Accident", pattern: "training accident|training injury|during training|field training accident|FTX injury", category: "training" },
    { label: "Airborne Injury", pattern: "airborne injury|parachute injury|jump injury|PLF injury", category: "training" },
    { label: "Live Fire Exercise", pattern: "live fire|live fire exercise|range accident", category: "training" },
    { label: "Physical Training Injury", pattern: "PT injury|physical training|ruck march|road march injury", category: "training" },
    
    // Falls
    { label: "Fall from Height", pattern: "fall from height|fell from|fall from ladder|fall from roof|fall from platform", category: "fall" },
    { label: "Slip and Fall", pattern: "slip and fall|slipped and fell|tripped and fell", category: "fall" },
    
    // Lifting/Mechanical
    { label: "Lifting Injury", pattern: "lifting injury|injured while lifting|heavy lifting|improper lift", category: "mechanical" },
    { label: "Repetitive Motion Injury", pattern: "repetitive motion|overuse injury|repetitive strain", category: "mechanical" },
    
    // Exposure Events
    { label: "Burn Pit Exposure", pattern: "burn pit exposure|burn pit|airborne hazard|toxic smoke exposure", category: "exposure" },
    { label: "Chemical Exposure", pattern: "chemical exposure|toxic exposure|hazardous material|HAZMAT", category: "exposure" },
    { label: "Radiation Exposure", pattern: "radiation exposure|radioactive|nuclear exposure", category: "exposure" },
    { label: "Blast Exposure", pattern: "blast exposure|overpressure|concussive blast|repeated blast exposure", category: "exposure" },
    
    // Line of Duty Events
    { label: "LOD Event", pattern: "line of duty|LOD|in the line of duty|duty-related|performance of duty", category: "lod" },
    { label: "Service Connected Event", pattern: "service connected|in-service|during service|service-related", category: "lod" },
    
    // Sports/Recreation
    { label: "Sports Injury", pattern: "sports injury|injured during|basketball injury|football injury|PT injury", category: "sports" },
    
    // Assault
    { label: "Assault", pattern: "assault|assaulted|physical altercation|fight|attacked", category: "assault" }
  ],

  // Service connection nexus keywords
  nexus: [
    "due to",
    "secondary to",
    "related to",
    "service connected",
    "as a result of",
    "caused by",
    "in-service",
    "during service"
  ],

  // Presumptive conditions - 38 CFR 3.309, specific deployments
  presumptive: [
    { label: "Gulf War Illness", pattern: "gulf war|Operation Desert Storm|ODS" },
    { label: "Agent Orange related", pattern: "agent orange|dioxin|Vietnam|herbicide exposure" },
    { label: "Burn Pit exposure", pattern: "burn pit|burn-pit|airborne hazard|KBR" },
    { label: "Camp Lejeune", pattern: "Camp Lejeune|contaminated water|TCE" },
    { label: "Radiation exposure", pattern: "radiation|atomic|radioactive|nuclear test" },
    { label: "Project 112/SHAD", pattern: "Project 112|SHAD|chemical testing" }
  ],

  // Chronicity indicators
  chronicity: [
    "chronic",
    "persistent",
    "ongoing",
    "recurrent",
    "longstanding",
    "years",
    "recurring",
    "intermittent",
    "continuous"
  ],

  // Medication names
  medications: [
    { label: "SSRIs", pattern: "sertraline|fluoxetine|paroxetine|citalopram|SSRI" },
    { label: "Antidepressants", pattern: "amitriptyline|nortriptyline|venlafaxine|bupropion" },
    { label: "Anxiolytics", pattern: "lorazepam|alprazolam|clonazepam|phenibut" },
    { label: "Pain medication", pattern: "tramadol|ibuprofen|naproxen|gabapentin|pregabalin" },
    { label: "Opioids", pattern: "morphine|codeine|oxycodone|hydrocodone" },
    { label: "Antihistamines", pattern: "diphenhydramine|hydroxyzine" },
    { label: "Antihypertensives", pattern: "lisinopril|metoprolol|amlodipine" },
    { label: "Diabetes", pattern: "metformin|glipizide|insulin" }
  ],

  // Procedures
  procedures: [
    { label: "Surgery", pattern: "surgery|surgical|operation|operative" },
    { label: "Imaging", pattern: "x-ray|MRI|CT scan|ultrasound|radiograph" },
    { label: "Lab work", pattern: "blood work|laboratory|labs|CBC|metabolic panel" },
    { label: "Physical therapy", pattern: "physical therapy|PT|therapy session" },
    { label: "Mental health", pattern: "counseling|therapy|psychiatric|psychology" }
  ],

  // Duty limitations
  dutyLimitations: [
    "profile",
    "duty limitation",
    "restricted duty",
    "light duty",
    "limited duty",
    "cannot lift",
    "cannot stand",
    "cannot march",
    "cannot deploy"
  ],

  // LOD event keywords
  lodEvent: [
    "line of duty",
    "in performance of duty",
    "duty related",
    "combat",
    "training accident",
    "accident",
    "injury"
  ]
};

/**
 * Extract text from PDF using native JavaScript/Node operations
 * Does not depend on external tools like pdftotext
 * 
 * @param {Buffer} pdfBuffer - Raw PDF buffer
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPdf(pdfBuffer) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfData = new Uint8Array(pdfBuffer);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    
    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ');
      // Always inject deterministic page markers for reliable occurrence paging.
      extractedText += `Page ${pageNum}\n${pageText}\n\n`;
    }
    
    return extractedText;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

const EVIDENCE_CUES = {
  diagnosis: [
    /\bdiagnos(?:is|ed|es)\b/i,
    /\bassessment\b/i,
    /\bimpression\b/i,
    /\bproblem\s+list\b/i,
    /\bactive\s+problem\b/i,
    /\bconfirmed\b/i,
    /\btreated\s+for\b/i,
    /\bdx\b/i
  ],
  injury: [
    /\binjury\b/i,
    /\btrauma\b/i,
    /\bfracture\b/i,
    /\btear\b/i,
    /\bsprain\b/i,
    /\bstrain\b/i,
    /\bwound\b/i,
    /\blaceration\b/i,
    /\bcontusion\b/i,
    /\bstatus\s+post\b/i
  ]
};

/**
 * ACCURACY IMPROVEMENT MODULE: General Questionnaire Detection
 * Detects post-deployment health assessment and screening questionnaires
 * Rejects extractions from non-diagnostic contexts
 */
const QUESTIONNAIRE_INDICATORS = [
  /\b(?:Did|does)\s+deployer\s+(?:mark|have|report|indicate)/i,
  /\bdeployer\s+question(?:s|naire)?\s+\d+/i,
  /\bdeployer\s+response(?:\s+or\s+concern)?:/i,
  /\breported\s+on\s+deployer\s+question/i,
  /\bwound,\s*injury,\s*or\s*assault\s+that\s+occurred\s+during\s+(?:their\s+)?deployment\?/i,
  /\bDeployment\s+injury\s+and\s+concussion\s+risk\s+assessment/i,
  /\bPost[-\s]?deployment\s+health\s+assessment/i,
  /\bPDHA\b/i,
  /\bDeployer\s+(?:Concerns|Indicated\s+Concern)/i,
  /\bList\s+of\s+symptoms\s+reported\s+as\s+['"]Bothered/i,
  /\bhealth\s+concerns\.\s*List\s+of\s+symptoms/i
];

/**
 * Check if context appears to be from a questionnaire/screening form
 * @param {string} context - Context text to check
 * @returns {boolean} true if questionnaire indicators found
 */
function isQuestionnaireContext(context) {
  return QUESTIONNAIRE_INDICATORS.some((regex) => regex.test(context));
}

/**
 * Condition-specific rules for evidence validation
 * TBI requires diagnosis keywords AND not screening/questionnaire context
 */
const CONDITION_SPECIFIC_EVIDENCE_CUES = {
  'Traumatic Brain Injury': {
    requiredAny: [
      /\btraumatic\s+brain\s+injury\b/i,
      /\bclosed\s+head\s+injury\b/i,
      /\bhead\s+trauma\b/i,
      /\bconcuss(?:ion|ive)\b/i,
      /\bloss\s+of\s+consciousness\b/i,
      /\bLOC\b/i,
      /\bpost[-\s]?concussive\b/i,
      /\bpost[-\s]?traumatic\s+amnesia\b/i,
      /\bblast\s+(?:injury|exposure|event)\b/i,
      /\bdiagnos(?:is|ed)\b/i,
      /\bassessment:\s*(?:TBI|traumatic\s+brain\s+injury|concussion)\b/i,
      /\bimpression:\s*(?:TBI|traumatic\s+brain\s+injury|concussion)\b/i
    ],
    rejectIfAny: [
      /\b(?:history|number)\s+of\s+(?:m?TBI|concussion|head\s+injur(?:y|ies)).{0,40}\?/i,
      /\b(?:m?TBI|concussion)\s+(?:screen|screening|checklist|questionnaire)\b/i,
      /\bpost\s+deployment\s+health\s+assessment\b/i,
      /\bPDHA\b/i
    ]
  },
  'Concussion': {
    requiredAny: [
      /\bhead\s+trauma\b/i,
      /\bloss\s+of\s+consciousness\b/i,
      /\bLOC\b/i,
      /\bdiagnos(?:is|ed)\s+(?:with\s+)?concussion\b/i,
      /\binjury:\s*concussion\b/i,
      /\bassessment:\s*concussion\b/i,
      /\bimpression:\s*concussion\b/i,
      /\bdiagnosis:\s*concussion\b/i,
      /\bconcussion\s+(?:sustained|documented|confirmed)\b/i,
      /\bpost[-\s]?concussive\s+syndrome\b/i
    ],
    rejectIfAny: [
      /\b(?:history|number)\s+of\s+concussion.{0,40}\?/i,
      /\bconcussion\s+(?:screen|screening|checklist|questionnaire)\b/i,
      /\bconcussion\s+risk\s+assessment\b/i,
      /\bpossible\s+concussion\b/i,
      /\bpost\s+deployment\s+health\s+assessment\b/i
    ]
  }
};

/**
 * Check if a condition has required evidence phrases in context
 * @param {string} context - Context around the match
 * @param {string} label - Condition label
 * @returns {boolean} true if evidence cues are present
 */
function hasConditionSpecificEvidence(context, label) {
  const rule = CONDITION_SPECIFIC_EVIDENCE_CUES[label];
  if (!rule) {
    return true;
  }

  // If context contains reject phrases, fail fast
  if (rule.rejectIfAny?.some((regex) => regex.test(context))) {
    return false;
  }

  // If no required phrases, pass by default
  if (!rule.requiredAny || rule.requiredAny.length === 0) {
    return true;
  }

  // Check if at least one required phrase is present
  return rule.requiredAny.some((regex) => regex.test(context));
}

function hasConfirmationEvidence(context, extractionType, label) {
  // FILTER QUESTIONNAIRES: Reject any extraction from screening/questionnaire context
  if (isQuestionnaireContext(context)) {
    return false;
  }

  if (extractionType === 'event') {
    return true;
  }

  // Check condition-specific evidence first
  if (!hasConditionSpecificEvidence(context, label)) {
    return false;
  }

  // Check general extraction type evidence
  const cues = EVIDENCE_CUES[extractionType];
  if (!cues || cues.length === 0) {
    return true;
  }

  return cues.some((regex) => regex.test(context));
}

/**
 * Normalize extracted text - deterministic whitespace handling
 * @param {string} text - Raw extracted text
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/\r\n/g, '\n')           // Windows newlines to Unix
    .replace(/\r/g, '\n')             // Old Mac newlines to Unix
    .replace(/\t/g, ' ')              // Tabs to spaces
    .replace(/  +/g, ' ')             // Multiple spaces to single space
    .replace(/\n\s+/g, '\n')          // Trim line beginnings
    .replace(/\n{3,}/g, '\n\n')       // Multiple newlines to double
    .trim();
}

/**
 * Generic extraction function for pattern-based matching with accuracy enhancements
 * Used by diagnoses, injuries, and events extractors
 * 
 * @param {string} text - Normalized STR text
 * @param {Array} patterns - Array of pattern objects to match
 * @param {string} extractionType - Type of extraction (diagnosis, injury, event)
 * @returns {Array} Array of found items with ALL occurrences tracked
 */
function extractByPatterns(text, patterns, extractionType) {
  const itemMap = new Map();
  
  // Split text into pages (look for "Page X" markers)
  const pageMarkers = extractPageMarkers(text);
  
  // Extract all dates from the document
  const dates = extractDates(text);
  
  for (const { label, pattern, category } of patterns) {
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
    let match;
    const occurrences = [];
    
    while ((match = regex.exec(text)) !== null) {
      // ENHANCED: Larger context window (200 chars before/after) to catch more negations
      const contextStart = Math.max(0, match.index - 200);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 200);
      const context = text.substring(contextStart, contextEnd);
      
      // ACCURACY IMPROVEMENT: Negation detection (filters "denies PTSD", "no back pain", "0 occurrences", "screening for colitis")
      const matchPositionInContext = match.index - contextStart;
      const negation = analyzeNegation(context, matchPositionInContext);
      
      // Skip ALL negated conditions - if it's negated, it doesn't exist
      // This includes: "0 occurrences", "denies", "no evidence of", "resolved", "screening for", "rule out", etc.
      if (negation.isNegated) {
        continue; // Condition documented as absent or being screened - don't add to results
      }

      // Precision gate: only keep confirmed diagnoses or explicitly noted/documented injuries.
      if (!hasConfirmationEvidence(context, extractionType, label)) {
        continue;
      }
      
      // ACCURACY IMPROVEMENT: Extract laterality (left/right/bilateral)
      const laterality = extractLaterality(context);
      
      // ACCURACY IMPROVEMENT: Extract severity (pain scale, qualitative, functional)
      const severity = extractSeverity(context);
      
      // Find nearest page number
      const pageNumber = findNearestPage(match.index, pageMarkers);
      
      // Find dates in context
      const contextDates = findDatesInContext(context, dates);
      
      occurrences.push({
        matchedText: match[0],
        context: context.trim(),
        startIndex: match.index,
        page: pageNumber,
        dates: contextDates,
        position: occurrences.length + 1,
        // NEW: Accuracy metadata
        negation,
        laterality,
        severity
      });
    }
    
    if (occurrences.length > 0) {
      // ACCURACY IMPROVEMENT: Calculate confidence score
      const firstOcc = occurrences[0];
      const confidence = calculateConfidence(
        firstOcc,
        occurrences.length,
        {
          severity: firstOcc.severity,
          laterality: firstOcc.laterality,
          dates: firstOcc.dates,
          page: firstOcc.page
        }
      );
      
      // ACCURACY IMPROVEMENT: Normalize medical terminology
      const normalized = normalizeCondition(label);
      
      itemMap.set(label, {
        label,
        pattern,
        category,
        extractionType,
        totalOccurrences: occurrences.length,
        firstOccurrence: occurrences[0],
        followUps: occurrences.length - 1,
        occurrences,
        // NEW: Accuracy enhancements
        confidence,
        normalized,
        displayName: normalized.canonical,
        icd10: normalized.icd10
      });
    }
  }
  
  // ACCURACY IMPROVEMENT: Deduplicate items (expected 25% reduction)
  const rawItems = Array.from(itemMap.values());
  const deduplicationResult = deduplicateConditions(rawItems);
  
  return deduplicationResult.conditions;
}

/**
 * Extract medical diagnoses (disease states, chronic conditions)
 * @param {string} text - Normalized STR text
 * @returns {Array} Array of found diagnoses
 */
export function extractDiagnoses(text) {
  return extractByPatterns(text, STRS_PATTERNS.diagnoses, 'diagnosis');
}

/**
 * Extract injuries (physical trauma, acute injuries)
 * @param {string} text - Normalized STR text
 * @returns {Array} Array of found injuries
 */
export function extractInjuries(text) {
  return extractByPatterns(text, STRS_PATTERNS.injuries, 'injury');
}

/**
 * Extract events (LOD events, incidents, accidents)
 * @param {string} text - Normalized STR text
 * @returns {Array} Array of found events
 */
export function extractEvents(text) {
  return extractByPatterns(text, STRS_PATTERNS.events, 'event');
}

/**
 * DEPRECATED: Legacy function for backward compatibility
 * Use extractDiagnoses() instead
 * @param {string} text - Normalized STR text
 * @returns {Array} Array of found conditions
 */
export function extractConditions(text) {
  return extractDiagnoses(text);
}

/**
 * Extract page markers from text
 * @param {string} text - Full text
 * @returns {Array} Array of {pageNumber, index} objects
 */
function extractPageMarkers(text) {
  const markers = [];
  const pageRegex = /\b(?:Page|Pg\.?|p\.)\s*(\d+)\b/gi;
  let match;
  
  while ((match = pageRegex.exec(text)) !== null) {
    markers.push({
      pageNumber: parseInt(match[1]),
      index: match.index
    });
  }
  
  return markers;
}

/**
 * Extract all dates from text
 * @param {string} text - Full text
 * @returns {Array} Array of {date, index} objects
 */
function extractDates(text) {
  const dates = [];
  const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
  let match;
  
  while ((match = dateRegex.exec(text)) !== null) {
    dates.push({
      date: match[0],
      index: match.index
    });
  }
  
  return dates;
}

/**
 * Find nearest page number to a given index
 * @param {number} index - Character index in text
 * @param {Array} pageMarkers - Array of page markers
 * @returns {number|null} Page number or null
 */
function findNearestPage(index, pageMarkers) {
  if (pageMarkers.length === 0) return null;
  
  let nearestPage = pageMarkers[0].pageNumber;
  
  for (const marker of pageMarkers) {
    if (marker.index <= index) {
      nearestPage = marker.pageNumber;
    } else {
      break;
    }
  }
  
  return nearestPage;
}

/**
 * Find dates within context
 * @param {string} context - Context string
 * @param {Array} allDates - All dates from document
 * @returns {Array} Dates found in context
 */
function findDatesInContext(context, allDates) {
  const contextDates = [];
  
  for (const dateObj of allDates) {
    if (context.includes(dateObj.date)) {
      contextDates.push(dateObj.date);
    }
  }
  
  return contextDates;
}

/**
 * Detect chronicity - does condition appear multiple times?
 * Deterministic: 2+ mentions = chronic
 * 
 * @param {string} text - Text to analyze
 * @param {Array} conditions - Extracted conditions
 * @returns {Object} Chronicity data with flags
 */
export function detectChronicity(text, conditions) {
  const chronicityMap = {};
  
  for (const condition of conditions) {
    const regex = new RegExp(condition.pattern, 'gi');
    const matches = text.match(regex) || [];
    
    chronicityMap[condition.label] = {
      mentionCount: matches.length,
      isChronicity: matches.length >= 2,
      confidence: matches.length >= 3 ? 'high' : matches.length === 2 ? 'medium' : 'low'
    };
  }
  
  // Also check for explicit chronicity terms
  const chronicTermRegex = new RegExp(STRS_PATTERNS.chronicity.join('|'), 'gi');
  const chronicMatches = text.match(chronicTermRegex) || [];
  
  return {
    conditions: chronicityMap,
    explicitChronicTerms: chronicMatches,
    totalChronicityScore: chronicMatches.length,
    hasChronicIndicators: chronicMatches.length > 0
  };
}

/**
 * Detect continuity - symptoms spanning multiple years/dates
 * Deterministic: multiple dated encounters = continuity
 * 
 * @param {string} text - Text to analyze
 * @returns {Object} Continuity data
 */
export function detectContinuity(text) {
  // Look for date patterns (MM/DD/YYYY or YYYY-MM-DD)
  const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/g;
  const dates = text.match(dateRegex) || [];
  
  // Extract years
  const years = new Set();
  for (const date of dates) {
    const parts = date.split(/[/-]/);
    const year = parseInt(parts[parts.length - 1]);
    if (!isNaN(year) && year > 1900 && year < 2100) {
      years.add(year);
    }
  }
  
  return {
    datesFound: dates.length,
    yearsSpanned: Array.from(years).sort(),
    hasContinuity: years.size >= 2,
    continuityYears: years.size
  };
}

/**
 * Extract medications mentioned in text
 * @param {string} text - Normalized text
 * @returns {Array} Found medications
 */
export function extractMedications(text) {
  const results = [];
  const seen = new Set();
  
  for (const { label, pattern } of STRS_PATTERNS.medications) {
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(label)) continue;
      
      results.push({
        label,
        matchedText: match[0],
        pattern
      });
      
      seen.add(label);
    }
  }
  
  return results;
}

/**
 * Extract procedures mentioned in text
 * @param {string} text - Normalized text
 * @returns {Array} Found procedures
 */
export function extractProcedures(text) {
  const results = [];
  const seen = new Set();
  
  for (const { label, pattern } of STRS_PATTERNS.procedures) {
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(label)) continue;
      
      results.push({
        label,
        matchedText: match[0],
        pattern
      });
      
      seen.add(label);
    }
  }
  
  return results;
}

/**
 * Identify service-connection opportunities
 * Deterministic rules:
 * - Direct: condition + LOD event
 * - Secondary: condition + related primary
 * - Aggravation: pre-existing + worsened marker
 * - Presumptive: matches known presumptive
 * - Chronic: 38 CFR 3.309(a) - any disease showing 20%+ disability
 * 
 * @param {string} text - Normalized text
 * @param {Object} extracted - Extracted data
 * @returns {Array} Service connection opportunities
 */
export function identifyServiceConnectionOpportunities(text, extracted) {
  const opportunities = [];
  
  // Check for presumptive conditions
  for (const { label, pattern } of STRS_PATTERNS.presumptive) {
    const regex = new RegExp(pattern, 'gi');
    if (regex.test(text)) {
      opportunities.push({
        type: 'presumptive',
        condition: label,
        basis: 'Presumptive condition under 38 CFR 3.309(a)',
        evidence: 'Presumptive deployment/exposure documented'
      });
    }
  }
  
  // Check for direct connection (condition + LOD/duty terminology)
  const lodRegex = new RegExp(STRS_PATTERNS.lodEvent.join('|'), 'gi');
  const hasLodContext = lodRegex.test(text);
  
  if (hasLodContext && extracted.conditions.length > 0) {
    for (const condition of extracted.conditions) {
      // Check if there's LOD context near the condition
      const contextRegex = new RegExp(
        `${condition.pattern}.{0,200}(${STRS_PATTERNS.lodEvent.join('|')})|` +
        `(${STRS_PATTERNS.lodEvent.join('|')}).{0,200}${condition.pattern}`,
        'gi'
      );
      
      if (contextRegex.test(text)) {
        opportunities.push({
          type: 'direct',
          condition: condition.label,
          basis: 'Direct service connection - documented LOD event',
          evidence: condition.context
        });
      }
    }
  }
  
  // Check for chronic disease eligibility (38 CFR 3.309(a))
  if (extracted.chronicity.hasChronicIndicators && extracted.conditions.length > 0) {
    opportunities.push({
      type: 'chronic_disease',
      condition: 'Chronic disease eligibility',
      basis: '38 CFR 3.309(a) - any disease showing 20%+ disability with 2+ year service',
      evidence: `${extracted.chronicity.totalChronicityScore} chronic terms found`
    });
  }
  
  return opportunities;
}

/**
 * Main STRS scanning function
 * Returns structured data per system schema requirements
 * 
 * @param {string} text - Raw STR text
 * @returns {Object} Structured scan result
 */
export function scanSTRText(text) {
  // Normalize input
  const normalized = normalizeText(text);
  
  // Extract all data deterministically - NOW IN THREE CATEGORIES
  const diagnoses = extractDiagnoses(normalized);
  const injuries = extractInjuries(normalized);
  const events = extractEvents(normalized);
  const medications = extractMedications(normalized);
  const procedures = extractProcedures(normalized);
  
  // Combine all conditions for chronicity/continuity analysis
  const allConditions = [...diagnoses, ...injuries];
  const chronicity = detectChronicity(normalized, allConditions);
  const continuity = detectContinuity(normalized);
  
  // ACCURACY IMPROVEMENT: Cross-reference medications with diagnoses only
  const medicationValidation = crossReferenceMedications(medications, diagnoses);
  
  // Helper function to map extracted items to output format
  const mapToOutput = (item) => ({
    label: item.label,
    displayName: item.displayName || item.label,
    normalizedKey: item.normalizedKey || item.label,
    category: item.category || null,
    extractionType: item.extractionType,
    icd10: item.icd10 || null,
    totalOccurrences: item.totalOccurrences,
    firstOccurrence: {
      matchedText: item.firstOccurrence.matchedText,
      context: item.firstOccurrence.context,
      page: item.firstOccurrence.page,
      dates: item.firstOccurrence.dates,
      position: 1,
      // NEW: Accuracy metadata
      negation: item.firstOccurrence.negation,
      laterality: item.firstOccurrence.laterality,
      severity: item.firstOccurrence.severity
    },
    followUps: item.followUps,
    allOccurrences: item.occurrences,
    // NEW: Confidence scoring
    confidence: item.confidence,
    // Legacy compatibility
    matchedText: item.firstOccurrence.matchedText,
    context: item.firstOccurrence.context
  });
  
  // Build extracted data object with enhanced timeline info - THREE SECTIONS
  const extracted = {
    Diagnoses: diagnoses.map(mapToOutput),
    Injuries: injuries.map(mapToOutput),
    Events: events.map(mapToOutput),
    Medications: medicationValidation.medications.map(m => ({
      label: m.label,
      matchedText: m.matchedText,
      // NEW: Cross-reference validation
      treatsConditions: m.treatsConditions || [],
      validationStatus: m.validationStatus || 'unknown',
      confidence: m.confidence || 'low',
      warnings: m.warnings || []
    })),
    Procedures: procedures.map(p => ({
      label: p.label,
      matchedText: p.matchedText
    })),
    Chronicity: chronicity,
    Continuity: continuity
  };
  
  // Identify service connection opportunities
  const opportunities = identifyServiceConnectionOpportunities(normalized, {
    conditions: allConditions,
    chronicity,
    continuity
  });
  
  // Analysis
  const analysis = {
    DiagnosesFound: diagnoses.length,
    InjuriesFound: injuries.length,
    EventsFound: events.length,
    TotalConditionOccurrences: allConditions.reduce((sum, c) => sum + c.totalOccurrences, 0),
    ChronicConditions: Object.values(chronicity.conditions)
      .filter(c => c.isChronicity).length,
    MedicationsFound: medications.length,
    ProceduresFound: procedures.length,
    ServiceConnectionOpportunities: opportunities,
    Flags: generateAnalysisFlags(extracted, opportunities)
  };
  
  // Return schema-compliant output with enhanced timeline data
  return {
    success: true,
    Extracted: extracted,
    Analysis: analysis,
    NLP: {
      ChronicityTerms: chronicity.explicitChronicTerms,
      ServiceConnectionOpportunities: opportunities
    },
    Timestamp: new Date().toISOString(),
    parse_warnings: [],
    // Store original text for AI analysis
    __rawText: normalized
  };
}

/**
 * Generate analysis flags for clinical significance
 * @param {Object} extracted - Extracted data
 * @param {Array} opportunities - Service connection opportunities
 * @returns {Array} Analysis flags
 */
function generateAnalysisFlags(extracted, opportunities) {
  const flags = [];
  
  if (extracted.Diagnoses.length > 0) {
    flags.push('Medical diagnoses present');
  }
  
  if (extracted.Medications.length > 0) {
    flags.push('Active medications documented');
  }
  
  if (extracted.Chronicity.hasChronicIndicators) {
    flags.push('Chronic condition indicators found');
  }
  
  if (extracted.Continuity.hasContinuity) {
    flags.push(`Continuity across ${extracted.Continuity.continuityYears} years`);
  }
  
  if (opportunities.length > 0) {
    flags.push(`${opportunities.length} potential service-connection opportunity(ies)`);
  }
  
  return flags;
}

/**
 * Validate STRS scan output - ensures schema compliance
 * @param {Object} scanResult - Result from scanSTRText
 * @returns {Object} Validation result with schema compliance check
 */
export function validateScanResult(scanResult) {
  const requiredFields = [
    'success',
    'Extracted',
    'Analysis',
    'NLP',
    'Timestamp',
    'parse_warnings'
  ];
  
  const requiredExtractedFields = [
    'Diagnoses',
    'Injuries',
    'Events',
    'Medications',
    'Procedures',
    'Chronicity',
    'Continuity'
  ];
  
  let isValid = true;
  const errors = [];
  
  // Check top-level fields
  for (const field of requiredFields) {
    if (!(field in scanResult)) {
      isValid = false;
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check Extracted fields
  if (scanResult.Extracted) {
    for (const field of requiredExtractedFields) {
      if (!(field in scanResult.Extracted)) {
        isValid = false;
        errors.push(`Missing Extracted.${field}`);
      }
    }
  }
  
  // Check Analysis fields
  if (scanResult.Analysis) {
    const requiredAnalysisFields = [
      'ChronicConditions',
      'MedicationsFound',
      'ProceduresFound',
      'ServiceConnectionOpportunities',
      'Flags'
    ];

    for (const field of requiredAnalysisFields) {
      if (!(field in scanResult.Analysis)) {
        isValid = false;
        errors.push(`Missing Analysis.${field}`);
      }
    }

    const hasLegacyConditionCount = 'ConditionsFound' in scanResult.Analysis;
    const hasNewConditionCounts =
      'DiagnosesFound' in scanResult.Analysis &&
      'InjuriesFound' in scanResult.Analysis &&
      'EventsFound' in scanResult.Analysis;

    if (!hasLegacyConditionCount && !hasNewConditionCounts) {
      isValid = false;
      errors.push('Missing Analysis condition counts (ConditionsFound or DiagnosesFound/InjuriesFound/EventsFound)');
    }
  }
  
  return {
    isValid,
    errors,
    scanResult
  };
}

