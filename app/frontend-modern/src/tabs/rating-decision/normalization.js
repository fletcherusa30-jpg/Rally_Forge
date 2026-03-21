import {
  RD_CONFIDENCE_LEVELS,
  RD_RESULT_SECTIONS,
  createEmptyExtractedFindings,
  createEmptyManualEntry,
} from './schema.js';

const CONDITION_ALIASES = {
  ptsd: 'post-traumatic stress disorder',
  tinnitus: 'tinnitus',
  gerd: 'gastroesophageal reflux disease',
  htn: 'hypertension',
  tbi: 'traumatic brain injury',
  osa: 'obstructive sleep apnea',
  lumbar: 'lower back pain',
  lumbarstrain: 'lower back pain',
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  const text = toText(value);
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return '';
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeSmcCode(value) {
  return toText(value).replace(/^SMC[-\s]?/i, '').toUpperCase();
}

function confidenceFromScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'unknown';
  if (numeric >= 0.8) return 'high';
  if (numeric >= 0.55) return 'medium';
  return 'low';
}

export function normalizeConditionName(value) {
  const raw = toText(value);
  if (!raw) return '';

  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return CONDITION_ALIASES[key] || raw;
}

export function parsePercentage(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(String(value).replace('%', '').trim());
  if (!Number.isFinite(numeric)) return NaN;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeDecisionCondition(item, kind = 'service-connected') {
  const percentageRaw = parsePercentage(item?.percentage);
  const confidenceScore = Number(item?.confidenceScore || item?.confidence?.score || 0);
  const confidenceLevel = toText(item?.confidenceLevel).toLowerCase() || confidenceFromScore(confidenceScore);

  return {
    conditionName: normalizeConditionName(item?.conditionName || item?.label || item?.condition),
    percentage: Number.isNaN(percentageRaw) ? '' : percentageRaw,
    effectiveDate: normalizeDate(item?.effectiveDate || item?.date),
    confidenceScore: Number.isFinite(confidenceScore) ? confidenceScore : 0,
    confidenceLevel: RD_CONFIDENCE_LEVELS.includes(confidenceLevel) ? confidenceLevel : 'unknown',
    kind,
    denialReason: toText(item?.denialReason),
  };
}

function normalizeEvidenceSpan(span, index) {
  const confidenceScore = Number(span?.confidenceScore || span?.score || 0);
  const confidenceLevel = toText(span?.confidenceLevel).toLowerCase() || confidenceFromScore(confidenceScore);

  return {
    id: toText(span?.id) || `rd-span-${index + 1}`,
    section: toText(span?.section || span?.category || 'general'),
    text: toText(span?.text || span?.span || span?.snippet || span?.matchedText),
    confidenceScore: Number.isFinite(confidenceScore) ? confidenceScore : 0,
    confidenceLevel: RD_CONFIDENCE_LEVELS.includes(confidenceLevel) ? confidenceLevel : 'unknown',
    start: Number.isFinite(Number(span?.start)) ? Number(span.start) : null,
    end: Number.isFinite(Number(span?.end)) ? Number(span.end) : null,
  };
}

function toDependentsText(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map((item) => toText(item?.name || item?.type || item)).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const added = toArray(value.added).map((item) => toText(item?.name || item?.type || item));
    const removed = toArray(value.removed).map((item) => toText(item?.name || item?.type || item));
    return [...added, ...removed].filter(Boolean).join(', ');
  }
  return '';
}

