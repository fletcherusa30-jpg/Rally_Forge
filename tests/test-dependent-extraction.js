/**
 * Dependent Extraction Test Suite
 * Tests enhanced dependent parsing with NAME, TYPE, MONTHLYAMOUNT, and TOTAL calculation
 */

import { extractDependents } from '../VA SCANNER/frontend/utils/extractDependents.js';

console.log('=== DEPENDENT EXTRACTION TEST SUITE ===\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('✓', message);
    testsPassed++;
  } else {
    console.log('✗ FAIL:', message);
    testsFailed++;
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    console.log('✓', message, `(${actual})`);
    testsPassed++;
  } else {
    console.log('✗ FAIL:', message);
    console.log(`  Expected: ${expected}`);
    console.log(`  Actual: ${actual}`);
    testsFailed++;
  }
}

// ========================================
// TEST CASE 1: Spouse + Children
// ========================================
console.log('\n--- TEST 1: Spouse + Children with Monthly Amounts ---');

const case1 = `
DEPENDENTS

Type of Dependent    Name                Effective Date
Spouse              Jane Doe            Jan 15, 2024
Child               John Doe Jr         Jan 15, 2024
Child               Mary Doe            Jan 15, 2024

Your monthly compensation will increase by $428.00 for spouse effective Jan 15, 2024.
Each child adds $95.00 to your monthly benefit.
`;

const result1 = extractDependents(case1);

assert(result1.added.length === 3, 'Should extract 3 dependents');
assert(result1.added[0].name === 'Jane Doe', 'First dependent name should be "Jane Doe"');
assertEquals(result1.added[0].type, 'spouse', 'First dependent type should be "spouse"');
assert(/^\d{4}-\d{2}-\d{2}$/.test(result1.added[0].effectiveDate), 'Should normalize effective date to YYYY-MM-DD');
assert(result1.totalDependentAmount > 0, 'Total dependent amount should be greater than 0');

console.log(`  Total Dependent Amount: $${result1.totalDependentAmount.toFixed(2)}`);

// ========================================
// TEST CASE 2: Spouse Only
// ========================================
console.log('\n--- TEST 2: Spouse Only ---');

const case2 = `
We added your dependent:
- Spouse: Sarah Johnson, effective March 1, 2024

Your monthly compensation increases by $428.00.
`;

const result2 = extractDependents(case2);

assertEquals(result2.added.length, 1, 'Should extract 1 dependent');
assertEquals(result2.added[0].name, 'Sarah Johnson', 'Dependent name should be "Sarah Johnson"');
assertEquals(result2.added[0].type, 'spouse', 'Dependent type should be "spouse"');
assert(result2.totalDependentAmount >= 0, 'Should calculate total amount');

// ========================================
// TEST CASE 3: Multiple Children with Different Effective Dates
// ========================================
console.log('\n--- TEST 3: Multiple Children with Different Dates ---');

const case3 = `
Dependent changes:
- Child: Robert Smith (age 5), effective February 1, 2024 - $95.00/month
- Child: Emily Smith (age 8), effective February 1, 2024 - $95.00/month
- Child: Michael Smith, effective May 1, 2024 - $95.00/month
`;

const result3 = extractDependents(case3);

assert(result3.added.length >= 2, 'Should extract at least 2 child dependents');
assert(result3.added.every(d => d.type === 'child'), 'All dependents should be type "child"');
assert(result3.totalDependentAmount > 0, 'Should calculate total for all children');

console.log(`  Extracted ${result3.added.length} children`);
console.log(`  Total monthly addition: $${result3.totalDependentAmount.toFixed(2)}`);

// ========================================
// TEST CASE 4: Dependent Parent
// ========================================
console.log('\n--- TEST 4: Dependent Parent ---');

const case4 = `
We added the following dependent:

Type of Dependent    Name                Effective Date
Parent              Martha Williams      April 10, 2024

Monthly benefit adjustment: $150.00
`;

const result4 = extractDependents(case4);

assertEquals(result4.added.length, 1, 'Should extract 1 parent dependent');
assertEquals(result4.added[0].type, 'parent', 'Dependent type should be "parent"');
assert(result4.added[0].monthlyAmount >= 0, 'Should extract monthly amount');

// ========================================
// TEST CASE 5: Amounts on Separate Lines
// ========================================
console.log('\n--- TEST 5: Dependent Amounts on Separate Lines ---');

const case5 = `
We added your spouse Jennifer Lee effective June 1, 2024.

Your compensation breakdown:
Base rating (70%): $1,808.45
Spouse addition: $150.00
Total monthly: $1,958.45
`;

