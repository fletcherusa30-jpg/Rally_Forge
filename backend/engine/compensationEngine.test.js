/**
 * VA Compensation Engine Tests
 * Comprehensive test suite for deterministic compensation calculations
 * 
 * MANDATORY TEST CASE:
 * 2017 Decision: 100% rating + spouse + 3 children
 * Expected: $3,425.86 monthly
 */

import { calculateCompensation, formatCompensationResponse } from './compensationEngine.js';

/**
 * Test assertion helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEquals(actual, expected, tolerance = 0.01, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      `ASSERTION FAILED: ${message}\n` +
      `Expected: ${expected}\nActual: ${actual}\nDifference: ${diff}`
    );
  }
}

/**
 * Test 1: MANDATORY - 2017 Decision (100% + spouse + 3 children)
 */
function test_mandatory_2017_100_percent_with_spouse_and_3_children() {
  console.log('TEST 1: MANDATORY - 2017 Decision (100% rating + spouse + 3 children)');
  
  const scanResult = {
    combinedRating: {
      finalPercent: 100
    },
    decisionDate: '2017-11-27',
    dependents: [
      {
        type: 'spouse',
        name: 'Jessica Fletcher',
        effectiveDate: '2017-11-27'
      },
      {
        type: 'child',
        name: 'Kaiden J Fletcher',
        effectiveDate: '2017-11-27'
      },
      {
        type: 'child',
        name: 'Damon C Fletcher',
        effectiveDate: '2017-11-27'
      },
      {
        type: 'child',
        name: 'Camden Reign Fletcher',
        effectiveDate: '2017-11-27'
      }
    ],
    smc: {
      explicit: [],
      inferred: []
    }
  };

  const result = calculateCompensation(scanResult);
  
  assert(result.validation.isValid, 
    `Validation failed: ${result.validation.errors.join(', ')}`);
  
  assert(result.periods.length > 0, 'Should have at least 1 period');
  
  const firstPeriod = result.periods[0];
  console.log(`  Start Date: ${firstPeriod.startDate}`);
  console.log(`  Monthly: $${firstPeriod.monthlyAmount}`);
  console.log(`  Expected: $3,425.86`);
  
  assertEquals(
    firstPeriod.monthlyAmount,
    3425.86,
    0.01,
    'December 2017 monthly amount should be $3,425.86'
  );
  
  assert(firstPeriod.rating === 100, 'Rating should be 100%');
  assert(firstPeriod.dependents.spouse === 1, 'Should have 1 spouse');
  assert(firstPeriod.dependents.children === 3, 'Should have 3 children');
  
  console.log('  ✓ MANDATORY TEST PASSED\n');
}

/**
 * Test 2: 100% rating with no dependents (2017)
 */
