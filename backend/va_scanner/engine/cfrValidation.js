/**
 * CFR Rating Validation Module
 * 38 CFR §4.25 - Combined Ratings Table Validation
 * 38 CFR §4.26 - Bilateral Factor Verification
 */

export const CFR_DIAGNOSTIC_CODES = {
  // Musculoskeletal conditions (representative sample)
  '5299-5399': { name: 'Musculoskeletal', minRating: 0, maxRating: 100, bilateralEligible: true },
  '6000-6399': { name: 'Respiratory Conditions', minRating: 0, maxRating: 100, bilateralEligible: false },
  '6500-6699': { name: 'Cardiovascular Conditions', minRating: 0, maxRating: 100, bilateralEligible: false },
  '6700-6799': { name: 'Hearing Loss', minRating: 0, maxRating: 100, bilateralEligible: true },
  '6800-6899': { name: 'Tinnitus', minRating: 10, maxRating: 10, bilateralEligible: false },
  '7000-7399': { name: 'Skin Conditions', minRating: 0, maxRating: 100, bilateralEligible: false },
  '7500-7599': { name: 'Digestive System', minRating: 0, maxRating: 100, bilateralEligible: false },
  '9000-9399': { name: 'Mental Health', minRating: 0, maxRating: 100, bilateralEligible: false }
};

const VA_COMBINED_RATINGS_TABLE = {
  // 38 CFR §4.25 - Simplified reference table
  // For accurate validation, would reference full table
  // This is a validation check, not the actual combining logic
  '50': { '50': 75, '40': 70, '30': 60, '20': 60, '10': 55, '0': 50 },
  '40': { '40': 64, '30': 52, '20': 48, '10': 44, '0': 40 },
  '30': { '30': 51, '20': 38, '10': 33, '0': 30 },
  '20': { '20': 36, '10': 26, '0': 20 },
  '10': { '10': 19, '0': 10 }
};

/**
 * Validates a condition rating against CFR requirements
 * @param {string} condition - Condition name
 * @param {number} rating - Rating percentage
 * @returns {object} { isValid, issues, suggestions }
 */
