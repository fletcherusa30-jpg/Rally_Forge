/**
 * extractionLibrary.js — Rally Forge STR Scanner v3.1
 *
 * Regex + NLP extraction library for Service Treatment Records.
 * Extracts structured events, symptoms, diagnoses, medications,
 * tests, profiles, functional impact, deployment indicators,
 * mental health indicators, and service-connection indicators.
 *
 * SAFETY NOTICE: This module NEVER diagnoses conditions, recommends
 * treatment, or provides medical advice. All output is for human review only.
 */

// ── Shared Helpers ─────────────────────────────────────────────────────────────

function toIsoDate(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1940 || year > 2040 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function parseDateFromText(text) {
  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = text.match(/\b(20\d{2}|19\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (ymd) return toIsoDate(ymd[1], ymd[2], ymd[3]);

  // MM/DD/YYYY or M-D-YYYY
  const mdy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2}|19\d{2})\b/);
  if (mdy) return toIsoDate(mdy[3], mdy[1], mdy[2]);

  // Month DD, YYYY  or  DD Month YYYY
  const longDate = text.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2}|19\d{2})\b/);
  if (longDate) {
    const month = MONTH_MAP[longDate[1].toLowerCase().slice(0, 3)];
    if (month) return toIsoDate(longDate[3], month, longDate[2]);
  }

  return null;
}

export function getSnippet(text, index, radius = 100) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

let _eventIdCounter = 0;
export function generateId(prefix = 'str') {
  return `${prefix}-${++_eventIdCounter}`;
}
export function resetIdCounter() { _eventIdCounter = 0; }

// ── Body Location Extraction ───────────────────────────────────────────────────

const BODY_LOCATIONS = [
  'back', 'lower back', 'lumbar', 'cervical', 'thoracic', 'spine',
  'knee', 'knees', 'hip', 'hips', 'shoulder', 'shoulders',
  'ankle', 'ankles', 'foot', 'feet', 'wrist', 'elbow',
  'hand', 'hands', 'neck', 'head', 'chest', 'abdomen',
  'ear', 'ears', 'eye', 'eyes', 'hearing', 'left', 'right', 'bilateral',
  'extremity', 'extremities', 'leg', 'arm',
];

export function extractBodyLocation(text) {
  const lower = text.toLowerCase();
  for (const loc of BODY_LOCATIONS) {
    if (lower.includes(loc)) return loc;
  }
  return null;
}

// ── Severity Extraction ───────────────────────────────────────────────────────

const SEVERITY_PATTERNS = [
  { pattern: /\bsevere\b/i, value: 'severe' },
  { pattern: /\bmoderate\b/i, value: 'moderate' },
  { pattern: /\bmild\b/i, value: 'mild' },
  { pattern: /\bminimal\b/i, value: 'minimal' },
  { pattern: /\bsignificant\b/i, value: 'significant' },
  { pattern: /\bintermittent\b/i, value: 'intermittent' },
  { pattern: /\bconstant\b/i, value: 'constant' },
  { pattern: /\bchronic\b/i, value: 'chronic' },
];

