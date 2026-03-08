/**
 * Service-Connected Conditions Extraction
 * Extracts all service-connected conditions with ratings, dates, laterality
 */

import { cleanConditionName, extractPercentage, parseDate } from './textNormalizer.js';

/**
 * Extract all service-connected conditions from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @returns {Array<Object>} Array of service-connected conditions
 */
export function extractServiceConnected(normalizedText) {
  if (!normalizedText) return [];

  const conditions = [];
  const seen = new Set();

  // Pattern groups for comprehensive extraction
  const patterns = [
    // Group 1: "Service connection for [condition] is granted at [X] percent effective [date]"
    {
      regex: /service\s+connection\s+for\s+([A-Za-z][A-Za-z\s,()'-]{2,80}?)\s+is\s+granted.*?(\d{1,3})\s*(?:%|percent).*?effective\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
      groups: { condition: 1, percentage: 2, effectiveDate: 3 }
    },
    
    // Group 2: "Service connection for [condition] is granted at [X] percent" (no date)
    {
      regex: /service\s+connection\s+for\s+([A-Za-z][A-Za-z\s,()'-]{2,80}?)\s+is\s+granted.*?(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 3: "Entitlement to service connection for [condition] is granted at [X]%"
    {
      regex: /entitlement\s+to\s+service\s+connection\s+for\s+([A-Za-z][A-Za-z\s,()'-]{2,80}?)\s+is\s+granted.*?(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 4: "[condition] is service-connected at [X]%"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s+is\s+service[-\s]connected\s+at\s+(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 5: "[condition] evaluated at [X] percent"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s+evaluated\s+at\s+(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 6: "Evaluation of [X] percent for [condition]"
    {
      regex: /evaluation\s+of\s+(\d{1,3})\s*(?:%|percent)\s+for\s+([^.\n]+)/gi,
      groups: { percentage: 1, condition: 2 }
    },

    // Group 7: "[condition] is rated at [X]%"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s+is\s+rated\s+(?:at\s+)?(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 8: "[condition] - [X]%" (table format)
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]{3,}?)\s*[-–]\s*(\d{1,3})\s*%/g,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 9: "[condition] ([X]%)"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]{3,}?)\s+\((\d{1,3})\s*%\)/g,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 10: "[condition], rated [X]%"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?),\s*rated\s+(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 11: "[condition] granted at [X]%"
    {
      regex: /([A-Za-z][A-Za-z\s,()'-]+?)\s+granted\s+(?:at\s+)?(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 12: "Rating: [condition] [X]%"
    {
      regex: /rating:?\s*([A-Za-z][A-Za-z\s,()'-]+?)\s+(\d{1,3})\s*%/gi,
      groups: { condition: 1, percentage: 2 }
    },

    // Group 14: "An increased rating for [condition]" (rating increases)
    {
      regex: /increased\s+rating\s+for\s+([A-Za-z][A-Za-z\s,()'-]{3,50}?)\.?\s+The\s+evaluation\s+is\s+increased\s+from\s+\d+\s*(?:%|percent)?\s+to\s+(\d{1,3})\s*(?:%|percent)/gi,
      groups: { condition: 1, percentage: 2 }
    },
    
    // Group 15: DISABLED - causes ambiguous matches
    // {
    //   regex: /\b([A-Za-z][A-Za-z\s,()'-]{3,50}?)[.,]?\s+(?:the\s+)?(?:evaluation|rating)\s+(?:is|has\s+been)?\s+increased\s+from\s+\d+\s*%?\s+to\s+(\d{1,3})\s*(?:%|percent)/gi,
    //   groups: { condition: 1, percentage: 2 }
    // },

    // Group 13: "[X]% for [condition]" (reversed format)
    {
      regex: /(\d{1,3})\s*%\s+for\s+([^.\n]+)/gi,
      groups: { percentage: 1, condition: 2 }
    }
  ];

  // Process each pattern
  patterns.forEach((pattern, patternIndex) => {
    let match;
    while ((match = pattern.regex.exec(normalizedText)) !== null) {
      try {
        const conditionIndex = pattern.groups.condition;
        const percentageIndex = pattern.groups.percentage;
        const dateIndex = pattern.groups.effectiveDate;

        let conditionRaw = match[conditionIndex]?.trim();
        let percentage = parseInt(match[percentageIndex]);
        let effectiveDate = dateIndex ? match[dateIndex]?.trim() : null;

        // Clean condition name
        const condition = cleanConditionName(conditionRaw);

        // Validate
        if (!condition || condition.length < 3) continue;
        if (percentage < 0 || percentage > 100) continue;
        if (isNoiseText(condition)) continue;

        // Check for duplicates
        const key = `${condition.toLowerCase()}_${percentage}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Extract laterality if present
        const laterality = extractLaterality(conditionRaw);

        // Build result object
        const result = {
          condition,
          percentage,
          effectiveDate: effectiveDate ? parseDate(effectiveDate) : null,
          laterality: laterality,
          evidenceSource: 'VA Rating Narrative',
          extractionPattern: patternIndex + 1
        };

        conditions.push(result);
        console.log(`[SC Pattern ${patternIndex + 1}] Extracted: ${condition} at ${percentage}%`);
      } catch (error) {
        console.warn('Error parsing service-connected match:', error);
      }
    }
  });

  // Extract combined rating if present
  const combinedRating = extractCombinedRating(normalizedText);
  if (combinedRating !== null && conditions.length > 0) {
    conditions.forEach(c => c.combinedRating = combinedRating);
  }

  return conditions;
}

/**
 * Extract laterality (left/right/bilateral/dominant/non-dominant)
 * @param {string} conditionText - Raw condition text
 * @returns {string|null} Laterality descriptor
 */
function extractLaterality(conditionText) {
  if (!conditionText) return null;

  const text = conditionText.toLowerCase();

  // Check for specific laterality markers
  // Check non-dominant BEFORE dominant to avoid false matches
  if (/\b(left|lt)\b/.test(text)) return 'left';
  if (/\b(non-dominant|nondominant)\b/.test(text)) return 'left';
  if (/\b(right|rt)\b/.test(text)) return 'right';
  if (/\b(dominant)\b/.test(text)) return 'right';
  if (/\b(bilateral|both)\b/.test(text)) return 'bilateral';

  return null;
}

/**
 * Extract combined rating from text
 * @param {string} normalizedText - Normalized text
 * @returns {number|null} Combined rating percentage
 */
function extractCombinedRating(normalizedText) {
  const patterns = [
    /combined\s+rating.*?(\d{1,3})\s*(?:%|percent)/i,
    /combined\s+(?:disability\s+)?rating\s+(?:is\s+)?(\d{1,3})\s*%/i,
    /your\s+combined\s+rating\s+(?:is\s+)?(\d{1,3})\s*%/i,
    /combined\s+evaluation\s+(?:is\s+)?(\d{1,3})\s*%/i
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const rating = parseInt(match[1]);
      if (rating >= 0 && rating <= 100) {
        console.log(`[Combined Rating] Extracted: ${rating}%`);
        return rating;
      }
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
  if (text.length < 3) return true;  // Too short
  
  // Filter out single words that are too vague/generic
  const singleWordNoiseTerms = /^(lower|upper|left|right|back|front|side|rating|percent|evaluation|for|and|the|a|an)$/i;
  if (singleWordNoiseTerms.test(text.trim())) return true;

  const noise = [
    /^(page|section|part|form|note|see|exhibit|attachment|appendix)/i,
    /^(table|figure|chart|graph|diagram|image)/i,
    /^(privacy|notice|warning|caution|important)/i,
    /^(your combined|combined rating|combined disability)/i,  // Skip combined rating as condition
    /^evaluation\s+is(?:\s+at)?$/i,
    /^\d+$/,  // Just numbers
    /^[^a-z]+$/i,  // No letters
    /^(and |or |the |a |an )/i  // Just articles/conjunctions
  ];

  return noise.some(pattern => pattern.test(text));
}

/**
 * Extract service-connected conditions from a specific section
 * @param {string} sectionText - Text from a specific section
 * @returns {Array<Object>} Service-connected conditions
 */
export function extractServiceConnectedFromSection(sectionText) {
  // This is a convenience wrapper
  return extractServiceConnected(sectionText);
}

