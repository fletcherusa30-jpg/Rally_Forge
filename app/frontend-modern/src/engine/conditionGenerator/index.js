/**
 * Engine: conditionGenerator
 * Purpose: Build deterministic generated condition rows from claimDataUnified.
 * Inputs: claimDataUnified profile/service/str/currentTreatment/ratingDecision/derivedSignals.
 * Outputs: Array of generated condition records with category, evidence, score, and recommendations.
 * Trigger conditions: Any silent update that mutates unified tab data or derived signals.
 */
import {
  DBQ_MAPPING_TABLE,
  EXPOSURE_CONDITION_MAP,
  FOLLOW_UP_QUESTION_LIBRARY,
  FORM_RECOMMENDATION_RULESET,
} from '../shared/claimEngineConfig.js';
import {
  conditionMatches,
  getConditionFamily,
  normalizeConditionList,
  normalizeConditionName,
} from '../shared/conditionNormalization.js';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(asList(values).map((item) => asText(item)).filter(Boolean)));
}

function getRatingHistoryForCondition(ratingDecision = {}, conditionName = '') {
  const manual = asList(ratingDecision?.manualEntries).filter((item) => conditionMatches(item?.conditionName, conditionName));
  const extracted = ratingDecision?.extractedFindings || {};
  const granted = asList(extracted?.serviceConnectedConditions).filter((item) => conditionMatches(item?.conditionName || item?.label || item, conditionName));
  const denied = asList(extracted?.deniedConditions).filter((item) => conditionMatches(item?.conditionName || item?.label || item, conditionName));

  return {
    granted: granted.length > 0 || manual.some((item) => item?.isServiceConnected),
    denied: denied.length > 0 || manual.some((item) => item?.isDenied),
    manual,
    grantedEntries: granted,
    deniedEntries: denied,
  };
}

function getServiceEvidence(service = [], conditionName = '') {
  const rows = [];
  asList(service).forEach((item) => {
    rows.push(...asList(item?.deploymentLocations).map((location) => `Deployment: ${asText(location)}`));
    rows.push(...asList(item?.hazardPayIndicators).map((hazard) => `Hazard pay: ${asText(hazard)}`));
    rows.push(...asList(item?.radiationExposure).map((rad) => `Radiation exposure: ${asText(rad)}`));
    if (item?.combatVeteran) rows.push('Combat service documented');
    if (asText(item?.primaryMOS)) rows.push(`Primary MOS: ${asText(item.primaryMOS)}`);
  });

  const exposureLinked = asList(service).some((item) => asList(item?.deploymentLocations).some((location) => conditionMatches(location, conditionName)));
  return {
    rows: uniqueStrings(rows),
    exposureLinked,
  };
}

function getStrEvidence(str = {}, conditionName = '') {
  const manualRows = asList(str?.manualEntries)
    .filter((item) => conditionMatches(item?.conditionName, conditionName))
    .map((item) => `STR: ${asText(item?.description || item?.conditionName)}`);

  const extracted = str?.extractedFindings || {};
  const extractedRows = [
    ...asList(extracted?.diagnoses),
    ...asList(extracted?.injuries),
    ...asList(extracted?.events),
  ]
    .filter((item) => conditionMatches(item, conditionName))
    .map((item) => `STR: ${asText(item)}`);

  const snippets = asList(extracted?.evidenceSnippets)
    .filter((snippet) => conditionMatches(snippet, conditionName))
    .map((snippet) => `STR snippet: ${asText(snippet)}`);

  return uniqueStrings([...manualRows, ...extractedRows, ...snippets]);
}

