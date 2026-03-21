import { STR_CONFIDENCE_LEVELS } from './schema.js';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeComparisonValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getItemLabel(item) {
  if (typeof item === 'string') {
    return normalizeText(item);
  }

  return normalizeText(item?.label || item?.condition || item?.displayName || item?.location || item?.categoryLabel);
}

function getItemDates(item) {
  if (Array.isArray(item?.dates) && item.dates.length > 0) {
    return item.dates.map(normalizeDate).filter(Boolean);
  }

  if (Array.isArray(item?.allOccurrences)) {
    const all = item.allOccurrences.flatMap((occurrence) => toArray(occurrence?.dates).map(normalizeDate));
    const unique = Array.from(new Set(all.filter(Boolean)));
    if (unique.length > 0) {
      return unique;
    }
  }

  const directDate = normalizeDate(item?.date || item?.dateOfEvent || item?.firstOccurrence?.date);
  return directDate ? [directDate] : [];
}

function getItemSnippet(item) {
  const fields = [
    item?.description,
    item?.matchedText,
    item?.context,
    item?.window,
    item?.symptomSummary,
    item?.continuityNotes,
    item?.nexusIndicators,
  ];

  const direct = fields.map(normalizeText).find(Boolean);
  if (direct) {
    return direct;
  }

  if (Array.isArray(item?.allOccurrences)) {
    const fromOccurrence = item.allOccurrences
      .flatMap((occurrence) => [occurrence?.matchedText, occurrence?.context, occurrence?.window])
      .map(normalizeText)
      .find(Boolean);
    if (fromOccurrence) {
      return fromOccurrence;
    }
  }

  return '';
}

function toScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) {
      return Math.max(0, Math.min(1, value));
    }
    return Math.max(0, Math.min(1, value / 100));
  }

  const text = normalizeText(value).toLowerCase();
  if (!text) {
    return 0.6;
  }

  if (text.includes('high')) return 0.9;
  if (text.includes('medium') || text.includes('moderate')) return 0.7;
  if (text.includes('low')) return 0.45;
  return 0.6;
}

export function scoreToConfidenceLevel(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.55) return 'medium';
  return 'low';
}

function normalizeOccurrence(item) {
  const occurrences = toArray(item?.allOccurrences);
  return occurrences.map((occurrence, index) => ({
    position: Number(occurrence?.position || index + 1),
    page: Number(occurrence?.page || 0) || null,
    dates: toArray(occurrence?.dates).map(normalizeDate).filter(Boolean),
    matchedText: normalizeText(occurrence?.matchedText),
    context: normalizeText(occurrence?.context || occurrence?.window),
  }));
}

export function normalizeUploadedFinding(rawItem, findingType, sourceFileName) {
  const label = getItemLabel(rawItem);
  if (!label) {
    return null;
  }

  const dates = getItemDates(rawItem);
  const score = toScore(rawItem?.confidence?.score ?? rawItem?.confidenceScore ?? rawItem?.confidence?.value ?? rawItem?.confidence?.level);
  const confidenceLevel = scoreToConfidenceLevel(score);

  return {
    id: '',
    findingType,
    conditionName: label,
    dateOfEvent: dates[0] || '',
    dates,
    description: getItemSnippet(rawItem),
    provider: normalizeText(rawItem?.provider),
    category: normalizeText(rawItem?.category || rawItem?.categoryId || rawItem?.categoryLabel),
    severity: normalizeText(rawItem?.severity?.interpretation || rawItem?.severity),
    sourceFileName: normalizeText(sourceFileName),
    confidenceScore: score,
    confidenceLevel,
    allOccurrences: normalizeOccurrence(rawItem),
    manualEntry: false,
  };
}

export function normalizeUploadResultToFindings(result) {
  const extracted = result?.Extracted || result?.extracted || {};
  const sourceFileName = normalizeText(result?.metadata?.fileName || result?.fileName || 'Uploaded STR document');

  const grouped = [
    { key: 'Diagnoses', findingType: 'diagnosis' },
    { key: 'Injuries', findingType: 'injury' },
    { key: 'Events', findingType: 'event' },
    { key: 'PresumptiveLocations', findingType: 'presumptive-location' },
  ];

  return grouped.flatMap(({ key, findingType }) => {
    return toArray(extracted?.[key]).map((item) => normalizeUploadedFinding(item, findingType, sourceFileName)).filter(Boolean);
  });
}

export function canonicalFindingKey(entry) {
  return [
    normalizeComparisonValue(entry?.conditionName),
    normalizeComparisonValue(entry?.findingType),
    normalizeDate(entry?.dateOfEvent),
  ].join('|');
}

