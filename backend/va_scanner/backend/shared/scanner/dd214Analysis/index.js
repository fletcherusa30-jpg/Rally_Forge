/**
 * index.js — Rally Forge DD-214 Analysis Subsystem v3.1
 *
 * Orchestrates cross-validation, SPD/RE lookup, and Evidence Graph
 * node generation for DD-214 parsed output.
 *
 * SAFETY NOTICE: Output is for human review only.
 * No eligibility determinations, no legal advice.
 */

import { runDD214CrossValidation, runDD214ValidationPasses } from './crossValidation.js';
import { buildDD214EvidenceGraphNodes } from './evidenceGraphMapping.js';
import { lookupSPDCode, lookupRECode } from './spdReCodes.js';
import { applyManualReviewFallback } from '../dd214ManualReviewFallback.js';

/**
 * Build the dd214Analysis section from parsed DD-214 result.
 *
 * @param {Object} parsedResult - Output from parseDD214()
 * @param {Object} [options]
 * @param {boolean} [options.includeEvidenceGraph=false]
 * @returns {Object} dd214Analysis
 */
export function buildDD214Analysis(
  parsedResult,
  { includeEvidenceGraph = false, sourceText = '', variantDetection = null, blockDetection = null } = {},
) {
  if (!parsedResult || typeof parsedResult !== 'object') {
    return buildEmptyDD214Analysis();
  }

  const normalized = buildNormalizedAnalysis(parsedResult, { sourceText, variantDetection, blockDetection });
  const validationSummary = runDD214ValidationPasses(parsedResult, normalized);
  const crossValidationFlags = runDD214CrossValidation(parsedResult, normalized);

  const standardAnalysis = {
    identification: normalized.identification,
    serviceDates: normalized.serviceDates,
    separation: normalized.separation,
    rankAndSpecialty: normalized.rankAndSpecialty,
    awards: normalized.awards,
    deployments: normalized.deployments,
    remarks: normalized.remarks,
    militaryEducation: normalized.militaryEducation,
    lastDutyAssignment: normalized.lastDutyAssignment,
    transferCommand: normalized.transferCommand,
    reenlistments: normalized.reenlistments,
    postServiceContact: normalized.postServiceContact,
    validationSummary,
    crossValidationFlags,
    confidenceScores: normalized.confidenceScores,

    // Legacy-compatible flattened fields used by existing UI paths.
    branch: normalized.identification?.branchOfService || null,
    serviceType: normalized.identification?.component || null,
    rank: normalized.rankAndSpecialty?.payGrade || normalized.rankAndSpecialty?.rankTitle || null,
    militaryOccupationSpecialty: normalized.rankAndSpecialty?.primarySpecialty || null,
    mosDetails: normalized.rankAndSpecialty?.mosDetails || null,
    entryDate: normalized.serviceDates?.dateEnteredActiveDuty || null,
    separationDate: normalized.serviceDates?.separationDate || null,
    netActiveServiceTotal: normalized.serviceDates?.netActiveService || null,
    foreignService: normalized.serviceDates?.foreignService || null,
    seaService: normalized.serviceDates?.seaService || null,
    initialEntryTraining: normalized.serviceDates?.initialEntryTraining || null,
    combatVeteran: normalized.deployments?.some((item) => item?.combatIndicator === true) || false,
    deploymentLocations: Array.from(new Set((normalized.deployments || []).map((item) => item.location).filter(Boolean))),
    dischargeType: normalized.separation?.characterOfService || null,
    separationAuthority: normalized.separation?.separationAuthority || null,
    narrativeReasonForSeparation: normalized.separation?.narrativeReasonForSeparation || null,
    transferCommandSummary: normalized.transferCommand?.postServiceComponent || null,
    majorCommand: normalized.lastDutyAssignment?.majorCommand || null,
    reenlistmentCount: Array.isArray(normalized.reenlistments) ? normalized.reenlistments.length : 0,
    mailingAddressAtSeparation: normalized.postServiceContact?.mailingAddressAtSeparation || null,
    nearestRelativeOrEmergencyContact: normalized.postServiceContact?.nearestRelativeOrEmergencyContact || null,

    unifiedDeploymentAndHazards: (normalized.deployments || []).map((item) => ({
      location: item.location,
      campaign: item.campaign,
      operation: item.operation,
      dateRange: item.dateRange,
      hazardousDutyIndicator: item.hazardousDutyIndicator,
      combatIndicator: item.combatIndicator,
      confidence: item.confidence,
      sourceAttribution: item.sourceAttribution || [],
    })),

    notes: 'For human review only. No legal conclusions.',
  };

  // Add manual review recommendation flags based on confidence and validation
  const recommendManualReview = applyManualReviewFallback(
    {
      veteranName: normalized.identification?.name,
      entryDate: normalized.serviceDates?.dateEnteredActiveDuty,
      separationDate: normalized.serviceDates?.separationDate,
      branch: normalized.identification?.branchOfService,
      rank: normalized.rankAndSpecialty?.payGrade,
      confidence: Number(parsedResult.extractionMeta?.confidence || 0),
    },
    {
      confidence: Number(parsedResult.extractionMeta?.confidence || 0),
      allChecksPassed: validationSummary.allChecksPassed,
      variant: variantDetection?.variantType,
      ocrProfile: parsedResult.extractionMeta?.ocrProfile || 'default',
    },
  );
  
  if (recommendManualReview._metadata?.manualReviewRequired) {
    standardAnalysis.manualReviewRecommended = true;
    standardAnalysis.manualReviewReason = recommendManualReview._metadata.fallbackReason;
    standardAnalysis.manualReviewPriority = recommendManualReview._metadata.reviewPriority;
    standardAnalysis.manualReviewMessage = recommendManualReview._metadata.message;
  }

  if (includeEvidenceGraph) {
    standardAnalysis.evidenceGraphNodes = buildDD214EvidenceGraphNodes(parsedResult);
  }

  return standardAnalysis;
}