function getTreatmentEvidence(currentTreatment = {}, conditionName = '') {
  const manualRows = asList(currentTreatment?.manualEntries)
    .filter((item) => conditionMatches(item?.conditionName, conditionName))
    .map((item) => `Treatment: ${asText(item?.symptomSummary || item?.treatmentDetails || item?.conditionName)}`);

  const extracted = currentTreatment?.extractedFindings || {};
  const extractedRows = asList(extracted?.currentConditions)
    .filter((item) => conditionMatches(item, conditionName))
    .map((item) => `Treatment: ${asText(item)}`);

  const treatmentEvents = asList(extracted?.treatmentEvents)
    .filter((item) => conditionMatches(item, conditionName))
    .map((item) => `Treatment event: ${asText(item)}`);

  const snippets = asList(extracted?.evidenceSnippets)
    .filter((snippet) => conditionMatches(snippet, conditionName))
    .map((snippet) => `Treatment snippet: ${asText(snippet)}`);

  return uniqueStrings([...manualRows, ...extractedRows, ...treatmentEvents, ...snippets]);
}

function getRatingEvidence(ratingDecision = {}, conditionName = '') {
  const history = getRatingHistoryForCondition(ratingDecision, conditionName);
  const rows = [];

  history.manual.forEach((item) => {
    if (item?.isServiceConnected) rows.push('Rating Decision: service-connected');
    if (item?.isDenied) rows.push('Rating Decision: denied');
    if (asText(item?.percentage)) rows.push(`Rating Decision: ${asText(item.percentage)}%`);
    if (asText(item?.effectiveDate)) rows.push(`Rating Decision effective date: ${asText(item.effectiveDate)}`);
  });

  history.grantedEntries.forEach((item) => {
    rows.push(`Rating Decision grant: ${asText(item?.conditionName || item?.label || item)}`);
  });

  history.deniedEntries.forEach((item) => {
    rows.push(`Rating Decision denial: ${asText(item?.conditionName || item?.label || item)}`);
  });

  return uniqueStrings(rows);
}

function getFunctionalEvidence(currentTreatment = {}, conditionName = '') {
  const extracted = currentTreatment?.extractedFindings || {};
  const fromExtracted = asList(extracted?.functionalLimitations).filter((item) => conditionMatches(item, conditionName));
  const fromManual = asList(currentTreatment?.manualEntries)
    .filter((item) => conditionMatches(item?.conditionName, conditionName))
    .map((item) => item?.symptomSummary)
    .filter((summary) => /impact|limit|cannot|unable|difficulty|pain/i.test(asText(summary)));

  return uniqueStrings([...fromExtracted, ...fromManual]);
}

function getExposureLinked(claimDataUnified = {}, conditionName = '') {
  const exposures = asList(claimDataUnified?.derivedSignals?.exposures);
  const mapped = exposures.flatMap((exposure) => asList(EXPOSURE_CONDITION_MAP[exposure]));
  return mapped.some((item) => conditionMatches(item, conditionName));
}

function getCategory(claimDataUnified = {}, conditionName = '', evidence = {}) {
  const derived = claimDataUnified?.derivedSignals || {};
  const ratingHistory = getRatingHistoryForCondition(claimDataUnified?.ratingDecision, conditionName);
  const isPresumptive = asList(derived?.presumptives).some((item) => conditionMatches(item, conditionName));
  const secondaryPairs = asList(derived?.secondaryCandidates);
  const secondaryPair = secondaryPairs.find((pair) => conditionMatches(pair?.secondary, conditionName));
  const worsening = asList(derived?.worseningIndicators).some((item) => conditionMatches(item, conditionName));

  if (ratingHistory.denied) return 'reopen';
  if (ratingHistory.granted && worsening) return 'increase';
  if (secondaryPair && worsening) return 'aggravation';
  if (secondaryPair) return 'secondary';
  if (isPresumptive) return 'presumptive';

  const hasStr = evidence?.str?.length > 0;
  const hasTreatment = evidence?.treatment?.length > 0;
  if (hasStr && hasTreatment) return 'primary';
  return 'primary';
}

function getDbqRecommendations(conditionName = '') {
  const canonical = normalizeConditionName(conditionName);
  const family = getConditionFamily(canonical);
  const dbq = DBQ_MAPPING_TABLE[canonical]
    || DBQ_MAPPING_TABLE[canonical.replace(/ condition$/, '')]
    || DBQ_MAPPING_TABLE[family];

  return uniqueStrings([dbq || 'General Medical DBQ']);
}

