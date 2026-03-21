const DD214_SEMANTIC_ANCHOR_MAP_VERSION = '1.0.0';

const ALL_DD214_VARIANTS = Object.freeze([
  'DD214_MEMBER_1',
  'DD214_MEMBER_4',
  'DD214_SERVICE_COPY',
  'DD214_VETERANS_COPY',
  'DD214_REDACTED',
  'DD214_CONTINUATION',
  'DD215_CORRECTION',
  'NGB22',
  'NGB23',
  'DD214_LEGACY_PRE_1980',
  'DD214_GENERIC',
]);

const SERVICE_ERA_WINDOWS = Object.freeze([
  { label: 'WWII', start: '1941-12-07', end: '1946-12-31' },
  { label: 'Korean War', start: '1950-06-27', end: '1955-01-31' },
  { label: 'Vietnam Era', start: '1961-11-01', end: '1975-05-07' },
  { label: 'Gulf War Era', start: '1990-08-02', end: '9999-12-31' },
  { label: 'OEF/OIF/OND', start: '2001-09-11', end: '2014-12-31' },
]);

const VA_RECOGNIZED_LOCATIONS = Object.freeze({
  AFGHANISTAN: 'Afghanistan',
  IRAQ: 'Iraq',
  KUWAIT: 'Kuwait',
  SYRIA: 'Syria',
  DJIBOUTI: 'Djibouti',
  SOMALIA: 'Somalia',
  UZBEKISTAN: 'Uzbekistan',
  JORDAN: 'Jordan',
  EGYPT: 'Egypt',
  YEMEN: 'Yemen',
  'SOUTHWEST ASIA': 'Southwest Asia Theater of Operations',
  VIETNAM: 'Republic of Vietnam',
  KOREA: 'Korean Demilitarized Zone',
});

const DISCHARGE_TYPE_MAP = Object.freeze({
  HONORABLE: 'Honorable',
  GENERAL: 'General',
  'GENERAL (UNDER HONORABLE CONDITIONS)': 'General',
  'UNDER HONORABLE CONDITIONS': 'General',
  'OTHER THAN HONORABLE': 'Other Than Honorable',
  'UNDER OTHER THAN HONORABLE CONDITIONS': 'Other Than Honorable',
  'BAD CONDUCT': 'Bad Conduct',
  DISHONORABLE: 'Dishonorable',
});

const AWARD_NOISE_PATTERNS = Object.freeze([
  /\b(?:DD\s*FORM|CERTIFICATE\s+OF\s+RELEASE|SOCIAL\s+SECURITY|CONTINUATION\s+SHEET|REMARKS|BLOCK\s*18|PAGE\s*\d+)\b/i,
  /\b(?:NOT\s+TO\s+BE\s+USED|ALTERATIONS\s+IN\s+SHADED\s+AREAS|IMPORTANT\s+RECORD)\b/i,
]);

const AWARD_CANONICAL_REPLACEMENTS = Object.freeze([
  [/\bGWOTSM\b/gi, 'GLOBAL WAR ON TERRORISM SERVICE MEDAL'],
  [/\bGWOTEM\b/gi, 'GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL'],
  [/\bNDSM\b/gi, 'NATIONAL DEFENSE SERVICE MEDAL'],
  [/\bACM\b/gi, 'AFGHANISTAN CAMPAIGN MEDAL'],
  [/\bICM\b/gi, 'IRAQ CAMPAIGN MEDAL'],
  [/\bAAM\b/gi, 'ARMY ACHIEVEMENT MEDAL'],
  [/\bARCOM\b/gi, 'ARMY COMMENDATION MEDAL'],
  [/\bMEOAL\b/gi, 'MEDAL'],
  [/\bMEOALS\b/gi, 'MEDALS'],
  [/\bRIBBONS?\b/gi, 'RIBBON'],
]);

const COMPONENT_MAP = Object.freeze({
  Active: 'Active Duty',
  Reserve: 'Reserve',
  Guard: 'National Guard',
});

function anchor(schemaPath, category, semanticAnchors, positionalFallback, notes, confidence) {
  return Object.freeze({
    schemaPath,
    category,
    semanticAnchors: Object.freeze(semanticAnchors),
    positionalFallback: Object.freeze(positionalFallback),
    supportedVariants: ALL_DD214_VARIANTS,
    notes,
    confidence: Object.freeze(confidence),
  });
}

