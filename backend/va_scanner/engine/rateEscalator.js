/**
 * VA Disability Rate Escalator
 * Automatically calculates current year rates based on Cost of Living Adjustment (COLA)
 * 2026 rates are the baseline; all other years are calculated using annual escalation
 * 
 * IMPORTANT: AI review should occur annually to ensure rates reflect actual VA COLA
 */

// 2026 Baseline Rates (VA Disability Compensation)
const BASE_RATES_2026 = {
  // Individual disability ratings
  '10': 171.23,
  '20': 338.49,
  '30': 522.36,
  '40': 727.31,
  '50': 1031.05,
  '60': 1304.76,
  '70': 1808.45,
  '80': 2093.87,
  '90': 2355.59,
  '100': 3823.97,
  
  // Dependent additions (per dependent, varies by dependent type)
  'spouse': 156.20,      // Base spouse addition
  'child': 52.03,        // Base child addition (each)
  'parent': 156.20,      // Base parent addition
  'firstDependent': 156.20,  // First dependent (usually spouse)
  'subsequentDependent': 52.03  // Each additional dependent
};

// Annual COLA percentages (historical and projected)
// AI NOTE: Update this annually after VA announces COLA
const COLA_HISTORY = {
  2026: 0.00,  // Base year (0% increase from baseline)
  2027: 0.035, // Projected 3.5% (PLACEHOLDER - UPDATE WITH ACTUAL VA COLA)
  2028: 0.030, // Projected 3.0% (PLACEHOLDER)
  2029: 0.025, // Projected 2.5% (PLACEHOLDER)
  2030: 0.025  // Projected 2.5% (PLACEHOLDER)
};

/**
 * Get the COLA adjustment factor for a given year
 * @param {number} year - Calendar year
 * @returns {number} - Decimal multiplier (1.0 = no change, 1.035 = 3.5% increase)
 */
export function getColaFactor(year = new Date().getFullYear()) {
  if (COLA_HISTORY[year] !== undefined) {
    // Calculate cumulative factor from 2026 to the requested year
    let factor = 1.0;
    for (let y = 2026; y < year; y++) {
      const cola = COLA_HISTORY[y + 1] || 0.025; // Default 2.5% if not specified
      factor *= (1 + cola);
    }
    return factor;
  }
  
  // For years beyond history, assume 2.5% annual escalation
  let factor = 1.0;
  for (let y = 2026; y < year; y++) {
    const cola = COLA_HISTORY[y + 1] || 0.025;
    factor *= (1 + cola);
  }
  return factor;
}

/**
 * Get disability rating amount for any year
 * @param {string|number} rating - Rating percentage (e.g., "70", 70)
 * @param {number} year - Calendar year (default: current year)
 * @returns {number} - Monthly amount in dollars
 */
export function getDisabilityAmount(rating, year = new Date().getFullYear()) {
  const ratingStr = String(rating).padStart(3, '0'); // Ensure "070" format
  const baseAmount = BASE_RATES_2026[ratingStr] || BASE_RATES_2026[String(parseInt(rating))];
  
  if (!baseAmount) {
    console.warn(`[RateEscalator] Unknown rating: ${rating}`);
    return 0;
  }
  
  const colaFactor = getColaFactor(year);
  return parseFloat((baseAmount * colaFactor).toFixed(2));
}

/**
 * Get dependent addition amount for any year
 * @param {string} dependentType - 'spouse', 'child', 'parent', 'firstDependent', 'subsequentDependent'
 * @param {number} year - Calendar year (default: current year)
 * @returns {number} - Monthly addition in dollars
 */
export function getDependentAmount(dependentType, year = new Date().getFullYear()) {
  const typeKey = String(dependentType).toLowerCase().trim();
  const baseAmount = BASE_RATES_2026[typeKey];
  
  if (!baseAmount) {
    console.warn(`[RateEscalator] Unknown dependent type: ${dependentType}`);
    return 0;
  }
  
  const colaFactor = getColaFactor(year);
  return parseFloat((baseAmount * colaFactor).toFixed(2));
}

/**
 * Get SMC rates for any year
 * SMC rates are typically indexed to the 100% disability rating
 * @param {string} smcCode - SMC code (e.g., 'L', 'M', 'N')
 * @param {number} year - Calendar year
 * @returns {number} - Monthly SMC addition in dollars
 */
