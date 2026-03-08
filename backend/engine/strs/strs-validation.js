/**
 * STRS Scanner - Advanced Validation Module
 * Negation Detection • Laterality • Severity • Confidence Scoring
 * 
 * @module strs-validation
 * @version 2.0.0
 */

// ═══════════════════════════════════════════════════════════════
// NEGATION DETECTION
// ═══════════════════════════════════════════════════════════════

export const NEGATION_PATTERNS = {
  // Medical negations
  explicit: [
    'no', 'not', 'denies', 'denied', 'negative for', 'absent',
    'without', 'free of', 'no evidence of', 'no signs of',
    'no symptoms of', 'rules out', 'r/o', 'rule out', 'ruled out',
    'refutes', 'rejects', 'disagrees with', 'never had',
    'no documented', 'not found', 'not present', 'no history of',
    'family history of',
    'screening negative', 'negative screen', 'negative result',
    'does not have', 'did not have', 'non-contributory',
    'unremarkable', 'within normal limits', 'wnl', 'normal',
    'to exclude', 'excluding', 'not consistent with',
    'no active', 'no current', 'no ongoing', 'no new'
  ],
  
  // Quantitative negations (numeric zero counts from screening/assessments)
  quantitative: [
    /\b0\s+(?:occurrences?|episodes?|events?|incidents?)\b/i,
    /\bnumber of .+\?\s*0\b/i,  // Catches "number of mTBI/Concussive occurrences? 0"
    /\boccurrences?\?\s*0\b/i,  // Catches "occurrences? 0"
    /\bno\s+(?:occurrences?|episodes?|events?|incidents?)\b/i,
    /\bnone\s+(?:reported|documented|noted|found)\b/i,
    /\b(?:occurrences?|episodes?|events?):\s*0\b/i,
    /\b(?:reviewed|screened|assessed).{0,100}(?:presence|history).{0,100}\?\s*0\b/i,  // Health assessment screening format
    /\bno\s+documented\s+(?:TBI|concussion|mTBI|events?|incidents?)\b/i
  ],
  
  // Screening/Assessment context (not a diagnosis, just being checked)
  screening: [
    /\bscreen(?:ing|ed)?\s+for\b/i,
    /\bassess(?:ing|ed|ment)?\s+for\b/i,
    /\bevaluat(?:ing|ed|ion)\s+for\b/i,
    /\bcheck(?:ing|ed)?\s+for\b/i,
    /\bmonitor(?:ing|ed)?\s+for\b/i,
    /\brule\s+out\b/i,
    /\br\/o\b/i,
    /\bto\s+exclude\b/i,
    /\bdifferential(?:\s+diagnosis)?\b/i
  ],

  // Non-diagnostic reference/lab disclaimer context
  // Example: "False positives can occur in patients with ... lupus"
  nonDiagnostic: [
    /\bfalse\s+positives?\s+can\s+occur\b/i,
    /\bfalse\s+negatives?\s+can\s+occur\b/i,
    /\bcan\s+occur\s+in\s+patients\s+with\b/i,
    /\btest\s+limitations?\b/i,
    /\blimitations\s+of\s+this\s+test\b/i,
    /\breference\s+range\b/i,
    /\bfor\s+reference\s+only\b/i,
    /\blab(?:oratory)?\s+interpretation\b/i,
    // Military/provider signature context can contain "MS" that is not Multiple Sclerosis.
    /\b(?:COL|CPT|MAJ|LT|LTC|BG|MG|GEN|SGT|SSG|SFC|MSG|1SG)\s*,\s*MS\b/i,
    /\bSigned\s+By\b/i,
    /\bChief\s+Optometry\b/i
  ],
  
  // Resolved conditions (past, no longer active)
  resolved: [
    'resolved', 'recovered', 'healed', 'no longer',
    'previously had', 'history of', 'past', 'former',
    'prior', 'old', 'resolved with treatment', 'fully recovered'
  ],
  
  // Uncertain/differential diagnosis
  uncertain: [
    'possible', 'probable', 'suspected', 'question',
    'rule out', 'r/o', 'differential', 'consider',
    'evaluate for', 'assess for', 'query', 'questionable',
    'uncertain', 'unclear', 'to be determined', 'may have',
    'could be', 'might be', 'suggestive of', 'consistent with'
  ]
};

/**
 * Analyze negation in context around a medical term
 * @param {string} context - Text surrounding the match
 * @param {number} matchPosition - Position of match in context
 * @returns {Object} Negation analysis with confidence
 */
