/**
 * Denied Conditions Extraction
 * Extracts all denied conditions with reasons and evidence cited
 */

import { cleanConditionName } from './textNormalizer.js';

/**
 * Extract all denied conditions from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @returns {Array<Object>} Array of denied conditions
 */
export function extractDenied(normalizedText) {
  if (!normalizedText) return [];

  const conditions = [];
  const seen = new Set();

  // Pattern groups for comprehensive denial extraction
  const patterns = [
    // Group 1: "Service connection for [condition] is denied. [reason]"
    {
      regex: /service\s+connection\s+for\s+([^.]+?)\s+is\s+denied[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 2: "Entitlement to service connection for [condition] is denied"
    {
      regex: /entitlement\s+to\s+service\s+connection\s+for\s+([^.]+?)\s+is\s+denied[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 3: "Claim for service connection for [condition] is denied"
    {
      regex: /claim\s+for\s+service\s+connection\s+for\s+([^.]+?)\s+(?:is\s+)?denied[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 4: "[condition] is not service-connected"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s+is\s+not\s+service[-\s]connected[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 5: "[condition] - denied"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s*[-–]\s*denied[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 6: "Claim for [condition] denied"
    {
      regex: /claim\s+for\s+([^.]+?)\s+(?:is\s+)?denied[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 7: "denied: [condition]"
    {
      regex: /denied:\s*([^.\n]+)/gi,
      groups: { condition: 1 }
    },

    // Group 8: "Service connection denied for [condition]"
    {
      regex: /service\s+connection\s+denied\s+for\s+([^.\n]+?)(?:\.|because|due to|reason:)?\s*([^.\n]*)/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 9: "[condition] was not incurred in or aggravated by service"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s+(?:was|is)\s+not\s+(?:incurred|aggravated|caused)[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    },

    // Group 10: "The evidence does not support [condition]"
    {
      regex: /(?:the\s+)?evidence\s+does\s+not\s+support.*?([A-Za-z][A-Za-z\s,()'-]+?)(?:\.|$)[^.]*\.?\s*([^.\n]+)?/gi,
      groups: { condition: 1, reason: 2 }
    }
  ];

  // Process each pattern
  patterns.forEach((pattern, patternIndex) => {
    let match;
    while ((match = pattern.regex.exec(normalizedText)) !== null) {
      try {
        const conditionIndex = pattern.groups.condition;
        const reasonIndex = pattern.groups.reason;

        let conditionRaw = match[conditionIndex]?.trim();
        let reasonRaw = reasonIndex ? match[reasonIndex]?.trim() : null;

        // Clean condition name
        const condition = cleanConditionName(conditionRaw);

        // Clean reason
        const reason = cleanDenialReason(reasonRaw);

        // Extract evidence cited if present
        const evidenceCited = extractEvidenceCited(reasonRaw || '');

        // Validate
        if (!condition || condition.length < 3) continue;
        if (isNoiseText(condition)) continue;

        // Check for duplicates
        const key = condition.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // Build result object
        const result = {
          condition,
          reason: reason || 'Not specified',
          evidenceCited: evidenceCited.length > 0 ? evidenceCited : null,
          evidenceSource: 'VA Rating Narrative',
          extractionPattern: patternIndex + 1
        };

        conditions.push(result);
        console.log(`[Denied Pattern ${patternIndex + 1}] Extracted: ${condition} - ${reason}`);
      } catch (error) {
        console.warn('Error parsing denied match:', error);
      }
    }
  });

  // Enhanced extraction: Look for explicit denial reasons in context
  conditions.forEach(deniedCondition => {
    if (deniedCondition.reason === 'Not specified') {
      const contextReason = findDenialReasonInContext(normalizedText, deniedCondition.condition);
      if (contextReason) {
        deniedCondition.reason = contextReason;
      }
    }
  });

  return conditions;
}

/**
 * Clean denial reason text
 * @param {string} reasonText - Raw reason text
 * @returns {string} Cleaned reason
 */
function cleanDenialReason(reasonText) {
  if (!reasonText || reasonText.length < 3) return 'Not specified';

  let cleaned = reasonText
    .replace(/^(because|due to|reason:|as|since)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If reason is too short or generic, return 'Not specified'
  if (cleaned.length < 5 || /^(not|no|none|n\/a)$/i.test(cleaned)) {
    return 'Not specified';
  }

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return cleaned;
}

/**
 * Extract evidence cited in denial reason
 * @param {string} reasonText - Denial reason text
 * @returns {Array<string>} Array of evidence items
 */
function extractEvidenceCited(reasonText) {
  if (!reasonText) return [];

  const evidence = [];

  // Common evidence citation patterns
  const patterns = [
    /service treatment records/gi,
    /service medical records/gi,
    /VA medical records/gi,
    /VA treatment records/gi,
    /private medical records/gi,
    /lay statements?/gi,
    /buddy statements?/gi,
    /medical opinions?/gi,
    /competent medical evidence/gi,
    /nexus opinion/gi,
    /C&P examination/gi,
    /compensation and pension examination/gi,
    /VA examination/gi
  ];

  patterns.forEach(pattern => {
    const matches = reasonText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const clean = match.trim();
        if (!evidence.includes(clean)) {
          evidence.push(clean);
        }
      });
    }
  });

  return evidence;
}

/**
 * Find denial reason in surrounding context
 * @param {string} normalizedText - Full text
 * @param {string} condition - Condition name
 * @returns {string|null} Reason found in context
 */
function findDenialReasonInContext(normalizedText, condition) {
  // Look for common denial reason phrases near the condition
  const reasonPatterns = [
    /insufficient\s+evidence/i,
    /lack\s+of\s+evidence/i,
    /no\s+evidence/i,
    /not\s+incurred\s+in.*?service/i,
    /not\s+aggravated\s+by.*?service/i,
    /not\s+related\s+to.*?service/i,
    /did\s+not\s+occur.*?during.*?service/i,
    /preexisting\s+condition/i,
    /pre-existing\s+condition/i,
    /medical\s+evidence\s+does\s+not\s+support/i,
    /nexus\s+opinion.*?negative/i,
    /no\s+nexus/i,
    /lack.*?competent.*?evidence/i
  ];

  // Get context around condition (500 chars before and after)
  const conditionIndex = normalizedText.toLowerCase().indexOf(condition.toLowerCase());
  if (conditionIndex === -1) return null;

  const start = Math.max(0, conditionIndex - 500);
  const end = Math.min(normalizedText.length, conditionIndex + condition.length + 500);
  const context = normalizedText.substring(start, end);

  // Search for reasons in context
  for (const pattern of reasonPatterns) {
    const match = context.match(pattern);
    if (match) {
      return cleanDenialReason(match[0]);
    }
  }

  return null;
}

/**
 * Check if text is likely administrative noise
 * @param {string} text - Text to check
 * @returns {boolean} True if noise
 */
function isNoiseText(text) {
  if (!text) return true;

  const noise = [
    /^(page|section|part|form|note|see|exhibit|attachment|appendix)/i,
    /^(table|figure|chart|graph|diagram|image)/i,
    /^(privacy|notice|warning|caution|important)/i,
    /^(rating|percent|effective|date|decision)/i,
    /^(granted|denied|service|connection)$/i,
    /^\d+$/,  // Just numbers
    /^[^a-z]+$/i  // No letters
  ];

  return noise.some(pattern => pattern.test(text));
}

/**
 * Extract denied conditions from a specific section
 * @param {string} sectionText - Text from a specific section
 * @returns {Array<Object>} Denied conditions
 */
export function extractDeniedFromSection(sectionText) {
  // This is a convenience wrapper
  return extractDenied(sectionText);
}