function normalizeConfidenceBySection(result, serviceConnected, denied, smcAdjustments, dependents, effectiveDates) {
  const quality = result?.quality || {};
  const fromQuality = quality?.sectionConfidence && typeof quality.sectionConfidence === 'object'
    ? quality.sectionConfidence
    : {};

  const confidenceBySection = {
    serviceConnectedConditions:
      Number(fromQuality.serviceConnectedConditions || fromQuality.serviceConnected || 0) ||
      (serviceConnected.length > 0 ? averageConfidence(serviceConnected) : 0),
    deniedConditions:
      Number(fromQuality.deniedConditions || fromQuality.denied || 0) ||
      (denied.length > 0 ? averageConfidence(denied) : 0),
    smcAdjustments:
      Number(fromQuality.smcAdjustments || fromQuality.smc || 0) ||
      (smcAdjustments.length > 0 ? 0.75 : 0),
    dependentAdjustments:
      Number(fromQuality.dependentAdjustments || fromQuality.dependents || 0) ||
      (dependents.length > 0 ? 0.75 : 0),
    combinedRating: Number(fromQuality.combinedRating || 0) || (result?.data?.ratingCalculation ? 0.85 : 0),
    effectiveDates:
      Number(fromQuality.effectiveDates || 0) ||
      (effectiveDates.length > 0 ? averageConfidence(effectiveDates.map((item) => ({ confidenceScore: item.confidenceScore || 0.75 }))) : 0),
  };

  RD_RESULT_SECTIONS.forEach((key) => {
    if (!Number.isFinite(confidenceBySection[key])) {
      confidenceBySection[key] = 0;
    }
  });

  return confidenceBySection;
}

