/**
 * VA Rating Decision document schema.
 * Validates the output of scanVaDecision() from vaSuperScanner.js.
 */

import { SCHEMA_VERSIONS, SCANNER_VERSIONS } from '../registry/schemaVersions.js';

export const RATING_DECISION_SCHEMA_VERSION  = SCHEMA_VERSIONS.RATING_DECISION;
export const RATING_DECISION_SCANNER_VERSION = SCANNER_VERSIONS.RATING_DECISION;

const REQUIRED_KEYS = ['serviceConnected', 'denied', 'smc', 'dependents', 'ratingCalculation'];

/**
 * Validate a VA Rating Decision scanner output.
 * @param {object} rdData
 * @returns {{ valid: boolean, errors: object[], schemaVersion: string, scannerVersion: string, documentType: string }}
 */
export function validate(rdData) {
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (!(key in (rdData || {}))) {
      errors.push({ field: key, reason: `Required field '${key}' is missing` });
    }
  }

  if (rdData && !Array.isArray(rdData.serviceConnected)) {
    errors.push({ field: 'serviceConnected', reason: 'serviceConnected must be an array' });
  }
  if (rdData && !Array.isArray(rdData.denied)) {
    errors.push({ field: 'denied', reason: 'denied must be an array' });
  }

  return {
    valid:          errors.length === 0,
    errors,
    schemaVersion:  RATING_DECISION_SCHEMA_VERSION,
    scannerVersion: RATING_DECISION_SCANNER_VERSION,
    documentType:   'RatingDecisionDocument',
  };
}

/**
 * Assert that a RatingDecision output carries the correct schemaVersion field.
 * @param {object} rdData
 * @returns {{ valid: boolean, error?: string }}
 */
export function assertSchemaVersion(rdData) {
  const sv = rdData?.schemaVersion;
  if (!sv) return { valid: false, error: 'Missing schemaVersion field on RatingDecision output' };
  if (sv !== RATING_DECISION_SCHEMA_VERSION) {
    return { valid: false, error: `schemaVersion mismatch: expected ${RATING_DECISION_SCHEMA_VERSION}, got ${sv}` };
  }
  return { valid: true };
}