function buildNormalizedAnalysis(result, { sourceText, variantDetection, blockDetection }) {
  const identity = result.serviceIdentity || {};
  const periods = result.servicePeriods || {};
  const separation = result.characterAndSeparation || {};
  const grade = result.gradeSpecialty || {};
  const decor = result.decorationsAndService || {};
  const remarksBlock = String(result.specialProgramsRemarks?.remarksBlock || '');
  const fieldConfidence = result.extractionMeta?.fieldConfidence || {};
  const semanticAnchors = result.extractionMeta?.semanticAnchors || null;
  const semanticMappings = result.extractionMeta?.normalizedMappings || {};

  const spdLookup = separation.separationCode ? lookupSPDCode(separation.separationCode) : null;
  const reLookup = separation.reentryCode ? lookupRECode(separation.reentryCode) : null;
  const militaryEducationRaw = result.militaryEducation || null;
  const lastDutyAssignmentRaw = result.lastDutyAssignment || null;
  const transferCommandRaw = result.transferCommand || null;
  const reenlistmentsRaw = result.specialProgramsRemarks?.reenlistments || null;
  const postServiceContactRaw = result.postServiceContact || null;

  const awards = normalizeAwards([
    ...(decor.decorationsAndAwards || []),
    ...(semanticMappings.awards || []),
  ]);
  const deployments = normalizeDeployments({
    references: result.specialProgramsRemarks?.deploymentOrCampaignReferences || [],
    locations: decor.foreignServiceLocationsIfListed || [],
    semanticLocations: semanticMappings.deploymentLocations || [],
    remarksBlock,
  });

  return {
    identification: {
      formType: variantDetection?.formType || null,
      variantType: variantDetection?.variantType || null,
      layoutType: variantDetection?.layoutType || null,
      variantNotes: semanticAnchors?.variantNotes || [],
      blockMap: blockDetection || null,
      sourceText,
      name: identity.veteranName || null,
      ssnOrServiceNumber: identity.ssnOrServiceNumber || null,
      dateOfBirth: extractDateOfBirth(sourceText),
      branchOfService: identity.branchOfService || null,
      component: identity.component || null,
    },
    serviceDates: {
      dateEnteredActiveDuty: periods.entryDate || null,
      separationDate: periods.separationDate || null,
      netActiveService: periods.netActiveServiceThisPeriod || null,
      totalPriorActiveService: periods.totalPriorActiveService || null,
      totalPriorInactiveService: periods.totalPriorInactiveService || null,
      foreignService: periods.foreignService || decor.foreignServiceTotal || parseLabeledDuration(sourceText, /\b12f\b/i),
      seaService: periods.seaService || parseLabeledDuration(sourceText, /\b12g\b|\bSEA\s+SERVICE\b/i),
      initialEntryTraining: periods.initialEntryTraining || null,
    },
    separation: {
      separationAuthority: separation.separationAuthority || null,
      separationCode: separation.separationCode || null,
      separationCodeMeaning: spdLookup?.description || null,
      reentryCode: separation.reentryCode || null,
      reentryCodeMeaning: reLookup?.description || null,
      narrativeReasonForSeparation: separation.narrativeReasonForSeparation || null,
      characterOfService: separation.characterOfService || null,
      typeOfSeparation: separation.typeOfSeparation || null,
    },
    rankAndSpecialty: {
      payGrade: normalizePayGrade(grade.payGrade),
      rankTitle: grade.gradeRateRank || null,
      primarySpecialty: grade.primaryMOSOrAFSCOrRating || null,
      secondarySpecialties: grade.additionalMOSOrSpecialties || [],
      mosDetails: grade.mosDetails || null,
    },
    awards,
    deployments,
    remarks: normalizeRemarks(remarksBlock),
    militaryEducation: militaryEducationRaw,
    lastDutyAssignment: lastDutyAssignmentRaw,
    transferCommand: transferCommandRaw,
    reenlistments: reenlistmentsRaw,
    postServiceContact: postServiceContactRaw,
    confidenceScores: {
      overall: Number(result.extractionMeta?.confidence || 0),
      fields: fieldConfidence,
      semanticFields: semanticAnchors?.fieldConfidence || {},
      lowConfidenceFields: Object.entries(fieldConfidence)
        .filter(([, score]) => Number(score) < 0.5)
        .map(([field]) => ({ field, confidence: 'low', notes: 'unreadable or missing' })),
    },
  };
}

