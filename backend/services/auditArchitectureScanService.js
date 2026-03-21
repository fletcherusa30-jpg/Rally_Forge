import { getAuditMetadataBundle } from './auditMetadataService.js';
import { buildRouteManifest } from '../api/routeManifest.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const resourcesRoot = path.join(repoRoot, 'resources');

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeStatus(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'fail') return 'fail';
  if (normalized === 'warn') return 'warn';
  if (normalized === 'pass') return 'pass';
  return 'unknown';
}

function inferOverallStatus({ healthStatus, sourceCoverageRatio, staleSources }) {
  if (healthStatus === 'fail') return 'fail';
  if (healthStatus === 'warn') return 'warn';
  if (sourceCoverageRatio < 0.8) return 'warn';
  if ((staleSources || []).length > 0) return 'warn';
  return 'pass';
}

function deriveRouteSummary() {
  const routes = buildRouteManifest({ authLimiter: null });
  const categories = routes.reduce((acc, route) => {
    const category = String(route?.category || 'unknown');
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  return {
    endpointCount: routes.length,
    categories,
    publicEndpoints: categories.public || 0,
    coreEndpoints: categories.core || 0,
    extendedEndpoints: categories.extended || 0,
  };
}

function collectCapabilities(modernization = {}) {
  const entries = Object.entries(modernization);
  const modernized = entries
    .filter(([, value]) => value?.status === 'modernized')
    .map(([name]) => name);
  const partial = entries
    .filter(([, value]) => value?.status === 'partial')
    .map(([name]) => name);
  const unknown = entries
    .filter(([, value]) => value?.status === 'unknown')
    .map(([name]) => name);

  return {
    modernized,
    partial,
    unknown,
    coverageRatio: entries.length > 0 ? modernized.length / entries.length : 0,
  };
}

async function listFilesRecursive(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const children = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(fullPath);
      }
      return [fullPath];
    }));
    return children.flat();
  } catch {
    return [];
  }
}

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

async function discoverResourceInventory() {
  const files = await listFilesRecursive(resourcesRoot);
  const jsonFiles = files.filter((filePath) => filePath.toLowerCase().endsWith('.json'));
  const rawDataFiles = jsonFiles.filter((filePath) => {
    const lower = filePath.toLowerCase();
    return !lower.endsWith('.audit.json') && !lower.endsWith('.snapshot.json') && !lower.endsWith('.inventory.json');
  });

  const missingCompanionArtifacts = [];
  const invalidJsonFiles = [];
  const newlyModifiedFiles = [];
  const unindexedOrChangedFiles = [];
  const now = Date.now();
  const inventoryIndexPath = path.join(resourcesRoot, 'scan.inventory.json');
  let inventoryIndex = null;

  try {
    const rawIndex = await fs.readFile(inventoryIndexPath, 'utf8');
    inventoryIndex = JSON.parse(rawIndex);
  } catch {
    inventoryIndex = null;
  }

  const indexedRawFiles = Array.isArray(inventoryIndex?.indexedRawFiles)
    ? new Set(inventoryIndex.indexedRawFiles)
    : new Set();
  const indexGeneratedAtMs = Number.isFinite(Date.parse(inventoryIndex?.generatedAt || ''))
    ? Date.parse(inventoryIndex.generatedAt)
    : null;

  for (const dataFile of rawDataFiles) {
    const relativeDataPath = toRelative(dataFile);
    const auditPath = dataFile.replace(/\.json$/i, '.audit.json');
    const snapshotPath = dataFile.replace(/\.json$/i, '.snapshot.json');

    try {
      const raw = await fs.readFile(dataFile, 'utf8');
      JSON.parse(raw);
    } catch {
      invalidJsonFiles.push(relativeDataPath);
    }

    try {
      const stats = await fs.stat(dataFile);
      if (now - stats.mtime.getTime() <= 24 * 60 * 60 * 1000) {
        newlyModifiedFiles.push(relativeDataPath);
      }
      const wasIndexed = indexedRawFiles.has(relativeDataPath);
      const changedSinceIndex = indexGeneratedAtMs === null ? true : stats.mtime.getTime() > indexGeneratedAtMs;
      if (!wasIndexed || changedSinceIndex) {
        unindexedOrChangedFiles.push(relativeDataPath);
      }
    } catch {
      // Ignore stat errors for inventory diagnostics.
    }

    try {
      await fs.access(auditPath);
    } catch {
      missingCompanionArtifacts.push(toRelative(auditPath));
    }

    try {
      await fs.access(snapshotPath);
    } catch {
      missingCompanionArtifacts.push(toRelative(snapshotPath));
    }
  }

  return {
    rawDataFileCount: rawDataFiles.length,
    rawDataFiles: rawDataFiles.map(toRelative).sort((a, b) => a.localeCompare(b)),
    newlyModifiedFiles: newlyModifiedFiles.sort((a, b) => a.localeCompare(b)),
    unindexedOrChangedFiles: unindexedOrChangedFiles.sort((a, b) => a.localeCompare(b)),
    missingCompanionArtifacts: missingCompanionArtifacts.sort((a, b) => a.localeCompare(b)),
    invalidJsonFiles: invalidJsonFiles.sort((a, b) => a.localeCompare(b)),
    hasInventoryIndex: Boolean(inventoryIndex),
  };
}

