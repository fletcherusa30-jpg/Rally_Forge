/**
 * AI Insight Manager — Phase 5.
 *
 * Provides a strictly bounded framework for AI-assisted insights on the Evidence Graph.
 *
 * Rules (enforced in code):
 *   - AI may PROPOSE new Insight/Suggestion nodes. It may NOT alter existing nodes.
 *   - All AI outputs are stored as separate Insight or Suggestion nodes, permanently tagged with
 *     { model, timestamp, confidence, scope }.
 *   - AI-proposed relationships are always marked inferred: true.
 *   - Deterministic graph data is never overwritten by AI results.
 *   - AI invocation is asynchronous and configurable — when no handler is registered,
 *     all calls degrade gracefully and return empty results.
 *
 * Usage:
 *   registerAiHandler(handler)  — plug in your LLM/AI function
 *   generateConditionInsight(veteranId, conditionId, opts) → Insight node
 *   generateMissingEvidenceSuggestion(veteranId, bundleId, opts) → Suggestion node
 *   listInsights(veteranId) → Insight[]
 *   listSuggestions(veteranId) → Suggestion[]
 */

import crypto from 'node:crypto';
import { NODE_TYPES, EDGE_TYPES } from '../schema/veteranEvidenceGraph.schema.js';
import {
  makeNodeId,
  upsertNode,
  upsertEdge,
  getNodesByType,
  getEdgesFrom,
  getNodeById,
} from '../integration/graphBuilder.js';
import { buildBundleForConditionId } from '../bundles/evidenceBundleBuilder.js';

let _aiHandler = null;

function _hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex').slice(0, 16);
}

/**
 * Register an AI handler function.
 * The handler receives a prompt object and must return a string (the AI's response).
 *
 * Handler signature:
 *   async handler({ type, context }) → string
 *
 * @param {Function} handler
 */
export function registerAiHandler(handler) {
  if (typeof handler !== 'function') {
    throw new TypeError('AI handler must be a function');
  }
  _aiHandler = handler;
}

/**
 * Remove the registered AI handler (disables AI features).
 */
export function clearAiHandler() {
  _aiHandler = null;
}

/**
 * Returns true when an AI handler is registered.
 * @returns {boolean}
 */
export function isAiAvailable() {
  return _aiHandler !== null;
}

function _buildBaseInsightNode({ type, model, scope, confidence, content, appliesTo }) {
  const id = _hash(`insight:${type}:${scope}:${Date.now()}`);
  return {
    insightId:  id,
    type,
    model,
    timestamp:  new Date().toISOString(),
    confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
    scope,
    content,
    appliesTo,
    inferred:   true,
  };
}

function _buildBaseSuggestionNode({ type, model, scope, confidence, content, appliesTo }) {
  const id = _hash(`suggestion:${type}:${scope}:${Date.now()}`);
  return {
    suggestionId: id,
    type,
    model,
    timestamp:    new Date().toISOString(),
    confidence:   Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
    scope,
    content,
    appliesTo,
    inferred:     true,
  };
}

/**
 * Generate an AI insight summarizing the evidence bundle for a condition.
 * Stores the result as an Insight node linked to the Condition node.
 *
 * @param {string} veteranId
 * @param {string} conditionId
 * @param {{ model?: string }} opts
 * @returns {Promise<object|null>} Insight node data, or null when AI is unavailable
 */