function getFormRecommendations(category = '', claimDataUnified = {}) {
  const rules = FORM_RECOMMENDATION_RULESET;
  const forms = [...asList(rules[category])];

  if (asList(claimDataUnified?.ratingDecision?.conflicts).length > 0) {
    forms.push(...asList(rules.conflictDetected));
  }

  const decisionMetadata = claimDataUnified?.ratingDecision?.extractedFindings?.decisionMetadata || {};
  if (decisionMetadata?.boardAppeal || decisionMetadata?.appealActive) {
    forms.push(...asList(rules.boardAppeal));
  }

  return uniqueStrings(forms);
}

function scoreEvidence(claimDataUnified = {}, conditionName = '', evidence = {}) {
  const hasStr = asList(evidence?.str).length > 0;
  const hasTreatment = asList(evidence?.treatment).length > 0;
  const exposureLinked = getExposureLinked(claimDataUnified, conditionName);
  const ratingLinked = asList(evidence?.ratingDecision).length > 0;
  const worsening = asList(claimDataUnified?.derivedSignals?.worseningIndicators).some((item) => conditionMatches(item, conditionName));
  const snippets = [
    ...asList(claimDataUnified?.str?.extractedFindings?.evidenceSnippets),
    ...asList(claimDataUnified?.currentTreatment?.extractedFindings?.evidenceSnippets),
  ].filter((item) => conditionMatches(item, conditionName));

  const presumptiveMet = asList(claimDataUnified?.derivedSignals?.presumptives).some((item) => conditionMatches(item, conditionName));

  if ((hasStr && hasTreatment && (exposureLinked || ratingLinked)) || presumptiveMet || (exposureLinked && hasTreatment)) {
    return { confidence: 'high', confidenceScore: 90 };
  }

  if ((hasStr || hasTreatment) || exposureLinked || snippets.length >= 2 || worsening) {
    return { confidence: 'medium', confidenceScore: 70 };
  }

  return { confidence: 'low', confidenceScore: 40 };
}

function getMissingEvidenceFlags(evidence = {}, functionalEvidence = []) {
  const missing = [];
  if (asList(evidence?.treatment).length === 0) missing.push('missingCurrentTreatment');
  if (asList(evidence?.str).length === 0) missing.push('missingSTR');
  if (asList(functionalEvidence).length === 0) missing.push('missingFunctionalImpact');
  return missing;
}

function getMissingEvidenceDisplay(flags = []) {
  const labels = {
    missingCurrentTreatment: 'Current treatment evidence is missing',
    missingSTR: 'Service treatment record evidence is missing',
    missingFunctionalImpact: 'Functional impact evidence is missing',
  };
  return uniqueStrings(asList(flags).map((flag) => labels[flag] || flag));
}

function selectFollowUps({ missingFlags = [], category = '', denied = false, secondary = false, exposureLinked = false, worsening = false }) {
  const buckets = [];
  missingFlags.forEach((flag) => buckets.push(...asList(FOLLOW_UP_QUESTION_LIBRARY[flag])));
  if (denied || category === 'reopen') buckets.push(...asList(FOLLOW_UP_QUESTION_LIBRARY.deniedPreviously));
  if (secondary || category === 'secondary' || category === 'aggravation') buckets.push(...asList(FOLLOW_UP_QUESTION_LIBRARY.secondaryCandidate));
  if (exposureLinked || category === 'presumptive') buckets.push(...asList(FOLLOW_UP_QUESTION_LIBRARY.exposureLinked));
  if (worsening || category === 'increase') buckets.push(...asList(FOLLOW_UP_QUESTION_LIBRARY.worseningTrend));
  return uniqueStrings(buckets).slice(0, 8);
}

