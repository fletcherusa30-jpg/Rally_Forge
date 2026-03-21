/**
 * Engine: layStatement
 * Purpose: Generate deterministic lay-statement narrative from unified claim data and generated conditions.
 * Inputs: claimDataUnified and generated condition rows.
 * Outputs: String narrative suitable for downstream review/export.
 * Trigger conditions: Any silent unified-data or generated-conditions recompute.
 */
function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(asList(values).map((item) => asText(item)).filter(Boolean)));
}

function buildServiceModel(service = []) {
  const entries = asList(service);
  const primary = entries[0] || {};

  const starts = entries.map((item) => asText(item?.startDate)).filter(Boolean).sort();
  const ends = entries.map((item) => asText(item?.endDate)).filter(Boolean).sort();

  const units = uniqueStrings(entries.flatMap((item) => [item?.branchOfService, item?.serviceType])).slice(0, 6);

  const deployments = uniqueStrings(entries.flatMap((item) => asList(item?.deploymentLocations))).slice(0, 8);

  return {
    primaryBranch: asText(primary?.branchOfService) || 'military service',
    firstStartDate: starts[0] || 'service entry date',
    lastEndDate: ends.slice(-1)[0] || 'service separation date',
    primaryMOS: asText(primary?.primaryMOS) || 'recorded MOS/AFSC',
    keyUnitsOrInstallations: units.length > 0 ? units.join(', ') : 'recorded units and installations',
    keyDeployments: deployments.length > 0 ? deployments.join(', ') : 'recorded deployment locations',
    dischargeType: asText(primary?.dischargeType) || 'recorded discharge type',
  };
}

function buildConditionRows(generatedConditions = []) {
  return asList(generatedConditions).map((condition) => ({
    conditionName: asText(condition?.conditionName),
    categoryLabel: asText(condition?.category),
    hasInServiceEvidence: asList(condition?.evidence?.str).length > 0,
    hasCurrentEvidence: asList(condition?.evidence?.treatment).length > 0,
    inServiceOnsetApproxDate: 'my service period',
    inServiceEventDescription: asText(asList(condition?.evidence?.str)[0]).replace(/^STR:\s*/i, '') || `experienced in-service symptoms related to ${asText(condition?.conditionName)}`,
    inServiceEvidenceSummary: asList(condition?.evidence?.str).slice(0, 2).join('; ') || 'available STR evidence',
    currentSymptomSummary: asText(asList(condition?.evidence?.treatment)[0]).replace(/^Treatment:\s*/i, '') || `ongoing symptoms related to ${asText(condition?.conditionName)}`,
    functionalImpactSummary: asText(asList(condition?.flags).find((item) => /functional/i.test(item))) || 'reduced daily and occupational functioning',
    currentProvidersSummary: 'VA and/or private providers in treatment records',
    currentTreatmentSummary: asList(condition?.evidence?.treatment).slice(0, 2).join('; ') || 'ongoing treatment and monitoring',
    inServiceEvidenceShort: asList(condition?.evidence?.str).slice(0, 1).join('; ') || 'No STR evidence currently captured',
    currentEvidenceShort: asList(condition?.evidence?.treatment).slice(0, 1).join('; ') || 'No current treatment evidence currently captured',
    exposureSummary: asList(condition?.evidence?.service).slice(0, 1).join('; ') || 'No specific exposure signal currently captured',
    isNewOrReopenOrIncrease: ['reopen', 'increase', 'primary', 'secondary', 'presumptive', 'aggravation'].includes(asText(condition?.category)),
    claimRationale: asText(condition?.whyClaimable) || 'the evidence supports a service-connected pathway for this condition',
  }));
}

function buildRatingEntries(ratingDecision = {}, conditionRows = []) {
  const granted = asList(ratingDecision?.grantedConditions);
  const denied = asList(ratingDecision?.deniedConditions);
  const all = uniqueStrings([...granted, ...denied]);

  const entries = all.map((conditionName) => {
    const deniedFlag = denied.some((item) => asText(item).toLowerCase() === asText(conditionName).toLowerCase());
    const pct = asList(ratingDecision?.percentages?.serviceConnected).find((item) => asText(item?.condition).toLowerCase() === asText(conditionName).toLowerCase());
    const model = conditionRows.find((item) => asText(item.conditionName).toLowerCase() === asText(conditionName).toLowerCase());

    return {
      conditionName,
      decisionType: deniedFlag ? 'Denied' : 'Granted',
      percentage: Number.isFinite(Number(pct?.percent)) ? Number(pct.percent) : 'N/A',
      effectiveDate: asList(ratingDecision?.effectiveDates)[0] || 'N/A',
      changeSinceDecisionSummary: model?.claimRationale || 'additional medical and functional evidence has been added',
    };
  });

  return {
    hasHistory: entries.length > 0,
    relevantEntries: entries,
  };
}

export function runLayStatementEngine(claimDataUnified = {}, generatedConditions = []) {
  if (asList(generatedConditions).length === 0) {
    return '';
  }

  const profile = claimDataUnified?.profile || {};
  const serviceModel = buildServiceModel(claimDataUnified?.service);
  const conditionRows = buildConditionRows(generatedConditions);
  const ratingDecisionEntries = buildRatingEntries(claimDataUnified?.ratingDecision || {}, conditionRows);

  const veteranFullName = asText(`${profile?.firstName || ''} ${profile?.middleName || ''} ${profile?.lastName || ''}`) || 'the Veteran';
  const preferredContact = asText(profile?.preferredContactMethod)
    || asText(profile?.email)
    || asText(profile?.phone)
    || 'preferred contact on file';
  const representationSummary = asText(profile?.representationType)
    || 'No representative listed';

  const sectionII = conditionRows.filter((item) => item.hasInServiceEvidence)
    .map((item) => `- ${item.conditionName}: Around ${item.inServiceOnsetApproxDate}, I ${item.inServiceEventDescription}. Service treatment records show ${item.inServiceEvidenceSummary}.`)
    .join('\n') || '- No in-service evidence entries are currently available.';

  const sectionIII = conditionRows.filter((item) => item.hasCurrentEvidence)
    .map((item) => `- ${item.conditionName}: I currently experience ${item.currentSymptomSummary}, which affects my daily life by ${item.functionalImpactSummary}. I have been treated by ${item.currentProvidersSummary}, and treatment has included ${item.currentTreatmentSummary}.`)
    .join('\n') || '- No current treatment evidence entries are currently available.';

  const sectionIV = conditionRows.map((item) => (
    `- ${item.conditionName} (${item.categoryLabel}):\n`
    + `  - In-service evidence: ${item.inServiceEvidenceShort}\n`
    + `  - Current evidence: ${item.currentEvidenceShort}\n`
    + `  - Exposures or risk factors: ${item.exposureSummary}`
  )).join('\n');

  const sectionV = ratingDecisionEntries.hasHistory
    ? `I have previously received VA decisions related to my conditions:\n\n${ratingDecisionEntries.relevantEntries.map((item) => `- ${item.conditionName}: ${item.decisionType} at ${item.percentage}% effective ${item.effectiveDate}. Since that decision, ${item.changeSinceDecisionSummary}.`).join('\n')}`
    : 'No prior VA decision history is currently captured for these conditions.';

  const sectionVI = conditionRows.filter((item) => item.isNewOrReopenOrIncrease)
    .map((item) => `- ${item.conditionName}: ${item.claimRationale}`)
    .join('\n') || '- No qualifying rationale entries are currently available.';

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