function averageConfidence(items) {
  const values = toArray(items)
    .map((item) => Number(item?.confidenceScore || item?.score || 0))
    .filter((score) => Number.isFinite(score) && score > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function normalizeRatingDecisionUploadResult(result, fileNameFallback = null) {
  const data = result?.data || {};
  const metadata = data?.metadata || result?.metadata || {};

  const serviceConnected = toArray(data?.serviceConnected).map((item) => normalizeDecisionCondition(item, 'service-connected')).filter((item) => item.conditionName);
  const denied = toArray(data?.denied).map((item) => normalizeDecisionCondition(item, 'denied')).filter((item) => item.conditionName);

  const smcAdjustments = toArray(data?.smc?.explicit || data?.smcAdjustments || [])
    .map((item) => {
      if (typeof item === 'string') return { code: normalizeSmcCode(item), description: '' };
      return {
        code: normalizeSmcCode(item?.code || item?.level || item?.label),
        description: toText(item?.description || item?.reason || item?.text),
      };
    })
    .filter((item) => item.code);

  const dependentAdjustments = toArray(data?.dependentAdjustments || data?.dependentsDetailed?.added || data?.dependents || []).map((item) => ({
    label: toText(item?.label || item?.name || item?.type || item),
    effectiveDate: normalizeDate(item?.effectiveDate),
    confidenceScore: Number(item?.confidenceScore || 0),
  })).filter((item) => item.label);

  const effectiveDateRows = [
    ...serviceConnected.map((item) => ({
      conditionName: item.conditionName,
      effectiveDate: item.effectiveDate,
      percentage: item.percentage,
      confidenceScore: item.confidenceScore,
    })),
    ...toArray(data?.effectiveDates).map((item) => ({
      conditionName: normalizeConditionName(item?.conditionName || item?.condition || item?.label),
      effectiveDate: normalizeDate(item?.effectiveDate || item?.date || item),
      percentage: Number.isFinite(Number(item?.percentage)) ? Number(item.percentage) : '',
      confidenceScore: Number(item?.confidenceScore || 0),
    })),
  ].filter((item) => item.effectiveDate || item.conditionName);

  const evidenceSpansRaw =
    data?.extractionContract?.evidenceSpans ||
    data?.evidenceSpans ||
    result?.extractionContract?.evidenceSpans ||
    [];

  const evidenceSpans = toArray(evidenceSpansRaw).map(normalizeEvidenceSpan).filter((item) => item.text);

  const combinedRating = (() => {
    const parsed = parsePercentage(data?.ratingCalculation?.calculatedCombinedRating || data?.combinedRating);
    if (Number.isNaN(parsed) || parsed === '') return '';
    return parsed;
  })();

  const decisionMetadata = {
    fileName: toText(fileNameFallback || metadata?.fileName || result?.fileName || 'Uploaded rating decision'),
    scannedAt: new Date().toISOString(),
    ratingDecisionDate: normalizeDate(metadata?.ratingDecisionDate || data?.decisionDate || ''),
    source: 'scanner',
    requiresManualReview: Boolean(result?.quality?.review?.requiresManualReview),
    extractionWarnings: toArray(result?.quality?.review?.notes || result?.quality?.warnings || []),
  };

  const confidenceBySection = normalizeConfidenceBySection(
    result,
    serviceConnected,
    denied,
    smcAdjustments,
    dependentAdjustments,
    effectiveDateRows
  );

  const findings = {
    ...createEmptyExtractedFindings(),
    combinedRating,
    decisionMetadata,
    serviceConnectedConditions: serviceConnected,
    deniedConditions: denied,
    smcAdjustments,
    dependentAdjustments,
    effectiveDates: effectiveDateRows,
    confidenceBySection,
    evidenceSpans,
  };

  return {
    findings,
    quality: result?.quality || null,
    dependsOnManualReview: Boolean(result?.quality?.review?.requiresManualReview),
    statusMessage: serviceConnected.length + denied.length > 0
      ? 'Extraction completed.'
      : 'Extraction completed with limited findings.',
  };
}

function canonicalConditionKey(value) {
  return normalizeConditionName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeManualEntries(entries = []) {
  const map = new Map();
  toArray(entries).forEach((entry) => {
    const key = canonicalConditionKey(entry?.conditionName);
    if (!key || map.has(key)) return;
    map.set(key, entry);
  });
  return Array.from(map.values());
}

export function normalizeManualEntry(entry) {
  const base = createEmptyManualEntry();
  const percentage = parsePercentage(entry?.percentage);
  const combinedRating = parsePercentage(entry?.combinedRating);

  return {
    ...base,
    ...entry,
    id: toText(entry?.id) || `rd-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conditionName: normalizeConditionName(entry?.conditionName),
    percentage: Number.isNaN(percentage) ? '' : percentage,
    effectiveDate: normalizeDate(entry?.effectiveDate),
    isServiceConnected: Boolean(entry?.isServiceConnected),
    isDenied: Boolean(entry?.isDenied),
    denialReason: toText(entry?.denialReason),
    smcCodes: toArray(entry?.smcCodes).map(normalizeSmcCode).filter(Boolean),
    dependents: toText(entry?.dependents),
    combinedRating: Number.isNaN(combinedRating) ? '' : combinedRating,
  };
}

export function validateManualEntry(entry, existingEntries = []) {
  const errors = {};
  const normalized = normalizeManualEntry(entry);

  if (!normalized.conditionName) {
    errors.conditionName = 'Condition name is required';
  }

  if (normalized.isServiceConnected && normalized.percentage === '') {
    errors.percentage = 'Percentage is required for service-connected conditions';
  }

  if (normalized.percentage !== '' && !Number.isInteger(normalized.percentage)) {
    errors.percentage = 'Percentage must be a whole number between 0 and 100';
  }

  if (normalized.percentage !== '' && (normalized.percentage < 0 || normalized.percentage > 100)) {
    errors.percentage = 'Percentage must be between 0 and 100';
  }

  if (toText(entry?.percentage).includes('.') || !/^\s*\d+\s*%?\s*$/.test(String(entry?.percentage || '')) && entry?.percentage !== '' && entry?.percentage !== null && entry?.percentage !== undefined) {
    errors.percentage = 'Percentage must be numeric';
  }

  if (toText(entry?.effectiveDate) && !normalized.effectiveDate) {
    errors.effectiveDate = 'Effective date must be a valid date';
  }

  if (normalized.isServiceConnected && normalized.isDenied) {
    errors.serviceConnection = 'Service-connected and denied cannot both be true';
  }

  if (normalized.isDenied && !normalized.denialReason) {
    errors.denialReason = 'Denial reason is required when denied is true';
  }

  const key = canonicalConditionKey(normalized.conditionName);
  const hasDuplicate = toArray(existingEntries).some((item) => {
    if (toText(item?.id) === normalized.id) return false;
    return canonicalConditionKey(item?.conditionName) === key;
  });

  if (key && hasDuplicate) {
    errors.duplicate = 'Duplicate condition entry detected';
  }

  return errors;
}

export function mergeExtractedFindings(existing, incoming) {
  const base = createEmptyExtractedFindings();
  const merged = { ...base, ...(existing || {}) };
  const next = incoming || {};

  merged.combinedRating = next.combinedRating !== '' && next.combinedRating !== undefined
    ? next.combinedRating
    : merged.combinedRating;

  merged.decisionMetadata = {
    ...(merged.decisionMetadata || {}),
    ...(next.decisionMetadata || {}),
  };

  const mergeConditionRows = (left, right) => {
    const map = new Map();
    [...toArray(left), ...toArray(right)].forEach((item) => {
      const key = `${canonicalConditionKey(item?.conditionName)}|${normalizeDate(item?.effectiveDate)}|${toText(item?.kind)}`;
      if (!key || key.startsWith('|')) return;
      if (!map.has(key)) {
        map.set(key, item);
        return;
      }

      const existingItem = map.get(key);
      const existingScore = Number(existingItem?.confidenceScore || 0);
      const nextScore = Number(item?.confidenceScore || 0);
      if (nextScore > existingScore) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  };

  const mergeSimpleRows = (left, right, keyBuilder) => {
    const map = new Map();
    [...toArray(left), ...toArray(right)].forEach((item) => {
      const key = keyBuilder(item);
      if (!key || map.has(key)) return;
      map.set(key, item);
    });
    return Array.from(map.values());
  };

  merged.serviceConnectedConditions = mergeConditionRows(
    merged.serviceConnectedConditions,
    next.serviceConnectedConditions
  );
  merged.deniedConditions = mergeConditionRows(merged.deniedConditions, next.deniedConditions);

  merged.smcAdjustments = mergeSimpleRows(
    merged.smcAdjustments,
    next.smcAdjustments,
    (item) => normalizeSmcCode(item?.code)
  );

  merged.dependentAdjustments = mergeSimpleRows(
    merged.dependentAdjustments,
    next.dependentAdjustments,
    (item) => `${toText(item?.label)}|${normalizeDate(item?.effectiveDate)}`
  );

  merged.effectiveDates = mergeSimpleRows(
    merged.effectiveDates,
    next.effectiveDates,
    (item) => `${canonicalConditionKey(item?.conditionName)}|${normalizeDate(item?.effectiveDate)}|${parsePercentage(item?.percentage)}`
  );

  merged.evidenceSpans = mergeSimpleRows(
    merged.evidenceSpans,
    next.evidenceSpans,
    (item) => `${toText(item?.section)}|${toText(item?.text)}`
  );

  merged.confidenceBySection = {
    ...(merged.confidenceBySection || {}),
    ...(next.confidenceBySection || {}),
  };

  return merged;
}

export function detectRatingConflicts(manualEntries = [], extractedFindings = createEmptyExtractedFindings()) {
  const conflicts = [];
  const scannedServiceConnected = toArray(extractedFindings?.serviceConnectedConditions);
  const scannedDenied = toArray(extractedFindings?.deniedConditions);

  toArray(manualEntries).forEach((manualEntry) => {
    const manualConditionKey = canonicalConditionKey(manualEntry?.conditionName);
    if (!manualConditionKey) return;

    const scannedSc = scannedServiceConnected.find((item) => canonicalConditionKey(item?.conditionName) === manualConditionKey);
    const scannedDn = scannedDenied.find((item) => canonicalConditionKey(item?.conditionName) === manualConditionKey);

    if (manualEntry?.isServiceConnected && scannedDn) {
      conflicts.push({
        id: `conflict-${manualConditionKey}-status`,
        conditionName: manualEntry.conditionName,
        conflictType: 'status-mismatch',
        manualValue: 'service-connected',
        scannedValue: 'denied',
        message: 'Manual entry marks condition as service-connected but scanner marks denied.',
      });
    }

    if (manualEntry?.isDenied && scannedSc) {
      conflicts.push({
        id: `conflict-${manualConditionKey}-status-reverse`,
        conditionName: manualEntry.conditionName,
        conflictType: 'status-mismatch',
        manualValue: 'denied',
        scannedValue: 'service-connected',
        message: 'Manual entry marks condition as denied but scanner marks service-connected.',
      });
    }

    const scannedComparable = scannedSc || scannedDn;
    if (!scannedComparable) return;

    const manualPercentage = parsePercentage(manualEntry?.percentage);
    const scannedPercentage = parsePercentage(scannedComparable?.percentage);

    if (
      manualPercentage !== '' &&
      scannedPercentage !== '' &&
      !Number.isNaN(manualPercentage) &&
      !Number.isNaN(scannedPercentage) &&
      manualPercentage !== scannedPercentage
    ) {
      conflicts.push({
        id: `conflict-${manualConditionKey}-percentage`,
        conditionName: manualEntry.conditionName,
        conflictType: 'percentage-mismatch',
        manualValue: `${manualPercentage}%`,
        scannedValue: `${scannedPercentage}%`,
        message: 'Manual and scanned percentages are different.',
      });
    }

    const manualDate = normalizeDate(manualEntry?.effectiveDate);
    const scannedDate = normalizeDate(scannedComparable?.effectiveDate);
    if (manualDate && scannedDate && manualDate !== scannedDate) {
      conflicts.push({
        id: `conflict-${manualConditionKey}-effective-date`,
        conditionName: manualEntry.conditionName,
        conflictType: 'effective-date-mismatch',
        manualValue: manualDate,
        scannedValue: scannedDate,
        message: 'Manual and scanned effective dates are different.',
      });
    }
  });

  return conflicts;
}

export function buildRatingTimeline(section) {
  const manualEntries = toArray(section?.manualEntries).map((item) => ({
    conditionName: normalizeConditionName(item?.conditionName),
    percentage: parsePercentage(item?.percentage),
    effectiveDate: normalizeDate(item?.effectiveDate),
    source: 'manual',
    isDenied: Boolean(item?.isDenied),
  }));

  const extracted = section?.extractedFindings || {};
  const scannedEntries = [
    ...toArray(extracted?.serviceConnectedConditions).map((item) => ({
      conditionName: normalizeConditionName(item?.conditionName),
      percentage: parsePercentage(item?.percentage),
      effectiveDate: normalizeDate(item?.effectiveDate),
      source: 'scanner',
      isDenied: false,
    })),
    ...toArray(extracted?.deniedConditions).map((item) => ({
      conditionName: normalizeConditionName(item?.conditionName),
      percentage: parsePercentage(item?.percentage),
      effectiveDate: normalizeDate(item?.effectiveDate),
      source: 'scanner',
      isDenied: true,
    })),
  ];

  const rows = [...manualEntries, ...scannedEntries]
    .filter((item) => item.conditionName && item.effectiveDate)
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));

  const perCondition = new Map();
  rows.forEach((item) => {
    const key = canonicalConditionKey(item.conditionName);
    if (!perCondition.has(key)) perCondition.set(key, []);
    perCondition.get(key).push(item);
  });

  return Array.from(perCondition.values()).map((events) => {
    const sorted = [...events].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    const percentages = sorted
      .map((item) => (Number.isFinite(Number(item.percentage)) ? Number(item.percentage) : null))
      .filter((value) => value !== null);
    const staged = new Set(percentages).size > 1;

    return {
      conditionName: sorted[0]?.conditionName || '',
      staged,
      events: sorted,
    };
  });
}

export function buildSectionConfidenceSummary(extractedFindings = createEmptyExtractedFindings()) {
  const confidence = extractedFindings?.confidenceBySection || {};
  return RD_RESULT_SECTIONS.map((key) => {
    const score = Number(confidence[key] || 0);
    return {
      key,
      score,
      level: confidenceFromScore(score),
    };
  });
}
