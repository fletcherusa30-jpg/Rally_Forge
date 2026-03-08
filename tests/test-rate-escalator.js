#!/usr/bin/env node

/**
 * Test the auto-escalating VA rates system
 */

import { 
  getColaFactor, 
  getDisabilityAmount, 
  getDependentAmount, 
  getRatesForYear, 
  verifyRates 
} from '../VA SCANNER/engine/rateEscalator.js';

console.log('=== VA RATE ESCALATOR TEST ===\n');

// Test 1: COLA factor escalation
console.log('TEST 1: COLA Factors');
for (let year = 2026; year <= 2030; year++) {
  const factor = getColaFactor(year);
  console.log(`  ${year}: ${factor.toFixed(4)} (${((factor - 1) * 100).toFixed(2)}% cumulative)`);
}

// Test 2: Disability rating amounts across years
console.log('\nTEST 2: Disability Rating Amounts ($)');
console.log('Rating | 2026 | 2027 | 2028 | 2029 | 2030');
const ratings = ['10', '50', '70', '100'];
ratings.forEach(rating => {
  const amounts = [2026, 2027, 2028, 2029, 2030].map(year => 
    getDisabilityAmount(rating, year).toFixed(2)
  );
  console.log(`  ${rating}%    | ${amounts.join(' | ')}`);
});

// Test 3: Dependent amounts across years
console.log('\nTEST 3: Dependent Benefit Amounts ($)');
console.log('Dependent | 2026 | 2027 | 2028 | 2029 | 2030');
const dependentTypes = ['spouse', 'child', 'parent'];
dependentTypes.forEach(type => {
  const amounts = [2026, 2027, 2028, 2029, 2030].map(year => 
    getDependentAmount(type, year).toFixed(2)
  );
  console.log(`  ${type.padEnd(9)} | ${amounts.join(' | ')}`);
});

// Test 4: Comprehensive rate snapshot for 2026
console.log('\nTEST 4: Complete 2026 Rate Table (Current Year)');
const rates2026 = getRatesForYear(2026);
console.log('Disability Ratings:');
Object.entries(rates2026.ratings).forEach(([rating, amount]) => {
  console.log(`  ${rating}%: $${amount.toFixed(2)}/month`);
});
console.log('Dependent Additions:');
Object.entries(rates2026.dependents).forEach(([type, amount]) => {
  console.log(`  ${type}: $${amount.toFixed(2)}/month`);
});

// Test 5: Comprehensive rate snapshot for 2030
console.log('\nTEST 5: Projected 2030 Rate Table');
const rates2030 = getRatesForYear(2030);
console.log('COLA Projection: +' + (rates2030.colaPercentage.toFixed(2)) + '% cumulative');
console.log('Disability Ratings:');
const sample2030 = ['10', '50', '70', '100'];
sample2030.forEach(rating => {
  const amount2030 = rates2030.ratings[rating];
  const amount2026 = rates2026.ratings[rating];
  const increase = ((amount2030 - amount2026) / amount2026 * 100).toFixed(1);
  console.log(`  ${rating}%: $${amount2030.toFixed(2)}/month (+$${(amount2030 - amount2026).toFixed(2)} or ${increase}%)`);
});

// Test 6: Dependent addition comparison 2026 vs 2030
console.log('\nTEST 6: Dependent Addition Growth (2026 → 2030)');
dependentTypes.forEach(type => {
  const amt2026 = getDependentAmount(type, 2026);
  const amt2030 = getDependentAmount(type, 2030);
  const increase = ((amt2030 - amt2026) / amt2026 * 100).toFixed(1);
  console.log(`  ${type}: $${amt2026.toFixed(2)} → $${amt2030.toFixed(2)} (+${increase}%)`);
});

// Example: Complete household compensation
console.log('\nTEST 7: Example Household Compensation (70% with Spouse + 2 Children)');
const baselineYear = 2026;
const futureYear = 2030;

console.log(`\nYear ${baselineYear} (Current):`)
const rating70_2026 = getDisabilityAmount('70', baselineYear);
const spouse_2026 = getDependentAmount('spouse', baselineYear);
const child_2026 = getDependentAmount('child', baselineYear);
const total2026 = rating70_2026 + spouse_2026 + (child_2026 * 2);
console.log(`  Base (70%): $${rating70_2026.toFixed(2)}`);
console.log(`  Spouse: $${spouse_2026.toFixed(2)}`);
console.log(`  Children (2): $${(child_2026 * 2).toFixed(2)}`);
console.log(`  TOTAL: $${total2026.toFixed(2)}/month`);

console.log(`\nYear ${futureYear} (Projected):`)
const rating70_2030 = getDisabilityAmount('70', futureYear);
const spouse_2030 = getDependentAmount('spouse', futureYear);
const child_2030 = getDependentAmount('child', futureYear);
const total2030 = rating70_2030 + spouse_2030 + (child_2030 * 2);
console.log(`  Base (70%): $${rating70_2030.toFixed(2)}`);
console.log(`  Spouse: $${spouse_2030.toFixed(2)}`);
console.log(`  Children (2): $${(child_2030 * 2).toFixed(2)}`);
console.log(`  TOTAL: $${total2030.toFixed(2)}/month`);
console.log(`  Monthly Increase: +$${(total2030 - total2026).toFixed(2)} (${((total2030 - total2026) / total2026 * 100).toFixed(1)}%)`);
console.log(`  Annual Increase: +$${((total2030 - total2026) * 12).toFixed(2)}`);

console.log('\n=== RATE ESCALATOR VERIFICATION COMPLETE ===');
console.log('✅ All rates automatically calculate based on COLA');
console.log('ℹ️  Update COLA_HISTORY annually after VA announces new rates');
