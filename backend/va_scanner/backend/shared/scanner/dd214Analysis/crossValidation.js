/**
 * crossValidation.js — Rally Forge DD-214 Scanner v3.1
 *
 * Cross-validation logic for DD-214 extracted data.
 * Detects internal inconsistencies and flags them for human review.
 *
 * SAFETY NOTICE: Flags are indicators for human review only.
 * The scanner NEVER determines eligibility, interprets codes,
 * or provides legal advice.
 */

import { lookupSPDCode, lookupRECode } from './spdReCodes.js';
import { validateMosAgainstCatalog } from './mosCatalog.js';

function flag(field, notes, expected = null, actual = null) {
  return {
    type: 'dd214Inconsistency',
    field,
    expectedValue: expected,
    actualValue: actual,
    notes,
  };
}

function validationCheck(id, passed, notes) {
  return { id, passed: Boolean(passed), notes };
}

function buildValidationPasses(result, normalized = null) {
  const blockMap = normalized?.identification?.blockMap?.blocks || {};
  const continuation = normalized?.identification?.blockMap?.continuation || {};
  const sourceText = String(normalized?.identification?.sourceText || '');

  const requiredBlocks = ['2', '11', '12a', '12b', '12c', '13', '18', '25', '26', '27', '28'];
  const presentRequired = requiredBlocks.filter((id) => String(blockMap[id] || '').trim().length > 0);

  const entryDate = String(result?.servicePeriods?.entryDate || '');
  const separationDate = String(result?.servicePeriods?.separationDate || '');
  const validDateShape = /^\d{4}-\d{2}-\d{2}$/;
  const dateChronology = validDateShape.test(entryDate) && validDateShape.test(separationDate) && entryDate < separationDate;

  const net = result?.servicePeriods?.netActiveServiceThisPeriod;
  let netConsistency = false;
  if (net && dateChronology) {
    const start = new Date(entryDate + 'T00:00:00Z').getTime();
    const end = new Date(separationDate + 'T00:00:00Z').getTime();
    const actualDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const statedDays = (Number(net.years || 0) * 365) + (Number(net.months || 0) * 30) + Number(net.days || 0);
    netConsistency = Math.abs(actualDays - statedDays) <= 550;
  }

  const block2 = String(blockMap['2'] || '').toUpperCase();
  const component = String(result?.serviceIdentity?.component || '');
  const explicitComponentToken =
    /\b(?:RA|R\s*[\/-]?\s*A|R4|REGULAR\s+ARMY|ACTIVE\s+DUTY|ACTIVE)\b/.test(block2) ||
    /\b(?:ARNG|ANG|NATIONAL\s+GUARD|NG)\b/.test(block2) ||
    /\b(?:USAR|USNR|USAFR|USMCR|USCGR|RESERVE)\b/.test(block2);
  const componentFromBlock2 = !component || explicitComponentToken;

  const continuationCuePresent = /\bCONT(?:INUED)?\s+FROM\s+BLOCK\s*(13|18)\b/i.test(sourceText);
  const continuationMerged = !continuationCuePresent ||
    ((Array.isArray(continuation['13']) && continuation['13'].length > 0) || (Array.isArray(continuation['18']) && continuation['18'].length > 0));

  const evidenceText = `${blockMap['13'] || ''} ${blockMap['18'] || ''}`.toUpperCase();
  const hasCombatFlag =
    (Array.isArray(result?.decorationsAndService?.combatIndicatorsFromAwards) && result.decorationsAndService.combatIndicatorsFromAwards.length > 0) ||
    (Array.isArray(result?.specialProgramsRemarks?.deploymentOrCampaignReferences) && result.specialProgramsRemarks.deploymentOrCampaignReferences.length > 0);
  const combatEvidenceExplicit = !hasCombatFlag || /\b(?:CAMPAIGN|COMBAT|IMMINENT\s+DANGER|HOSTILE\s+FIRE|IRAQ|AFGHANISTAN|KUWAIT|SOMALIA|KOREA|VIETNAM)\b/.test(evidenceText);

  const passes = [
    {
      passId: 'blockPresence',
      checks: [
        validationCheck('requiredBlocksPresent', presentRequired.length === requiredBlocks.length, `Detected ${presentRequired.length}/${requiredBlocks.length} required blocks`),
      ],
    },
    {
      passId: 'dateChronology',
      checks: [
        validationCheck('dateShapeAndOrder', dateChronology, 'Entry/separation dates parse and are chronological'),
      ],
    },
    {
      passId: 'netServiceConsistency',
      checks: [
        validationCheck('netServiceVsDateDelta', netConsistency, '12c net service aligns with entry/separation range within tolerance'),
      ],
    },
    {
      passId: 'componentFromBlock2',
      checks: [
        validationCheck('componentExplicitToken', componentFromBlock2, 'Component must come from explicit block 2 token when present'),
      ],
    },
    {
      passId: 'continuationIntegrity',
      checks: [
        validationCheck('continuationMerged', continuationMerged, 'Continuation cues require merged block 13/18 continuation content'),
      ],
    },
    {
      passId: 'combatEvidenceExplicit',
      checks: [
        validationCheck('explicitCombatEvidence', combatEvidenceExplicit, 'Combat/deployment indicators must come from explicit block evidence'),
      ],
    },
  ];

  return {
    passes: passes.map((pass) => ({
      ...pass,
      passed: pass.checks.every((check) => check.passed),
    })),
  };
}