export function extractSeverity(text) {
  for (const { pattern, value } of SEVERITY_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

// ── 1. Event Extraction ───────────────────────────────────────────────────────

const EVENT_PATTERNS = {
  injury: [
    /\b(sprain|strain|fracture|contusion|laceration|burn|concussion|trauma|dislocation|tear|rupture|avulsion)\b/i,
    /\binjur(?:y|ied|ies)\b/i,
    /\bwounded?\b/i,
    /\bblast\s+injur/i,
  ],
  illness: [
    /\b(infection|pneumonia|bronchitis|gastritis|influenza|uri|uti|cellulitis|sinusitis)\b/i,
    /\bchronic\s+\w+\s+disease\b/i,
    /\billness\b/i,
  ],
  exposure: [
    /\b(burn\s+pit|toxic|chemical|solvent|asbestos|radiation|noise\s+exposure|blast\s+wave|particulate\s+matter)\b/i,
    /\b(oil\s+fire|smoke\s+exposure|hazardous\s+material|pesticide|agent\s+orange|dioxin)\b/i,
  ],
  hospitalization: [
    /\b(hospitali[zs]|admitted\s+to|inpatient|ward|icu|intensive\s+care)\b/i,
  ],
  emergency: [
    /\b(emergency\s+room|er\s+visit|urgent\s+care|emergency\s+department|ed\s+visit)\b/i,
  ],
  sickCall: [
    /\b(sick\s+call|sick\s+in\s+quarters|siq|went\s+to\s+(medical|clinic|provider))\b/i,
  ],
  profile: [
    /\b(profile|duty\s+limitation|limited\s+duty|light\s+duty|quarters|physical\s+profile)\b/i,
  ],
};

export function extractEvents(lines) {
  const events = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;
    const lowerLine = line.toLowerCase();

    for (const [eventType, patterns] of Object.entries(EVENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (!pattern.test(line)) continue;
        const key = `${eventType}|${line.slice(0, 60)}`.toLowerCase();
        if (seen.has(key)) break;
        seen.add(key);
        events.push({
          id: generateId('evt'),
          eventType,
          description: line.trim(),
          date,
          pageNumber: null, // set by page-aware callers
          facility: extractFacility(line),
          associatedSymptoms: [],
          associatedDiagnoses: [],
          rawText: line,
          lineNumber,
        });
        break;
      }
    }
  });

  return events;
}

function extractFacility(text) {
  const m = text.match(/\b(?:at|facility|clinic|hospital|MTF|VAMC|medical\s+center)[:\s]+([A-Za-z\s]+?)(?:[,\.]|$)/i);
  return m ? m[1].trim() : null;
}

// ── 2. Symptom Extraction ─────────────────────────────────────────────────────

const SYMPTOM_PATTERNS = [
  { type: 'pain', pattern: /\b(pain|aching|soreness|discomfort)\b/i },
  { type: 'limitedMotion', pattern: /\b(limited\s+(range\s+of\s+)?motion|decreased\s+rom|stiffness)\b/i },
  { type: 'numbness', pattern: /\b(numbness|tingling|paresthesia)\b/i },
  { type: 'headache', pattern: /\b(headache|migraine|cephalgia)\b/i },
  { type: 'sleep', pattern: /\b(insomnia|sleep\s+disturbance|difficulty\s+sleeping|hypersomnia)\b/i },
  { type: 'fatigue', pattern: /\b(fatigue|exhaustion|lethargy|malaise)\b/i },
  { type: 'mentalHealth', pattern: /\b(anxiety|depression|stress|irritability|mood\s+changes|hypervigilance|flashback)\b/i },
  { type: 'gi', pattern: /\b(nausea|vomiting|diarrhea|abdominal\s+pain|gi\s+upset|acid\s+reflux|gerd)\b/i },
  { type: 'respiratory', pattern: /\b(shortness\s+of\s+breath|dyspnea|cough|wheezing|asthma|bronchospasm)\b/i },
  { type: 'skin', pattern: /\b(rash|dermatitis|eczema|skin\s+lesion|urticaria|hives)\b/i },
  { type: 'hearing', pattern: /\b(tinnitus|hearing\s+loss|threshold\s+shift|ringing\s+in\s+(the\s+)?ears?|decreased\s+hearing)\b/i },
  { type: 'vision', pattern: /\b(vision\s+(loss|change)|blurred?\s+vision|diplopia|floaters)\b/i },
];

