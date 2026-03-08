import { computeDependentCompensation } from '../backend/services/dependentCompensationEngine.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${message}`);
  } else {
    failed += 1;
    console.log(`✗ ${message}`);
  }
}

console.log('=== DEPENDENT COMPENSATION ENGINE TESTS ===\n');

const rating = 100;
const dependents = [
  {
    type: 'spouse',
    name: 'Alex Veteran',
    effectiveDate: '2017-11-27',
    removalDate: null,
    paymentStartDates: ['2017-12-01']
  },
  {
    type: 'child',
    name: 'Kaiden J Fletcher',
    effectiveDate: '2017-11-27',
    removalDate: '2025-08-18',
    paymentStartDates: ['2017-12-01', '2018-01-01']
  },
  {
    type: 'child',
    name: 'Riley J Fletcher',
    effectiveDate: '2017-11-27',
    removalDate: '2028-10-21',
    paymentStartDates: ['2017-12-01', '2018-01-01']
  },
  {
    type: 'child',
    name: 'Avery J Fletcher',
    effectiveDate: '2017-11-27',
    removalDate: '2032-02-19',
    paymentStartDates: ['2017-12-01', '2018-01-01']
  }
];

const scanData = {
  metadata: {
    effectiveDate: '2017-11-27'
  }
};

const result = computeDependentCompensation(rating, dependents, scanData);

assert(Array.isArray(result.compensationTimeline), 'compensationTimeline should be an array');
assert(result.compensationTimeline.length >= 4, 'compensationTimeline should include rating and removal dates');
assert(Array.isArray(result.dependentAdjustments), 'dependentAdjustments should be an array');
assert(result.dependentAdjustments.length === 3, 'dependentAdjustments should include three removals');
assert(typeof result.finalMonthlyAmount === 'number', 'finalMonthlyAmount should be numeric');

const firstDate = result.compensationTimeline[0]?.date;
const includes2025 = result.compensationTimeline.some((item) => item.date === '2025-08-18');
const includes2028 = result.compensationTimeline.some((item) => item.date === '2028-10-21');
const includes2032 = result.compensationTimeline.some((item) => item.date === '2032-02-19');

assert(firstDate === '2017-11-27', 'timeline should start at rating effective date');
assert(includes2025, 'timeline should include first child removal date');
assert(includes2028, 'timeline should include second child removal date');
assert(includes2032, 'timeline should include third child removal date');

const entriesAtStart = result.compensationTimeline.find((item) => item.date === '2017-11-27');
assert(entriesAtStart?.dependentCounts?.spouseCount === 1, 'spouse count should be 1 at initial period');
assert(entriesAtStart?.dependentCounts?.childCount === 3, 'child count should be 3 at initial period');

const entriesAfterLastRemoval = result.compensationTimeline.find((item) => item.date === '2032-02-19');
assert(entriesAfterLastRemoval?.dependentCounts?.childCount === 0, 'child count should be 0 after last removal');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
