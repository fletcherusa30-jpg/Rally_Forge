/**
 * EvidenceItem and EvidenceBundle schemas.
 */

import { SCHEMA_VERSIONS } from '../registry/schemaVersions.js';

export const EVIDENCE_ITEM_SCHEMA_VERSION   = SCHEMA_VERSIONS.EVIDENCE_ITEM;
export const EVIDENCE_BUNDLE_SCHEMA_VERSION = SCHEMA_VERSIONS.EVIDENCE_BUNDLE;

const EVIDENCE_ITEM_REQUIRED = [
  'evidenceId',
  'sourceDocumentType',
  'sourceDocumentId',
  'summary',
  'confidence',
];

const EVIDENCE_BUNDLE_REQUIRED = [
  'bundleId',
  'conditionId',
  'label',
  'evidenceItems',
  'completenessScore',
];

/**
 * Validate an EvidenceItem node.
 * @param {object} item
 * @returns {{ valid: boolean, errors: object[] }}
 */
export function validateEvidenceItem(item) {
  const errors = [];

  for (const key of EVIDENCE_ITEM_REQUIRED) {
    if (item?.[key] === undefined || item?.[key] === null) {
      errors.push({ field: key, reason: `Required field '${key}' is missing` });
    }
  }

  if (
    typeof item?.confidence !== 'number' ||
    item.confidence < 0 ||
    item.confidence > 1
  ) {
    errors.push({ field: 'confidence', reason: 'confidence must be a number between 0 and 1' });
  }

  if (!Array.isArray(item?.tags)) {
    errors.push({ field: 'tags', reason: 'tags must be an array' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an EvidenceBundle node.
 * @param {object} bundle
 * @returns {{ valid: boolean, errors: object[] }}
 */
export function validateEvidenceBundle(bundle) {
  const errors = [];

  for (const key of EVIDENCE_BUNDLE_REQUIRED) {
    if (bundle?.[key] === undefined || bundle?.[key] === null) {
      errors.push({ field: key, reason: `Required field '${key}' is missing` });
    }
  }

  if (!Array.isArray(bundle?.evidenceItems)) {
    errors.push({ field: 'evidenceItems', reason: 'evidenceItems must be an array' });
  }

  if (
    typeof bundle?.completenessScore !== 'number' ||
    bundle.completenessScore < 0 ||
    bundle.completenessScore > 1
  ) {
    errors.push({ field: 'completenessScore', reason: 'completenessScore must be a number between 0 and 1' });
  }

  return { valid: errors.length === 0, errors };
}
