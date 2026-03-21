/**
 * Deterministic DD214 confidence model.
 * Confidence is 100% only if every required deterministic check passes.
 */

function hasValue(value, minLength = 1) {
  return String(value || '').trim().length >= minLength;
}

function extractValidationChecks(analysis) {
  const checks = [];
  for (const pass of analysis?.validationSummary?.passes || []) {
    for (const check of pass.checks || []) {
      checks.push(Boolean(check.passed));
    }
  }
  return checks;
}

export function computeDD214Confidence(dd214, { analysis = null } = {}) {
  // Core required fields — all must be present for confidence === 1.0
  const fieldConfidence = {
    veteranName: hasValue(dd214?.serviceIdentity?.veteranName, 4) ? 1 : 0,
    branchOfService: hasValue(dd214?.serviceIdentity?.branchOfService, 2) ? 1 : 0,
    component: hasValue(dd214?.serviceIdentity?.component, 2) ? 1 : 0,
    entryDate: /^\d{4}-\d{2}-\d{2}$/.test(String(dd214?.servicePeriods?.entryDate || '')) ? 1 : 0,
    separationDate: /^\d{4}-\d{2}-\d{2}$/.test(String(dd214?.servicePeriods?.separationDate || '')) ? 1 : 0,
    primarySpecialty: hasValue(dd214?.gradeSpecialty?.primaryMOSOrAFSCOrRating, 2) ? 1 : 0,
    characterOfService: hasValue(dd214?.characterAndSeparation?.characterOfService, 4) ? 1 : 0,
    separationCode: hasValue(dd214?.characterAndSeparation?.separationCode, 2) ? 1 : 0,
    reentryCode: hasValue(dd214?.characterAndSeparation?.reentryCode, 1) ? 1 : 0,
    awardsOrRemarks: (
      (Array.isArray(dd214?.decorationsAndService?.decorationsAndAwards) && dd214.decorationsAndService.decorationsAndAwards.length > 0) ||
      hasValue(dd214?.specialProgramsRemarks?.remarksBlock, 6)
    ) ? 1 : 0,
  };

  // Optional enrichment fields — tracked separately; do not gate overall confidence at 1.0.
  const optionalFieldConfidence = {
    seaService: hasValue(dd214?.servicePeriods?.seaService) ? 1 : 0,
    initialEntryTraining: dd214?.servicePeriods?.initialEntryTraining && typeof dd214.servicePeriods.initialEntryTraining === 'object' ? 1 : 0,
    typeOfSeparation: hasValue(dd214?.characterAndSeparation?.typeOfSeparation, 4) ? 1 : 0,
    mosDetails: Array.isArray(dd214?.gradeSpecialty?.mosDetails) && dd214.gradeSpecialty.mosDetails.length > 0 ? 1 : 0,
    militaryEducation: Array.isArray(dd214?.militaryEducation) && dd214.militaryEducation.length > 0 ? 1 : 0,
    lastDutyAssignment: (hasValue(dd214?.lastDutyAssignment?.lastDutyAssignmentTitle) || hasValue(dd214?.lastDutyAssignment?.majorCommand)) ? 1 : 0,
    transferCommand: hasValue(dd214?.transferCommand?.postServiceComponent, 3) ? 1 : 0,
    reenlistments: Array.isArray(dd214?.specialProgramsRemarks?.reenlistments) && dd214.specialProgramsRemarks.reenlistments.length > 0 ? 1 : 0,
  };

  const validationPasses = Array.isArray(analysis?.validationSummary?.passes)
    ? analysis.validationSummary.passes
    : [];
  const checks = extractValidationChecks(analysis);
  const passedChecks = checks.filter(Boolean).length;
  const totalChecks = checks.length;
  const allValidationChecksPassed = totalChecks > 0 ? passedChecks === totalChecks : false;
  const allCoreFieldsPresent = Object.values(fieldConfidence).every((score) => score === 1);
  const allCrossValidationFlagsClear = Array.isArray(analysis?.crossValidationFlags)
    ? analysis.crossValidationFlags.length === 0
    : false;

  const allChecksPassed = allValidationChecksPassed && allCoreFieldsPresent;
  const deterministicRatio = totalChecks > 0 ? passedChecks / totalChecks : 0;
  const fieldRatio = Object.values(fieldConfidence).filter((score) => score === 1).length / Object.keys(fieldConfidence).length;
  const confidence = allChecksPassed ? 1 : Math.min(0.9999, Number(((deterministicRatio * 0.8) + (fieldRatio * 0.2)).toFixed(4)));

  return {
    confidence: Number(confidence.toFixed(4)),
    fieldsPopulated: Object.values(fieldConfidence).filter((score) => score === 1).length,
    fieldsTotal: Object.keys(fieldConfidence).length,
    fieldConfidence,
    optionalFieldConfidence,
    validationSummary: {
      passes: validationPasses,
      allChecksPassed,
      passedChecks,
      totalChecks,
      allCoreFieldsPresent,
      allCrossValidationFlagsClear,
    },
  };
}