function collectCandidateConditions(claimDataUnified = {}) {
  const str = claimDataUnified?.str || {};
  const currentTreatment = claimDataUnified?.currentTreatment || {};
  const rating = claimDataUnified?.ratingDecision || {};
  const derived = claimDataUnified?.derivedSignals || {};

  const rows = [
    ...asList(derived?.unratedConditions),
    ...asList(derived?.presumptives),
    ...asList(str?.manualEntries).map((item) => item?.conditionName),
    ...asList(str?.extractedFindings?.diagnoses),
    ...asList(str?.extractedFindings?.injuries),
    ...asList(str?.extractedFindings?.events),
    ...asList(currentTreatment?.manualEntries).map((item) => item?.conditionName),
    ...asList(currentTreatment?.extractedFindings?.currentConditions),
    ...asList(rating?.manualEntries).map((item) => item?.conditionName),
    ...asList(rating?.extractedFindings?.serviceConnectedConditions).map((item) => item?.conditionName || item?.label || item),
    ...asList(rating?.extractedFindings?.deniedConditions).map((item) => item?.conditionName || item?.label || item),
    ...asList(derived?.secondaryCandidates).flatMap((pair) => [pair?.primary, pair?.secondary]),
  ];

  return normalizeConditionList(rows);
}

export function runConditionGeneratorEngine(claimDataUnified = {}) {
  const conditions = collectCandidateConditions(claimDataUnified);

  return conditions
    .map((conditionName) => {
      const evidence = {
        service: getServiceEvidence(claimDataUnified?.service, conditionName).rows,
        str: getStrEvidence(claimDataUnified?.str, conditionName),
        treatment: getTreatmentEvidence(claimDataUnified?.currentTreatment, conditionName),
        ratingDecision: getRatingEvidence(claimDataUnified?.ratingDecision, conditionName),
      };

      const hasAnyEvidence = evidence.service.length + evidence.str.length + evidence.treatment.length + evidence.ratingDecision.length > 0;
      if (!hasAnyEvidence) return null;

      const category = getCategory(claimDataUnified, conditionName, evidence);
      const functionalEvidence = getFunctionalEvidence(claimDataUnified?.currentTreatment, conditionName);
      const missingFlags = getMissingEvidenceFlags(evidence, functionalEvidence);
      const ratingHistory = getRatingHistoryForCondition(claimDataUnified?.ratingDecision, conditionName);
      const secondary = asList(claimDataUnified?.derivedSignals?.secondaryCandidates).some((pair) => conditionMatches(pair?.secondary, conditionName));
      const worsening = asList(claimDataUnified?.derivedSignals?.worseningIndicators).some((item) => conditionMatches(item, conditionName));
      const exposureLinked = getExposureLinked(claimDataUnified, conditionName);
      const scoring = scoreEvidence(claimDataUnified, conditionName, evidence);

      return {
        conditionName,
        category,
        evidence,
        confidence: scoring.confidence,
        confidenceScore: scoring.confidenceScore,
        missingEvidence: getMissingEvidenceDisplay(missingFlags),
        followUpQuestions: selectFollowUps({
          missingFlags,
          category,
          denied: ratingHistory.denied,
          secondary,
          exposureLinked,
          worsening,
        }),
        recommendedDBQs: getDbqRecommendations(conditionName),
        recommendedForms: getFormRecommendations(category, claimDataUnified),
        flags: uniqueStrings([
          ratingHistory.granted ? 'service-connected-history' : '',
          ratingHistory.denied ? 'denied-history' : '',
          secondary ? 'secondary-candidate' : '',
          exposureLinked ? 'exposure-linked' : '',
          worsening ? 'worsening-trend' : '',
        ]),
        whyClaimable: `Condition is categorized as ${category} based on service, treatment, rating history, and derived signal linkage.`,
        inServiceEvidenceShort: asList(evidence.str)[0] || 'No STR evidence available',
        currentEvidenceShort: asList(evidence.treatment)[0] || 'No current treatment evidence available',
        exposureSummary: asList(evidence.service)[0] || 'No service exposure evidence available',
        changeSinceDecisionSummary: ratingHistory.denied
          ? 'New and relevant evidence exists since the prior denial.'
          : ratingHistory.granted
            ? 'Evidence indicates progression and reevaluation need.'
            : 'Evidence supports an initial filing path.',
        hasInServiceEvidence: evidence.str.length > 0,
        hasCurrentEvidence: evidence.treatment.length > 0,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.confidenceScore - left.confidenceScore || left.conditionName.localeCompare(right.conditionName));
}
