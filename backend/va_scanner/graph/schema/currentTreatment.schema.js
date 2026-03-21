/**
 * CurrentTreatment document schema.
 * Validates output from a current-treatment scanner.
 */

import { SCHEMA_VERSIONS, SCANNER_VERSIONS } from '../registry/schemaVersions.js';

export const CURRENT_TREATMENT_SCHEMA_VERSION  = SCHEMA_VERSIONS.CURRENT_TREATMENT;
export const CURRENT_TREATMENT_SCANNER_VERSION = SCANNER_VERSIONS.CURRENT_TREATMENT;

const REQUIRED_ARRAY_KEYS = [
  'currentConditions',
  'worseningConditions',
  'functionalLimitations',
  'medications',
  'treatments',
  'providers',
];

/**
 * Validate a CurrentTreatment scanner output.
 * @param {object} ctData
 * @returns {{ valid: boolean, errors: object[], schemaVersion: string, scannerVersion: string, documentType: string }}
 */
export function validate(ctData) {
  const errors = [];

  for (const key of REQUIRED_ARRAY_KEYS) {
    if (!Array.isArray(ctData?.[key])) {
      errors.push({ field: key, reason: `Required array field '${key}' is missing or not an array` });
    }
  }

  if (!ctData?.extractionMeta || typeof ctData.extractionMeta !== 'object') {
    errors.push({ field: 'extractionMeta', reason: 'extractionMeta is required' });
  }

  return {
    valid:          errors.length === 0,
    errors,
    schemaVersion:  CURRENT_TREATMENT_SCHEMA_VERSION,
    scannerVersion: CURRENT_TREATMENT_SCANNER_VERSION,
    documentType:   'CurrentTreatmentDocument',
  };
}

/**
 * Assert that a CurrentTreatment output carries the correct schemaVersion field.
 * @param {object} ctData
 * @returns {{ valid: boolean, error?: string }}
 */
export function assertSchemaVersion(ctData) {
  const sv = ctData?.schemaVersion;
  if (!sv) return { valid: false, error: 'Missing schemaVersion field on CurrentTreatment output' };
  if (sv !== CURRENT_TREATMENT_SCHEMA_VERSION) {
    return { valid: false, error: `schemaVersion mismatch: expected ${CURRENT_TREATMENT_SCHEMA_VERSION}, got ${sv}` };
  }
  return { valid: true };
}