export function extractSymptoms(lines) {
  const symptoms = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;

    for (const { type, pattern } of SYMPTOM_PATTERNS) {
      if (!pattern.test(line)) continue;
      const key = `${type}|${line.slice(0, 60)}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      symptoms.push({
        id: generateId('sym'),
        symptomType: type,
        bodyLocation: extractBodyLocation(line),
        severity: extractSeverity(line),
        date,
        rawText: line,
        lineNumber,
        contextEventId: null, // linked by caller
      });
    }
  });

  return symptoms;
}

// ── 3. Diagnosis Extraction ───────────────────────────────────────────────────

const DIAGNOSIS_LABEL_PATTERN = /\b(?:diagnosis|assessment|impression|problem\s*(?:list)?|dx|chief\s+complaint|cc)\s*[:\-]?\s*(.+)$/i;
const PROVISIONAL_PATTERN = /\b(provisional|rule\s+out|r\/o|probable|suspected|possible)\b/i;
const DIFFERENTIAL_PATTERN = /\b(differential|ddx|versus|vs\.)\b/i;

export function extractDiagnoses(lines) {
  const diagnoses = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const m = line.match(DIAGNOSIS_LABEL_PATTERN);
    if (!m) return;
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;
    const diagnosisName = m[1].trim().slice(0, 120);
    const key = `dx|${diagnosisName}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    let diagnosisType = 'confirmed';
    if (PROVISIONAL_PATTERN.test(line)) diagnosisType = DIFFERENTIAL_PATTERN.test(line) ? 'differential' : 'provisional';
    else if (DIFFERENTIAL_PATTERN.test(line)) diagnosisType = 'differential';

    diagnoses.push({
      id: generateId('dxn'),
      diagnosisName,
      diagnosisType,
      date,
      rawText: line,
      lineNumber,
      providerType: extractProviderType(line),
      linkedEventId: null,
    });
  });

  return diagnoses;
}

function extractProviderType(text) {
  if (/\bpsych(?:iatrist|ology|iatry)?\b/i.test(text)) return 'mental health';
  if (/\b(?:orthopedic|ortho)\b/i.test(text)) return 'orthopedic';
  if (/\b(?:primary\s+care|pcp|family\s+medicine|internal\s+medicine)\b/i.test(text)) return 'primary care';
  if (/\b(?:surgeon|surgery)\b/i.test(text)) return 'surgeon';
  if (/\b(?:audiolog|hearing)\b/i.test(text)) return 'audiology';
  if (/\b(?:neurology|neurolog)\b/i.test(text)) return 'neurology';
  return null;
}

// ── 4. Medication Extraction ──────────────────────────────────────────────────

const MEDICATION_LABEL_PATTERN = /\b(?:medications?|rx|prescribed|started\s+on|dispensed)\s*[:\-]?\s*(.+)$/i;
const KNOWN_MEDS = [
  'sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram',
  'amitriptyline', 'gabapentin', 'pregabalin', 'tramadol', 'oxycodone',
  'hydrocodone', 'ibuprofen', 'naproxen', 'celecoxib', 'acetaminophen',
  'albuterol', 'salmeterol', 'montelukast', 'omeprazole', 'pantoprazole',
  'metoprolol', 'lisinopril', 'amlodipine', 'atorvastatin', 'simvastatin',
  'metformin', 'insulin', 'prednisone', 'methylprednisolone', 'cyclobenzaprine',
  'tizanidine', 'baclofen', 'clonazepam', 'lorazepam', 'hydroxyzine',
  'zolpidem', 'prazosin', 'clonidine', 'topiramate',
];
const MED_NAME_RE = new RegExp(`\\b(${KNOWN_MEDS.join('|')})\\b`, 'i');
const DOSAGE_RE = /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|units?))\b/i;
const FREQ_RE = /\b(once|twice|three\s+times|bid|tid|qid|daily|weekly|prn|as\s+needed)\b/i;