export function validateConditionRating(condition, rating) {
  const issues = [];
  const suggestions = [];
  
  // Check rating is in valid range
  if (rating < 0 || rating > 100) {
    issues.push(`Rating ${rating}% is outside valid range (0-100%)`);
  }
  
  // Check rating is in 10% increments (standard VA ratings)
  if (rating % 10 !== 0 && rating !== 0) {
    issues.push(`Rating ${rating}% is not in standard 10% increments`);
    suggestions.push(`Consider rounding to nearest 10%: ${Math.round(rating / 10) * 10}%`);
  }
  
  // Check for maximum ratings on specific conditions
  const maxRatings = {
    'tinnitus': 10,
    'loss of.*ear': 100,
    'loss of.*eye': 100,
    'loss of.*limb': 100
  };
  
  Object.entries(maxRatings).forEach(([pattern, max]) => {
    if (new RegExp(pattern, 'i').test(condition) && rating > max) {
      issues.push(`${condition} cannot exceed ${max}% (CFR limitation)`);
      suggestions.push(`Maximum rating for this condition is ${max}%`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    rating,
    condition,
    issues,
    suggestions,
    confidence: calculateValidationConfidence(issues)
  };
}

/**
 * Validates combined rating calculation
 * @param {array} conditions - Array of { condition, rating } objects
 * @param {number} calculatedCombined - The combined rating calculated
 * @returns {object} Validation results
 */
export function validateCombinedRating(conditions, calculatedCombined) {
  const issues = [];
  const warnings = [];
  
  // Check that combined rating isn't just sum of ratings
  const sumOfRatings = conditions.reduce((sum, c) => sum + (parseInt(c.rating) || 0), 0);
  if (calculatedCombined === sumOfRatings && conditions.length > 1) {
    issues.push('Combined rating appears to be simple sum, not CFR §4.25 combined table value');
    warnings.push('Combined ratings should use VA Combined Ratings Table, not simple addition');
  }
  
  // Check that combined rating is reasonable
  const highestRating = Math.max(...conditions.map(c => parseInt(c.rating) || 0));
  if (calculatedCombined < highestRating) {
    issues.push(`Combined rating ${calculatedCombined}% cannot be less than highest individual rating ${highestRating}%`);
  }
  
  if (calculatedCombined > 100) {
    issues.push(`Combined rating ${calculatedCombined}% cannot exceed 100%`);
  }
  
  // Warn on suspiciously high combined ratings with low individual ratings
  if (calculatedCombined >= 90 && highestRating < 50) {
    warnings.push('Combined rating seems high for relatively low individual ratings - verify calculation');
  }
  
  return {
    isValid: issues.length === 0,
    calculatedCombined,
    confidence: calculateValidationConfidence(issues),
    issues,
    warnings,
    totalConditions: conditions.length,
    highestRating,
    sumOfRatings
  };
}

/**
 * Validates bilateral factor calculation
 * @param {object} ratingData - { bilateralPairs, bilateralFactor, bilateralSubtotal }
 * @returns {object} Validation results
 */
export function validateBilateralFactor(ratingData) {
  const issues = [];
  
  const { bilateralPairs = [], bilateralFactor = 0, bilateralSubtotal = 0 } = ratingData;
  
  // Check bilateral pairs exist
  if (bilateralPairs.length === 0) {
    return {
      isValid: true,
      hasBilateral: false,
      confidence: 100,
      message: 'No bilateral pairs detected'
    };
  }
  
  // Verify bilateral factor formula: 10% of bilateral subtotal
  const expectedFactor = Math.round(bilateralSubtotal * 0.10);
  if (Math.abs(bilateralFactor - expectedFactor) > 1) { // Allow 1% rounding difference
    issues.push(`Bilateral factor calculation error. Expected ~${expectedFactor}%, got ${bilateralFactor}%`);
  }
  
  // Verify all paired conditions are present
  bilateralPairs.forEach(pair => {
    if (!pair.left || !pair.right) {
      issues.push(`Incomplete bilateral pair: ${pair.left ? 'missing RIGHT' : 'missing LEFT'}`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    confidence: calculateValidationConfidence(issues),
    bilateralPairs: bilateralPairs.length,
    bilateralFactor,
    expectedFactor,
    issues
  };
}

/**
 * Calculate confidence score based on issues found
 * @param {array} issues - Array of issue strings
 * @returns {number} Confidence 0-100%
 */
function calculateValidationConfidence(issues) {
  const baseConfidence = 100;
  const pointsPerIssue = 15; // Each issue reduces confidence 15%
  return Math.max(0, baseConfidence - (issues.length * pointsPerIssue));
}

/**
 * Perform comprehensive validation
 * @param {object} scanResults - Scanner output object
 * @returns {object} Comprehensive validation report
 */
export function performComprehensiveValidation(scanResults) {
  const report = {
    timestamp: new Date().toISOString(),
    overallValid: true,
    overallConfidence: 100,
    sections: {}
  };
  
  // Validate each condition
  if (scanResults.serviceConnected) {
    report.sections.serviceConnected = {
      results: scanResults.serviceConnected.map(c => 
        validateConditionRating(c.condition, parseInt(c.rating) || parseInt(c.percentage) || 0)
      ),
      allValid: true
    };
    report.sections.serviceConnected.allValid = 
      report.sections.serviceConnected.results.every(r => r.isValid);
    
    if (!report.sections.serviceConnected.allValid) {
      report.overallValid = false;
    }
  }
  
  // Validate combined rating
  if (scanResults.ratingCalculation) {
    report.sections.combinedRating = validateCombinedRating(
      scanResults.serviceConnected || [],
      scanResults.ratingCalculation.calculatedCombinedRating
    );
    if (!report.sections.combinedRating.isValid) {
      report.overallValid = false;
    }
  }
  
  // Validate bilateral factor
  if (scanResults.ratingCalculation?.bilateralPairs) {
    report.sections.bilateralFactor = validateBilateralFactor(scanResults.ratingCalculation);
    if (!report.sections.bilateralFactor.isValid) {
      report.overallValid = false;
    }
  }
  
  // Calculate overall confidence
  const confidences = Object.values(report.sections)
    .map(s => s.confidence || (s.results?.length > 0 ? 
      s.results.reduce((sum, r) => sum + r.confidence, 0) / s.results.length : 100));
  
  report.overallConfidence = Math.round(
    confidences.reduce((sum, c) => sum + c, 0) / confidences.length
  );
  
  return report;
}

/**
 * Generate flagged items for manual review
 * @param {object} validationReport - From performComprehensiveValidation
 * @returns {array} Items flagged for review
 */
export function getFlaggedItems(validationReport) {
  const flagged = [];
  
  Object.entries(validationReport.sections).forEach(([section, data]) => {
    if (section === 'serviceConnected' && data.results) {
      data.results.forEach((result, idx) => {
        if (!result.isValid || result.confidence < 80) {
          flagged.push({
            section,
            item: idx,
            severity: !result.isValid ? 'error' : 'warning',
            confidence: result.confidence,
            issues: result.issues,
            suggestions: result.suggestions
          });
        }
      });
    } else if (data.issues?.length > 0 || data.confidence < 80) {
      flagged.push({
        section,
        severity: data.issues?.length > 0 ? 'error' : 'warning',
        confidence: data.confidence,
        issues: data.issues || [],
        suggestions: data.suggestions || []
      });
    }
  });
  
  return flagged;
}

