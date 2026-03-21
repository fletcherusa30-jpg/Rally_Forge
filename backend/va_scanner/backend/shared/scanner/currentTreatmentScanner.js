/**
 * Current Treatment scanner v2.1.
 * Deterministic extraction only; no diagnosis generation.
 */

import { buildExtractionMeta, preprocessScannerText } from './scannerMiddleware.js';
import { buildCurrentTreatmentAnalysis } from './currentTreatmentAnalysis/index.js';

const REQUIRED_ARRAY_KEYS = [
  'currentConditions',
  'worseningConditions',
  'functionalLimitations',
  'medications',
  'treatments',
  'providers',
];

function validateCurrentTreatmentSchema(result) {
  const errors = [];
  for (const key of REQUIRED_ARRAY_KEYS) {
    if (!Array.isArray(result?.[key])) {
      errors.push({ field: key, reason: `Required array field '${key}' is missing or not an array` });
    }
  }
  if (!result?.extractionMeta || typeof result.extractionMeta !== 'object') {
    errors.push({ field: 'extractionMeta', reason: 'extractionMeta is required' });
  }
  return { valid: errors.length === 0, errors };
}

export function scanCurrentTreatmentDeterministic(rawText) {
  const text = preprocessScannerText(rawText);
  const analysis = buildCurrentTreatmentAnalysis(text, {
    includeEvidenceGraph: false,
    includeCrossValidation: true,
  });

  const result = {
    documentType: 'CurrentTreatmentDocument',
    schemaVersion: '2.0.0',
    scannerVersion: '2.1.0-deterministic-enhanced',
    currentConditions: analysis.currentConditions,
    worseningConditions: analysis.worseningConditions,
    functionalLimitations: analysis.functionalLimitations,
    medications: analysis.medications,
    treatments: analysis.treatments,
    providers: analysis.providers,
    testsAndResults: analysis.testsAndResults,
    appointments: analysis.appointments,
    currentTreatmentAnalysis: analysis,
    extractionMeta: buildExtractionMeta({
      scannerType: 'currentTreatment',
      schemaVersion: '2.0.0',
      confidence: text ? 0.84 : 0,
      fieldsPopulated: [
        analysis.currentConditions,
        analysis.worseningConditions,
        analysis.functionalLimitations,
        analysis.medications,
        analysis.treatments,
        analysis.providers,
      ].filter((v) => Array.isArray(v) && v.length > 0).length,
      fieldsTotal: 6,
    }),
  };

  const schema = validateCurrentTreatmentSchema(result);
  result.extractionMeta.schemaValid = schema.valid;
  result.extractionMeta.schemaErrors = schema.errors;

  return result;
}

export default scanCurrentTreatmentDeterministic;
