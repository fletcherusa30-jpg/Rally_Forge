import { getLaneRecommendation } from '../../services/laneFormMap.js';
import {
  CLAIM_CATEGORY,
  createClaimGeneratorSummarySection,
  createEmptyGeneratedCondition,
} from './schema.js';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(left|right|bilateral|condition|disorder|pain|syndrome|injury|diagnosis|status)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasTokenMatch(left, right) {
  const a = normalizeKey(left);
  const b = normalizeKey(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function uniqueStrings(values) {
  return Array.from(new Set(asList(values).map((value) => asText(value)).filter(Boolean)));
}

function uniqueEvidenceRows(rows) {
  const seen = new Set();
  return asList(rows).filter((row) => {
    const normalized = asText(row);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildConditionLookup(records = []) {
  const map = new Map();
  asList(records).forEach((record) => {
    const label = asText(record?.condition);
    if (!label) return;
    const key = normalizeKey(label);
    if (key && !map.has(key)) {
      map.set(key, label);
    }
  });
  return map;
}

function getWorseningConditionKeys(claimDataUnified = {}) {
  return new Set(asList(claimDataUnified?.derivedSignals?.worseningIndicators).map((item) => normalizeKey(item)).filter(Boolean));
}

function getConfidenceLevel(score) {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function getConditionConfidenceScore(condition) {
  const direct = Number(condition?.confidenceScore);
  if (Number.isFinite(direct)) return direct;

  const nested = Number(condition?.confidence?.score);
  if (Number.isFinite(nested)) return nested;

  const level = asText(condition?.confidence || condition?.confidence?.level).toLowerCase();
  if (level === 'high') return 90;
  if (level === 'medium') return 70;
  return 40;
}

function getConditionConfidenceLevel(condition) {
  const level = asText(condition?.confidence || condition?.confidence?.level).toLowerCase();
  if (level === 'high' || level === 'medium' || level === 'low') {
    return level;
  }
  return getConfidenceLevel(getConditionConfidenceScore(condition));
}

function getCategory(record, worseningKeys) {
  const conditionKey = normalizeKey(record?.condition);
  const hasSecondary = asList(record?.secondaryConnections).length > 0;
  const topSecondary = hasSecondary ? record.secondaryConnections[0] : null;
  const hasAggravationSignal = /aggravat/i.test(asText(topSecondary?.rationale));

  if (record?.alreadyRated && worseningKeys.has(conditionKey)) {
    return CLAIM_CATEGORY.INCREASE;
  }
  if (record?.deniedPreviously) {
    return CLAIM_CATEGORY.REOPEN;
  }
  if (hasSecondary && hasAggravationSignal) {
    return CLAIM_CATEGORY.AGGRAVATION;
  }
  if (hasSecondary) {
    return CLAIM_CATEGORY.SECONDARY;
  }
  if (record?.presumptivePathPossible) {
    return CLAIM_CATEGORY.PRESUMPTIVE;
  }
  return CLAIM_CATEGORY.PRIMARY;
}

function formatEvidenceReference(prefix, evidenceItem) {
  if (!evidenceItem || typeof evidenceItem !== 'object') {
    return '';
  }
  const label = asText(evidenceItem.label);
  if (!label) return '';
  const source = asText(evidenceItem.sourceName);
  const date = asText(evidenceItem.date);
  const summary = asText(evidenceItem.summaryText);
  return [
    prefix,
    label,
    source ? `(${source})` : '',
    date ? `- ${date}` : '',
    summary ? `- ${summary}` : '',
  ].filter(Boolean).join(' ');
}

function buildServiceEvidence(serviceRecords, record) {
  const rows = [];
  asList(serviceRecords).forEach((serviceRecord) => {
    const recordHasConditionContext = hasTokenMatch(record?.condition, serviceRecord?.exposureNotes)
      || hasTokenMatch(record?.condition, serviceRecord?.mos?.primary)
      || Boolean(serviceRecord?.combatStatus)
      || record?.presumptivePathPossible;
    if (!recordHasConditionContext) return;

    const branch = asText(serviceRecord?.branch);
    const mos = asText(serviceRecord?.mos?.primary);
    const exposures = uniqueStrings(serviceRecord?.likelyExposures);
    const hazardPay = uniqueStrings(serviceRecord?.hazardPayIndicators);
    const radiation = uniqueStrings(serviceRecord?.radiationOperations);

    if (branch || mos) {
      rows.push(`Service profile: ${[branch, mos].filter(Boolean).join(' / ')}`);
    }
    if (exposures.length > 0) {
      rows.push(`Exposure indicators: ${exposures.join(', ')}`);
    }
    if (hazardPay.length > 0) {
      rows.push(`Hazard pay indicators: ${hazardPay.join(', ')}`);
    }
    if (radiation.length > 0) {
      rows.push(`Radiation operations: ${radiation.join(', ')}`);
    }
    if (serviceRecord?.combatStatus) {
      rows.push('Combat status present in service records');
    }
  });

  if (record?.presumptivePathPossible) {
    rows.push('Presumptive pathway signal detected from service/deployment history');
  }

  return uniqueEvidenceRows(rows);
}

function buildRatingEvidence(record) {
  const rows = [];
  asList(record?.sourceEvidence?.rated).forEach((item) => {
    const row = formatEvidenceReference('Rated:', item);
    if (row) rows.push(row);
  });
  asList(record?.sourceEvidence?.denied).forEach((item) => {
    const row = formatEvidenceReference('Denied:', item);
    if (row) rows.push(row);
  });
  if (record?.deniedPreviously) {
    rows.push('Prior denial found in VA rating decision history');
  }
  return uniqueEvidenceRows(rows);
}

function buildConditionEvidence(claimDataUnified, record) {
  const strEvidence = uniqueEvidenceRows(asList(record?.sourceEvidence?.inService)
    .map((item) => formatEvidenceReference('STR:', item))
    .filter(Boolean));

  const treatmentEvidence = uniqueEvidenceRows(asList(record?.sourceEvidence?.current)
    .map((item) => formatEvidenceReference('Treatment:', item))
    .filter(Boolean));

  const serviceEvidence = buildServiceEvidence(claimDataUnified?.service, record);
  const ratingDecisionEvidence = buildRatingEvidence(record);

  return {
    str: strEvidence,
    treatment: treatmentEvidence,
    service: serviceEvidence,
    ratingDecision: ratingDecisionEvidence,
  };
}

function getMissingEvidence(record, category, evidence) {
  const missing = [];
  if (asList(evidence.str).length === 0 && category !== CLAIM_CATEGORY.PRESUMPTIVE) {
    missing.push('In-service STR event or injury linkage');
  }
  if (asList(evidence.treatment).length === 0) {
    missing.push('Current diagnosis or continuity treatment records');
  }
  if (
    (category === CLAIM_CATEGORY.SECONDARY || category === CLAIM_CATEGORY.AGGRAVATION)
    && !asList(record?.secondaryConnections).some((connection) => asText(connection?.primaryCondition))
  ) {
    missing.push('Medical nexus explaining secondary/aggravation relationship');
  }
  if (category === CLAIM_CATEGORY.REOPEN && asList(evidence.ratingDecision).length === 0) {
    missing.push('Prior decision context for reopened issue');
  }
  if (category === CLAIM_CATEGORY.INCREASE && asList(evidence.treatment).length < 2) {
    missing.push('Updated worsening trend documentation');
  }
  return uniqueStrings(missing);
}

function getRecommendedForms(record, category) {
  const laneForms = asList(getLaneRecommendation(record?.recommendedLane).forms);
  const forms = [...laneForms];

  if (category === CLAIM_CATEGORY.REOPEN) {
    forms.push('VA Form 20-0995 (Supplemental Claim)');
    forms.push('VA Form 20-0996 (Higher-Level Review)');
  }
  if (category === CLAIM_CATEGORY.INCREASE) {
    forms.push('VA Form 21-526EZ (Increased Evaluation)');
  }
  if (category === CLAIM_CATEGORY.PRESUMPTIVE) {
    forms.push('VA Form 21-526EZ (PACT Act exposure section)');
  }
  if (category === CLAIM_CATEGORY.SECONDARY || category === CLAIM_CATEGORY.AGGRAVATION) {
    forms.push('VA Form 21-4138 (Statement in Support of Claim)');
  }

  return uniqueStrings(forms);
}

function getDbqKeywords(conditionName) {
  const normalized = normalizeKey(conditionName);
  const map = [
    { token: 'ptsd', dbqs: ['Mental Disorders (other than PTSD and Eating Disorders)', 'PTSD Review DBQ'] },
    { token: 'sleep apnea', dbqs: ['Sleep Apnea DBQ'] },
    { token: 'migraine', dbqs: ['Headaches (including Migraine Headaches) DBQ'] },
    { token: 'tinnitus', dbqs: ['Hearing Loss and Tinnitus DBQ'] },
    { token: 'knee', dbqs: ['Knee and Lower Leg Conditions DBQ'] },
    { token: 'back', dbqs: ['Back (Thoracolumbar Spine) Conditions DBQ'] },
    { token: 'lumbar', dbqs: ['Back (Thoracolumbar Spine) Conditions DBQ'] },
    { token: 'cervical', dbqs: ['Neck (Cervical Spine) Conditions DBQ'] },
    { token: 'radiculopathy', dbqs: ['Peripheral Nerves Conditions DBQ'] },
    { token: 'sinus', dbqs: ['Sinusitis, Rhinitis and Other Conditions DBQ'] },
    { token: 'asthma', dbqs: ['Respiratory Conditions DBQ'] },
    { token: 'hypertension', dbqs: ['Hypertension DBQ'] },
    { token: 'gerd', dbqs: ['Esophageal Conditions DBQ'] },
  ];

  const dbqs = map
    .filter((entry) => normalized.includes(entry.token))
    .flatMap((entry) => entry.dbqs);

  if (dbqs.length === 0) {
    dbqs.push('General Medical DBQ');
  }

  return uniqueStrings(dbqs);
}

function getWhyClaimable(record, category, evidence) {
  const reasons = [];
  if (asList(evidence.str).length > 0) {
    reasons.push('STR evidence documents in-service onset, injury, or event');
  }
  if (asList(evidence.treatment).length > 0) {
    reasons.push('Current treatment records show active diagnosis or symptoms');
  }
  if (asList(evidence.service).length > 0) {
    reasons.push('Service data shows exposure, MOS risk, deployment, or combat indicators');
  }
  if (category === CLAIM_CATEGORY.SECONDARY || category === CLAIM_CATEGORY.AGGRAVATION) {
    const connection = asList(record?.secondaryConnections)[0];
    if (connection?.primaryCondition) {
      reasons.push(`Secondary pathway exists through service-connected ${connection.primaryCondition}`);
    }
  }
  if (category === CLAIM_CATEGORY.REOPEN) {
    reasons.push('Prior denial allows a reopened pathway with new and relevant evidence');
  }
  if (category === CLAIM_CATEGORY.INCREASE) {
    reasons.push('Worsening trend against an already rated issue supports increase review');
  }
  return reasons.join('. ') || 'Condition has at least one documented evidence source and a viable filing lane.';
}

function buildFollowUpQuestions(record, category, missingEvidence) {
  const questions = [];
  const conditionName = asText(record?.condition);
  const topSecondary = asList(record?.secondaryConnections)[0];

  if (missingEvidence.some((item) => /current diagnosis|continuity treatment/i.test(item))) {
    questions.push(`Have you been treated for ${conditionName} recently?`);
    questions.push(`Do you have any private medical records for ${conditionName}?`);
  }

  if (category === CLAIM_CATEGORY.INCREASE) {
    questions.push(`Has ${conditionName} impacted your work or daily activities more than before?`);
  }

  if (record?.presumptivePathPossible || category === CLAIM_CATEGORY.PRESUMPTIVE) {
    questions.push(`Did you experience ${conditionName} symptoms during or shortly after deployment?`);
  }

  if (category === CLAIM_CATEGORY.SECONDARY || category === CLAIM_CATEGORY.AGGRAVATION) {
    const primary = asText(topSecondary?.primaryCondition) || 'your primary condition';
    questions.push(`Has your ${primary} caused or worsened ${conditionName}?`);
  }

  if (category === CLAIM_CATEGORY.REOPEN || record?.deniedPreviously) {
    questions.push(`Do you have new and relevant evidence for ${conditionName} since the last decision?`);
  }

  if (missingEvidence.some((item) => /nexus/i.test(item))) {
    questions.push(`Can your provider write a nexus statement linking ${conditionName} to service?`);
  }

  return uniqueStrings(questions).slice(0, 6);
}

function buildFollowUpChecklist(generatedConditions = []) {
  return uniqueStrings(asList(generatedConditions).flatMap((condition) => (
    asList(condition?.followUpQuestions).map((question) => `${asText(condition?.conditionName)}: ${question}`)
  )));
}

function summarizeEvidenceForStatement(evidenceRows = [], limit = 2) {
  return uniqueEvidenceRows(asList(evidenceRows)).slice(0, limit).join('; ');
}

function extractIsoDate(text = '') {
  const match = asText(text).match(/\b\d{4}-\d{2}-\d{2}\b/);
  return match ? match[0] : '';
}

function cleanEvidenceLabel(text = '', fallback = '') {
  const value = asText(text)
    .replace(/^STR:\s*/i, '')
    .replace(/^Treatment:\s*/i, '')
    .replace(/^Rated:\s*/i, '')
    .replace(/^Denied:\s*/i, '')
    .replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*/i, '')
    .trim();
  return value || fallback;
}

function getConditionTemplateModel(condition = {}, claimDataUnified = {}) {
  const treatment = claimDataUnified?.currentTreatment || {};
  const providers = asList(treatment?.providerContinuity);
  const limitations = asList(treatment?.functionalLimitations);
  const worsening = asList(treatment?.worseningTrends);
  const firstStr = asList(condition?.evidence?.str)[0] || '';
  const firstTreatment = asList(condition?.evidence?.treatment)[0] || '';
  const firstRating = asList(condition?.evidence?.ratingDecision)[0] || '';
  const firstService = asList(condition?.evidence?.service)[0] || '';
  const name = asText(condition?.conditionName);

  const functionalImpactSummary = limitations.find((item) => hasTokenMatch(item, name))
    || limitations[0]
    || 'reduced daily functioning and work capacity';

  const changeSinceDecisionSummary = worsening.find((item) => hasTokenMatch(item, name))
    ? `my symptoms for ${name} have worsened since the prior VA decision`
    : `I have submitted additional evidence and ongoing symptom history for ${name}`;

  const isReopen = condition?.category === CLAIM_CATEGORY.REOPEN;
  const isIncrease = condition?.category === CLAIM_CATEGORY.INCREASE;

  return {
    conditionName: name,
    categoryLabel: asText(condition?.category) || CLAIM_CATEGORY.PRIMARY,
    hasInServiceEvidence: asList(condition?.evidence?.str).length > 0,
    inServiceOnsetApproxDate: extractIsoDate(firstStr) || 'my service period',
    inServiceEventDescription: cleanEvidenceLabel(firstStr, `experienced symptoms related to ${name}`),
    inServiceEvidenceSummary: summarizeEvidenceForStatement(condition?.evidence?.str, 2) || 'available STR entries tied to this condition',
    hasCurrentEvidence: asList(condition?.evidence?.treatment).length > 0,
    currentSymptomSummary: cleanEvidenceLabel(firstTreatment, `ongoing symptoms related to ${name}`),
    functionalImpactSummary,
    currentProvidersSummary: providers.length > 0 ? providers.join(', ') : 'VA and private medical providers',
    currentTreatmentSummary: summarizeEvidenceForStatement(condition?.evidence?.treatment, 2) || 'ongoing clinical management and monitoring',
    inServiceEvidenceShort: summarizeEvidenceForStatement(condition?.evidence?.str, 1) || 'No STR evidence currently available',
    currentEvidenceShort: summarizeEvidenceForStatement(condition?.evidence?.treatment, 1) || 'No current treatment evidence currently available',
    exposureSummary: summarizeEvidenceForStatement(condition?.evidence?.service, 1)
      || asList(claimDataUnified?.derivedSignals?.exposures).slice(0, 3).join(', ')
      || 'No specific exposure signal currently available',
    isNewOrReopenOrIncrease: true,
    claimRationale: isReopen
      ? `this condition was previously denied and I now have new and relevant evidence showing continuity and severity`
      : isIncrease
        ? `this service-connected condition has worsened and now causes greater functional impact`
        : `the evidence shows this condition began in or is linked to service and continues to affect daily life`,
    decisionType: asText(firstRating).toLowerCase().includes('denied') ? 'Denied' : 'Service-connected or prior VA decision',
    percentage: 'N/A',
    effectiveDate: extractIsoDate(firstRating) || 'N/A',
    changeSinceDecisionSummary,
    sourceRating: firstRating,
    sourceService: firstService,
  };
}

function buildServiceTemplateModel(service = []) {
  const entries = asList(service);
  const primary = entries[0] || {};
  const fullNameStartEnd = entries
    .flatMap((entry) => [entry?.servicePeriods?.from, entry?.servicePeriods?.to])
    .filter(Boolean);

  const firstStartDate = fullNameStartEnd.length > 0
    ? fullNameStartEnd.filter((value, index) => index % 2 === 0).sort()[0]
    : '';
  const lastEndDate = fullNameStartEnd.length > 1
    ? fullNameStartEnd.filter((value, index) => index % 2 === 1).sort().slice(-1)[0]
    : '';

  const units = uniqueStrings(entries.flatMap((entry) => [
    entry?.dd214Extraction?.lastDutyAssignment?.lastDutyAssignmentTitle,
    entry?.dd214Extraction?.lastDutyAssignment?.majorCommand,
    entry?.dd214Extraction?.intelligentExtraction?.stationAtSeparation,
  ])).slice(0, 4);

  const deployments = uniqueStrings(entries.flatMap((entry) =>
    asList(entry?.deployments).map((item) => item?.location || item)
  )).slice(0, 6);

  return {
    primaryBranch: asText(primary?.branch) || 'military service',
    firstStartDate: firstStartDate || 'service entry date',
    lastEndDate: lastEndDate || 'service separation date',
    primaryMOS: asText(primary?.mos?.primary) || 'recorded MOS/AFSC',
    keyUnitsOrInstallations: units.length > 0 ? units.join(', ') : 'recorded units and installations',
    keyDeployments: deployments.length > 0 ? deployments.join(', ') : 'recorded deployment locations',
    dischargeType: asText(primary?.dd214Extraction?.characterAndSeparation?.characterOfService || primary?.dischargeType) || 'recorded discharge type',
  };
}

function buildRatingDecisionTemplateModel(claimDataUnified = {}, conditionModels = []) {
  const ratingDecision = claimDataUnified?.ratingDecision || {};
  const granted = asList(ratingDecision?.grantedConditions);
  const denied = asList(ratingDecision?.deniedConditions);
  const serviceConnectedPercentages = asList(ratingDecision?.percentages?.serviceConnected);

  const relevantEntries = uniqueStrings([...granted, ...denied]).map((conditionName) => {
    const percentageEntry = serviceConnectedPercentages.find((entry) => hasTokenMatch(entry?.condition, conditionName));
    const model = conditionModels.find((item) => hasTokenMatch(item?.conditionName, conditionName));
    const isDenied = denied.some((item) => hasTokenMatch(item, conditionName));

    return {
      conditionName,
      decisionType: isDenied ? 'Denied' : 'Granted',
      percentage: Number.isFinite(Number(percentageEntry?.percent)) && Number(percentageEntry?.percent) > 0
        ? Number(percentageEntry.percent)
        : 'N/A',
      effectiveDate: asList(ratingDecision?.effectiveDates)[0] || model?.effectiveDate || 'N/A',
      changeSinceDecisionSummary: model?.changeSinceDecisionSummary || `I continue to experience this condition with additional supporting evidence`,
    };
  });

  return {
    hasHistory: relevantEntries.length > 0,
    relevantEntries,
  };
}

function buildLayStatement(claimDataUnified = {}, generatedConditions = []) {
  if (generatedConditions.length === 0) {
    return '';
  }

  const profile = claimDataUnified?.profile || {};
  const veteranFullName = asText(`${profile?.identity?.firstName || ''} ${profile?.identity?.lastName || ''}`) || 'the Veteran';
  const serviceModel = buildServiceTemplateModel(claimDataUnified?.service);
  const conditionModels = generatedConditions.map((condition) => getConditionTemplateModel(condition, claimDataUnified));
  const ratingDecisionModel = buildRatingDecisionTemplateModel(claimDataUnified, conditionModels);
  const preferredContact = asText(profile?.preferredContactMethod)
    || asText(profile?.contact?.email)
    || asText(profile?.contact?.phone)
    || 'preferred contact on file';
  const representationSummary = asText(profile?.representation?.type)
    || asText(profile?.representation?.name)
    || 'No representative listed';

  const sectionII = conditionModels
    .filter((item) => item.hasInServiceEvidence)
    .map((item) => `- ${item.conditionName}: Around ${item.inServiceOnsetApproxDate}, I ${item.inServiceEventDescription}. Service treatment records show ${item.inServiceEvidenceSummary}.`)
    .join('\n') || '- No in-service STR-linked condition entries are currently available.';

  const sectionIII = conditionModels
    .filter((item) => item.hasCurrentEvidence)
    .map((item) => `- ${item.conditionName}: I currently experience ${item.currentSymptomSummary}, which affects my daily life by ${item.functionalImpactSummary}. I have been treated by ${item.currentProvidersSummary}, and treatment has included ${item.currentTreatmentSummary}.`)
    .join('\n') || '- No current treatment-linked condition entries are currently available.';

  const sectionIV = conditionModels
    .map((item) => (
      `- ${item.conditionName} (${item.categoryLabel}):\n`
      + `  - In-service evidence: ${item.inServiceEvidenceShort}\n`
      + `  - Current evidence: ${item.currentEvidenceShort}\n`
      + `  - Exposures or risk factors: ${item.exposureSummary}`
    ))
    .join('\n');

  const sectionV = ratingDecisionModel.hasHistory
    ? (
      `I have previously received VA decisions related to my conditions:\n\n${ratingDecisionModel.relevantEntries
        .map((entry) => `- ${entry.conditionName}: ${entry.decisionType} at ${entry.percentage}% effective ${entry.effectiveDate}. Since that decision, ${entry.changeSinceDecisionSummary}.`)
        .join('\n')}`
    )
    : 'No prior VA decision history is currently captured for these conditions.';

  const sectionVI = conditionModels
    .filter((item) => item.isNewOrReopenOrIncrease)
    .map((item) => `- ${item.conditionName}: ${item.claimRationale}`)
    .join('\n') || '- No qualifying new/reopen/increase rationale entries are currently available.';

  return [
    'I. Veteran Identity and Service',
    '',
    `My name is ${veteranFullName}, and I served in the ${serviceModel.primaryBranch} from ${serviceModel.firstStartDate} to ${serviceModel.lastEndDate}. My MOS/AFSC was ${serviceModel.primaryMOS}, and I was assigned to ${serviceModel.keyUnitsOrInstallations}. I deployed to ${serviceModel.keyDeployments}. My discharge type was ${serviceModel.dischargeType}.`,
    '',
    'II. In-Service Events and Injuries',
    '',
    'During my military service, I experienced the following events and medical issues:',
    '',
    sectionII,
    '',
    'III. Current Conditions and Daily Impact',
    '',
    'Since leaving service, these conditions have continued or worsened:',
    '',
    sectionIII,
    '',
    'IV. Relationship Between Service and Current Conditions',
    '',
    'I believe the following conditions are related to my military service:',
    '',
    sectionIV,
    '',
    'V. Prior VA Decisions (If Applicable)',
    '',
    sectionV,
    '',
    'VI. Reason for This Claim / Request',
    '',
    'I am filing this claim (or request for increase/reopen) because:',
    '',
    sectionVI,
    '',
    'VII. Closing Statement',
    '',
    'I certify that the information I have provided is true to the best of my knowledge. I respectfully request that VA consider my service history, in-service events, current medical evidence, and the impact these conditions have on my daily life when deciding my claim.',
    '',
    'Signed,',
    veteranFullName,
    preferredContact,
    representationSummary,
  ].join('\n');
}

export function validateGeneratedConditions(generatedConditions = [], options = {}) {
  const issues = [];
  const seen = new Set();
  const layStatement = asText(options?.layStatement);
  const followUpChecklist = asList(options?.followUpChecklist);

  asList(generatedConditions).forEach((condition, index) => {
    const name = asText(condition?.conditionName);
    const key = normalizeKey(name);
    if (!key) {
      issues.push(`Condition at index ${index} is missing a condition name.`);
      return;
    }

    if (seen.has(key)) {
      issues.push(`Duplicate generated condition detected: ${name}`);
    }
    seen.add(key);

    const evidence = condition?.evidence || {};
    const evidenceCount = [
      ...asList(evidence.str),
      ...asList(evidence.treatment),
      ...asList(evidence.service),
      ...asList(evidence.ratingDecision),
    ].length;

    if (evidenceCount === 0) {
      issues.push(`${name} has no evidence sources.`);
    }

    if (asList(condition?.missingEvidence).length > 0 && asList(condition?.followUpQuestions).length === 0) {
      issues.push(`${name} has missing evidence but no follow-up questions.`);
    }

    if (layStatement && !normalizeKey(layStatement).includes(normalizeKey(name))) {
      issues.push(`${name} is not reflected in the lay statement.`);
    }
  });

  if (generatedConditions.length > 0 && !layStatement) {
    issues.push('Lay statement was not generated.');
  }

  if (generatedConditions.some((condition) => asList(condition?.missingEvidence).length > 0) && followUpChecklist.length === 0) {
    issues.push('Missing-evidence conditions exist but no follow-up checklist was generated.');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function buildEvidenceIndex(generatedConditions = []) {
  const rows = [];
  asList(generatedConditions).forEach((item) => {
    ['str', 'treatment', 'service', 'ratingDecision'].forEach((sourceType) => {
      asList(item?.evidence?.[sourceType]).forEach((evidenceRow) => {
        rows.push({
          sourceType,
          conditionName: item.conditionName,
          evidence: asText(evidenceRow),
        });
      });
    });
  });
  return rows;
}

function buildRecommendedActions(generatedConditions = [], claimDataUnified = {}) {
  const actions = uniqueStrings(asList(claimDataUnified?.derivedSignals?.nextActions));
  const missingCount = generatedConditions.reduce((sum, item) => sum + asList(item?.missingEvidence).length, 0);
  const reopenCount = generatedConditions.filter((item) => item.category === CLAIM_CATEGORY.REOPEN).length;
  const increaseCount = generatedConditions.filter((item) => item.category === CLAIM_CATEGORY.INCREASE).length;

  if (missingCount > 0) {
    actions.push(`Resolve ${missingCount} evidence gap indicator(s) before filing.`);
  }
  if (reopenCount > 0) {
    actions.push(`Prepare supplemental or review strategy for ${reopenCount} reopened condition(s).`);
  }
  if (increaseCount > 0) {
    actions.push(`Collect worsening trend evidence for ${increaseCount} increase candidate(s).`);
  }
  if (generatedConditions.length > 0) {
    actions.push('Review generated follow-up questions and capture responses in statement or treatment records.');
  }

  return uniqueStrings(actions).slice(0, 10);
}

export function synthesizeGeneratedConditions(claimDataUnified = {}) {
  if (asList(claimDataUnified?.generatedConditions).length > 0) {
    return asList(claimDataUnified.generatedConditions);
  }

  const conditionRecords = asList(claimDataUnified?.derivedSignals?.conditionRecords);
  const lookup = buildConditionLookup(conditionRecords);
  const worseningKeys = getWorseningConditionKeys(claimDataUnified);

  const generated = [];

  conditionRecords.forEach((record) => {
    const conditionName = asText(record?.condition);
    if (!conditionName) return;

    const canonical = lookup.get(normalizeKey(conditionName)) || conditionName;
    const category = getCategory(record, worseningKeys);
    const evidence = buildConditionEvidence(claimDataUnified, record);
    const confidenceScore = Math.max(0, Math.min(100, Number(record?.readinessScore || 0)));
    const confidence = {
      score: confidenceScore,
      level: getConfidenceLevel(confidenceScore),
    };
    const missingEvidence = getMissingEvidence(record, category, evidence);
    const recommendedForms = getRecommendedForms(record, category);
    const recommendedDBQs = getDbqKeywords(canonical);
    const followUpQuestions = buildFollowUpQuestions(record, category, missingEvidence);
    const whyClaimable = getWhyClaimable(record, category, evidence);

    const allEvidenceCount = [
      ...evidence.str,
      ...evidence.treatment,
      ...evidence.service,
      ...evidence.ratingDecision,
    ].length;

    if (allEvidenceCount === 0) {
      return;
    }

    generated.push({
      ...createEmptyGeneratedCondition(),
      conditionName: canonical,
      category,
      evidence,
      confidence,
      missingEvidence,
      recommendedForms,
      recommendedDBQs,
      followUpQuestions,
      whyClaimable,
      filingLane: asText(record?.recommendedLane) || getLaneRecommendation('Develop evidence').forms[0],
    });
  });

  const deduped = [];
  const seen = new Set();
  generated.forEach((item) => {
    const key = normalizeKey(item.conditionName);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  return deduped;
}

export function buildUnifiedSummaryPayload(claimDataUnified = {}) {
  const generatedConditions = asList(claimDataUnified?.generatedConditions).length > 0
    ? asList(claimDataUnified.generatedConditions)
    : synthesizeGeneratedConditions(claimDataUnified);
  const evidenceIndex = asList(claimDataUnified?.evidenceIndex).length > 0
    ? asList(claimDataUnified.evidenceIndex)
    : buildEvidenceIndex(generatedConditions);
  const readinessScore = generatedConditions.length > 0
    ? Math.round(generatedConditions.reduce((sum, item) => sum + getConditionConfidenceScore(item), 0) / generatedConditions.length)
    : 0;
  const recommendedActions = buildRecommendedActions(generatedConditions, claimDataUnified);
  const followUpChecklist = buildFollowUpChecklist(generatedConditions);
  const layStatement = asText(claimDataUnified?.layStatement) || buildLayStatement(claimDataUnified, generatedConditions);
  const layStatementTemplate = layStatement;
  const validation = validateGeneratedConditions(generatedConditions, { layStatement, followUpChecklist });

  const currentSection = claimDataUnified?.claimGeneratorSummary || createClaimGeneratorSummarySection();
  const nextComparable = JSON.stringify({
    generatedConditions,
    readinessScore,
    evidenceIndex,
    recommendedActions,
    followUpChecklist,
    layStatement,
    layStatementTemplate,
  });
  const currentComparable = JSON.stringify({
    generatedConditions: asList(currentSection?.generatedConditions),
    readinessScore: Number(currentSection?.readinessScore || 0),
    evidenceIndex: asList(currentSection?.evidenceIndex),
    recommendedActions: asList(currentSection?.recommendedActions),
    followUpChecklist: asList(currentSection?.followUpChecklist),
    layStatement: asText(currentSection?.layStatement),
    layStatementTemplate: asText(currentSection?.layStatementTemplate),
  });
  const hasMeaningfulChange = nextComparable !== currentComparable;
  const updatedAt = hasMeaningfulChange
    ? new Date().toISOString()
    : asText(currentSection?.updatedAt) || null;

  return {
    ...createClaimGeneratorSummarySection(),
    generatedConditions,
    readinessScore,
    evidenceIndex,
    recommendedActions,
    followUpChecklist,
    layStatement,
    layStatementTemplate,
    validation,
    updatedAt,
  };
}

export function formatUnifiedSummaryTxt(payload = createClaimGeneratorSummarySection()) {
  const lines = [];
  lines.push('RALLY FORGE CLAIM GENERATOR & SUMMARY');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(`Readiness score: ${Number(payload?.readinessScore || 0)}%`);
  lines.push(`Total generated conditions: ${asList(payload?.generatedConditions).length}`);
  lines.push('');

  lines.push('RECOMMENDED ACTIONS');
  asList(payload?.recommendedActions).forEach((action, index) => {
    lines.push(`${index + 1}. ${action}`);
  });
  lines.push('');

  lines.push('FOLLOW-UP CHECKLIST');
  asList(payload?.followUpChecklist).forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push('');

  lines.push('AUTO-GENERATED LAY STATEMENT');
  lines.push(asText(payload?.layStatementTemplate || payload?.layStatement) || 'No lay statement generated.');
  lines.push('');

  lines.push('GENERATED CONDITIONS');
  asList(payload?.generatedConditions).forEach((condition, index) => {
    lines.push(`${index + 1}. ${condition.conditionName}`);
    lines.push(`   Category: ${condition.category}`);
    lines.push(`   Confidence: ${getConditionConfidenceScore(condition)}% (${getConditionConfidenceLevel(condition)})`);
    lines.push(`   Why claimable: ${asText(condition.whyClaimable)}`);
    lines.push(`   Recommended forms: ${asList(condition.recommendedForms).join('; ') || 'N/A'}`);
    lines.push(`   Recommended DBQs: ${asList(condition.recommendedDBQs).join('; ') || 'N/A'}`);

    lines.push('   Evidence summary:');
    ['str', 'treatment', 'service', 'ratingDecision'].forEach((sourceType) => {
      const items = asList(condition?.evidence?.[sourceType]);
      if (items.length === 0) return;
      lines.push(`     ${sourceType}:`);
      items.forEach((item) => lines.push(`       - ${item}`));
    });

    if (asList(condition?.missingEvidence).length > 0) {
      lines.push(`   Missing evidence: ${condition.missingEvidence.join('; ')}`);
    }

    if (asList(condition?.followUpQuestions).length > 0) {
      lines.push('   Follow-up questions:');
      condition.followUpQuestions.forEach((question) => lines.push(`       - ${question}`));
    }

    lines.push('');
  });

  lines.push('EVIDENCE INDEX');
  asList(payload?.evidenceIndex).forEach((entry, index) => {
    lines.push(`${index + 1}. [${entry.sourceType}] ${entry.conditionName} - ${entry.evidence}`);
  });

  return lines.join('\n');
}

export function buildUnifiedSummaryJson(payload = createClaimGeneratorSummarySection()) {
  return {
    generatedAt: new Date().toISOString(),
    generatedConditions: asList(payload?.generatedConditions),
    readinessScore: Number(payload?.readinessScore || 0),
    evidenceIndex: asList(payload?.evidenceIndex),
    recommendedActions: asList(payload?.recommendedActions),
    followUpChecklist: asList(payload?.followUpChecklist),
    layStatement: asText(payload?.layStatement),
    layStatementTemplate: asText(payload?.layStatementTemplate || payload?.layStatement),
    validation: payload?.validation || { valid: true, issues: [] },
  };
}
