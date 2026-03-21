/**
 * Graph node validator v2.0 — Schema-compliant validation per .copilot-instructions.md
 * Validates any node against:
 *   1. Required property rules from veteranEvidenceGraph.schema.js
 *   2. Document-node veteranId invariant
 *   3. AI-node required annotation fields
 *   4. Registered schema validator (if any) from schemaRegistry.js
 *   5. v2.0 schema compliance tracking
 */

import { NODE_TYPES, NODE_REQUIRED_PROPS, DOCUMENT_NODE_TYPES, AI_NODE_TYPES } from '../schema/veteranEvidenceGraph.schema.js';
import { getValidator } from '../registry/schemaRegistry.js';

/**
 * Validate a node against its schema and invariants.
 * @param {string} nodeType
 * @param {object} data
 * @returns {{ valid: boolean, errors: { field: string, reason: string }[] }}
 */
export function validateNode(nodeType, data) {
  const errors = [];

  if (!Object.values(NODE_TYPES).includes(nodeType)) {
    return {
      valid: false,
      errors: [{ field: 'nodeType', reason: `Unknown node type: '${nodeType}'` }],
    };
  }

  const requiredProps = NODE_REQUIRED_PROPS[nodeType] ?? [];
  for (const prop of requiredProps) {
    if (data?.[prop] === undefined || data?.[prop] === null) {
      errors.push({ field: prop, reason: `Required property '${prop}' is missing on node type '${nodeType}'` });
    }
  }

  if (DOCUMENT_NODE_TYPES.includes(nodeType) && !data?.veteranId) {
    errors.push({ field: 'veteranId', reason: `Document node '${nodeType}' must include a veteranId` });
  }

  if (AI_NODE_TYPES.includes(nodeType)) {
    for (const aiField of ['model', 'timestamp', 'confidence', 'scope']) {
      if (!data?.[aiField] && data?.[aiField] !== 0) {
        errors.push({ field: aiField, reason: `AI node '${nodeType}' must include '${aiField}'` });
      }
    }
    if (
      data?.confidence !== undefined &&
      (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1)
    ) {
      errors.push({ field: 'confidence', reason: 'AI node confidence must be a number between 0 and 1' });
    }
  }

  const schemaValidator = getValidator(nodeType);
  if (schemaValidator) {
    const schemaResult = schemaValidator(data);
    if (!schemaResult.valid) {
      for (const e of schemaResult.errors ?? []) {
        errors.push(e);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Determine if a node is an orphan (not linked to a Veteran).
 * A node is considered orphaned when its veteranId linkage is unknown.
 * @param {string} nodeType
 * @param {object} data
 * @param {string|null} linkedVeteranId - the veteranId the node is associated with, or null
 * @returns {boolean}
 */
export function isOrphan(nodeType, data, linkedVeteranId) {
  if (nodeType === NODE_TYPES.VETERAN) return false;
  return !linkedVeteranId;
}
