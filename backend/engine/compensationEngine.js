/**
 * ⚠️  DEPRECATED: Use backend/domain/engines/CompensationEngine.js instead.
 * 
 * This backend implementation is being consolidated into the domain layer.
 * Will be removed in Phase 4 (Backend Services Refactor).
 * 
 * VA Compensation Engine - Backend Implementation
 * Deterministic calculation engine for VA disability compensation
 * Integrates with STR Scanner output to calculate period-based compensation
 * 
 * No estimates, no approximations, no AI inference - uses ONLY official RATE DATABASE
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Module setup for ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RATES_DIR = path.join(__dirname, '../../compensation-engine/rates');

/**
 * Load rate table for specific year
 * @param {number} year - Year to load rates for
 * @returns {object} Rate table for the year
 * @throws Error if rate file not found
 */
function loadRateTable(year) {
  const rateFile = path.join(RATES_DIR, `${year}.json`);
  
  if (!fs.existsSync(rateFile)) {
    throw new Error(`Rate table not found for year ${year}. Please ensure ${rateFile} exists.`);
  }

  try {
    const content = fs.readFileSync(rateFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load rate table for year ${year}: ${error.message}`);
  }
}

/**
 * Get year from effective date
 * @param {string|Date} date - Effective date
 * @returns {number} Year
 */
function getYearFromDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getFullYear();
}

/**
 * Parse date to ISO string (YYYY-MM-DD)
 * @param {string|Date} date - Date to parse
 * @returns {string} ISO date string
 */
function toISODate(date) {
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

/**
 * Check if dependent is still active on given date
 * @param {object} dependent - Dependent object
 * @param {string} date - Date to check (ISO format)
 * @returns {boolean} True if dependent is active
 */
function isDependentActive(dependent, date) {
  const effectiveDate = dependent.effectiveDate || dependent.effectiveDateFromDecision;
  const removalDate = dependent.removalDate || dependent.removalEffectiveDate;

  // Convert to comparable format
  const dateVal = new Date(date).getTime();
  const effDate = effectiveDate ? new Date(effectiveDate).getTime() : 0;
  const remDate = removalDate ? new Date(removalDate).getTime() : Infinity;

  return dateVal >= effDate && dateVal < remDate;
}

/**
 * Calculate monthly compensation for single month with given rating/dependents/smc
 * @param {number} rating - Disability rating (10-100)
 * @param {object} dependents - Active dependents on this date
 * @param {string} smcCode - SMC code (K-T or null)
 * @param {number} year - Year for rate table
 * @returns {object} {baseMonthly, dependentBonus, smcAmount, totalMonthly}
 */
function calculateMonthlyCompensation(rating, dependents, smcCode, year) {
  const rateTable = loadRateTable(year);
  const ratingStr = String(rating);

  // Validate rating exists in table
  if (!rateTable.baseCompensation || !rateTable.baseCompensation[ratingStr]) {
    throw new Error(`Rating ${rating}% not found in ${year} rate table`);
  }

  let totalMonthly = rateTable.baseCompensation[ratingStr];
  let dependentBonus = 0;
  const breakdown = { baseRate: totalMonthly };

  // Calculate dependent bonuses
  const hasSpouse = dependents.spouse > 0;
  const childCount = dependents.children || 0;
  const parentCount = dependents.parents || 0;

  const tierName = hasSpouse ? 'spouse' : 'no_spouse';
  const tierRates = rateTable.dependents[tierName];

  // Children bonuses
  if (childCount > 0) {
    const firstChildBonus = tierRates.first_child || 0;
    const additionalChildBonus = (childCount - 1) * (tierRates.each_additional_child || 0);
    const childTotal = firstChildBonus + additionalChildBonus;
    breakdown.childBonus = childTotal;
    dependentBonus += childTotal;
  }

  // Parents bonuses
  if (parentCount > 0) {
    const firstParentBonus = tierRates.first_parent || 0;
    const additionalParentBonus = (parentCount - 1) * (tierRates.each_additional_parent || 0);
    const parentTotal = firstParentBonus + additionalParentBonus;
    breakdown.parentBonus = parentTotal;
    dependentBonus += parentTotal;
  }

  totalMonthly += dependentBonus;

  // Add SMC if present
  let smcAmount = 0;
  if (smcCode && rateTable.smc && rateTable.smc[smcCode]) {
    smcAmount = rateTable.smc[smcCode].amount;
    totalMonthly += smcAmount;
    breakdown.smcCode = smcCode;
    breakdown.smcAmount = smcAmount;
  }

  return {
    baseMonthly: rateTable.baseCompensation[ratingStr],
    dependentBonus: dependentBonus,
    smcAmount: smcAmount,
    totalMonthly: totalMonthly,
    totalAnnual: totalMonthly * 12,
    breakdown: breakdown
  };
}

/**
 * Get list of available rate table years
 * @returns {array} Sorted years with available rate tables
 */
function getAvailableYears() {
  const ratesDir = RATES_DIR;
  const files = fs.readdirSync(ratesDir).filter(f => f.endsWith('.json'));
  const years = files
    .map(f => parseInt(f.replace('.json', '')))
    .filter(y => !isNaN(y))
    .sort((a, b) => a - b);
  return years;
}

/**
 * Detect all period boundaries in compensation history
 * Boundaries occur on: rating change, dependent change, SMC change, calendar year change
 * @param {object} scanResult - STR scanner output
 * @returns {array} Sorted array of boundary dates
 */
function detectPeriodBoundaries(scanResult) {
  const boundaries = new Set();
  
  // Start date is always a boundary
  const decisionDate = new Date(scanResult.decisionDate);
  const startDateStr = toISODate(decisionDate);
  boundaries.add(startDateStr);

  // Add dependent effective/removal dates
  if (scanResult.dependents && Array.isArray(scanResult.dependents)) {
    scanResult.dependents.forEach(dependent => {
      if (dependent.effectiveDate) {
        boundaries.add(toISODate(dependent.effectiveDate));
      }
      if (dependent.removalDate) {
        boundaries.add(toISODate(dependent.removalDate));
      }
    });
  }

  // Add calendar year boundaries (COLA changes January 1) - only for years with available rates
  const availableYears = getAvailableYears();
  const startYear = getYearFromDate(startDateStr);
  const maxAvailableYear = Math.max(...availableYears);
  
  for (let year = startYear + 1; year <= maxAvailableYear; year++) {
    boundaries.add(`${year}-01-01`);
  }
  
  // Add final boundary at end of max available year
  boundaries.add(`${maxAvailableYear + 1}-01-01`);

  // Sort and return
  return Array.from(boundaries).sort();
}

/**
 * Get active dependents on given date
 * @param {array} dependents - All dependents array
 * @param {string} date - Date to check (ISO format)
 * @returns {object} {spouse: 0|1, children: count, parents: count}
 */
function getActiveDependents(dependents, date) {
  const active = { spouse: 0, children: 0, parents: 0 };

  if (!Array.isArray(dependents)) return active;

  dependents.forEach(dependent => {
    if (isDependentActive(dependent, date)) {
      const type = dependent.type || dependent.relationshipType;
      
      if (type === 'spouse') {
        active.spouse = 1;
      } else if (type === 'child' || type === 'children') {
        active.children += 1;
      } else if (type === 'parent' || type === 'parents') {
        active.parents += 1;
      }
    }
  });

  return active;
}

/**
 * Get active SMC code on given date
 * Selects highest-value explicit SMC code available
 * @param {array} smcExplicit - Explicit SMC grants
 * @param {string} date - Date to check
 * @returns {string|null} SMC code (K-T) or null
 */
function getActiveSMCCode(smcExplicit, date) {
  if (!Array.isArray(smcExplicit) || smcExplicit.length === 0) {
    return null;
  }

  // Filter by effective date
  const activeSMCs = smcExplicit.filter(smc => {
    const effectiveDate = smc.effectiveDate || smc.effectiveDateFromDecision;
    const removalDate = smc.removalDate;
    
    const dateVal = new Date(date).getTime();
    const effDate = effectiveDate ? new Date(effectiveDate).getTime() : 0;
    const remDate = removalDate ? new Date(removalDate).getTime() : Infinity;
    
    return dateVal >= effDate && dateVal < remDate;
  });

  if (activeSMCs.length === 0) return null;

  // Select highest value SMC
  const smcOrder = 'KLMNOPRSТ'.split('');
  const activeCodes = activeSMCs.map(smc => smc.code || smc.smcCode).filter(Boolean);
  
  for (const code of smcOrder) {
    if (activeCodes.includes(code)) {
      return code;
    }
  }

  return activeCodes[0] || null;
}

/**
 * Calculate VA compensation with period-based breakdown
 * Main export function - takes STR scanner output and returns structured compensation periods
 * 
 * @param {object} scanResult - STR Scanner output containing:
 *   {
 *     combinedRating: { finalPercent: number },
 *     decisionDate: string (ISO or VA format),
 *     dependents: [{type, effectiveDate, removalDate}, ...],
 *     smc: {
 *       explicit: [{code, effectiveDate, removalDate}, ...],
 *       inferred: [...]
 *     }
 *   }
 * @returns {object} 
 *   {
 *     veteran: {rating: number, decisionDate: string},
 *     currentStatus: {rating, dependents, smcCode, monthlyAmount, annualAmount},
 *     periods: [{startDate, endDate, rating, dependents, smcCode, monthlyAmount, annualAmount}, ...],
 *     validation: {isValid: boolean, errors: []}
 *   }
 */
export function calculateCompensation(scanResult) {
  const errors = [];
  const warnings = [];

  // Validate input
  if (!scanResult || typeof scanResult !== 'object') {
    return {
      veteran: {},
      currentStatus: {},
      periods: [],
      validation: {
        isValid: false,
        errors: ['scanResult must be a valid object']
      }
    };
  }

  // Extract and normalize rating
  let rating = null;
  if (scanResult.combinedRating) {
    rating = scanResult.combinedRating.finalPercent || 
             scanResult.combinedRating.percent ||
             scanResult.combinedRating;
  }
  
  if (!rating || typeof rating !== 'number' || rating < 0 || rating > 100) {
    errors.push(`Invalid rating: ${rating}. Must be 0-100.`);
  }

  // Normalize and validate decision date
  let decisionDate = scanResult.decisionDate;
  if (!decisionDate) {
    errors.push('decisionDate is required');
  } else {
    try {
      decisionDate = toISODate(decisionDate);
    } catch {
      errors.push(`Invalid decisionDate format: ${scanResult.decisionDate}`);
    }
  }

  if (errors.length > 0) {
    return {
      veteran: {},
      currentStatus: {},
      periods: [],
      validation: {
        isValid: false,
        errors: errors,
        warnings: warnings
      }
    };
  }

  // Detect period boundaries
  const boundaries = detectPeriodBoundaries(scanResult);
  const periods = [];

  // Create compensation periods
  for (let i = 0; i < boundaries.length - 1; i++) {
    const periodStartDate = boundaries[i];
    const periodEndDate = boundaries[i + 1];
    const periodYear = getYearFromDate(periodStartDate);

    // Get active configuration for this period
    const activeDependents = getActiveDependents(scanResult.dependents || [], periodStartDate);
    const activeSMC = getActiveSMCCode(
      (scanResult.smc && scanResult.smc.explicit) || [],
      periodStartDate
    );

    try {
      // Calculate compensation
      const compensation = calculateMonthlyCompensation(
        rating,
        activeDependents,
        activeSMC,
        periodYear
      );

      periods.push({
        startDate: periodStartDate,
        endDate: periodEndDate,
        rating: rating,
        dependents: activeDependents,
        smcCode: activeSMC || null,
        monthlyAmount: Number(compensation.totalMonthly.toFixed(2)),
        annualAmount: Number((compensation.totalMonthly * 12).toFixed(2)),
        breakdown: compensation.breakdown
      });
    } catch (error) {
      errors.push(`Failed to calculate period [${periodStartDate} to ${periodEndDate}]: ${error.message}`);
    }
  }

  // Get current status (most recent period)
  const currentPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  const result = {
    veteran: {
      rating: rating,
      decisionDate: decisionDate
    },
    currentStatus: currentPeriod ? {
      rating: currentPeriod.rating,
      dependents: currentPeriod.dependents,
      smcCode: currentPeriod.smcCode,
      monthlyAmount: currentPeriod.monthlyAmount,
      annualAmount: currentPeriod.annualAmount
    } : {},
    periods: periods,
    validation: {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    }
  };

  return result;
}

/**
 * Format compensation result for API response
 * @param {object} compensationResult - Result from calculateCompensation
 * @returns {object} Formatted for API/frontend
 */
export function formatCompensationResponse(compensationResult) {
  return {
    success: compensationResult.validation.isValid,
    data: compensationResult.validation.isValid ? {
      veteran: compensationResult.veteran,
      monthlyCompensation: compensationResult.currentStatus.monthlyAmount || 0,
      annualCompensation: compensationResult.currentStatus.annualAmount || 0,
      periods: compensationResult.periods
    } : null,
    errors: compensationResult.validation.errors,
    warnings: compensationResult.validation.warnings
  };
}

export default {
  calculateCompensation,
  formatCompensationResponse
};

