// Pure workspace derivation functions — no React dependencies.
// Extracted from ClaimWorkspaceContext so they can be tested in isolation
// and reused without importing the full React context tree.

import exposureIndex from '../../../../knowledge/exposures/exposure-index.json';

export function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function canonicalExposureKey(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) {
    return '';
  }

  if (raw.includes('afff') || raw.includes('pfas')) return 'afff-pfas';
  if (raw.includes('burn pit')) return 'burn-pits';
  if (raw.includes('airborne hazards')) return 'airborne-hazards';
  if (raw.startsWith('noise')) return 'noise';
  if (raw.startsWith('asbestos')) return 'asbestos';
  if (raw.startsWith('radiation') || raw.includes('ionizing radiation')) return 'radiation';
  if (raw.includes('jp-8') || raw.includes('jp8') || raw.includes('jet fuel')) return 'jp8-jet-fuel';
  if (raw.startsWith('solvents')) return 'solvents';
  if (raw.startsWith('lead')) return 'lead';
  if (raw.startsWith('mold')) return 'mold';

  return raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeExposureOptions(values = []) {
  const options = [];
  const keyToIndex = new Map();

  values.forEach((value) => {
    const label = String(value || '').trim();
    if (!label) {
      return;
    }

    const key = canonicalExposureKey(label);
    if (!key) {
      return;
    }

    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, options.length);
      options.push(label);
      return;
    }

    const existingIndex = keyToIndex.get(key);
    const existing = options[existingIndex];
    if (label.length < existing.length) {
      options[existingIndex] = label;
    }
  });

  return options.sort((a, b) => a.localeCompare(b));
}

function normalizeMosCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const EXPOSURE_INDEX_ENTRIES = Array.isArray(exposureIndex)
  ? exposureIndex
  : Array.isArray(exposureIndex?.default)
    ? exposureIndex.default
    : Array.isArray(exposureIndex?.value)
      ? exposureIndex.value
      : [];

function getExposureFamiliesFromMos(mosValue) {
  const normalized = normalizeMosCode(mosValue);
  if (!normalized) {
    return [];
  }

  return EXPOSURE_INDEX_ENTRIES.filter((entry) => {
    const examples = Array.isArray(entry?.examples) ? entry.examples : [];
    return examples.some((example) => normalizeMosCode(example) === normalized);
  });
}

const SECONDARY_RELATION_RULES = [
  {
    id: 'mental-health',
    primaryKeywords: ['ptsd', 'post traumatic stress', 'anxiety', 'depression', 'adjustment disorder'],
    secondaryKeywords: ['sleep apnea', 'insomnia', 'migraine', 'headache', 'gerd', 'ibs', 'hypertension', 'tmj', 'bruxism'],
    confidence: 0.78,
    rationale: 'Mental health conditions can aggravate sleep, headache, gastrointestinal, and cardiovascular symptoms.',
  },
  {
    id: 'musculoskeletal-chain',
    primaryKeywords: ['knee', 'ankle', 'hip', 'foot', 'back', 'lumbar', 'cervical', 'spine', 'shoulder'],
    secondaryKeywords: ['radiculopathy', 'sciatica', 'gait', 'hip pain', 'knee pain', 'ankle pain', 'back pain', 'joint pain'],
    confidence: 0.74,
    rationale: 'Orthopedic injuries can alter gait/biomechanics and contribute to secondary joint or nerve conditions.',
  },
  {
    id: 'diabetes',
    primaryKeywords: ['diabetes'],
    secondaryKeywords: ['neuropathy', 'kidney', 'renal', 'retinopathy', 'vision', 'erectile dysfunction', 'hypertension'],
    confidence: 0.82,
    rationale: 'Diabetes can drive neuropathic, renal, ocular, and vascular complications.',
  },
  {
    id: 'tbi',
    primaryKeywords: ['tbi', 'traumatic brain injury', 'concussion'],
    secondaryKeywords: ['migraine', 'headache', 'dizziness', 'vertigo', 'memory', 'cognitive', 'sleep'],
    confidence: 0.8,
    rationale: 'TBI frequently leads to chronic headaches, vestibular symptoms, and cognitive sequelae.',
  },
  {
    id: 'respiratory',
    primaryKeywords: ['asthma', 'copd', 'rhinitis', 'sinusitis'],
    secondaryKeywords: ['sleep apnea', 'bronchitis', 'sinus', 'headache'],
    confidence: 0.68,
    rationale: 'Chronic respiratory and sinus disease can contribute to sleep and headache-related secondary symptoms.',
  },
];

const SECONDARY_EXCLUDED_TOKENS = ['condition', 'diagnosis', 'event', 'injury', 'history'];

function getSecondaryModeConfig(mode) {
  const normalizedMode = ['conservative', 'balanced', 'aggressive'].includes(mode) ? mode : 'balanced';

  const configByMode = {
    conservative: {
      mode: 'conservative',
      minConfidence: 0.79,
      maxConnections: 1,
      scoreBoostFloor: 7,
      scoreBoostCeil: 10,
    },
    balanced: {
      mode: 'balanced',
      minConfidence: 0.73,
      maxConnections: 2,
      scoreBoostFloor: 8,
      scoreBoostCeil: 12,
    },
    aggressive: {
      mode: 'aggressive',
      minConfidence: 0.66,
      maxConnections: 3,
      scoreBoostFloor: 9,
      scoreBoostCeil: 14,
    },
  };

  return configByMode[normalizedMode];
}

export function normalizeComparisonValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:left|right|bilateral|condition|diagnosis|disorder|pain|injury|symptoms?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function labelsMatch(left, right) {
  const a = normalizeComparisonValue(left);
  const b = normalizeComparisonValue(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function containsKeyword(value, keywords = []) {
  const normalized = normalizeComparisonValue(value);
  if (!normalized) return false;

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeComparisonValue(keyword);
    return normalizedKeyword && normalized.includes(normalizedKeyword);
  });
}

