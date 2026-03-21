/**
 * Graph edge validator.
 * Validates that an edge type is allowed between two given node types,
 * based on the authoritative EDGE_RULES in veteranEvidenceGraph.schema.js.
 */

import { EDGE_RULES, EDGE_TYPES, NODE_TYPES } from '../schema/veteranEvidenceGraph.schema.js';

/**
 * Validate an edge.
 * @param {string} edgeType
 * @param {string} fromNodeType
 * @param {string} toNodeType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEdge(edgeType, fromNodeType, toNodeType) {
  if (!Object.values(EDGE_TYPES).includes(edgeType)) {
    return { valid: false, error: `Unknown edge type: '${edgeType}'` };
  }
  if (!Object.values(NODE_TYPES).includes(fromNodeType)) {
    return { valid: false, error: `Unknown fromNodeType: '${fromNodeType}'` };
  }
  if (!Object.values(NODE_TYPES).includes(toNodeType)) {
    return { valid: false, error: `Unknown toNodeType: '${toNodeType}'` };
  }

  const allowed = EDGE_RULES.some(
    ([from, edge, to]) =>
      from === fromNodeType && edge === edgeType && to === toNodeType
  );

  if (!allowed) {
    return {
      valid: false,
      error: `Edge '${edgeType}' from '${fromNodeType}' to '${toNodeType}' is not defined in the Evidence Graph schema`,
    };
  }

  return { valid: true };
}

/**
 * Get all edges allowed outbound from a given node type.
 * @param {string} fromNodeType
 * @returns {{ edgeType: string, toNodeType: string }[]}
 */
export function getAllowedEdgesFrom(fromNodeType) {
  return EDGE_RULES
    .filter(([from]) => from === fromNodeType)
    .map(([, edge, to]) => ({ edgeType: edge, toNodeType: to }));
}

/**
 * Get all edges allowed inbound to a given node type.
 * @param {string} toNodeType
 * @returns {{ fromNodeType: string, edgeType: string }[]}
 */
export function getAllowedEdgesTo(toNodeType) {
  return EDGE_RULES
    .filter(([, , to]) => to === toNodeType)
    .map(([from, edge]) => ({ fromNodeType: from, edgeType: edge }));
}
