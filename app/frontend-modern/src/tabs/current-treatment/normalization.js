import { CT_STATUS_VALUES, CT_TREND_LEVELS, VA_CONDITION_ALIASES, createEmptyExtractedFindings } from './schema.js';

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

/**
 * Map a raw condition name to the preferred VA/ICD-10 terminology.
 * Looks up lowercase compressed key in VA_CONDITION_ALIASES.
 * Returns original if no alias found.
 */
export function normalizeConditionName(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const lower = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return VA_CONDITION_ALIASES[lower] || raw;
}

/**
 * Stable dedup key for a manual entry: normalized condition name + normalized provider name.
 */
export function canonicalEntryKey(entry) {
  const condition = normalizeConditionName(entry?.conditionName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const provider = normalizeText(entry?.providerName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [condition, provider].filter(Boolean).join('|') || '';
}

/**
 * Remove duplicate manual entries by canonicalEntryKey (first occurrence wins).
 */
export function dedupeManualEntries(entries) {
  const map = new Map();
  (entries || []).forEach((entry) => {
    const key = canonicalEntryKey(entry);
    if (key && !map.has(key)) {
      map.set(key, entry);
    }
  });
  return Array.from(map.values());
}

/**
 * Validate a manual entry. Returns an error map; empty map means valid.
 * Validates required fields and medication completeness.
 */
export function validateManualEntry(entry) {
  const errors = {};

  if (!normalizeText(entry?.conditionName)) {
    errors.conditionName = 'Condition name is required';
  }
  if (!normalizeText(entry?.symptomSummary)) {
    errors.symptomSummary = 'Symptom summary is required';
  }
  if (entry?.status && !CT_STATUS_VALUES.includes(entry.status)) {
    errors.status = `Status must be one of: ${CT_STATUS_VALUES.join(', ')}`;
  }

  const meds = toArray(entry?.medications);
  meds.forEach((med, i) => {
    if (!normalizeText(med?.medicationName)) {
      errors[`medication_${i}_name`] = `Medication ${i + 1}: name is required`;
    }
    if (!normalizeText(med?.dosage)) {
      errors[`medication_${i}_dosage`] = `Medication ${i + 1}: dosage is required`;
    }
  });

  return errors;
}

export function normalizeMedication(med) {
  return {
    medicationName: normalizeText(med?.medicationName),
    dosage: normalizeText(med?.dosage),
    sideEffects: normalizeText(med?.sideEffects),
  };
}

/**
 * Normalize and assign an id to a manual entry.
 */
export function normalizeManualEntry(entry) {
  const conditionName = normalizeConditionName(entry?.conditionName);
  const status = CT_STATUS_VALUES.includes(entry?.status) ? entry.status : 'active';
  const normalized = {
    id: normalizeText(entry?.id),
    conditionName,
    symptomSummary: normalizeText(entry?.symptomSummary),
    status,
    providerName: normalizeText(entry?.providerName),
    providerType: normalizeText(entry?.providerType),
    treatmentDetails: normalizeText(entry?.treatmentDetails),
    treatmentStartDate: normalizeDate(entry?.treatmentStartDate),
    treatmentEndDate: normalizeDate(entry?.treatmentEndDate),
    medications: toArray(entry?.medications).map(normalizeMedication),
  };

  if (!normalized.id) {
    normalized.id = `ct-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return normalized;
}

function toItemLabel(item) {
  if (typeof item === 'string') return normalizeText(item);
  return normalizeText(
    item?.value || item?.label || item?.condition || item?.name || item?.displayName || ''
  );
}

/**
 * Normalize a treatment scanner response into the extractedFindings object shape.
 * Handles both new API shape (data.currentConditions) and legacy shapes.
 */
export function normalizeExtractionResult(result, fileNameFallback = null) {
  const data = result?.data || {};
  const meta = result?.extractionMeta || {};
  const fileName = normalizeText(meta?.fileName || fileNameFallback || 'Uploaded treatment document');

  const toLabels = (arr) => toArray(arr).map(toItemLabel).filter(Boolean);

  const extractEvidence = (arr) =>
    toArray(arr)
      .map((item) => {
        const label = toItemLabel(item);
        const snippet = normalizeText(
          item?.context || item?.snippet || item?.window || item?.matchedText || ''
        );
        return label ? (snippet ? `${label} — ${snippet}` : label) : '';
      })
      .filter(Boolean);

  const treatmentEvents = [
    ...toLabels(data?.appointments || []),
    ...toLabels(data?.treatments || []),
    ...toLabels(data?.events || []),
  ];

  const providerSignals = toLabels(data?.providerContinuity || data?.providers || []);
  const medicationMentions = toLabels(data?.medications || data?.medicationMentions || []);
  const worseningIndicators = toLabels(
    data?.worseningConditions || data?.worseningIndicators || data?.trends || []
  );
  const evidenceSnippets = extractEvidence(data?.evidenceSnippets || data?.aiContext || data?.context || []);

  return {
    fileName,
    fileSize: Number(meta?.fileSize || 0) || null,
    pagesScanned: Number(meta?.pagesScanned || 0) || null,
    confidence: Number(meta?.confidence || 0),
    usedOcr: Boolean(meta?.usedOcr),
    extractedAt: new Date().toISOString(),
    findings: {
      currentConditions: toLabels(data?.currentConditions || data?.diagnoses || data?.Diagnoses || []),
      functionalLimitations: toLabels(
        data?.functionalLimitations || data?.injuries || data?.Injuries || []
      ),
      treatmentEvents,
      providerSignals,
      medicationMentions,
      worseningIndicators,
      evidenceSnippets,
    },
  };
}

/**
 * Merge two extractedFindings objects, deduplicating each category by normalized text.
 */
export function mergeExtractedFindings(existing, incoming) {
  const base = createEmptyExtractedFindings();
  const keys = Object.keys(base);
  const merged = { ...base };

  keys.forEach((key) => {
    const combined = [
      ...toArray(existing?.[key]),
      ...toArray(incoming?.[key]),
    ];
    const seen = new Set();
    merged[key] = combined.filter((item) => {
      const k = normalizeText(item).toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

  return merged;
}

/**
 * Analyze extractedFindings for worsening trend signals.
 * Returns { trend: CT_TREND_LEVELS[n], indicators: string[] }.
 */
export function detectWorseningTrend(section) {
  const ef = section?.extractedFindings || {};
  const worseningIndicators = toArray(ef?.worseningIndicators);
  const medicationMentions = toArray(ef?.medicationMentions);
  const functionalLimitations = toArray(ef?.functionalLimitations);

  if (!worseningIndicators.length && !medicationMentions.length && !functionalLimitations.length) {
    return { trend: 'unknown', indicators: [] };
  }

  const worseningTerms = /(worsening|deteriorating|increasing|progressive|severe|worse|declined|exacerbat)/i;
  const improvingTerms = /(improving|improved|resolved|stable|better|decreased|mild)/i;

  const indicators = [];
  let worseningScore = 0;
  let improvingScore = 0;

  worseningIndicators.forEach((item) => {
    const text = normalizeText(item);
    if (worseningTerms.test(text)) {
      worseningScore += 2;
      indicators.push(text);
    }
    if (improvingTerms.test(text)) {
      improvingScore += 1;
    }
  });

  if (medicationMentions.length >= 4) {
    worseningScore += 1;
    indicators.push(`${medicationMentions.length} medications documented`);
  }

  if (functionalLimitations.length >= 3) {
    worseningScore += 1;
    indicators.push(`${functionalLimitations.length} functional limitations documented`);
  }

  let trend;
  if (worseningScore >= 2) {
    trend = 'worsening';
  } else if (improvingScore > worseningScore) {
    trend = 'improving';
  } else if (worseningScore > 0 || medicationMentions.length > 0 || functionalLimitations.length > 0) {
    trend = 'stable';
  } else {
    trend = 'unknown';
  }

  return {
    trend: CT_TREND_LEVELS.includes(trend) ? trend : 'unknown',
    indicators,
  };
}

/**
 * Build a provider-grouped treatment timeline from manual entries and
 * extracted treatmentEvents / providerSignals.
 * Returns: Array<{ provider, events, eventCount, gaps, hasGap }>
 */
export function buildProviderTimeline(section) {
  const manualEntries = toArray(section?.manualEntries);
  const ef = section?.extractedFindings || {};
  const treatmentEvents = toArray(ef?.treatmentEvents);
  const providerSignals = toArray(ef?.providerSignals);

  const groups = new Map();

  manualEntries.forEach((entry) => {
    const provider = normalizeText(entry?.providerName) || 'Unknown Provider';
    const label = normalizeConditionName(normalizeText(entry?.conditionName)) || 'Treatment';
    const date =
      normalizeDate(entry?.treatmentStartDate) || normalizeDate(entry?.treatmentEndDate) || '';

    if (!groups.has(provider)) groups.set(provider, []);
    groups.get(provider).push({ label, date, source: 'manual' });
  });

  treatmentEvents.forEach((event) => {
    const text = normalizeText(event);
    if (!text) return;
    const providerMatch = text.match(/^(Dr\.|Dr|Doctor|NP|PA|ARNP|RN)\s+[\w\s]+?\s*[-—]/i);
    const provider = providerMatch
      ? normalizeText(providerMatch[0]).replace(/[-—\s]+$/, '')
      : 'Extracted from document';
    if (!groups.has(provider)) groups.set(provider, []);
    groups.get(provider).push({ label: text, date: '', source: 'extracted' });
  });

  providerSignals.forEach((signal) => {
    const text = normalizeText(signal);
    if (!text) return;
    if (!groups.has(text)) groups.set(text, []);
  });

  const timeline = Array.from(groups.entries()).map(([provider, events]) => {
    const sortedEvents = events.slice().sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

    const datedEvents = sortedEvents.filter((e) => e.date);
    const gaps = [];
    for (let i = 1; i < datedEvents.length; i++) {
      const prev = new Date(datedEvents[i - 1].date);
      const curr = new Date(datedEvents[i].date);
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diffDays > 180) {
        gaps.push({
          from: datedEvents[i - 1].date,
          to: datedEvents[i].date,
          days: Math.round(diffDays),
        });
      }
    }

    return { provider, events: sortedEvents, eventCount: sortedEvents.length, gaps, hasGap: gaps.length > 0 };
  });

  return timeline.sort((a, b) => b.eventCount - a.eventCount);
}

/**
 * Compute summary counts for the current treatment section.
 */
export function buildCountSummary(section) {
  const manualEntries = toArray(section?.manualEntries);
  const ef = section?.extractedFindings || {};
  return {
    totalConditions: manualEntries.length,
    activeConditions: manualEntries.filter((e) => e?.status === 'active').length,
    providerCount: new Set(
      manualEntries.map((e) => normalizeText(e?.providerName)).filter(Boolean)
    ).size,
    extractedConditionCount: toArray(ef?.currentConditions).length,
    extractedMedicationCount: toArray(ef?.medicationMentions).length,
  };
}
