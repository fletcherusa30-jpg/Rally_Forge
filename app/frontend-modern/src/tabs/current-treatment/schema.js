export const CT_FINDING_CATEGORIES = [
  'currentConditions',
  'functionalLimitations',
  'treatmentEvents',
  'providerSignals',
  'medicationMentions',
  'worseningIndicators',
  'evidenceSnippets',
];

export const CT_CATEGORY_LABELS = {
  currentConditions: 'Current Conditions',
  functionalLimitations: 'Symptoms & Functional Limitations',
  treatmentEvents: 'Appointments & Treatment Events',
  providerSignals: 'Provider Continuity Signals',
  medicationMentions: 'Medication Mentions',
  worseningIndicators: 'Worsening Trend Indicators',
  evidenceSnippets: 'Evidence Snippets (AI Context)',
};

export const CT_TREND_LEVELS = ['improving', 'stable', 'worsening', 'unknown'];

export const CT_STATUS_VALUES = ['active', 'inactive'];

/**
 * VA-preferred condition name aliases for dedup normalization.
 * Keys are lowercase normalized forms of common veteran phrasings / ICD-10 abbreviations.
 */
export const VA_CONDITION_ALIASES = {
  lbp: 'lower back pain',
  'lumbar strain': 'lower back pain',
  'lumbar pain': 'lower back pain',
  ptsd: 'post-traumatic stress disorder',
  'post traumatic stress': 'post-traumatic stress disorder',
  tbi: 'traumatic brain injury',
  concussion: 'traumatic brain injury',
  'hearing loss': 'sensorineural hearing loss',
  gerd: 'gastroesophageal reflux disease',
  'acid reflux': 'gastroesophageal reflux disease',
  htn: 'hypertension',
  'high blood pressure': 'hypertension',
  mdd: 'major depressive disorder',
  depression: 'major depressive disorder',
  gad: 'generalized anxiety disorder',
  anxiety: 'generalized anxiety disorder',
  'sleep apnea': 'obstructive sleep apnea',
  osa: 'obstructive sleep apnea',
  ddd: 'degenerative disc disease',
  'cervical strain': 'cervical spine condition',
  'neck pain': 'cervical spine condition',
  migraine: 'migraine headaches',
  migraines: 'migraine headaches',
  headache: 'migraine headaches',
  'rotator cuff': 'shoulder condition',
  diabetes: 'type 2 diabetes mellitus',
  dm2: 'type 2 diabetes mellitus',
  radiculopathy: 'lumbar radiculopathy',
  sciatica: 'lumbar radiculopathy',
  'flat feet': 'bilateral pes planus',
  'pes planus': 'bilateral pes planus',
  ibs: 'irritable bowel syndrome',
  rhinitis: 'allergic rhinitis',
  sinusitis: 'chronic sinusitis',
};

export function createEmptyMedication(overrides = {}) {
  return {
    medicationName: '',
    dosage: '',
    sideEffects: '',
    ...overrides,
  };
}

export function createEmptyManualEntry(overrides = {}) {
  return {
    id: '',
    conditionName: '',
    symptomSummary: '',
    status: 'active',
    providerName: '',
    providerType: '',
    treatmentDetails: '',
    treatmentStartDate: '',
    treatmentEndDate: '',
    medications: [],
    ...overrides,
  };
}

export function createEmptyExtractedFindings() {
  return {
    currentConditions: [],
    functionalLimitations: [],
    treatmentEvents: [],
    providerSignals: [],
    medicationMentions: [],
    worseningIndicators: [],
    evidenceSnippets: [],
  };
}

export function createCurrentTreatmentSection(overrides = {}) {
  return {
    uploadedDocuments: [],
    extractedFindings: createEmptyExtractedFindings(),
    manualEntries: [],
    summary: null,
    updatedAt: null,
    ...overrides,
  };
}
