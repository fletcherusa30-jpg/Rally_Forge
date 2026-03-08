/**
 * REGRESSION TEST: ClaimLetter-2017-12-15.pdf
 * 
 * This test validates that the dependent extraction parser correctly handles
 * the exact VA Rating Decision letter with:
 *   - 4 dependents (1 spouse, 3 children) with effective date Nov 27, 2017
 *   - Removal events for 3 children on Aug 18, 2025 / Oct 21, 2028 / Feb 19, 2032
 *   - Payment start dates in the payment table
 */

import { extractDependents } from '../VA SCANNER/frontend/utils/extractDependents.js';

const CLAIM_LETTER_TEXT = `
Your Rating Decision Letter

We granted your claim for additional dependency benefits because the following dependent(s) meet the criteria.

Type of Dependent Name Effective Date Child Kaiden J Fletcher Nov 27, 2017 Child Damon C Fletcher Nov 27, 2017 Child Camden Reign Fletcher Nov 27, 2017 Spouse Jessica Irene Fletcher Nov 27, 2017

Payment Start Date Award Dependent(s) Aug 18, 2025 Kaiden J Fletcher, Damon C Fletcher, Camden Reign Fletcher, Jessica Irene Fletcher Oct 21, 2028 Kaiden J Fletcher, Jessica Irene Fletcher Feb 19, 2032 Jessica Irene Fletcher

We will remove your dependent Kaiden J Fletcher effective August 18, 2025 because: he is no longer a dependent.

We will remove your dependent Camden Reign Fletcher effective October 21, 2028 because: he is no longer a dependent.

We will remove your dependent Damon C Fletcher effective February 19, 2032 because: he is no longer a dependent.

Combined Disability Rating: 100%
Your Monthly Benefit: $3,938.58
`;