export function getSMCAmount(smcCode, year = new Date().getFullYear()) {
  // SMC rates as percentage of 100% disability rating
  const SMC_PERCENTAGES = {
    K: 0.50,    // 50% of 100%
    'L½': 0.60, // 60% of 100%
    L: 0.70,    // 70% of 100%
    'M½': 0.80, // 80% of 100%
    M: 0.90,    // 90% of 100%
    'N½': 0.95, // 95% of 100%
    N: 1.00,    // 100% of 100%
    'O': 1.10,  // 110% of 100%
    'R1': 1.25, // 125% of 100%
    'R2': 1.50  // 150% of 100%
  };
  
  const percentage = SMC_PERCENTAGES[smcCode];
  if (!percentage) {
    console.warn(`[RateEscalator] Unknown SMC code: ${smcCode}`);
    return 0;
  }
  
  const baseRate100 = BASE_RATES_2026['100'];
  const colaFactor = getColaFactor(year);
  const smcAmount = baseRate100 * percentage * colaFactor;
  
  return parseFloat(smcAmount.toFixed(2));
}

/**
 * Get all rates for a given year (comprehensive snapshot)
 * @param {number} year - Calendar year
 * @returns {Object} - Complete rate table for the year
 */
export function getRatesForYear(year = new Date().getFullYear()) {
  const colaFactor = getColaFactor(year);
  const cola = COLA_HISTORY[year] || 0.025;
  
  const rates = {};
  
  // Disability ratings
  Object.entries(BASE_RATES_2026).forEach(([key, baseAmount]) => {
    if (!isNaN(key)) {  // Only numeric keys
      rates[key] = parseFloat((baseAmount * colaFactor).toFixed(2));
    }
  });
  
  // Dependent types
  const dependentTypes = ['spouse', 'child', 'parent', 'firstDependent', 'subsequentDependent'];
  dependentTypes.forEach(type => {
    rates[type] = getDependentAmount(type, year);
  });
  
  return {
    year,
    colaFactor,
    colaPercentage: cola * 100,
    ratings: {
      '10': rates['10'],
      '20': rates['20'],
      '30': rates['30'],
      '40': rates['40'],
      '50': rates['50'],
      '60': rates['60'],
      '70': rates['70'],
      '80': rates['80'],
      '90': rates['90'],
      '100': rates['100']
    },
    dependents: {
      spouse: rates['spouse'],
      child: rates['child'],
      parent: rates['parent']
    },
    metadata: {
      baselineYear: 2026,
      lastUpdated: new Date().toISOString(),
      note: 'AI review recommended annually to verify COLA alignment with VA official rates'
    }
  };
}

/**
 * Verify rates against official VA rates (for annual AI audit)
 * @param {number} year - Year to verify
 * @param {Object} officialRates - Official VA rates to compare against
 * @returns {Object} - Verification report
 */
export function verifyRates(year, officialRates = {}) {
  console.log(`\n[RateEscalator] ANNUAL VERIFICATION REQUIRED for ${year}`);
  console.log('Please compare calculated rates against official VA COLA announcement');
  
  const calculatedRates = getRatesForYear(year);
  const report = {
    year,
    status: 'AWAITING_VERIFICATION',
    calculatedRates,
    officialRates,
    discrepancies: [],
    recommendations: []
  };
  
  // If official rates provided, compare
  if (Object.keys(officialRates).length > 0) {
    Object.entries(officialRates).forEach(([rating, officialAmount]) => {
      const calculated = calculatedRates.ratings[rating];
      if (calculated && Math.abs(calculated - officialAmount) > 0.01) {
        report.discrepancies.push({
          rating,
          calculated,
          official: officialAmount,
          difference: officialAmount - calculated,
          percentDiff: ((officialAmount - calculated) / officialAmount * 100).toFixed(2)
        });
      }
    });
    
    if (report.discrepancies.length === 0) {
      report.status = 'VERIFIED_CORRECT';
    } else {
      report.status = 'DISCREPANCIES_FOUND';
      report.recommendations.push('Review COLA factors - may need adjustment');
    }
  } else {
    report.recommendations.push('Provide official VA rates for annual verification');
  }
  
  return report;
}

// Export base rates for reference
export { BASE_RATES_2026 };