function validateServiceDates(result) {
  const flags = [];
  const periods = result.servicePeriods || {};
  if (!periods) return flags;

  const entryDate = periods.entryDate;
  const separationDate = periods.separationDate;

  if (entryDate && separationDate) {
    if (entryDate >= separationDate) {
      flags.push(flag(
        'servicePeriods',
        'Entry date is not before separation date.',
        `entryDate < separationDate`,
        `${entryDate} >= ${separationDate}`,
      ));
    }
  }

  const totalService = periods.netActiveServiceThisPeriod;
  if (totalService && entryDate && separationDate) {
    const entryMs = new Date(entryDate).getTime();
    const sepMs = new Date(separationDate).getTime();
    if (!isNaN(entryMs) && !isNaN(sepMs)) {
      const actualDays = Math.round((sepMs - entryMs) / (1000 * 60 * 60 * 24));
      const statedDays = (Number(totalService.years || 0) * 365) + (Number(totalService.months || 0) * 30) + Number(totalService.days || 0);
      const delta = Math.abs(actualDays - statedDays);
      if (delta > 550) {
        flags.push(flag(
          'servicePeriods.netActiveServiceThisPeriod',
          'Net active service differs from date range by more than 18 months.',
          `${actualDays} days`,
          `${statedDays} days`,
        ));
      }
    }
  }

  return flags;
}

function validateSpdReCodes(result) {
  const flags = [];
  const sep = result.characterAndSeparation;
  if (!sep) return flags;

  const spdCode = sep.separationCode || sep.spdCode;
  const reCode = sep.reentryCode || sep.reCode;
  const characterOfService = sep.characterOfService;

  if (spdCode) {
    const spd = lookupSPDCode(spdCode);
    if (!spd.known) {
      flags.push(flag('separationCode', `SPD code "${spdCode}" not found in known code table.`, 'known SPD code', spdCode));
    }
    if (spd.known && sep.narrativeReasonForSeparation && spd.description) {
      const narrative = String(sep.narrativeReasonForSeparation).toUpperCase();
      const description = String(spd.description).toUpperCase();
      if (narrative && description && !description.split(/\s+/).some((token) => token.length > 4 && narrative.includes(token))) {
        flags.push(flag('separationCode', 'SPD code meaning appears inconsistent with narrative reason.', spd.description, sep.narrativeReasonForSeparation));
      }
    }

    if (characterOfService && /OTHER THAN HONORABLE|DISHONORABLE/i.test(characterOfService)) {
      const misconductSPDs = ['JKA', 'JKB', 'JKD', 'JKN', 'JKQ', 'DFS', 'DFT', 'JPC'];
      if (spd.known && !misconductSPDs.includes(spdCode?.toUpperCase())) {
        flags.push(flag('separationCode', 'Character of service may not align with SPD category.', 'misconduct-related SPD', spdCode));
      }
    }
  }

  if (reCode) {
    const re = lookupRECode(reCode);
    if (!re.known) {
      flags.push(flag('reentryCode', `RE code "${reCode}" not found in known code table.`, 'known RE code', reCode));
    }
    if (sep.separationAuthority && re.known && /DISABILITY|RETIRE/i.test(sep.separationAuthority) && /^4/.test(String(reCode))) {
      flags.push(flag('reentryCode', 'RE code may be inconsistent with separation authority text.', 'RE not starting with 4 for many retirement/disability paths', reCode));
    }
  }

  return flags;
}