export function analyzeNegation(context, matchPosition) {
  const beforeMatch = context.substring(0, matchPosition);
  const afterMatch = context.substring(matchPosition);
  const window = beforeMatch.slice(-150); // Check 150 chars before match (increased from 100)
  const afterWindow = afterMatch.slice(0, 200); // Check 200 chars after match (increased from 150)
  
  // Check for quantitative negations (e.g., "0 occurrences", "number of TBI? 0")
  // These are HIGHEST priority as they're most definitive
  for (const quantPattern of NEGATION_PATTERNS.quantitative) {
    if (quantPattern.test(window) || quantPattern.test(afterWindow)) {
      const trigger = (window.match(quantPattern) || afterWindow.match(quantPattern))?.[0];
      return {
        isNegated: true,
        type: 'quantitative',
        trigger: trigger || 'zero count',
        confidence: 'very_high',
        note: 'Quantified as zero occurrences - definitive absence',
        windowChecked: window + ' [MATCH] ' + afterWindow
      };
    }
  }
  
  // Check for screening/assessment context (very high priority - not a diagnosis)
  for (const screenPattern of NEGATION_PATTERNS.screening) {
    if (screenPattern.test(window) || screenPattern.test(afterWindow)) {
      const trigger = (window.match(screenPattern) || afterWindow.match(screenPattern))?.[0];
      return {
        isNegated: true,
        type: 'screening',
        trigger: trigger || 'screening context',
        confidence: 'very_high',
        note: 'Screening/assessment context - not diagnosed, just being evaluated',
        windowChecked: window + ' [MATCH] ' + afterWindow
      };
    }
  }

  // Check for non-diagnostic reference/lab contexts
  for (const refPattern of NEGATION_PATTERNS.nonDiagnostic) {
    if (refPattern.test(window) || refPattern.test(afterWindow)) {
      const trigger = (window.match(refPattern) || afterWindow.match(refPattern))?.[0];
      return {
        isNegated: true,
        type: 'non_diagnostic_reference',
        trigger: trigger || 'reference context',
        confidence: 'very_high',
        note: 'Reference/lab disclaimer context - not a patient diagnosis',
        windowChecked: window + ' [MATCH] ' + afterWindow
      };
    }
  }
  
  // Check for explicit negations (high priority)
  for (const neg of NEGATION_PATTERNS.explicit) {
    const negRegex = new RegExp(`\\b${neg}\\b`, 'i');
    if (negRegex.test(window) || negRegex.test(afterWindow)) {
      return {
        isNegated: true,
        type: 'explicit',
        trigger: neg,
        confidence: 'high',
        note: 'Explicitly negated - condition not present',
        windowChecked: window + ' [MATCH] ' + afterWindow
      };
    }
  }
  
  // Check for resolved conditions (medium priority)
  for (const res of NEGATION_PATTERNS.resolved) {
    const resRegex = new RegExp(`\\b${res}\\b`, 'i');
    if (resRegex.test(window)) {
      return {
        isNegated: true,
        type: 'resolved',
        trigger: res,
        confidence: 'medium',
        note: 'Past condition, no longer active',
        windowChecked: window
      };
    }
  }
  
  // Check for uncertain/differential (lower confidence)
  for (const unc of NEGATION_PATTERNS.uncertain) {
    const uncRegex = new RegExp(`\\b${unc}\\b`, 'i');
    if (uncRegex.test(window)) {
      return {
        isNegated: false,
        type: 'uncertain',
        trigger: unc,
        confidence: 'low',
        note: 'Not confirmed diagnosis - under evaluation',
        windowChecked: window
      };
    }
  }
  
  // No negation found
  return {
    isNegated: false,
    type: 'affirmed',
    trigger: null,
    confidence: 'medium',
    windowChecked: window
  };
}


// ═══════════════════════════════════════════════════════════════
// LATERALITY EXTRACTION
// ═══════════════════════════════════════════════════════════════

export const LATERALITY_PATTERNS = {
  left: /\b(left|l\.|lt\.?|lft\.?)\s+(side|sided|lateral|hand|foot|knee|shoulder|hip|ankle|wrist|elbow|arm|leg|eye|ear)\b/gi,
  right: /\b(right|r\.|rt\.?|rgt\.?)\s+(side|sided|lateral|hand|foot|knee|shoulder|hip|ankle|wrist|elbow|arm|leg|eye|ear)\b/gi,
  bilateral: /\b(bilateral|both|bilat\.?|b\/l|b\\l)\s+(sides?|hands?|feet|knees?|shoulders?|hips?|ankles?|wrists?|elbows?|arms?|legs?|eyes?|ears?)\b/gi,
  
  // Shorthand patterns (e.g., "L knee", "R shoulder", "B/L")
  leftShort: /\b(left|l\.?)\s+(?=knee|shoulder|hip|ankle|wrist|elbow|foot|hand|arm|leg|eye|ear)/gi,
  rightShort: /\b(right|r\.?)\s+(?=knee|shoulder|hip|ankle|wrist|elbow|foot|hand|arm|leg|eye|ear)/gi
};