function findSecondaryConnections(conditionLabel, ratedConditions = []) {
  const normalizedCondition = normalizeComparisonValue(conditionLabel);
  if (!normalizedCondition || SECONDARY_EXCLUDED_TOKENS.includes(normalizedCondition)) {
    return [];
  }

  const connections = [];

  ratedConditions.forEach((rated) => {
    if (labelsMatch(rated.condition, conditionLabel)) {
      return;
    }

    SECONDARY_RELATION_RULES.forEach((rule) => {
      const primaryMatch = containsKeyword(rated.condition, rule.primaryKeywords);
      const secondaryMatch = containsKeyword(conditionLabel, rule.secondaryKeywords);

      if (!primaryMatch || !secondaryMatch) {
        return;
      }

      connections.push({
        primaryCondition: rated.condition,
        ruleId: rule.id,
        confidence: Number(rule.confidence || 0.7),
        rationale: rule.rationale,
      });
    });
  });

  return uniqueReferenceItems(
    connections.map((item) => ({
      label: `${item.primaryCondition}:${item.ruleId}`,
      sourceName: item.primaryCondition,
      evidenceType: item.ruleId,
      sourceType: 'secondary',
      ...item,
    }))
  )
    .map(({ primaryCondition, ruleId, confidence, rationale }) => ({
    primaryCondition,
    ruleId,
    confidence,
    rationale,
    }))
    .sort((left, right) => right.confidence - left.confidence);
}

export function getDocumentItems(doc, key) {
  if (Array.isArray(doc?.[key])) {
    return doc[key];
  }

  const extracted = doc?.Extracted || {};
  const map = {
    diagnoses: extracted.Diagnoses,
    injuries: extracted.Injuries,
    events: extracted.Events,
    conditions: doc?.conditions,
    symptoms: extracted.Events,
  };

  return Array.isArray(map[key]) ? map[key] : [];
}

export function collectLabels(documents, keys = ['diagnoses', 'injuries', 'events', 'conditions']) {
  const labels = [];

  (documents || []).forEach((doc) => {
    keys.forEach((key) => {
      const items = getDocumentItems(doc, key);
      items.forEach((item) => {
        if (typeof item === 'string') {
          labels.push(item);
          return;
        }

        labels.push(item?.label || item?.condition || item?.displayName || '');
      });
    });
  });

  return uniqueStrings(labels);
}

export function getSourceName(doc, fallbackLabel) {
  return String(doc?.fileName || doc?.metadata?.fileName || doc?.name || fallbackLabel || 'Unknown source').trim();
}

export function getEvidenceLabel(item) {
  if (typeof item === 'string') {
    return item;
  }

  return item?.label || item?.condition || item?.displayName || '';
}

function getItemDates(item) {
  if (Array.isArray(item?.dates) && item.dates.length > 0) {
    return item.dates.filter(Boolean);
  }

  if (Array.isArray(item?.allOccurrences)) {
    return uniqueStrings(item.allOccurrences.flatMap((occurrence) => occurrence?.dates || []));
  }

  const firstOccurrenceDates = Array.isArray(item?.firstOccurrence?.dates) ? item.firstOccurrence.dates : [];
  if (firstOccurrenceDates.length > 0) {
    return uniqueStrings(firstOccurrenceDates);
  }

  const directDate = String(item?.date || item?.dateOfEvent || '').trim();
  return directDate ? [directDate] : [];
}

function getItemSnippet(item) {
  const direct = [
    item?.description,
    item?.symptomSummary,
    item?.continuityNotes,
    item?.nexusIndicators,
    item?.matchedText,
  ].find((value) => String(value || '').trim());

  if (direct) {
    return String(direct).trim();
  }

  const occurrenceSnippet = Array.isArray(item?.allOccurrences)
    ? item.allOccurrences.map((occurrence) => String(occurrence?.matchedText || '').trim()).find(Boolean)
    : '';

  if (occurrenceSnippet) {
    return occurrenceSnippet;
  }

  return '';
}

function buildEvidenceSummary(item) {
  const snippet = getItemSnippet(item);
  if (snippet) {
    return snippet;
  }

  const summaryParts = [];

  if (item?.totalOccurrences) {
    summaryParts.push(`${item.totalOccurrences} occurrence${item.totalOccurrences === 1 ? '' : 's'} documented`);
  }

  if (item?.followUps > 0) {
    summaryParts.push(`${item.followUps} follow-up${item.followUps === 1 ? '' : 's'}`);
  }

  if (item?.firstOccurrence?.page) {
    summaryParts.push(`first noted on page ${item.firstOccurrence.page}`);
  }

  if (item?.severity?.interpretation) {
    summaryParts.push(`severity noted as ${item.severity.interpretation}`);
  }

  if (item?.confidence?.level) {
    summaryParts.push(`${String(item.confidence.level).toLowerCase()} confidence extraction`);
  }

  return summaryParts.join(' • ');
}

