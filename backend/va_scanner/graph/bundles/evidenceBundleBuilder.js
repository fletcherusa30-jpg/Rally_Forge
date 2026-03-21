/**
 * Evidence Bundle Builder v2.0 — Modernized per .copilot-instructions.md
 *
 * Groups evidence by Condition from all ingested sources.
 * Computes a completenessScore (0.0–1.0) based on canonical document types.
 *
 * Completeness weights (v2.0 refined):
 *   DD214 context           0.20 (service identity, discharge status)
 *   STR events              0.35 (medical chronicity, continuity)
 *   CurrentTreatment data   0.30 (current clinical picture)
 *   RatingDecision outcome  0.15 (adjudicated determination)
 *
 * Works exclusively against the in-memory graph via graphBuilder read API.
 * All scores auditable, deterministic, schema v2.0 compliant.
 */

import crypto from 'node:crypto';
import { NODE_TYPES, EDGE_TYPES } from '../schema/veteranEvidenceGraph.schema.js';
import {
  getNodesByType,
  getEdgesTo,
  getEdgesFrom,
  getNodeById,
} from '../integration/graphBuilder.js';

const COMPLETENESS_WEIGHTS = {
  [NODE_TYPES.DD214_DOCUMENT]:             0.20,
  [NODE_TYPES.STR_DOCUMENT]:              0.35,
  [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT]: 0.30,
  [NODE_TYPES.RATING_DECISION_DOCUMENT]:   0.15,
};

const EVIDENCE_EDGE_TYPES = new Set([
  EDGE_TYPES.MENTIONS_CONDITION,
  EDGE_TYPES.GRANTS,
  EDGE_TYPES.DENIES,
  EDGE_TYPES.SHOWS_WORSENING,
]);

function _hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex').slice(0, 16);
}

function _confidenceForEdge(edgeType) {
  if (edgeType === EDGE_TYPES.GRANTS)   return 1.0;
  if (edgeType === EDGE_TYPES.DENIES)   return 0.5;
  if (edgeType === EDGE_TYPES.SHOWS_WORSENING) return 0.85;
  return 0.70;
}

function _buildBundleForConditionNode(conditionNode) {
  const condNodeId = conditionNode.nodeId;
  const condData   = conditionNode.data;

  const inboundEdges = getEdgesTo(condNodeId).filter((e) => EVIDENCE_EDGE_TYPES.has(e.edgeType));

  const evidenceItems = [];
  const coverage = {
    [NODE_TYPES.DD214_DOCUMENT]:             false,
    [NODE_TYPES.STR_DOCUMENT]:              false,
    [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT]: false,
    [NODE_TYPES.RATING_DECISION_DOCUMENT]:   false,
  };

  for (const edge of inboundEdges) {
    const sourceNode = getNodeById(edge.fromId);
    if (!sourceNode) continue;

    const docType = sourceNode.nodeType;
    if (docType in coverage) coverage[docType] = true;

    const evidenceId = _hash(`ei:${edge.fromId}:${condNodeId}`);
    evidenceItems.push({
      evidenceId,
      sourceDocumentType: docType,
      sourceDocumentId:   sourceNode.data?.documentId ?? edge.fromId,
      summary:            `${docType} references condition: ${condData.name}`,
      confidence:         _confidenceForEdge(edge.edgeType),
      tags:               [edge.edgeType, docType],
      spanLocation:       null,
    });
  }

  const completenessScore = Object.entries(COMPLETENESS_WEIGHTS)
    .reduce((sum, [docType, weight]) => sum + (coverage[docType] ? weight : 0), 0);

  const missingEvidence = Object.entries(coverage)
    .filter(([, present]) => !present)
    .map(([docType]) => {
      const labels = {
        [NODE_TYPES.DD214_DOCUMENT]:             'DD214 service context',
        [NODE_TYPES.STR_DOCUMENT]:              'STR in-service events',
        [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT]: 'Current treatment chronicity/worsening',
        [NODE_TYPES.RATING_DECISION_DOCUMENT]:   'Rating decision outcome',
      };
      return labels[docType] ?? docType;
    });

  const bundleId = _hash(`bundle:${condNodeId}`);
  return {
    bundleId,
    label:              `${condData.name} Evidence Bundle`,
    conditionId:        condData.conditionId ?? condNodeId,
    conditionName:      condData.name,
    isServiceConnected: condData.isServiceConnected ?? null,
    ratingPercent:      condData.ratingPercent ?? null,
    evidenceItems,
    evidenceCounts: {
      total:            evidenceItems.length,
      dd214:            coverage[NODE_TYPES.DD214_DOCUMENT] ? 1 : 0,
      str:              coverage[NODE_TYPES.STR_DOCUMENT] ? 1 : 0,
      currentTreatment: coverage[NODE_TYPES.CURRENT_TREATMENT_DOCUMENT] ? 1 : 0,
      ratingDecision:   coverage[NODE_TYPES.RATING_DECISION_DOCUMENT] ? 1 : 0,
    },
    completenessScore: Math.round(completenessScore * 100) / 100,
    missingEvidence,
    lastUpdated:       new Date().toISOString(),
  };
}

/**
 * Build EvidenceBundles for all known Condition nodes in the graph.
 * @returns {object[]} array of EvidenceBundle objects
 */
export function buildAllBundles() {
  return getNodesByType(NODE_TYPES.CONDITION).map(_buildBundleForConditionNode);
}

/**
 * Build an EvidenceBundle for a specific condition by name (case-insensitive).
 * Returns null when not found.
 * @param {string} conditionName
 * @returns {object|null}
 */
export function buildBundleForConditionName(conditionName) {
  const match = getNodesByType(NODE_TYPES.CONDITION).find(
    (n) => String(n.data?.name ?? '').toLowerCase() === String(conditionName ?? '').toLowerCase()
  );
  return match ? _buildBundleForConditionNode(match) : null;
}

/**
 * Build an EvidenceBundle for a specific condition by its conditionId.
 * Returns null when not found.
 * @param {string} conditionId
 * @returns {object|null}
 */
export function buildBundleForConditionId(conditionId) {
  const match = getNodesByType(NODE_TYPES.CONDITION).find(
    (n) => n.data?.conditionId === conditionId
  );
  return match ? _buildBundleForConditionNode(match) : null;
}

/**
 * Compute completeness distribution across all conditions.
 * @returns {{ total: number, averageCompleteness: number, distribution: object }}
 */
export function getBundleCompletenessReport() {
  const bundles = buildAllBundles();
  if (bundles.length === 0) {
    return { total: 0, averageCompleteness: 0, distribution: { full: 0, high: 0, partial: 0, minimal: 0 } };
  }
  const avg = bundles.reduce((s, b) => s + b.completenessScore, 0) / bundles.length;
  return {
    total:               bundles.length,
    averageCompleteness: Math.round(avg * 100) / 100,
    distribution: {
      full:    bundles.filter((b) => b.completenessScore >= 1.0).length,
      high:    bundles.filter((b) => b.completenessScore >= 0.70 && b.completenessScore < 1.0).length,
      partial: bundles.filter((b) => b.completenessScore >= 0.35 && b.completenessScore < 0.70).length,
      minimal: bundles.filter((b) => b.completenessScore < 0.35).length,
    },
  };
}
