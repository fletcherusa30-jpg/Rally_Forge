import {
  loadMasterRegistry,
  normalizeBranch,
  normalizeCode,
  normalizeRankCategory,
} from './mosMasterRegistryService.js';

function parseDate(value) {
  if (!value) return null;
  const asString = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asString)) return null;
  const d = new Date(`${asString}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildValidationResult() {
  return {
    isValid: false,
    errors: [],
    warnings: [],
    normalizedMOS: null,
  };
}

function normalizeInput(mosInput = {}) {
  const branch = normalizeBranch(mosInput.branch);
  const code = normalizeCode(mosInput.code);
  const rankCategory = normalizeRankCategory(mosInput.rankCategory);

  const startDateRaw = mosInput?.serviceDates?.startDate || mosInput?.serviceDates?.from || null;
  const endDateRaw = mosInput?.serviceDates?.endDate || mosInput?.serviceDates?.to || null;

  return {
    code,
    branch,
    rankCategory,
    serviceDates: {
      startDate: startDateRaw ? String(startDateRaw).trim() : null,
      endDate: endDateRaw ? String(endDateRaw).trim() : null,
    },
  };
}

function validateMOS(mosInput = {}) {
  const result = buildValidationResult();
  const normalized = normalizeInput(mosInput);
  const registry = loadMasterRegistry();

  if (!normalized.code) result.errors.push('code is required');
  if (!normalized.branch) result.errors.push('branch is required or unsupported');

  const startDate = parseDate(normalized.serviceDates.startDate);
  const endDate = parseDate(normalized.serviceDates.endDate);
  if (normalized.serviceDates.startDate && !startDate) {
    result.errors.push('serviceDates.startDate must be YYYY-MM-DD when provided');
  }
  if (normalized.serviceDates.endDate && !endDate) {
    result.errors.push('serviceDates.endDate must be YYYY-MM-DD when provided');
  }
  if (startDate && endDate && startDate > endDate) {
    result.errors.push('serviceDates.startDate cannot be after serviceDates.endDate');
  }

  if (result.errors.length > 0) {
    return result;
  }

  const branchCodeKey = `${normalized.branch}::${normalized.code}`;
  const candidates = registry.byBranchAndCode.get(branchCodeKey) || [];
  if (candidates.length === 0) {
    result.errors.push('code is not valid for branch');
    return result;
  }

  let selected = null;
  if (normalized.rankCategory) {
    const rankKey = `${normalized.branch}::${normalized.code}::${normalized.rankCategory}`;
    selected = registry.byBranchCodeAndRank.get(rankKey) || null;
    if (!selected) {
      result.errors.push('rankCategory is not valid for branch/code combination');
      return result;
    }
  } else if (candidates.length === 1) {
    selected = candidates[0];
    normalized.rankCategory = candidates[0].rankCategory;
  } else {
    result.errors.push('rankCategory is required when branch/code has multiple rank categories');
    return result;
  }

  // The master registry currently does not carry valid-from/valid-to windows.
  if (normalized.serviceDates.startDate || normalized.serviceDates.endDate) {
    result.warnings.push('date-range validation unavailable: no authoritative validity windows in registry');
  }

  result.normalizedMOS = {
    code: normalized.code,
    branch: normalized.branch,
    rankCategory: normalized.rankCategory,
    serviceDates: normalized.serviceDates,
    title: selected.title,
    description: selected.description,
    feederCodes: Array.isArray(selected.feederCodes) ? selected.feederCodes : [],
    crossBranchEquivalents: selected.crossBranchEquivalents,
    exposure: selected.exposure,
    notes: selected.notes,
  };

  result.isValid = true;
  return result;
}

function validateMOSList(mosList = []) {
  const listResult = {
    isValid: true,
    errors: [],
    warnings: [],
    normalizedMOS: [],
  };

  if (!Array.isArray(mosList)) {
    return {
      isValid: false,
      errors: ['mosList must be an array'],
      warnings: [],
      normalizedMOS: [],
    };
  }

  const seen = new Set();

  mosList.forEach((item, index) => {
    const result = validateMOS(item);

    if (!result.isValid) {
      listResult.isValid = false;
      result.errors.forEach((error) => {
        listResult.errors.push({ index, error });
      });
      return;
    }

    const normalized = result.normalizedMOS;
    const duplicateKey = `${normalized.branch}::${normalized.code}::${normalized.rankCategory}`;
    if (seen.has(duplicateKey)) {
      listResult.isValid = false;
      listResult.errors.push({ index, error: 'duplicate MOS entry in list' });
      return;
    }
    seen.add(duplicateKey);

    result.warnings.forEach((warning) => {
      listResult.warnings.push({ index, warning });
    });

    listResult.normalizedMOS.push(normalized);
  });

  return listResult;
}

export {
  normalizeInput,
  validateMOS,
  validateMOSList,
};