export function dedupeFindings(entries = []) {
  const map = new Map();

  entries.forEach((entry) => {
    const normalized = {
      ...entry,
      conditionName: normalizeText(entry?.conditionName),
      dateOfEvent: normalizeDate(entry?.dateOfEvent),
      dates: Array.from(new Set(toArray(entry?.dates).map(normalizeDate).filter(Boolean))),
      description: normalizeText(entry?.description),
      provider: normalizeText(entry?.provider),
      sourceFileName: normalizeText(entry?.sourceFileName),
      confidenceLevel: STR_CONFIDENCE_LEVELS.includes(entry?.confidenceLevel) ? entry.confidenceLevel : scoreToConfidenceLevel(toScore(entry?.confidenceScore)),
      confidenceScore: toScore(entry?.confidenceScore),
      manualEntry: Boolean(entry?.manualEntry),
      allOccurrences: toArray(entry?.allOccurrences),
    };

    const key = canonicalFindingKey(normalized);
    if (!key) {
      return;
    }

    if (!map.has(key)) {
      map.set(key, {
        ...normalized,
        id: normalized.id || key,
      });
      return;
    }

    const current = map.get(key);
    const mergedOccurrences = [
      ...toArray(current?.allOccurrences),
      ...toArray(normalized?.allOccurrences),
    ];

    const mergedDates = Array.from(new Set([
      ...toArray(current?.dates),
      ...toArray(normalized?.dates),
      normalizeDate(current?.dateOfEvent),
      normalizeDate(normalized?.dateOfEvent),
    ].filter(Boolean))).sort();

    map.set(key, {
      ...current,
      ...normalized,
      id: current.id || normalized.id || key,
      dateOfEvent: current.dateOfEvent || normalized.dateOfEvent,
      dates: mergedDates,
      description: current.description || normalized.description,
      provider: current.provider || normalized.provider,
      sourceFileName: current.sourceFileName || normalized.sourceFileName,
      confidenceScore: Math.max(Number(current.confidenceScore || 0), Number(normalized.confidenceScore || 0)),
      confidenceLevel: scoreToConfidenceLevel(Math.max(Number(current.confidenceScore || 0), Number(normalized.confidenceScore || 0))),
      allOccurrences: mergedOccurrences,
      duplicateCount: Number(current.duplicateCount || 0) + 1,
    });
  });

  return Array.from(map.values()).sort((left, right) => {
    const leftDate = Date.parse(left.dateOfEvent || '9999-12-31');
    const rightDate = Date.parse(right.dateOfEvent || '9999-12-31');
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }
    return String(left.conditionName || '').localeCompare(String(right.conditionName || ''));
  });
}

export function validateManualEntry(entry) {
  const errors = {};

  if (!normalizeText(entry?.conditionName)) {
    errors.conditionName = 'Condition name is required';
  }
  if (!normalizeDate(entry?.dateOfEvent)) {
    errors.dateOfEvent = 'Date of event is required (YYYY-MM-DD)';
  }
  if (!normalizeText(entry?.description)) {
    errors.description = 'Description is required';
  }

  return errors;
}

export function normalizeManualEntry(entry) {
  const normalized = {
    id: '',
    findingType: normalizeText(entry?.findingType) || 'event',
    conditionName: normalizeText(entry?.conditionName),
    dateOfEvent: normalizeDate(entry?.dateOfEvent),
    dates: normalizeDate(entry?.dateOfEvent) ? [normalizeDate(entry?.dateOfEvent)] : [],
    description: normalizeText(entry?.description),
    provider: normalizeText(entry?.provider),
    category: '',
    severity: normalizeText(entry?.severity) || 'moderate',
    sourceFileName: 'Manual Entry',
    confidenceScore: 1,
    confidenceLevel: 'manual',
    allOccurrences: [],
    manualEntry: true,
    exposureType: normalizeText(entry?.exposureType),
    lineOfDuty: normalizeText(entry?.lineOfDuty) || 'Yes',
    inServiceEvent: Boolean(entry?.inServiceEvent),
    chronicityEvidence: normalizeText(entry?.chronicityEvidence),
    continuityNotes: normalizeText(entry?.continuityNotes),
    nexusIndicators: normalizeText(entry?.nexusIndicators),
  };

  normalized.id = entry?.id || canonicalFindingKey(normalized) || `manual-${Date.now()}`;
  return normalized;
}

export function buildConfidenceLevels(findings = []) {
  return findings.reduce((acc, finding) => {
    const level = STR_CONFIDENCE_LEVELS.includes(finding?.confidenceLevel) ? finding.confidenceLevel : 'low';
    acc[level] += 1;
    return acc;
  }, { high: 0, medium: 0, low: 0, manual: 0 });
}

export function buildDedupedTimeline(findings = []) {
  const points = [];

  findings.forEach((finding) => {
    const label = normalizeText(finding?.conditionName);
    if (!label) {
      return;
    }

    const dates = toArray(finding?.dates).length > 0 ? finding.dates : [finding?.dateOfEvent];
    dates.map(normalizeDate).filter(Boolean).forEach((date) => {
      points.push({
        date,
        label,
        findingType: finding?.findingType || 'event',
        confidenceLevel: finding?.confidenceLevel || 'low',
        sourceFileName: normalizeText(finding?.sourceFileName || 'Unknown source'),
      });
    });
  });

  const seen = new Set();
  return points
    .filter((point) => {
      const key = `${point.date}|${normalizeComparisonValue(point.label)}|${point.findingType}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
}

export function buildConditionWorkspaceDraft(finding) {
  const conditionName = normalizeText(finding?.conditionName);
  if (!conditionName) {
    return null;
  }

  return {
    conditionName,
    diagnosisDate: normalizeDate(finding?.dateOfEvent),
    symptomSummary: normalizeText(finding?.description) || `Imported from STR ${finding?.findingType || 'finding'}`,
    provider: normalizeText(finding?.provider),
    severity: normalizeText(finding?.severity) || 'moderate',
    treatmentPlan: '',
    medications: '',
    status: 'active',
    importedFromWorkflow: true,
    sourceEvidence: [
      {
        label: conditionName,
        sourceName: normalizeText(finding?.sourceFileName || 'Service Treatment Records'),
        evidenceType: finding?.findingType || 'event',
        sourceType: 'strs',
        date: normalizeDate(finding?.dateOfEvent) || null,
        summaryText: normalizeText(finding?.description) || null,
      },
    ],
  };
}
