/**
 * VA Compensation Engine - Core Module
 * Central calculation engine for all VA disability compensation logic
 * 
 * Core Functions:
 * - getCompensationByRating(rating, dependents, yearOverride?)
 * - getSMCAmount(smcCode, year?)
 * - getAncillaryBenefits(year?)
 * - calculateVeteranCompensation(input)
 * - getCompensationTimeline(effectiveDates, ratings, smcCodes, dependents)
 */

import {
  selectYearTable,
  getTableByEffectiveDate,
  getAvailableYears,
  detectCurrentYear
} from './year-selector.js';

import {
  isValidRating,
  isValidSMCCode,
  isValidSMCCodes,
  isValidDependents,
  isValidEffectiveDate,
  isValidYear,
  normalizeDependents,
  normalizeSMCCode,
  normalizeEffectiveDate
} from './validators.js';

/**
 * Get base monthly compensation by rating
 * @param {number} rating - Disability rating (0, 10, 20, ..., 100)
 * @param {object} dependents - Dependent configuration {spouse: 0|1, children: 0+, parents: 0+}
 * @param {number} yearOverride - Optional year to use specific rate table
 * @returns {object} { baseMonthly, rating, dependents, year, hasDependents, breakdown }
 * @throws Error if rating is invalid
 */
export function getCompensationByRating(rating, dependents = {}, yearOverride = null) {
  // Validate inputs
  if (!isValidRating(rating)) {
    throw new Error(`Invalid rating: ${rating}. Must be 0-100 in 10% increments.`);
  }

  const normalizedDependents = normalizeDependents(dependents);
  const rateTable = selectYearTable(yearOverride);
  const ratingStr = rating.toString();

  // Get base rate
  if (!rateTable.baseCompensation[ratingStr]) {
    throw new Error(`No rate found for ${rating}% rating in year ${rateTable._selectedYear}`);
  }

  // Use official VA rate table structure: base rates include spouse where applicable
  let baseMonthly;
  let dependentBonus = 0;
  const breakdown = {
    baseRate: 0,
    dependentAdditions: {}
  };

  // Determine which base rate to use based on dependents
  const hasSpouse = normalizedDependents.spouse > 0;
  const hasChildren = normalizedDependents.children > 0;
  const hasParents = normalizedDependents.parents > 0;

  if (hasSpouse && hasChildren && rateTable.withSpouseAndOneChildRates?.[ratingStr]) {
    // Use combined "spouse + 1 child" rate as base
    baseMonthly = rateTable.withSpouseAndOneChildRates[ratingStr];
    breakdown.baseRate = baseMonthly;
    
    // Add additional children beyond the first
    if (normalizedDependents.children > 1) {
      const additionalChildren = normalizedDependents.children - 1;
      const childBonus = additionalChildren * (rateTable.dependents.spouse.each_additional_child || 0);
      breakdown.dependentAdditions.additionalChildren = childBonus;
      dependentBonus += childBonus;
    }
  } else if (hasSpouse && !hasChildren && rateTable.withSpouseRates?.[ratingStr]) {
    // Use "with spouse" rate
    baseMonthly = rateTable.withSpouseRates[ratingStr];
    breakdown.baseRate = baseMonthly;
  } else {
    // Use veteran-alone base rate
    baseMonthly = rateTable.baseCompensation[ratingStr];
    breakdown.baseRate = baseMonthly;
    
    // Add dependents using no-spouse tier
    const tierRates = rateTable.dependents.no_spouse;
    
    if (normalizedDependents.children > 0) {
      const firstChildBonus = tierRates.first_child || 0;
      const additionalChildBonus = (normalizedDependents.children - 1) * (tierRates.each_additional_child || 0);
      const childTotal = firstChildBonus + additionalChildBonus;
      breakdown.dependentAdditions.children = childTotal;
      dependentBonus += childTotal;
    }
  }

  // Add parents (applies regardless of spouse/children)
  if (hasParents) {
    const tierName = hasSpouse ? 'spouse' : 'no_spouse';
    const tierRates = rateTable.dependents[tierName];
    const firstParentBonus = tierRates.first_parent || 0;
    const additionalParentBonus = (normalizedDependents.parents - 1) * (tierRates.each_additional_parent || 0);
    const parentTotal = firstParentBonus + additionalParentBonus;
    breakdown.dependentAdditions.parents = parentTotal;
    dependentBonus += parentTotal;
  }

  const totalMonthly = baseMonthly + dependentBonus;

  return {
    baseMonthly: baseMonthly,
    dependentMonthly: dependentBonus,
    totalMonthly: totalMonthly,
    yearlyTotal: totalMonthly * 12,
    rating: rating,
    dependents: normalizedDependents,
    year: rateTable._selectedYear,
    hasDependents: dependentBonus > 0,
    breakdown: breakdown,
    rateTableFallback: rateTable._fallbackApplied
  };
}