export function extractMedications(lines) {
  const medications = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const hasLabel = MEDICATION_LABEL_PATTERN.test(line);
    const hasKnownMed = MED_NAME_RE.test(line);
    if (!hasLabel && !hasKnownMed) return;

    const date = parseDateFromText(line);
    const lineNumber = idx + 1;
    const labelMatch = line.match(MEDICATION_LABEL_PATTERN);
    const medName = hasKnownMed
      ? (line.match(MED_NAME_RE)?.[0] || line.slice(0, 80))
      : (labelMatch?.[1] || line).trim().slice(0, 80);

    const key = `med|${medName}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    medications.push({
      id: generateId('med'),
      medicationName: medName,
      dosage: line.match(DOSAGE_RE)?.[1] || null,
      frequency: line.match(FREQ_RE)?.[0] || null,
      purpose: null, // would require adjacent line context
      startDate: date,
      stopDate: null,
      rawText: line,
      lineNumber,
    });
  });

  return medications;
}

// ── 5. Tests & Results Extraction ─────────────────────────────────────────────

const TEST_PATTERNS = [
  { testType: 'xray', pattern: /\b(x-?ray|radiograph)\b/i },
  { testType: 'mri', pattern: /\bm\.?r\.?i\.?\b/i },
  { testType: 'ct', pattern: /\b(c\.?t\.?\s+scan|computed\s+tomography)\b/i },
  { testType: 'lab', pattern: /\b(lab(?:oratory)?|blood\s+test|urinalysis|cbc|bmp|cmp|hba1c)\b/i },
  { testType: 'audiogram', pattern: /\b(audiogram|hearing\s+test|audiolog)\b/i },
  { testType: 'visionTest', pattern: /\b(vision\s+test|visual\s+acuity|eye\s+exam)\b/i },
  { testType: 'pulmonaryFunction', pattern: /\b(pft|pulmonary\s+function|spirometry|fev1|fvc)\b/i },
  { testType: 'ecg', pattern: /\b(ekg|ecg|electrocardiogram)\b/i },
  { testType: 'ultrasound', pattern: /\b(ultrasound|sonogram|doppler)\b/i },
];

const FINDINGS_PATTERN = /\b(?:findings?|impression|result|showed?|revealed?|demonstrated?)\s*[:\-]?\s*(.+)$/i;

export function extractTestsAndResults(lines) {
  const tests = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;

    for (const { testType, pattern } of TEST_PATTERNS) {
      if (!pattern.test(line)) continue;
      const key = `test|${testType}|${line.slice(0, 60)}`.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);

      const findingsMatch = line.match(FINDINGS_PATTERN);
      tests.push({
        id: generateId('tst'),
        testType,
        date,
        lineNumber,
        findingsSummary: findingsMatch ? findingsMatch[1].trim().slice(0, 200) : null,
        impressionSummary: null,
        relatedCondition: null,
        rawText: line,
      });
      break;
    }
  });

  return tests;
}

// ── 6. Profiles & Duty Limitations ───────────────────────────────────────────

const PROFILE_TYPE_PATTERN = /\b(permanent|temporary|temp)\s*profile\b/i;
const LOD_IN_PATTERN = /\b(?:in\s+line\s+of\s+duty|ild|in\s+lod)\b/i;
const LOD_NOT_PATTERN = /\b(?:not\s+in\s+line\s+of\s+duty|nild|not\s+in\s+lod)\b/i;
const LIMITATION_DETAILS = /\b(no\s+\w+|limited\s+\w+|avoid\s+\w+|restrict(?:ed)?\s+from\s+\w+)/i;

export function extractProfilesAndDutyLimits(lines) {
  const profiles = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const hasProfile = /\b(profile|duty\s+limitation|limited\s+duty|light\s+duty|physical\s+profile|fitness\s+for\s+duty)\b/i.test(line);
    const hasLOD = /\b(lod|line\s+of\s+duty)\b/i.test(line);
    if (!hasProfile && !hasLOD) return;

    const date = parseDateFromText(line);
    const lineNumber = idx + 1;
    const key = `prof|${line.slice(0, 60)}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const profileTypeMatch = line.match(PROFILE_TYPE_PATTERN);
    let lodStatus = null;
    if (LOD_NOT_PATTERN.test(line)) lodStatus = 'not in line of duty';
    else if (LOD_IN_PATTERN.test(line)) lodStatus = 'in line of duty';

    profiles.push({
      id: generateId('prf'),
      profileType: profileTypeMatch ? profileTypeMatch[1].toLowerCase() : null,
      limitations: line.match(LIMITATION_DETAILS)?.[0] || null,
      startDate: date,
      endDate: null,
      lodStatus,
      relatedCondition: null,
      rawText: line,
      lineNumber,
    });
  });

  return profiles;
}

// ── 7. Functional Impact Extraction ──────────────────────────────────────────