function buildEmptyDD214Analysis() {
  return {
    identification: null,
    serviceDates: null,
    separation: null,
    rankAndSpecialty: null,
    awards: [],
    deployments: [],
    remarks: [],
    crossValidationFlags: [],
    confidenceScores: null,
    notes: 'For human review only. No legal conclusions.',
  };
}

function normalizePayGrade(value) {
  const raw = String(value || '').toUpperCase().replace(/\s+/g, '');
  const match = raw.match(/^([EOW])[-]?(\d{1,2})$/);
  if (!match) return value || null;
  return `${match[1]}-${match[2]}`;
}

function normalizeAwards(values) {
  const byName = new Map();
  for (const value of values || []) {
    const chunks = String(value || '').split(/[;,/]{1,2}|\n/).map((item) => item.trim()).filter(Boolean);
    for (const chunk of chunks) {
      const normalized = chunk.replace(/\s+/g, ' ').toUpperCase();
      if (normalized.length < 3) continue;

      let count = 1;
      const ordinal = normalized.match(/\b(\d+)(?:ST|ND|RD|TH)\s+AWARD\b/);
      if (ordinal) count = Number(ordinal[1]);

      const olc = normalized.match(/\bWITH\s+(\d+)\s+OAK\s+LEAF\s+CLUSTERS?\b/);
      if (olc) count = Math.max(count, 1 + Number(olc[1]));

      const star = normalized.match(/\bWITH\s+(\d+)\s+(?:BRONZE\s+)?STARS?\b/);
      if (star) count = Math.max(count, 1 + Number(star[1]));

      const canonical = normalized
        .replace(/\b(\d+)(?:ST|ND|RD|TH)\s+AWARD\b/g, '')
        .replace(/\bWITH\s+\d+\s+OAK\s+LEAF\s+CLUSTERS?\b/g, '')
        .replace(/\bWITH\s+\d+\s+(?:BRONZE\s+)?STARS?\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!canonical) continue;
      const prev = byName.get(canonical) || 0;
      byName.set(canonical, Math.max(prev, count));
    }
  }
  return [...byName.entries()].map(([name, count]) => ({ name, count }));
}