/**
 * Get SMC (Special Monthly Compensation) amount for a code
 * Per VA rule: Only the highest benefit wins (no stacking of multiple SMC codes)
 * @param {string|string[]} smcCode - Single SMC code or array (will use highest)
 * @param {number} yearOverride - Optional year for rate table
 * @returns {object} { smcMonthly, code, description, cfr, year }
 * @throws Error if SMC code invalid
 */
export function getSMCAmount(smcCode, yearOverride = null) {
  if (!smcCode) {
    return {
      smcMonthly: 0,
      code: null,
      description: 'No SMC Code',
      year: selectYearTable(yearOverride)._selectedYear,
      yearlyTotal: 0
    };
  }

  const normalizedCode = normalizeSMCCode(smcCode);
  
  if (!normalizedCode) {
    throw new Error(`Invalid SMC code(s): ${smcCode}. Valid codes are K-T.`);
  }

  const rateTable = selectYearTable(yearOverride);

  if (!rateTable.smc[normalizedCode]) {
    throw new Error(`SMC code ${normalizedCode} not found in ${rateTable._selectedYear} rate table.`);
  }

  const smcData = rateTable.smc[normalizedCode];

  return {
    smcMonthly: smcData.amount,
    code: normalizedCode,
    description: smcData.description,
    cfr: smcData.cfr,
    year: rateTable._selectedYear,
    yearlyTotal: smcData.amount * 12
  };
}

/**
 * Get ancillary/additional benefits (clothing, A&A, housebound)
 * @param {number} yearOverride - Optional year for rate table
 * @returns {object} { clothing, aidAttendance, housebound, year, yearlyTotals }
 */
export function getAncillaryBenefits(yearOverride = null) {
  const rateTable = selectYearTable(yearOverride);
  const ancillary = rateTable.ancillary;

  return {
    clothing: {
      monthly: ancillary.clothing_allowance.monthly,
      yearly: ancillary.clothing_allowance.yearly,
      description: ancillary.clothing_allowance.description,
      cfr: ancillary.clothing_allowance.cfr
    },
    aidAndAttendance: {
      monthly: ancillary.aid_and_attendance.monthly,
      yearly: ancillary.aid_and_attendance.monthly * 12,
      description: ancillary.aid_and_attendance.description,
      cfr: ancillary.aid_and_attendance.cfr
    },
    housebound: {
      monthly: ancillary.housebound.monthly,
      yearly: ancillary.housebound.monthly * 12,
      description: ancillary.housebound.description,
      cfr: ancillary.housebound.cfr
    },
    year: rateTable._selectedYear,
    yearlyTotals: {
      clothing: ancillary.clothing_allowance.yearly,
      aidAndAttendance: ancillary.aid_and_attendance.monthly * 12,
      housebound: ancillary.housebound.monthly * 12
    }
  };
}

/**
 * Calculate complete veteran compensation (base + SMC + ancillary)
 * @param {object} input - Calculation input
 *   - rating: number (disability rating 0-100)
 *   - dependents: object {spouse, children, parents} (optional)
 *   - smcCode: string (optional)
 *   - ancillary: object with {aidAndAttendance, housebound} booleans (optional)
 *   - effectiveDate: string or Date (optional, determines rate year)
 *   - yearOverride: number (optional, explicit year selection)
 * @returns {object} Complete compensation breakdown
 */