function test(name, assertion) {
  try {
    assertion();
    console.log(`✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertIncludes(array, value, message) {
  if (!array.some(item => item && typeof item === 'object' && item.name === value)) {
    throw new Error(`${message} | Array does not include "${value}". Items: ${array.map(i => i?.name).join(', ')}`);
  }
}

console.log('\n=== CLAIMLETTER-2017-12-15 REGRESSION TEST ===\n');

const result = extractDependents(CLAIM_LETTER_TEXT);

let passed = 0;
let failed = 0;

// Test 1: Dependent table must be detected and parsed
if (test('Should extract exactly 4 dependents from table', () => {
  assertEqual(result.dependents?.length || 0, 4, 'Dependent table extraction');
})) {
  passed++;
} else {
  failed++;
  console.log(`  [DEBUG] Extracted dependents: ${JSON.stringify(result.dependents, null, 2)}`);
}

// Test 2: Check dependent names
const dependentNames = new Set(result.dependents?.map(d => d.name) || []);
if (test('Should extract "Kaiden J Fletcher"', () => {
  assertTrue(dependentNames.has('Kaiden J Fletcher'), 'Kaiden J Fletcher not found in dependents');
})) {
  passed++;
} else {
  failed++;
}

if (test('Should extract "Damon C Fletcher"', () => {
  assertTrue(dependentNames.has('Damon C Fletcher'), 'Damon C Fletcher not found in dependents');
})) {
  passed++;
} else {
  failed++;
}

if (test('Should extract "Camden Reign Fletcher"', () => {
  assertTrue(dependentNames.has('Camden Reign Fletcher'), 'Camden Reign Fletcher not found in dependents');
})) {
  passed++;
} else {
  failed++;
}

if (test('Should extract "Jessica Irene Fletcher"', () => {
  assertTrue(dependentNames.has('Jessica Irene Fletcher'), 'Jessica Irene Fletcher not found in dependents');
})) {
  passed++;
} else {
  failed++;
}

// Test 3: Check dependent types
const kaiden = result.dependents?.find(d => d.name === 'Kaiden J Fletcher');
if (test('Kaiden should be type "child"', () => {
  assertEqual(kaiden?.type, 'child', 'Kaiden type');
})) {
  passed++;
} else {
  failed++;
}

const jessica = result.dependents?.find(d => d.name === 'Jessica Irene Fletcher');
if (test('Jessica should be type "spouse"', () => {
  assertEqual(jessica?.type, 'spouse', 'Jessica type');
})) {
  passed++;
} else {
  failed++;
}

// Test 4: Check effective dates
if (test('All should have effective date Nov 27, 2017', () => {
  result.dependents?.forEach(dep => {
    assertEqual(dep.effectiveDate, '2017-11-27', `${dep.name} effective date`);
  });
})) {
  passed++;
} else {
  failed++;
}

// Test 5: Check removal dates
if (test('Kaiden should have removal date Aug 18, 2025', () => {
  assertEqual(kaiden?.removalDate, '2025-08-18', 'Kaiden removal date');
})) {
  passed++;
} else {
  failed++;
  console.log(`  [DEBUG] Kaiden: ${JSON.stringify(kaiden, null, 2)}`);
}

if (test('Camden should have removal date Oct 21, 2028', () => {
  const camden = result.dependents?.find(d => d.name === 'Camden Reign Fletcher');
  assertEqual(camden?.removalDate, '2028-10-21', 'Camden removal date');
})) {
  passed++;
} else {
  failed++;
  const camden = result.dependents?.find(d => d.name === 'Camden Reign Fletcher');
  console.log(`  [DEBUG] Camden: ${JSON.stringify(camden, null, 2)}`);
}

if (test('Damon should have removal date Feb 19, 2032', () => {
  const damon = result.dependents?.find(d => d.name === 'Damon C Fletcher');
  assertEqual(damon?.removalDate, '2032-02-19', 'Damon removal date');
})) {
  passed++;
} else {
  failed++;
  const damon = result.dependents?.find(d => d.name === 'Damon C Fletcher');
  console.log(`  [DEBUG] Damon: ${JSON.stringify(damon, null, 2)}`);
}

if (test('Jessica should have NO removal date', () => {
  assertEqual(jessica?.removalDate, null, 'Jessica removal date');
})) {
  passed++;
} else {
  failed++;
  console.log(`  [DEBUG] Jessica: ${JSON.stringify(jessica, null, 2)}`);
}

// Test 6: Payment dates should be attached
if (test('Kaiden should have payment dates', () => {
  assertTrue(Array.isArray(kaiden?.paymentStartDates) && kaiden.paymentStartDates.length > 0, 'Kaiden has no payment dates');
})) {
  passed++;
} else {
  failed++;
  console.log(`  [DEBUG] Kaiden payment dates: ${kaiden?.paymentStartDates}`);
}

// Test 7: Removed dependents should be tracked
if (test('Should have 3 removed dependents', () => {
  assertEqual(result.removed?.length || 0, 3, 'Removed dependents count');
})) {
  passed++;
} else {
  failed++;
  console.log(`  [DEBUG] Removed: ${JSON.stringify(result.removed, null, 2)}`);
}

// Test 8: Added dependents should include Jessica only
if (test('Should have 1 added dependent (Jessica)', () => {
  assertEqual(result.added?.length || 0, 1, 'Added dependents count');
  assertTrue(result.added?.some(d => d.name === 'Jessica Irene Fletcher'), 'Jessica not in added list');
})) {
  passed++;
} else {
  failed++;
  console.log(`  [DEBUG] Added: ${JSON.stringify(result.added, null, 2)}`);
}

console.log(`\n=== REGRESSION TEST SUMMARY ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log(`\n✓✓✓ REGRESSION TEST PASSED ✓✓✓`);
  process.exit(0);
} else {
  console.log(`\n✗✗✗ REGRESSION TEST FAILED ✗✗✗`);
  console.log(`Dependent extraction/regression failed for flattened dependency table.`);
  process.exit(1);
}
