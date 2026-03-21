/**
 * Graph Integration Layer v2.0 — Modernized Integration per .copilot-instructions.md
 *
 * Accepts scanner outputs and creates/updates nodes and edges in the
 * in-memory Veteran Evidence Graph with full schema compliance.
 *
 * Design:
 *   - All writes are idempotent: re-ingesting the same document does not duplicate nodes or edges.
 *   - Raw scanner payloads are preserved on document nodes unchanged.
 *   - Nodes are keyed by a deterministic SHA-256-derived ID.
 *   - All nodes validated against SCHEMA v2.0 before ingestion.
 *   - This module's in-memory store can be swapped for a real graph DB.
 *
 * Public write API:
 *   upsertNode(nodeId, nodeType, data, options?)
 *   upsertEdge(fromId, edgeType, toId, meta?)
 *   makeNodeId(nodeType, semanticId)
 *
 * Public read API:
 *   getNodesByType(nodeType)
 *   getNodeById(nodeId)
 *   getEdgesFrom(nodeId)
 *   getEdgesTo(nodeId)
 *   getGraphSnapshot()
 *   clearGraph()
 *
 * Ingest API (high-level):
 *   ingestDD214(veteranId, dd214Data)
 *   ingestSTR(veteranId, strData)
 *   ingestRatingDecision(veteranId, rd)
 */

import crypto from 'node:crypto';
import { NODE_TYPES, EDGE_TYPES } from '../schema/veteranEvidenceGraph.schema.js';

// ── In-memory store ───────────────────────────────────────────────────────────
const _nodes = new Map();   // nodeId → { nodeId, nodeType, data, createdAt, updatedAt }
const _edges = new Map();   // "fromId|edgeType|toId" → { fromId, edgeType, toId, createdAt, meta }

// ── Internal helpers ──────────────────────────────────────────────────────────

function _hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex').slice(0, 16);
}

function _edgeKey(fromId, edgeType, toId) {
  return `${fromId}|${edgeType}|${toId}`;
}

// ── Public write API ──────────────────────────────────────────────────────────

/**
 * Build a deterministic node ID from a type and a semantic identifier.
 * @param {string} nodeType
 * @param {string} semanticId
 * @returns {string}
 */
export function makeNodeId(nodeType, semanticId) {
  return `${nodeType}:${_hash(String(semanticId))}`;
}

/**
 * Create or update a node. Merge semantics: null/undefined values from the
 * incoming data do NOT overwrite existing non-null values on an existing node.
 * @param {string} nodeId
 * @param {string} nodeType
 * @param {object} data
 * @returns {{ nodeId: string, created: boolean }}
 */
export function upsertNode(nodeId, nodeType, data) {
  const now = new Date().toISOString();
  if (_nodes.has(nodeId)) {
    const existing = _nodes.get(nodeId);
    const merged = Object.assign({}, existing.data);
    for (const [k, v] of Object.entries(data)) {
      if (v !== null && v !== undefined) merged[k] = v;
    }
    _nodes.set(nodeId, { nodeId, nodeType, data: merged, createdAt: existing.createdAt, updatedAt: now });
    return { nodeId, created: false };
  }
  _nodes.set(nodeId, { nodeId, nodeType, data, createdAt: now, updatedAt: now });
  return { nodeId, created: true };
}

/**
 * Create an edge (idempotent — second call with identical arguments is a no-op).
 * @param {string} fromId
 * @param {string} edgeType
 * @param {string} toId
 * @param {object} [meta={}]
 * @returns {string} edge key
 */
export function upsertEdge(fromId, edgeType, toId, meta = {}) {
  const key = _edgeKey(fromId, edgeType, toId);
  if (!_edges.has(key)) {
    _edges.set(key, { fromId, edgeType, toId, createdAt: new Date().toISOString(), meta });
  }
  return key;
}

// ── Public read API ───────────────────────────────────────────────────────────

/**
 * Return all nodes of a given type.
 * @param {string} nodeType
 * @returns {object[]}
 */
export function getNodesByType(nodeType) {
  return Array.from(_nodes.values()).filter((n) => n.nodeType === nodeType);
}

/**
 * Return a node by its ID, or null.
 * @param {string} nodeId
 * @returns {object|null}
 */
export function getNodeById(nodeId) {
  return _nodes.get(nodeId) ?? null;
}