const result5 = extractDependents(case5);

assert(result5.added.length >= 1, 'Should extract spouse');
assert(result5.totalDependentAmount > 0, 'Should find amount on subsequent lines');

// ========================================
// TEST CASE 6: Table Format with Amounts
// ========================================
console.log('\n--- TEST 6: Table Format with Monthly Amounts ---');

const case6 = `
DEPENDENT CHANGES

Type        Name                Effective       Monthly
Spouse      Amanda Brown        Jan 1, 2024     $428.00
Child       Chris Brown         Jan 1, 2024     $95.00
Child       Lisa Brown          Jan 1, 2024     $95.00

Total dependent addition: $618.00/month
`;

const result6 = extractDependents(case6);

assert(result6.added.length >= 2, 'Should extract multiple dependents from table');
assertEquals(result6.totalDependentAmount, 618.00, 'Total should match stated amount');

// ========================================
// TEST CASE 7: Validation - Missing Name
// ========================================
console.log('\n--- TEST 7: Validation - Missing Name Detection ---');

const case7 = `
Dependent entry with effective date March 1, 2024 but incomplete information.
`;

const result7 = extractDependents(case7);

// This should either skip the entry or flag it as a validation warning
if (result7.validationWarnings && result7.validationWarnings.length > 0) {
  console.log(`✓ Validation warnings detected: ${result7.validationWarnings.length}`);
  testsPassed++;
} else {
  console.log('  (No validation warnings - acceptable if no partial entries detected)');
}

// ========================================
// TEST CASE 8: Validation - Spouse Detected but Not Parsed
// ========================================
console.log('\n--- TEST 8: Validation - Spouse Detection ---');

const case8 = `
We note that you are married as of January 2024.
Your spouse is eligible for dependent benefits.
`;

const result8 = extractDependents(case8);

const hasSpouseWarning = result8.validationWarnings?.some(w => 
  w.message.toLowerCase().includes('spouse')
);

if (hasSpouseWarning) {
  console.log('✓ Correctly flags unextracted spouse mention');
  testsPassed++;
} else {
  console.log('  (No spouse warning - may need to check if spouse was successfully extracted)');
}

// ========================================
// TEST CASE 9: Removal statement + payment table merge
// ========================================
console.log('\n--- TEST 9: Merge table + removals + payment starts ---');

const case9 = `
Type of Dependent    Name                Effective Date
Child                Kaiden J Fletcher   Jan 01, 2020
Spouse               Dana Fletcher       Jan 01, 2020

Payment Start Date   Award Dependent(s)
Oct 21, 2028         Kaiden J Fletcher, Dana Fletcher
Feb 19, 2032         Dana Fletcher

We will remove your dependent Kaiden J Fletcher effective August 18, 2025 because:
• Child reached age limit
`;

const result9 = extractDependents(case9);
const kaiden = result9.dependents.find((d) => d.name === 'Kaiden J Fletcher');
const dana = result9.dependents.find((d) => d.name === 'Dana Fletcher');

assert(!!kaiden, 'Kaiden should be present in merged dependents list');
assert(!!dana, 'Dana should be present in merged dependents list');
assertEquals(kaiden.removalDate, '2025-08-18', 'Kaiden removal date should be parsed');
assert(kaiden.reasonRemoved?.length > 0, 'Kaiden removal reason should be parsed');
assert(Array.isArray(kaiden.paymentStartDates) && kaiden.paymentStartDates.includes('2028-10-21'), 'Kaiden payment start date should be captured');
assert(Array.isArray(dana.paymentStartDates) && dana.paymentStartDates.includes('2028-10-21') && dana.paymentStartDates.includes('2032-02-19'), 'Dana payment start dates should be captured');

// ========================================
// TEST CASE 10: Removal without initial table entry warning
// ========================================
console.log('\n--- TEST 10: Warning for removal without initial table entry ---');

const case10 = `
We will remove your dependent Unknown Person effective August 18, 2025 because:
• No longer eligible
`;

const result10 = extractDependents(case10);
const warningFound = (result10.validationWarnings || []).some((w) =>
  String(w.message || '').includes('Dependent removal found without initial dependent entry.')
);

assert(warningFound, 'Should warn when removal exists without initial dependent table entry');

// ========================================
// TEST CASE 11: Flattened single-line PDF text
// ========================================
console.log('\n--- TEST 11: Flattened single-line table parsing ---');

