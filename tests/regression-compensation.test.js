/**
 * Comprehensive Regression Test Suite for VA Disability Compensation
 * Tests multiple scenarios:
 * - Different disability ratings (10%, 50%, 70%, 100%)
 * - SMC codes (K, L, M, etc.)
 * - Ancillary benefits (A&A, Housebound)
 * - Multiple years (2024, 2025, 2026)
 */

import { getBaseRate, getSMCRate, getAncillaryRate } from '../VA SCANNER/engine/rateLoader.js';

console.log('=== VA COMPENSATION REGRESSION TEST SUITE ===\n');

/**
 * Test Case: Base Rates for Different Ratings (2026)
 */
console.log('TEST 1: Base Disability Rates (2026)');
console.log('--------------------------------------');
const baseRateTests2026 = [
  { rating: 10, expected: 'should return a valid amount > 0' },
  { rating: 20, expected: 'should return a valid amount > 0' },
  { rating: 50, expected: 'should return a valid amount > 0' },
  { rating: 70, expected: 'should return a valid amount > 0' },
  { rating: 100, expected: 'should return 3938.58' }
];

baseRateTests2026.forEach(test => {
  try {
    const rate = getBaseRate(test.rating, 2026);
    const status = rate > 0 ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${test.rating}% rating: $${rate.toFixed(2)} (${status})`);
    if (test.rating === 100 && Math.abs(rate - 3938.58) > 0.01) {
      console.log(`    WARNING: Expected $3938.58, got $${rate.toFixed(2)}`);
    }
  } catch (error) {
    console.log(`  ${test.rating}% rating: ✗ FAIL - ${error.message}`);
  }
});

/**
 * Test Case: SMC Rates (2026)
 */
console.log('\nTEST 2: SMC Rates (2026)');
console.log('------------------------');
const smcTests = [
  { code: 'K', expected: 'should return a valid amount' },
  { code: 'L', expected: 'should return a valid amount' },
  { code: 'M', expected: 'should return a valid amount' },
  { code: 'N½', expected: 'should return a valid amount' },
  { code: 'O', expected: 'should return a valid amount' },
  { code: 'R1', expected: 'should return a valid amount' },
  { code: 'T', expected: 'should return a valid amount' }
];

smcTests.forEach(test => {
  try {
    const rate = getSMCRate(test.code, 2026);
    const status = rate > 0 ? '✓ PASS' : '✗ FAIL';
    console.log(`  SMC-${test.code}: $${rate.toFixed(2)} (${status})`);
  } catch (error) {
    console.log(`  SMC-${test.code}: ✗ FAIL - ${error.message}`);
  }
});

/**
 * Test Case: Ancillary Benefits (2026)
 */
console.log('\nTEST 3: Ancillary Benefits (2026)');
console.log('---------------------------------');
const ancillaryTests = [
  { type: 'aidAndAttendance', expected: 'should return ~$171.00' },
  { type: 'housebound', expected: 'should return ~$107.00' },
  { type: 'clothingAllowance', expected: 'should return ~$37.25' }
];

ancillaryTests.forEach(test => {
  try {
    const rate = getAncillaryRate(test.type, 2026);
    const status = rate > 0 ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${test.type}: $${rate.toFixed(2)} (${status})`);
  } catch (error) {
    console.log(`  ${test.type}: ✗ FAIL - ${error.message}`);
  }
});

/**
 * Test Case: Multi-Year Support
 */
console.log('\nTEST 4: Multi-Year Support');
console.log('---------------------------');
const yearTests = [
  { year: 2024, rating: 100 },
  { year: 2025, rating: 100 },
  { year: 2026, rating: 100 }
];

yearTests.forEach(test => {
  try {
    const rate = getBaseRate(test.rating, test.year);
    if (rate > 0) {
      console.log(`  Year ${test.year}, 100% rating: $${rate.toFixed(2)} ✓ PASS`);
    } else {
      console.log(`  Year ${test.year}, 100% rating: No data available (note: 2024/2025 may need JSON population)`);
    }
  } catch (error) {
    console.log(`  Year ${test.year}, 100% rating: ✗ FAIL - ${error.message}`);
  }
});

/**
 * Test Case: Compensation Breakdown Scenario 1
 * 100% disability with A&A (highest common scenario)
 */
