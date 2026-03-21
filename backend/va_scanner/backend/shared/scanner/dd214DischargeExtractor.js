/**
 * DD-214 Discharge & Separation Field Extractor
 * 
 * Extracts all Block 23-29 discharge and separation fields with:
 * - Semantic anchor priority (field labels first)
 * - Positional fallback (Block numbers)
 * - Normalization (SPD codes, RE codes, character of service)
 * - Validation (DD-214 vocabulary compliance)
 * - Noise filtering (no continuation sheets, signatures, SGLI data)
 */

// ============================================================================
// DD-214 DISCHARGE VOCABULARY & NORMALIZATION MAPS
// ============================================================================

const CHARACTER_OF_SERVICE_VOCAB = Object.freeze({
  'HONORABLE': 'Honorable',
  'GENERAL': 'General',
  'GENERAL (UNDER HONORABLE CONDITIONS)': 'General',
  'UNDER HONORABLE CONDITIONS': 'General',
  'OTHER THAN HONORABLE': 'Other Than Honorable',
  'UNDER OTHER THAN HONORABLE CONDITIONS': 'Other Than Honorable',
  'BAD CONDUCT': 'Bad Conduct',
  'DISHONORABLE': 'Dishonorable',
});

const TYPE_OF_SEPARATION_VOCAB = Object.freeze({
  'RETIREMENT': 'Retirement',
  'RELEASE FROM ACTIVE DUTY': 'Release from Active Duty',
  'DISCHARGE': 'Discharge',
  'DEMOBILIZATION': 'Demobilization',
  'TRANSFER': 'Transfer',
});

