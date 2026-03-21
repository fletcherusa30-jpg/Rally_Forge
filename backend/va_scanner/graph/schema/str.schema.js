/**
 * STR document schema — wraps the deterministic schemaValidators.js validator,
 * extending the result with schemaVersion and scannerVersion fields.
 */

import { SCHEMA_VERSIONS, SCANNER_VERSIONS } from '../registry/schemaVersions.js';
import { validateSTRSchema } from '../../backend/shared/scanner/schemaValidators.js';

export const STR_SCHEMA_VERSION  = SCHEMA_VERSIONS.STR;
export const STR_SCANNER_VERSION = SCANNER_VERSIONS.STR;

/**
 * Validate a STR scanner output.
 * @param {object} strData
 * @returns {{ valid: boolean, errors: object[], schemaVersion: string, scannerVersion: string, documentType: string }}
 */
export function validate(strData) {
  const result = validateSTRSchema(strData);
  return {
    valid:          result.valid,
    errors:         result.errors ?? [],
    schemaVersion:  STR_SCHEMA_VERSION,
    scannerVersion: STR_SCANNER_VERSION,
    documentType:   'STRDocument',
  };
}

/**
 * Assert that a STR output carries the correct schemaVersion field.
 * @param {object} strData
 * @returns {{ valid: boolean, error?: string }}
 */
export function assertSchemaVersion(strData) {
  const sv = strData?.schemaVersion;
  if (!sv) return { valid: false, error: 'Missing schemaVersion field on STR output' };
  if (sv !== STR_SCHEMA_VERSION) {
    return { valid: false, error: `schemaVersion mismatch: expected ${STR_SCHEMA_VERSION}, got ${sv}` };
  }
  return { valid: true };
}