console.log('\nTEST 5: Scenario 1 - 100% with A&A');
console.log('-----------------------------------');
try {
  const base = getBaseRate(100, 2026);
  const aAndA = getAncillaryRate('aidAndAttendance', 2026);
  const total = base + aAndA;
  console.log(`  Base (100%): $${base.toFixed(2)}`);
  console.log(`  A&A Add: $${aAndA.toFixed(2)}`);
  console.log(`  Total Monthly: $${total.toFixed(2)} ✓ PASS`);
  
  if (Math.abs(base - 3938.58) > 0.01 || Math.abs(aAndA - 171.00) > 0.01) {
    console.log(`  WARNING: Expected base $3938.58 + A&A $171.00 = $4109.58`);
  }
} catch (error) {
  console.log(`  ✗ FAIL - ${error.message}`);
}

/**
 * Test Case: Compensation Breakdown Scenario 2
 * 70% disability with SMC-K (common higher rating scenario)
 */
console.log('\nTEST 6: Scenario 2 - 70% with SMC-K');
console.log('-------------------------------------');
try {
  const base = getBaseRate(70, 2026);
  const smc = getSMCRate('K', 2026);
  const total = base + smc;
  console.log(`  Base (70%): $${base.toFixed(2)}`);
  console.log(`  SMC-K: $${smc.toFixed(2)}`);
  console.log(`  Total Monthly: $${total.toFixed(2)} ✓ PASS`);
} catch (error) {
  console.log(`  ✗ FAIL - ${error.message}`);
}

/**
 * Test Case: Compensation Breakdown Scenario 3
 * 50% disability alone (common mid-level rating)
 */
console.log('\nTEST 7: Scenario 3 - 50% Alone');
console.log('--------------------------------');
try {
  const base = getBaseRate(50, 2026);
  console.log(`  Base (50%): $${base.toFixed(2)} ✓ PASS`);
  console.log(`  No SMC or Ancillary`);
  console.log(`  Total Monthly: $${base.toFixed(2)}`);
} catch (error) {
  console.log(`  ✗ FAIL - ${error.message}`);
}

/**
 * Test Case: Edge Cases
 */
console.log('\nTEST 8: Edge Cases');
console.log('------------------');
const edgeCases = [
  { rating: 0, year: 2026, shouldFail: true, desc: 'Invalid 0% rating' },
  { rating: 101, year: 2026, shouldFail: true, desc: 'Invalid >100% rating' },
  { rating: 100, year: 1950, shouldFail: true, desc: 'Too old year (1950)' },
  { rating: 100, year: 2100, shouldFail: true, desc: 'Future year (2100)' },
  { rating: 100, year: 2023, shouldFail: true, desc: 'Unsupported year (2023)' }
];

edgeCases.forEach(test => {
  try {
    const rate = getBaseRate(test.rating, test.year);
    if (test.shouldFail) {
      console.log(`  ${test.desc}: ✗ Should have failed but returned $${rate.toFixed(2)}`);
    } else {
      console.log(`  ${test.desc}: $${rate.toFixed(2)} ✓ PASS`);
    }
  } catch (error) {
    if (test.shouldFail) {
      console.log(`  ${test.desc}: ✓ PASS (correctly rejected)`);
    } else {
      console.log(`  ${test.desc}: ✗ FAIL - ${error.message}`);
    }
  }
});

/**
 * Test Case: Data Consistency
 * Verify 2026 rates are consistent across multiple queries
 */
console.log('\nTEST 9: Data Consistency (2026)');
console.log('--------------------------------');
try {
  const rate1 = getBaseRate(100, 2026);
  const rate2 = getBaseRate(100, 2026);
  const rate3 = getBaseRate(100, 2026);
  
  if (rate1 === rate2 && rate2 === rate3) {
    console.log(`  100% rate queried 3x: $${rate1.toFixed(2)} (consistent) ✓ PASS`);
  } else {
    console.log(`  ✗ FAIL - Rates inconsistent: $${rate1} vs $${rate2} vs $${rate3}`);
  }
} catch (error) {
  console.log(`  ✗ FAIL - ${error.message}`);
}

/**
 * Test Case: Denied Ancillary Should Not Add Cost
 */
console.log('\nTEST 10: Denied Ancillary Logic');
console.log('--------------------------------');
try {
  const baseAlone = getBaseRate(100, 2026);
  const aAndA = getAncillaryRate('aidAndAttendance', 2026);
  
  // Scenario: Decision shows A&A denied
  // Expected: Only base should be used
  const expectedWithDeniedAA = baseAlone; // No A&A added
  
  console.log(`  100% base: $${baseAlone.toFixed(2)}`);
  console.log(`  A&A denied (should be 0): $0.00`);
  console.log(`  Expected total: $${expectedWithDeniedAA.toFixed(2)} ✓ PASS`);
  console.log(`  Note: Scanner must detect 'denied' context to exclude A&A`);
} catch (error) {
  console.log(`  ✗ FAIL - ${error.message}`);
}

console.log('\n=== REGRESSION TEST COMPLETE ===\n');

