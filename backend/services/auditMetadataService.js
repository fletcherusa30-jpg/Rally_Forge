import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getKnowledgeManifestIntegrity } from './knowledgeManifestService.js';
import {
  buildDriftSummary,
  buildHealthSummary,
  summarizeSnapshotVersions,
  extractAuditFindings,
  buildFreshnessSummary,
} from '../engine/auditMetadataEngine.js';
import { validateAuditMetadata } from '../validation/auditMetadataSchema.js';
import { getSystemModernizationStatus } from './systemModernizationStatusService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const DATA_SOURCES = {
  benefitsCombined: path.join(repoRoot, 'resources', 'state-benefits.json'),
  benefitsAudit: path.join(repoRoot, 'resources', 'state-benefits.audit.json'),
  benefitsSnapshot: path.join(repoRoot, 'resources', 'state-benefits.snapshot.json'),
  scannerAudit: path.join(repoRoot, 'resources', 'scanner.audit.json'),
  analyzerAudit: path.join(repoRoot, 'resources', 'analyzer.audit.json'),
  caseSummaryAudit: path.join(repoRoot, 'resources', 'case-summary.audit.json'),
  watchdogNow: path.join(repoRoot, 'watchdog_now.json'),
  watchdogLast: path.join(repoRoot, 'watchdog_last.json'),
  routeManifest: path.join(repoRoot, 'backend', 'api', 'routeManifest.js'),
  uiApp: path.join(repoRoot, 'app', 'frontend-modern', 'src', 'App.jsx'),
};

const FRESHNESS_THRESHOLDS_MINUTES = {
  benefitsCombined: 24 * 60,
  benefitsAudit: 24 * 60,
  benefitsSnapshot: 24 * 60,
  scannerAudit: 24 * 60,
  analyzerAudit: 24 * 60,
  caseSummaryAudit: 24 * 60,
  watchdogNow: 6 * 60,
  watchdogLast: 24 * 60,
};

function getEmbeddedSource(files, name) {
  if (name === 'watchdogNow') {
    return files.benefitsAudit?.watchdog || null;
  }

  if (name === 'watchdogLast') {
    return files.benefitsAudit?.watchdog?.previous || null;
  }

  return null;
}

function getEmbeddedTimestamp(files, name) {
  if (name === 'watchdogNow') {
    return files.benefitsAudit?.watchdog?.generatedAt || null;
  }

  if (name === 'watchdogLast') {
    return files.benefitsAudit?.watchdog?.previous?.generatedAt || null;
  }

  return null;
}

function ageMinutesFromTimestamp(timestamp) {
  const parsed = Date.parse(timestamp || '');
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - parsed) / 60000));
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function loadSources() {
  const entries = Object.entries(DATA_SOURCES);

  const values = await Promise.all(entries.map(async ([name, filePath]) => {
    if (filePath.endsWith('.json')) {
      return [name, await readJsonSafe(filePath)];
    }
    return [name, await fileExists(filePath)];
  }));

  const files = Object.fromEntries(values);

  for (const [name] of entries) {
    if (!files[name]) {
      files[name] = getEmbeddedSource(files, name);
    }
  }

  const sourceStatuses = await Promise.all(entries.map(async ([name, filePath]) => ({
    name,
    path: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
    found: Boolean(files[name]),
  })));

  const freshnessEntries = await Promise.all(entries.map(async ([name, filePath]) => {
    const stats = await statSafe(filePath);
    const fileTimestamp = stats?.mtime ? stats.mtime.toISOString() : null;
    const embeddedTimestamp = getEmbeddedTimestamp(files, name);
    const lastModifiedAt = fileTimestamp || embeddedTimestamp || null;
    const ageMinutes = fileTimestamp
      ? Math.max(0, Math.round((Date.now() - stats.mtime.getTime()) / 60000))
      : ageMinutesFromTimestamp(embeddedTimestamp);
    const maxAgeMinutes = FRESHNESS_THRESHOLDS_MINUTES[name] ?? null;
    const stale = Boolean(Number.isFinite(maxAgeMinutes) && ageMinutes !== null && ageMinutes > maxAgeMinutes);

    return {
      source: name,
      path: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
      found: Boolean(files[name]),
      maxAgeMinutes,
      ageMinutes,
      stale,
      lastModifiedAt,
    };
  }));

  return { files, sourceStatuses, freshnessEntries };
}

function computeTopLevelConfidence({ drift, health, sourceStatuses }) {
  const sourceCoverage = sourceStatuses.length > 0
    ? sourceStatuses.filter((entry) => entry.found).length / sourceStatuses.length
    : 0;

  const base = sourceCoverage;
  const driftPenalty = drift?.snapshot?.changed ? 0.1 : 0;
  const healthPenalty = health?.status === 'fail' ? 0.25 : health?.status === 'warn' ? 0.1 : 0;
  const score = Math.max(0, Math.min(1, base - driftPenalty - healthPenalty));

  return {
    score,
    method: 'source-coverage-with-health-drift-adjustment',
  };
}

export async function getAuditMetadataBundle() {
  const { files, sourceStatuses, freshnessEntries } = await loadSources();

  const currentAudit = files.benefitsAudit || null;
  const currentSnapshot = files.benefitsSnapshot || null;
  const previousSnapshot = files.watchdogLast || currentAudit?.watchdog?.previous || null;
  const previousAudit = null;
  const scannerAudit = files.scannerAudit || null;
  const analyzerAudit = files.analyzerAudit || null;
  const caseSummaryAudit = files.caseSummaryAudit || null;
  const knowledgeIntegrity = await getKnowledgeManifestIntegrity();

  const drift = buildDriftSummary({
    currentSnapshot,
    previousSnapshot,
    currentAudit,
    previousAudit,
  });

  const modernization = await getSystemModernizationStatus();
  const audit = extractAuditFindings({ currentAudit });
  const snapshot = summarizeSnapshotVersions({
    currentSnapshot,
    currentAudit: {
      ...currentAudit,
      scanner: scannerAudit,
      analyzer: analyzerAudit,
      caseSummary: caseSummaryAudit,
    },
  });
  const freshness = buildFreshnessSummary({ freshnessEntries });

  const health = buildHealthSummary({
    drift,
    audit: { current: currentAudit },
    modernization,
    diagnostics: { knowledgeIntegrity },
  });

  if (freshness.staleSources.length > 0) {
    health.warnings = [...health.warnings, `Stale audit sources: ${freshness.staleSources.join(', ')}`];
    health.unresolvedIssues = [...health.unresolvedIssues, `Stale audit sources: ${freshness.staleSources.join(', ')}`];
    if (health.status === 'pass') {
      health.status = 'warn';
    }
  }

  const confidence = computeTopLevelConfidence({ drift, health, sourceStatuses });

  const payload = {
    endpointVersion: '1.0.0',
    schemaVersion: '1.0.0',
    snapshot,
    audit,
    drift,
    modernization,
    freshness,
    health,
    provenance: {
      sources: sourceStatuses.map((entry) => ({
        path: entry.path,
        found: entry.found,
      })),
      generatedBy: 'backend/services/auditMetadataService.js',
    },
    confidence,
  };

  return validateAuditMetadata(payload);
}