export const DD214_SEMANTIC_ANCHOR_MAP = Object.freeze({
  veteranName: anchor('serviceIdentity.veteranName', 'Veteran Identity', [/\b1\.\s*NAME\b/i, /\bNAME OF MEMBER\b/i, /\bLAST,\s*FIRST,\s*MIDDLE\b/i], ['1'], 'Primary identity anchor. Prefer semantic name labels; fall back to block 1.', { semantic: 0.96, fallback: 0.78, derived: 0.7 }),
  branchOfService: anchor('serviceIdentity.branchOfService', 'Veteran Identity', [/\bDEPARTMENT,?\s+COMPONENT\s+AND\s+BRANCH\b/i, /\b(?:UNITED STATES\s+)?(?:ARMY|NAVY|AIR FORCE|MARINE CORPS|COAST GUARD|SPACE FORCE)\b/i], ['2'], 'Prefer branch label and branch line; fall back to block 2.', { semantic: 0.94, fallback: 0.8, derived: 0.7 }),
  rankGradeAtSeparation: anchor('gradeSpecialty.gradeRateRank', 'Veteran Identity', [/\b4a\.\s*(?:GRADE|RATE|RANK)\b/i, /\b(?:GRADE|RATE|RANK)\b/i], ['4a'], 'Rank title anchor.', { semantic: 0.92, fallback: 0.76, derived: 0.7 }),
  payGrade: anchor('gradeSpecialty.payGrade', 'Veteran Identity', [/\b4b\.\s*PAY\s+GRADE\b/i, /\bPAY\s+GRADE\b/i], ['4b'], 'Pay grade anchor.', { semantic: 0.94, fallback: 0.8, derived: 0.72 }),
  primarySpecialty: anchor('gradeSpecialty.primaryMOSOrAFSCOrRating', 'Veteran Identity', [/\b11\.\s*PRIMARY\s+SPECIALTY\b/i, /\b(?:PRIMARY\s+SPECIALTY|MOS|AFSC|RATING)\b/i], ['11'], 'Specialty anchor covering MOS / AFSC / Rating.', { semantic: 0.93, fallback: 0.79, derived: 0.72 }),
  serviceComponent: anchor('normalizedMappings.serviceComponent', 'Service Component & Service Type', [/\b(?:REGULAR\s+ARMY|ACTIVE\s+DUTY|USAR|USNR|NATIONAL\s+GUARD|ARNG|ANG)\b/i], ['2'], 'Normalize component from semantic cues first, block 2 as positional fallback.', { semantic: 0.92, fallback: 0.84, derived: 0.74 }),
  serviceType: anchor('normalizedMappings.serviceType', 'Service Component & Service Type', [/\b(?:AGR|ADOS|TITLE\s+10|TITLE\s+32|ACTIVE\s+GUARD\s+RESERVE)\b/i], ['2', '18'], 'Derive service type from remarks and branch/component context.', { semantic: 0.88, fallback: 0.78, derived: 0.74 }),
  entryDate: anchor('servicePeriods.entryDate', 'Service Component & Service Type', [/\b12a\.\s*DATE\s+ENTERED\b/i, /\bDATE\s+ENTERED\s+AD\s+THIS\s+PERIOD\b/i], ['12a'], 'Entry date anchor.', { semantic: 0.97, fallback: 0.86, derived: 0.76 }),
  separationDate: anchor('servicePeriods.separationDate', 'Service Component & Service Type', [/\b12b\.\s*SEPARATION\s+DATE\b/i, /\bSEPARATION\s+DATE\s+THIS\s+PERIOD\b/i], ['12b'], 'Separation date anchor.', { semantic: 0.97, fallback: 0.86, derived: 0.76 }),
  netActiveService: anchor('servicePeriods.netActiveServiceThisPeriod', 'Service Component & Service Type', [/\b12c\.\s*NET\s+ACTIVE\s+SERVICE\b/i, /\bNET\s+ACTIVE\s+SERVICE\s+THIS\s+PERIOD\b/i], ['12c'], 'Net active service anchor.', { semantic: 0.95, fallback: 0.84, derived: 0.74 }),
  totalService: anchor('normalizedMappings.totalService', 'Service Component & Service Type', [/\bTOTAL\s+PRIOR\s+ACTIVE\s+SERVICE\b/i, /\bTOTAL\s+PRIOR\s+INACTIVE\s+SERVICE\b/i], ['12c', '12d', '12e'], 'Derived total service using net active and prior service blocks.', { semantic: 0.82, fallback: 0.76, derived: 0.78 }),
  priorActiveService: anchor('servicePeriods.totalPriorActiveService', 'Service Component & Service Type', [/\b12d\.\s*TOTAL\s+PRIOR\s+ACTIVE\s+SERVICE\b/i], ['12d'], 'Prior active service anchor.', { semantic: 0.95, fallback: 0.82, derived: 0.72 }),
  priorInactiveService: anchor('servicePeriods.totalPriorInactiveService', 'Service Component & Service Type', [/\b12e\.\s*TOTAL\s+PRIOR\s+INACTIVE\s+SERVICE\b/i], ['12e'], 'Prior inactive service anchor.', { semantic: 0.95, fallback: 0.82, derived: 0.72 }),
  serviceEras: anchor('normalizedMappings.serviceEras', 'Service Era', [/\b(?:WWII|KOREA|VIETNAM|GULF\s+WAR|OEF|OIF|OND)\b/i], ['12a', '12b'], 'Era mapping derived from service dates and operation references.', { semantic: 0.82, fallback: 0.74, derived: 0.8 }),
  characterOfService: anchor('characterAndSeparation.characterOfService', 'Discharge & Separation Details', [/\b24\.\s*CHARACTER\s+OF\s+SERVICE\b/i, /\bCHARACTER\s+OF\s+SERVICE\b/i], ['24'], 'Character of service anchor with validation against DD214 vocab.', { semantic: 0.96, fallback: 0.84, derived: 0.72 }),
  dischargeType: anchor('normalizedMappings.dischargeType', 'Discharge & Separation Details', [/\b(?:HONORABLE|GENERAL|BAD\s+CONDUCT|DISHONORABLE|OTHER\s+THAN\s+HONORABLE)\b/i], ['24'], 'Normalized discharge type derived from character of service.', { semantic: 0.9, fallback: 0.8, derived: 0.78 }),
  separationAuthority: anchor('characterAndSeparation.separationAuthority', 'Discharge & Separation Details', [/\b25\.\s*SEPARATION\s+AUTHORITY\b/i, /\b(?:AR|AFI|MILPERSMAN|NAVMILPERSMAN|MCO|COMDTINST)\s*\d{2,4}/i], ['25'], 'Separation authority anchor.', { semantic: 0.95, fallback: 0.82, derived: 0.72 }),
  separationCode: anchor('characterAndSeparation.separationCode', 'Discharge & Separation Details', [/\b26\.\s*SEPARATION\s+CODE\b/i, /\bSPD\s+CODE\b/i], ['26'], 'SPD / separation code anchor.', { semantic: 0.95, fallback: 0.82, derived: 0.72 }),
  reentryCode: anchor('characterAndSeparation.reentryCode', 'Discharge & Separation Details', [/\b27\.\s*(?:REENTRY|RE)\s+CODE\b/i, /\bRE\s+CODE\b/i], ['27'], 'RE code anchor.', { semantic: 0.95, fallback: 0.82, derived: 0.72 }),
  narrativeReasonForSeparation: anchor('characterAndSeparation.narrativeReasonForSeparation', 'Discharge & Separation Details', [/\b28\.\s*NARRATIVE\s+REASON\s+FOR\s+SEPARATION\b/i, /\bNARRATIVE\s+REASON\s+FOR\s+SEPARATION\b/i], ['28'], 'Narrative reason anchor.', { semantic: 0.95, fallback: 0.82, derived: 0.72 }),
  combatVeteran: anchor('normalizedMappings.combatVeteran', 'Combat & Deployment Indicators', [/\b(?:COMBAT|CAMPAIGN\s+MEDAL|IMMINENT\s+DANGER|HOSTILE\s+FIRE|OEF|OIF|OND)\b/i], ['13', '18'], 'Derived from awards, deployment cues, and hazardous duty indicators.', { semantic: 0.86, fallback: 0.74, derived: 0.78 }),
  deploymentLocations: anchor('normalizedMappings.deploymentLocations', 'Combat & Deployment Indicators', [/\b(?:AFGHANISTAN|IRAQ|KUWAIT|SYRIA|DJIBOUTI|SOMALIA|SOUTHWEST\s+ASIA|VIETNAM|KOREA)\b/i], ['12f', '13', '18'], 'Deployment location anchors normalized to VA-recognized names.', { semantic: 0.9, fallback: 0.78, derived: 0.76 }),
  campaigns: anchor('normalizedMappings.campaigns', 'Combat & Deployment Indicators', [/\bCAMPAIGN\s+MEDAL\b/i, /\bGLOBAL\s+WAR\s+ON\s+TERRORISM\b/i], ['13', '18'], 'Campaign anchors from awards and remarks.', { semantic: 0.88, fallback: 0.76, derived: 0.74 }),
  operationNames: anchor('normalizedMappings.operationNames', 'Combat & Deployment Indicators', [/\b(?:OEF|OIF|OND|INHERENT\s+RESOLVE|DESERT\s+SHIELD|DESERT\s+STORM)\b/i], ['18'], 'Operation anchors from remarks.', { semantic: 0.88, fallback: 0.72, derived: 0.72 }),
  deploymentDateRanges: anchor('normalizedMappings.deploymentDateRanges', 'Combat & Deployment Indicators', [/\b(20\d{2}|19\d{2})\d{4}\s*[-–]\s*(20\d{2}|19\d{2})\d{4}\b/i], ['18'], 'Deployment date ranges anchored in remarks.', { semantic: 0.86, fallback: 0.72, derived: 0.7 }),
  vaDeemedLocations: anchor('normalizedMappings.vaDeemedLocations', 'Combat & Deployment Indicators', [/\b(?:AFGHANISTAN|IRAQ|KUWAIT|SYRIA|DJIBOUTI|SOMALIA|VIETNAM|KOREA|SOUTHWEST\s+ASIA)\b/i], ['12f', '18'], 'VA-recognized location normalization layer.', { semantic: 0.88, fallback: 0.76, derived: 0.76 }),
  hazardousDutyIndicators: anchor('normalizedMappings.hazardousDutyIndicators', 'Hazard & Special Duty Pay', [/\b(?:IMMINENT\s+DANGER\s+PAY|HOSTILE\s+FIRE\s+PAY|HARDSHIP\s+DUTY\s+PAY|COMBAT\s+ZONE\s+TAX\s+EXCLUSION)\b/i], ['18'], 'Hazard pay anchors.', { semantic: 0.9, fallback: 0.72, derived: 0.74 }),
  imminentDangerPay: anchor('normalizedMappings.specialDutyPay.imminentDangerPay', 'Hazard & Special Duty Pay', [/\bIMMINENT\s+DANGER\s+PAY\b/i], ['18'], 'Specific IDP anchor.', { semantic: 0.92, fallback: 0.74, derived: 0.72 }),
  hostileFirePay: anchor('normalizedMappings.specialDutyPay.hostileFirePay', 'Hazard & Special Duty Pay', [/\bHOSTILE\s+FIRE\s+PAY\b/i], ['18'], 'Specific HFP anchor.', { semantic: 0.92, fallback: 0.74, derived: 0.72 }),
  hardshipDutyPay: anchor('normalizedMappings.specialDutyPay.hardshipDutyPay', 'Hazard & Special Duty Pay', [/\bHARDSHIP\s+DUTY\s+PAY\b/i], ['18'], 'Specific HDP anchor.', { semantic: 0.92, fallback: 0.74, derived: 0.72 }),
  combatZoneTaxExclusion: anchor('normalizedMappings.specialDutyPay.combatZoneTaxExclusion', 'Hazard & Special Duty Pay', [/\bCOMBAT\s+ZONE\s+TAX\s+EXCLUSION\b/i], ['18'], 'Specific CZTE anchor.', { semantic: 0.92, fallback: 0.74, derived: 0.72 }),
  locationSpecificHazards: anchor('normalizedMappings.locationSpecificHazards', 'Hazard & Special Duty Pay', [/\b(?:AFGHANISTAN|IRAQ|KUWAIT|SYRIA|DJIBOUTI|SOMALIA)\b/i, /\b(?:IMMINENT\s+DANGER|HOSTILE\s+FIRE|HAZARD)\b/i], ['18'], 'Location + hazard correlation.', { semantic: 0.86, fallback: 0.72, derived: 0.72 }),
  awards: anchor('normalizedMappings.awards', 'Awards & Decorations', [/\b(?:MEDAL|BADGE|RIBBON|STAR|COMMENDATION|PARACHUTIST|AIR\s+ASSAULT|COMBAT\s+INFANTRYMAN|CROSS|CITATION|VALOR)\b/i], ['13', '18'], 'Award and decoration anchors.', { semantic: 0.9, fallback: 0.8, derived: 0.76 }),
  seaService: anchor('servicePeriods.seaService', 'Service Periods', [/\b(?:SEA\s+SERVICE|TOTAL\s+SEA\s+SERVICE)\b/i], ['12g'], 'Sea service duration from Block 12g.', { semantic: 0.88, fallback: 0.74, derived: 0.72 }),
  initialEntryTraining: anchor('servicePeriods.initialEntryTraining', 'Service Periods', [/\b(?:INITIAL\s+ENTRY\s+TRAINING|IET|BASIC\s+TRAINING|BOOT\s+CAMP|AIT|OSUT)\b/i], ['18'], 'Initial entry training completion indicators from remarks and training language.', { semantic: 0.84, fallback: 0.7, derived: 0.7 }),
  militaryEducation: anchor('militaryEducation', 'Military Education', [/\b(?:MILITARY\s+EDUCATION|COURSE|SCHOOL|TRAINING)\b/i], ['14'], 'Military education entries from Block 14.', { semantic: 0.86, fallback: 0.72, derived: 0.72 }),
  typeOfSeparation: anchor('characterAndSeparation.typeOfSeparation', 'Character & Separation', [/\b(?:RETIREMENT|RELEASE\s+FROM\s+ACTIVE\s+DUTY|DISCHARGE|DEMOBILIZATION)\b/i], ['25', '26', '28', '18'], 'Type of separation inferred from narrative.', { semantic: 0.84, fallback: 0.72, derived: 0.74 }),
  lastDutyAssignment: anchor('lastDutyAssignment', 'Last Duty Assignment', [/\b(?:LAST\s+DUTY|UNIT\s+(?:OF\s+)?ASSIGNMENT|MAJOR\s+COMMAND)\b/i], ['20', '21', '22'], 'Last duty assignment and major command.', { semantic: 0.84, fallback: 0.70, derived: 0.70 }),
  transferCommand: anchor('transferCommand.postServiceComponent', 'Transfer Command', [/\b(?:TRANSFERRED\s+TO|COMMAND\s+TO\s+WHICH\s+TRANSFERRED|USAR\s+CON\s+GP|RETIRED\s+RESERVE)\b/i], ['9', '18'], 'Post-service transfer component and command indicators.', { semantic: 0.84, fallback: 0.72, derived: 0.7 }),
  reenlistments: anchor('specialProgramsRemarks.reenlistments', 'Service Periods', [/\bIMMEDIATE\s+REENLISTMENTS?\s+THIS\s+PERIOD\b/i], ['18'], 'Reenlistment date ranges from Block 18 remarks.', { semantic: 0.88, fallback: 0.72, derived: 0.72 }),
  occupationalCategory: anchor('normalizedMappings.occupationalCategory', 'MOS / Rate / AFSC Mapping', [/\b(?:MOS|AFSC|RATING|SPECIALTY)\b/i], ['11'], 'Derived MOS/AFSC occupational category.', { semantic: 0.84, fallback: 0.72, derived: 0.78 }),
  combatArmsIndicator: anchor('normalizedMappings.combatArmsIndicator', 'MOS / Rate / AFSC Mapping', [/\b(?:INFANTRY|ARTILLERY|CAVALRY|SPECIAL\s+FORCES|COMBAT\s+ENGINEER)\b/i], ['11', '13'], 'Combat arms indicator derived from specialty and awards.', { semantic: 0.84, fallback: 0.72, derived: 0.78 }),
  specialDutyIndicator: anchor('normalizedMappings.specialDutyIndicator', 'MOS / Rate / AFSC Mapping', [/\b(?:PARACHUTIST|AIR\s+ASSAULT|RANGER|JUMPMASTER|COMBAT\s+DIVER|MILITARY\s+FREEFALL)\b/i], ['11', '13', '18'], 'Special duty indicator derived from specialty, awards, and remarks.', { semantic: 0.86, fallback: 0.74, derived: 0.78 }),
});