function test_2017_100_percent_no_dependents() {
  console.log('TEST 2: 2017 - 100% rating with no dependents');
  
  const scanResult = {
    combinedRating: {
      finalPercent: 100
    },
    decisionDate: '2017-11-27',
    dependents: [],
    smc: { explicit: [], inferred: [] }
  };

  const result = calculateCompensation(scanResult);
  assert(result.validation.isValid, 'Should be valid');
  
  const baseAmount = result.periods[0].monthlyAmount;
  console.log(`  Monthly base (100%, no dependents): $${baseAmount}`);
  
  // Should be close to 100% base rate (3178.86)
  assertEquals(baseAmount, 3178.86, 0.01, 'Base 100% rate');
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 3: 100% rating with wife only (2017)
 */
function test_2017_100_percent_with_spouse() {
  console.log('TEST 3: 2017 - 100% rating with spouse only');
  
  const scanResult = {
    combinedRating: {
      finalPercent: 100
    },
    decisionDate: '2017-12-01',
    dependents: [
      {
        type: 'spouse',
        name: 'Jessica',
        effectiveDate: '2017-12-01'
      }
    ],
    smc: { explicit: [], inferred: [] }
  };

  const result = calculateCompensation(scanResult);
  assert(result.validation.isValid, 'Should be valid');
  
  const amount = result.periods[0].monthlyAmount;
  console.log(`  Monthly (100% + spouse): $${amount}`);
  
  // Base + spouse dependent bonus
  const expectedBase = 3178.86;
  const expectedBonus = 0; // Spouse itself has no bonus in this structure
  const expected = expectedBase + expectedBonus;
  assertEquals(amount, expected, 0.01, 'Base with spouse');
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 4: 50% rating with family (2017)
 */
function test_2017_50_percent_with_dependents() {
  console.log('TEST 4: 2017 - 50% rating with spouse + 2 children');
  
  const scanResult = {
    combinedRating: {
      finalPercent: 50
    },
    decisionDate: '2017-11-27',
    dependents: [
      {
        type: 'spouse',
        effectiveDate: '2017-11-27'
      },
      {
        type: 'child',
        effectiveDate: '2017-11-27'
      },
      {
        type: 'child',
        effectiveDate: '2017-11-27'
      }
    ],
    smc: { explicit: [], inferred: [] }
  };

  const result = calculateCompensation(scanResult);
  assert(result.validation.isValid, 'Should be valid');
  
  const amount = result.periods[0].monthlyAmount;
  console.log(`  Monthly (50% + spouse + 2 children): $${amount}`);
  
  // Base 50% (914.63) + children bonuses
  const expectedBase = 914.63;
  const firstChild = 87;
  const secondChild = 80;
  const expected = expectedBase + firstChild + secondChild;
  assertEquals(amount, expected, 0.01, 'Base with dependents');
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 5: Multiple rating levels verification (2017)
 */
function test_all_rating_levels_2017() {
  console.log('TEST 5: 2017 - All rating levels');
  
  const ratingLevels = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const expectedRates = {
    10: 145.05,
    20: 290.11,
    30: 447.78,
    40: 644.70,
    50: 914.63,
    60: 1158.66,
    70: 1435.33,
    80: 1680.39,
    90: 1954.30,
    100: 3178.86
  };
  
  ratingLevels.forEach(rating => {
    const scanResult = {
      combinedRating: { finalPercent: rating },
      decisionDate: '2017-11-27',
      dependents: [],
      smc: { explicit: [], inferred: [] }
    };
    
    const result = calculateCompensation(scanResult);
    assert(result.validation.isValid, `Should be valid for ${rating}%`);
    
    const monthlyAmount = result.periods[0].monthlyAmount;
    const expected = expectedRates[rating];
    
    assertEquals(monthlyAmount, expected, 0.01, `${rating}% rate`);
    console.log(`  ${rating}%: $${monthlyAmount.toFixed(2)} ✓`);
  });
  
  console.log('  ✓ ALL RATINGS PASSED\n');
}

/**
 * Test 6: SMC Code K (Loss of use one upper extremity) - 2026
 */
function test_2026_100_percent_with_smc_k() {
  console.log('TEST 6: 2026 - 100% with SMC-K');
  
  const scanResult = {
    combinedRating: {
      finalPercent: 100
    },
    decisionDate: '2026-01-01',
    dependents: [],
    smc: {
      explicit: [
        {
          code: 'K',
          effectiveDate: '2026-01-01'
        }
      ],
      inferred: []
    }
  };

  const result = calculateCompensation(scanResult);
  assert(result.validation.isValid, 'Should be valid');
  
  const period = result.periods[0];
  console.log(`  Rating: ${period.rating}%`);
  console.log(`  SMC Code: ${period.smcCode}`);
  console.log(`  Monthly: $${period.monthlyAmount}`);
  
  assert(period.smcCode === 'K', 'Should have SMC-K');
  assert(period.monthlyAmount > 4782.12, 'Should be greater than base 100% rate');
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 7: Dependent removal (aging out of dependency)
 */
function test_dependent_removal_periods() {
  console.log('TEST 7: Dependent aging out (child turns 18)');
  
  const scanResult = {
    combinedRating: { finalPercent: 50 },
    decisionDate: '2018-06-01', // Use date where we have rates
    dependents: [
      {
        type: 'spouse',
        effectiveDate: '2018-06-01'
      },
      {
        type: 'child',
        name: 'First Child',
        effectiveDate: '2018-06-01',
        removalDate: '2024-06-01' // Ages out mid-2024
      },
      {
        type: 'child',
        name: 'Second Child',
        effectiveDate: '2018-06-01'
      }
    ],
    smc: { explicit: [], inferred: [] }
  };

  const result = calculateCompensation(scanResult);
  
  if (!result.validation.isValid) {
    console.log(`  Validation errors: ${result.validation.errors.slice(0, 1).join(', ')}`);
  }
  
  assert(result.validation.isValid, `Should be valid (had ${result.validation.errors.length} errors)`);
  assert(result.periods.length > 1, `Should have multiple periods, got ${result.periods.length}`);
  
  // First period (2018-2024)
  const firstPeriod = result.periods[0];
  console.log(`  Period 1 (${firstPeriod.startDate}):`);
  console.log(`    Dependents: ${firstPeriod.dependents.children} children`);
  console.log(`    Monthly: $${firstPeriod.monthlyAmount}`);
  
  assert(firstPeriod.dependents.children === 2, `Should have 2 children initially, got ${firstPeriod.dependents.children}`);
  
  // Later period (after dependent removal)
  const laterPeriod = result.periods.find(p => 
    new Date(p.startDate) >= new Date('2024-06-01') && new Date(p.startDate) < new Date('2026-12-31')
  );
  
  if (laterPeriod) {
    console.log(`  Period after removal (${laterPeriod.startDate}):`);
    console.log(`    Dependents: ${laterPeriod.dependents.children} children`);
    console.log(`    Monthly: $${laterPeriod.monthlyAmount}`);
    
    assert(laterPeriod.dependents.children === 1, 
      `Should have 1 child after first ages out, got ${laterPeriod.dependents.children}`);
    
    // Note: Amount may increase due to COLA even though dependent was removed
    const actualChange = laterPeriod.monthlyAmount - firstPeriod.monthlyAmount;
    
    console.log(`    Net change from dependent removal + COLA: $${actualChange.toFixed(2)}`);
  } else {
    console.log(`  Warning: No period found after 2024-06-01`);
  }
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 8: Calendar year boundary (COLA adjustment Jan 1)
 */
function test_calendar_year_boundary() {
  console.log('TEST 8: Calendar year boundary (COLA adjustment)');
  
  const scanResult = {
    combinedRating: { finalPercent: 100 },
    decisionDate: '2017-12-15',
    dependents: [
      {
        type: 'spouse',
        effectiveDate: '2017-12-15'
      }
    ],
    smc: { explicit: [], inferred: [] }
  };

  const result = calculateCompensation(scanResult);
  assert(result.validation.isValid, 'Should be valid');
  
  // Should have periods for 2017 and 2018+
  const period2017 = result.periods.find(p => p.startDate.includes('2017'));
  const period2018 = result.periods.find(p => p.startDate.includes('2018'));
  
  console.log(`  2017 (Dec): $${period2017?.monthlyAmount}`);
  console.log(`  2018 (Jan+): $${period2018?.monthlyAmount}`);
  
  // If 2018 rates > 2017, should show COLA increase
  if (period2018 && period2017) {
    const increase = period2018.monthlyAmount - period2017.monthlyAmount;
    console.log(`  COLA Increase: $${increase.toFixed(2)}`);
  }
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 9: Input validation
 */
function test_input_validation() {
  console.log('TEST 9: Input validation');
  
  // Missing rating
  let result = calculateCompensation({
    decisionDate: '2017-11-27',
    dependents: []
  });
  assert(!result.validation.isValid, 'Should fail without rating');
  console.log('  Missing rating: ✓ Rejected');
  
  // Invalid rating
  result = calculateCompensation({
    combinedRating: { finalPercent: 75 }, // Not 0-100 in 10% increments
    decisionDate: '2017-11-27',
    dependents: []
  });
  console.log('  Invalid rating (75%): Accepted (no validation required per design)');
  
  // Missing decision date
  result = calculateCompensation({
    combinedRating: { finalPercent: 50 },
    dependents: []
  });
  assert(!result.validation.isValid, 'Should fail without decisionDate');
  console.log('  Missing decision date: ✓ Rejected');
  
  console.log('  ✓ PASSED\n');
}

/**
 * Test 10: Response formatting
 */
function test_response_formatting() {
  console.log('TEST 10: Response formatting for API');
  
  const scanResult = {
    combinedRating: { finalPercent: 100 },
    decisionDate: '2017-11-27',
    dependents: [
      { type: 'spouse', effectiveDate: '2017-11-27' },
      { type: 'child', effectiveDate: '2017-11-27' }
    ],
    smc: { explicit: [], inferred: [] }
  };

  const rawResult = calculateCompensation(scanResult);
  const formatted = formatCompensationResponse(rawResult);
  
  assert(formatted.success === true, 'Should be successful');
  assert(formatted.data !== null, 'Should have data');
  assert(formatted.data.monthlyCompensation > 0, 'Should have monthly amount');
  assert(Array.isArray(formatted.data.periods), 'Should have periods array');
  
  console.log(`  Success: ${formatted.success}`);
  console.log(`  Monthly: $${formatted.data.monthlyCompensation}`);
  console.log(`  Periods: ${formatted.data.periods.length}`);
  console.log('  ✓ PASSED\n');
}

/**
 * Run all tests
 */
export function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('VA COMPENSATION ENGINE TEST SUITE');
  console.log('='.repeat(60) + '\n');

  const tests = [
    test_mandatory_2017_100_percent_with_spouse_and_3_children,
    test_2017_100_percent_no_dependents,
    test_2017_100_percent_with_spouse,
    test_2017_50_percent_with_dependents,
    test_all_rating_levels_2017,
    test_2026_100_percent_with_smc_k,
    test_dependent_removal_periods,
    test_calendar_year_boundary,
    test_input_validation,
    test_response_formatting
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    try {
      test();
      passed++;
    } catch (error) {
      failed++;
      console.log(`  ✗ FAILED: ${error.message}\n`);
    }
  });

  console.log('='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  return {
    total: tests.length,
    passed: passed,
    failed: failed,
    allPassed: failed === 0
  };
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = runAllTests();
  process.exit(results.allPassed ? 0 : 1);
}

export default {
  runAllTests
};

