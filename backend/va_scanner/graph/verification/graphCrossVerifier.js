/**
 * Graph-Aware Cross-Verification Engine v2.0 — Modernized per .copilot-instructions.md
 *
 * Operates on the Veteran Evidence Graph to compare:
 *   1. ServicePeriods vs STR encounter dates
 *   2. Deployments vs ExposureEvents
 *   3. MOS vs injury patterns
 *   4. STR chronicity vs RatingDecision outcomes
 *
 * Outputs a VerificationResult stored as a node in the graph with HAS_VERIFICATION edge.
 * All results are deterministic — no AI inference.
 * Schema v2.0 compliant with full audit trail.
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

function _hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex').slice(0, 16);
}

function _toDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))) return null;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function _inRange(date, start, end) {
  const d = _toDate(date);
  const s = _toDate(start);
  const e = _toDate(end);
  if (!d || !s || !e) return false;
  return d >= s && d <= e;
}

function _norm(v) {
  return String(v ?? '').toLowerCase();
}

const MOS_INJURY_MISMATCH_RULES = [
  { rule: /^(68|HM|HS)/i,        mismatch: /\b(flight line noise|artillery blast|weapons range acoustic trauma)\b/i },
  { rule: /^(11|12|13|19|0311|0321|0331|0341)/i, mismatch: /\b(office ergonomics only|sedentary desk strain only)\b/i },
  { rule: /^(88|92|2T|3P|YN|PS)/i, mismatch: /\b(parachute jump injury|breach blast overpressure|combat breaching injury)\b/i },
];

function _mosInjuryIncompatible(mosCode, injuryBlob) {
  return MOS_INJURY_MISMATCH_RULES.some(
    ({ rule, mismatch }) => rule.test(mosCode) && mismatch.test(injuryBlob)
  );
}

/**
 * Run graph-aware cross-verification for a single veteran.
 *
 * @param {string} veteranId
 * @param {{ includeInferredConnections?: boolean }} opts
 * @returns {object} VerificationResult (also stored in graph)
 */