function normalizeDeployments({ references, locations, semanticLocations, remarksBlock }) {
  const records = [];
  const buckets = [
    ...(references || []).map((value) => ({ sourceType: 'remarks-reference', value })),
    ...(locations || []).map((value) => ({ sourceType: 'foreign-service-location', value })),
    ...(semanticLocations || []).map((value) => ({ sourceType: 'semantic-location', value })),
    ...(remarksBlock ? [{ sourceType: 'remarks-block', value: remarksBlock }] : []),
  ];

  const validDeploymentIndicator = /\b(?:SERVICE\s+IN|DEPLOY(?:ED|MENT)|IN\s+SUPPORT\s+OF|OPERATION\s+(?:IRAQI\s+FREEDOM|ENDURING\s+FREEDOM|INHERENT\s+RESOLVE|NEW\s+DAWN|DESERT\s+STORM|DESERT\s+SHIELD)|OEF|OIF|OND|COMBAT\s+ZONE|HOSTILE\s+FIRE|IMMINENT\s+DANGER|CAMPAIGN\s+MEDAL)\b/i;
  const nonDeploymentNoise = /\b(?:TRAINING|SCHOOL|COURSE|BASIC\s+TRAINING|AIT|OSUT|FORT\s+[A-Z]|PCS|PERMANENT\s+STATION|GARRISON)\b/i;

  for (const token of buckets) {
    const text = String(token.value || '');
    if (!text) continue;
    const location = extractLocation(text);
    if (!location) continue;

    const hasValidIndicator = validDeploymentIndicator.test(text) || token.sourceType === 'foreign-service-location' || token.sourceType === 'semantic-location';
    if (!hasValidIndicator) continue;
    if (nonDeploymentNoise.test(text) && token.sourceType !== 'foreign-service-location' && token.sourceType !== 'semantic-location') continue;

    const dateRange = extractDateRange(text);
    const campaign = extractCampaign(text);
    const operation = extractOperation(text);
    const hazardousDutyIndicator = /IMMINENT\s+DANGER\s+PAY|HOSTILE\s+FIRE\s+PAY|HAZARD|COMBAT\s+ZONE/i.test(text);
    const combatIndicator = /COMBAT|CAMPAIGN|IMMINENT\s+DANGER|HOSTILE\s+FIRE|OEF|OIF|OND/i.test(text) || Boolean(campaign || operation);

    const base = token.sourceType === 'foreign-service-location'
      ? 0.92
      : token.sourceType === 'semantic-location'
        ? 0.88
        : token.sourceType === 'remarks-reference'
          ? 0.82
          : 0.76;
    const confidence = Math.min(0.99, Number((base
      + (dateRange ? 0.04 : 0)
      + (campaign ? 0.03 : 0)
      + (operation ? 0.03 : 0)
      + (hazardousDutyIndicator ? 0.02 : 0)).toFixed(2)));

    records.push({
      location,
      dateRange,
      campaign,
      operation,
      combatIndicator,
      hazardousDutyIndicator,
      confidence,
      source: text.slice(0, 220),
      sourceAttribution: [{ sourceType: token.sourceType, excerpt: text.slice(0, 220) }],
    });
  }

  const dedup = new Map();
  for (const item of records) {
    const key = `${item.location}|${item.campaign || ''}|${item.operation || ''}`;
    const existing = dedup.get(key);
    if (!existing) {
      dedup.set(key, item);
      continue;
    }
    if (!existing.dateRange && item.dateRange) {
      existing.dateRange = item.dateRange;
    }
    existing.combatIndicator = existing.combatIndicator || item.combatIndicator;
    existing.hazardousDutyIndicator = existing.hazardousDutyIndicator || item.hazardousDutyIndicator;
    existing.confidence = Math.max(existing.confidence, item.confidence);
    existing.sourceAttribution = existing.sourceAttribution.concat(item.sourceAttribution || []);
  }

  return [...dedup.values()];
}

