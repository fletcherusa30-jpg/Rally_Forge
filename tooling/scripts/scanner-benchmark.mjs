import { scanVaDecision } from '../../backend/va_scanner/engine/vaSuperScanner.js';

const fixtures = [
  {
    name: 'SMC textual grant detection',
    text: 'Entitlement to special monthly compensation based on housebound criteria is granted.',
    check: (result) => Array.isArray(result?.smc?.detectedLevels) && result.smc.detectedLevels.some((item) => item.level === 'S')
  },
  {
    name: 'Denied condition extraction',
    text: 'Service connection for migraines is denied due to lack of nexus evidence.',
    check: (result) => Array.isArray(result?.denied) && result.denied.length > 0
  },
  {
    name: 'Service connected extraction',
    text: 'Service connection for tinnitus is granted with an evaluation of 10 percent effective January 1, 2025.',
    check: (result) => Array.isArray(result?.serviceConnected) && result.serviceConnected.length > 0
  }
];

let passed = 0;
const failures = [];

for (const fixture of fixtures) {
  try {
    const result = scanVaDecision(fixture.text);
    const ok = fixture.check(result);
    if (ok) {
      passed += 1;
      console.log(`[PASS] ${fixture.name}`);
    } else {
      failures.push(fixture.name);
      console.log(`[FAIL] ${fixture.name}`);
    }
  } catch (error) {
    failures.push(`${fixture.name}: ${error.message}`);
    console.log(`[FAIL] ${fixture.name}: ${error.message}`);
  }
}

console.log(`\nScanner benchmark complete: ${passed}/${fixtures.length} passed.`);

if (failures.length > 0) {
  console.log('Failures:');
  failures.forEach((failure) => console.log(` - ${failure}`));
  process.exit(1);
}
