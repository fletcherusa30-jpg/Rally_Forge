/**
 * Current Treatment analysis schema helpers.
 * SAFETY: Informational extraction only, no diagnosis or legal determinations.
 */

export const CURRENT_TREATMENT_ANALYSIS_SCHEMA_VERSION = '2.1.0';

export const REQUIRED_ANALYSIS_KEYS = [
  'currentConditions',
  'worseningConditions',
  'functionalLimitations',
  'medications',
  'treatments',
  'providers',
  'testsAndResults',
  'appointments',
  'timeline',
  'crossValidation',
  'extractionMode',
  'confidenceSummary',
  'notes',
];

export function validateCurrentTreatmentAnalysisSchema(analysis) {
  const missingKeys = REQUIRED_ANALYSIS_KEYS.filter((key) => !(key in (analysis || {})));
  return {
    valid: missingKeys.length === 0,
    missingKeys,
    schemaVersion: CURRENT_TREATMENT_ANALYSIS_SCHEMA_VERSION,
  };
}

export function buildEmptyCurrentTreatmentAnalysis() {
  return {
    currentConditions: [],
    worseningConditions: [],
    functionalLimitations: [],
    medications: [],
    treatments: [],
    providers: [],
    testsAndResults: [],
    appointments: [],
    timeline: { global: [], byCondition: {} },
    crossValidation: {
      medicationWithoutCondition: [],
      treatmentWithoutCondition: [],
      followUpGaps: [],
    },
    extractionMode: 'deterministic-explicit-only',
    confidenceSummary: {
      currentConditions: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      worseningConditions: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      functionalLimitations: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      medications: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      treatments: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      providers: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      testsAndResults: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      appointments: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
    },
    notes: 'For human review only. No medical or legal conclusions.',
  };
}
