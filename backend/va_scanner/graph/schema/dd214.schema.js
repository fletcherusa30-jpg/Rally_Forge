/**
 * DD214 document schema — wraps the deterministic schemaValidators.js validator,
 * extending the result with schemaVersion and scannerVersion fields.
 */

import { SCHEMA_VERSIONS, SCANNER_VERSIONS } from '../registry/schemaVersions.js';
import { validateDD214Schema } from '../../backend/shared/scanner/schemaValidators.js';

export const DD214_SCHEMA_VERSION  = SCHEMA_VERSIONS.DD214;
export const DD214_SCANNER_VERSION = SCANNER_VERSIONS.DD214;

/**
 * Validate a DD214 scanner output.
 * @param {object} dd214Data
 * @returns {{ valid: boolean, errors: object[], schemaVersion: string, scannerVersion: string, documentType: string }}
 */
export function validate(dd214Data) {
  const result = validateDD214Schema(dd214Data);
  return {
    valid:          result.valid,
    errors:         result.errors ?? [],
    schemaVersion:  DD214_SCHEMA_VERSION,
    scannerVersion: DD214_SCANNER_VERSION,
    documentType:   'DD214Document',
  };
}

/**
 * Assert that a DD214 output carries the correct schemaVersion field.
 * @param {object} dd214Data
 * @returns {{ valid: boolean, error?: string }}
 */
export function assertSchemaVersion(dd214Data) {
  const sv = dd214Data?.schemaVersion;
  if (!sv) return { valid: false, error: 'Missing schemaVersion field on DD214 output' };
  if (sv !== DD214_SCHEMA_VERSION) {
    return { valid: false, error: `schemaVersion mismatch: expected ${DD214_SCHEMA_VERSION}, got ${sv}` };
  }
  return { valid: true };
}
