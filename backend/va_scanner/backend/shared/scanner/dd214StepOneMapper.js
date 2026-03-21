/**
 * DD-214 → Step 1 Mapping Layer
 *
 * Pure function. Takes a parseDD214() result and returns:
 *   - stepOneFields: mapped values keyed to Step 1 service record fields
 *   - supplemental: all remaining DD214 data for claim strategy, presumptive
 *                    triggers, exposure mapping, SMC/IU, and state benefits
 *
 * Rules:
 *   - Does NOT overwrite Step 1 records.
 *   - Does NOT infer era (Step 1 controls era selection).
 *   - Does NOT mutate the input object.
 *   - Combat Veteran derived from awards and deployment combat indicators.
 */

const DISCHARGE_MAP = {
  'HONORABLE': 'Honorable',
  'GENERAL': 'General',
  'GENERAL UNDER HONORABLE CONDITIONS': 'General',
  'UNDER OTHER THAN HONORABLE CONDITIONS': 'Other Than Honorable',
  'OTHER THAN HONORABLE': 'Other Than Honorable',
  'BAD CONDUCT': 'Bad Conduct',
  'DISHONORABLE': 'Dishonorable',
};

const COMPONENT_TO_SERVICE_TYPE = {
  'Active': 'Active Duty',
  'Reserve': 'Reserve',
  'Guard': 'National Guard',
};

const MOS_NOISE_TOKENS = new Set([
  'SEE',
  'ITEM',
  'BLOCK',
  'N/A',
  'NA',
  'NONE',
  'UNKNOWN',
]);

function normalizeDischarge(raw) {
  if (!raw) return null;
  const upper = String(raw).toUpperCase().trim().replace(/\s+/g, ' ');
  if (/\b(?:SOCIAL\s+SECURITY|SSN|DEPARTMENT|COMPONENT|NUMBER|IMPORTANT\s+RECORD|ALTERATIONS)\b/.test(upper)) {
    return null;
  }
  if (DISCHARGE_MAP[upper]) {
    return DISCHARGE_MAP[upper];
  }
  if (/\bUNDER\s+OTHER\s+THAN\s+HONORABLE\b/.test(upper)) {
    return 'Other Than Honorable';
  }
  if (/\bGENERAL\b|\bUNDER\s+HONORABLE\s+CONDITIONS\b/.test(upper)) {
    return 'General';
  }
  if (/\bBAD\s+CONDUCT\b/.test(upper)) {
    return 'Bad Conduct';
  }
  if (/\bDISHONORABLE\b/.test(upper)) {
    return 'Dishonorable';
  }
  if (/\bHONORABLE\b/.test(upper)) {
    return 'Honorable';
  }
  return null;
}

function normalizeMappedMos(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return null;
  if (MOS_NOISE_TOKENS.has(value)) return null;
  if (/^(?:SEE|ITEM|BLOCK)\s+/i.test(value)) return null;

  // Accept common DD214 specialty formats: Army/USMC style, AFSC style, and rating/designator style.
  const looksValid =
    /^[0-9]{2,3}[A-Z][A-Z0-9]*$/.test(value) ||
    /^[0-9][A-Z][0-9A-Z]{3,5}$/.test(value) ||
    /^[A-Z]{2,5}[0-9]?$/.test(value);

  return looksValid ? value : null;
}

function hasCombatDeploymentSignal(dd214) {
  const analysis = dd214?.dd214Analysis;
  if (!analysis) return false;
  if (analysis.combatVeteran === true) return true;
  if (!Array.isArray(analysis.deployments)) return false;
  return analysis.deployments.some((deployment) => deployment?.combatIndicator === true);
}

export function mapDD214ToStepOne(dd214) {
  if (!dd214 || dd214.documentType !== 'DD-214') return null;

  const { serviceIdentity, servicePeriods, characterAndSeparation, gradeSpecialty, decorationsAndService } = dd214;
  const legacySchema = /^2\./.test(String(dd214?.schemaVersion || ''));
  const validationPasses = dd214?.dd214Analysis?.validationSummary?.passes || [];
  const passMap = new Map(validationPasses.map((pass) => [pass.passId, Boolean(pass.passed)]));
  const hasDeterministicPasses = validationPasses.length > 0;
  const datePass = !legacySchema && hasDeterministicPasses && passMap.get('dateChronology') === true;
  const netServicePass = !legacySchema && hasDeterministicPasses && passMap.get('netServiceConsistency') === true;
  const componentPass = !legacySchema && hasDeterministicPasses && passMap.get('componentFromBlock2') === true;
  const combatAwardsSignal = Array.isArray(decorationsAndService?.combatIndicatorsFromAwards)
    && decorationsAndService.combatIndicatorsFromAwards.length > 0;
  const combatDeploymentSignal = hasCombatDeploymentSignal(dd214);

  // ── Step 1 field mapping (Section 3 contract) ──
  const stepOneFields = {
    branch: serviceIdentity?.branchOfService ?? null,
    serviceType: componentPass ? (COMPONENT_TO_SERVICE_TYPE[serviceIdentity?.component] ?? null) : null,
    startDate: datePass ? (servicePeriods?.entryDate ?? null) : null,
    endDate: (datePass && netServicePass) ? (servicePeriods?.separationDate ?? null) : null,
    rank: gradeSpecialty?.payGrade ?? null,
    dischargeType: normalizeDischarge(characterAndSeparation?.characterOfService),
    mos: normalizeMappedMos(gradeSpecialty?.primaryMOSOrAFSCOrRating),
    combatLocation: decorationsAndService?.foreignServiceLocationsIfListed?.[0] ?? null,
    additionalCombatLocations: decorationsAndService?.foreignServiceLocationsIfListed ?? [],
    combatVeteran: combatAwardsSignal || combatDeploymentSignal,
  };

  // ── Supplemental data (stored separately per Section 3.3) ──
  const supplemental = {
    serviceIdentity: {
      veteranName: serviceIdentity?.veteranName ?? null,
      ssnOrServiceNumber: serviceIdentity?.ssnOrServiceNumber ?? null,
      component: serviceIdentity?.component ?? null,
    },
    servicePeriods: {
      netActiveServiceThisPeriod: servicePeriods?.netActiveServiceThisPeriod ?? null,
      totalPriorActiveService: servicePeriods?.totalPriorActiveService ?? null,
      totalPriorInactiveService: servicePeriods?.totalPriorInactiveService ?? null,
    },
    characterAndSeparation: {
      narrativeReasonForSeparation: characterAndSeparation?.narrativeReasonForSeparation ?? null,
      separationAuthority: characterAndSeparation?.separationAuthority ?? null,
      separationCode: characterAndSeparation?.separationCode ?? null,
      reentryCode: characterAndSeparation?.reentryCode ?? null,
    },
    gradeSpecialty: {
      gradeRateRank: gradeSpecialty?.gradeRateRank ?? null,
      additionalMOSOrSpecialties: gradeSpecialty?.additionalMOSOrSpecialties ?? null,
    },
    decorationsAndService: {
      decorationsAndAwards: decorationsAndService?.decorationsAndAwards ?? null,
      foreignServiceTotal: decorationsAndService?.foreignServiceTotal ?? null,
      combatIndicatorsFromAwards: decorationsAndService?.combatIndicatorsFromAwards ?? null,
    },
    intelligentExtraction: dd214.intelligentExtraction ?? null,
    specialProgramsRemarks: dd214.specialProgramsRemarks ?? null,
    postServiceContact: dd214.postServiceContact ?? null,
  };

  return {
    stepOneFields,
    supplemental,
    extractionMeta: dd214.extractionMeta ?? null,
  };
}