// SPD (Separation Program Designator) codes - DoD standard (VA-optimized)
// Based on spd-code-index.md alignment with DD-214 extraction requirements
const SPD_CODE_NORMALIZATIONS = Object.freeze({
  // === DISABILITY RETIREMENT & SEPARATION (VA-Primary) ===
  'SEJ': { code: 'SEJ', meaning: 'Disability, Permanent (Enhanced)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: true },
  'SFJ': { code: 'SFJ', meaning: 'Disability, Temporary (TDRL)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: false },
  'SFK': { code: 'SFK', meaning: 'Disability, Temporary Non-Duty (TDRL)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: false },
  'SFX': { code: 'SFX', meaning: 'Disability, Permanent Non-Duty (PDRL)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: false },
  'SEK': { code: 'SEK', meaning: 'Disability, Temporary', category: 'Disability', vaImpact: 'Eligible', crscRelevant: false },
  
  // === DISABILITY WITH SEVERANCE PAY (CRSC factors) ===
  'JEA': { code: 'JEA', meaning: 'Disability, Severance Pay', category: 'Disability', vaImpact: 'Eligible', crscRelevant: false },
  'JEB': { code: 'JEB', meaning: 'Disability, Severance Pay (Combat-Related)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: true },
  'JEC': { code: 'JEC', meaning: 'Disability, Severance Pay (Non-Combat)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: false },
  'JED': { code: 'JED', meaning: 'Disability, Severance Pay (Enhanced Combat)', category: 'Disability', vaImpact: 'Eligible', crscRelevant: true },
  'JEF': { code: 'JEF', meaning: 'Disability, Existed Prior to Service (EPTS)', category: 'Disability', vaImpact: 'Not Eligible', nonCompensable: true },
  'JEN': { code: 'JEN', meaning: 'Disability, Not in Line of Duty', category: 'Disability', vaImpact: 'Not Eligible', nonCompensable: true },
  
  // === MEDICAL SEPARATION (Non-Retirement) ===
  'JFV': { code: 'JFV', meaning: 'Physical Standards (Medical Separation)', category: 'Medical', vaImpact: 'Eligible' },
  'JFW': { code: 'JFW', meaning: 'Medical Board (Non-Duty)', category: 'Medical', vaImpact: 'Eligible' },
  'JFX': { code: 'JFX', meaning: 'Medical Board (Duty-Related)', category: 'Medical', vaImpact: 'Eligible', crscRelevant: true },
  'JFL': { code: 'JFL', meaning: 'Physical Disability (Non-Duty)', category: 'Medical', vaImpact: 'Eligible' },
  'JFM': { code: 'JFM', meaning: 'Physical Disability (Duty-Related)', category: 'Medical', vaImpact: 'Eligible', crscRelevant: true },
  'JFH': { code: 'JFH', meaning: 'Disability Discharge (Temporary)', category: 'Medical', vaImpact: 'Eligible' },
  
  // === ADMINISTRATIVE SEPARATIONS ===
  'JFF': { code: 'JFF', meaning: 'Secretarial Authority', category: 'Administrative', vaImpact: 'Varies' },
  'JND': { code: 'JND', meaning: 'Miscellaneous/General Reasons', category: 'Administrative', vaImpact: 'Varies' },
  'JNC': { code: 'JNC', meaning: 'Reduction in Force', category: 'Administrative', vaImpact: 'Varies' },
  'JNF': { code: 'JNF', meaning: 'Early Release - School', category: 'Administrative', vaImpact: 'Varies' },
  'JNE': { code: 'JNE', meaning: 'Early Release - Civilian Job', category: 'Administrative', vaImpact: 'Varies' },
  'JNP': { code: 'JNP', meaning: 'Early Release - Seasonal Employment', category: 'Administrative', vaImpact: 'Varies' },
  'JNR': { code: 'JNR', meaning: 'Early Release - Insufficient Retainability', category: 'Administrative', vaImpact: 'Varies' },
  'JNS': { code: 'JNS', meaning: 'Early Release - Pregnancy', category: 'Administrative', vaImpact: 'Varies' },
  'JNT': { code: 'JNT', meaning: 'Early Release - Hardship', category: 'Administrative', vaImpact: 'Varies' },
  'JNU': { code: 'JNU', meaning: 'Early Release - Dependency', category: 'Administrative', vaImpact: 'Varies' },
  'JNY': { code: 'JNY', meaning: 'Early Release - Parenthood', category: 'Administrative', vaImpact: 'Varies' },
  'JKA': { code: 'JKA', meaning: 'Misconduct (Pattern)', category: 'Misconduct', vaImpact: 'Restricted', misconduct: true },
  'JKB': { code: 'JKB', meaning: 'Misconduct (Drug Abuse)', category: 'Misconduct', vaImpact: 'Restricted', misconduct: true },
  'LBK': { code: 'LBK', meaning: 'Expiration Term of Service', category: 'Administrative', vaImpact: 'Varies' },
  'JKQ': { code: 'JKQ', meaning: 'Misconduct (Serious Offense)', category: 'Misconduct', vaImpact: 'Restricted', misconduct: true },
  'JKC': { code: 'JKC', meaning: 'Misconduct (Commission of a Serious Offense)', category: 'Misconduct', vaImpact: 'Restricted', misconduct: true },
  'JKE': { code: 'JKE', meaning: 'Misconduct (Civil Conviction)', category: 'Misconduct', vaImpact: 'Restricted', misconduct: true },
  'JKN': { code: 'JKN', meaning: 'Misconduct (Minor Infractions)', category: 'Misconduct', vaImpact: 'Possible', misconduct: true },
  
  // === PERFORMANCE / FAILURE CODES ===
  'JHJ': { code: 'JHJ', meaning: 'Unsatisfactory Performance', category: 'Performance', vaImpact: 'Varies' },
  'JHF': { code: 'JHF', meaning: 'Failure to Meet Minimum Standards', category: 'Performance', vaImpact: 'Varies' },
  'JHK': { code: 'JHK', meaning: 'Failure to Maintain Weight Standards', category: 'Performance', vaImpact: 'Varies' },
  'JCR': { code: 'JCR', meaning: 'Failure to Complete Course of Instruction', category: 'Performance', vaImpact: 'Varies' },
  'JDA': { code: 'JDA', meaning: 'Failure to Adapt', category: 'Performance', vaImpact: 'Varies' },
  
  // === ENTRY-LEVEL & TRAINING CODES ===
  'JGA': { code: 'JGA', meaning: 'Entry-Level Performance & Conduct', category: 'Entry-Level', vaImpact: 'Varies' },
  'JGB': { code: 'JGB', meaning: 'Entry-Level Medical Condition', category: 'Entry-Level', vaImpact: 'Varies' },
  'JFC': { code: 'JFC', meaning: 'Entry-Level Physical Standards', category: 'Entry-Level', vaImpact: 'Varies' },
  'JFT': { code: 'JFT', meaning: 'Failure to Complete Training', category: 'Entry-Level', vaImpact: 'Varies' },
  
  // === RETIREMENT CODES (Non-Medical) ===
  'RBD': { code: 'RBD', meaning: 'Sufficient Service for Retirement', category: 'Retirement', vaImpact: 'Varies' },
  'RBE': { code: 'RBE', meaning: 'Early Retirement', category: 'Retirement', vaImpact: 'Varies' },
  'RBF': { code: 'RBF', meaning: 'Temporary Early Retirement Authority (TERA)', category: 'Retirement', vaImpact: 'Varies' },
  'RCC': { code: 'RCC', meaning: 'Mandatory Retirement - Age', category: 'Retirement', vaImpact: 'Varies' },
  'RCD': { code: 'RCD', meaning: 'Mandatory Retirement - Service Limits', category: 'Retirement', vaImpact: 'Varies' },
  
  // === SPECIAL HANDLING CODES ===
  'JCC': { code: 'JCC', meaning: 'Conscientious Objector', category: 'Special', vaImpact: 'Varies' },
  'JDG': { code: 'JDG', meaning: 'Alcohol Rehabilitation Failure', category: 'Special', vaImpact: 'Restricted' },
  'JDP': { code: 'JDP', meaning: 'Drug Rehabilitation Failure', category: 'Special', vaImpact: 'Restricted' },
  'JDT': { code: 'JDT', meaning: 'Security Reasons', category: 'Special', vaImpact: 'Varies' },
  'JEX': { code: 'JEX', meaning: 'Failure to Meet Commissioning Standards', category: 'Special', vaImpact: 'Varies' },
  'JGH': { code: 'JGH', meaning: 'Pregnancy-Related Separation', category: 'Special', vaImpact: 'Varies' },
  
  // === LEGACY/OTHER CODES ===
  'HRP': { code: 'HRP', meaning: 'High Year Tenure / Reduction in Force', category: 'Administrative', vaImpact: 'Varies' },
});

// RE (Reenlistment Eligibility) codes - DoD standard
const RE_CODE_NORMALIZATIONS = Object.freeze({
  '1': { code: '1', meaning: 'Eligible for reenlistment', category: 'Eligible' },
  '1A': { code: '1A', meaning: 'Eligible for reenlistment with waiver consideration', category: 'Eligible' },
  '2': { code: '2', meaning: 'Not eligible for reenlistment due to unsuitability', category: 'Not Eligible' },
  '2B': { code: '2B', meaning: 'Not eligible due to unsuitability - need determination', category: 'Not Eligible' },
  '3': { code: '3', meaning: 'Eligible for reenlistment with waiver consideration', category: 'Eligible' },
  '3A': { code: '3A', meaning: 'Not eligible - in rehabilitation program', category: 'Not Eligible' },
  '4': { code: '4', meaning: 'Not eligible for reenlistment', category: 'Not Eligible' },
  '4A': { code: '4A', meaning: 'Not eligible - temporary', category: 'Not Eligible' },
  '5': { code: '5', meaning: 'Insufficient time on station', category: 'Not Eligible' },
  '6': { code: '6', meaning: 'Eligible in future', category: 'Eligible' },
  'RA': { code: 'RA', meaning: 'Not eligible - requires Army determination', category: 'Not Eligible' },
  'RE-1': { code: 'RE-1', meaning: 'Eligible for reenlistment', category: 'Eligible' },
  'RE-2': { code: 'RE-2', meaning: 'Not eligible due to unsuitability', category: 'Not Eligible' },
  'RE-3': { code: 'RE-3', meaning: 'Eligible with waiver', category: 'Eligible' },
  'RE-4': { code: 'RE-4', meaning: 'Not eligible for reenlistment', category: 'Not Eligible' },
});

const SEPARATION_AUTHORITY_PATTERNS = Object.freeze([
  /AR\s*635[-–]?200/i, // Army
  /AFI\s*36[-–]?3208/i, // Air Force
  /MILPERSMAN\s*\d{4}-\d{3}/i, // Navy
  /MCO\s*1900\.\d+[A-Z]?/i, // Marines
  /NAVMILPERSMAN/i, // Navy personnel manual
  /COMDTINST\s*\d{4}\.\d+/i, // Coast Guard
  /CG\s*NOTICE\s*\d+/i, // Coast Guard notice
]);

const DISABILITY_RETIREMENT_INDICATORS = Object.freeze([
  /DISABILITY\s+(?:RETIREMENT|DISCHARGE)/i,
  /AR\s*635[-–]?40/i, // Army disability retirement reg
  /SEJ|SEK|SFJ|SFK|SFX|JEA|JEB|JEC|JED|JEF|JEN|JFV|JFW|JFX|JFL|JFM/i, // All SPD disability codes
  /PERMANENT\s+DISABILITY|TEMPORARY\s+DISABILITY/i,
  /TDRL|PDRL/i, // Temporary/Permanent Disability Retired List
]);

const NOISE_BLOCK_PATTERNS = Object.freeze([
  /SIGNATURE\s+BLOCK|CERTIFY|OFFICIAL\s+COPY/i,
  /CONTINUATION\s+SHEET|PAGE\s+\d+/i,
  /SGLI|SURVIVORS\s+BENEFITS|GRAVESTONE/i,
  /BLOCK\s*\d+|INSTRUCTIONS|NOT\s+TO\s+BE\s+USED/i,
  /DD\s*FORM|CERTIFICATE\s+OF/i,
]);

// ============================================================================
// SEMANTIC ANCHORS FOR DISCHARGE BLOCKS
// ============================================================================

const DISCHARGE_SEMANTIC_ANCHORS = {
  characterOfService: [
    /\b24\.\s*(?:CHARACTER\s+OF\s+SERVICE|CHAR\s+OF\s+SVC)\b/i,
    /\bCHARACTER\s+OF\s+SERVICE\b/i,
    /\b(?:HONORABLE|GENERAL|OTHER\s+THAN\s+HONORABLE|BAD\s+CONDUCT|DISHONORABLE)\b/i,
  ],
  typeOfSeparation: [
    /\b23\.\s*(?:TYPE\s+OF\s+SEPARATION|SEP\s+TYPE)\b/i,
    /\bTYPE\s+OF\s+SEPARATION\b/i,
    /\b(?:RETIREMENT|RELEASE\s+FROM\s+ACTIVE\s+DUTY|DISCHARGE|DEMOBILIZATION|TRANSFER)\b/i,
  ],
  separationAuthority: [
    /\b25\.\s*(?:SEPARATION\s+AUTHORITY|SEP\s+AUTHORITY)\b/i,
    /\bSEPARATION\s+AUTHORITY\b/i,
    /AR\s*635|AFI\s*36|MILPERSMAN|MCO|COMDTINST|CG\s+NOTICE/i,
  ],
  separationCode: [
    /\b26\.\s*(?:SEPARATION\s+CODE|SPD\s+CODE)\b/i,
    /\b(?:SEPARATION\s+CODE|SPD\s+CODE)\b/i,
    /\b[A-Z]{2,4}\d?(?:\s+|$)/i, // Generic code pattern
  ],
  reentryCode: [
    /\b27\.\s*(?:(?:RE|REENTRY)\s+CODE|RE[-–]?\s*CODE)\b/i,
    /\b(?:RE(?:ENTRY)?\s+CODE|RE[-–]\d|REENLIST)\b/i,
    /\b(?:RE[-–]?[1-6]|RA|[1-6][A-Z]?)\b/i,
  ],
  narrativeReasonForSeparation: [
    /\b28\.\s*(?:NARRATIVE\s+REASON|REASON\s+FOR\s+SEP)\b/i,
    /\bNARRATIVE\s+REASON\s+FOR\s+SEPARATION\b/i,
  ],
  timeLost: [
    /\b29\.\s*(?:TIME\s+LOST|TOTAL\s+TIME\s+LOST)\b/i,
    /\bTIME\s+LOST\b/i,
    /\b(?:MONTHS?|DAYS?)\s+(?:UNAUTHORIZED\s+ABSENCE|AWOL|CONFINEMENT)\b/i,
  ],
};

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

function normalizeText(text) {
  if (!text) return null;
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function isNoise(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  
  for (const pattern of NOISE_BLOCK_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  
  return normalized.length < 2;
}

function extractWithAnchor(text, anchorPatterns, fallbackBlockKey) {
  if (!text) return null;
  
  const textNorm = normalizeText(text);
  
  // Try semantic anchors first
  for (const pattern of anchorPatterns) {
    const match = textNorm.match(pattern);
    if (match) {
      // Look for the value after the label
      const afterLabel = text.substring(text.indexOf(match[0]) + match[0].length);
      const valueMatch = afterLabel.match(/^[:\s-]*([^\n]+?)(?:\n|$)/);
      if (valueMatch) {
        const value = normalizeText(valueMatch[1]);
        if (value && !isNoise(value)) {
          return { value, source: 'semantic', confidence: 0.95 };
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract character of service (Block 24) with normalization
 */
function extractCharacterOfService(blocks) {
  const block24 = blocks?.['24'];
  if (!block24) return null;
  
  const normalized = normalizeText(block24);
  
  // Check keys in order of specificity (longest first to avoid substring matches)
  const sortedKeys = Object.keys(CHARACTER_OF_SERVICE_VOCAB).sort((a, b) => b.length - a.length);
  const vocab = sortedKeys.find(key => normalized.includes(key));
  
  return vocab ? CHARACTER_OF_SERVICE_VOCAB[vocab] : null;
}

/**
 * Extract type of separation (Block 23) with normalization
 */
function extractTypeOfSeparation(blocks) {
  const block23 = blocks?.['23'];
  if (!block23) return null;
  
  const normalized = normalizeText(block23);
  const vocab = Object.keys(TYPE_OF_SEPARATION_VOCAB).find(key =>
    normalized.includes(key)
  );
  
  return vocab ? TYPE_OF_SEPARATION_VOCAB[vocab] : null;
}

/**
 * Extract separation authority (Block 25) with validation
 */
function extractSeparationAuthority(blocks) {
  const block25 = blocks?.['25'];
  if (!block25) return null;
  
  const normalized = normalizeText(block25);
  if (isNoise(normalized)) return null;
  
  // Validate against known authority patterns
  for (const pattern of SEPARATION_AUTHORITY_PATTERNS) {
    if (pattern.test(normalized)) {
      return normalized;
    }
  }
  
  // Return raw if it looks like an authority code
  if (/^(?:AR|AFI|MILPERSMAN|MCO|NAVMILPERSMAN|COMDTINST|CG)\s*[\d\-.\w]+/i.test(normalized)) {
    return normalized;
  }
  
  return null;
}

/**
 * Extract separation code / SPD code (Block 26) with normalization
 */
function extractSeparationCode(blocks) {
  const block26 = blocks?.['26'];
  if (!block26) return null;
  
  const normalized = normalizeText(block26).trim();
  if (isNoise(normalized) || normalized.length > 10) return null;
  
  // Try to find matching SPD code
  const codeMatch = normalized.match(/\b([A-Z]{2,4}\d?)\b/);
  if (codeMatch) {
    const code = codeMatch[1];
    const spdDef = SPD_CODE_NORMALIZATIONS[code];
    if (spdDef) {
      return {
        code: spdDef.code,
        meaning: spdDef.meaning,
        category: spdDef.category,
      };
    }
  }
  
  return {
    code: normalized,
    meaning: 'Unknown/Custom SPD Code',
    category: 'Unknown',
  };
}

/**
 * Extract reentry code / RE code (Block 27) with normalization
 */
function extractReentryCode(blocks) {
  const block27 = blocks?.['27'];
  if (!block27) return null;
  
  const normalized = normalizeText(block27).trim();
  // Allow single-digit RE codes (1-6) and short codes like RA, but filter other noise
  if (normalized.length > 5) return null;
  if (normalized.length === 1 && !/^[1-6]$/.test(normalized)) return null;
  if (normalized.length > 1 && isNoise(normalized)) return null;
  
  // Try exact match first (case-insensitive)
  const exactMatch = Object.keys(RE_CODE_NORMALIZATIONS).find(
    key => key.toUpperCase() === normalized
  );
  if (exactMatch) {
    const reDef = RE_CODE_NORMALIZATIONS[exactMatch];
    return {
      code: reDef.code,
      meaning: reDef.meaning,
      category: reDef.category,
    };
  }
  
  // Try to match RE code variants
  const codeMatch = normalized.match(/^(RE[-–]?\d|[1-6][A-Z]?|RA)$/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase().replace(/–/, '-');
    const reDef = RE_CODE_NORMALIZATIONS[code];
    if (reDef) {
      return {
        code: reDef.code,
        meaning: reDef.meaning,
        category: reDef.category,
      };
    }
  }
  
  return {
    code: normalized,
    meaning: 'Unknown/Custom RE Code',
    category: 'Unknown',
  };
}

/**
 * Extract narrative reason for separation (Block 28)
 */
function extractNarrativeReasonForSeparation(blocks, continuation) {
  const block28 = blocks?.['28'];
  if (!block28) return null;
  
  let narrative = normalizeText(block28);
  
  // Check for continuation in Block 18
  if (Array.isArray(continuation?.['18']) && continuation['18'].length > 0) {
    const block18 = continuation['18'].join(' ');
    const narrativeSection = block18.match(/28\.\s*([^\n]+(?:\n[^\n]+)*?)(?:\n\s*29\.|$)/i);
    if (narrativeSection) {
      narrative = normalizeText(narrativeSection[1]);
    }
  }
  
  if (isNoise(narrative) || narrative.length < 3) return null;
  
  return narrative;
}

/**
 * Extract time lost (Block 29)
 */
function extractTimeLost(blocks) {
  const block29 = blocks?.['29'];
  if (!block29) return null;
  
  const normalized = normalizeText(block29);
  if (isNoise(normalized)) return null;
  
  // Parse format like "0 years 5 months 10 days"
  return normalized;
}

/**
 * Detect disability retirement from SPD code and narrative
 */
function detectDisabilityRetirement(spdCode, narrative, blocks) {
  if (!spdCode && !narrative && !blocks) return false;
  
  // Check SPD code
  if (spdCode?.code && /^(?:SEJ|SEK|SFJ|SFK|SFX|JEA|JEB|JEC|JED|JEF|JEN|JFV|JFW|JFX|JFL|JFM|JFH)$/.test(spdCode.code)) {
    return true;
  }
  
  // Check narrative
  if (narrative) {
    for (const pattern of DISABILITY_RETIREMENT_INDICATORS) {
      if (pattern.test(narrative)) return true;
    }
  }
  
  // Check separation authority for AR 635-40
  const authority = blocks?.['25'];
  if (authority && /AR\s*635[-–]?40/i.test(authority)) {
    return true;
  }
  
  return false;
}

/**
 * Extract mailing address after separation (Block 19a)
 */
function extractMailingAddressAfterSeparation(blocks) {
  const block19a = blocks?.['19a'];
  if (!block19a) return null;
  
  const normalized = normalizeText(block19a);
  if (isNoise(normalized)) return null;
  
  return normalized;
}

/**
 * Extract nearest relative (Block 19b)
 */
function extractNearestRelative(blocks) {
  const block19b = blocks?.['19b'];
  if (!block19b) return null;
  
  const normalized = normalizeText(block19b);
  if (isNoise(normalized)) return null;
  
  return normalized;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export function extractDischargeAndSeparationFields(blocks, continuation) {
  if (!blocks) blocks = {};
  if (!continuation) continuation = {};
  
  const spdCode = extractSeparationCode(blocks);
  const narrative = extractNarrativeReasonForSeparation(blocks, continuation);
  
  return Object.freeze({
    characterOfService: extractCharacterOfService(blocks),
    typeOfSeparation: extractTypeOfSeparation(blocks),
    separationAuthority: extractSeparationAuthority(blocks),
    separationCode: spdCode,
    reentryCode: extractReentryCode(blocks),
    narrativeReasonForSeparation: narrative,
    timeLost: extractTimeLost(blocks),
    disabilityRetirement: detectDisabilityRetirement(spdCode, narrative, blocks),
    disabilityType: spdCode?.category === 'Disability' ? 'Military Service-Connected Disability' : null,
    disabilityCategory: spdCode?.code ? (
      /^(?:SEJ|SFX|JEB|JED)$/.test(spdCode.code) ? 'Enhanced Disability' : null
    ) : null,
    effectiveDateOfPayGrade: blocks?.['12i'] || null,
    postServiceComponent: blocks?.['9'] || null,
    sgliCoverageAmount: blocks?.['10'] || null,
    vaCopyRequests: {
      stateVA: /STATE VA|STATE VETERANS/i.test(blocks?.['20'] || ''),
      centralVA: /CENTRAL VA|DVA|DEPARTMENT OF VETERANS/i.test(blocks?.['20'] || ''),
    },
    mailingAddressAfterSeparation: extractMailingAddressAfterSeparation(blocks),
    nearestRelative: extractNearestRelative(blocks),
  });
}

// Export for testing
export {
  extractCharacterOfService,
  extractTypeOfSeparation,
  extractSeparationAuthority,
  extractSeparationCode,
  extractReentryCode,
  extractNarrativeReasonForSeparation,
  extractTimeLost,
  detectDisabilityRetirement,
  extractMailingAddressAfterSeparation,
  extractNearestRelative,
  SPD_CODE_NORMALIZATIONS,
  RE_CODE_NORMALIZATIONS,
};
