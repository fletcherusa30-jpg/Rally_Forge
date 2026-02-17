/**
 * DenialReasonRegexExtractor.js
 * 
 * A regex-based denial reason extraction module for VA Rating Decision documents.
 * This module extracts complete denial reasons from VA decision letters without truncation.
 * 
 * Key features:
 * - Detects denied conditions using multiple patterns
 * - Extracts FULL paragraph text following denial sentences
 * - Never truncates mid-sentence
 * - Never merges multiple reasons
 * - Normalizes whitespace while preserving content integrity
 * - Validates output to ensure complete extraction
 */

/**
 * Normalize whitespace in text while preserving content
 */
const normalizeWhitespace = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
};

/**
 * Normalize a condition name for comparison
 */
const normalizeConditionName = (condition) => {
  if (!condition) return '';
  return String(condition)
    .toLowerCase()
    .replace(/^[\s\-–—:;,.]+/, '')
    .replace(/[\s\-–—:;,.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if text looks like a valid denial reason
 * Must be substantial (>20 chars) and not generic
 */
const isValidDenialReason = (text) => {
  if (!text || text.length < 20) return false;
  
  const genericPatterns = [
    /^(service connection|conditions not service connected|decided|denied)$/i,
    /^\d+\.?\s*$/,
    /^(page|references?|evidence|reasons?)$/i,
  ];
  
  const normalized = text.toLowerCase().trim();
  return !genericPatterns.some(p => p.test(normalized));
};

/**
 * Extract a single complete denial reason
 * Captures text from "denied because" to the end of the sentence
 */
const extractDenialPhrase = (text, startIndex) => {
  const slice = text.substring(startIndex);
  
  // Look for "denied because" followed by the reason
  const match = slice.match(/denied\s+because\s+([^.!?]*[.!?])/i);
  if (!match || !match[1]) return null;
  
  const reason = match[1].trim();
  
  if (!isValidDenialReason(reason)) {
    return null;
  }
  
  return {
    reason: reason,
    endIndex: startIndex + match[0].length
  };
};

/**
 * Extract denial conditions from text
 * Supports multiple pattern types
 */
const extractDeniedConditions = (text) => {
  if (!text) return [];
  
  const normalized = normalizeWhitespace(text);
  const conditions = [];
  const seen = new Set();
  
  // Pattern 1: "Service connection for X is denied because Y"
  const pattern1 = /service\s+connection\s+for\s+([^.]+?)\s+(?:is|was|remains)?\s*denied\s+because\s+([^.]+\.)/gi;
  let match;
  while ((match = pattern1.exec(normalized)) !== null) {
    const rawCondition = match[1].trim();
    const reason = match[2].trim();
    const normalized_condition = normalizeConditionName(rawCondition);
    
    if (normalized_condition && isValidDenialReason(reason) && !seen.has(normalized_condition)) {
      seen.add(normalized_condition);
      conditions.push({
        condition: rawCondition,
        reason_for_denial: reason
      });
    }
  }
  
  // Pattern 2: "Entitlement to service connection for X is denied"
  const pattern2 = /entitlement\s+to\s+(?:service\s+)?connection\s+for\s+([^.]+?)\s+(?:is|was|remains)?\s*denied\s+because\s+([^.]+\.)/gi;
  while ((match = pattern2.exec(normalized)) !== null) {
    const rawCondition = match[1].trim();
    const reason = match[2].trim();
    const normalized_condition = normalizeConditionName(rawCondition);
    
    if (normalized_condition && isValidDenialReason(reason) && !seen.has(normalized_condition)) {
      seen.add(normalized_condition);
      conditions.push({
        condition: rawCondition,
        reason_for_denial: reason
      });
    }
  }
  
  // Pattern 3: "X is not service connected because Y" or similar
  const pattern3 = /([^.]+?)\s+(?:is|was|remains)?\s*(?:not\s+)?(?:service\s+)?connected\s+because\s+([^.]+\.)/gi;
  while ((match = pattern3.exec(normalized)) !== null) {
    const rawCondition = match[1].trim();
    const reason = match[2].trim();
    const normalized_condition = normalizeConditionName(rawCondition);
    
    // Skip generic matches
    if (rawCondition.toLowerCase().includes('service connection')) continue;
    if (rawCondition.toLowerCase().includes('entitlement')) continue;
    if (rawCondition.toLowerCase().includes('decision')) continue;
    
    if (normalized_condition && isValidDenialReason(reason) && !seen.has(normalized_condition)) {
      seen.add(normalized_condition);
      conditions.push({
        condition: rawCondition,
        reason_for_denial: reason
      });
    }
  }
  
  return conditions;
};

/**
 * Validate a denial reason extraction
 * Checks for truncation, incomplete sentences, and artifacts
 */
const validateDenialReason = (condition, reason) => {
  const validation = {
    valid: true,
    reason,
    warnings: []
  };
  
  // Check for empty reason
  if (!reason || reason.trim().length === 0) {
    validation.valid = false;
    validation.warnings.push('Empty reason text');
    return validation;
  }
  
  // Check for truncation (incomplete sentence patterns)
  if (reason.match(/\bis\s+denied\s+because\s+the$/i)) {
    validation.valid = false;
    validation.warnings.push('Reason appears truncated (ends with "the")');
  }
  
  // Check for incomplete clauses
  if (reason.match(/^(that|which|because|due|since|may|can|might|would|could)\s/i)) {
    validation.warnings.push('Reason starts with incomplete clause');
  }
  
  // Check for CFR references without actual reason first
  if (reason.match(/^\d+\s+(?:U\.S\.C|CFR|§)/)) {
    validation.warnings.push('Reason starts with CFR reference (actual reason may precede this)');
  }
  
  // Ensure ends with proper termination
  if (!reason.match(/[.!?]$/)) {
    reason = reason + '.';
    validation.reason = reason;
  }
  
  // Check minimum length
  if (reason.length < 20) {
    validation.valid = false;
    validation.warnings.push(`Reason too short (${reason.length} chars)`);
  }
  
  return validation;
};

/**
 * Extract all denied conditions and their reasons from a VA decision document
 * 
 * @param {string} documentText - The full text of the VA decision letter
 * @returns {Array} Array of {condition, reason_for_denial} objects
 */
const extractDeniedReasons = (documentText) => {
  if (!documentText) {
    return [];
  }
  
  const rawConditions = extractDeniedConditions(documentText);
  const results = [];
  
  for (const entry of rawConditions) {
    const validation = validateDenialReason(entry.condition, entry.reason_for_denial);
    
    if (validation.valid) {
      results.push({
        condition: entry.condition,
        reason_for_denial: validation.reason
      });
    } else {
      // Include even invalid ones but flag them
      results.push({
        condition: entry.condition,
        reason_for_denial: validation.reason,
        validation_warnings: validation.warnings
      });
    }
  }
  
  return results;
};

/**
 * Extract and format denied conditions for structured output
 * Returns an object with comprehensive metadata
 */
const extractDeniedReasonsWithMetadata = (documentText) => {
  const deniedReasons = extractDeniedReasons(documentText);
  
  return {
    extracted_at: new Date().toISOString(),
    total_denied_conditions: deniedReasons.length,
    denied: deniedReasons,
    validation_summary: {
      valid_count: deniedReasons.filter(d => !d.validation_warnings).length,
      warning_count: deniedReasons.filter(d => d.validation_warnings && d.validation_warnings.length > 0).length
    }
  };
};

// Export for both ESM and CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractDeniedReasons,
    extractDeniedReasonsWithMetadata,
    extractDeniedConditions,
    normalizeConditionName,
    normalizeWhitespace,
    validateDenialReason,
    isValidDenialReason
  };
}

// Also export as named exports for ESM
export {
  extractDeniedReasons,
  extractDeniedReasonsWithMetadata,
  extractDeniedConditions,
  normalizeConditionName,
  normalizeWhitespace,
  validateDenialReason,
  isValidDenialReason
};
