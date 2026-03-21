/**
 * Evidence Graph API — Phase 7.
 *
 * Exposes the in-memory Veteran Evidence Graph over an Express router.
 * All routes are under /api/evidence-graph (mounted by routeManifest.js).
 *
 * Routes:
 *   GET  /status                           — node/edge counts + schema registry
 *   GET  /veteran/:veteranId/bundles       — all evidence bundles for a veteran
 *   GET  /veteran/:veteranId/timeline      — chronological service + medical timeline
 *   GET  /veteran/:veteranId/conditions    — all conditions in graph for a veteran
 *   GET  /snapshot                         — full graph snapshot (dev/debug)
 *   POST /ingest/dd214                     — ingest DD214 JSON into graph
 *   POST /ingest/str                       — ingest STR JSON into graph
 *   POST /ingest/rating-decision           — ingest rating decision into graph
 *   POST /verify/:veteranId                — run graph cross-verification
 */

import { Router } from 'express';
import {
  ingestDD214,
  ingestSTR,
  ingestRatingDecision,
  getNodesByType,
  getGraphSnapshot,
  makeNodeId,
  getEdgesFrom,
} from '../va_scanner/graph/integration/graphBuilder.js';
import { buildAllBundles, getBundleCompletenessReport }
  from '../va_scanner/graph/bundles/evidenceBundleBuilder.js';
import { graphCrossVerify }
  from '../va_scanner/graph/verification/graphCrossVerifier.js';
import { getMetricsReport }
  from '../va_scanner/graph/observability/scannerMetrics.js';
import { listAll as listRegisteredSchemas }
  from '../va_scanner/graph/registry/schemaRegistry.js';
import { NODE_TYPES, EDGE_TYPES }
  from '../va_scanner/graph/schema/veteranEvidenceGraph.schema.js';

const router = Router();

// ── Status ────────────────────────────────────────────────────────────────────

/**
 * GET /api/evidence-graph/status
 * Returns graph node/edge counts, schema registry, and bundle completeness.
 */
router.get('/status', (_req, res) => {
  const snapshot = getGraphSnapshot();
  const nodesByType = {};
  for (const n of snapshot.nodes) {
    nodesByType[n.nodeType] = (nodesByType[n.nodeType] ?? 0) + 1;
  }
  res.json({
    success: true,
    graph: {
      nodeCount:   snapshot.nodes.length,
      edgeCount:   snapshot.edges.length,
      nodesByType,
      generatedAt: snapshot.generatedAt,
    },
    schemas:           listRegisteredSchemas(),
    bundleCompleteness: getBundleCompletenessReport(),
  });
});

// ── Per-veteran ───────────────────────────────────────────────────────────────

/**
 * GET /api/evidence-graph/veteran/:veteranId/bundles
 * Returns all evidence bundles for the specified veteran's conditions.
 */
router.get('/veteran/:veteranId/bundles', (req, res) => {
  const { veteranId } = req.params;
  if (!veteranId) return res.status(400).json({ success: false, error: 'veteranId is required' });

  const allBundles    = buildAllBundles();
  const vetNodeId     = makeNodeId(NODE_TYPES.VETERAN, veteranId);
  const vetEdges      = getEdgesFrom(vetNodeId);

  // Filter bundles whose conditions are linked to this veteran's documents
  const vetCondNodeIds = new Set(
    [...vetEdges].flatMap((e) => getEdgesFrom(e.toId).map((e2) => e2.toId))
  );
  const filteredBundles = allBundles.filter((b) =>
    vetCondNodeIds.has(makeNodeId(NODE_TYPES.CONDITION, b.conditionId)) ||
    allBundles.length <= 50   // small graph: return all
  );

  res.json({
    success:    true,
    veteranId,
    count:      filteredBundles.length,
    bundles:    filteredBundles,
    completeness: getBundleCompletenessReport(),
  });
});

/**
 * GET /api/evidence-graph/veteran/:veteranId/conditions
 * Returns all condition nodes currently in the graph for a veteran.
 */
router.get('/veteran/:veteranId/conditions', (req, res) => {
  const { veteranId } = req.params;
  if (!veteranId) return res.status(400).json({ success: false, error: 'veteranId is required' });

  const conditions = getNodesByType(NODE_TYPES.CONDITION).map((n) => ({
    conditionId:      n.data.conditionId,
    name:             n.data.name,
    isServiceConnected: n.data.isServiceConnected ?? null,
    ratingPercent:    n.data.ratingPercent ?? null,
    onsetDate:        n.data.onsetDate ?? null,
    bodySystem:       n.data.bodySystem ?? null,
  }));

  res.json({
    success:    true,
    veteranId,
    count:      conditions.length,
    conditions,
  });
});

/**
 * GET /api/evidence-graph/veteran/:veteranId/timeline
 * Returns a chronological service + medical timeline for a veteran.
 */
