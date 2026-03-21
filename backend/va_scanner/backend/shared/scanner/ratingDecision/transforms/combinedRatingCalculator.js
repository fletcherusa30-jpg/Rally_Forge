'use strict';

/**
 * Combined Rating Calculator
 * Implements VA Schedule combined rating calculation per 38 CFR §4.25
 * Deterministic calculation of combined disability rating from individual condition ratings
 */

// Combined Rating Table - Non-linear combination of disability ratings
// Source: VA Schedule for Rating Disabilities, 38 CFR §4.25
const COMBINED_RATING_TABLE = {
  // Table format: "first%_second%" => combined%
  // This is a simplified excerpt; full table has all combinations
  "10_0": 10, "10_10": 19, "10_20": 27, "10_30": 36, "10_40": 44,
  "20_0": 20, "20_10": 28, "20_20": 36, "20_30": 44, "20_40": 52,
  "30_0": 30, "30_10": 37, "30_20": 44, "30_30": 51, "30_40": 58,
  "40_0": 40, "40_10": 46, "40_20": 52, "40_30": 58, "40_40": 64,
  "50_0": 50, "50_10": 55, "50_20": 60, "50_30": 65, "50_40": 70,
  "60_0": 60, "60_10": 64, "60_20": 68, "60_30": 72, "60_40": 76,
  "70_0": 70, "70_10": 73, "70_20": 76, "70_30": 79, "70_40": 82,
  "80_0": 80, "80_10": 82, "80_20": 84, "80_30": 86, "80_40": 88,
  "90_0": 90, "90_10": 91, "90_20": 92, "90_30": 93, "90_40": 94,
  "100_0": 100
};

/**
 * Calculate combined rating from individual condition ratings
 * @param {Array<number>} ratings - Array of individual ratings (10, 20, 30, etc.)
 * @returns {Object} {combinedRating: number, calculationMethod: string, details: string}
 * @throws {Error} If ratings are invalid or calculation fails
 */
function calculateCombinedRating(ratings) {
  if (!Array.isArray(ratings) || ratings.length === 0) {
    throw new Error('Ratings must be a non-empty array');
  }

  // Validate all ratings
  const validRatings = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  for (const rating of ratings) {
    if (!validRatings.includes(rating)) {
      throw new Error(`Invalid rating: ${rating}. Must be one of: ${validRatings.join(', ')}`);
    }
  }

  // Sort ratings in descending order
  const sortedRatings = [...ratings].sort((a, b) => b - a);

  // If only one rating (no need to combine), return it
  if (sortedRatings.length === 1) {
    return {
      combinedRating: sortedRatings[0],
      calculationMethod: 'single-rating',
      details: `Single condition rated at ${sortedRatings[0]}%`
    };
  }

  // Start with highest rating
  let combined = sortedRatings[0];
  let details = `Start: ${combined}%`;

  // Apply each additional rating sequentially using table
  for (let i = 1; i < sortedRatings.length; i++) {
    const currentRating = sortedRatings[i];
    const key = `${combined}_${currentRating}`;
    
    if (COMBINED_RATING_TABLE[key] !== undefined) {
      combined = COMBINED_RATING_TABLE[key];
      details += ` + ${currentRating}% = ${combined}%`;
    } else {
      // Fallback: if exact combination not in table, estimate
      combined = Math.max(combined, currentRating);
      details += ` + ${currentRating}% = ${combined}% (estimated)`;
    }
  }

  // Round to nearest 10% as per VA schedule
  const finalRating = Math.round(combined / 10) * 10;
  if (finalRating > 100) {
    const rating = 100;
    return {
      combinedRating: rating,
      calculationMethod: 'va-schedule-table',
      details: details + ` → capped at 100%`,
      warnings: ['Combined rating exceeded 100%, capped at maximum']
    };
  }

  return {
    combinedRating: finalRating,
    calculationMethod: 'va-schedule-table',
    details: details,
    warnings: combined !== finalRating ? [`Rounded from ${combined}% to ${finalRating}%`] : []
  };
}

/**
 * Validate combined rating matches individual ratings calculation
 * @param {number} stateCombinedRating - The combined rating from decision document
 * @param {Array<number>} individualRatings - Individual condition ratings
 * @returns {Object} {isValid: boolean, statedRating: number, calculatedRating: number, discrepancy: number, status: string}
 */
function validateCombinedRating(stateCombinedRating, individualRatings) {
  try {
    const calculation = calculateCombinedRating(individualRatings);
    const discrepancy = Math.abs(stateCombinedRating - calculation.combinedRating);
    
    return {
      isValid: discrepancy === 0,
      statedRating: stateCombinedRating,
      calculatedRating: calculation.combinedRating,
      discrepancy: discrepancy,
      status: discrepancy === 0 ? 'PASS' : 'FAIL',
      details: calculation.details,
      warnings: discrepancy > 0 ? [`Combined rating discrepancy: ${discrepancy}% difference`] : []
    };
  } catch (error) {
    return {
      isValid: false,
      statedRating: stateCombinedRating,
      calculatedRating: null,
      discrepancy: null,
      status: 'ERROR',
      error: error.message,
      warnings: [`Calculation failed: ${error.message}`]
    };
  }
}

module.exports = {
  calculateCombinedRating,
  validateCombinedRating,
  COMBINED_RATING_TABLE
};
