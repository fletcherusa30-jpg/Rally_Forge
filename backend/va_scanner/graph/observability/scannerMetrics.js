/**
 * Scanner Metrics — Phase 6.
 *
 * Lightweight in-process metrics store for:
 *   - Per-scanner success/failure counts
 *   - OCR usage tracking
 *   - Average confidence per scanner
 *   - Graph node/edge counts (delegated to graphBuilder)
 *   - Evidence bundle completeness distribution
 *
 * All metrics are in-memory. Replace the store adapter to persist to a DB
 * or emit to a metrics platform (Prometheus, Datadog, etc.).
 *
 * Usage:
 *   recordScanResult('dd214', { success: true, confidence: 0.87, usedOcr: false })
 *   recordScanResult('str', { success: false, confidence: 0, usedOcr: false })
 *   getMetricsReport() → full snapshot
 */

import { getGraphSnapshot } from '../integration/graphBuilder.js';
import { getBundleCompletenessReport } from '../bundles/evidenceBundleBuilder.js';

const SCANNER_NAMES = ['dd214', 'str', 'currentTreatment', 'ratingDecision', 'ocr', 'evidenceGraph'];
const SCHEMA_VERSIONS = { dd214: '3.0.0', str: '3.0.0', ratingDecision: '4.2.0', currentTreatment: '2.0.0', ocr: '2.0.0', evidenceGraph: '2.0.0' };

const _metrics = new Map(
  SCANNER_NAMES.map((name) => [
    name,
    {
      success: 0,
      failure: 0,
      totalConfidence: 0,
      ocrCount: 0,
      totalScans: 0,
      schemaVersion: SCHEMA_VERSIONS[name] || '1.0.0',
      lastUpdated: new Date().toISOString(),
      validationErrors: 0,
      modernized: true,
    },
  ])
);

/**
 * Record the result of a single scan operation (v3 with validation tracking).
 *
 * @param {string} scannerName - one of: 'dd214' | 'str' | 'currentTreatment' | 'ratingDecision' | 'ocr' | 'evidenceGraph'
 * @param {{ success: boolean, confidence?: number, usedOcr?: boolean, validationErrors?: number }} result
 */
export function recordScanResult(scannerName, { success, confidence = 0, usedOcr = false, validationErrors = 0 } = {}) {
  if (!_metrics.has(scannerName)) {
    _metrics.set(scannerName, {
      success: 0,
      failure: 0,
      totalConfidence: 0,
      ocrCount: 0,
      validationErrors: 0,
      totalScans: 0,
      schemaVersion: SCHEMA_VERSIONS[scannerName] || '1.0.0',
      lastUpdated: new Date().toISOString(),
      modernized: true,
    });
  }

  const m = _metrics.get(scannerName);
  m.totalScans        += 1;
  m.success           += success ? 1 : 0;
  m.failure           += success ? 0 : 1;
  m.totalConfidence   += Math.max(0, Math.min(1, Number(confidence) || 0));
  m.ocrCount          += usedOcr ? 1 : 0;
  m.validationErrors  += Math.max(0, Number(validationErrors) || 0);
  m.lastUpdated       = new Date().toISOString();
}

/**
 * Returns per-scanner metrics.
 * @returns {object}
 */
function _perScannerReport() {
  const report = {};
  for (const [name, m] of _metrics.entries()) {
    const avgConfidence = m.totalScans > 0
      ? Math.round((m.totalConfidence / m.totalScans) * 100) / 100
      : null;
    const successRate = m.totalScans > 0
      ? Math.round((m.success / m.totalScans) * 100) / 100
      : null;
    report[name] = {
      totalScans:     m.totalScans,
      success:        m.success,
      failure:        m.failure,
      successRate,
      avgConfidence,
      ocrUsageCount:  m.ocrCount,
      ocrUsageRate:   m.totalScans > 0 ? Math.round((m.ocrCount / m.totalScans) * 100) / 100 : null,
    };
  }
  return report;
}

/**
 * Reset all metrics (for testing purposes).
 */
export function resetMetrics() {
  for (const m of _metrics.values()) {
    m.success        = 0;
    m.failure        = 0;
    m.totalConfidence = 0;
    m.ocrCount       = 0;
    m.totalScans     = 0;
  }
}

/**
 * Return a full metrics report snapshot.
 * @returns {object}
 */
export function getMetricsReport() {
  const snapshot    = getGraphSnapshot();
  const nodeCount   = snapshot.nodes.length;
  const edgeCount   = snapshot.edges.length;

  const nodesByType = {};
  for (const node of snapshot.nodes) {
    nodesByType[node.nodeType] = (nodesByType[node.nodeType] ?? 0) + 1;
  }

  const completeness = getBundleCompletenessReport();

  return {
    generatedAt: new Date().toISOString(),
    scanners:    _perScannerReport(),
    graph: {
      nodeCount,
      edgeCount,
      nodesByType,
    },
    evidenceBundles: completeness,
  };
}
