/**
 * Central schema registry.
 * Maps document/node type names to their version and validator function.
 * Used by graphNodeValidator.js to run schema checks against any node type.
 *
 * All schemas from the graph/schema/ directory are registered here at module load.
 */

import { SCHEMA_VERSIONS } from './schemaVersions.js';
import { validate as validateDD214 } from '../schema/dd214.schema.js';
import { validate as validateSTR } from '../schema/str.schema.js';
import { validate as validateCurrentTreatment } from '../schema/currentTreatment.schema.js';
import { validate as validateRatingDecision } from '../schema/ratingDecision.schema.js';
import { validateEvidenceItem, validateEvidenceBundle } from '../schema/evidenceItem.schema.js';

const _registry = new Map();
const _schemaMetadata = new Map();

function _register(name, version, validator, metadata = {}) {
  _registry.set(name, { name, version, validator });
  _schemaMetadata.set(name, {
    name,
    version,
    modernized: version.startsWith('3.') || version.startsWith('4.') || version.startsWith('2.'),
    lastUpdated: new Date().toISOString(),
    description: metadata.description || '',
    ...metadata,
  });
}

_register('DD214Document',             SCHEMA_VERSIONS.DD214,             validateDD214, { description: 'V3 DD214 modernized' });
_register('STRDocument',               SCHEMA_VERSIONS.STR,               validateSTR, { description: 'V3 STR modernized' });
_register('CurrentTreatmentDocument',  SCHEMA_VERSIONS.CURRENT_TREATMENT,  validateCurrentTreatment, { description: 'V2 CT modern' });
_register('RatingDecisionDocument',    SCHEMA_VERSIONS.RATING_DECISION,    validateRatingDecision, { description: 'V4.2 RD CFR' });
_register('EvidenceItem',              SCHEMA_VERSIONS.EVIDENCE_ITEM,      validateEvidenceItem, { description: 'V2 EI modern' });
_register('EvidenceBundle',            SCHEMA_VERSIONS.EVIDENCE_BUNDLE,    validateEvidenceBundle, { description: 'V2 EB modern' });

/**
 * Get the registered validator for a node/document type.
 * Returns null when the type has no registered schema validator.
 * @param {string} name
 * @returns {Function|null}
 */
export function getValidator(name) {
  return _registry.get(name)?.validator ?? null;
}

/**
 * Get the registered schema version for a node/document type.
 * @param {string} name
 * @returns {string|null}
 */
export function getVersion(name) {
  return _registry.get(name)?.version ?? null;
}

/**
 * Returns all registered schema entries.
 * @returns {{ name: string, version: string }[]}
 */
export function listAll() {
  return Array.from(_registry.values()).map(({ name, version }) => ({ name, version }));
}

export function getSchemaMetadata(name) {
  return _schemaMetadata.get(name) ?? null;
}