const FUNCTIONAL_IMPACT_PATTERNS = [
  /\b(unable\s+to\s+\w+(?:\s+\w+)?)\b/i,
  /\b(difficulty\s+(?:lifting|walking|standing|running|sleeping|concentrating))\b/i,
  /\b(limited\s+(?:standing|walking|lifting|mobility|activity))\b/i,
  /\b(pain\s+with\s+\w+)\b/i,
  /\b(unable\s+to\s+perform\s+pt)\b/i,
  /\b(restricted\s+from\s+(?:certain\s+)?duties?)\b/i,
  /\b(requires\s+assistive\s+device)\b/i,
  /\b(ambulat(?:es|ing)\s+with\s+(cane|walker|crutch))\b/i,
  /\b(cannot\s+(?:lift|carry|walk|stand|run|perform))\b/i,
];

export function extractFunctionalImpact(lines) {
  const impacts = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;

    for (const pattern of FUNCTIONAL_IMPACT_PATTERNS) {
      const m = line.match(pattern);
      if (!m) continue;
      const key = `fi|${m[0]}|${line.slice(0, 40)}`.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      impacts.push({
        id: generateId('fim'),
        functionalImpactDescription: m[0].trim(),
        relatedCondition: null,
        date,
        rawText: line,
        lineNumber,
      });
      break;
    }
  });

  return impacts;
}

// ── 8. Deployment Indicator Extraction ───────────────────────────────────────

const DEPLOYMENT_PATTERNS = [
  /\b(pre-?deployment\s+(?:health\s+)?assessment|ptha)\b/i,
  /\b(post-?deployment\s+(?:health\s+)?assessment|pdha|pdhra)\b/i,
  /\b(exposure\s+questionnaire)\b/i,
  /\b(combat[\s-]related)\b/i,
  /\b(deployed|deployment)\b/i,
  /\b(oif|oef|ond|operation\s+(?:iraqi|enduring|new\s+dawn|freedom))\b/i,
  /\b(iraq|afghanistan|kuwait|somalia|kosovo|syria|vietnam|korea|persian\s+gulf)\b/i,
];

const THEATER_PATTERNS = /\b(iraq|afghanistan|kuwait|persian\s+gulf|vietnam|korea|southwest\s+asia|gulf\s+war|pacific)\b/i;

export function extractDeploymentIndicators(lines) {
  const indicators = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;

    for (const pattern of DEPLOYMENT_PATTERNS) {
      if (!pattern.test(line)) continue;
      const key = `dep|${line.slice(0, 60)}`.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);

      const theaterMatch = line.match(THEATER_PATTERNS);
      indicators.push({
        id: generateId('dep'),
        indicatorType: classifyDeploymentType(line),
        theaterOfOperations: theaterMatch ? theaterMatch[1] : null,
        exposureStatement: line.trim(),
        date,
        rawText: line,
        lineNumber,
      });
      break;
    }
  });

  return indicators;
}

function classifyDeploymentType(line) {
  if (/pre-?deployment/i.test(line)) return 'pre-deployment assessment';
  if (/post-?deployment/i.test(line)) return 'post-deployment assessment';
  if (/exposure\s+questionnaire/i.test(line)) return 'exposure questionnaire';
  if (/combat/i.test(line)) return 'combat-related indicator';
  return 'deployment reference';
}

// ── 9. Mental Health Indicator Extraction ────────────────────────────────────

const MH_SYMPTOM_PATTERNS = [
  { type: 'ptsd', pattern: /\b(ptsd|post[\s-]traumatic\s+stress)\b/i },
  { type: 'depression', pattern: /\b(depression|depressive|mdd|major\s+depression)\b/i },
  { type: 'anxiety', pattern: /\b(anxiety|anxious|gad|generalized\s+anxiety)\b/i },
  { type: 'sleep', pattern: /\b(insomnia|sleep\s+disturbance|nightmares|hyperarousal)\b/i },
  { type: 'anger', pattern: /\b(irritabilit|anger\s+management|aggressive\s+behavior)\b/i },
  { type: 'substanceUse', pattern: /\b(alcohol\s+use|substance\s+abuse|drug\s+use|etoh)\b/i },
  { type: 'referral', pattern: /\b(referred?\s+to\s+(behavioral|mental|psych)|behavioral\s+health\s+referral)\b/i },
  { type: 'counseling', pattern: /\b(counseling|therapy|psychotherapy|group\s+therapy)\b/i },
];