export function calculateVeteranCompensation(input = {}) {
  const {
    rating,
    dependents = {},
    smcCode = null,
    ancillary = { aidAndAttendance: false, housebound: false },
    effectiveDate = null,
    yearOverride = null
  } = input;

  // Determine which year's rate table to use
  let selectedYear = yearOverride;
  let effectiveDateUsed = null;

  if (!selectedYear && effectiveDate) {
    if (!isValidEffectiveDate(effectiveDate)) {
      throw new Error(`Invalid effective date: ${effectiveDate}`);
    }
    effectiveDateUsed = normalizeEffectiveDate(effectiveDate);
    const rateTable = getTableByEffectiveDate(effectiveDateUsed);
    selectedYear = rateTable._selectedYear;
  }

  // Get compensation components
  const baseComp = getCompensationByRating(rating, dependents, selectedYear);
  const smcComp = smcCode ? getSMCAmount(smcCode, selectedYear) : { smcMonthly: 0, yearlyTotal: 0, code: null };
  const ancillaryBenefits = getAncillaryBenefits(selectedYear);

  // Calculate ancillary additions
  let ancillaryMonthly = 0;
  if (ancillary.aidAndAttendance) {
    ancillaryMonthly += ancillaryBenefits.aidAndAttendance.monthly;
  }
  if (ancillary.housebound) {
    ancillaryMonthly += ancillaryBenefits.housebound.monthly;
  }

  // Calculate totals
  const totalMonthly = baseComp.totalMonthly + smcComp.smcMonthly + ancillaryMonthly;
  const totalYearly = totalMonthly * 12;

  return {
    summary: {
      totalMonthly: totalMonthly,
      totalYearly: totalYearly,
      year: selectedYear || detectCurrentYear(),
      effectiveDate: effectiveDateUsed,
      rateTableFallback: baseComp.rateTableFallback
    },
    components: {
      base: baseComp,
      smc: smcComp,
      ancillary: {
        aidAndAttendance: ancillary.aidAndAttendance ? ancillaryBenefits.aidAndAttendance.monthly : 0,
        housebound: ancillary.housebound ? ancillaryBenefits.housebound.monthly : 0,
        total: ancillaryMonthly
      }
    },
    breakdown: {
      baseMonthly: baseComp.baseMonthly,
      dependentMonthly: baseComp.dependentMonthly,
      smcMonthly: smcComp.smcMonthly,
      ancillaryMonthly: ancillaryMonthly,
      totalMonthly: totalMonthly,
      totalYearly: totalYearly
    }
  };
}

/**
 * Generate compensation timeline across multiple effective dates
 * Useful for historical or projected compensation across time periods
 * @param {object[]} periods - Array of periods with {effectiveDate, rating, smcCode?, dependents?}
 * @returns {object[]} Array of compensation calculations for each period
 */
export function getCompensationTimeline(periods = []) {
  if (!Array.isArray(periods) || periods.length === 0) {
    return [];
  }

  return periods.map((period, index) => {
    const calculation = calculateVeteranCompensation({
      rating: period.rating,
      dependents: period.dependents,
      smcCode: period.smcCode,
      ancillary: period.ancillary,
      effectiveDate: period.effectiveDate
    });

    return {
      period: index + 1,
      effectiveDate: period.effectiveDate,
      endDate: periods[index + 1]?.effectiveDate || 'Present',
      ...calculation
    };
  });
}

/**
 * Export all available rate years
 * @returns {number[]} Sorted array of available years
 */
export function getAvailableCompensationYears() {
  return getAvailableYears();
}

/**
 * Validate all inputs for a compensation calculation
 * @param {object} input - Calculation input
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateCompensationInput(input = {}) {
  const errors = [];

  if (!input.rating) {
    errors.push('rating is required');
  } else if (!isValidRating(input.rating)) {
    errors.push(`rating must be 0-100 in 10% increments, got ${input.rating}`);
  }

  if (input.dependents && !isValidDependents(input.dependents)) {
    errors.push('dependents object is malformed');
  }

  if (input.smcCode && !isValidSMCCode(input.smcCode)) {
    errors.push(`smcCode ${input.smcCode} is not valid (K-T)`);
  }

  if (input.effectiveDate && !isValidEffectiveDate(input.effectiveDate)) {
    errors.push('effectiveDate must be YYYY-MM-DD or Date object');
  }

  if (input.yearOverride && !isValidYear(input.yearOverride)) {
    errors.push('yearOverride must be valid year (2000-2100)');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// Export as default for module imports
export default {
  getCompensationByRating,
  getSMCAmount,
  getAncillaryBenefits,
  calculateVeteranCompensation,
  getCompensationTimeline,
  getAvailableCompensationYears,
  validateCompensationInput
};

