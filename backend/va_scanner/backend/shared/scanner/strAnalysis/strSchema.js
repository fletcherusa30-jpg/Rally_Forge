/**
 * strSchema.js — Rally Forge STR Scanner Schema Reference
 *
 * Defines the canonical JSON schema for strAnalysis output.
 * Schema version: 3.1.0
 *
 * SAFETY NOTICE: The STR scanner NEVER diagnoses conditions, recommends
 * treatment, or provides medical advice. All output is for human review only.
 */

/**
 * Top-level strAnalysis schema shape (documentation / validation reference).
 *
 * {
 *   events:                   STREvent[],
 *   symptoms:                 STRSymptom[],
 *   diagnoses:                STRDiagnosis[],
 *   medications:              STRMedication[],
 *   testsAndResults:          STRTest[],
 *   profilesAndDutyLimits:   STRProfile[],
 *   functionalImpactStatements: STRFunctionalImpact[],
 *   deploymentIndicators:    STRDeploymentIndicator[],
 *   mentalHealthIndicators:  STRMentalHealthIndicator[],
 *   missingInformationIndicators: STRMissingInfo[],
 *   conditionPatterns:       STRConditionPattern[],
 *   serviceConnectionIndicators: STRServiceConnectionIndicator[],
 *   timelines: {
 *     global: STRTimelineEntry[],
 *     byCondition: { [conditionName: string]: STRTimelineEntry[] }
 *   },
 *   notes: string
 * }
 */

export const STR_SCHEMA_VERSION = '3.1.0';

export const REQUIRED_STR_ANALYSIS_KEYS = [
  'events',
  'symptoms',
  'diagnoses',
  'medications',
  'testsAndResults',
  'profilesAndDutyLimits',
  'functionalImpactStatements',
  'deploymentIndicators',
  'mentalHealthIndicators',
  'missingInformationIndicators',
  'conditionPatterns',
  'serviceConnectionIndicators',
  'timelines',
  'extractionMode',
  'confidenceSummary',
  'notes',
];

/**
 * Validate a strAnalysis object against the required schema keys.
 * @param {Object} obj
 * @returns {{ valid: boolean, missingKeys: string[] }}
 */
export function validateStrAnalysisSchema(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, missingKeys: REQUIRED_STR_ANALYSIS_KEYS };
  }
  const missingKeys = REQUIRED_STR_ANALYSIS_KEYS.filter(k => !(k in obj));
  return { valid: missingKeys.length === 0, missingKeys };
}

/**
 * Build an empty strAnalysis object conforming to the schema.
 */
export function buildEmptyStrAnalysis() {
  return {
    events: [],
    symptoms: [],
    diagnoses: [],
    medications: [],
    testsAndResults: [],
    profilesAndDutyLimits: [],
    functionalImpactStatements: [],
    deploymentIndicators: [],
    mentalHealthIndicators: [],
    missingInformationIndicators: [],
    conditionPatterns: [],
    serviceConnectionIndicators: [],
    timelines: { global: [], byCondition: {} },
    extractionMode: 'deterministic-explicit-only',
    confidenceSummary: {
      events: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      symptoms: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      diagnoses: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      medications: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      testsAndResults: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      profilesAndDutyLimits: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      functionalImpactStatements: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      deploymentIndicators: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      mentalHealthIndicators: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
      serviceConnectionIndicators: { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 },
    },
    notes: 'For human review only. No medical conclusions. This module does not diagnose, recommend treatment, or provide medical advice.',
  };
}
