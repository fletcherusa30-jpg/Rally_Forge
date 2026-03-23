import { validateMOSList } from './mosValidationEngine.js';

const veteranMosStore = new Map();

function nowIso() {
  return new Date().toISOString();
}

function normalizeSourceType(sourceType) {
  const value = String(sourceType || '').trim().toLowerCase();
  const aliases = {
    dd214: 'dd214',
    str: 'str',
    ctr: 'ctr',
    ratingdecision: 'ratingDecision',
    rating_decision: 'ratingDecision',
    user: 'userInput',
    userinput: 'userInput',
    imported: 'importedDataset',
    importeddataset: 'importedDataset',
  };
  return aliases[value] || value || 'unknown';
}

function extractFromDD214(payload) {
  const branch = payload?.serviceIdentity?.branchOfService || payload?.branch || '';
  const primary = payload?.gradeSpecialty?.primaryMOSOrAFSCOrRating;
  const additional = Array.isArray(payload?.gradeSpecialty?.additionalMOSOrSpecialties)
    ? payload.gradeSpecialty.additionalMOSOrSpecialties
    : [];
  const rankCategory = String(payload?.gradeSpecialty?.payGrade || '').startsWith('W')
    ? 'Warrant Officer'
    : String(payload?.gradeSpecialty?.payGrade || '').startsWith('O')
      ? 'Officer'
      : 'Enlisted';

  const serviceDates = {
    startDate: payload?.servicePeriods?.entryDate || null,
    endDate: payload?.servicePeriods?.separationDate || null,
  };

  const rows = [];
  if (primary) rows.push({ code: primary, branch, rankCategory, serviceDates });
  for (const code of additional) rows.push({ code, branch, rankCategory, serviceDates });
  return rows;
}

function extractGenericArray(payload, defaults = {}) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.records) ? payload.records : [];
  return rows.map((row) => ({
    code: row.code || row.mosCode || row.afsc || row.rating || row.specialty,
    branch: row.branch || defaults.branch || '',
    rankCategory: row.rankCategory || defaults.rankCategory || '',
    serviceDates: row.serviceDates || {
      startDate: row.startDate || null,
      endDate: row.endDate || null,
    },
  }));
}

function parseStage({ sourceType, payload }) {
  const kind = normalizeSourceType(sourceType);

  if (kind === 'dd214') return extractFromDD214(payload);
  if (kind === 'str' || kind === 'ctr') return extractGenericArray(payload);
  if (kind === 'ratingDecision') return extractGenericArray(payload);
  if (kind === 'userInput') return extractGenericArray(payload);
  if (kind === 'importedDataset') return extractGenericArray(payload);

  return extractGenericArray(payload);
}

function normalizeStage(rawRows) {
  return rawRows.map((row) => ({
    code: String(row.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    branch: String(row.branch || '').trim(),
    rankCategory: String(row.rankCategory || '').trim(),
    serviceDates: {
      startDate: row?.serviceDates?.startDate || null,
      endDate: row?.serviceDates?.endDate || null,
    },
  })).filter((row) => row.code);
}

function mapStage(validatedRows) {
  return validatedRows.map((row) => ({
    ...row,
    mapped: {
      crossBranchEquivalents: row.crossBranchEquivalents,
      exposure: row.exposure,
      cfrDbqMappings: [],
    },
  }));
}

function makeFingerprint(sourceType, row) {
  return [
    sourceType,
    row.branch,
    row.code,
    row.rankCategory,
    row.serviceDates?.startDate || '',
    row.serviceDates?.endDate || '',
  ].join('::');
}

function ensureVeteranRecord(veteranId) {
  if (!veteranMosStore.has(veteranId)) {
    veteranMosStore.set(veteranId, {
      veteranId,
      mosHistory: [],
      index: new Set(),
      updatedAt: nowIso(),
    });
  }
  return veteranMosStore.get(veteranId);
}

function storeStage({ veteranId, sourceType, mappedRows }) {
  const record = ensureVeteranRecord(veteranId);
  let inserted = 0;

  for (const row of mappedRows) {
    const fingerprint = makeFingerprint(sourceType, row);
    if (record.index.has(fingerprint)) continue;

    record.index.add(fingerprint);
    record.mosHistory.push({
      sourceType,
      ingestedAt: nowIso(),
      ...row,
    });
    inserted += 1;
  }

  record.updatedAt = nowIso();
  return {
    veteranId,
    inserted,
    total: record.mosHistory.length,
  };
}

function ingestMOSData({ veteranId, sourceType, payload, logger = console } = {}) {
  const result = {
    isValid: false,
    errors: [],
    warnings: [],
    stages: {
      parsed: 0,
      normalized: 0,
      validated: 0,
      mapped: 0,
      stored: 0,
    },
    normalizedRecords: [],
  };

  if (!veteranId) {
    result.errors.push('veteranId is required');
    return result;
  }

  const source = normalizeSourceType(sourceType);
  const parsed = parseStage({ sourceType: source, payload });
  result.stages.parsed = parsed.length;

  const normalized = normalizeStage(parsed);
  result.stages.normalized = normalized.length;

  const validation = validateMOSList(normalized);
  if (!validation.isValid) {
    result.errors = validation.errors;
    result.warnings = validation.warnings;
    logger.warn?.('[MOS Pipeline] Validation failed', {
      veteranId,
      sourceType: source,
      errors: validation.errors,
    });
    return result;
  }

  result.stages.validated = validation.normalizedMOS.length;
  result.warnings = validation.warnings;

  const mapped = mapStage(validation.normalizedMOS);
  result.stages.mapped = mapped.length;

  const store = storeStage({
    veteranId,
    sourceType: source,
    mappedRows: mapped,
  });

  result.stages.stored = store.inserted;
  result.normalizedRecords = mapped;
  result.isValid = true;

  logger.info?.('[MOS Pipeline] Ingestion complete', {
    veteranId,
    sourceType: source,
    inserted: store.inserted,
    total: store.total,
  });

  return result;
}

function getVeteranMOSHistory(veteranId) {
  const record = veteranMosStore.get(veteranId);
  return record ? [...record.mosHistory] : [];
}

function getMOSExposures(veteranId) {
  return getVeteranMOSHistory(veteranId).map((row) => ({
    code: row.code,
    branch: row.branch,
    rankCategory: row.rankCategory,
    exposure: row.mapped?.exposure || null,
  }));
}

function getMOSCrossBranchView(veteranId) {
  return getVeteranMOSHistory(veteranId).map((row) => ({
    code: row.code,
    branch: row.branch,
    rankCategory: row.rankCategory,
    crossBranchEquivalents: row.mapped?.crossBranchEquivalents || null,
  }));
}

function clearMOSIngestionStore() {
  veteranMosStore.clear();
}

export {
  clearMOSIngestionStore,
  getMOSCrossBranchView,
  getMOSExposures,
  getVeteranMOSHistory,
  ingestMOSData,
  normalizeSourceType,
  parseStage,
  normalizeStage,
  mapStage,
  storeStage,
};
