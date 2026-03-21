/**
 * DD-214 Military Discharge Document Scanner v3.0 - Modernized Intelligent Extraction
 * Per .copilot-instructions.md: Enhanced component extraction with deterministic parsing.
 * Benefits-relevant extraction with intelligent retirement, badge, hazard detection.
 * Fields not found on the document are set to null.
 */

import { buildExtractionMeta, preprocessScannerText } from './scannerMiddleware.js';
import { computeDD214Confidence } from './dd214ConfidenceModel.js';
import { validateDD214SchemaV3 } from './schemaValidators.js';
import { buildDD214Analysis } from './dd214Analysis/index.js';
import { detectDD214Variant, looksLikeSupportedSeparationDocument } from './dd214VariantModel.js';
import { correctDD214OcrNoise } from './dd214OcrCorrection.js';
import { detectDD214Blocks } from './dd214BlockDetectionModel.js';
import { resolveDD214Template } from './dd214TemplateLibrary.js';
import { buildDD214SemanticExtractionMetadata } from './dd214SemanticAnchors.js';

/* ─── helpers ────────────────────────────────────────────────────── */

const clean = (v) => String(v || '').replace(/[_=\u200B-\u200D\uFEFF]+/g, '').replace(/\s+/g, ' ').trim() || null;

const NOISE_PHRASES = [
  'DEPARTMENT, COMPONENT AND BRANCH',
  'SOCIAL SECURITY NUMBER',
  'NOT TO BE USED FOR THIS',
  'IMPORTANT RECORD',
  'ALTERATIONS IN SHADED AREAS',
  'DD FORM 214',
  'CERTIFICATE OF RELEASE OR DISCHARGE',
];

const BLOCK_LABEL_NOISE = /\b(?:NAME|DEPARTMENT|COMPONENT|BRANCH|SOCIAL\s+SECURITY|NUMBER|CERTIFICATE|RELEASE|DISCHARGE|ACTIVE\s+DUTY|IMPORTANT\s+RECORD|ALTERATIONS|SHADED\s+AREAS|RENDER\s+FORM\s+VOID)\b/i;

function isLikelyNoise(value) {
  const upper = String(value || '').toUpperCase();
  if (!upper) return true;
  return NOISE_PHRASES.some((phrase) => upper.includes(phrase));
}

function toIsoDate(y, mo, d) {
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1940 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (asDate.getUTCFullYear() !== year || asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDurationToIsoDate(isoDate, duration) {
  const source = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return null;
  if (!duration || typeof duration !== 'object') return null;

  const years = Number(duration.years || 0);
  const months = Number(duration.months || 0);
  const days = Number(duration.days || 0);
  if (!Number.isFinite(years) || !Number.isFinite(months) || !Number.isFinite(days)) return null;

  const [year, month, day] = source.split('-').map((value) => Number(value));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() + days);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseDate(text, patterns, { allowLoose = true } = {}) {
  // Try named/context-anchored patterns first.  When parsing the full document
  // text as a fallback (block not isolated), this prevents an earlier stray ISO
  // date from shadowing the correctly-anchored field value.
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const iso = toIsoDate(m[1], m[2], m[3]);
    if (iso) return iso;
  }

  const directIso = String(text || '').match(/\b(20\d{2}|19\d{2})[-\/.](0[1-9]|1[0-2])[-\/.]([0-2]\d|3[01])\b/);
  if (directIso) {
    const iso = toIsoDate(directIso[1], directIso[2], directIso[3]);
    if (iso) return iso;
  }

  if (allowLoose) {
    const compact = text.match(/\b(20\d{2}|19\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])\b/);
    if (compact) {
      const iso = toIsoDate(compact[1], compact[2], compact[3]);
      if (iso) return iso;
    }

    const mdy = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2}|19\d{2})\b/);
    if (mdy) {
      const iso = toIsoDate(mdy[3], mdy[1], mdy[2]);
      if (iso) return iso;
    }
  }

  return null;
}

function parseDuration(text, label) {
  const source = String(text || '')
    .replace(/[|¦]+/g, ' ')
    .replace(/\bTHISPERIOD\b/gi, 'THIS PERIOD');
  const numericNormalized = source
    // OCR frequently misreads zeros/ones in compact service durations.
    .replace(/(?<=\d)[OoQqD](?=\d)/g, '0')
    .replace(/(?<=\d)[Il](?=\d)/g, '1')
    .replace(/\b([OoQqD])(\d{1,3})\b/g, '0$2')
    .replace(/\b(\d{1,3})([OoQqD])\b/g, '$10')
    .replace(/\b([Il])(\d{1,3})\b/g, '1$2')
    .replace(/\b(\d{1,3})([Il])\b/g, '$11');

  const pattern = new RegExp(label + '[:\\s]*(?:(\\d+)\\s*(?:years?|yrs?))?[,\\s]*(?:(\\d+)\\s*(?:months?|mos?))?[,\\s]*(?:(\\d+)\\s*(?:days?|dys?))?', 'i');
  const m = numericNormalized.match(pattern);
  if (m) {
    const y = parseInt(m[1], 10) || 0;
    const mo = parseInt(m[2], 10) || 0;
    const d = parseInt(m[3], 10) || 0;
    if (y !== 0 || mo !== 0 || d !== 0) return { years: y, months: mo, days: d };
  }

  const compactPattern = new RegExp(label + '[^\\d]*(\\d{2,4})\\s*(\\d{2})\\s*(\\d{2})', 'i');
  const c = numericNormalized.match(compactPattern);
  if (c) {
    const years = parseInt(c[1], 10);
    const months = parseInt(c[2], 10);
    const days = parseInt(c[3], 10);
    if ((years + months + days) > 0) return { years, months, days };
  }

  const direct = numericNormalized.match(/\b(\d{2,4})\s+(\d{2})\s+(\d{2})\b/);
  if (direct) {
    const years = parseInt(direct[1], 10) || 0;
    const months = parseInt(direct[2], 10) || 0;
    const days = parseInt(direct[3], 10) || 0;
    if ((years + months + days) > 0) return { years, months, days };
  }

  return null;
}

/* ─── Service Identity ───────────────────────────────────────────── */

/**
 * Extract intelligent discharge status from remarks/narrative.
 * Detects: Retired, Medically Retired, Discharged, etc.
 */
function extractRetirementStatus(remarksText) {
  const text = String(remarksText || '').toUpperCase();
  if (/RETIREMENT|RETIRED|MEDICALLY?\s+RETIRED/.test(text)) {
    if (/MEDICALLY?\s+RETIRED/.test(text)) return 'MEDICALLY_RETIRED';
    return 'RETIRED';
  }
  if (/DISCHARGED|DISCHARGE/.test(text)) return 'DISCHARGED';
  return null;
}

/**
 * Extract badge/award indicators from remarks.
 */
function extractBadges(remarksText) {
  const badges = [
    'PARACHUTIST', 'MILITARY FREEFALL', 'JUMPMASTER', 'RANGER',
    'COMBAT INFANTRYMAN', 'BRONZE STAR', 'PURPLE HEART',
    'DISTINGUISHED FLYING CROSS', 'MERITORIOUS SERVICE MEDAL'
  ];
  const text = String(remarksText || '').toUpperCase();
  return badges.filter(b => text.includes(b));
}

/**
 * Extract hazard/deployment indicators.
 */
function extractHazardIndicators(remarksText) {
  const hazards = [
    'IMMINENT DANGER PAY', 'HOSTILE FIRE PAY', 'AFGHANISTAN', 'IRAQ',
    'FORWARD DEPLOYED', 'COMBAT ZONE', 'DEPLOYMENT',
    'PARACHUTIST', 'MILITARY FREEFALL', 'JUMPMASTER'
  ];
  const text = String(remarksText || '').toUpperCase();
  return hazards.filter(h => text.includes(h));
}