function getNestedValue(target, path) {
  return String(path || '').split('.').reduce((current, segment) => (current == null ? null : current[segment]), target);
}

function hasResolvedValue(value) {
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function normalizeComponent(component) {
  return COMPONENT_MAP[String(component || '').trim()] || null;
}

function normalizeDischargeType(characterOfService) {
  const key = String(characterOfService || '').trim().toUpperCase();
  return DISCHARGE_TYPE_MAP[key] || null;
}

function normalizeDuration(duration) {
  if (!duration || typeof duration !== 'object') return null;
  const years = Number(duration.years || 0);
  const months = Number(duration.months || 0);
  const days = Number(duration.days || 0);
  if (!years && !months && !days) return null;
  return { years, months, days };
}

function sumDurations(...durations) {
  const values = durations.map(normalizeDuration).filter(Boolean);
  if (!values.length) return null;
  let years = 0;
  let months = 0;
  let days = 0;
  for (const duration of values) {
    years += duration.years || 0;
    months += duration.months || 0;
    days += duration.days || 0;
  }
  months += Math.floor(days / 30);
  days %= 30;
  years += Math.floor(months / 12);
  months %= 12;
  return { years, months, days };
}

function deriveServiceType(sourceText, component) {
  const text = String(sourceText || '').toUpperCase();
  if (/\bACTIVE\s+GUARD\s+RESERVE\b|\bAGR\b/.test(text)) return 'AGR';
  if (/\bADOS\b|\bACTIVE\s+DUTY\s+OPERATIONAL\s+SUPPORT\b/.test(text)) return 'ADOS';
  if (/\bTITLE\s*10\b/.test(text)) return 'Title 10';
  if (/\bTITLE\s*32\b/.test(text)) return 'Title 32';
  return normalizeComponent(component);
}

function toEpoch(dateValue) {
  const text = String(dateValue || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const epoch = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(epoch) ? epoch : null;
}

function deriveServiceEras(entryDate, separationDate) {
  const start = toEpoch(entryDate);
  const end = toEpoch(separationDate) || start;
  if (!start || !end) return [];
  const eras = SERVICE_ERA_WINDOWS.filter((window) => {
    const windowStart = toEpoch(window.start);
    const windowEnd = toEpoch(window.end);
    return windowStart != null && windowEnd != null && start <= windowEnd && end >= windowStart;
  }).map((window) => window.label);

  if (!eras.length) {
    return ['Peacetime'];
  }

  if (eras.includes('Gulf War Era') && end < toEpoch('2001-09-11')) {
    return ['Gulf War Era'];
  }

  return eras;
}

function normalizeLocation(value) {
  const text = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!text) return null;
  return VA_RECOGNIZED_LOCATIONS[text] || null;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeAwardName(value) {
  let normalized = String(value || '').trim();
  if (!normalized) return null;

  normalized = normalized
    .replace(/\bW\//gi, 'WITH ')
    .replace(/[|]+/g, ' ')
    .replace(/[\[\]{}]+/g, ' ')
    .replace(/\bENV\s*\/\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const pattern of AWARD_NOISE_PATTERNS) {
    if (pattern.test(normalized)) return null;
  }

  for (const [pattern, replacement] of AWARD_CANONICAL_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\((?:\d+|[IVX]+)(?:ST|ND|RD|TH)?\s+AWARD\)/gi, '')
    .replace(/\b(\d+|[IVX]+)(?:ST|ND|RD|TH)?\s+AWARD\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/\b(?:MEDAL|BADGE|RIBBON|STAR|COMMENDATION|ACHIEVEMENT|PARACHUTIST|INFANTRYMAN|PURPLE\s+HEART|DEFENSE|CROSS|CITATION|VALOR|HEART|GOOD\s+CONDUCT|MARKSMAN|EXPERT|UNIT\s+CITATION|SERVICE\s+(?:AWARD|MEDAL|RIBBON))\b/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractAwardCandidatesFromSourceText(sourceText) {
  const text = String(sourceText || '');
  if (!text) return [];

  const candidates = [];
  const sections = [
    text.match(/13\.\s*DECORATIONS[^\n]*\n([\s\S]*?)(?:\n\s*14\.|\n\s*18\.|$)/i)?.[1],
    text.match(/DECORATIONS,?\s*MEDALS,?\s*BADGES[^\n]*\n([\s\S]*?)(?:\n\s*14\.|\n\s*18\.|$)/i)?.[1],
  ].filter(Boolean);

  for (const section of sections) {
    const tokens = String(section)
      .split(/\/\/(?:\s*)|\n|;|,/)
      .map((token) => token.trim())
      .filter(Boolean);

    for (const token of tokens) {
      candidates.push(token);
    }
  }

  return candidates;
}

function clampConfidence(value) {
  return Math.max(0, Math.min(0.99, value));
}

function getVariantConfidenceDelta(variantType, { fieldKey, semanticMatches, usedPositionalFallback }) {
  if (!variantType) return 0;

  if (variantType === 'DD214_LEGACY_PRE_1980') {
    if (semanticMatches > 0) return 0.03;
    if (usedPositionalFallback) return -0.04;
  }

  if (variantType === 'NGB22' || variantType === 'NGB23') {
    if (semanticMatches > 0 && ['branchOfService', 'serviceComponent', 'serviceType'].includes(fieldKey)) {
      return 0.02;
    }
    if (usedPositionalFallback && ['deploymentLocations', 'campaigns', 'operationNames'].includes(fieldKey)) {
      return -0.02;
    }
  }

  if (variantType === 'DD214_MEMBER_4' && usedPositionalFallback) {
    return 0.01;
  }

  return 0;
}

function classifyMos(primarySpecialty, awards = []) {
  const mos = String(primarySpecialty || '').toUpperCase();
  const awardText = (awards || []).join(' ').toUpperCase();
  const firstTwo = mos.slice(0, 2);

  const occupationalCategory = {
    '11': 'Infantry',
    '12': 'Engineering',
    '13': 'Field Artillery',
    '15': 'Aviation',
    '18': 'Special Forces',
    '19': 'Armor',
    '25': 'Signal',
    '31': 'Military Police',
    '35': 'Intelligence',
    '42': 'Human Resources',
    '68': 'Medical',
    '88': 'Transportation',
    '92': 'Supply/Logistics',
  }[firstTwo] || (mos ? 'General Military Specialty' : null);

  const combatArmsIndicator = Boolean(
    ['11', '12', '13', '18', '19'].includes(firstTwo)
    || /COMBAT\s+INFANTRYMAN|COMBAT\s+ACTION|BRONZE\s+STAR|PURPLE\s+HEART/.test(awardText)
  );

  const specialDutyIndicator = Boolean(
    /PARACHUTIST|AIR\s+ASSAULT|RANGER|JUMPMASTER|MILITARY\s+FREEFALL/.test(awardText)
    || /P$/.test(mos)
  );

  return {
    occupationalCategory,
    combatArmsIndicator,
    specialDutyIndicator,
  };
}

function extractOperationNames(parsedResult, sourceText) {
  const tokens = uniqueStrings([
    ...(parsedResult?.specialProgramsRemarks?.deploymentOrCampaignReferences || []),
    sourceText,
  ]);
  const operations = [];
  const operationPatterns = [
    /\bOEF\b/gi,
    /\bOIF\b/gi,
    /\bOND\b/gi,
    /\bINHERENT\s+RESOLVE\b/gi,
    /\bDESERT\s+SHIELD\b/gi,
    /\bDESERT\s+STORM\b/gi,
  ];

  for (const token of tokens) {
    for (const pattern of operationPatterns) {
      for (const match of token.matchAll(pattern)) {
        operations.push(match[0].toUpperCase());
      }
    }
  }

  return uniqueStrings(operations);
}

function extractDeploymentDateRanges(parsedResult) {
  const references = parsedResult?.specialProgramsRemarks?.deploymentOrCampaignReferences || [];
  const ranges = [];
  for (const reference of references) {
    const match = String(reference || '').match(/(20\d{2}|19\d{2})(\d{2})(\d{2})\s*[-–]\s*(20\d{2}|19\d{2})(\d{2})(\d{2})/);
    if (match) {
      ranges.push({
        start: `${match[1]}-${match[2]}-${match[3]}`,
        end: `${match[4]}-${match[5]}-${match[6]}`,
      });
    }
  }
  return ranges;
}

function buildNormalizedMappings(parsedResult, sourceText) {
  const serviceComponent = normalizeComponent(parsedResult?.serviceIdentity?.component);
  const serviceType = deriveServiceType(sourceText, parsedResult?.serviceIdentity?.component);
  const sourceAwardCandidates = extractAwardCandidatesFromSourceText(sourceText);
  const awards = uniqueStrings(
    [
      ...(parsedResult?.decorationsAndService?.decorationsAndAwards || []),
      ...sourceAwardCandidates,
    ]
      .map(normalizeAwardName)
      .filter(Boolean)
  );
  const specialty = classifyMos(parsedResult?.gradeSpecialty?.primaryMOSOrAFSCOrRating, awards);
  const deploymentLocations = uniqueStrings([
    ...(parsedResult?.decorationsAndService?.foreignServiceLocationsIfListed || []),
    ...(parsedResult?.specialProgramsRemarks?.deploymentOrCampaignReferences || []).map(normalizeLocation),
  ].filter(Boolean));
  const hazardousDutyIndicators = uniqueStrings(parsedResult?.intelligentExtraction?.hazardIndicators || []);
  const specialDutyPay = {
    imminentDangerPay: hazardousDutyIndicators.some((item) => /IMMINENT\s+DANGER/i.test(item)),
    hostileFirePay: hazardousDutyIndicators.some((item) => /HOSTILE\s+FIRE/i.test(item)),
    hardshipDutyPay: hazardousDutyIndicators.some((item) => /HARDSHIP\s+DUTY/i.test(item)),
    combatZoneTaxExclusion: /COMBAT\s+ZONE\s+TAX\s+EXCLUSION/i.test(String(sourceText || '')),
  };

  return {
    serviceComponent,
    serviceType,
    serviceEras: deriveServiceEras(parsedResult?.servicePeriods?.entryDate, parsedResult?.servicePeriods?.separationDate),
    dischargeType: normalizeDischargeType(parsedResult?.characterAndSeparation?.characterOfService),
    totalService: sumDurations(
      parsedResult?.servicePeriods?.netActiveServiceThisPeriod,
      parsedResult?.servicePeriods?.totalPriorActiveService,
      parsedResult?.servicePeriods?.totalPriorInactiveService,
    ),
    combatVeteran: Array.isArray(parsedResult?.decorationsAndService?.combatIndicatorsFromAwards)
      ? parsedResult.decorationsAndService.combatIndicatorsFromAwards.length > 0
      : false,
    deploymentLocations,
    campaigns: uniqueStrings(awards.filter((award) => /CAMPAIGN|GLOBAL WAR ON TERRORISM|SERVICE MEDAL/i.test(award))),
    operationNames: extractOperationNames(parsedResult, sourceText),
    deploymentDateRanges: extractDeploymentDateRanges(parsedResult),
    vaDeemedLocations: uniqueStrings(deploymentLocations.map(normalizeLocation).filter(Boolean)),
    hazardousDutyIndicators,
    specialDutyPay,
    locationSpecificHazards: deploymentLocations.filter((location) => hazardousDutyIndicators.length > 0).map((location) => ({ location, indicators: hazardousDutyIndicators })),
    awards,
    occupationalCategory: specialty.occupationalCategory,
    combatArmsIndicator: specialty.combatArmsIndicator,
    specialDutyIndicator: specialty.specialDutyIndicator,
  };
}

function countSemanticMatches(patterns, sourceText) {
  const text = String(sourceText || '');
  return (patterns || []).reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function buildVariantNotes({ variantDetection, template, blockDetection }) {
  const notes = [];
  if (variantDetection?.variantType) {
    notes.push(`Variant detected: ${variantDetection.variantType}.`);
  }
  if (variantDetection?.layoutType) {
    notes.push(`Layout detected: ${variantDetection.layoutType}.`);
  }
  if (template?.templateId) {
    notes.push(`Template resolved: ${template.templateId}.`);
  }
  if (variantDetection?.isMultiPageLikely || (blockDetection?.continuation && Object.keys(blockDetection.continuation).length > 0)) {
    notes.push('Continuation handling enabled for multi-page or continuation-sheet content.');
  }
  if (variantDetection?.variantType === 'DD214_LEGACY_PRE_1980') {
    notes.push('Legacy pre-1980 DD214 detected; semantic anchors should be preferred over modern block labels.');
  }
  if (variantDetection?.variantType === 'NGB22' || variantDetection?.variantType === 'NGB23') {
    notes.push('Guard/Reserve variant detected; branch/component anchors rely on Guard/Reserve-specific semantics.');
  }
  return notes;
}

function resolveFieldValue(fieldKey, parsedResult, normalizedMappings) {
  if (fieldKey in normalizedMappings) {
    return normalizedMappings[fieldKey];
  }
  const schemaPath = DD214_SEMANTIC_ANCHOR_MAP[fieldKey]?.schemaPath;
  return schemaPath ? getNestedValue(parsedResult, schemaPath) : null;
}

export function buildDD214SemanticExtractionMetadata({ parsedResult, sourceText = '', variantDetection = null, template = null, blockDetection = null } = {}) {
  const normalizedMappings = buildNormalizedMappings(parsedResult, sourceText);
  const fieldCoverage = {};
  const fieldConfidence = {};

  for (const [fieldKey, definition] of Object.entries(DD214_SEMANTIC_ANCHOR_MAP)) {
    const semanticMatches = countSemanticMatches(definition.semanticAnchors, sourceText);
    const fallbackBlocksPresent = definition.positionalFallback.filter((blockId) => blockDetection?.blocks?.[blockId]);
    const value = resolveFieldValue(fieldKey, parsedResult, normalizedMappings);
    const resolved = hasResolvedValue(value);
    const usedPositionalFallback = resolved && semanticMatches === 0 && fallbackBlocksPresent.length > 0;
    const baseConfidence = !resolved
      ? 0
      : semanticMatches > 0
        ? definition.confidence.semantic + Math.min(semanticMatches, 3) * 0.01
        : usedPositionalFallback
          ? definition.confidence.fallback
          : definition.confidence.derived;

    const variantDelta = getVariantConfidenceDelta(variantDetection?.variantType, {
      fieldKey,
      semanticMatches,
      usedPositionalFallback,
    });

    fieldConfidence[fieldKey] = Number(clampConfidence(baseConfidence + variantDelta).toFixed(2));
    fieldCoverage[fieldKey] = {
      schemaPath: definition.schemaPath,
      category: definition.category,
      confidence: fieldConfidence[fieldKey],
      semanticMatchCount: semanticMatches,
      fallbackBlocksPresent,
      usedPositionalFallback,
      resolved,
      notes: definition.notes,
    };
  }

  return {
    schemaVersion: DD214_SEMANTIC_ANCHOR_MAP_VERSION,
    strategy: 'semantic-first-positional-fallback',
    variantNotes: buildVariantNotes({ variantDetection, template, blockDetection }),
    fieldConfidence,
    fieldCoverage,
    normalizedMappings,
    supportedVariants: ALL_DD214_VARIANTS,
  };
}

export { DD214_SEMANTIC_ANCHOR_MAP_VERSION };