function normalizeRemarks(remarksText) {
  return String(remarksText || '')
    .split(/\/{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function parseLabeledDuration(text, labelPattern) {
  const lines = String(text || '').split(/\r?\n/);
  const line = lines.find((item) => labelPattern.test(item));
  if (!line) return null;
  const compact = line.match(/(\d{2})\s*(\d{2})\s*(\d{2})/);
  if (compact) {
    return { years: Number(compact[1]), months: Number(compact[2]), days: Number(compact[3]) };
  }
  const words = line.match(/(?:(\d+)\s*Y(?:EARS?)?)?\s*(?:(\d+)\s*M(?:ONTHS?)?)?\s*(?:(\d+)\s*D(?:AYS?)?)?/i);
  if (!words) return null;
  const years = Number(words[1] || 0);
  const months = Number(words[2] || 0);
  const days = Number(words[3] || 0);
  if (years || months || days) return { years, months, days };
  return null;
}

function extractDateOfBirth(text) {
  const direct = String(text || '').match(/(?:DATE\s+OF\s+BIRTH|DOB)[:\s]+(\d{4})[-\/.](\d{2})[-\/.](\d{2})/i);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  return null;
}

function extractDateRange(text) {
  const compact = String(text || '').match(/(20\d{2}|19\d{2})(\d{2})(\d{2})\s*[-–]\s*(20\d{2}|19\d{2})(\d{2})(\d{2})/);
  if (compact) {
    return {
      start: `${compact[1]}-${compact[2]}-${compact[3]}`,
      end: `${compact[4]}-${compact[5]}-${compact[6]}`,
    };
  }
  return null;
}

function extractCampaign(text) {
  const token = String(text || '');
  if (/AFGHANISTAN\s+CAMPAIGN\s+MEDAL|\bACM\b/i.test(token)) return 'Afghanistan Campaign';
  if (/IRAQ\s+CAMPAIGN\s+MEDAL|\bICM\b/i.test(token)) return 'Iraq Campaign';
  if (/GLOBAL\s+WAR\s+ON\s+TERRORISM/i.test(token)) return 'Global War on Terrorism';
  return null;
}

function extractOperation(text) {
  const token = String(text || '');
  if (/\bOEF\b|ENDURING\s+FREEDOM/i.test(token)) return 'OEF';
  if (/\bOIF\b|IRAQI\s+FREEDOM/i.test(token)) return 'OIF';
  if (/\bOND\b|NEW\s+DAWN/i.test(token)) return 'OND';
  if (/INHERENT\s+RESOLVE/i.test(token)) return 'Operation Inherent Resolve';
  if (/DESERT\s+SHIELD/i.test(token)) return 'Operation Desert Shield';
  if (/DESERT\s+STORM/i.test(token)) return 'Operation Desert Storm';
  return null;
}

function extractLocation(text) {
  const locations = ['Iraq', 'Afghanistan', 'Kuwait', 'Syria', 'Somalia', 'Korea', 'Vietnam', 'Southwest Asia', 'Gulf War'];
  const found = locations.find((location) => new RegExp(`\\b${location.replace(/\s+/g, '\\s+')}\\b`, 'i').test(String(text || '')));
  return found || null;
}

export { runDD214CrossValidation } from './crossValidation.js';
export { runDD214ValidationPasses } from './crossValidation.js';
export { buildDD214EvidenceGraphNodes } from './evidenceGraphMapping.js';
export { lookupSPDCode, lookupRECode } from './spdReCodes.js';