export async function generateConditionInsight(veteranId, conditionId, { model = 'not-configured' } = {}) {
  if (!isAiAvailable()) {
    console.log('[AIInsightManager] No AI handler registered — condition insight skipped.');
    return null;
  }

  const bundle = buildBundleForConditionId(conditionId);
  if (!bundle) {
    console.warn(`[AIInsightManager] No bundle found for conditionId: ${conditionId}`);
    return null;
  }

  const prompt = {
    type:    'condition-summary',
    context: {
      conditionName:      bundle.conditionName,
      isServiceConnected: bundle.isServiceConnected,
      ratingPercent:      bundle.ratingPercent,
      completenessScore:  bundle.completenessScore,
      missingEvidence:    bundle.missingEvidence,
      evidenceCounts:     bundle.evidenceCounts,
    },
  };

  let content;
  try {
    content = await _aiHandler(prompt);
  } catch (err) {
    console.error('[AIInsightManager] AI handler error during condition insight:', err.message);
    return null;
  }

  const node = _buildBaseInsightNode({
    type:       'condition-summary',
    model,
    scope:      `condition:${conditionId}`,
    confidence: 0.6,
    content:    String(content ?? ''),
    appliesTo:  { veteranId, conditionId },
  });

  const nodeId   = makeNodeId(NODE_TYPES.INSIGHT, node.insightId);
  const condNodeId = makeNodeId(NODE_TYPES.CONDITION, conditionId);
  upsertNode(nodeId, NODE_TYPES.INSIGHT, node);
  upsertEdge(condNodeId, EDGE_TYPES.HAS_INSIGHT, nodeId);

  console.log(`[AIInsightManager] Insight ${node.insightId} stored for condition ${conditionId}`);
  return node;
}

/**
 * Generate an AI suggestion for missing evidence in a bundle.
 * Stores the result as a Suggestion node linked to the Condition node.
 *
 * @param {string} veteranId
 * @param {string} conditionId
 * @param {{ model?: string }} opts
 * @returns {Promise<object|null>} Suggestion node data, or null when AI is unavailable
 */
export async function generateMissingEvidenceSuggestion(veteranId, conditionId, { model = 'not-configured' } = {}) {
  if (!isAiAvailable()) {
    console.log('[AIInsightManager] No AI handler registered — suggestion skipped.');
    return null;
  }

  const bundle = buildBundleForConditionId(conditionId);
  if (!bundle || bundle.missingEvidence.length === 0) return null;

  const prompt = {
    type:    'missing-evidence-suggestion',
    context: {
      conditionName:   bundle.conditionName,
      missingEvidence: bundle.missingEvidence,
      evidenceCounts:  bundle.evidenceCounts,
    },
  };

  let content;
  try {
    content = await _aiHandler(prompt);
  } catch (err) {
    console.error('[AIInsightManager] AI handler error during suggestion:', err.message);
    return null;
  }

  const node = _buildBaseSuggestionNode({
    type:       'missing-evidence-suggestion',
    model,
    scope:      `condition:${conditionId}`,
    confidence: 0.5,
    content:    String(content ?? ''),
    appliesTo:  { veteranId, conditionId, missingEvidence: bundle.missingEvidence },
  });

  const nodeId    = makeNodeId(NODE_TYPES.SUGGESTION, node.suggestionId);
  const condNodeId = makeNodeId(NODE_TYPES.CONDITION, conditionId);
  upsertNode(nodeId, NODE_TYPES.SUGGESTION, node);
  upsertEdge(condNodeId, EDGE_TYPES.HAS_INSIGHT, nodeId);

  console.log(`[AIInsightManager] Suggestion ${node.suggestionId} stored for condition ${conditionId}`);
  return node;
}

/**
 * List all Insight nodes in the graph (optionally filtered by veteranId).
 * @param {string} [veteranId]
 * @returns {object[]}
 */
export function listInsights(veteranId) {
  const all = getNodesByType(NODE_TYPES.INSIGHT);
  if (!veteranId) return all.map((n) => n.data);
  return all.filter((n) => n.data?.appliesTo?.veteranId === veteranId).map((n) => n.data);
}

/**
 * List all Suggestion nodes in the graph (optionally filtered by veteranId).
 * @param {string} [veteranId]
 * @returns {object[]}
 */
export function listSuggestions(veteranId) {
  const all = getNodesByType(NODE_TYPES.SUGGESTION);
  if (!veteranId) return all.map((n) => n.data);
  return all.filter((n) => n.data?.appliesTo?.veteranId === veteranId).map((n) => n.data);
}
