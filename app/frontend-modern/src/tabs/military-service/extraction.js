import {
  inferServiceEra,
  normalizeDeploymentLocations,
  normalizeMosCode,
  normalizeReCode,
  normalizeSpdCode,
  validateSeparationAuthority,
} from './normalization.js';

function getFieldConfidence(result, key) {
  const fromAnalysis = result?.dd214?.dd214Analysis?.confidenceScores?.fields?.[key];
  if (typeof fromAnalysis === 'number') {
    return fromAnalysis;
  }

  const fromMeta = result?.extractionMeta?.fieldConfidence?.[key];
  if (typeof fromMeta === 'number') {
    return fromMeta;
  }

  return null;
}

export function buildExtractionConfidence(result) {
  const overallRaw = Number(result?.extractionMeta?.confidence);
  const overallConfidence = Number.isFinite(overallRaw) ? overallRaw : null;

  const fieldConfidence = {
    branchOfService: getFieldConfidence(result, 'branchOfService'),
    serviceType: getFieldConfidence(result, 'component'),
    startDate: getFieldConfidence(result, 'entryDate'),
    endDate: getFieldConfidence(result, 'separationDate'),
    rankRate: getFieldConfidence(result, 'payGrade'),
    dischargeType: getFieldConfidence(result, 'characterOfService'),
    primaryMOS: getFieldConfidence(result, 'primaryMOSOrAFSCOrRating'),
    deploymentLocations: getFieldConfidence(result, 'deployments'),
    hazardPayIndicators: getFieldConfidence(result, 'hazardIndicators'),
    separationAuthority: getFieldConfidence(result, 'separationAuthority'),
    spdCode: getFieldConfidence(result, 'separationCode'),
    reCode: getFieldConfidence(result, 'reentryCode'),
  };

  return {
    overallConfidence,
    fieldConfidence,
  };
}

function toServiceType(component) {
  const value = String(component || '').toLowerCase();
  if (value === 'active') return 'Active';
  if (value === 'reserve') return 'Reserve';
  if (value === 'guard') return 'Guard';
  return '';
}

function toDischargeType(parsed) {
  return String(
    parsed?.characterAndSeparation?.characterOfService
      || parsed?.characterAndSeparation?.typeOfSeparation
      || ''
  ).trim();
}

function buildHazardIndicators(parsed) {
  const merged = [
    ...(Array.isArray(parsed?.intelligentExtraction?.hazardIndicators)
      ? parsed.intelligentExtraction.hazardIndicators
      : []),
    ...(Array.isArray(parsed?.dd214Analysis?.deployments)
      ? parsed.dd214Analysis.deployments
        .filter((item) => item?.hazardousDutyIndicator)
        .map((item) => item?.source || 'Deployment hazard indicator')
      : []),
  ];

  return Array.from(new Set(merged.map((item) => String(item || '').trim()).filter(Boolean)));
}

function buildDeployments(parsed, knownLocations) {
  const merged = [
    ...(Array.isArray(parsed?.dd214Analysis?.deployments)
      ? parsed.dd214Analysis.deployments.map((item) => item?.location)
      : []),
    ...(Array.isArray(parsed?.decorationsAndService?.foreignServiceLocationsIfListed)
      ? parsed.decorationsAndService.foreignServiceLocationsIfListed
      : []),
  ];

  return normalizeDeploymentLocations(merged, knownLocations);
}

export function extractDd214Panels(result) {
  const parsed = result?.dd214 || null;

  if (!parsed) {
    return null;
  }

  const primaryMos = String(parsed?.gradeSpecialty?.primaryMOSOrAFSCOrRating || '').trim();
  const secondaryMos = Array.isArray(parsed?.gradeSpecialty?.mosDetails)
    ? parsed.gradeSpecialty.mosDetails
      .map((item) => normalizeMosCode(item?.code))
      .filter((code) => code && code !== primaryMos)
    : Array.isArray(parsed?.gradeSpecialty?.additionalMOSOrSpecialties)
      ? parsed.gradeSpecialty.additionalMOSOrSpecialties
        .map((item) => normalizeMosCode(item))
        .filter((code) => code && code !== primaryMos)
      : [];

  return {
    serviceProfile: {
      branch: parsed?.serviceIdentity?.branchOfService || '',
      component: parsed?.serviceIdentity?.component || '',
      serviceType: toServiceType(parsed?.serviceIdentity?.component),
      entryDate: parsed?.servicePeriods?.entryDate || '',
      separationDate: parsed?.servicePeriods?.separationDate || '',
      rankRate: parsed?.gradeSpecialty?.payGrade || parsed?.gradeSpecialty?.gradeRateRank || '',
      primaryMOS: primaryMos,
      secondaryMOS: Array.from(new Set(secondaryMos)),
    },
    dischargeAndSeparation: {
      dischargeType: toDischargeType(parsed),
      spdCode: parsed?.characterAndSeparation?.separationCode || '',
      reCode: parsed?.characterAndSeparation?.reentryCode || '',
      separationAuthority: parsed?.characterAndSeparation?.separationAuthority || '',
      narrativeReason: parsed?.characterAndSeparation?.narrativeReasonForSeparation || '',
    },
    combatAndBenefits: {
      combatVeteran: Boolean(parsed?.dd214Analysis?.combatVeteran),
      foreignService: parsed?.decorationsAndService?.foreignServiceTotal || null,
      stationAtSeparation: parsed?.intelligentExtraction?.stationAtSeparation || '',
    },
    hazardAndDeploymentPay: {
      hazardIndicators: buildHazardIndicators(parsed),
      deployments: Array.isArray(parsed?.dd214Analysis?.deployments) ? parsed.dd214Analysis.deployments : [],
    },
    installationExposureIndicators: Array.isArray(parsed?.intelligentExtraction?.installationExposures)
      ? parsed.intelligentExtraction.installationExposures
      : [],
    badgesAndAwards: Array.isArray(parsed?.decorationsAndService?.decorationsAndAwards)
      ? parsed.decorationsAndService.decorationsAndAwards
      : [],
    extendedServiceData: {
      priorActiveService: parsed?.servicePeriods?.totalPriorActiveService || null,
      priorInactiveService: parsed?.servicePeriods?.totalPriorInactiveService || null,
      seaService: parsed?.servicePeriods?.seaService || null,
      accruedLeavePaid: parsed?.servicePeriods?.accruedLeavePaid || null,
      initialEntryTraining: parsed?.servicePeriods?.initialEntryTraining || null,
      militaryEducation: Array.isArray(parsed?.militaryEducation) ? parsed.militaryEducation : [],
    },
    transferAndAssignment: {
      lastDutyAssignment: parsed?.lastDutyAssignment?.lastDutyAssignmentTitle || '',
      majorCommand: parsed?.lastDutyAssignment?.majorCommand || '',
      transferCommand: parsed?.transferCommand?.postServiceComponent || '',
      reenlistments: Array.isArray(parsed?.specialProgramsRemarks?.reenlistments)
        ? parsed.specialProgramsRemarks.reenlistments
        : [],
    },
  };
}