/**
 * Extract anatomical laterality from context
 * @param {string} context - Context around condition mention
 * @returns {Object} Laterality information
 */
export function extractLaterality(context) {
  // Check bilateral first (highest specificity)
  const bilateralMatch = context.match(LATERALITY_PATTERNS.bilateral);
  if (bilateralMatch) {
    return {
      side: 'bilateral',
      confidence: 'high',
      matchedText: bilateralMatch[0],
      evidence: bilateralMatch[0]
    };
  }
  
  // Check both left and right mentions
  const leftMatch = LATERALITY_PATTERNS.left.test(context) || LATERALITY_PATTERNS.leftShort.test(context);
  const rightMatch = LATERALITY_PATTERNS.right.test(context) || LATERALITY_PATTERNS.rightShort.test(context);
  
  if (leftMatch && rightMatch) {
    // Both mentioned = bilateral
    return {
      side: 'bilateral',
      confidence: 'medium',
      matchedText: 'both sides mentioned',
      evidence: context.substring(0, 100)
    };
  } else if (leftMatch) {
    const match = context.match(LATERALITY_PATTERNS.left) || context.match(LATERALITY_PATTERNS.leftShort);
    return {
      side: 'left',
      confidence: 'high',
      matchedText: match ? match[0] : 'left',
      evidence: match ? match[0] : 'left mentioned'
    };
  } else if (rightMatch) {
    const match = context.match(LATERALITY_PATTERNS.right) || context.match(LATERALITY_PATTERNS.rightShort);
    return {
      side: 'right',
      confidence: 'high',
      matchedText: match ? match[0] : 'right',
      evidence: match ? match[0] : 'right mentioned'
    };
  }
  
  // No laterality specified
  return {
    side: 'unspecified',
    confidence: 'low',
    matchedText: null,
    evidence: null
  };
}


// ═══════════════════════════════════════════════════════════════
// SEVERITY/GRADE EXTRACTION
// ═══════════════════════════════════════════════════════════════

export const SEVERITY_PATTERNS = {
  mild: /\b(mild|slight|minimal|minor|grade\s*[1i]|low[- ]?grade)\b/gi,
  moderate: /\b(moderate|medium|moderate[- ]?grade|grade\s*[2ii])\b/gi,
  severe: /\b(severe|serious|major|significant|marked|extreme|grade\s*[3-4iii-iv]|high[- ]?grade)\b/gi,
  
  // Quantitative pain scale (0-10)
  painScale: /\b(?:pain\s+(?:rated|scored|scale|of|at)\s*)?(\d{1,2})\s*\/\s*10\b/gi,
  painScaleAlt: /\b(?:(\d{1,2})\/10\s+pain)\b/gi,
  
  // Functional impact descriptors
  functional: {
    minimal: /\b(fully functional|no limitation|no restriction|minimal impact|independent)\b/gi,
    moderate: /\b(some limitation|partially limited|moderate restriction|reduced function)\b/gi,
    severe: /\b(unable to|cannot|severely limited|total impairment|non[- ]?functional|completely limited|bedridden)\b/gi
  }
};

/**
 * Extract severity/grade information from context
 * @param {string} context - Context around condition
 * @returns {Object} Severity assessment
 */
export function extractSeverity(context) {
  // Check pain scale first (most objective measure)
  let painMatch = context.match(SEVERITY_PATTERNS.painScale);
  if (!painMatch) {
    painMatch = context.match(SEVERITY_PATTERNS.painScaleAlt);
  }
  
  if (painMatch) {
    const scoreStr = painMatch[0].match(/\d{1,2}/)[0];
    const score = parseInt(scoreStr);
    
    if (score >= 0 && score <= 10) {
      return {
        type: 'pain_scale',
        value: score,
        maxScale: 10,
        interpretation: score >= 7 ? 'severe' : score >= 4 ? 'moderate' : 'mild',
        evidence: painMatch[0],
        confidence: 'high'
      };
    }
  }
  
  // Check explicit severity qualifiers
  if (SEVERITY_PATTERNS.severe.test(context)) {
    const match = context.match(SEVERITY_PATTERNS.severe);
    return {
      type: 'qualitative',
      value: 'severe',
      evidence: match[0],
      confidence: 'high'
    };
  } else if (SEVERITY_PATTERNS.moderate.test(context)) {
    const match = context.match(SEVERITY_PATTERNS.moderate);
    return {
      type: 'qualitative',
      value: 'moderate',
      evidence: match[0],
      confidence: 'medium'
    };
  } else if (SEVERITY_PATTERNS.mild.test(context)) {
    const match = context.match(SEVERITY_PATTERNS.mild);
    return {
      type: 'qualitative',
      value: 'mild',
      evidence: match[0],
      confidence: 'medium'
    };
  }
  
  // Check functional impact (alternative severity indicator)
  if (SEVERITY_PATTERNS.functional.severe.test(context)) {
    const match = context.match(SEVERITY_PATTERNS.functional.severe);
    return {
      type: 'functional_impact',
      value: 'severe',
      evidence: match[0],
      confidence: 'high',
      note: 'Severe functional limitation documented'
    };
  } else if (SEVERITY_PATTERNS.functional.moderate.test(context)) {
    const match = context.match(SEVERITY_PATTERNS.functional.moderate);
    return {
      type: 'functional_impact',
      value: 'moderate',
      evidence: match[0],
      confidence: 'medium'
    };
  } else if (SEVERITY_PATTERNS.functional.minimal.test(context)) {
    const match = context.match(SEVERITY_PATTERNS.functional.minimal);
    return {
      type: 'functional_impact',
      value: 'mild',
      evidence: match[0],
      confidence: 'low'
    };
  }
  
  // No severity information found
  return {
    type: 'unspecified',
    value: null,
    evidence: null,
    confidence: null
  };
}