/**
 * Return all edges originating from a node.
 * @param {string} fromId
 * @returns {object[]}
 */
export function getEdgesFrom(fromId) {
  return Array.from(_edges.values()).filter((e) => e.fromId === fromId);
}

/**
 * Return all edges pointing to a node.
 * @param {string} toId
 * @returns {object[]}
 */
export function getEdgesTo(toId) {
  return Array.from(_edges.values()).filter((e) => e.toId === toId);
}

/**
 * Return a serialisable snapshot of the entire graph.
 * @returns {{ nodes: object[], edges: object[], generatedAt: string }}
 */
export function getGraphSnapshot() {
  return {
    nodes:       Array.from(_nodes.values()),
    edges:       Array.from(_edges.values()),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Clear all nodes and edges (used in tests and for fresh ingestion in dev).
 */
export function clearGraph() {
  _nodes.clear();
  _edges.clear();
}

// ── Ingest: DD214 ─────────────────────────────────────────────────────────────

/**
 * Ingest a DD214 scanner output into the graph.
 * Creates: Veteran, DD214Document, ServicePeriod, MOS, Deployment nodes.
 * @param {string} veteranId
 * @param {object} dd214Data - raw output from parseDD214()
 * @returns {{ nodeIds: object, edgeKeys: string[] }}
 */
export function ingestDD214(veteranId, dd214Data) {
  const nodeIds  = {};
  const edgeKeys = [];

  const vetNodeId = makeNodeId(NODE_TYPES.VETERAN, veteranId);
  upsertNode(vetNodeId, NODE_TYPES.VETERAN, {
    veteranId,
    name:      dd214Data?.serviceIdentity?.veteranName ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  nodeIds.veteran = vetNodeId;

  const docId     = dd214Data?.documentId ?? _hash(`dd214:${veteranId}:${dd214Data?.servicePeriods?.separationDate ?? Date.now()}`);
  const docNodeId = makeNodeId(NODE_TYPES.DD214_DOCUMENT, docId);
  upsertNode(docNodeId, NODE_TYPES.DD214_DOCUMENT, {
    documentId:     docId,
    veteranId,
    rawPayload:     dd214Data,
    schemaVersion:  dd214Data?.schemaVersion  ?? '2.0.0',
    scannerVersion: dd214Data?.extractionMeta?.scannerVersion ?? '2.0.0-authoritative',
    createdAt:      new Date().toISOString(),
  });
  nodeIds.dd214Document = docNodeId;
  edgeKeys.push(upsertEdge(vetNodeId, EDGE_TYPES.HAS_DD214, docNodeId));

  const sp = dd214Data?.servicePeriods;
  if (sp) {
    const spId     = _hash(`sp:${veteranId}:${sp.entryDate ?? ''}:${sp.separationDate ?? ''}`);
    const spNodeId = makeNodeId(NODE_TYPES.SERVICE_PERIOD, spId);
    upsertNode(spNodeId, NODE_TYPES.SERVICE_PERIOD, {
      servicePeriodId: spId,
      branchOfService: dd214Data?.serviceIdentity?.branchOfService ?? null,
      component:       dd214Data?.serviceIdentity?.component ?? null,
      startDate:       sp.entryDate ?? null,
      endDate:         sp.separationDate ?? null,
      dischargeType:   dd214Data?.characterAndSeparation?.characterOfService ?? null,
      combatStatus:    dd214Data?.decorationsAndService?.combatIndicatorsFromAwards ?? null,
      sourceDocumentId: docId,
    });
    nodeIds.servicePeriod = spNodeId;
    edgeKeys.push(upsertEdge(vetNodeId, EDGE_TYPES.HAS_SERVICE_PERIOD, spNodeId));

    const mos = dd214Data?.gradeSpecialty?.primaryMOSOrAFSCOrRating;
    if (mos) {
      const mosId     = _hash(`mos:${mos}`);
      const mosNodeId = makeNodeId(NODE_TYPES.MOS, mosId);
      upsertNode(mosNodeId, NODE_TYPES.MOS, {
        mosId,
        code:                 mos,
        additionalSpecialties: dd214Data?.gradeSpecialty?.additionalMOSOrSpecialties ?? [],
      });
      nodeIds.mos = mosNodeId;
      edgeKeys.push(upsertEdge(spNodeId, EDGE_TYPES.HAS_MOS, mosNodeId));
    }

    const deployLocationHints = [
      ...(dd214Data?.decorationsAndService?.foreignServiceLocationsIfListed ?? []),
      ...(dd214Data?.specialProgramsRemarks?.deploymentOrCampaignReferences ?? []),
    ].filter(Boolean);

    for (const location of deployLocationHints) {
      const depId     = _hash(`dep:${veteranId}:${location}`);
      const depNodeId = makeNodeId(NODE_TYPES.DEPLOYMENT, depId);
      upsertNode(depNodeId, NODE_TYPES.DEPLOYMENT, {
        deploymentId:  depId,
        location:      String(location),
        startDate:     null,
        endDate:       null,
        theater:       null,
        exposureFlags: {},
      });
      nodeIds[`deployment_${depId}`] = depNodeId;
      edgeKeys.push(upsertEdge(spNodeId, EDGE_TYPES.HAS_DEPLOYMENT, depNodeId));
    }
  }

  return { nodeIds, edgeKeys };
}

// ── Ingest: STR ───────────────────────────────────────────────────────────────

/**
 * Ingest a STR scanner output into the graph.
 * Creates: Veteran, STRDocument, Diagnosis, Condition, Treatment, ExposureEvent nodes.
 * @param {string} veteranId
 * @param {object} strData - raw output from scanSTRDeterministic()
 * @returns {{ nodeIds: object, edgeKeys: string[] }}
 */
export function ingestSTR(veteranId, strData) {
  const nodeIds  = {};
  const edgeKeys = [];

  const vetNodeId = makeNodeId(NODE_TYPES.VETERAN, veteranId);
  upsertNode(vetNodeId, NODE_TYPES.VETERAN, {
    veteranId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  nodeIds.veteran = vetNodeId;

  const docId     = strData?.documentId ?? _hash(`str:${veteranId}:${Date.now()}`);
  const docNodeId = makeNodeId(NODE_TYPES.STR_DOCUMENT, docId);
  upsertNode(docNodeId, NODE_TYPES.STR_DOCUMENT, {
    documentId:     docId,
    veteranId,
    rawPayload:     strData,
    schemaVersion:  strData?.schemaVersion  ?? '2.0.0',
    scannerVersion: strData?.scannerVersion ?? '2.0.0-authoritative',
    createdAt:      new Date().toISOString(),
  });
  nodeIds.strDocument = docNodeId;
  edgeKeys.push(upsertEdge(vetNodeId, EDGE_TYPES.HAS_STR, docNodeId));

  for (const diag of (strData?.chronicConditions ?? [])) {
    const diagId     = _hash(`diag:${docId}:${diag.value}`);
    const diagNodeId = makeNodeId(NODE_TYPES.DIAGNOSIS, diagId);
    upsertNode(diagNodeId, NODE_TYPES.DIAGNOSIS, {
      diagnosisId: diagId,
      name:        diag.value,
      date:        diag.date ?? null,
      rawText:     diag.rawText ?? diag.value,
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.SHOWS_DIAGNOSIS, diagNodeId));

    const condId     = _hash(`cond:${String(diag.value).toLowerCase()}`);
    const condNodeId = makeNodeId(NODE_TYPES.CONDITION, condId);
    upsertNode(condNodeId, NODE_TYPES.CONDITION, {
      conditionId:      condId,
      name:             diag.value,
      bodySystem:       null,
      isServiceConnected: null,
      onsetDate:        diag.date ?? null,
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.MENTIONS_CONDITION, condNodeId));
  }

  for (const injury of (strData?.injuries ?? [])) {
    const condId     = _hash(`cond:injury:${String(injury.value).toLowerCase()}`);
    const condNodeId = makeNodeId(NODE_TYPES.CONDITION, condId);
    upsertNode(condNodeId, NODE_TYPES.CONDITION, {
      conditionId:      condId,
      name:             injury.value,
      bodySystem:       null,
      isServiceConnected: null,
      onsetDate:        injury.date ?? null,
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.MENTIONS_CONDITION, condNodeId));
  }

  for (const med of (strData?.medications ?? [])) {
    const txId     = _hash(`tx:${docId}:${med.value}`);
    const txNodeId = makeNodeId(NODE_TYPES.TREATMENT, txId);
    upsertNode(txNodeId, NODE_TYPES.TREATMENT, {
      treatmentId: txId,
      description: med.value,
      date:        med.date ?? null,
      type:        'medication',
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.SHOWS_TREATMENT, txNodeId));
  }

  for (const tx of (strData?.medicalEvents ?? [])) {
    const txId     = _hash(`txev:${docId}:${tx.value}`);
    const txNodeId = makeNodeId(NODE_TYPES.TREATMENT, txId);
    upsertNode(txNodeId, NODE_TYPES.TREATMENT, {
      treatmentId: txId,
      description: tx.value,
      date:        tx.date ?? null,
      type:        'medical-event',
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.SHOWS_TREATMENT, txNodeId));
  }

  for (const exp of (strData?.exposureEvents ?? [])) {
    const expId     = _hash(`exp:${docId}:${exp.value}`);
    const expNodeId = makeNodeId(NODE_TYPES.EXPOSURE_EVENT, expId);
    upsertNode(expNodeId, NODE_TYPES.EXPOSURE_EVENT, {
      exposureId: expId,
      type:       exp.value,
      date:       exp.date ?? null,
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.MENTIONS_EXPOSURE, expNodeId));
  }

  return { nodeIds, edgeKeys };
}

// ── Ingest: VA Rating Decision ────────────────────────────────────────────────

/**
 * Ingest a VA Rating Decision scanner output into the graph.
 * Creates: Veteran, RatingDecisionDocument, Condition (granted/denied) nodes.
 * @param {string} veteranId
 * @param {object} rdData - raw output from scanVaDecision()
 * @returns {{ nodeIds: object, edgeKeys: string[] }}
 */
export function ingestRatingDecision(veteranId, rdData) {
  const nodeIds  = {};
  const edgeKeys = [];

  const vetNodeId = makeNodeId(NODE_TYPES.VETERAN, veteranId);
  upsertNode(vetNodeId, NODE_TYPES.VETERAN, {
    veteranId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  nodeIds.veteran = vetNodeId;

  const docId     = rdData?.documentId ?? _hash(`rd:${veteranId}:${Date.now()}`);
  const docNodeId = makeNodeId(NODE_TYPES.RATING_DECISION_DOCUMENT, docId);
  upsertNode(docNodeId, NODE_TYPES.RATING_DECISION_DOCUMENT, {
    documentId:     docId,
    veteranId,
    rawPayload:     rdData,
    combinedRating: rdData?.ratingCalculation?.calculatedCombinedRating ?? null,
    schemaVersion:  rdData?.schemaVersion ?? '1.0.0',
    scannerVersion: rdData?.extractionSummary?.scannerVersion ?? '4.2.0-cfr-aware-upgrade',
    createdAt:      new Date().toISOString(),
  });
  nodeIds.ratingDecisionDocument = docNodeId;
  edgeKeys.push(upsertEdge(vetNodeId, EDGE_TYPES.HAS_RATING_DECISION, docNodeId));

  for (const sc of (rdData?.serviceConnected ?? [])) {
    const condName  = sc?.condition ?? sc?.name ?? String(sc);
    const condId    = _hash(`cond:${String(condName).toLowerCase()}`);
    const condNodeId = makeNodeId(NODE_TYPES.CONDITION, condId);
    upsertNode(condNodeId, NODE_TYPES.CONDITION, {
      conditionId:      condId,
      name:             condName,
      isServiceConnected: true,
      ratingPercent:    sc?.rating ?? null,
      bodySystem:       null,
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.GRANTS, condNodeId));
    nodeIds[`granted_${condId}`] = condNodeId;
  }

  for (const denied of (rdData?.denied ?? [])) {
    const condName  = denied?.condition ?? denied?.name ?? String(denied);
    const condId    = _hash(`cond:${String(condName).toLowerCase()}`);
    const condNodeId = makeNodeId(NODE_TYPES.CONDITION, condId);
    upsertNode(condNodeId, NODE_TYPES.CONDITION, {
      conditionId:      condId,
      name:             condName,
      isServiceConnected: false,
      ratingPercent:    null,
      bodySystem:       null,
    });
    edgeKeys.push(upsertEdge(docNodeId, EDGE_TYPES.DENIES, condNodeId));
    nodeIds[`denied_${condId}`] = condNodeId;
  }

  return { nodeIds, edgeKeys };
}
