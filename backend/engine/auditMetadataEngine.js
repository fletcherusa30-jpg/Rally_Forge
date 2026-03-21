function objectKeys(value) {
  return value && typeof value === 'object' ? Object.keys(value).sort() : [];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function countByPath(value, path) {
  const segments = String(path || '').split('.').filter(Boolean);
  let current = value;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return 0;
    }
    current = current[segment];
  }

  return asArray(current).length;
}

export function buildDriftSummary({ currentSnapshot, previousSnapshot, currentAudit, previousAudit }) {
  const snapshot = {
    available: Boolean(currentSnapshot),
    previousAvailable: Boolean(previousSnapshot),
    changed: Boolean(previousSnapshot && currentSnapshot && previousSnapshot.combinedHash !== currentSnapshot.combinedHash),
    schemaVersionChanged: Boolean(previousSnapshot && currentSnapshot && String(previousSnapshot.schemaVersion || '') !== String(currentSnapshot.schemaVersion || '')),
    changedStates: previousSnapshot && currentSnapshot
      ? objectKeys(currentSnapshot.stateHashes).filter((stateCode) => currentSnapshot.stateHashes[stateCode] !== previousSnapshot.stateHashes?.[stateCode])
      : [],
  };

  const audit = {
    available: Boolean(currentAudit),
    previousAvailable: Boolean(previousAudit),
    schemaVersionChanged: Boolean(previousAudit && currentAudit && String(previousAudit.schemaVersion || '') !== String(currentAudit.schemaVersion || '')),
    coverageMissingStatesChanged: Boolean(
      previousAudit
      && currentAudit
      && JSON.stringify(asArray(previousAudit.coverage?.missingStates)) !== JSON.stringify(asArray(currentAudit.coverage?.missingStates))
    ),
    watchdogChecksChanged: Boolean(
      previousAudit
      && currentAudit
      && JSON.stringify(previousAudit.watchdog?.checks || null) !== JSON.stringify(currentAudit.watchdog?.checks || null)
    ),
  };

  const canonicalSchema = {
    benefitsSchemaVersion: String(currentAudit?.schemaVersion || currentSnapshot?.schemaVersion || 'unknown'),
    hasCoverageObject: Boolean(currentAudit?.coverage),
    hasDiscoveryMap: Boolean(currentAudit?.discovery),
    hasExtractedSchemas: Boolean(currentAudit?.extractedSchemas),
    mismatchSignals: [
      !currentAudit?.coverage ? 'missing_coverage' : null,
      !currentAudit?.discovery ? 'missing_discovery' : null,
      !currentAudit?.extractedSchemas ? 'missing_extracted_schemas' : null,
    ].filter(Boolean),
  };

  return { snapshot, audit, canonicalSchema };
}

export function buildModernizationStatus({ files }) {
  const isPresent = (key) => Boolean(files[key]);

  const benefitsReady = isPresent('benefitsAudit') && isPresent('benefitsSnapshot') && isPresent('benefitsCombined');
  const scannerReady = isPresent('scannerAudit');
  const analyzerReady = isPresent('analyzerAudit');
  const caseSummaryReady = isPresent('caseSummaryAudit');

  return {
    backend: {
      status: isPresent('routeManifest') ? 'partial' : 'unknown',
      evidence: ['routeManifest'],
    },
    ui: {
      status: isPresent('uiApp') ? 'partial' : 'unknown',
      evidence: ['uiApp'],
    },
    scanner: {
      status: scannerReady ? 'modernized' : 'partial',
      evidence: ['scannerAudit'],
      missing: scannerReady ? [] : ['resources/scanner.audit.json'],
    },
    analyzer: {
      status: analyzerReady ? 'modernized' : 'partial',
      evidence: ['analyzerAudit'],
      missing: analyzerReady ? [] : ['resources/analyzer.audit.json'],
    },
    caseSummary: {
      status: caseSummaryReady ? 'modernized' : 'partial',
      evidence: ['caseSummaryAudit'],
      missing: caseSummaryReady ? [] : ['resources/case-summary.audit.json'],
    },
    benefits: {
      status: benefitsReady ? 'modernized' : 'partial',
      evidence: ['benefitsCombined', 'benefitsSnapshot', 'benefitsAudit'],
      missing: benefitsReady ? [] : ['resources/state-benefits.json', 'resources/state-benefits.snapshot.json', 'resources/state-benefits.audit.json'],
    },
  };
}

