/**
 * Engine: derivedSignals
 * Purpose: Derive exposures, presumptives, secondaries, worsening indicators, and unrated conditions.
 * Inputs: service records, STR section, current-treatment section, rating-decision section.
 * Outputs: { exposures, presumptives, secondaryCandidates, worseningIndicators, unratedConditions }.
 * Trigger conditions: Any silent mutation to service/STR/treatment/rating-decision unified data.
 */
import { EXPOSURE_CONDITION_MAP } from '../shared/claimEngineConfig.js';
import { conditionMatches, normalizeConditionList, normalizeConditionName } from '../shared/conditionNormalization.js';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(asList(values).map((item) => asText(item)).filter(Boolean)));
}

function normalizeExposureCategory(value) {
  const text = asText(value).toLowerCase();
  if (!text) return '';
  if (/burn\s*pit|airborne hazard/.test(text)) return 'burn pits';
  if (/agent orange|herbicide|vietnam/.test(text)) return 'agent orange';
  if (/radiation|nuclear/.test(text)) return 'radiation';
  if (/gulf|southwest asia|iraq|afghanistan/.test(text)) return 'gulf war service';
  if (/combat/.test(text)) return 'combat service';
  if (/noise|artillery|flight line|explosion|acoustic/.test(text)) return 'hazardous noise';
  return text;
}

function collectExposureSignals(service = [], str = {}, currentTreatment = {}) {
  const fromService = asList(service).flatMap((item) => [
    item?.primaryMOS,
    ...asList(item?.additionalMOS),
    ...asList(item?.deploymentLocations),
    ...asList(item?.hazardPayIndicators),
    ...asList(item?.radiationExposure),
    item?.combatVeteran ? 'combat service' : '',
  ]);

  const fromStr = [
    ...asList(str?.extractedFindings?.presumptiveSignals),
    ...asList(str?.extractedFindings?.radiationIndicators),
  ];

  const fromTreatment = [
    ...asList(currentTreatment?.extractedFindings?.treatmentEvents),
    ...asList(currentTreatment?.extractedFindings?.evidenceSnippets),
  ];

  return uniqueStrings([...fromService, ...fromStr, ...fromTreatment].map(normalizeExposureCategory).filter(Boolean));
}

function collectServiceEras(service = []) {
  const labels = uniqueStrings(asList(service).map((item) => item?.serviceEra));
  const years = asList(service).flatMap((item) => [
    Number(asText(item?.startDate).slice(0, 4)),
    Number(asText(item?.endDate).slice(0, 4)),
  ]).filter((year) => Number.isFinite(year) && year > 0);

  if (years.length === 0) return labels;
  const earliest = Math.min(...years);
  const latest = Math.max(...years);
  if (earliest <= 1975) labels.push('Vietnam Era');
  if (latest >= 1990) labels.push('Gulf War Era');
  if (latest >= 2001) labels.push('Post-9/11 Era');
  return uniqueStrings(labels);
}

function collectPresumptives(exposures = [], serviceEras = [], str = {}) {
  const matches = [];
  exposures.forEach((exposure) => {
    asList(EXPOSURE_CONDITION_MAP[exposure]).forEach((condition) => matches.push(condition));
  });

  asList(str?.extractedFindings?.presumptiveSignals).forEach((condition) => matches.push(condition));
  if (serviceEras.some((item) => /gulf/i.test(item))) {
    matches.push('gulf war illness');
  }

  return normalizeConditionList(matches);
}

function collectRatedConditions(ratingDecision = {}) {
  const extracted = ratingDecision?.extractedFindings || {};
  const fromManual = asList(ratingDecision?.manualEntries)
    .filter((item) => item?.isServiceConnected)
    .map((item) => item?.conditionName);
  const fromExtracted = asList(extracted?.serviceConnectedConditions).map((item) => item?.conditionName || item?.label || item);
  return normalizeConditionList([...fromManual, ...fromExtracted]);
}

function collectAllEvidenceConditions(str = {}, currentTreatment = {}) {
  const strConditions = [
    ...asList(str?.manualEntries).map((item) => item?.conditionName),
    ...asList(str?.extractedFindings?.diagnoses),
    ...asList(str?.extractedFindings?.injuries),
    ...asList(str?.extractedFindings?.events),
  ];

  const treatmentConditions = [
    ...asList(currentTreatment?.manualEntries).map((item) => item?.conditionName),
    ...asList(currentTreatment?.extractedFindings?.currentConditions),
  ];

  return normalizeConditionList([...strConditions, ...treatmentConditions]);
}

function buildSecondaryCandidates(ratedConditions = [], allConditions = []) {
  const linkageTable = {
    'post-traumatic stress disorder': ['sleep apnea', 'migraine headaches', 'hypertension', 'depression', 'anxiety'],
    'lumbar spine condition': ['radiculopathy', 'knee pain', 'ankle pain'],
    'diabetes mellitus type 2': ['radiculopathy', 'heart disease'],
    'hearing loss': ['tinnitus'],
  };

  const pairs = [];
  ratedConditions.forEach((primary) => {
    const linked = linkageTable[primary] || [];
    linked.forEach((secondary) => {
      const hasSecondary = allConditions.some((condition) => conditionMatches(condition, secondary));
      if (hasSecondary) {
        pairs.push({ primary, secondary: normalizeConditionName(secondary) });
      }
    });
  });

  const deduped = [];
  const seen = new Set();
  pairs.forEach((pair) => {
    const key = `${pair.primary}|${pair.secondary}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(pair);
  });
  return deduped;
}

function collectWorseningIndicators(currentTreatment = {}, ratingDecision = {}) {
  const treatmentWorsening = [
    ...asList(currentTreatment?.extractedFindings?.worseningIndicators),
    ...asList(currentTreatment?.manualEntries)
      .filter((item) => /worse|increas|severe|decline/i.test(asText(item?.symptomSummary) + asText(item?.treatmentDetails)))
      .map((item) => item?.conditionName),
    ...asList(currentTreatment?.manualEntries)
      .filter((item) => asList(item?.medications).some((med) => /increase|higher|changed/i.test(asText(med?.dosage))))
      .map((item) => item?.conditionName),
  ];

  const ratingWorsening = asList(ratingDecision?.manualEntries)
    .filter((item) => Number(item?.percentage || 0) > 0 && Number(item?.percentage || 0) <= 20)
    .map((item) => item?.conditionName);

  return normalizeConditionList([...treatmentWorsening, ...ratingWorsening]);
}

function collectUnratedConditions(allEvidenceConditions = [], ratedConditions = []) {
  return allEvidenceConditions.filter((condition) => !ratedConditions.some((rated) => conditionMatches(rated, condition)));
}

export function runDerivedSignalsEngine({ service = [], str = {}, currentTreatment = {}, ratingDecision = {} } = {}) {
  const exposures = collectExposureSignals(service, str, currentTreatment);
  const serviceEras = collectServiceEras(service);
  const presumptives = collectPresumptives(exposures, serviceEras, str);
  const ratedConditions = collectRatedConditions(ratingDecision);
  const allEvidenceConditions = collectAllEvidenceConditions(str, currentTreatment);
  const secondaryCandidates = buildSecondaryCandidates(ratedConditions, allEvidenceConditions);
  const worseningIndicators = collectWorseningIndicators(currentTreatment, ratingDecision);
  const unratedConditions = collectUnratedConditions(allEvidenceConditions, ratedConditions);

  return {
    exposures,
    presumptives,
    secondaryCandidates,
    worseningIndicators,
    unratedConditions,
  };
}
