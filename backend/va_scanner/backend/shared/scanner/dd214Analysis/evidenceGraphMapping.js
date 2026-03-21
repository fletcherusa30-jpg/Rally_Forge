/**
 * evidenceGraphMapping.js — Rally Forge DD-214 Scanner v3.1
 *
 * Maps DD-214 parsed output to Evidence Graph node format.
 * Each logical section of the DD-214 becomes a typed node with
 * attributes and directed relationships.
 *
 * Node types emitted:
 *   DD214ServicePeriod, DD214Deployment, DD214Award, DD214Separation,
 *   DD214CharacterOfService, DD214MOS, DD214EligibilityIndicator,
 *   DD214CombatIndicator, DD214HazardousDutyIndicator
 *
 * SAFETY NOTICE: Graph nodes extract document information only.
 * No eligibility determinations, no legal/benefit conclusions.
 */

import { lookupSPDCode, lookupRECode } from './spdReCodes.js';

let _nodeId = 0;
function nodeId(prefix) {
  return `${prefix}-${++_nodeId}`;
}

function baseNode(type, attrs = {}, relationships = []) {
  return {
    id: nodeId(type.toLowerCase().replace(/[^a-z]/g, '-')),
    nodeType: type,
    source: 'DD214',
    attributes: attrs,
    relationships,
  };
}

// ── ServicePeriod Node ────────────────────────────────────────────────────────

function mapServicePeriod(result) {
  const periods = result.servicePeriods || {};
  return baseNode('DD214ServicePeriod', {
    dateEnteredActive: periods.entryDate,
    separationDate: periods.separationDate,
    netActiveServiceThisPeriod: periods.netActiveServiceThisPeriod,
    totalPriorActiveService: periods.totalPriorActiveService,
    totalPriorInactiveService: periods.totalPriorInactiveService,
    foreignServiceTime: result.decorationsAndService?.foreignServiceTotal ?? null,
  });
}

// ── Deployment Nodes ──────────────────────────────────────────────────────────

function mapDeployments(result) {
  const deployments = result.specialProgramsRemarks?.deploymentOrCampaignReferences || [];
  return deployments.map(dep => baseNode('DD214Deployment', {
    description: dep,
    theater: extractTheater(dep),
  }));
}

function extractTheater(text) {
  const t = String(text || '');
  if (/iraq|oi[fn]|operation\s+iraqi/i.test(t)) return 'Iraq';
  if (/afghan|oef|operation\s+enduring/i.test(t)) return 'Afghanistan';
  if (/gulf|southwest\s+asia/i.test(t)) return 'Southwest Asia';
  if (/vietnam/i.test(t)) return 'Vietnam';
  if (/korea/i.test(t)) return 'Korea';
  return null;
}

// ── Award Nodes ───────────────────────────────────────────────────────────────

function mapAwards(result) {
  const awards = result.decorationsAndService?.decorationsAndAwards || [];
  return awards.map(award => baseNode('DD214Award', {
    name: award,
    hasCombatIndicator: /combat|bronze\s+star|silver\s+star|purple\s+heart|valor|valor\s+device/i.test(award),
  }));
}

// ── Separation Node ───────────────────────────────────────────────────────────

function mapSeparation(result) {
  const sep = result.characterAndSeparation || {};
  const spdCode = sep.separationCode || sep.spdCode;
  const spd = spdCode ? lookupSPDCode(spdCode) : null;
  const reCode = sep.reentryCode || sep.reCode;
  const re = reCode ? lookupRECode(reCode) : null;

  return baseNode('DD214Separation', {
    characterOfService: sep.characterOfService,
    narrativeReason: sep.narrativeReasonForSeparation,
    separationAuthority: sep.separationAuthority,
    separationCode: spdCode,
    spdDescription: spd?.description || null,
    reentryCode: reCode,
    reDescription: re?.description || null,
    disabilityPercentage: sep.disabilitySeverancePayAmount || null,
  });
}

// ── CharacterOfService Node ───────────────────────────────────────────────────

function mapCharacterOfService(result) {
  const cos = result.characterAndSeparation?.characterOfService;
  return baseNode('DD214CharacterOfService', { characterOfService: cos || null });
}

// ── MOS Node ─────────────────────────────────────────────────────────────────

function mapMOS(result) {
  const grade = result.gradeSpecialty || {};
  return baseNode('DD214MOS', {
    primaryMOS: grade.primaryMOSOrAFSCOrRating,
    secondaryMOS: grade.additionalMOSOrSpecialties,
    gradeAtSeparation: grade.payGrade,
    branchOfService: result.serviceIdentity?.branchOfService || null,
  });
}

// ── Eligibility Indicators ────────────────────────────────────────────────────

function mapEligibilityIndicators(result) {
  const programs = result.specialProgramsRemarks || {};
  const indicators = [];

  if (programs.postNine11GIBillEligibility) {
    indicators.push(baseNode('DD214EligibilityIndicator', {
      type: 'Post-9/11 GI Bill',
      indicator: programs.postNine11GIBillEligibility,
      note: 'Textual indicator only. Not an eligibility determination.',
    }));
  }
  if (programs.mgibEligibility) {
    indicators.push(baseNode('DD214EligibilityIndicator', {
      type: 'MGIB',
      indicator: programs.mgibEligibility,
      note: 'Textual indicator only. Not an eligibility determination.',
    }));
  }

  return indicators;
}

// ── Combat / Hazardous Duty Indicator Nodes ───────────────────────────────────

function mapCombatAndHazardIndicators(result) {
  const ie = result.intelligentExtraction || {};
  const nodes = [];

  if (IE_hasValue(ie.combatIndicators)) {
    nodes.push(baseNode('DD214CombatIndicator', {
      indicators: ie.combatIndicators,
      note: 'Extracted from awards and remarks. Indicator only.',
    }));
  }
  if (IE_hasValue(ie.hazardIndicators)) {
    nodes.push(baseNode('DD214HazardousDutyIndicator', {
      indicators: ie.hazardIndicators,
      note: 'Extracted from remarks. Indicator only.',
    }));
  }

  return nodes;
}

function IE_hasValue(val) {
  if (!val) return false;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function buildDD214EvidenceGraphNodes(result) {
  _nodeId = 0;
  return [
    mapServicePeriod(result),
    mapSeparation(result),
    mapCharacterOfService(result),
    mapMOS(result),
    ...mapDeployments(result),
    ...mapAwards(result),
    ...mapEligibilityIndicators(result),
    ...mapCombatAndHazardIndicators(result),
  ].filter(Boolean);
}
