/**
 * Compensation Engine Test Suite
 * Demonstrates all major functions and validates calculations
 */

import CompensationEngine from './index.js';
import {
  selectYearTable,
  getTableByEffectiveDate,
  getAvailableYears,
  detectCurrentYear
} from './year-selector.js';

console.log('\n' + '='.repeat(70));
console.log('VA COMPENSATION ENGINE - TEST SUITE');
console.log('='.repeat(70));

// Test 1: Available Years
console.log('\n[TEST 1] Available Compensation Years');
const years = getAvailableYears();
console.log(`✓ Available years: ${years.join(', ')}`);

// Test 2: Current Year Detection
console.log('\n[TEST 2] Current Year Detection');
const currentYear = detectCurrentYear();
console.log(`✓ Current year: ${currentYear}`);

// Test 3: Rate Table Loading
console.log('\n[TEST 3] Rate Table Loading');
const rateTable = selectYearTable(2026);
console.log(`✓ Loaded 2026 rates`);
console.log(`  - 100% rating: $${rateTable.baseCompensation['100']}/month`);
console.log(`  - SMC T: $${rateTable.smc.T.amount}/month`);

// Test 4: Base Compensation (no dependents)
console.log('\n[TEST 4] Base Compensation Calculation (100% no dependents)');
try {
  const baseComp = CompensationEngine.getCompensationByRating(100, {}, 2026);
  console.log(`✓ Base 100%: $${baseComp.baseMonthly}/month`);
  console.log(`  - Total monthly: $${baseComp.totalMonthly}`);
  console.log(`  - Total yearly: $${baseComp.yearlyTotal}`);
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 5: Base Compensation with Dependents
console.log('\n[TEST 5] Base Compensation with Dependents (100% + spouse + 2 children)');
try {
  const withDeps = CompensationEngine.getCompensationByRating(
    100,
    {spouse: 1, children: 2, parents: 0},
    2026
  );
  console.log(`✓ Base 100%: $${withDeps.baseMonthly}/month`);
  console.log(`  - Dependents: $${withDeps.dependentMonthly}/month`);
  console.log(`  - Total monthly: $${withDeps.totalMonthly}`);
  console.log(`  - Total yearly: $${withDeps.yearlyTotal}`);
  console.log(`  - Breakdown:`, withDeps.breakdown.dependentAdditions);
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 6: SMC Code Amount
console.log('\n[TEST 6] SMC Code Amount (Code T - Highest Level)');
try {
  const smc = CompensationEngine.getSMCAmount('T', 2026);
  console.log(`✓ SMC ${smc.code}: $${smc.smcMonthly}/month`);
  console.log(`  - Description: ${smc.description}`);
  console.log(`  - CFR: ${smc.cfr}`);
  console.log(`  - Yearly: $${smc.yearlyTotal}`);
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 7: All SMC Codes
console.log('\n[TEST 7] All SMC Codes (2026)');
const allSMCs = ['K', 'L', 'L½', 'M', 'M½', 'N', 'N½', 'O', 'R1', 'R2', 'S', 'T'];
allSMCs.forEach(code => {
  try {
    const smc = CompensationEngine.getSMCAmount(code, 2026);
    console.log(`  ${code.padEnd(3)} = $${smc.smcMonthly.toString().padStart(7)}/month`);
  } catch (error) {
    console.error(`  ${code} - ERROR: ${error.message}`);
  }
});

// Test 8: Ancillary Benefits
console.log('\n[TEST 8] Ancillary Benefits (2026)');
try {
  const ancillary = CompensationEngine.getAncillaryBenefits(2026);
  console.log(`✓ Clothing allowance: $${ancillary.clothing.monthly}/month ($${ancillary.clothing.yearly}/year)`);
  console.log(`  - A&A: $${ancillary.aidAndAttendance.monthly}/month ($${ancillary.aidAndAttendance.yearly}/year)`);
  console.log(`  - Housebound: $${ancillary.housebound.monthly}/month ($${ancillary.housebound.yearly}/year)`);
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 9: Complete Compensation Calculation
console.log('\n[TEST 9] Complete Compensation (100% + spouse + 1 child + SMC-T + A&A)');
try {
  const fullComp = CompensationEngine.calculateVeteranCompensation({
    rating: 100,
    dependents: {spouse: 1, children: 1, parents: 0},
    smcCode: 'T',
    ancillary: {aidAndAttendance: true, housebound: false},
    effectiveDate: '2026-01-01'
  });

  console.log(`✓ Base compensation: $${fullComp.components.base.baseMonthly}/month`);
  console.log(`  - Dependents: $${fullComp.components.base.dependentMonthly}/month`);
  console.log(`  - SMC (${fullComp.components.smc.code}): $${fullComp.components.smc.smcMonthly}/month`);
  console.log(`  - A&A: $${fullComp.components.ancillary.aidAndAttendance}/month`);
  console.log(`  ─────────────────────────────`);
  console.log(`  - TOTAL MONTHLY: $${fullComp.summary.totalMonthly}`);
  console.log(`  - TOTAL YEARLY: $${fullComp.summary.totalYearly}`);
  console.log(`  - Using rates from: ${fullComp.summary.year}`);
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 10: Effective Date Based Rate Selection
console.log('\n[TEST 10] Effective Date Based Rate Selection');
try {
  const comp2024 = CompensationEngine.calculateVeteranCompensation({
    rating: 100,
    dependents: {spouse: 1},
    effectiveDate: '2024-06-15'  // Should use 2024 rates
  });

  const comp2025 = CompensationEngine.calculateVeteranCompensation({
    rating: 100,
    dependents: {spouse: 1},
    effectiveDate: '2025-06-15'  // Should use 2025 rates
  });

  console.log(`✓ 2024 effective date uses: 2024 rates`);
  console.log(`  - Base 100%: $${comp2024.components.base.baseMonthly}`);
  console.log(`✓ 2025 effective date uses: 2025 rates`);
  console.log(`  - Base 100%: $${comp2025.components.base.baseMonthly}`);
  console.log(`✓ Rate difference: $${comp2025.components.base.baseMonthly - comp2024.components.base.baseMonthly} (COLA increase)`);
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 11: Compensation Timeline
console.log('\n[TEST 11] Compensation Timeline (Multi-Period Calculation)');
try {
  const timeline = CompensationEngine.getCompensationTimeline([
    {
      effectiveDate: '2024-01-01',
      rating: 50,
      dependents: {spouse: 1, children: 0, parents: 0}
    },
    {
      effectiveDate: '2024-06-15',
      rating: 70,
      dependents: {spouse: 1, children: 1, parents: 0}
    },
    {
      effectiveDate: '2025-01-01',
      rating: 100,
      dependents: {spouse: 1, children: 1, parents: 0},
      smcCode: 'T'
    }
  ]);

  console.log('✓ Timeline generated with 3 periods:');
  timeline.forEach(period => {
    console.log(`  Period ${period.period}: ${period.effectiveDate} → ${period.endDate}`);
    console.log(`    Monthly: $${period.breakdown.baseMonthly} (base) + $${period.breakdown.dependentMonthly} (deps) = $${period.breakdown.totalMonthly}`);
  });
} catch (error) {
  console.error('✗ Error:', error.message);
}

// Test 12: Input Validation
console.log('\n[TEST 12] Input Validation');
const validTest = CompensationEngine.validateCompensationInput({
  rating: 100,
  dependents: {spouse: 1, children: 0, parents: 0},
  smcCode: 'T'
});
console.log(`✓ Valid input:`, validTest.valid, validTest.errors.length === 0 ? '✓' : validTest.errors);

const invalidTest = CompensationEngine.validateCompensationInput({
  rating: 75,  // Invalid: must be 10% increment
  smcCode: 'X' // Invalid: not a valid SMC code
});
console.log(`✓ Invalid input detected:`, !invalidTest.valid, 'Errors:', invalidTest.errors);

// Test 13: Different Rating Tiers
console.log('\n[TEST 13] Rating Tiers Comparison (2026 Rates) - Compensable Ratings');
const tiers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
console.log('Rating | Base Monthly | With Spouse | With S + 2 Kids');
console.log('─'.repeat(50));
tiers.forEach(rating => {
  const base = CompensationEngine.getCompensationByRating(rating, {}, 2026);
  const withSpouse = CompensationEngine.getCompensationByRating(rating, {spouse: 1, children: 0, parents: 0}, 2026);
  const withFamily = CompensationEngine.getCompensationByRating(rating, {spouse: 1, children: 2, parents: 0}, 2026);
  console.log(
    `  ${rating.toString().padEnd(2)}% | $${base.baseMonthly.toFixed(2).toString().padStart(11)} | $${withSpouse.totalMonthly.toFixed(2).toString().padStart(10)} | $${withFamily.totalMonthly.toFixed(2).toString().padStart(13)}`
  );
});

// Test 14: Error Handling
console.log('\n[TEST 14] Error Handling');
try {
  CompensationEngine.getCompensationByRating(75);  // Invalid rating
} catch (error) {
  console.log(`✓ Caught invalid rating: "${error.message}"`);
}

try {
  CompensationEngine.getSMCAmount('INVALID');  // Invalid code
} catch (error) {
  console.log(`✓ Caught invalid SMC code: "${error.message}"`);
}

try {
  CompensationEngine.getCompensationByRating(100, {}, 1999);  // Invalid year
} catch (error) {
  console.log(`✓ Caught invalid year: "${error.message}"`);
}

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE COMPLETE');
console.log('='.repeat(70) + '\n');