export function mapExtractedToMilitaryForm(result, currentForm, knownLocations = []) {
  const parsed = result?.dd214 || null;
  if (!parsed) {
    return { mapped: null, warnings: ['No parsed DD-214 payload found.'] };
  }

  const spdCode = normalizeSpdCode(parsed?.characterAndSeparation?.separationCode);
  const reCode = normalizeReCode(parsed?.characterAndSeparation?.reentryCode);
  const separationAuthorityRaw = String(parsed?.characterAndSeparation?.separationAuthority || '').trim();
  const separationAuthority = validateSeparationAuthority(separationAuthorityRaw) ? separationAuthorityRaw : '';

  const primaryMOS = normalizeMosCode(parsed?.gradeSpecialty?.primaryMOSOrAFSCOrRating);
  const additionalMOS = Array.isArray(parsed?.gradeSpecialty?.mosDetails)
    ? parsed.gradeSpecialty.mosDetails
      .map((item) => normalizeMosCode(item?.code))
      .filter((code) => code && code !== primaryMOS)
    : [];

  const deploymentLocations = buildDeployments(parsed, knownLocations);
  const hazardPayIndicators = buildHazardIndicators(parsed);

  const mapped = {
    ...currentForm,
    branchOfService: String(parsed?.serviceIdentity?.branchOfService || '').trim(),
    serviceType: toServiceType(parsed?.serviceIdentity?.component),
    startDate: String(parsed?.servicePeriods?.entryDate || '').trim(),
    endDate: String(parsed?.servicePeriods?.separationDate || '').trim(),
    rankRate: String(parsed?.gradeSpecialty?.payGrade || parsed?.gradeSpecialty?.gradeRateRank || '').trim(),
    dischargeType: toDischargeType(parsed),
    serviceEra: inferServiceEra(parsed?.servicePeriods?.entryDate, parsed?.servicePeriods?.separationDate),
    primaryMOS,
    additionalMOS: Array.from(new Set(additionalMOS)),
    deploymentLocations,
    combatVeteran: Boolean(parsed?.dd214Analysis?.combatVeteran),
    radiationExposure: /radiation|nuclear/i.test(hazardPayIndicators.join(' '))
      ? ['Other VA-recognized Radiation Risk Activity']
      : [],
    hazardPayIndicators: Array.from(new Set([
      ...(Array.isArray(currentForm?.hazardPayIndicators) ? currentForm.hazardPayIndicators : []),
      ...hazardPayIndicators,
    ])),
    extractedFromDD214: true,
  };

  return {
    mapped,
    warnings: [
      spdCode ? '' : 'SPD code did not pass normalization checks.',
      reCode ? '' : 'RE code did not pass normalization checks.',
      separationAuthority ? '' : 'Separation authority failed validation and was omitted.',
    ].filter(Boolean),
    normalizedCodes: {
      spdCode,
      reCode,
      separationAuthority,
    },
  };
}

export function buildExtractedVsCurrentDiff(currentForm, extractedForm) {
  const keys = [
    'branchOfService',
    'serviceType',
    'startDate',
    'endDate',
    'rankRate',
    'dischargeType',
    'serviceEra',
    'primaryMOS',
    'additionalMOS',
    'deploymentLocations',
    'combatVeteran',
    'radiationExposure',
    'hazardPayIndicators',
  ];

  return keys
    .map((key) => {
      const from = currentForm?.[key];
      const to = extractedForm?.[key];
      const fromValue = Array.isArray(from) ? from.join(', ') : String(from ?? '');
      const toValue = Array.isArray(to) ? to.join(', ') : String(to ?? '');

      if (fromValue === toValue) {
        return null;
      }

      return {
        key,
        currentValue: fromValue || '(empty)',
        extractedValue: toValue || '(empty)',
      };
    })
    .filter(Boolean);
}