function validateMosRankBranch(result) {
  const flags = [];
  const branch = result.serviceIdentity?.branchOfService;
  const payGrade = result.gradeSpecialty?.payGrade;
  const mosCode = result.gradeSpecialty?.primaryMOSOrAFSCOrRating;

  if (!mosCode) return flags;

  const mosValidation = validateMosAgainstCatalog({ branch, payGrade, mosCode });
  if (!mosValidation.valid) {
    flags.push(flag(
      'gradeSpecialty.primaryMOSOrAFSCOrRating',
      `MOS validation failed: ${mosValidation.reason}.`,
      JSON.stringify({ branch: mosValidation.branch, tier: mosValidation.expectedTier }),
      mosCode,
    ));
  }

  return flags;
}

function validateAwardsVsDeployments(result) {
  const flags = [];
  const awards = (result.decorationsAndService?.decorationsAndAwards || []).map((value) => String(value).toUpperCase());
  const deployments = [
    ...(result.decorationsAndService?.foreignServiceLocationsIfListed || []),
    ...(result.specialProgramsRemarks?.deploymentOrCampaignReferences || []),
  ].map((value) => String(value).toUpperCase());

  const hasIraqAward = awards.some((award) => /IRAQ\s+CAMPAIGN\s+MEDAL/.test(award));
  const hasIraqDeployment = deployments.some((item) => /IRAQ/.test(item));
  if (hasIraqAward && !hasIraqDeployment) {
    flags.push(flag('decorationsAndService', 'Iraq Campaign Medal found without Iraq deployment indicator.', 'Iraq deployment evidence', 'not found'));
  }

  const hasAfghanAward = awards.some((award) => /AFGHANISTAN\s+CAMPAIGN\s+MEDAL/.test(award));
  const hasAfghanDeployment = deployments.some((item) => /AFGHANISTAN/.test(item));
  if (hasAfghanAward && !hasAfghanDeployment) {
    flags.push(flag('decorationsAndService', 'Afghanistan Campaign Medal found without Afghanistan deployment indicator.', 'Afghanistan deployment evidence', 'not found'));
  }

  return flags;
}

function validateForeignServiceVsDeployments(result) {
  const flags = [];
  const foreign = result.decorationsAndService?.foreignServiceTotal;
  const deployments = [
    ...(result.decorationsAndService?.foreignServiceLocationsIfListed || []),
    ...(result.specialProgramsRemarks?.deploymentOrCampaignReferences || []),
  ];

  if (foreign && foreign.years === 0 && foreign.months === 0 && deployments.length > 0) {
    flags.push(flag(
      'decorationsAndService.foreignServiceTotal',
      'Foreign service time is zero but deployment references are present. Human review required.',
      'non-zero foreign service',
      JSON.stringify(foreign),
    ));
  }

  return flags;
}

// ── Missing Fields ─────────────────────────────────────────────────────────────

function detectMissingFields(result, normalized) {
  const flags = [];

  const checks = [
    ['serviceIdentity.veteranName', result.serviceIdentity?.veteranName],
    ['serviceIdentity.branchOfService', result.serviceIdentity?.branchOfService],
    ['servicePeriods.entryDate', result.servicePeriods?.entryDate],
    ['servicePeriods.separationDate', result.servicePeriods?.separationDate],
    ['characterAndSeparation.characterOfService', result.characterAndSeparation?.characterOfService],
    ['characterAndSeparation.narrativeReasonForSeparation', result.characterAndSeparation?.narrativeReasonForSeparation],
    ['gradeSpecialty.primaryMOSOrAFSCOrRating', result.gradeSpecialty?.primaryMOSOrAFSCOrRating],
    ['identification.formType', normalized?.identification?.formType],
  ];

  for (const [field, value] of checks) {
    if (!value) {
      flags.push(flag(field, `Field "${field}" not detected. May be missing, illegible, or in an unexpected format.`, 'present', null));
    }
  }

  return flags;
}

// ── Main: Run All Cross-Validation ────────────────────────────────────────────

export function runDD214CrossValidation(result, normalized = null) {
  const deterministic = runDD214ValidationPasses(result, normalized);
  const deterministicFlags = [];

  for (const pass of deterministic.passes) {
    for (const check of pass.checks) {
      if (!check.passed) {
        deterministicFlags.push(flag(
          `validation.${pass.passId}.${check.id}`,
          check.notes,
          'pass',
          'fail',
        ));
      }
    }
  }

  return [
    ...deterministicFlags,
    ...validateServiceDates(result),
    ...validateSpdReCodes(result),
    ...validateMosRankBranch(result),
    ...validateAwardsVsDeployments(result),
    ...validateForeignServiceVsDeployments(result),
    ...detectMissingFields(result, normalized),
  ];
}

export function runDD214ValidationPasses(result, normalized = null) {
  const output = buildValidationPasses(result, normalized);
  const allChecksPassed = output.passes.every((pass) => pass.passed);
  return {
    ...output,
    allChecksPassed,
  };
}