export function buildHealthSummary({ drift, audit, modernization, diagnostics }) {
  const warnings = [];
  const errors = [];

  if (!audit?.current) {
    errors.push('Benefits audit metadata unavailable');
  }

  if (!drift?.snapshot?.available) {
    warnings.push('Current benefits snapshot unavailable');
  }

  if (drift?.snapshot?.changed) {
    warnings.push('Benefits snapshot differs from previous snapshot');
  }

  if (drift?.audit?.watchdogChecksChanged) {
    warnings.push('Benefits watchdog checks changed between snapshots');
  }

  if ((drift?.canonicalSchema?.mismatchSignals || []).length > 0) {
    warnings.push(`Canonical benefits schema gaps: ${drift.canonicalSchema.mismatchSignals.join(', ')}`);
  }

  const modernizationEntries = Object.values(modernization || {});
  const unresolvedModernization = modernizationEntries
    .filter((entry) => entry?.status !== 'modernized')
    .map((entry) => entry?.missing || [])
    .flat();

  unresolvedModernization.forEach((item) => {
    if (item) {
      warnings.push(`Modernization artifact missing: ${item}`);
    }
  });

  if (!diagnostics?.knowledgeIntegrity?.success) {
    warnings.push('Knowledge manifest integrity check not fully healthy');
  }

  const pass = errors.length === 0;
  const status = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
  const unresolvedIssues = [...errors, ...warnings];

  const confidence = {
    score: Math.max(0, Math.min(1, 1 - (warnings.length * 0.05 + errors.length * 0.2))),
    method: 'deterministic-rule-weighting',
  };

  return {
    pass,
    status,
    warnings,
    errors,
    unresolvedIssues,
    confidence,
  };
}

export function summarizeSnapshotVersions({ currentSnapshot, currentAudit }) {
  const watchdog = currentAudit?.watchdog || null;
  return {
    canonicalSchemaVersion: String(currentAudit?.schemaVersion || currentSnapshot?.schemaVersion || 'unknown'),
    benefitsDatasetVersion: String(currentSnapshot?.schemaVersion || currentAudit?.schemaVersion || 'unknown'),
    scannerEngineVersion: String(currentAudit?.scanner?.version || 'unknown'),
    analyzerEngineVersion: String(currentAudit?.analyzer?.version || 'unknown'),
    summaryEngineVersion: String(currentAudit?.caseSummary?.version || 'unknown'),
    uiSchemaVersion: String(currentAudit?.ui?.schemaVersion || 'unknown'),
    backendSchemaVersion: String(currentAudit?.backend?.schemaVersion || 'unknown'),
    watchdogGeneratedAt: watchdog?.generatedAt || null,
  };
}

export function buildFreshnessSummary({ freshnessEntries }) {
  const sources = asArray(freshnessEntries).map((entry) => ({
    source: String(entry?.source || 'unknown'),
    path: String(entry?.path || ''),
    found: Boolean(entry?.found),
    maxAgeMinutes: asNumber(entry?.maxAgeMinutes),
    ageMinutes: asNumber(entry?.ageMinutes),
    stale: Boolean(entry?.stale),
    lastModifiedAt: entry?.lastModifiedAt || null,
  }));

  const staleSources = sources.filter((entry) => entry.stale).map((entry) => entry.source);

  return {
    policyVersion: '1.0.0',
    staleSources,
    sources,
  };
}

export function extractAuditFindings({ currentAudit }) {
  const coverageMissingStates = asArray(currentAudit?.coverage?.missingStates);
  const watchdogMissingStates = asArray(currentAudit?.watchdog?.checks?.missingStates);

  return {
    missingStates: Array.from(new Set([...coverageMissingStates, ...watchdogMissingStates])).sort(),
    missingFields: asArray(currentAudit?.missingFields),
    missingBenefits: asArray(currentAudit?.missingBenefits),
    outdatedBenefits: asArray(currentAudit?.outdatedBenefits),
    schemaMismatches: asArray(currentAudit?.schemaMismatches),
    normalizationGaps: asArray(currentAudit?.normalizationGaps),
    validationFailures: asArray(currentAudit?.validationFailures),
    counts: {
      inputStateRecords: Number(currentAudit?.inputs?.stateRecords || 0),
      outputStateRecords: Number(currentAudit?.outputs?.stateRecords || 0),
      outputFederalPrograms: Number(currentAudit?.outputs?.federalPrograms || 0),
      missingStates: coverageMissingStates.length,
      extractedSchemas: objectKeys(currentAudit?.extractedSchemas).length,
      discoveryBuckets: objectKeys(currentAudit?.discovery).length,
      coverageExpectedStates: countByPath(currentAudit, 'coverage.expectedStates'),
      coveragePresentStates: countByPath(currentAudit, 'coverage.presentStates'),
    },
  };
}