function extractVeteranName(text) {
  const sanitizeName = (value) => {
    let normalized = clean(value)
      ?.replace(/[|]+/g, ' ')
      ?.replace(/\s+/g, ' ')
      ?.replace(/^[^A-Z]+/i, '')
      ?.trim();
    if (!normalized) return null;

    normalized = normalized
      .replace(/\b(?:ARMY|NAVY|AIR\s*FORCE|MARINE\s+CORPS|COAST\s+GUARD|SPACE\s+FORCE)\b[\s\S]*$/i, '')
      .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return null;
    if (normalized.length < 5 || normalized.length > 80) return null;
    if (/\d/.test(normalized)) return null;
    if (BLOCK_LABEL_NOISE.test(normalized)) return null;
    if (!/[A-Z]{2,}/i.test(normalized)) return null;
    return normalized;
  };

  const patterns = [
    /1\.?\s*NAME\s*\([^\)]*\)\s*(?:\n|\s)+(?:2\.|DEPARTMENT|SOCIAL)?\s*([A-Z][A-Z\s,.'\-]{3,80})/is,
    /1\.?\s*NAME[^\n]{0,80}\n\s*([A-Z][A-Z\s,.'\-]{3,80})/is,
    /1\.?\s*NAME[^\n:]*[:\s]+([A-Z][A-Z\s,.'\-]{3,80})/is,
    /4\.\s*NAME[^:]*:(.*?)(?:\n|5\.|DATE|BIRTH)/is,
    /NAME\s*OF\s*MEMBER[^:]*:(.*?)(?:\n|DATE|BIRTH|2\.|DEPARTMENT)/is,
    /NAME[:\s]*\(Last[^)]+\)[:\s]*(.*?)(?:\n|DATE|SSN)/is,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const name = sanitizeName(String(m[1] || '').replace(/\b(?:DD|FORM|214|PAGE|BREAK)\b/gi, ''));
    if (!name) continue;
    if (isLikelyNoise(name)) continue;
    if (!/[A-Z]{2,},\s*[A-Z]{2,}/.test(name) && /\bDEPARTMENT\b|\bSOCIAL\b|\bCOMPONENT\b/i.test(name)) continue;
    return name;
  }

  for (const line of text.split(/\r?\n/)) {
    const candidate = sanitizeName(line);
    if (!candidate) continue;
    if (isLikelyNoise(candidate)) continue;
    if (/\bNAME\b|\bDEPARTMENT\b|\bSOCIAL\b|\bNUMBER\b/i.test(candidate)) continue;
    if (/^[A-Z]{2,},\s*[A-Z]{2,}(?:\s+[A-Z]{2,}|\s+[A-Z]\.?)*/.test(candidate)) return candidate;
  }

  return null;
}

function extractAuthorityFallback(text) {
  const match = text.match(/\b(?:AR|AFI|MCO|NAVMILPERSMAN|MILPERSMAN|COMDTINST)\s*\d{2,4}(?:[-.]\d{1,4})+(?:\s*,\s*CHAP(?:TER)?\s*\d+[A-Z]?(?:\s*[A-Z]{2,4}\s*\d+)?)?/i);
  if (!match) return null;
  const value = clean(match[0])?.replace(/\bSEJ\b/gi, 'SEC');
  if (!value || isLikelyNoise(value)) return null;
  return value;
}

function normalizeCharacterOfService(raw) {
  const value = clean(raw);
  if (!value) return null;

  const upper = value.toUpperCase();
  if (
    isLikelyNoise(upper)
    || /\b(?:SOCIAL\s+SECURITY|SSN|DEPARTMENT|COMPONENT|NUMBER|IMPORTANT\s+RECORD|ALTERATIONS)\b/.test(upper)
  ) {
    return null;
  }

  if (/\b(?:UNDER\s+OTHER\s+THAN\s+HONORABLE\s+CONDITIONS|OTHER\s+THAN\s+HONORABLE)\b/.test(upper)) {
    return 'Other Than Honorable';
  }
  if (/\b(?:GENERAL\s+UNDER\s+HONORABLE\s+CONDITIONS|UNDER\s+HONORABLE\s+CONDITIONS|GENERAL)\b/.test(upper)) {
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

function extractSSNOrServiceNumber(text) {
  const patterns = [
    /(?:SSN|SOCIAL\s*SECURITY|SERVICE\s*(?:NUMBER|NO|#))[:\s]*(\d[\d\-Xx]{5,10})/i,
    /3\.\s*(?:SSN|SOCIAL)[^:]*:\s*(\d[\d\-Xx]{5,10})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = m[1].replace(/[^0-9Xx\-]/g, '');
      if (raw.length >= 4) return raw;
    }
  }
  return null;
}

/**
 * Extract date of birth from Block 5.
 * Handles YYYY-MM-DD, MM/DD/YYYY, and compact YYYYMMDD formats.
 */
function extractDateOfBirth(text, blockDetection = null) {
  const block5 = getBlockValue(blockDetection, '5');
  const source = block5 || text;

  // Try YYYY-MM-DD or YYYY/MM/DD
  const iso = source.match(/(?:5\.?\s*DATE\s+OF\s+BIRTH|\bDOB\b|D\.O\.B\.)[^\d]*((?:19|20)\d{2})[\/-](0[1-9]|1[0-2])[\/-]([0-2]\d|3[01])/i);
  if (iso) {
    const result = toIsoDate(iso[1], iso[2], iso[3]);
    if (result) return result;
  }

  // Try MM/DD/YYYY
  const mdy = source.match(/(?:5\.?\s*DATE\s+OF\s+BIRTH|\bDOB\b|D\.O\.B\.)[^\d]*(0[1-9]|1[0-2])[\/-]([0-2]\d|3[01])[\/-]((19|20)\d{2})/i);
  if (mdy) {
    const result = toIsoDate(mdy[3], mdy[1], mdy[2]);
    if (result) return result;
  }

  // Compact YYYYMMDD in block5-isolated text only (to avoid false positives)
  if (block5) {
    const compact = block5.match(/((?:19|20)\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])/);
    if (compact) {
      const result = toIsoDate(compact[1], compact[2], compact[3]);
      if (result) return result;
    }
  }

  return null;
}

function extractBranch(text) {
  const map = {
    'Army': /\b(?:ARMY|USA|US ARMY|UNITED STATES ARMY)\b/i,
    'Navy': /\b(?:NAVY|USN|US NAVY|UNITED STATES NAVY)\b/i,
    'Air Force': /\b(?:AIR FORCE|USAF|US AIR FORCE|UNITED STATES AIR FORCE)\b/i,
    'Marine Corps': /\b(?:MARINE|MARINES|USMC|US MARINE CORPS|UNITED STATES MARINE CORPS)\b/i,
    'Coast Guard': /\b(?:COAST GUARD|USCG|US COAST GUARD|UNITED STATES COAST GUARD)\b/i,
    'Space Force': /\b(?:SPACE FORCE|USSF|US SPACE FORCE|UNITED STATES SPACE FORCE)\b/i,
  };
  for (const [branch, pattern] of Object.entries(map)) {
    if (pattern.test(text)) return branch;
  }
  return null;
}

function getBlockValue(blockDetection, key) {
  const mapValue = blockDetection?.blocks?.[key];
  if (mapValue) return mapValue;
  const legacyKey = {
    '1': 'block1_name',
    '2': 'block2_branch',
    '3': 'block3_ssn',
    '5': 'block5_dob',
    '8a': 'block8a_assignment',
    '8b': 'block8b_station',
    '11': 'block11_specialty',
    '12a': 'block12a_entry',
    '12b': 'block12b_separation',
    '12c': 'block12c_netActive',
    '12d': 'block12d_priorActive',
    '12e': 'block12e_priorInactive',
    '12f': 'block12f_foreign',
    '12g': 'block12g_sea',
    '13': 'block13_awards',
    '16': 'block16_leave',
    '18': 'block18_remarks',
    '19a': 'block19a_mailing',
    '19b': 'block19b_relative',
    '25': 'block25_authority',
    '26': 'block26_spd',
    '27': 'block27_re',
    '28': 'block28_reason',
  }[key];
  return legacyKey ? blockDetection?.[legacyKey] || null : null;
}

function parseBranchComponentFromBlock2(block2Value) {
  const text = String(block2Value || '').toUpperCase();
  if (!text) return { branchOfService: null, component: null, source: null };

  let branchOfService = null;
  if (/\b(?:ARMY|USA|UNITED STATES ARMY)\b/.test(text)) branchOfService = 'Army';
  else if (/\b(?:NAVY|USN|UNITED STATES NAVY)\b/.test(text)) branchOfService = 'Navy';
  else if (/\b(?:AIR\s*FORCE|USAF|UNITED STATES AIR FORCE)\b/.test(text)) branchOfService = 'Air Force';
  else if (/\b(?:MARINE\s*CORPS|MARINES|USMC)\b/.test(text)) branchOfService = 'Marine Corps';
  else if (/\b(?:COAST\s*GUARD|USCG)\b/.test(text)) branchOfService = 'Coast Guard';
  else if (/\b(?:SPACE\s*FORCE|USSF)\b/.test(text)) branchOfService = 'Space Force';

  let component = null;
  if (/\b(?:RA|R\s*[\/-]?\s*A|R4|REGULAR\s+ARMY|REGULAR\s+NAVY|REGULAR\s+AIR\s+FORCE|REGULAR\s+MARINE\s+CORPS|ACTIVE\s+DUTY|ACTIVE)\b/.test(text)) {
    component = 'Active';
  } else if (/\b(?:ARNG|ANG|NATIONAL\s+GUARD|ARMY\s+NATIONAL\s+GUARD|AIR\s+NATIONAL\s+GUARD|NG)\b/.test(text)) {
    component = 'Guard';
  } else if (/\b(?:USAR|USNR|USAFR|USMCR|USCGR|RESERVE|SELECTED\s+RESERVE)\b/.test(text)) {
    component = 'Reserve';
  }

  return { branchOfService, component, source: text || null };
}

function extractBlock2FallbackFromText(text) {
  const source = String(text || '');
  if (!source) return null;

  const match = source.match(/\b2\.\s*DEPARTMENT,\s*COMPONENT\s+AND\s+BRANCH\b([\s\S]{0,180}?)(?:\b3\.\s*SOCIAL\s+SECURITY\b|\b4a?\.\s*GRADE\b|\n)/i);
  if (!match) return null;

  const candidate = clean(match[1])
    ?.replace(/^[\s:|.-]+/, '')
    ?.replace(/\s+/g, ' ')
    ?.trim();

  if (!candidate || candidate.length < 2) return null;
  return candidate;
}

function extractComponent(text) {
  if (/\b(?:NATIONAL\s+GUARD|ARNG|ANG|AIR\s+NATIONAL\s+GUARD|ARMY\s+NATIONAL\s+GUARD)\b/i.test(text)) return 'Guard';
  if (/\b(?:RESERVE|USAR|USNR|USMCR|USAFR|USCGR|SELECTED\s+RESERVE)\b/i.test(text)) return 'Reserve';
  if (/\b(?:ACTIVE\s*DUTY|REGULAR\s+ARMY|REGULAR\s+NAVY|REGULAR\s+AIR\s+FORCE|REGULAR\s+MARINE\s+CORPS)\b/i.test(text)) return 'Active';
  return null;
}

function extractInitialEntryTraining(text) {
  const source = String(text || '');
  if (!source.trim()) return null;

  const negative = source.match(/\b(?:INITIAL\s+ENTRY\s+TRAINING|IET|BASIC\s+TRAINING|BOOT\s+CAMP|OSUT)\b[^.\n]{0,80}\b(?:NOT\s+COMPLETED|INCOMPLETE|WAIVED)\b/i);
  if (negative) {
    return { completed: false, evidence: clean(negative[0]) || null };
  }

  const positive = source.match(/\b(?:INITIAL\s+ENTRY\s+TRAINING|IET|BASIC\s+TRAINING|BOOT\s+CAMP|ADVANCED\s+INDIVIDUAL\s+TRAINING|AIT|ONE\s+STATION\s+UNIT\s+TRAINING|OSUT)\b[^.\n]{0,80}\b(?:COMPLETED|SUCCESSFULLY\s+COMPLETED|GRADUATED|COMPLETE)\b/i)
    || source.match(/\b(?:GRADUATED\s+FROM\s+BASIC\s+TRAINING|COMPLETED\s+AIT)\b/i);

  if (positive) {
    return { completed: true, evidence: clean(positive[0]) || null };
  }

  return null;
}

/* ─── Service Periods ────────────────────────────────────────────── */

function extractServicePeriods(text, blockDetection = null) {
  const block12a = getBlockValue(blockDetection, '12a');
  const block12b = getBlockValue(blockDetection, '12b');
  const block12c = getBlockValue(blockDetection, '12c');
  const block12d = getBlockValue(blockDetection, '12d');
  const block12e = getBlockValue(blockDetection, '12e');
  const block18 = getBlockValue(blockDetection, '18');

  const entryDatePatterns = [
    /12\s*\.?\s*RECORD\s*OF\s*SERVICE[\s\S]{0,700}?DATE\s*ENTERED\s*AD\s*THIS\s*PERIOD[^\d]{0,30}(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
    /Date\s*entered\s*AD.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
    /ENTRY.*?DUTY.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
    /7\.?a.*?ENTRY.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/is,
    /12a.*?DATE\s*ENTERED.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/is,
  ];

  const entryDate = parseDate(block12a || text, entryDatePatterns, { allowLoose: Boolean(block12a) });

  const explicitEntryMatch = String(text || '').match(/DATE\s*ENTERED\s*AD\s*THIS\s*PERIOD[^\d]{0,30}(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i);
  const explicitEntryDate = explicitEntryMatch
    ? toIsoDate(explicitEntryMatch[1], explicitEntryMatch[2], explicitEntryMatch[3])
    : null;

  const separationDatePatterns = [
    /12\s*\.?\s*RECORD\s*OF\s*SERVICE[\s\S]{0,700}?SEPARATION\s*DATE\s*THIS\s*PERIOD[^\d]{0,30}(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
    /Separation\s*Date.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
    /DATE\s*OF\s*SEPARATION.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
    /12b.*?DATE.*?SEPARATION.*?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/is,
    /\bb\.[^\n]{0,120}?(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i,
  ];

  const separationDate = parseDate(block12b || text, separationDatePatterns, { allowLoose: Boolean(block12b) });

  const explicitSeparationMatch = String(text || '').match(/(?:SEPARATION\s*DATE\s*THIS\s*PERIOD|12b[^\n]{0,40}SEPARATION)[^\d]{0,30}(\d{4})[\/\s\-|]+(\d{2})[\/\s\-|]+(\d{2})/i);
  const explicitSeparationDate = explicitSeparationMatch
    ? toIsoDate(explicitSeparationMatch[1], explicitSeparationMatch[2], explicitSeparationMatch[3])
    : null;

  const netActiveServiceThisPeriod = parseDuration(block12c || text, '(?:12c|NET\\s*ACTIVE\\s*SERVICE\\s*THIS\\s*PERIOD)');
  const totalPriorActiveService = parseDuration(block12d || text, '(?:12d|TOTAL\\s*PRIOR\\s*ACTIVE\\s*SERVICE)');
  const totalPriorInactiveService = parseDuration(block12e || text, '(?:12e|TOTAL\\s*PRIOR\\s*INACTIVE\\s*SERVICE)');
  const block12f = getBlockValue(blockDetection, '12f');
  const foreignService = parseDuration(block12f || text, '(?:12f|FOREIGN\\s*SERVICE)');

  const block12g = getBlockValue(blockDetection, '12g');
  const seaService = parseDuration(block12g || text, '(?:12g|SEA\\s+SERVICE|TOTAL\\s+SEA\\s+SERVICE)');
  const initialEntryTraining = extractInitialEntryTraining(block18 || text);

  let resolvedEntryDate = explicitEntryDate || entryDate;
  let resolvedSeparationDate = explicitSeparationDate || separationDate;

  if (!resolvedSeparationDate && resolvedEntryDate && netActiveServiceThisPeriod) {
    const derived = addDurationToIsoDate(resolvedEntryDate, netActiveServiceThisPeriod);
    if (derived) resolvedSeparationDate = derived;
  }

  if (!resolvedEntryDate && resolvedSeparationDate && netActiveServiceThisPeriod) {
    const reverse = addDurationToIsoDate(resolvedSeparationDate, {
      years: -Number(netActiveServiceThisPeriod.years || 0),
      months: -Number(netActiveServiceThisPeriod.months || 0),
      days: -Number(netActiveServiceThisPeriod.days || 0),
    });
    if (reverse) resolvedEntryDate = reverse;
  }

  const reenlistmentRange = text.match(/IMMEDIATE\s+REENLISTMENTS?\s+THIS\s+PERIOD\s*[-:]{0,2}\s*(\d{8})\s*[-–]\s*(\d{8})/i);
  if (reenlistmentRange) {
    const fallbackEntry = toIsoDate(
      reenlistmentRange[1].slice(0, 4),
      reenlistmentRange[1].slice(4, 6),
      reenlistmentRange[1].slice(6, 8)
    );
    const fallbackSeparation = toIsoDate(
      reenlistmentRange[2].slice(0, 4),
      reenlistmentRange[2].slice(4, 6),
      reenlistmentRange[2].slice(6, 8)
    );

    const bothMissing = !resolvedEntryDate && !resolvedSeparationDate;
    const bothPresentButSuspicious =
      Boolean(resolvedEntryDate && resolvedSeparationDate)
      && (
        resolvedEntryDate === resolvedSeparationDate
        || (/^19\d{2}-/.test(resolvedEntryDate || '') && /^20\d{2}-/.test(fallbackEntry || ''))
        || (/^19\d{2}-/.test(resolvedSeparationDate || '') && /^20\d{2}-/.test(fallbackSeparation || ''))
      );

    if (bothMissing || bothPresentButSuspicious) {
      if (fallbackEntry) resolvedEntryDate = fallbackEntry;
      if (fallbackSeparation) resolvedSeparationDate = fallbackSeparation;
    }
  }

  return {
    entryDate: resolvedEntryDate,
    separationDate: resolvedSeparationDate,
    netActiveServiceThisPeriod,
    totalPriorActiveService,
    totalPriorInactiveService,
    foreignService,
    seaService: seaService || null,
    initialEntryTraining,
  };
}

/* ─── Character & Reason for Separation ──────────────────────────── */

function extractCharacterAndSeparation(text, blockDetection = null) {
  let characterOfService = null;
  const block24 = getBlockValue(blockDetection, '24');
  const block25 = getBlockValue(blockDetection, '25');
  const block26 = getBlockValue(blockDetection, '26');
  const block27 = getBlockValue(blockDetection, '27');
  const block28 = getBlockValue(blockDetection, '28');

  if (block24) characterOfService = clean(block24);
  const charPatterns = [
    /24\.\s*CHARACTER.*?SERVICE.*?:\s*([A-Z][A-Za-z\s]+?)(?:\n|25\.|$)/is,
    /CHARACTER.*?SERVICE.*?:\s*(HONORABLE|GENERAL|UNDER HONORABLE|OTHER THAN HONORABLE|BAD CONDUCT|DISHONORABLE)/is,
  ];
  for (const p of charPatterns) {
    const m = text.match(p);
    if (m) { characterOfService = clean(m[1]); break; }
  }
  characterOfService = normalizeCharacterOfService(characterOfService);

  let narrativeReasonForSeparation = clean(block28);
  const narPat = /28\.\s*NARRATIVE.*?SEPARATION.*?:\s*(.*?)(?:\n|29\.|$)/is;
  const narM = !narrativeReasonForSeparation ? text.match(narPat) : null;
  if (narM) narrativeReasonForSeparation = clean(narM[1]);

  let separationAuthority = clean(block25);
  if (separationAuthority && isLikelyNoise(separationAuthority)) separationAuthority = null;
  const authPat = /25\.\s*SEPARATION\s*AUTHORITY.*?:\s*(.*?)(?:\n|26\.|$)/is;
  const authM = !separationAuthority ? text.match(authPat) : null;
  if (authM) {
    const candidate = clean(authM[1])?.replace(/\bSEJ\b/gi, 'SEC');
    if (candidate && !isLikelyNoise(candidate)) {
      separationAuthority = candidate;
    }
  }
  if (!separationAuthority) {
    separationAuthority = extractAuthorityFallback(text);
  }
  if (separationAuthority && /\bSEPARATION\s+CODE\b|\bREENTRY\s+CODE\b/i.test(separationAuthority)) {
    const narrowedAuthority = extractAuthorityFallback(separationAuthority);
    if (narrowedAuthority) separationAuthority = narrowedAuthority;
  }

  let separationCode = clean(block26)?.toUpperCase() || null;
  if (separationCode) {
    const token = separationCode.replace(/\s+/g, '');
    if (!/^[A-Z0-9]{2,4}$/.test(token) || !/[A-Z]/.test(token)) separationCode = null;
    else separationCode = token;
  }
  const spdPat = /(?:26\.\s*SEPARATION\s*CODE|SPD\s*CODE|SEPARATION\s*PROGRAM\s*DESIGNATOR).*?:?\s*([A-Z0-9]{2,4})/is;
  const spdM = !separationCode ? text.match(spdPat) : null;
  if (spdM) {
    const spd = spdM[1].trim().toUpperCase();
    if (/^[A-Z0-9]{2,4}$/.test(spd) && /[A-Z]/.test(spd)) separationCode = spd;
  }

  let reentryCode = clean(block27)?.toUpperCase().replace(/\s+/g, '') || null;
  if (reentryCode && !/^[A-Z0-9\-]{1,5}$/.test(reentryCode)) reentryCode = null;
  const rePat = /(?:27\.\s*RE(?:ENTRY)?\s*CODE|RE\s*CODE)\s*[:#-]?\s*([A-Z0-9\-]{1,5})/is;
  const reM = !reentryCode ? text.match(rePat) : null;
  if (reM) {
    const re = reM[1].trim().toUpperCase().replace(/\s+/g, '');
    if (/^[A-Z0-9\-]{1,5}$/.test(re)) reentryCode = re;
  }

  if (!separationCode && reentryCode && /[A-Z]/.test(reentryCode) && reentryCode.length <= 4) {
    separationCode = reentryCode;
    reentryCode = null;
  }

  return { characterOfService, narrativeReasonForSeparation, separationAuthority, separationCode, reentryCode };
}

/* ─── Grade / Specialty ──────────────────────────────────────────── */

function extractGradeSpecialty(text, blockDetection = null) {
  let gradeRateRank = null;
  const rankPatterns = [
    /4a\.?\s*(?:GRADE|RATE|RANK)[:\s]+([A-Z][A-Z0-9\s\/]+?)(?:\n|4b|PAY)/is,
    /(?:GRADE|RANK|RATE)[:\s]+([A-Z][A-Z0-9\s\/]+?)(?:\n|PAY\s*GRADE|4b)/is,
  ];
  for (const p of rankPatterns) {
    const m = text.match(p);
    if (m) {
      const v = clean(m[1])?.replace(/\b(?:PAY|GRADE|4B|BLOCK)\b/gi, '').trim();
      if (v && v.length > 2 && v.length < 50) { gradeRateRank = v; break; }
    }
  }

  let payGrade = null;
  const pgPat = /(?:PAY\s*GRADE|4b).*?([EOW][-\s]?\d{1,2})/is;
  const pgM = text.match(pgPat);
  if (pgM) {
    const g = pgM[1].toUpperCase().replace(/\s+/g, '-');
    const n = parseInt(g.match(/\d+/)[0]);
    if ((g.startsWith('E') && n >= 1 && n <= 9) || (g.startsWith('O') && n >= 1 && n <= 10) || (g.startsWith('W') && n >= 1 && n <= 5)) {
      payGrade = g;
    }
  }

  const block11 = getBlockValue(blockDetection, '11');
  const specialtySource = block11 || text;

  // Parse structured MOS entries from Block 11.
  // Each entry may contain: CODE TITLE [// DURATION] separated by // or semicolons.
  const mosDetails = [];
  const seenMosCodes = new Set();

  const mosEntrySource = block11 || text.match(/11\.\s*PRIMARY[^\n]*\n([\s\S]*?)(?=\n\s*(?:12|13|14|15|16|17|18)\.\s)/i)?.[1];
  if (mosEntrySource) {
    const rawEntries = String(mosEntrySource)
      .split(/\r?\n|;|\s+(?=(?:[0-9]{4}|[0-9]{2,4}[A-Z][0-9A-Z]{0,4}|[A-Z]{2,5}[0-9]?)\s+[A-Z])/i)
      .map((e) => e.trim())
      .filter(Boolean);

    for (const entry of rawEntries) {
      const normalizedEntry = String(entry || '').replace(/^[^A-Z0-9]+/i, '').trim();
      const codeM = normalizedEntry.match(/^([0-9]{4}|[0-9]{2,4}[A-Z][0-9A-Z]{0,4}|[0-9][A-Z][0-9A-Z]{3,5}|[A-Z]{2,5}[0-9]?)/i);
      if (!codeM) continue;
      const code = codeM[1].toUpperCase();
      if (/^(19|20)\d{2}$/.test(code)) continue; // year-like → skip
      if (/^(?:PRIMA(?:RY)?|SPECIALTY|TITLE|YEARS?|SERVICE|LIST|DATE|ENTERED|THIS|PERIOD|NET|ACTIVE|TOTAL|PRIOR|FOREIGN|SEA|AND|ONE|MORE|OR)$/i.test(code)) continue;
      if (!/\d/.test(code)) continue;
      if (seenMosCodes.has(code)) continue;
      seenMosCodes.add(code);

      const remainder = normalizedEntry.slice(codeM[0].length).trim();
      const [titleSegmentRaw, durationSegmentRaw] = remainder.split(/\s*\/\/\s*/, 2);
      const titleSegment = (titleSegmentRaw || '').trim();
      const durationSource = `${durationSegmentRaw || ''} ${remainder}`.trim();

      // Duration: "3 YRS 2 MOS" / "4 YEARS" / "1 YR" / "02 06 MOS"
      const durM = durationSource.match(/(\d+)\s*(?:YRS?|YEAR|YEARS?)[^\d]*(?:(\d+)\s*(?:MOS?|MONTH|MONTHS?))?/i)
        || durationSource.match(/(\d+)\s+(\d+)\s*(?:MOS?|MONTH|MONTHS?)/i);
      const years = durM ? parseInt(durM[1]) : null;
      const months = durM ? parseInt(durM[2] || '0') : null;

      // Title: text before duration block, after code
      const title = clean(
        titleSegment
          .replace(/\s*\/\/\s*.*/g, '')
          .replace(/\d+\s*(?:YRS?|YEARS?)[^\d]*/gi, '')
          .replace(/\d+\s*(?:MOS?|MONTH|MONTHS?)/gi, '')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      mosDetails.push({
        code,
        title: (title && title.length >= 3 && title.length <= 80 && !/^\d+$/.test(title)) ? title : null,
        yearsOfService: years,
        monthsOfService: months,
      });
    }
  }

  // Fallback: broad scan for any MOS-like codes when Block 11 parsing yielded nothing.
  let primaryMOSOrAFSCOrRating = mosDetails.length > 0 ? mosDetails[0].code : null;
  const additionalMOSOrSpecialties = mosDetails.slice(1).map((m) => m.code);

  if (!primaryMOSOrAFSCOrRating) {
    const fallbackPatterns = [
      /11\.\s*PRIMARY[^\n:]*[:\s]+([0-9]{2}[A-Z][0-9A-Z]{0,3})/gis,
      /(?:MOS|SPECIALTY|PRIMARY)\s*[:\-]\s*([0-9]{2}[A-Z][0-9A-Z]{0,3})/gis,
      /\b([0-9]{4}|[0-9]{2}[A-Z][0-9A-Z]{0,3})\b/g,
      /\b([0-9][A-Z][0-9A-Z]{3,4})\b/g,
      /\b([A-Z]{2,4}[0-9]?)\b\s+(?:RATING|RATE|SPECIALTY)/gi,
    ];
    for (const pattern of fallbackPatterns) {
      for (const m of specialtySource.matchAll(pattern)) {
        const code = m[1].trim().toUpperCase();
        const looksLikeYear = /^19\d{2}$|^20\d{2}$/.test(code);
        if (code && code.length <= 10 && !code.includes(' ') && !looksLikeYear) {
          if (!primaryMOSOrAFSCOrRating) primaryMOSOrAFSCOrRating = code;
          else if (!additionalMOSOrSpecialties.includes(code) && code !== primaryMOSOrAFSCOrRating) additionalMOSOrSpecialties.push(code);
        }
      }
      if (primaryMOSOrAFSCOrRating) break;
    }
  }

  return {
    gradeRateRank,
    payGrade,
    primaryMOSOrAFSCOrRating,
    mosDetails: mosDetails.length ? mosDetails : null,
    additionalMOSOrSpecialties: additionalMOSOrSpecialties.length ? additionalMOSOrSpecialties : null,
  };
}

/* ─── Decorations & Service ──────────────────────────────────────── */

const COMBAT_KEYWORDS = [
  'PURPLE HEART', 'BRONZE STAR', 'SILVER STAR', 'COMBAT INFANTRY BADGE',
  'COMBAT ACTION BADGE', 'COMBAT ACTION RIBBON', 'COMBAT MEDICAL BADGE',
  'WITH \"V\"', 'WITH V DEVICE', 'WITH VALOR', 'V-DEVICE', 'VALOR DEVICE',
  'WITH C DEVICE', 'C-DEVICE', 'WITH R DEVICE', 'R-DEVICE',
  'CIB', 'CAB', 'CMB', 'NAVY CROSS', 'DISTINGUISHED FLYING CROSS',
  'AIR MEDAL', 'EXPEDITIONARY', 'CAMPAIGN MEDAL', 'GWOT', 'ARCOM WITH V',
  'COMBAT PATCH', 'COMBAT',
];

const LOCATION_PATTERNS = [
  { name: 'Iraq', pattern: /\b(?:IRAQ|OIF|OPERATION IRAQI FREEDOM)\b/i },
  { name: 'Afghanistan', pattern: /\b(?:AFGHANISTAN|OEF|OPERATION ENDURING FREEDOM)\b/i },
  { name: 'Kuwait', pattern: /\b(?:KUWAIT)\b/i },
  { name: 'Somalia', pattern: /\b(?:SOMALIA|MOGADISHU)\b/i },
  { name: 'Kosovo', pattern: /\b(?:KOSOVO)\b/i },
  { name: 'Syria', pattern: /\b(?:SYRIA|INHERENT RESOLVE)\b/i },
  { name: 'Vietnam', pattern: /\b(?:VIETNAM|VIETNAMESE)\b/i },
  { name: 'Korea DMZ', pattern: /\b(?:KOREA\s*DMZ|DMZ\s*KOREA|KOREAN\s+DMZ)\b/i },
  { name: 'Korea', pattern: /\b(?:KOREA|KOREAN)\b/i },
];

const EXPOSURE_KEYWORDS = [
  /\bBURN\s*PIT\b/i,
  /\bTOXIC\s*EXPOSURE\b/i,
  /\bPARTICULATE\s*MATTER\b/i,
  /\bOIL\s*FIRE\b/i,
  /\bSMOKE\s*EXPOSURE\b/i,
  /\bCHEMICAL\s*EXPOSURE\b/i,
  /\bASBESTOS\b/i,
  /\bRADIATION\s+EXPOSURE\b/i,
  /\bPACT\s+ACT\b/i,
  /\bAIRBORNE\s+HAZARD\b/i,
];

/**
 * Known toxic exposure installations mapped to relevant exposure categories.
 * Sources: VA PACT Act, EPA Superfund designations, DoD historical records.
 */
const INSTALLATION_EXPOSURE_MAP = [
  {
    patterns: [/\bCAMP\s+LEJEUNE\b/i, /\bMCB\s+CAMP\s+LEJEUNE\b/i, /\bMCAS\s+NEW\s+RIVER\b/i],
    exposures: ['Contaminated water (Camp Lejeune 1953–1987)', 'Benzene (Camp Lejeune)', 'TCE / trichloroethylene (Camp Lejeune)', 'PCE / tetrachloroethylene (Camp Lejeune)', 'Vinyl chloride (Camp Lejeune)'],
    note: 'PACT Act eligibility: served at Camp Lejeune between Aug 1, 1953 – Dec 31, 1987 (90+ days)',
  },
  {
    patterns: [/\bFORT\s+MCCLELLAN\b/i, /\bFT\.?\s+MCCLELLAN\b/i],
    exposures: ['Chemical/toxic agents (Fort McClellan)', 'Agent Orange (Fort McClellan area storage)', 'Pesticides (Fort McClellan)', 'Ionizing radiation (Fort McClellan)'],
    note: 'Fort McClellan housed Army Chemical School and was a Superfund site; Agent Orange, CS gas, and other chemicals were present',
  },
  {
    patterns: [/\bFORT\s+ORD\b/i, /\bFT\.?\s+ORD\b/i],
    exposures: ['TCE / trichloroethylene groundwater (Fort Ord)', 'Heavy metals (Fort Ord)', 'Ordnance residue (Fort Ord)'],
    note: 'Fort Ord is an EPA Superfund site; TCE groundwater contamination documented',
  },
  {
    patterns: [/\bVIEQUES\b/i],
    exposures: ['Depleted uranium (Vieques Island)', 'Heavy metals (Vieques Island)', 'Ordnance and explosive residue (Vieques Island)'],
    note: 'Former Navy bombing range; depleted uranium and heavy metals exposure documented',
  },
  {
    patterns: [/\bJOHNSTON\s+ATOLL\b/i, /\bJAAS\b/i],
    exposures: ['Agent Orange (Johnston Atoll storage)', 'Chemical weapons residue (Johnston Atoll)'],
    note: 'Agent Orange was stored and destroyed at Johnston Atoll; chemical weapons testing also occurred',
  },
  {
    patterns: [/\bATSUGI\b/i, /\bNAS\s+ATSUGI\b/i],
    exposures: ['Incinerator smoke / open-air burn (NAS Atsugi)', 'Airborne hazards / particulate matter (NAS Atsugi)'],
    note: 'NAS Atsugi operated a high-temperature waste incinerator with documented smoke plume exposure',
  },
  {
    patterns: [/\bPANAMA\b/i, /\bCAMP\s+GAILLARD\b/i, /\bFORT\s+GULICK\b/i, /\bFORT\s+SHERMAN\b/i],
    exposures: ['Agent Orange (Panama Canal Zone)', 'Pesticides (Panama Canal Zone)'],
    note: 'Agent Orange was used in Panama Canal Zone; VA presumes exposure for qualifying service periods',
  },
  {
    patterns: [/\bGUAM\b/i],
    exposures: ['Agent Orange (Guam)', 'Pesticides (Guam)'],
    note: 'Herbicide use in Guam documented; VA recognizes herbicide exposure for certain Guam veterans',
  },
  {
    patterns: [/\bKOREA\b/i, /\bKOREAN\s+DMZ\b/i, /\bDMZ\b/i],
    exposures: ['Agent Orange / herbicides (Korean DMZ 1967–1971)'],
    note: 'Herbicides including Agent Orange were sprayed along the Korean DMZ; eligibility period 1967–1971',
  },
];

/**
 * Detect installation-based toxic exposure indicators from station name and document text.
 * Returns array of exposure strings for display and suggestion pre-population.
 */
function detectInstallationExposures(stationText, fullText = '') {
  const combined = `${stationText || ''} ${fullText || ''}`.toUpperCase();
  if (!combined.trim()) return [];

  const detectedExposures = [];
  const detectedNotes = [];

  for (const entry of INSTALLATION_EXPOSURE_MAP) {
    if (entry.patterns.some((p) => p.test(combined))) {
      for (const exp of entry.exposures) {
        if (!detectedExposures.includes(exp)) detectedExposures.push(exp);
      }
      detectedNotes.push(entry.note);
    }
  }

  return detectedExposures;
}

const AWARD_SIGNAL_PATTERN = /\b(?:MEDAL|BADGE|RIBBON|CROSS|STAR|COMMENDATION|AWARD|SERVICE\s+MEDAL|UNIT\s+CITATION|PARACHUTIST|JUMPMASTER|FREEFALL|INFANTRYMAN|COMBAT\s+ACTION)\b/i;

function isLikelyAwardNoise(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const upper = text.toUpperCase();

  if (isLikelyNoise(text)) return true;
  if (/\b(?:DD\s*FORM|CERTIFICATE\s+OF\s+RELEASE|CONTINUATION\s+SHEET|GENERATED\s+BY\s+TRANSPROC|SOCIAL\s+SECURITY|DATE\s+SIGNED|MEMBER\s+REQUESTS|SIGNATURE|ADDRESS|SPECIAL\s+ADDITIONAL\s+INFORMATION|PRIVACY\s+ACT|NOT\s+TO\s+BE\s+USED|RENDER\s+FORM\s+VOID|CONT\s+(?:FROM|IN)\s+BLOCK\s+1[48]|RIBBONS?\s+AWARDED\s+OR\s+AUTHORIZED|ALL\s+PERIODS\s+OF\s+SERVICE|YEAR\s+COMPLETED)\b/i.test(upper)) {
    return true;
  }

  if (!AWARD_SIGNAL_PATTERN.test(upper)) return true;
  if (/\[[A-Z0-9]{0,6}$/.test(upper)) return true;
  if (upper.length > 140) return true;
  return false;
}

function normalizeEvidenceToken(value, maxLen = 90) {
  let cleaned = clean(value)?.replace(/[\[\]{}]{2,}/g, ' ')?.replace(/\s+/g, ' ');
  if (!cleaned) return null;
  cleaned = cleaned.replace(/^CONT\s+FROM\s+BLOCK\s*\d+\s*:\s*/i, '');
  cleaned = cleaned.replace(/^RIBBONS?\s+AWARDED\s+OR\s+AUTHORIZED\s*/i, '');
  // Remove OCR-truncated trailer fragments like "[ADV" so medals stay isolated.
  cleaned = cleaned.replace(/\s*\[[A-Z0-9]{1,12}\s*$/i, '').trim();
  if (cleaned.includes('|')) cleaned = cleaned.split('|')[0].trim();
  if (/^(?:BADGE|RIBBON|MEDAL|AWARD)$/i.test(cleaned)) return null;
  if (cleaned.length > maxLen) return cleaned.slice(0, maxLen).trim();
  return cleaned;
}

function extractDecorationsAndService(text, blockDetection = null) {
  const decorationsAndAwards = [];
  const combatIndicatorsFromAwards = [];
  const seenAwards = new Set();

  const block13 = getBlockValue(blockDetection, '13');
  const block18 = getBlockValue(blockDetection, '18');
  const structuredText = [block13, block18].filter(Boolean).join('\n');
  const evidenceText = structuredText || text;

  const awardsSection = block13
    ? [null, block13]
    : text.match(/13\.\s*DECORATIONS[^\n]*\n([\s\S]*?)(?=\n\s*(?:14|15|16|17|18|19|20|21|22|23|24|25|26|27|28)\.|$)/is);
  if (awardsSection) {
    const rawList = awardsSection[1].split(/\/\/|\/\s*\/|;|\n|,/).map((a) => a.trim()).filter(Boolean);
    const list = [];
    for (const token of rawList) {
      const current = String(token || '').trim();
      if (!current) continue;
      const previous = list.length > 0 ? list[list.length - 1] : null;
      if (!previous) {
        list.push(current);
        continue;
      }

      const openParens = (previous.match(/\(/g) || []).length;
      const closeParens = (previous.match(/\)/g) || []).length;
      const needsParenContinuation = openParens > closeParens;
      const looksLikeContinuation = /^(?:AWARD\)?|OAK\s+LEAF\s+CLUSTER|CLUSTER|DEVICE|STAR\)?|W\/\s*CAMPAIGN\s*STAR|WITH\s+V\s+DEVICE)\b/i.test(current);

      if (needsParenContinuation || looksLikeContinuation) {
        list[list.length - 1] = `${previous} ${current}`.replace(/\s+/g, ' ').trim();
      } else {
        list.push(current);
      }
    }

    for (const raw of list) {
      const a = normalizeEvidenceToken(raw, 120);
      if (!a || a === 'NOTHING FOLLOWS' || a.length < 5 || a.length > 150 || /^\d/.test(a) || isLikelyAwardNoise(a)) continue;
      const key = a.toUpperCase();
      if (seenAwards.has(key)) continue;
      seenAwards.add(key);
      decorationsAndAwards.push(a);
      if (COMBAT_KEYWORDS.some((kw) => a.toUpperCase().includes(kw))) {
        combatIndicatorsFromAwards.push(a);
      }
    }
  }

  // Foreign service
  let foreignServiceTotal = null;
  const fsPat = /(?:FOREIGN\s*SERVICE|12f).*?(?:(\d+)\s*(?:years?|yrs?)[,\s]*)?(?:(\d+)\s*(?:months?|mos?)[,\s]*)?(?:(\d+)\s*(?:days?|dys?))?/is;
  const fsM = (getBlockValue(blockDetection, '12f') || evidenceText).match(fsPat);
  if (fsM && (fsM[1] || fsM[2] || fsM[3])) {
    foreignServiceTotal = { years: parseInt(fsM[1]) || 0, months: parseInt(fsM[2]) || 0, days: parseInt(fsM[3]) || 0 };
  }

  const foreignServiceLocationsIfListed = [];
  const zones = [
    ...LOCATION_PATTERNS,
    { name: 'Gulf War', pattern: /\b(?:DESERT STORM|DESERT SHIELD|PERSIAN GULF|SOUTHWEST ASIA)\b/i },
  ];
  const hasForeignServiceDuration = Boolean(foreignServiceTotal && ((foreignServiceTotal.years || 0) + (foreignServiceTotal.months || 0) + (foreignServiceTotal.days || 0) > 0));
  const hasDeploymentContext = /\b(?:SERVICE\s+IN|DEPLOY(?:ED|MENT)|IN\s+SUPPORT\s+OF|OPERATION\s+(?:IRAQI\s+FREEDOM|ENDURING\s+FREEDOM|INHERENT\s+RESOLVE|NEW\s+DAWN|DESERT\s+STORM|DESERT\s+SHIELD)|OEF|OIF|OND|COMBAT\s+ZONE|HOSTILE\s+FIRE|IMMINENT\s+DANGER|CAMPAIGN\s+MEDAL|EXPEDITIONARY)\b/i.test(evidenceText);
  for (const z of zones) {
    if (z.pattern.test(evidenceText) && (hasForeignServiceDuration || hasDeploymentContext)) {
      foreignServiceLocationsIfListed.push(z.name);
    }
  }

  return {
    decorationsAndAwards: decorationsAndAwards.length ? decorationsAndAwards : null,
    foreignServiceTotal,
    foreignServiceLocationsIfListed: foreignServiceLocationsIfListed.length ? foreignServiceLocationsIfListed : null,
    combatIndicatorsFromAwards: combatIndicatorsFromAwards.length ? combatIndicatorsFromAwards : null,
  };
}

/* ─── Special Programs / Remarks ─────────────────────────────────── */

function extractRemarksAndPrograms(text, blockDetection = null) {
  const block18 = getBlockValue(blockDetection, '18');
  let remarksBlock = clean(block18);
  const remPat = /18\.\s*REMARKS.*?:(.*?)(?:19\.|20\.|MEMBER\s*REQUESTS|AUTHORITY|CONTINUED\s+IN\s+BLOCK|$)/is;
  const remM = !remarksBlock ? text.match(remPat) : null;
  if (remM) {
    remarksBlock = clean(remM[1]);
    if (remarksBlock && remarksBlock.length > 2500) remarksBlock = remarksBlock.slice(0, 2500).trim();
  }

  const sourceText = String(remarksBlock || '').trim() || text;

  const deploymentOrCampaignReferences = [];
  const campaignPatterns = [
    /\b(GLOBAL WAR ON TERRORISM[^.\n]{0,60})/gi,
    /\b(OPERATION\s+(?:IRAQI FREEDOM|ENDURING FREEDOM|INHERENT RESOLVE|NEW DAWN|DESERT STORM|DESERT SHIELD)[^.\n]{0,60})/gi,
    /\b(CAMPAIGN\s+(?:MEDAL|STAR|RIBBON)[^.\n]{0,60})/gi,
  ];
  for (const p of campaignPatterns) {
    for (const m of sourceText.matchAll(p)) {
      const ref = normalizeEvidenceToken(m[1], 90);
      if (ref && !deploymentOrCampaignReferences.includes(ref)) deploymentOrCampaignReferences.push(ref);
    }
  }

  for (const loc of LOCATION_PATTERNS) {
    const hasLocation = loc.pattern.test(sourceText);
    const hasDeploymentContext = /\b(?:SERVICE\s+IN|DEPLOY(?:ED|MENT)|IN\s+SUPPORT\s+OF|OPERATION\s+(?:IRAQI\s+FREEDOM|ENDURING\s+FREEDOM|INHERENT\s+RESOLVE|NEW\s+DAWN|DESERT\s+STORM|DESERT\s+SHIELD)|OEF|OIF|OND|COMBAT\s+ZONE|HOSTILE\s+FIRE|IMMINENT\s+DANGER|CAMPAIGN\s+MEDAL)\b/i.test(sourceText);
    if (hasLocation && hasDeploymentContext && !deploymentOrCampaignReferences.includes(loc.name)) {
      deploymentOrCampaignReferences.push(loc.name);
    }
  }

  for (const pattern of EXPOSURE_KEYWORDS) {
    const hit = sourceText.match(pattern);
    if (hit) {
      const token = `EXPOSURE: ${clean(hit[0])}`;
      if (token && !deploymentOrCampaignReferences.includes(token)) deploymentOrCampaignReferences.push(token);
    }
  }

  let separationIncentives = null;
  const sepIncPat = /\b(SEVERANCE\s*PAY|SSB|VSI|VOLUNTARY\s*SEPARATION\s*INCENTIVE|SPECIAL\s*SEPARATION\s*BENEFIT)[^.\n]{0,80}/gi;
  const sepIncMatches = [...sourceText.matchAll(sepIncPat)].map((m) => clean(m[0])).filter(Boolean);
  if (sepIncMatches.length) separationIncentives = sepIncMatches;

  let disabilitySeveranceOrDisabilityIndicator = null;
  const disPat = /\b(DISABILITY\s*(?:SEVERANCE|RETIRED|DISCHARGE|SEPARATION)|TDRL|PDRL|TEMPORARY\s*DISABILITY)[^.\n]{0,80}/i;
  const disM = sourceText.match(disPat);
  if (disM) disabilitySeveranceOrDisabilityIndicator = clean(disM[0]);

  let earlySeparationPrograms = null;
  const earlyPat = /\b(EARLY\s*(?:TRANSITION|SEPARATION)|PALACE\s*CHASE|TERA|REDUX|VOLUNTARY\s*EARLY)[^.\n]{0,80}/gi;
  const earlyMatches = [...sourceText.matchAll(earlyPat)].map((m) => clean(m[0])).filter(Boolean);
  if (earlyMatches.length) earlySeparationPrograms = earlyMatches;

  // Reenlistments — Block 18 pattern: "IMMEDIATE REENLISTMENTS THIS PERIOD: YYYYMMDD-YYYYMMDD"
  const reenlistments = [];
  const rePatStr = /IMMEDIATE\s+REENLISTMENTS?\s+THIS\s+PERIOD\s*[-:]{0,2}\s*(\d{8})\s*[-–]\s*(\d{8})/gi;
  for (const m of String(sourceText).matchAll(rePatStr)) {
    const s = m[1], e = m[2];
    const start = toIsoDate(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
    const end   = toIsoDate(e.slice(0, 4), e.slice(4, 6), e.slice(6, 8));
    if (start && end) reenlistments.push({ start, end });
  }

  return {
    remarksBlock,
    deploymentOrCampaignReferences: deploymentOrCampaignReferences.length ? deploymentOrCampaignReferences : null,
    separationIncentives,
    disabilitySeveranceOrDisabilityIndicator,
    earlySeparationPrograms,
    reenlistments: reenlistments.length ? reenlistments : null,
  };
}

/* ─── Military Education ─────────────────────────────────────────── */

function parseMilitaryEducationEntries(raw) {
  if (!raw) return null;
  const entries = [];
  const segments = String(raw).split(/\r?\n|;/).map((s) => s.trim()).filter((s) => s.length > 3);
  for (const seg of segments) {
    const yearM = seg.match(/\b(19|20)(\d{2})\b/);
    const durM = seg.match(/(\d+)\s*(?:WKS?|WEEKS?|HRS?|HOURS?|DAYS?|MOS?)/i);
    const courseName = clean(
      seg
        .replace(/\b(19|20)\d{2}\b/, '')
        .replace(/\d+\s*(?:WKS?|WEEKS?|HRS?|HOURS?|DAYS?|MOS?)/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    if (!courseName || courseName.length < 4) continue;
    entries.push({
      courseName,
      duration: durM ? clean(durM[0]) : null,
      yearCompleted: yearM ? parseInt(`${yearM[1]}${yearM[2]}`) : null,
    });
  }
  return entries.length ? entries : null;
}

function extractMilitaryEducation(text, blockDetection = null) {
  const block14 = getBlockValue(blockDetection, '14');
  const source = block14
    || (text.match(/14\.\s*MILITARY\s+EDUCATION[^\n]*\n([\s\S]{0,600})(?=\n\s*(?:15|16|17|18|19|20)\.\s)/i) || [])[1];
  return parseMilitaryEducationEntries(source);
}

/* ─── Station at Separation ─────────────────────────────────────── */

/**
 * Extract Block 8b — Station or Installation Where Separated.
 * Used for installation-based presumptive exposure (Camp Lejeune, Fort McClellan, etc.).
 */
function extractStationAtSeparation(text, blockDetection = null) {
  const block8b = getBlockValue(blockDetection, '8b');
  if (block8b) {
    const value = clean(block8b);
    if (value && value.length > 2 && !isLikelyNoise(value)) return value;
  }

  // Pattern scan — modern form label
  const patterns = [
    /8b\.?\s*(?:STATION\s+OR\s+INSTALLATION\s+WHERE\s+SEPARATED|STATION\s+INSTALLATION)[^\n:]*[\n:]+\s*([^\n\d][^\n]{3,120})/i,
    /8b\.?\s*(?:INSTALLATION|STATION)[^\n:]*:\s*([^\n]{3,120})/i,
    /(?:STATION\s+OR\s+INSTALLATION\s+WHERE\s+SEPARATED)[^\n:]*[\n:]+\s*([^\n]{3,120})/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;
    const val = clean(m[1]);
    if (val && val.length > 2 && !isLikelyNoise(val)) return val;
  }

  return null;
}

/* ─── Accrued Leave ──────────────────────────────────────────────── */

/**
 * Extract Block 16 — Days Accrued Leave Paid.
 */
function extractAccruedLeavePaid(text, blockDetection = null) {
  const block16 = getBlockValue(blockDetection, '16');
  const source = block16 || text;

  const pat = /(?:16\.?\s*DAYS?\s+ACCRUED\s+LEAVE\s+PAID|ACCRUED\s+LEAVE\s+PAID|ACCRUED\s+LEAVE)[^\d]*(\d{1,4})/i;
  const m = source.match(pat);
  if (m) {
    const days = parseInt(m[1], 10);
    if (!isNaN(days) && days >= 0 && days <= 365) return days;
  }

  return null;
}

/* ─── Type of Separation ─────────────────────────────────────────── */

function extractTypeOfSeparation(text, charSep = null) {
  const narrative = String(charSep?.narrativeReasonForSeparation || '');
  const source = String(text || '') + ' ' + narrative;

  if (/\bDISABILITY\s+RETIREM|\bTEMPORARY\s+DISABILITY\b|\bPERMANENT\s+DISABILITY\b/i.test(source)) return 'Disability Retirement';
  if (/\bRETIR(?:EMENT|ED|ING)\b/i.test(source)) return 'Retirement';
  if (/\bRELEASE\s+FROM\s+ACTIVE\s+DUTY\b/i.test(source)) return 'Release from Active Duty';
  if (/\bDEMOBILIZATION\b/i.test(source)) return 'Demobilization';
  if (/\bAWOL\b|DESERTION|DROPPED\s+FROM\s+ROLLS/i.test(source)) return 'Administrative';
  if (/\bDEATH\b/i.test(source)) return 'Death';
  if (/\bHONORABLE\s+DISCHARGE\b|\bDISCHARGED?\b/i.test(source)) return 'Discharge';
  return null;
}

/* ─── Last Duty Assignment ───────────────────────────────────────── */

function extractLastDutyAssignment(text, blockDetection = null) {
  const block8a = getBlockValue(blockDetection, '8a');
  const block20 = getBlockValue(blockDetection, '20');
  const block21 = getBlockValue(blockDetection, '21');
  const block22 = getBlockValue(blockDetection, '22');

  let lastDutyAssignmentTitle = null;
  let majorCommand = null;

  if (block8a) {
    const normalized8a = clean(block8a);
    if (normalized8a) {
      lastDutyAssignmentTitle = normalized8a;
      const majorFrom8a = normalized8a.match(/\b(?:FORT\s+[A-Z\s]+|USAR\s+CON\s+GP|[A-Z]{2,5}\s+[A-Z]{2,5}\s+[A-Z]{2,5})\b/i);
      if (majorFrom8a) {
        majorCommand = clean(majorFrom8a[0]);
      }
    }
  } else if (block20) {
    lastDutyAssignmentTitle = clean(block20);
  } else {
    const m = text.match(/(?:LAST\s+DUTY\s+ASSIGNMENT|UNIT\s+(?:OF\s+)?ASSIGNMENT)[^:\n]*[:\s]([^\n]{3,120})/i);
    if (m) lastDutyAssignmentTitle = clean(m[1]);
  }

  if (block21) {
    majorCommand = clean(block21);
  } else if (block22) {
    majorCommand = clean(block22);
  } else if (!majorCommand) {
    const m = text.match(/(?:MAJOR\s+COMMAND|MAJOR\s+UNIT)[^:\n]*[:\s]([^\n]{3,120})/i);
    if (m) majorCommand = clean(m[1]);
  }

  if (!lastDutyAssignmentTitle && !majorCommand) return null;
  return { lastDutyAssignmentTitle: lastDutyAssignmentTitle || null, majorCommand: majorCommand || null };
}

/* ─── Transfer Command ───────────────────────────────────────────── */

function extractTransferCommand(text, blockDetection = null) {
  const block9 = getBlockValue(blockDetection, '9');
  const block18 = getBlockValue(blockDetection, '18');

  let postServiceComponent = clean(block9);
  if (postServiceComponent && /\b(?:COMMAND\s+TO\s+WHICH\s+TRANSFERRED|COMPLETING\s+RESERVE\s+OBLIGATION|TRANSFERRED\s+TO)\b/i.test(postServiceComponent)) {
    postServiceComponent = clean(postServiceComponent.replace(/\b(?:COMMAND\s+TO\s+WHICH\s+TRANSFERRED|COMPLETING\s+RESERVE\s+OBLIGATION|TRANSFERRED\s+TO)\b[:\s-]*/gi, ''));
  }

  if (!postServiceComponent || postServiceComponent.length < 3) {
    const source = `${block18 || ''}\n${text || ''}`;
    const m = source.match(/\b(?:TRANSFERRED\s+TO|COMMAND\s+TO\s+WHICH\s+TRANSFERRED|USAR\s+CONTROL\s+GROUP|USAR\s+CON\s+GP|REINFORCEMENT|RETIRED\s+RESERVE)\b[^.\n]{0,120}/i);
    if (m) postServiceComponent = clean(m[0]);
  }

  if (postServiceComponent) {
    postServiceComponent = clean(postServiceComponent
      .replace(/^10\.\s*SGLI\s*COVERAGE\s*[|:]?\s*[|:]?\s*NONE\s*/i, '')
      .replace(/^SGLI\s*COVERAGE\s*[|:]?\s*[|:]?\s*NONE\s*/i, '')
      .replace(/^COMMAND\s+TO\s+WHICH\s+TRANSFERRED\s*[|:]?\s*/i, '')
      .replace(/\|\s*10\.?\s*$/i, ''));
  }

  if (postServiceComponent && /^\d{1,2}$/.test(postServiceComponent)) {
    postServiceComponent = null;
  }

  if (!postServiceComponent) {
    const source = `${block18 || ''}\n${text || ''}`;
    const explicitTransfer = source.match(/\bUSAR\s+(?:CON\s+GP|CONTROL\s+GROUP)\b[^.\n]{0,140}/i);
    if (explicitTransfer) {
      postServiceComponent = clean(explicitTransfer[0]);
    }
  }

  if (!postServiceComponent) return null;
  return { postServiceComponent };
}

/* ─── Post-Service Contact ───────────────────────────────────────── */

function extractPostServiceContact(text, blockDetection = null) {
  const sanitizeContact = (value) => {
    const contact = clean(value);
    if (!contact) return null;
    if (/\b(?:MEMBER\s+SIGNATURE|OFFICIAL\s+AUTHORIZED\s+TO\s+SIGN|DATE\s+SIGNED|SPECIAL\s+ADDITIONAL\s+INFORMATION|COPY\s+\d\s+BE\s+SENT)\b/i.test(contact)) return null;
    return contact;
  };

  let mailingAddressAtSeparation = sanitizeContact(getBlockValue(blockDetection, '19a'));
  if (!mailingAddressAtSeparation) {
    const addrPat = /19a\.?\s*(?:MAILING\s+ADDRESS\s+AFTER\s+SEPARATION|MAILING\s+ADDRESS)[^\n:]*[:\s]+([^\n]{5,200})/i;
    const addrM = text.match(addrPat);
    if (addrM) mailingAddressAtSeparation = sanitizeContact(addrM[1]);
  }

  let nearestRelativeOrEmergencyContact = sanitizeContact(getBlockValue(blockDetection, '19b'));
  if (!nearestRelativeOrEmergencyContact) {
    const relPat = /19b\.?\s*(?:NEAREST\s+RELATIVE|RELATIVE\s+NAME\s+AND\s+ADDRESS|EMERGENCY\s+CONTACT|NEXT\s+OF\s+KIN)[^\n:]*[:\s]+([^\n]{5,200})/i;
    const relM = text.match(relPat);
    if (relM) nearestRelativeOrEmergencyContact = sanitizeContact(relM[1]);
  }

  return { mailingAddressAtSeparation, nearestRelativeOrEmergencyContact };
}

/* ─── Document detection ─────────────────────────────────────────── */

export function looksLikeDD214(text) {
  return looksLikeSupportedSeparationDocument(text);
}

/* ─── Main export ────────────────────────────────────────────────── */

export function parseDD214(rawText) {
  const correctedText = correctDD214OcrNoise(rawText);
  const text = preprocessScannerText(correctedText);
  const variantDetection = detectDD214Variant(text);
  const template = resolveDD214Template(variantDetection, text);
  const blockDetection = detectDD214Blocks(text, variantDetection);
  const block2 = getBlockValue(blockDetection, '2') || extractBlock2FallbackFromText(text);
  const blockIdentity = parseBranchComponentFromBlock2(block2);

  const block1Name = clean(getBlockValue(blockDetection, '1'));
  const safeBlock1Name = block1Name
    && !BLOCK_LABEL_NOISE.test(block1Name)
    && !/\d/.test(block1Name)
    && !/\b(?:ARMY|NAVY|AIR\s*FORCE|MARINE\s+CORPS|COAST\s+GUARD|SPACE\s+FORCE)\b/i.test(block1Name)
    ? block1Name
    : null;
  const identity = {
    veteranName: extractVeteranName(text) || safeBlock1Name,
    ssnOrServiceNumber: clean(getBlockValue(blockDetection, '3')) || extractSSNOrServiceNumber(text),
    branchOfService: blockIdentity.branchOfService || extractBranch(text),
    component: blockIdentity.component || null,
  };

  const periods = extractServicePeriods(text, blockDetection);

  const separation = extractCharacterAndSeparation(text, blockDetection);

  const grade = extractGradeSpecialty(text, blockDetection);

  const decorations = extractDecorationsAndService(text, blockDetection);

  const programs = extractRemarksAndPrograms(text, blockDetection);

  const militaryEducation = extractMilitaryEducation(text, blockDetection);

  const lastDutyAssignment = extractLastDutyAssignment(text, blockDetection);

  const transferCommand = extractTransferCommand(text, blockDetection);

  const contact = extractPostServiceContact(text, blockDetection);

  const dateOfBirth = extractDateOfBirth(text, blockDetection);
  const stationAtSeparation = extractStationAtSeparation(text, blockDetection);
  const accruedLeavePaid = extractAccruedLeavePaid(text, blockDetection);
  const installationExposures = detectInstallationExposures(stationAtSeparation, programs?.remarksBlock || '');

  const intelligentExtraction = {
    retirementStatus: extractRetirementStatus(`${programs?.remarksBlock || ''} ${separation?.narrativeReasonForSeparation || ''}`),
    badgeIndicators: extractBadges(`${programs?.remarksBlock || ''} ${(decorations?.decorationsAndAwards || []).join(' ')}`),
    hazardIndicators: extractHazardIndicators(`${programs?.remarksBlock || ''} ${(programs?.deploymentOrCampaignReferences || []).join(' ')} ${(decorations?.decorationsAndAwards || []).join(' ')}`),
    combatIndicators: decorations?.combatIndicatorsFromAwards || null,
    stationAtSeparation: stationAtSeparation || null,
    installationExposures: installationExposures.length ? installationExposures : null,
  };

  const typeOfSeparation = extractTypeOfSeparation(text, separation);

  const result = {
    documentType: 'DD-214',
    schemaVersion: '3.0.0',

    serviceIdentity: { ...identity, dateOfBirth: dateOfBirth || null },
    servicePeriods: { ...periods, accruedLeavePaid: accruedLeavePaid ?? null },
    characterAndSeparation: { ...separation, typeOfSeparation },
    gradeSpecialty: grade,
    decorationsAndService: decorations,
    specialProgramsRemarks: programs,
    militaryEducation,
    lastDutyAssignment,
    transferCommand,
    postServiceContact: contact,
    intelligentExtraction,

    extractionMeta: buildExtractionMeta({
      scannerType: 'dd214',
      schemaVersion: '3.0.0',
      confidence: 0,
      fieldsPopulated: 0,
      fieldsTotal: 10,
      extras: {
        variantDetection,
        blockDetection,
        template,
      },
    }),
  };

  const semanticExtraction = buildDD214SemanticExtractionMetadata({
    parsedResult: result,
    sourceText: text,
    variantDetection,
    template,
    blockDetection,
  });

  result.extractionMeta.semanticAnchors = semanticExtraction;
  result.extractionMeta.variantNotes = semanticExtraction.variantNotes;
  result.extractionMeta.semanticFieldConfidence = semanticExtraction.fieldConfidence;
  result.extractionMeta.normalizedMappings = semanticExtraction.normalizedMappings;

  result.dd214Analysis = buildDD214Analysis(result, {
    includeEvidenceGraph: false,
    sourceText: text,
    variantDetection,
    blockDetection,
  });

  const confidenceModel = computeDD214Confidence(result, { analysis: result.dd214Analysis });
  result.extractionMeta.confidence = confidenceModel.confidence;
  result.extractionMeta.fieldsPopulated = confidenceModel.fieldsPopulated;
  result.extractionMeta.fieldsTotal = confidenceModel.fieldsTotal;
  result.extractionMeta.fieldConfidence = confidenceModel.fieldConfidence;
  result.extractionMeta.validationSummary = confidenceModel.validationSummary;

  if (result.dd214Analysis?.confidenceScores) {
    result.dd214Analysis.confidenceScores.overall = Number(confidenceModel.confidence || 0);
    result.dd214Analysis.confidenceScores.fields = confidenceModel.fieldConfidence;
    result.dd214Analysis.validationSummary = confidenceModel.validationSummary;
  }

  const schema = validateDD214SchemaV3(result);
  result.extractionMeta.schemaValid = schema.valid;
  result.extractionMeta.schemaErrors = schema.errors;

  return result;
}

export default parseDD214;