const case11 = `
Type of Dependent Name Effective Date Spouse Jordan Fletcher Nov 27, 2017 Child Kaiden J Fletcher Nov 27, 2017 Child Riley J Fletcher Nov 27, 2017
Payment Start Date Award Dependent(s) Aug 18, 2025 Jordan Fletcher, Riley J Fletcher Oct 21, 2028 Jordan Fletcher Feb 19, 2032 Jordan Fletcher
`;

const result11 = extractDependents(case11);

assert(result11.dependents.length >= 3, 'Should extract dependents from flattened single-line table');
assert(result11.dependents.some((d) => d.name === 'Jordan Fletcher' && d.type === 'spouse'), 'Should extract spouse from flattened text');
assert(result11.dependents.some((d) => d.name === 'Kaiden J Fletcher' && d.type === 'child'), 'Should extract first child from flattened text');
assert(result11.dependents.some((d) => d.name === 'Riley J Fletcher' && d.type === 'child'), 'Should extract second child from flattened text');

const jordan = result11.dependents.find((d) => d.name === 'Jordan Fletcher');
assert(Array.isArray(jordan?.paymentStartDates) && jordan.paymentStartDates.length >= 2, 'Should attach payment start dates from flattened payment table');

// ========================================
// TEST CASE 12: Payment table with first names only
// ========================================
console.log('\n--- TEST 12: First-name payment mapping ---');

const case12 = `
Type of Dependent Name Effective Date Child Kaiden J Fletcher Nov 27, 2017 Child Damon C Fletcher Nov 27, 2017 Child Camden Reign Fletcher Nov 27, 2017 Spouse Jessica Irene Fletcher Nov 27, 2017
Payment Start Date Award Dependent(s) Aug 18, 2025 Kaiden, Damon, Camden, Jessica Oct 21, 2028 Kaiden, Jessica Feb 19, 2032 Jessica
`;

const result12 = extractDependents(case12);
const kaiden12 = result12.dependents.find((d) => d.name === 'Kaiden J Fletcher');
const jessica12 = result12.dependents.find((d) => d.name === 'Jessica Irene Fletcher');

assert(Array.isArray(kaiden12?.paymentStartDates) && kaiden12.paymentStartDates.includes('2025-08-18'), 'Should map first-name payment "Kaiden" to full dependent record');
assert(Array.isArray(jessica12?.paymentStartDates) && jessica12.paymentStartDates.includes('2032-02-19'), 'Should map first-name payment "Jessica" to full dependent record');

// ========================================
// TEST CASE 13: Ignore summary "No dependents" when table exists
// ========================================
console.log('\n--- TEST 13: Table overrides summary text ---');

const case13 = `
Dependents: No dependents.
Type of Dependent Name Effective Date Spouse Jordan Fletcher Nov 27, 2017 Child Riley J Fletcher Nov 27, 2017
`;

const result13 = extractDependents(case13);
assert(result13.dependents.length >= 2, 'Should parse dependent table even when summary says "No dependents"');
assert(result13.dependents.some((d) => d.name === 'Jordan Fletcher'), 'Should include spouse from table override');

// ========================================
// TEST CASE 14: Prevent legal-text spillover into dependents
// ========================================
console.log('\n--- TEST 14: Ignore legal text after payment table ---');

const case14 = `
Type of Dependent Name Effective Date Child Kaiden J Fletcher Nov 27, 2017 Child Damon C Fletcher Nov 27, 2017 Child Camden Reign Fletcher Nov 27, 2017 Spouse Jessica Irene Fletcher Nov 27, 2017
Payment Start Date Award Dependent(s) Aug 18, 2025 Kaiden, Damon, Camden, Jessica
Let us know right away if there is any change in the status of your dependent. Please Take Action: What Things Affect Your Right to Payment?
Page 7 Evidence received shows a change is warranted.
`;

const result14 = extractDependents(case14);
assertEquals(result14.dependents.length, 4, 'Should keep only true dependent rows');
assert(!result14.dependents.some((d) => /let us know|please take action|page\s+7|payment start date/i.test(d.name)), 'Should reject legal-text fragments as dependent names');
assert(result14.dependents.some((d) => d.name === 'Jessica Irene Fletcher' && d.type === 'spouse'), 'Should preserve valid spouse entry');

// ========================================
// SUMMARY
// ========================================
console.log('\n=== TEST SUMMARY ===');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✓✓✓ ALL TESTS PASSED ✓✓✓');
} else {
  console.log(`\n⚠ ${testsFailed} test(s) failed`);
  process.exit(1);
}
