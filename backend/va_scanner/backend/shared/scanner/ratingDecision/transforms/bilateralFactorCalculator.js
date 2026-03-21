'use strict';

/**
 * Bilateral Factor Calculator
 * Implements VA bilateral factor calculation per 38 CFR §4.26
 * Adds compensation when veteran has same condition affecting both left and right extremities
 */

// Bilateral Factor Rules
// Source: 38 CFR §4.26
const BILATERAL_RULES = {
  description: 'Apply bilateral factor when effective rating is 20% or higher on each side',
  minimumEffectiveRating: 20,
  applicableConditions: [
    'arms/hands',
    'legs/feet',
    'eyes',
    'ears/hearing',
    'extremities'
  ],
  booleanFormula: '(A + B - (A × B / 100)) × 1.175 - (A + B - (A × B / 100))'
};

/**
 * Calculate bilateral factor based on two extremity ratings
 * @param {number} leftRating - Rating for left extremity (0-100)
 * @param {number} rightRating - Rating for right extremity (0-100)
 * @returns {Object} {bilateralApplies: boolean, bilateralFactor: number, totalIncrease: number, details: string}
 * @throws {Error} If ratings invalid
 */
function calculateBilateralFactor(leftRating, rightRating) {
  // Validate inputs
  if (typeof leftRating !== 'number' || typeof rightRating !== 'number') {
    throw new Error('Left and right ratings must be numbers');
  }
  
  if (leftRating < 0 || leftRating > 100 || rightRating < 0 || rightRating > 100) {
    throw new Error('Ratings must be between 0 and 100');
  }

  // Check if bilateral factor applies (both must be >= 20%)
  const leftMeetsThreshold = leftRating >= BILATERAL_RULES.minimumEffectiveRating;
  const rightMeetsThreshold = rightRating >= BILATERAL_RULES.minimumEffectiveRating;
  const bilateralApplies = leftMeetsThreshold && rightMeetsThreshold;

  if (!bilateralApplies) {
    return {
      bilateralApplies: false,
      bilateralFactor: 0,
      totalIncrease: 0,
      details: `Bilateral factor does not apply. Left: ${leftRating}%, Right: ${rightRating}%. Both must be >= ${BILATERAL_RULES.minimumEffectiveRating}%`,
      warnings: []
    };
  }

  // Calculate combined rating first (simplified)
  const combinedBeforeBilateral = getCombinedRatingSimple(leftRating, rightRating);

  // Apply bilateral factor: multiply by 1.175 (17.5% increase)
  const bilateralFactor = 1.175;
  const combinedAfterBilateral = Math.round(combinedBeforeBilateral * bilateralFactor);
  const totalIncrease = combinedAfterBilateral - combinedBeforeBilateral;

  // Cap at 100%
  const finalRating = Math.min(combinedAfterBilateral, 100);
  const capped = finalRating < combinedAfterBilateral;

  return {
    bilateralApplies: true,
    bilateralFactor: bilateralFactor,
    leftRating: leftRating,
    rightRating: rightRating,
    combinedBeforeBilateral: combinedBeforeBilateral,
    combinedAfterBilateral: combinedAfterBilateral,
    totalIncrease: totalIncrease,
    finalRating: finalRating,
    details: `Bilateral: ${combinedBeforeBilateral}% + 17.5% (factor) = ${finalRating}% ${capped ? '(capped at 100%)' : ''}`,
    regulationCitation: '38 CFR §4.26',
    warnings: capped ? ['Result capped at 100% maximum'] : []
  };
}

/**
 * Simplified combined rating calculation for bilateral factor preparation
 * @param {number} ratingA - First rating
 * @param {number} ratingB - Second rating
 * @returns {number} Combined rating
 */
function getCombinedRatingSimple(ratingA, ratingB) {
  // Simplified table lookup - full implementation would use complete table
  const combined = ratingA + (ratingB * (1 - ratingA / 100));
  return Math.round(combined);
}

/**
 * Validate bilateral factor is correctly applied in decision
 * @param {number} statedCombinedRating - Combined rating from decision
 * @param {number} leftRating - Left extremity rating
 * @param {number} rightRating - Right extremity rating
 * @returns {Object} {isValid: boolean, status: string, details: string}
 */
function validateBilateralFactorApplication(statedCombinedRating, leftRating, rightRating) {
  try {
    const calculation = calculateBilateralFactor(leftRating, rightRating);
    
    if (!calculation.bilateralApplies) {
      // Bilateral doesn't apply - combined rating should match base calculation
      return {
        isValid: true,
        status: 'PASS - Bilateral not applicable',
        details: calculation.details
      };
    }

    // Bilateral applies - check if stated rating matches calculation
    const discrepancy = Math.abs(statedCombinedRating - calculation.finalRating);
    const isValid = discrepancy === 0;

    return {
      isValid: isValid,
      status: isValid ? 'PASS - Bilateral correctly applied' : 'FAIL - Bilateral factor discrepancy',
      statedRating: statedCombinedRating,
      calculatedRating: calculation.finalRating,
      discrepancy: discrepancy,
      details: calculation.details,
      warnings: !isValid ? [`Bilateral rating discrepancy: ${discrepancy}% difference`] : []
    };
  } catch (error) {
    return {
      isValid: false,
      status: 'ERROR - Calculation failed',
      error: error.message,
      warnings: [`Failed to calculate bilateral factor: ${error.message}`]
    };
  }
}

module.exports = {
  calculateBilateralFactor,
  validateBilateralFactorApplication,
  BILATERAL_RULES
};