router.get('/veteran/:veteranId/timeline', (req, res) => {
  const { veteranId } = req.params;
  if (!veteranId) return res.status(400).json({ success: false, error: 'veteranId is required' });

  const vetNodeId = makeNodeId(NODE_TYPES.VETERAN, veteranId);
  const edges     = getEdgesFrom(vetNodeId);

  const events = [];

  for (const edge of edges) {
    if (edge.edgeType === EDGE_TYPES.HAS_SERVICE_PERIOD) {
      const spEdge = edge;
      // Pull ServicePeriod data inline to avoid circular import
      const snapshot = getGraphSnapshot();
      const spNode   = snapshot.nodes.find((n) => n.nodeId === spEdge.toId);
      if (spNode) {
        events.push({
          type:   'ServicePeriod',
          date:   spNode.data.startDate,
          endDate: spNode.data.endDate,
          label:  `Service: ${spNode.data.branchOfService ?? 'Unknown branch'} (${spNode.data.startDate ?? '?'} – ${spNode.data.endDate ?? '?'})`,
          data:   spNode.data,
        });
      }
    }
  }

  // Add STR diagnoses + treatments
  const strEdges = edges.filter((e) => e.edgeType === EDGE_TYPES.HAS_STR);
  for (const strEdge of strEdges) {
    const strSubEdges = getEdgesFrom(strEdge.toId);
    const snapshot    = getGraphSnapshot();
    for (const sub of strSubEdges) {
      const node = snapshot.nodes.find((n) => n.nodeId === sub.toId);
      if (!node) continue;
      if (sub.edgeType === EDGE_TYPES.SHOWS_DIAGNOSIS || sub.edgeType === EDGE_TYPES.SHOWS_TREATMENT) {
        events.push({
          type:   node.nodeType,
          date:   node.data.date ?? null,
          label:  `${node.nodeType}: ${node.data.name ?? node.data.description ?? 'Unknown'}`,
          data:   node.data,
        });
      }
    }
  }

  events.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  res.json({
    success:    true,
    veteranId,
    count:      events.length,
    timeline:   events,
  });
});

// ── Snapshot (dev/debug) ──────────────────────────────────────────────────────

/**
 * GET /api/evidence-graph/snapshot
 * Full graph dump for debugging. Should not be exposed in production.
 */
router.get('/snapshot', (_req, res) => {
  const snapshot = getGraphSnapshot();
  res.json({ success: true, ...snapshot });
});

/**
 * GET /api/evidence-graph/metrics
 * Returns scanner metrics report.
 */
router.get('/metrics', (_req, res) => {
  res.json({ success: true, ...getMetricsReport() });
});

// ── Ingest ────────────────────────────────────────────────────────────────────

/**
 * POST /api/evidence-graph/ingest/dd214
 * Body: { veteranId: string, dd214Data: object }
 */
router.post('/ingest/dd214', (req, res) => {
  const { veteranId, dd214Data } = req.body ?? {};
  if (!veteranId || !dd214Data) {
    return res.status(400).json({ success: false, error: 'veteranId and dd214Data are required' });
  }
  if (typeof dd214Data !== 'object' || Array.isArray(dd214Data)) {
    return res.status(400).json({ success: false, error: 'dd214Data must be a JSON object' });
  }

  try {
    const result = ingestDD214(veteranId, dd214Data);
    res.json({
      success:     true,
      veteranId,
      nodesCreated: Object.keys(result.nodeIds).length,
      edgesCreated: result.edgeKeys.length,
      nodeIds:     result.nodeIds,
    });
  } catch (err) {
    console.error('[EvidenceGraph] DD214 ingest error:', err.message);
    res.status(500).json({ success: false, error: 'DD214 ingest failed', message: err.message });
  }
});

/**
 * POST /api/evidence-graph/ingest/str
 * Body: { veteranId: string, strData: object }
 */
router.post('/ingest/str', (req, res) => {
  const { veteranId, strData } = req.body ?? {};
  if (!veteranId || !strData) {
    return res.status(400).json({ success: false, error: 'veteranId and strData are required' });
  }
  if (typeof strData !== 'object' || Array.isArray(strData)) {
    return res.status(400).json({ success: false, error: 'strData must be a JSON object' });
  }

  try {
    const result = ingestSTR(veteranId, strData);
    res.json({
      success:     true,
      veteranId,
      nodesCreated: Object.keys(result.nodeIds).length,
      edgesCreated: result.edgeKeys.length,
      nodeIds:     result.nodeIds,
    });
  } catch (err) {
    console.error('[EvidenceGraph] STR ingest error:', err.message);
    res.status(500).json({ success: false, error: 'STR ingest failed', message: err.message });
  }
});

/**
 * POST /api/evidence-graph/ingest/rating-decision
 * Body: { veteranId: string, rdData: object }
 */
router.post('/ingest/rating-decision', (req, res) => {
  const { veteranId, rdData } = req.body ?? {};
  if (!veteranId || !rdData) {
    return res.status(400).json({ success: false, error: 'veteranId and rdData are required' });
  }
  if (typeof rdData !== 'object' || Array.isArray(rdData)) {
    return res.status(400).json({ success: false, error: 'rdData must be a JSON object' });
  }

  try {
    const result = ingestRatingDecision(veteranId, rdData);
    res.json({
      success:     true,
      veteranId,
      nodesCreated: Object.keys(result.nodeIds).length,
      edgesCreated: result.edgeKeys.length,
      nodeIds:     result.nodeIds,
    });
  } catch (err) {
    console.error('[EvidenceGraph] RatingDecision ingest error:', err.message);
    res.status(500).json({ success: false, error: 'RatingDecision ingest failed', message: err.message });
  }
});

// ── Verification ──────────────────────────────────────────────────────────────

/**
 * POST /api/evidence-graph/verify/:veteranId
 * Runs graph-aware cross-verification and returns VerificationResult.
 * Optional query: ?inferredConnections=true
 */
router.post('/verify/:veteranId', (req, res) => {
  const { veteranId } = req.params;
  const includeInferred = req.query.inferredConnections === 'true';

  if (!veteranId) {
    return res.status(400).json({ success: false, error: 'veteranId is required' });
  }

  try {
    const result = graphCrossVerify(veteranId, { includeInferredConnections: includeInferred });
    res.json({ success: true, veteranId, result });
  } catch (err) {
    console.error('[EvidenceGraph] Cross-verify error:', err.message);
    res.status(500).json({ success: false, error: 'Cross-verification failed', message: err.message });
  }
});

export default router;