export function extractMentalHealthIndicators(lines) {
  const indicators = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;

    for (const { type, pattern } of MH_SYMPTOM_PATTERNS) {
      if (!pattern.test(line)) continue;
      const key = `mh|${type}|${line.slice(0, 60)}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      indicators.push({
        id: generateId('mhi'),
        mentalHealthType: type,
        symptoms: [line.trim().slice(0, 120)],
        date,
        rawText: line,
        lineNumber,
        linkedEventIds: [],
      });
    }
  });

  return indicators;
}

// ── 10. Service-Connection Indicator Extraction ───────────────────────────────

const SC_INDICATOR_PHRASES = [
  { phrase: 'injury occurred during training', pattern: /\binjur(?:y|ies?)\s+(?:occurred|sustained|happened)\s+during\s+training\b/i },
  { phrase: 'injury occurred on duty', pattern: /\binjur(?:y|ies?)\s+(?:occurred|sustained)\s+(?:on|while\s+on)\s+(?:active\s+)?duty\b/i },
  { phrase: 'symptoms began in service', pattern: /\b(?:symptoms?|condition)\s+(?:began|started|onset)\s+(?:in\s+service|while\s+(?:in|on)\s+active\s+duty)\b/i },
  { phrase: 'chronic since', pattern: /\bchronic\s+since\b/i },
  { phrase: 'recurrent', pattern: /\brecurrent\b/i },
  { phrase: 'follow-up recommended', pattern: /\bfollow[\s-]*up\s+(?:recommended|required|needed|scheduled)\b/i },
  { phrase: 'referred to specialist', pattern: /\breferred?\s+to\s+(?:a\s+)?specialist\b/i },
  { phrase: 'in line of duty', pattern: /\bin\s+line\s+of\s+duty\b/i },
  { phrase: 'continuous since', pattern: /\bcontinuous\s+since\b/i },
  { phrase: 'persistent', pattern: /\bpersistent\b/i },
  { phrase: 'worsening over time', pattern: /\bworsening\s+over\s+(?:time|years|months)\b/i },
];

export function extractServiceConnectionIndicators(lines) {
  const indicators = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromText(line);
    const lineNumber = idx + 1;

    for (const { phrase, pattern } of SC_INDICATOR_PHRASES) {
      const m = line.match(pattern);
      if (!m) continue;
      const key = `sci|${phrase}|${line.slice(0, 40)}`.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      indicators.push({
        id: generateId('sci'),
        type: 'serviceConnectionIndicator',
        phrase,
        contextSnippet: line.trim().slice(0, 200),
        date,
        lineNumber,
        note: 'Textual indicator only. Not a legal conclusion.',
      });
      break;
    }
  });

  return indicators;
}

// ── 11. Missing Information Indicators ──────────────────────────────────────

export function detectMissingInformationIndicators(lines) {
  const indicators = [];

  // Detect references to reports not present
  lines.forEach((line, idx) => {
    if (/\b(?:see\s+attached|see\s+enclosed|see\s+report|per\s+attached)\b/i.test(line)) {
      indicators.push({
        type: 'missingInformationIndicator',
        description: 'Reference to attached/enclosed document that may not be present',
        location: `line ${idx + 1}`,
        rawText: line.trim(),
        notes: 'Verify referenced document is included in the records.',
      });
    }
    if (/\b(?:illegible|unable\s+to\s+read|not\s+legible|redacted)\b/i.test(line)) {
      indicators.push({
        type: 'missingInformationIndicator',
        description: 'Illegible or redacted content indicator',
        location: `line ${idx + 1}`,
        rawText: line.trim(),
        notes: 'Content may be missing or unreadable.',
      });
    }
  });

  return indicators;
}