function buildEnhancements({ metadata, architecture, structure, capabilities, inventory }) {
  const enhancements = [];

  const addEnhancement = ({ title, area, priority, reason, resolution, impact }) => {
    enhancements.push({
      id: `enh-${enhancements.length + 1}`,
      title,
      area,
      priority,
      reason,
      resolution,
      impact,
    });
  };

  if (structure.staleSources.length > 0) {
    addEnhancement({
      title: 'Automate freshness jobs for stale data sources',
      area: 'structure',
      priority: 'high',
      reason: `Sources are stale: ${structure.staleSources.join(', ')}`,
      resolution: 'Run watchdog and audit generation on a schedule, and update stale artifacts before each release.',
      impact: 'Reduces drift risk and keeps health status from degrading due to old metadata.',
    });
  }

  if (structure.missingSources.length > 0) {
    addEnhancement({
      title: 'Backfill missing audit evidence sources',
      area: 'architecture',
      priority: 'high',
      reason: `Missing sources: ${structure.missingSources.join(', ')}`,
      resolution: 'Generate or restore missing audit artifacts and enforce artifact existence in CI preflight.',
      impact: 'Improves end-to-end observability and confidence scoring for architecture scans.',
    });
  }

  if (inventory.invalidJsonFiles.length > 0) {
    addEnhancement({
      title: 'Repair invalid JSON inputs before audit processing',
      area: 'structure',
      priority: 'high',
      reason: `Invalid JSON files detected: ${inventory.invalidJsonFiles.join(', ')}`,
      resolution: 'Fix malformed JSON syntax for uploaded files so scanners and auditors can parse them reliably.',
      impact: 'Prevents parse failures and keeps newly added files from blocking architecture scans.',
    });
  }

  if (inventory.missingCompanionArtifacts.length > 0) {
    addEnhancement({
      title: 'Backfill missing companion audit/snapshot artifacts for uploaded files',
      area: 'structure',
      priority: 'high',
      reason: `Missing companion artifacts: ${inventory.missingCompanionArtifacts.join(', ')}`,
      resolution: 'Generate .audit.json and .snapshot.json companions for newly discovered data files.',
      impact: 'Ensures new files are indexed into the comprehensive scan and included in gap resolution.',
    });
  }

  if (inventory.unindexedOrChangedFiles.length > 0) {
    addEnhancement({
      title: 'Reconcile recently changed files into architecture evidence',
      area: 'architecture',
      priority: 'medium',
      reason: `Files requiring re-index: ${inventory.unindexedOrChangedFiles.join(', ')}`,
      resolution: 'Re-index and re-scan recently changed inputs so recommendations reflect the latest uploads.',
      impact: 'Keeps scan outputs current after uploads or file changes.',
    });
  }

  if (metadata.health?.errors?.length > 0) {
    addEnhancement({
      title: 'Resolve blocking health errors',
      area: 'architecture',
      priority: 'high',
      reason: metadata.health.errors.join(' | '),
      resolution: 'Address failing data contracts and missing critical inputs, then rerun the audit metadata validation.',
      impact: 'Moves system status from fail to warn/pass and restores reliable scan outcomes.',
    });
  }

  if (metadata.health?.warnings?.length > 0) {
    addEnhancement({
      title: 'Burn down unresolved health warnings',
      area: 'capabilities',
      priority: 'medium',
      reason: `${metadata.health.warnings.length} health warning(s) active.`,
      resolution: 'Triage warnings by owner, assign due dates, and clear one warning category per sprint.',
      impact: 'Improves operational stability and confidence in capability readiness.',
    });
  }

  if (capabilities.partial.length > 0 || capabilities.unknown.length > 0) {
    const laggingDomains = unique([...capabilities.partial, ...capabilities.unknown]);
    addEnhancement({
      title: 'Complete modernization in lagging domains',
      area: 'capabilities',
      priority: 'medium',
      reason: `Not fully modernized domains: ${laggingDomains.join(', ')}`,
      resolution: 'Close missing artifact gaps per domain and add regression tests for each modernization area.',
      impact: 'Increases capability coverage and reduces unknown behavior between modules.',
    });
  }

  if (structure.sourceCoverageRatio < 0.9) {
    addEnhancement({
      title: 'Increase architecture scan source coverage',
      area: 'structure',
      priority: 'medium',
      reason: `Current source coverage is ${(structure.sourceCoverageRatio * 100).toFixed(1)}%.`,
      resolution: 'Add missing source files to provenance tracking and validate source availability before publishing artifacts.',
      impact: 'Improves scan completeness and recommendation quality.',
    });
  }

  if ((metadata.confidence?.score || 0) < 0.85) {
    addEnhancement({
      title: 'Raise metadata confidence threshold',
      area: 'architecture',
      priority: 'low',
      reason: `Confidence score is ${Number(metadata.confidence?.score || 0).toFixed(2)}.`,
      resolution: 'Add stronger data quality checks and remove avoidable warnings to increase confidence score.',
      impact: 'Makes scan recommendations more trustworthy for release decisions.',
    });
  }

  if (enhancements.length > 0) {
    addEnhancement({
      title: 'Establish monthly architecture review ritual',
      area: 'capabilities',
      priority: 'low',
      reason: 'Continuous governance keeps architecture, structure, and capability drift under control.',
      resolution: 'Run this full scan monthly, track top 3 enhancements, and publish closure evidence in workspace updates.',
      impact: 'Creates sustained improvement rhythm and visibility for leadership.',
    });
  }

  return enhancements
    .sort((a, b) => {
      const priorityDelta = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      if (priorityDelta !== 0) return priorityDelta;
      return a.title.localeCompare(b.title);
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function runAuditArchitectureScan() {
  const metadata = await getAuditMetadataBundle();
  const inventory = await discoverResourceInventory();
  const routeSummary = deriveRouteSummary();
  const capabilities = collectCapabilities(metadata.modernization || {});
  const provenanceSources = Array.isArray(metadata?.provenance?.sources) ? metadata.provenance.sources : [];
  const availableSourceCount = provenanceSources.filter((entry) => entry?.found).length;
  const sourceCoverageRatio = provenanceSources.length > 0 ? availableSourceCount / provenanceSources.length : 0;
  const missingSources = provenanceSources
    .filter((entry) => !entry?.found)
    .map((entry) => String(entry?.path || '').trim())
    .filter(Boolean);
  const staleSources = Array.isArray(metadata?.freshness?.staleSources) ? metadata.freshness.staleSources : [];

  const architecture = {
    healthStatus: normalizeStatus(metadata?.health?.status),
    unresolvedIssueCount: Array.isArray(metadata?.health?.unresolvedIssues) ? metadata.health.unresolvedIssues.length : 0,
    routeSummary,
    confidenceScore: Number(metadata?.confidence?.score || 0),
  };

  const structure = {
    sourceCount: provenanceSources.length,
    availableSourceCount,
    sourceCoverageRatio,
    missingSources,
    staleSources,
    inventory,
  };

  const enhancementCandidates = buildEnhancements({
    metadata,
    architecture,
    structure,
    capabilities,
    inventory,
  });

  const overallStatus = inferOverallStatus({
    healthStatus: architecture.healthStatus,
    sourceCoverageRatio: structure.sourceCoverageRatio,
    staleSources: structure.staleSources,
  });

  return {
    scanVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    scope: ['architecture', 'structure', 'capabilities'],
    overallStatus,
    architecture,
    structure,
    capabilities,
    enhancements: enhancementCandidates,
    recommendationSummary: {
      total: enhancementCandidates.length,
      highPriority: enhancementCandidates.filter((item) => item.priority === 'high').length,
      mediumPriority: enhancementCandidates.filter((item) => item.priority === 'medium').length,
      lowPriority: enhancementCandidates.filter((item) => item.priority === 'low').length,
    },
  };
}