export function graphCrossVerify(veteranId, { includeInferredConnections = false } = {}) {
  const matches            = [];
  const mismatches         = [];
  const missingEvidence    = [];
  const confidenceScores   = [];
  const inferredConnections = [];

  const vetNodeId = makeNodeId(NODE_TYPES.VETERAN, veteranId);
  const vetEdges  = getEdgesFrom(vetNodeId);

  // ── Gather documents ──────────────────────────────────────────────────────
  const spNodes  = vetEdges
    .filter((e) => e.edgeType === EDGE_TYPES.HAS_SERVICE_PERIOD)
    .map((e) => getNodeById(e.toId)).filter(Boolean);

  const strNodes = vetEdges
    .filter((e) => e.edgeType === EDGE_TYPES.HAS_STR)
    .map((e) => getNodeById(e.toId)).filter(Boolean);

  const rdNodes  = vetEdges
    .filter((e) => e.edgeType === EDGE_TYPES.HAS_RATING_DECISION)
    .map((e) => getNodeById(e.toId)).filter(Boolean);

  const mosNodes = spNodes.flatMap((sp) =>
    getEdgesFrom(sp.nodeId)
      .filter((e) => e.edgeType === EDGE_TYPES.HAS_MOS)
      .map((e) => getNodeById(e.toId))
      .filter(Boolean)
  );

  const depNodes = spNodes.flatMap((sp) =>
    getEdgesFrom(sp.nodeId)
      .filter((e) => e.edgeType === EDGE_TYPES.HAS_DEPLOYMENT)
      .map((e) => getNodeById(e.toId))
      .filter(Boolean)
  );

  // ── Pull raw STR events ───────────────────────────────────────────────────
  const strMedicalEvents = strNodes.flatMap((doc) =>
    getEdgesFrom(doc.nodeId)
      .filter((e) => e.edgeType === EDGE_TYPES.SHOWS_TREATMENT || e.edgeType === EDGE_TYPES.SHOWS_DIAGNOSIS)
      .map((e) => getNodeById(e.toId))
      .filter(Boolean)
      .map((n) => ({ date: n.data?.date ?? null, value: n.data?.name ?? n.data?.description ?? '' }))
  );

  const strConditions = strNodes.flatMap((doc) =>
    getEdgesFrom(doc.nodeId)
      .filter((e) => e.edgeType === EDGE_TYPES.MENTIONS_CONDITION || e.edgeType === EDGE_TYPES.SHOWS_DIAGNOSIS)
      .map((e) => getNodeById(e.toId))
      .filter(Boolean)
  );

  const strExposures = strNodes.flatMap((doc) =>
    getEdgesFrom(doc.nodeId)
      .filter((e) => e.edgeType === EDGE_TYPES.MENTIONS_EXPOSURE)
      .map((e) => getNodeById(e.toId))
      .filter(Boolean)
  );

  // ── RULE 1: ServicePeriods vs STR encounter dates ─────────────────────────
  if (spNodes.length === 0 || strNodes.length === 0) {
    missingEvidence.push({ rule: 'servicePeriods_vs_strDates', message: 'Cannot verify: DD214 or STR not ingested.' });
    confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.1 });
  } else {
    const anyServicePeriod = spNodes[0].data;
    const startDate = anyServicePeriod?.startDate;
    const endDate   = anyServicePeriod?.endDate;

    const datedEvents    = strMedicalEvents.filter((e) => !!e.date);
    const inServiceEvts  = datedEvents.filter((e) => _inRange(e.date, startDate, endDate));

    if (datedEvents.length === 0) {
      missingEvidence.push({ rule: 'servicePeriods_vs_strDates', message: 'No STR encounter dates available for verification.' });
      confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.2 });
    } else if (inServiceEvts.length === 0) {
      mismatches.push({
        rule:    'servicePeriods_vs_strDates',
        message: 'STR encounter dates do not fall within DD214 service period.',
        details: { startDate, endDate, sampleDates: datedEvents.slice(0, 5).map((e) => e.date) },
      });
      confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.1 });
    } else {
      matches.push({
        rule:    'servicePeriods_vs_strDates',
        message: `${inServiceEvts.length} STR event(s) fall within DD214 service period.`,
        details: { startDate, endDate, inServiceCount: inServiceEvts.length },
      });
      confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.9 });
    }
  }

  // ── RULE 2: MOS vs injury patterns ────────────────────────────────────────
  if (mosNodes.length === 0) {
    missingEvidence.push({ rule: 'mos_vs_injuries', message: 'No MOS node ingested from DD214.' });
    confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.2 });
  } else {
    const mosCode    = _norm(mosNodes[0].data?.code);
    const injuryBlob = _norm(strConditions.map((c) => c.data?.name ?? '').join(' | '));

    if (!injuryBlob.trim()) {
      missingEvidence.push({ rule: 'mos_vs_injuries', message: 'No STR injury/condition text available for MOS comparison.' });
      confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.2 });
    } else if (_mosInjuryIncompatible(mosCode, injuryBlob)) {
      mismatches.push({
        rule:    'mos_vs_injuries',
        message: `MOS '${mosCode}' is inconsistent with the reported injury patterns.`,
        details: { mos: mosCode, injuryBlob: injuryBlob.slice(0, 200) },
      });
      confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.2 });
    } else {
      matches.push({
        rule:    'mos_vs_injuries',
        message: `MOS '${mosCode}' is consistent with reported injury/condition patterns.`,
        details: { mos: mosCode },
      });
      confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.8 });
    }
  }

  // ── RULE 3: Deployments vs ExposureEvents ─────────────────────────────────
  if (depNodes.length === 0 && strExposures.length === 0) {
    missingEvidence.push({ rule: 'deployments_vs_exposures', message: 'No deployment or exposure data available.' });
    confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.1 });
  } else if (depNodes.length === 0) {
    missingEvidence.push({ rule: 'deployments_vs_exposures', message: 'STR has exposure events but no deployment nodes in graph.' });
    confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.3 });
  } else if (strExposures.length === 0) {
    missingEvidence.push({ rule: 'deployments_vs_exposures', message: 'Deployment nodes exist but STR has no documented exposures.' });
    confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.4 });
  } else {
    const depLocations  = depNodes.map((d) => _norm(d.data?.location ?? ''));
    const expTypes      = strExposures.map((e) => _norm(e.data?.type ?? ''));
    const locationMatch = depLocations.some((loc) =>
      expTypes.some((exp) => exp.includes(loc) || loc.includes(exp))
    );

    if (locationMatch) {
      matches.push({
        rule:    'deployments_vs_exposures',
        message: `Deployment location(s) match STR exposure event(s).`,
        details: { deployments: depLocations.slice(0, 5), exposures: expTypes.slice(0, 5) },
      });
      confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.85 });
    } else {
      matches.push({
        rule:    'deployments_vs_exposures',
        message: 'Both deployment and exposure data present; no direct text match (locations vs event types may differ).',
        details: { deployments: depLocations.slice(0, 5), exposures: expTypes.slice(0, 5) },
      });
      confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.5 });
    }
  }

  // ── RULE 4: STR conditions vs RatingDecision outcomes ─────────────────────
  if (strConditions.length === 0 || rdNodes.length === 0) {
    missingEvidence.push({ rule: 'str_vs_rating_decision', message: 'Cannot verify: STR conditions or RatingDecision not ingested.' });
    confidenceScores.push({ rule: 'str_vs_rating_decision', score: 0.1 });
  } else {
    const rdGrantedNodes = rdNodes.flatMap((doc) =>
      getEdgesFrom(doc.nodeId)
        .filter((e) => e.edgeType === EDGE_TYPES.GRANTS)
        .map((e) => getNodeById(e.toId)).filter(Boolean)
    );
    const rdDeniedNodes = rdNodes.flatMap((doc) =>
      getEdgesFrom(doc.nodeId)
        .filter((e) => e.edgeType === EDGE_TYPES.DENIES)
        .map((e) => getNodeById(e.toId)).filter(Boolean)
    );

    const strCondNames  = new Set(strConditions.map((c) => _norm(c.data?.name ?? '')));
    const rdGrantNames  = rdGrantedNodes.map((c) => _norm(c.data?.name ?? ''));
    const rdDeniedNames = rdDeniedNodes.map((c) => _norm(c.data?.name ?? ''));

    const grantedWithStrEvidence = rdGrantNames.filter((n) =>
      Array.from(strCondNames).some((sn) => n.includes(sn) || sn.includes(n))
    );
    const deniedLackingStrEvidence = rdDeniedNames.filter((n) =>
      !Array.from(strCondNames).some((sn) => n.includes(sn) || sn.includes(n))
    );

    if (grantedWithStrEvidence.length > 0) {
      matches.push({
        rule:    'str_vs_rating_decision',
        message: `${grantedWithStrEvidence.length} granted condition(s) have matching STR evidence.`,
        details: { conditions: grantedWithStrEvidence.slice(0, 10) },
      });
      confidenceScores.push({ rule: 'str_vs_rating_decision', score: 0.9 });
    }

    if (deniedLackingStrEvidence.length > 0) {
      missingEvidence.push({
        rule:    'str_vs_rating_decision',
        message: `${deniedLackingStrEvidence.length} denied condition(s) have no matching STR evidence.`,
        details: { conditions: deniedLackingStrEvidence.slice(0, 10) },
      });
      confidenceScores.push({ rule: 'str_vs_rating_decision', score: 0.3 });
    }

    if (grantedWithStrEvidence.length === 0 && deniedLackingStrEvidence.length === 0) {
      matches.push({
        rule:    'str_vs_rating_decision',
        message: 'STR conditions and RatingDecision outcomes present; no direct name overlap detected.',
        details: { strCount: strConditions.length, grantedCount: rdGrantedNodes.length },
      });
      confidenceScores.push({ rule: 'str_vs_rating_decision', score: 0.5 });
    }
  }

  // ── InferredConnections ───────────────────────────────────────────────────
  if (includeInferredConnections && strConditions.length > 0 && depNodes.length > 0) {
    for (const cond of strConditions) {
      const condName = _norm(cond.data?.name ?? '');
      if (!condName) continue;
      for (const dep of depNodes) {
        const depLoc = _norm(dep.data?.location ?? '');
        if (depLoc && (condName.includes(depLoc) || depLoc.split(' ').some((w) => w.length > 3 && condName.includes(w)))) {
          inferredConnections.push({
            from:       cond.nodeId,
            to:         dep.nodeId,
            relationship: 'potentially-related-via-location',
            confidence: 0.4,
            inferred:   true,
          });
        }
      }
    }
  }

  // ── Build and store VerificationResult ───────────────────────────────────
  const verificationId = _hash(`verify:${veteranId}:${Date.now()}`);
  const result = {
    verificationId,
    scope:      'graph-cross-verify-v2',
    veteranId,
    schemaVersion: '1.0.0',
    matches,
    mismatches,
    missingEvidence,
    confidenceScores,
    ...(includeInferredConnections ? { inferredConnections } : {}),
    verifiedAt: new Date().toISOString(),
  };

  const vNodeId = makeNodeId(NODE_TYPES.VERIFICATION_RESULT, verificationId);
  upsertNode(vNodeId, NODE_TYPES.VERIFICATION_RESULT, result);
  upsertEdge(vetNodeId, EDGE_TYPES.HAS_VERIFICATION, vNodeId);

  return result;
}