// ═══════════════════════════════════════════════════════════════
// CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate confidence score for an extracted condition occurrence
 * @param {Object} occurrence - Single condition occurrence
 * @param {number} totalOccurrences - Total mentions of condition
 * @param {Object} additionalContext - Optional context (laterality, severity, etc.)
 * @returns {Object} Confidence assessment
 */
export function calculateConfidence(occurrence, totalOccurrences, additionalContext = {}) {
  let score = 40; // Base confidence (conservative start)
  const reasons = [];
  const warnings = [];
  
  // 1. Frequency scoring (0-25 points)
  if (totalOccurrences >= 5) {
    score += 25;
    reasons.push('5+ documented occurrences (very strong evidence)');
  } else if (totalOccurrences >= 3) {
    score += 20;
    reasons.push('3+ documented occurrences (strong evidence)');
  } else if (totalOccurrences >= 2) {
    score += 15;
    reasons.push('Multiple documented occurrences');
  } else {
    score += 5;
    reasons.push('Single occurrence');
    warnings.push('Only one mention found - verify clinical significance');
  }
  
  // 2. Negation analysis (critical - can invalidate) (-30 to +20 points)
  if (occurrence.negation) {
    if (occurrence.negation.isNegated) {
      score -= 30;
      warnings.push(`NEGATED: ${occurrence.negation.type} - ${occurrence.negation.trigger}`);
    } else if (occurrence.negation.type === 'affirmed') {
      score += 20;
      reasons.push('Explicitly affirmed diagnosis');
    } else if (occurrence.negation.type === 'uncertain') {
      score -= 15;
      warnings.push(`Uncertain diagnosis: ${occurrence.negation.trigger}`);
    }
  }
  
  // 3. Date documentation (0-15 points)
  if (occurrence.dates && occurrence.dates.length > 0) {
    score += 15;
    reasons.push(`Dated encounter(s): ${occurrence.dates.length} date(s)`);
  } else {
    warnings.push('No dates extracted - timeline unclear');
  }
  
  // 4. Severity documentation (0-10 points)
  if (additionalContext.severity && additionalContext.severity.value) {
    score += 10;
    reasons.push(`Severity documented: ${additionalContext.severity.value} (${additionalContext.severity.type})`);
  }
  
  // 5. Laterality specificity (0-5 points)
  if (additionalContext.laterality && additionalContext.laterality.side !== 'unspecified') {
    score += 5;
    reasons.push(`Laterality specified: ${additionalContext.laterality.side}`);
  }
  
  // 6. Page tracking (0-5 points)
  if (occurrence.page) {
    score += 5;
    reasons.push(`Page ${occurrence.page} documented`);
  }
  
  // 7. Context quality (manual check needed)
  if (occurrence.context && occurrence.context.length > 50) {
    score += 5;
    reasons.push('Rich context available');
  }
  
  // Cap score between 0-100
  score = Math.min(100, Math.max(0, score));
  
  // Determine confidence level
  let level;
  if (score >= 80) level = 'high';
  else if (score >= 60) level = 'medium';
  else if (score >= 40) level = 'low';
  else level = 'very_low';
  
  return {
    score,
    level,
    reasons,
    warnings,
    recommendation: score >= 60 
      ? 'Proceed with high confidence' 
      : score >= 40 
        ? 'Verify with additional evidence' 
        : 'Insufficient evidence - manual review required'
  };
}


// ═══════════════════════════════════════════════════════════════
// EXPORT ALL VALIDATORS
// ═══════════════════════════════════════════════════════════════

export default {
  analyzeNegation,
  extractLaterality,
  extractSeverity,
  calculateConfidence,
  NEGATION_PATTERNS,
  LATERALITY_PATTERNS,
  SEVERITY_PATTERNS
};