export function uniqueReferenceItems(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const signature = [
      normalizeComparisonValue(item?.label),
      String(item?.sourceName || '').trim().toLowerCase(),
      String(item?.evidenceType || '').trim().toLowerCase(),
      String(item?.sourceType || '').trim().toLowerCase(),
    ].join('|');

    if (!signature || seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

export function collectDocumentReferences(documents, entries) {
  const references = [];

  (documents || []).forEach((doc, index) => {
    const sourceName = getSourceName(doc, `Uploaded document ${index + 1}`);

    entries.forEach(({ key, evidenceType, sourceType }) => {
      const items = getDocumentItems(doc, key);
      items.forEach((item) => {
        const label = String(getEvidenceLabel(item)).trim();
        if (!label) {
          return;
        }

        references.push({
          label,
          sourceName,
          evidenceType,
          sourceType,
          date: getItemDates(item)[0] || null,
          dates: getItemDates(item),
          provider: String(item?.provider || '').trim() || null,
          severity: String(item?.severity?.interpretation || item?.severity || '').trim() || null,
          summaryText: buildEvidenceSummary(item) || null,
        });
      });
    });
  });

  return uniqueReferenceItems(references);
}

export function collectManualReferences(entries, sourceType, fallbackLabel) {
  return uniqueReferenceItems((entries || []).map((entry, index) => ({
    label: String(entry?.conditionName || entry?.condition || '').trim(),
    sourceName: String(entry?.providerName || entry?.provider || `${fallbackLabel} ${index + 1}`).trim(),
    evidenceType: 'manual-entry',
    sourceType,
    date: String(entry?.dateOfEvent || entry?.diagnosisDate || entry?.treatmentStartDate || entry?.date || '').trim() || null,
    dates: uniqueStrings([entry?.dateOfEvent, entry?.diagnosisDate, entry?.treatmentStartDate, entry?.date]),
    provider: String(entry?.providerName || entry?.provider || '').trim() || null,
    severity: String(entry?.severity || '').trim() || null,
    summaryText: String(entry?.symptomSummary || entry?.description || entry?.treatmentDetails || entry?.continuityNotes || entry?.nexusIndicators || '').trim() || null,
  })).filter((item) => item.label));
}

export function buildSuggestedTreatmentEntries(conditionRecords = []) {
  return (conditionRecords || [])
    .filter((item) => item?.hasInServiceEvidence && !item?.hasCurrentDiagnosis)
    .map((item) => {
      const inServiceSources = Array.isArray(item?.sourceEvidence?.inService) ? item.sourceEvidence.inService : [];
      const topSources = inServiceSources.slice(0, 3);
      const summaryParts = topSources
        .map((source) => String(source?.summaryText || '').trim())
        .filter(Boolean);

      const fallbackSummary = topSources
        .map((source) => {
          const date = source?.date ? ` on ${source.date}` : '';
          const sourceName = source?.sourceName ? ` from ${source.sourceName}` : '';
          return `${source?.label || item.condition}${date}${sourceName}`.trim();
        })
        .filter(Boolean);

      return {
        conditionName: item.condition,
        diagnosisDate: topSources.find((source) => source?.date)?.date || '',
        symptomSummary: (summaryParts.length > 0 ? summaryParts : fallbackSummary).join(' | ') || 'Imported from earlier STR evidence. Update with current treatment details.',
        provider: topSources.find((source) => source?.provider)?.provider || '',
        severity: (() => {
          const rawSeverity = String(topSources.find((source) => source?.severity)?.severity || '').toLowerCase();
          if (rawSeverity.includes('mild')) return 'mild';
          if (rawSeverity.includes('severe') || rawSeverity.includes('high')) return 'severe';
          return 'moderate';
        })(),
        treatmentPlan: '',
        medications: '',
        status: 'active',
        importedFromWorkflow: true,
        sourceEvidence: topSources,
      };
    })
    .sort((left, right) => left.conditionName.localeCompare(right.conditionName));
}

export function buildSuggestedDecisionEntries(conditionRecords = []) {
  return (conditionRecords || [])
    .filter((item) => item?.hasCurrentDiagnosis && !item?.alreadyRated)
    .map((item) => {
      const currentSources = Array.isArray(item?.sourceEvidence?.current) ? item.sourceEvidence.current : [];
      const inServiceSources = Array.isArray(item?.sourceEvidence?.inService) ? item.sourceEvidence.inService : [];
      const combinedSources = [...currentSources, ...inServiceSources].slice(0, 4);
      const summaryParts = combinedSources
        .map((source) => String(source?.summaryText || '').trim())
        .filter(Boolean);

      const sourceEvidenceSummary = combinedSources
        .map((source) => {
          const label = String(source?.label || item.condition).trim();
          const sourceName = String(source?.sourceName || '').trim();
          const date = String(source?.date || '').trim();
          return [label, sourceName, date].filter(Boolean).join(' • ');
        })
        .filter(Boolean);

      return {
        condition: item.condition,
        status: item.deniedPreviously ? 'denied' : 'service-connected',
        effectiveDate: '',
        laterality: { left: false, right: false },
        suggestedLane: item.recommendedLane,
        readinessState: item.readinessState,
        readinessScore: item.readinessScore,
        readinessReason: item.readinessReason,
        evidenceSummary: (summaryParts.length > 0 ? summaryParts : sourceEvidenceSummary).join(' | ') || 'Imported from earlier workflow evidence.',
        evidenceGaps: Array.isArray(item.evidenceGaps) ? item.evidenceGaps.slice(0, 3) : [],
        sourceEvidence: combinedSources,
        importedFromWorkspace: true,
      };
    })
    .sort((left, right) => left.condition.localeCompare(right.condition));
}

export function collectDecisionReferences(items, sourceName, sourceType) {
  return uniqueReferenceItems((items || []).map((item) => ({
    label: String(getEvidenceLabel(item)).trim(),
    sourceName: String(sourceName || 'Selected VA decision').trim(),
    evidenceType: sourceType === 'rated' ? 'service-connected-condition' : 'denied-condition',
    sourceType,
  })).filter((item) => item.label));
}

export function normalizeServiceSummary(section) {
  const records = Array.isArray(section?.records) ? section.records : [];
  const deployments = records.flatMap((record) => {
    if (Array.isArray(record?.deploymentLocations) && record.deploymentLocations.length > 0) {
      return record.deploymentLocations;
    }
    return record?.serviceProfile?.evidence || [];
  });
  const presumptiveMatches = deployments.filter((item) => item?.presumptiveMatch);
  const mosCodes = uniqueStrings(records.flatMap((record) => {
    const primaryMos = String(record?.primaryMOS || record?.mos || '').trim();
    const additionalMos = Array.isArray(record?.additionalMOS)
      ? record.additionalMOS.map((item) => String(item || '').trim())
      : Array.isArray(record?.additionalMos)
        ? record.additionalMos.map((item) => String(item || '').trim())
      : [];
    return [primaryMos, ...additionalMos];
  }));

  const normalizedRecords = records.map((record) => {
    const recordMosCodes = uniqueStrings([
      String(record?.primaryMOS || record?.mos || '').trim(),
      ...(Array.isArray(record?.additionalMOS)
        ? record.additionalMOS.map((item) => String(item || '').trim())
        : Array.isArray(record?.additionalMos)
          ? record.additionalMos.map((item) => String(item || '').trim())
          : []),
    ]);

    const autoFamilies = uniqueStrings(
      recordMosCodes.flatMap((mosCode) => getExposureFamiliesFromMos(mosCode).map((entry) => String(entry?.family || '').trim()))
    );

    const autoExposures = dedupeExposureOptions(
      recordMosCodes.flatMap((mosCode) => getExposureFamiliesFromMos(mosCode).flatMap((entry) => (
        Array.isArray(entry?.exposures) ? entry.exposures : []
      )))
    );

    const selectedExposures = dedupeExposureOptions(
      [
        ...(Array.isArray(record?.likelyExposures) ? record.likelyExposures : []),
        ...(Array.isArray(record?.hazardPayIndicators) ? record.hazardPayIndicators : []),
        ...(Array.isArray(record?.radiationExposure) ? record.radiationExposure : []),
      ]
    );

    return {
      id: String(record?.id || '').trim(),
      branch: String(record?.branchOfService || record?.branch || '').trim(),
      mos: String(record?.primaryMOS || record?.mos || '').trim(),
      additionalMos: recordMosCodes,
      exposures: selectedExposures,
      exposureNotes: '',
      autoMappedExposures: autoExposures,
      mosFamilyExposures: autoFamilies,
    };
  });

  const selectedExposures = dedupeExposureOptions(normalizedRecords.flatMap((record) => record.exposures));
  const autoMappedExposures = dedupeExposureOptions(normalizedRecords.flatMap((record) => record.autoMappedExposures));
  const mosFamilyExposures = uniqueStrings(normalizedRecords.flatMap((record) => record.mosFamilyExposures));

  return {
    recordCount: records.length,
    deploymentCount: deployments.length,
    presumptiveMatches: presumptiveMatches.length,
    branches: uniqueStrings(records.map((record) => record?.branchOfService || record?.branch)),
    mosCodes,
    combatVeteran: records.some((record) => Boolean(record?.combatVeteran)),
    selectedExposures,
    autoMappedExposures,
    mosFamilyExposures,
    serviceRecords: normalizedRecords,
  };
}

export function normalizeProfileSummary(profile, serviceSummary) {
  const firstName = String(profile?.firstName || '').trim();
  const lastName = String(profile?.lastName || '').trim();
  const city = String(profile?.city || '').trim();
  const state = String(profile?.state || '').trim();
  const email = String(profile?.email || '').trim();
  const phone = String(profile?.phone || '').trim();

  return {
    fullName: [firstName, lastName].filter(Boolean).join(' ').trim(),
    location: [city, state].filter(Boolean).join(', ').trim(),
    email,
    phone,
    branchSummary: uniqueStrings(serviceSummary?.branches || []).join(', '),
    mosSummary: uniqueStrings(serviceSummary?.mosCodes || []).join(', '),
  };
}

export function normalizeStrSummary(section) {
  const uploadedDocuments = Array.isArray(section?.uploadedDocuments) ? section.uploadedDocuments : [];
  const extractedFindings = Array.isArray(section?.extractedFindings) ? section.extractedFindings : [];
  const manualEntries = Array.isArray(section?.manualEntries) ? section.manualEntries : [];

  const findingsByType = extractedFindings.reduce((acc, item) => {
    const findingType = String(item?.findingType || '').toLowerCase();
    const label = String(item?.conditionName || item?.label || '').trim();
    if (!label) {
      return acc;
    }

    if (findingType === 'diagnosis') {
      acc.diagnoses.push(label);
    } else if (findingType === 'injury') {
      acc.injuries.push(label);
    } else if (findingType === 'event') {
      acc.events.push(label);
    }

    return acc;
  }, { diagnoses: [], injuries: [], events: [] });

  const legacyDiagnoses = collectLabels(uploadedDocuments, ['diagnoses']);
  const legacyInjuries = collectLabels(uploadedDocuments, ['injuries']);
  const legacyEvents = collectLabels(uploadedDocuments, ['events']);

  return {
    uploadedCount: extractedFindings.length > 0
      ? extractedFindings.filter((item) => !item?.manualEntry).length
      : uploadedDocuments.length,
    manualCount: manualEntries.length,
    diagnoses: uniqueStrings([...findingsByType.diagnoses, ...legacyDiagnoses]),
    injuries: uniqueStrings([...findingsByType.injuries, ...legacyInjuries]),
    events: uniqueStrings([...findingsByType.events, ...legacyEvents]),
    manualConditions: uniqueStrings(manualEntries.map((item) => item?.conditionName || item?.condition)),
  };
}

export function normalizeCurrentTreatmentSummary(section) {
  const uploadedDocuments = Array.isArray(section?.uploadedDocuments) ? section.uploadedDocuments : [];
  const manualEntries = Array.isArray(section?.manualEntries) ? section.manualEntries : [];

  // New schema: extractedFindings is an object with 7 arrays.
  const ef = section?.extractedFindings;
  const hasNewSchema = ef && typeof ef === 'object' && !Array.isArray(ef);
  const extractedConditions = hasNewSchema && Array.isArray(ef.currentConditions) ? ef.currentConditions : [];
  const extractedSymptoms = hasNewSchema && Array.isArray(ef.functionalLimitations) ? ef.functionalLimitations : [];
  const extractedProviders = hasNewSchema && Array.isArray(ef.providerSignals) ? ef.providerSignals : [];

  const legacyDiagnoses = collectLabels(uploadedDocuments, ['diagnoses', 'conditions']);
  const legacySymptoms = collectLabels(uploadedDocuments, ['symptoms', 'events']);

  return {
    uploadedCount: hasNewSchema
      ? extractedConditions.length + extractedSymptoms.length
      : uploadedDocuments.length,
    manualCount: manualEntries.length,
    currentDiagnoses: uniqueStrings([...extractedConditions, ...legacyDiagnoses]),
    currentSymptoms: uniqueStrings([...extractedSymptoms, ...legacySymptoms]),
    providers: uniqueStrings([
      ...extractedProviders,
      ...manualEntries.map((item) => item?.providerName || item?.provider),
    ]),
    manualConditions: uniqueStrings(manualEntries.map((item) => item?.conditionName || item?.condition)),
  };
}

export function normalizeVaSummary(section) {
  const manualEntries = Array.isArray(section?.manualEntries) ? section.manualEntries : [];
  const extractedFindings = section?.extractedFindings && typeof section.extractedFindings === 'object' && !Array.isArray(section.extractedFindings)
    ? section.extractedFindings
    : {};

  const extractedConditions = Array.isArray(extractedFindings?.serviceConnectedConditions)
    ? extractedFindings.serviceConnectedConditions
    : [];
  const extractedDenied = Array.isArray(extractedFindings?.deniedConditions)
    ? extractedFindings.deniedConditions
    : [];

  // Legacy fallback for older workspace snapshots.
  const decisions = Array.isArray(section?.decisions) ? section.decisions : [];
  const selectedDecision = section?.selectedDecision || null;
  const selectedConditions = Array.isArray(selectedDecision?.conditions) ? selectedDecision.conditions : [];
  const selectedDenied = Array.isArray(selectedDecision?.deniedConditions) ? selectedDecision.deniedConditions : [];

  const manualRated = manualEntries.filter((entry) => entry?.isServiceConnected);
  const manualDenied = manualEntries.filter((entry) => entry?.isDenied);
  const combinedRating = Number(
    extractedFindings?.combinedRating
    || manualEntries.find((entry) => Number.isFinite(Number(entry?.combinedRating)))?.combinedRating
    || section?.entitlementSnapshot?.rating
    || selectedDecision?.rating
    || 0
  );

  return {
    decisionCount: extractedConditions.length + extractedDenied.length + manualEntries.length > 0
      ? 1
      : decisions.length,
    rating: Number.isFinite(combinedRating) ? combinedRating : 0,
    serviceConnectedConditions: uniqueStrings([
      ...extractedConditions.map((item) => item?.conditionName || item?.label || item?.condition || item),
      ...manualRated.map((item) => item?.conditionName || item?.condition),
      ...selectedConditions.map((item) => item?.label || item?.condition || item),
    ]),
    deniedConditions: uniqueStrings([
      ...extractedDenied.map((item) => item?.conditionName || item?.label || item?.condition || item),
      ...manualDenied.map((item) => item?.conditionName || item?.condition),
      ...selectedDenied.map((item) => item?.label || item?.condition || item),
    ]),
    dependents: section?.entitlementSnapshot?.dependents || { spouse: 0, children: 0, parents: 0 },
  };
}

function upsertConditionRecord(records, label, source, meta = {}) {
  const normalizedLabel = String(label || '').trim();
  if (!normalizedLabel) {
    return;
  }

  const existingRecord = records.find(
    (record) =>
      labelsMatch(record.condition, normalizedLabel) ||
      record.aliases.some((alias) => labelsMatch(alias, normalizedLabel))
  );

  if (existingRecord) {
    existingRecord.aliases = uniqueStrings([...existingRecord.aliases, normalizedLabel]);
    existingRecord[source] = uniqueStrings([...(existingRecord[source] || []), normalizedLabel]);
    if (!existingRecord.primaryLabel && normalizedLabel) {
      existingRecord.primaryLabel = normalizedLabel;
    }
    if (meta.isManual) {
      existingRecord.manualSourceCount += 1;
    }
    if (meta.fromUpload) {
      existingRecord.uploadedSourceCount += 1;
    }
    return;
  }

  records.push({
    condition: normalizedLabel,
    primaryLabel: normalizedLabel,
    aliases: [normalizedLabel],
    strs: source === 'strs' ? [normalizedLabel] : [],
    current: source === 'current' ? [normalizedLabel] : [],
    rated: source === 'rated' ? [normalizedLabel] : [],
    denied: source === 'denied' ? [normalizedLabel] : [],
    manualSourceCount: meta.isManual ? 1 : 0,
    uploadedSourceCount: meta.fromUpload ? 1 : 0,
  });
}

export function deriveConditionRecords(serviceSummary, strsSection, currentSection, vaSection, strsSummary, treatmentSummary, vaSummary, options = {}) {
  const secondaryModeConfig = getSecondaryModeConfig(options.secondaryMatchMode);
  const records = [];
  const extractedFindings = Array.isArray(strsSection?.extractedFindings) ? strsSection.extractedFindings : [];
  const extractedReferences = uniqueReferenceItems(extractedFindings.map((item, index) => ({
    label: String(item?.conditionName || item?.label || '').trim(),
    sourceName: String(item?.sourceFileName || item?.sourceName || `Uploaded document ${index + 1}`).trim(),
    evidenceType: String(item?.findingType || 'event').trim(),
    sourceType: 'strs',
    date: String(item?.dateOfEvent || item?.date || '').trim() || null,
    dates: uniqueStrings([item?.dateOfEvent, ...(Array.isArray(item?.dates) ? item.dates : [])]),
    provider: String(item?.provider || '').trim() || null,
    severity: String(item?.severity || '').trim() || null,
    summaryText: String(item?.description || '').trim() || null,
  })).filter((item) => item.label));
  const strsReferences = uniqueReferenceItems([
    ...extractedReferences,
    ...collectDocumentReferences(strsSection?.uploadedDocuments, [
      { key: 'diagnoses', evidenceType: 'diagnosis', sourceType: 'strs' },
      { key: 'injuries', evidenceType: 'injury', sourceType: 'strs' },
      { key: 'events', evidenceType: 'event', sourceType: 'strs' },
    ]),
    ...collectManualReferences(strsSection?.manualEntries, 'strs', 'STR manual entry'),
  ]);
  // Build extracted references from new currentTreatment extractedFindings object schema.
  const ctEf = currentSection?.extractedFindings;
  const ctExtractedRefs = (ctEf && typeof ctEf === 'object' && !Array.isArray(ctEf))
    ? uniqueReferenceItems([
        ...(Array.isArray(ctEf.currentConditions) ? ctEf.currentConditions : []).map((label) => ({
          label: String(label || '').trim(),
          sourceName: 'Current treatment document',
          evidenceType: 'diagnosis',
          sourceType: 'current',
        })),
        ...(Array.isArray(ctEf.functionalLimitations) ? ctEf.functionalLimitations : []).map((label) => ({
          label: String(label || '').trim(),
          sourceName: 'Current treatment document',
          evidenceType: 'functional-limitation',
          sourceType: 'current',
        })),
      ].filter((item) => item.label))
    : [];
  const currentReferences = uniqueReferenceItems([
    ...ctExtractedRefs,
    ...collectDocumentReferences(currentSection?.uploadedDocuments, [
      { key: 'diagnoses', evidenceType: 'diagnosis', sourceType: 'current' },
      { key: 'conditions', evidenceType: 'condition', sourceType: 'current' },
      { key: 'symptoms', evidenceType: 'symptom', sourceType: 'current' },
      { key: 'events', evidenceType: 'event', sourceType: 'current' },
    ]),
    ...collectManualReferences(currentSection?.manualEntries, 'current', 'Current treatment entry'),
  ]);
  const vaExtracted = vaSection?.extractedFindings && typeof vaSection.extractedFindings === 'object' && !Array.isArray(vaSection.extractedFindings)
    ? vaSection.extractedFindings
    : {};
  const vaManualEntries = Array.isArray(vaSection?.manualEntries) ? vaSection.manualEntries : [];
  const decisionSourceName = getSourceName(vaExtracted?.decisionMetadata || vaSection?.selectedDecision || vaSection?.decisions?.[0], 'Selected VA decision');
  const ratedReferences = uniqueReferenceItems([
    ...collectDecisionReferences(vaExtracted?.serviceConnectedConditions || [], decisionSourceName, 'rated'),
    ...collectDecisionReferences(vaSection?.selectedDecision?.conditions || [], decisionSourceName, 'rated'),
    ...collectDecisionReferences(
      vaManualEntries.filter((entry) => entry?.isServiceConnected).map((entry) => ({ label: entry?.conditionName || entry?.condition })),
      'Manual VA rating entry',
      'rated'
    ),
  ]);
  const deniedReferences = uniqueReferenceItems([
    ...collectDecisionReferences(vaExtracted?.deniedConditions || [], decisionSourceName, 'denied'),
    ...collectDecisionReferences(vaSection?.selectedDecision?.deniedConditions || [], decisionSourceName, 'denied'),
    ...collectDecisionReferences(
      vaManualEntries.filter((entry) => entry?.isDenied).map((entry) => ({ label: entry?.conditionName || entry?.condition })),
      'Manual VA rating entry',
      'denied'
    ),
  ]);

  strsSummary.diagnoses.forEach((label) => upsertConditionRecord(records, label, 'strs', { fromUpload: true }));
  strsSummary.injuries.forEach((label) => upsertConditionRecord(records, label, 'strs', { fromUpload: true }));
  strsSummary.events.forEach((label) => upsertConditionRecord(records, label, 'strs', { fromUpload: true }));
  extractedFindings
    .filter((item) => !item?.manualEntry)
    .forEach((item) => upsertConditionRecord(records, item?.conditionName || item?.label, 'strs', { fromUpload: true }));
  strsSummary.manualConditions.forEach((label) => upsertConditionRecord(records, label, 'strs', { isManual: true }));

  treatmentSummary.currentDiagnoses.forEach((label) => upsertConditionRecord(records, label, 'current', { fromUpload: true }));
  treatmentSummary.currentSymptoms.forEach((label) => upsertConditionRecord(records, label, 'current', { fromUpload: true }));
  treatmentSummary.manualConditions.forEach((label) => upsertConditionRecord(records, label, 'current', { isManual: true }));

  vaSummary.serviceConnectedConditions.forEach((label) => upsertConditionRecord(records, label, 'rated'));
  vaSummary.deniedConditions.forEach((label) => upsertConditionRecord(records, label, 'denied'));

  const normalizedRecords = records
    .map((record) => {
      const hasCurrentDiagnosis = record.current.length > 0;
      const hasInServiceEvidence = record.strs.length > 0;
      const alreadyRated = record.rated.length > 0;
      const deniedPreviously = record.denied.length > 0;
      const presumptivePathPossible = serviceSummary.presumptiveMatches > 0 && !alreadyRated;
      const evidenceGaps = [];

      if (!hasCurrentDiagnosis) {
        evidenceGaps.push('Current diagnosis or treatment evidence missing');
      }
      if (!hasInServiceEvidence && !presumptivePathPossible) {
        evidenceGaps.push('In-service event, STR evidence, or nexus support missing');
      }
      if (deniedPreviously && !(hasCurrentDiagnosis && hasInServiceEvidence)) {
        evidenceGaps.push('Need new and relevant evidence to reopen or supplement');
      }

      const aliases = uniqueStrings(record.aliases);
      const matchesRecord = (item) => aliases.some((alias) => labelsMatch(alias, item?.label));
      const inServiceReferences = uniqueReferenceItems(strsReferences.filter(matchesRecord));
      const currentReferencesForCondition = uniqueReferenceItems(currentReferences.filter(matchesRecord));
      const ratedReferencesForCondition = uniqueReferenceItems(ratedReferences.filter(matchesRecord));
      const deniedReferencesForCondition = uniqueReferenceItems(deniedReferences.filter(matchesRecord));

      let recommendedLane = 'Develop evidence';
      if (alreadyRated) {
        recommendedLane = 'Increase or secondary review';
      } else if (deniedPreviously && hasCurrentDiagnosis && hasInServiceEvidence) {
        recommendedLane = 'Supplemental claim';
      } else if (hasCurrentDiagnosis && hasInServiceEvidence) {
        recommendedLane = 'Direct service connection';
      } else if (hasCurrentDiagnosis && presumptivePathPossible) {
        recommendedLane = 'Presumptive pathway review';
      } else if (hasCurrentDiagnosis) {
        recommendedLane = 'Current diagnosis, linkage needed';
      } else if (hasInServiceEvidence) {
        recommendedLane = 'In-service evidence, current diagnosis needed';
      }

      let readinessScore = 15;
      if (alreadyRated) {
        readinessScore = hasCurrentDiagnosis ? 88 : 68;
      } else if (deniedPreviously && hasCurrentDiagnosis && hasInServiceEvidence) {
        readinessScore = 92;
      } else if (hasCurrentDiagnosis && hasInServiceEvidence) {
        readinessScore = 86;
      } else if (hasCurrentDiagnosis && presumptivePathPossible) {
        readinessScore = 79;
      } else if (hasCurrentDiagnosis) {
        readinessScore = 48;
      } else if (hasInServiceEvidence) {
        readinessScore = 42;
      }

      const manualEvidenceBonus = Math.min(record.manualSourceCount * 2, 6);
      const uploadedEvidenceBonus = Math.min(record.uploadedSourceCount, 4);
      readinessScore = Math.min(99, readinessScore + manualEvidenceBonus + uploadedEvidenceBonus);

      let readinessState = 'Needs Evidence';
      if (readinessScore >= 85) {
        readinessState = 'Claim-Ready';
      } else if (readinessScore >= 60) {
        readinessState = 'Developing';
      }

      let readinessReason = 'Key pieces are still missing before this condition is ready to file.';
      if (readinessState === 'Claim-Ready') {
        readinessReason = alreadyRated
          ? 'This condition already has decision history and enough current support to review for increase or secondary strategy.'
          : 'Current evidence and service linkage are both present, making this condition a strong filing candidate.';
      } else if (readinessState === 'Developing') {
        readinessReason = 'This condition has meaningful evidence, but still needs a stronger link, updated medical support, or filing strategy.';
      }

      const scoreFactors = [];
      if (hasCurrentDiagnosis) {
        scoreFactors.push({ label: 'Current diagnosis or treatment evidence present', impact: '+35' });
      } else {
        scoreFactors.push({ label: 'Current diagnosis still missing', impact: '-25' });
      }

      if (hasInServiceEvidence) {
        scoreFactors.push({ label: 'In-service STR or event evidence found', impact: '+35' });
      } else if (presumptivePathPossible) {
        scoreFactors.push({ label: 'Presumptive pathway may substitute for direct STR linkage', impact: '+28' });
      } else {
        scoreFactors.push({ label: 'No in-service linkage identified yet', impact: '-20' });
      }

      if (alreadyRated) {
        scoreFactors.push({ label: 'Prior rating history supports increase or secondary strategy', impact: '+18' });
      } else if (deniedPreviously && hasCurrentDiagnosis && hasInServiceEvidence) {
        scoreFactors.push({ label: 'Denied previously, but new evidence supports a supplemental path', impact: '+12' });
      } else if (deniedPreviously) {
        scoreFactors.push({ label: 'Prior denial means stronger new evidence is still needed', impact: '-8' });
      }

      if (manualEvidenceBonus > 0) {
        scoreFactors.push({ label: 'Manual entries add supporting details', impact: `+${manualEvidenceBonus}` });
      }
      if (uploadedEvidenceBonus > 0) {
        scoreFactors.push({ label: 'Uploaded documents strengthen confidence', impact: `+${uploadedEvidenceBonus}` });
      }

      return {
        condition: record.primaryLabel || record.condition,
        aliases,
        hasCurrentDiagnosis,
        hasInServiceEvidence,
        alreadyRated,
        deniedPreviously,
        presumptivePathPossible,
        recommendedLane,
        readinessScore,
        readinessState,
        readinessReason,
        scoreFactors,
        evidenceGaps,
        currentEvidence: uniqueStrings(record.current),
        inServiceEvidence: uniqueStrings(record.strs),
        ratedEvidence: uniqueStrings(record.rated),
        deniedEvidence: uniqueStrings(record.denied),
        sourceEvidence: {
          current: currentReferencesForCondition,
          inService: inServiceReferences,
          rated: ratedReferencesForCondition,
          denied: deniedReferencesForCondition,
        },
        manualSourceCount: record.manualSourceCount,
        uploadedSourceCount: record.uploadedSourceCount,
        secondaryConnections: [],
      };
    });

  const ratedConditions = normalizedRecords.filter((item) => item.alreadyRated);

  return normalizedRecords
    .map((item) => {
      if (item.alreadyRated || !item.hasCurrentDiagnosis) {
        return item;
      }

      const secondaryConnections = findSecondaryConnections(item.condition, ratedConditions)
        .filter((entry) => Number(entry.confidence || 0) >= secondaryModeConfig.minConfidence)
        .slice(0, secondaryModeConfig.maxConnections);

      if (secondaryConnections.length === 0) {
        return item;
      }

      const bestConfidence = Math.max(...secondaryConnections.map((entry) => Number(entry.confidence || 0.7)));
      const scoreBoost = Math.max(
        secondaryModeConfig.scoreBoostFloor,
        Math.min(secondaryModeConfig.scoreBoostCeil, Math.round(bestConfidence * 14))
      );
      const nextScore = Math.min(99, item.readinessScore + scoreBoost);
      const nextState = nextScore >= 85 ? 'Claim-Ready' : nextScore >= 60 ? 'Developing' : 'Needs Evidence';
      const nextGaps = item.evidenceGaps.filter((gap) => !gap.toLowerCase().includes('in-service event'));
      const topConnection = secondaryConnections[0];

      return {
        ...item,
        recommendedLane: item.alreadyRated ? item.recommendedLane : 'Secondary service connection',
        readinessScore: nextScore,
        readinessState: nextState,
        readinessReason: `Secondary pathway identified: ${item.condition} may be linked to service-connected ${topConnection.primaryCondition}. ${topConnection.rationale}`,
        evidenceGaps: nextGaps,
        scoreFactors: uniqueReferenceItems([
          ...item.scoreFactors.map((factor) => ({
            label: factor.label,
            sourceName: factor.impact,
            evidenceType: 'score-factor',
            sourceType: 'score-factor',
            factor,
          })),
          {
            label: 'Potential secondary link to an already service-connected condition',
            sourceName: '+10',
            evidenceType: 'score-factor',
            sourceType: 'score-factor',
            factor: { label: 'Potential secondary link to an already service-connected condition', impact: `+${scoreBoost}` },
          },
        ]).map((itemRef) => itemRef.factor),
        secondaryConnections,
      };
    })
    .sort((left, right) => {
      const score = (item) => {
        if (item.deniedPreviously && item.hasCurrentDiagnosis && item.hasInServiceEvidence) return 5;
        if (!item.alreadyRated && item.hasCurrentDiagnosis && item.hasInServiceEvidence) return 4;
        if (!item.alreadyRated && item.hasCurrentDiagnosis && item.presumptivePathPossible) return 3;
        if (item.alreadyRated) return 2;
        return 1;
      };

      return score(right) - score(left) || left.condition.localeCompare(right.condition);
    });
}

export function deriveWorkflow(workspace) {
  const secondaryMatchMode = String(workspace?.analyzer?.settings?.secondaryMatchMode || 'balanced').toLowerCase();
  const serviceSummary = normalizeServiceSummary(workspace.militaryService);
  const profileSummary = normalizeProfileSummary(workspace.profile, serviceSummary);
  const strsSummary = normalizeStrSummary(workspace.serviceTreatmentRecords);
  const treatmentSummary = normalizeCurrentTreatmentSummary(workspace.currentTreatment);
  const vaSummary = normalizeVaSummary(workspace.vaDecision);
  const conditionRecords = deriveConditionRecords(
    serviceSummary,
    workspace.serviceTreatmentRecords,
    workspace.currentTreatment,
    workspace.vaDecision,
    strsSummary,
    treatmentSummary,
    vaSummary,
    { secondaryMatchMode }
  );

  const potentialNewClaims = conditionRecords
    .filter((item) => item.hasCurrentDiagnosis && !item.alreadyRated)
    .map((item) => item.condition);

  const analyzerRecommendations = conditionRecords.map((item) => {
    let recommendedPath = 'Needs service event evidence or a medical nexus statement.';
    if (item.alreadyRated) {
      recommendedPath = 'Already rated. Review for increase, worsening, secondary issues, or earlier effective date.';
    } else if (item.secondaryConnections?.length > 0) {
      const topConnection = item.secondaryConnections[0];
      recommendedPath = `Secondary service connection candidate: ${item.condition} may be linked to service-connected ${topConnection.primaryCondition}.`;
    } else if (item.deniedPreviously && item.hasCurrentDiagnosis && item.hasInServiceEvidence) {
      recommendedPath = 'Supplemental claim candidate: current disability plus in-service evidence already exist.';
    } else if (item.hasCurrentDiagnosis && item.hasInServiceEvidence) {
      recommendedPath = 'Direct service connection candidate: current condition appears supported by STR evidence.';
    } else if (item.hasCurrentDiagnosis && item.presumptivePathPossible) {
      recommendedPath = 'Review presumptive or exposure-based pathway using deployment evidence.';
    }

    return {
      condition: item.condition,
      hasInServiceEvidence: item.hasInServiceEvidence,
      deniedPreviously: item.deniedPreviously,
      alreadyRated: item.alreadyRated,
      recommendedLane: item.recommendedLane,
      readinessScore: item.readinessScore,
      readinessState: item.readinessState,
      readinessReason: item.readinessReason,
      scoreFactors: item.scoreFactors,
      evidenceGaps: item.evidenceGaps,
      sourceEvidence: item.sourceEvidence,
      secondaryConnections: item.secondaryConnections,
      recommendedPath,
    };
  });

  const conditionSummary = {
    total: conditionRecords.length,
    directCandidates: conditionRecords.filter((item) => item.recommendedLane === 'Direct service connection').length,
    supplementalCandidates: conditionRecords.filter((item) => item.recommendedLane === 'Supplemental claim').length,
    increaseCandidates: conditionRecords.filter((item) => item.recommendedLane === 'Increase or secondary review').length,
    secondaryServiceConnectionCandidates: conditionRecords.filter((item) => item.recommendedLane === 'Secondary service connection').length,
    secondaryCandidates: conditionRecords.filter((item) => (item.secondaryConnections || []).length > 0).length,
    evidenceGapCount: conditionRecords.filter((item) => item.evidenceGaps.length > 0).length,
    claimReadyCount: conditionRecords.filter((item) => item.readinessState === 'Claim-Ready').length,
    developingCount: conditionRecords.filter((item) => item.readinessState === 'Developing').length,
    needsEvidenceCount: conditionRecords.filter((item) => item.readinessState === 'Needs Evidence').length,
    averageReadinessScore:
      conditionRecords.length > 0
        ? Math.round(conditionRecords.reduce((total, item) => total + item.readinessScore, 0) / conditionRecords.length)
        : 0,
  };

  const readiness = {
    profile: Boolean(workspace.profile?.firstName || workspace.profile?.lastName || workspace.profile?.email),
    militaryService: serviceSummary.recordCount > 0,
    serviceTreatmentRecords: strsSummary.uploadedCount > 0 || strsSummary.manualCount > 0,
    currentTreatment: treatmentSummary.uploadedCount > 0 || treatmentSummary.manualCount > 0,
    vaDecision: vaSummary.decisionCount > 0,
    analyzer: potentialNewClaims.length > 0 || vaSummary.deniedConditions.length > 0 || serviceSummary.presumptiveMatches > 0,
    caseSummary: true,
    claimGeneratorSummary: true,
    resources: true,
  };

  const nextActions = [];
  const suggestedTreatmentEntries = buildSuggestedTreatmentEntries(conditionRecords);
  const suggestedDecisionEntries = buildSuggestedDecisionEntries(conditionRecords);

  if (!readiness.profile) nextActions.push('Add veteran profile details so later steps can inherit identity and location.');
  if (!readiness.militaryService) nextActions.push('Add service periods and deployments to enable presumptive and exposure matching.');
  if (!readiness.serviceTreatmentRecords) nextActions.push('Upload or enter service treatment records to establish in-service evidence.');
  if (!readiness.currentTreatment) nextActions.push('Add current diagnosis and treatment evidence to prove present disability.');
  if (!readiness.vaDecision) nextActions.push('Upload the latest VA rating decision so granted and denied issues flow into planning.');
  if (vaSummary.deniedConditions.length > 0) nextActions.push('Review denied conditions in Claim Generator & Summary and identify missing evidence or nexus support.');
  if (potentialNewClaims.length > 0) nextActions.push(`Compare current conditions against rated issues. ${potentialNewClaims.length} current condition(s) may represent new or increased claims.`);
  if (serviceSummary.presumptiveMatches > 0) nextActions.push('Use deployment evidence to surface presumptive pathways in Claim Generator & Summary.');
  if (conditionSummary.secondaryCandidates > 0) nextActions.push(`Review ${conditionSummary.secondaryCandidates} possible secondary condition pathway(s) and document medical nexus opinions tied to service-connected primaries.`);
  if (conditionSummary.secondaryServiceConnectionCandidates > 0) nextActions.push(`Prioritize ${conditionSummary.secondaryServiceConnectionCandidates} non-rated condition(s) for secondary service-connection development with causation/aggravation language from treating providers.`);
  if (analyzerRecommendations.some((item) => item.hasInServiceEvidence && item.deniedPreviously)) nextActions.push('Prepare supplemental claim packets for denied conditions that now have both current and in-service evidence.');

  return {
    readiness,
    secondaryMatchMode: getSecondaryModeConfig(secondaryMatchMode).mode,
    profileSummary,
    serviceSummary,
    strsSummary,
    treatmentSummary,
    vaSummary,
    conditionSummary,
    conditionRecords,
    suggestedTreatmentEntries,
    suggestedDecisionEntries,
    potentialNewClaims,
    analyzerRecommendations,
    nextActions: uniqueStrings(nextActions),
  };
}
