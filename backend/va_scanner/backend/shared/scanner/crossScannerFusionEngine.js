import { getCfrSectionForDiagnosticCode } from '../../../../services/cfrIndexService.js';

function normalizeConditionName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|and|with|without|condition|disorder|syndrome|pain)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toEvidence(item, type, labelField = 'rawText') {
  return {
    source: type,
    date: item?.date || null,
    lineNumber: item?.lineNumber || null,
    text: item?.[labelField] || item?.value || null,
  };
}

function buildStrIndex(strAnalysis) {
  const map = new Map();
  const push = (name, item, labelField) => {
    const key = normalizeConditionName(name || item?.diagnosisName || item?.symptomType || item?.value);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(toEvidence(item, 'STR', labelField));
  };

  (strAnalysis?.diagnoses || []).forEach((item) => push(item?.diagnosisName, item));
  (strAnalysis?.symptoms || []).forEach((item) => push(item?.symptomType, item));
  (strAnalysis?.events || []).forEach((item) => push(item?.description, item));
  return map;
}

function buildCurrentTreatmentIndex(currentTreatmentAnalysis) {
  const map = new Map();
  const push = (value, item) => {
    const key = normalizeConditionName(value || item?.value);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(toEvidence(item, 'CurrentTreatment', 'value'));
  };

  (currentTreatmentAnalysis?.currentConditions || []).forEach((item) => push(item?.value, item));
  (currentTreatmentAnalysis?.worseningConditions || []).forEach((item) => push(item?.value, item));
  return map;
}

function buildRatingIndex(ratingDecisionAnalysis) {
  const map = new Map();
  const granted = ratingDecisionAnalysis?.grantedConditions || [];
  const denied = ratingDecisionAnalysis?.deniedConditions || [];

  for (const item of [...granted, ...denied]) {
    const key = normalizeConditionName(item?.conditionName);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      source: 'RatingDecision',
      date: item?.effectiveDate || null,
      lineNumber: item?.textualEvidence?.lineNumber || null,
      text: item?.textualEvidence?.snippet || item?.conditionName || null,
      disposition: item?.disposition || null,
      diagnosticCode: item?.diagnosticCode || null,
    });
  }

  return map;
}

function mergeKeys(...maps) {
  const keys = new Set();
  for (const map of maps) {
    for (const key of map.keys()) keys.add(key);
  }
  return [...keys];
}

export async function fuseScannerAnalyses({ strAnalysis, currentTreatmentAnalysis, ratingDecisionAnalysis }) {
  const strIndex = buildStrIndex(strAnalysis);
  const currentTreatmentIndex = buildCurrentTreatmentIndex(currentTreatmentAnalysis);
  const ratingIndex = buildRatingIndex(ratingDecisionAnalysis);

  const keys = mergeKeys(strIndex, currentTreatmentIndex, ratingIndex);
  const correlatedConditions = [];
  const inconsistencies = [];

  for (const key of keys) {
    const strEvidence = strIndex.get(key) || [];
    const currentEvidence = currentTreatmentIndex.get(key) || [];
    const ratingEvidence = ratingIndex.get(key) || [];
    const firstRatingDx = ratingEvidence.find((entry) => entry.diagnosticCode)?.diagnosticCode || null;
    const cfrSection = firstRatingDx ? await getCfrSectionForDiagnosticCode(firstRatingDx) : null;

    correlatedConditions.push({
      conditionKey: key,
      strEvidence,
      currentTreatmentEvidence: currentEvidence,
      ratingDecisionEvidence: ratingEvidence,
      cfrReference: cfrSection
        ? {
            sectionId: cfrSection.id || null,
            partNumber: cfrSection.partNumber || 4,
            sectionNumber: cfrSection.sectionNumber || null,
            sectionTitle: cfrSection.sectionTitle || null,
          }
        : null,
      appearsAcrossScanners:
        Number(strEvidence.length > 0) + Number(currentEvidence.length > 0) + Number(ratingEvidence.length > 0),
    });

    const hasDeniedInRating = ratingEvidence.some((entry) => entry.disposition === 'denied');
    if (hasDeniedInRating && (strEvidence.length > 0 || currentEvidence.length > 0)) {
      inconsistencies.push({
        type: 'potentialEvidenceConflict',
        conditionKey: key,
        severity: 'medium',
        note: 'Condition has STR/current-treatment evidence and a denied disposition in rating decision. Human review required.',
      });
    }

    const grantedWithoutMedicalContext = ratingEvidence.some((entry) => entry.disposition === 'granted')
      && strEvidence.length === 0
      && currentEvidence.length === 0;

    if (grantedWithoutMedicalContext) {
      inconsistencies.push({
        type: 'grantedWithoutLocalMedicalContext',
        conditionKey: key,
        severity: 'low',
        note: 'Granted condition does not have matching STR/current-treatment context in provided documents.',
      });
    }
  }

  return {
    schemaVersion: '1.0.0',
    fusedAt: new Date().toISOString(),
    correlatedConditions,
    inconsistencies,
    notes: 'Deterministic cross-scanner correlation only. No legal or medical conclusions.',
  };
}
